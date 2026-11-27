import {
  DriveFileKind,
  DriveSyncFileManifest,
  DriveTransferProgress,
} from '../types';

const DRIVE_RESUMABLE_CHUNK_ALIGN = 256 * 1024; // 256 KiB (exigência da API Drive Resumable)
const DEFAULT_CHUNK_BYTES = 1024 * 1024; // 1 MiB
const DEFAULT_MAX_CONCURRENCY = 3;
const RESUMABLE_SESSION_CACHE_KEY = 'emeb_drive_resumable_sessions_v1';
const APPDATA_MANIFEST_FILENAME = 'sync_manifest_v1.json.gz';

const getConfiguredChunkBytes = (): number => {
  try {
    const raw =
      typeof import.meta !== 'undefined'
        ? (import.meta as any).env?.VITE_DRIVE_LOSSLESS_CHUNK_BYTES
        : undefined;
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= DRIVE_RESUMABLE_CHUNK_ALIGN) {
      return Math.floor(parsed / DRIVE_RESUMABLE_CHUNK_ALIGN) * DRIVE_RESUMABLE_CHUNK_ALIGN;
    }
  } catch {
    // fallback default
  }
  return DEFAULT_CHUNK_BYTES;
};

export const getConfiguredDriveConcurrency = (): number => {
  try {
    const raw =
      typeof import.meta !== 'undefined'
        ? (import.meta as any).env?.VITE_DRIVE_MAX_CONCURRENCY
        : undefined;
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 1) {
      return Math.min(6, Math.max(1, Math.floor(parsed)));
    }
  } catch {
    // fallback default
  }
  return DEFAULT_MAX_CONCURRENCY;
};

const toArrayBuffer = async (input: ArrayBuffer | Uint8Array | Blob): Promise<ArrayBuffer> => {
  if (input instanceof Blob) return input.arrayBuffer();
  if (input instanceof Uint8Array) {
    return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer;
  }
  return input;
};

const toUint8Array = async (input: ArrayBuffer | Uint8Array | Blob): Promise<Uint8Array> => {
  if (input instanceof Uint8Array) return input;
  if (input instanceof Blob) return new Uint8Array(await input.arrayBuffer());
  return new Uint8Array(input);
};

const bytesToHex = (bytes: Uint8Array): string => {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
};

/**
 * SHA-256 via WebCrypto nativo (hardware-accelerated) com fallback determinístico em ambientes sem crypto.subtle.
 */
export const computeSha256Hex = async (
  input: ArrayBuffer | Uint8Array | Blob
): Promise<string> => {
  const buf = await toArrayBuffer(input);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return bytesToHex(new Uint8Array(digest));
  }
  const bytes = new Uint8Array(buf);
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < bytes.length; i++) {
    h1 ^= bytes[i];
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= bytes[bytes.length - 1 - i] ^ (i & 0xff);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0)
    .toString(16)
    .padStart(8, '0')}_${bytes.length}`;
};

// Tabela padrão RFC 1321 para cálculo MD5 compatível com `md5Checksum` do Google Drive
const MD5_SHIFTS = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

const MD5_K = Array.from({ length: 64 }, (_, i) =>
  Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0
);

/**
 * Calcula MD5 RFC 1321 em TypeScript puro (32 chars hex minúsculo), idêntico ao `md5Checksum` do Google Drive.
 */
export const computeMd5Hex = async (
  input: ArrayBuffer | Uint8Array | Blob
): Promise<string> => {
  const data = await toUint8Array(input);
  const origLenBits = data.length * 8;
  const withOneLen = data.length + 1;
  const padZeroBytes = (64 - ((withOneLen + 8) % 64)) % 64;
  const totalLen = withOneLen + padZeroBytes + 8;

  const padded = new Uint8Array(totalLen);
  padded.set(data, 0);
  padded[data.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(totalLen - 8, origLenBits >>> 0, true);
  view.setUint32(totalLen - 4, Math.floor(origLenBits / 0x100000000) >>> 0, true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let offset = 0; offset < totalLen; offset += 64) {
    const M = new Uint32Array(16);
    for (let j = 0; j < 16; j++) {
      M[j] = view.getUint32(offset + j * 4, true);
    }

    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;

    for (let i = 0; i < 64; i++) {
      let F = 0;
      let g = 0;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }

      F = (F + A + MD5_K[i] + M[g]) >>> 0;
      A = D;
      D = C;
      C = B;
      const s = MD5_SHIFTS[i];
      B = (B + ((F << s) | (F >>> (32 - s)))) >>> 0;
    }

    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const out = new Uint8Array(16);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, a0, true);
  outView.setUint32(4, b0, true);
  outView.setUint32(8, c0, true);
  outView.setUint32(12, d0, true);
  return bytesToHex(out);
};

/**
 * Compactação Gzip EXCLUSIVA para metadados JSON (nunca aplicada em fotos, PDFs ou binários).
 */
export const compressJsonMetadataGzip = async (
  payload: unknown
): Promise<{ bytes: Uint8Array; compressed: boolean; contentType: string }> => {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(payload));
  if (typeof CompressionStream !== 'undefined') {
    try {
      const stream = new Blob([jsonBytes])
        .stream()
        .pipeThrough(new CompressionStream('gzip'));
      const buf = await new Response(stream).arrayBuffer();
      return {
        bytes: new Uint8Array(buf),
        compressed: true,
        contentType: 'application/gzip',
      };
    } catch {
      // fallback sem gzip se stream falhar
    }
  }
  return {
    bytes: jsonBytes,
    compressed: false,
    contentType: 'application/json;charset=utf-8',
  };
};

export const decompressJsonMetadataGzip = async <T = unknown>(bytes: Uint8Array): Promise<T> => {
  const isGzipMagic = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (isGzipMagic && typeof DecompressionStream !== 'undefined') {
    const cleanBuf = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer;
    const stream = new Blob([cleanBuf])
      .stream()
      .pipeThrough(new DecompressionStream('gzip'));
    const text = await new Response(stream).text();
    return JSON.parse(text) as T;
  }
  const text = new TextDecoder('utf-8').decode(bytes);
  return JSON.parse(text) as T;
};

/**
 * Pool de concorrência limitada para evitar saturação de rede/RAM em lotes grandes.
 */
export const runWithConcurrencyLimit = async <T, R>(
  items: T[],
  concurrencyLimit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  const limit = Math.max(1, Math.min(concurrencyLimit, 8));
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runner = async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await worker(items[idx], idx);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, () => runner())
  );
  return results;
};

interface ResumableSessionEntry {
  uploadUri: string;
  totalBytes: number;
  createdAtMs: number;
}

const getStoredResumableUri = (key: string, totalBytes: number): string | null => {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(RESUMABLE_SESSION_CACHE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, ResumableSessionEntry>;
    const entry = map[key];
    if (!entry || entry.totalBytes !== totalBytes) return null;
    // Sessões resumíveis no Google Drive expiram em ~1 semana; limitamos cache local a 12h
    if (Date.now() - entry.createdAtMs > 12 * 60 * 60 * 1000) return null;
    return entry.uploadUri || null;
  } catch {
    return null;
  }
};

const saveStoredResumableUri = (key: string, uploadUri: string, totalBytes: number): void => {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(RESUMABLE_SESSION_CACHE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, ResumableSessionEntry>) : {};
    map[key] = { uploadUri, totalBytes, createdAtMs: Date.now() };
    const keys = Object.keys(map);
    if (keys.length > 80) {
      keys
        .sort((a, b) => (map[a]?.createdAtMs || 0) - (map[b]?.createdAtMs || 0))
        .slice(0, keys.length - 80)
        .forEach((k) => delete map[k]);
    }
    localStorage.setItem(RESUMABLE_SESSION_CACHE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage quota errors
  }
};

const removeStoredResumableUri = (key: string): void => {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(RESUMABLE_SESSION_CACHE_KEY);
    if (!raw) return;
    const map = JSON.parse(raw) as Record<string, ResumableSessionEntry>;
    if (map[key]) {
      delete map[key];
      localStorage.setItem(RESUMABLE_SESSION_CACHE_KEY, JSON.stringify(map));
    }
  } catch {
    // ignore
  }
};

const sleepBackoff = (attempt: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Transferência cancelada pelo usuário.', 'AbortError'));
      return;
    }
    const ms = Math.min(8000, 600 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 250));
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException('Transferência cancelada pelo usuário.', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });

export interface LosslessDriveUploadParams {
  accessToken: string;
  fileName: string;
  bytes: Uint8Array;
  mimeType: string;
  folderId?: string;
  space?: 'drive' | 'appDataFolder';
  existingFileId?: string;
  kind?: DriveFileKind;
  studentId?: string;
  classId?: string;
  description?: string;
  updatedByEmail?: string;
  signal?: AbortSignal;
  waitIfPaused?: () => Promise<void>;
  onProgress?: (progress: DriveTransferProgress) => void;
}

export interface LosslessDriveUploadResult {
  fileId: string;
  name: string;
  webViewLink: string;
  thumbnailLink?: string;
  sizeBytes: number;
  sha256: string;
  md5Checksum: string;
  verified: boolean;
  skippedIdentical: boolean;
  resumedSession: boolean;
  manifest: DriveSyncFileManifest;
}

/**
 * Envia arquivo binário ou JSON ao Google Drive de forma 100% lossless:
 * - Calcula SHA-256 e MD5 antes do envio
 * - Deduplica se arquivo remoto possuir exatamente o mesmo md5Checksum/sha256
 * - Usa multipart para <= 256 KiB e Resumable Chunked Upload (com retomada HTTP 308) para arquivos maiores
 * - Valida md5Checksum + size/sha256 retornado pelo Google Drive após o upload
 */
export const uploadFileLosslessToDrive = async (
  params: LosslessDriveUploadParams
): Promise<LosslessDriveUploadResult> => {
  const {
    accessToken,
    fileName,
    bytes,
    mimeType,
    folderId,
    space = 'drive',
    description,
    kind = 'metadata_backup',
    studentId,
    classId,
    updatedByEmail = '',
    signal,
    waitIfPaused,
    onProgress,
  } = params;

  if (!accessToken) {
    throw new Error('Sessão Google Drive não autorizada.');
  }

  onProgress?.({
    phase: 'hashing',
    fileName,
    bytesTransferred: 0,
    totalBytes: bytes.byteLength,
    percent: 0,
    completedFiles: 0,
    totalFiles: 1,
    verifiedCount: 0,
    failedCount: 0,
  });

  const [sha256, md5Checksum] = await Promise.all([
    computeSha256Hex(bytes),
    computeMd5Hex(bytes),
  ]);

  let targetFileId = params.existingFileId;
  const parentId = space === 'appDataFolder' ? 'appDataFolder' : folderId;

  // Deduplicação prévia no Drive: verifica se já existe arquivo com mesmo nome na pasta/space
  if (!targetFileId && parentId) {
    try {
      const q = encodeURIComponent(
        `'${parentId}' in parents and name = '${fileName.replace(/'/g, "\\'")}' and trashed = false`
      );
      const spacesParam = space === 'appDataFolder' ? 'appDataFolder' : 'drive';
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${q}&spaces=${spacesParam}&fields=files(id,name,md5Checksum,size,webViewLink,thumbnailLink,appProperties)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`;
      const searchRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal,
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const existing = Array.isArray(searchData.files) ? searchData.files[0] : null;
        if (existing?.id) {
          targetFileId = existing.id;
          const remoteMd5 = String(existing.md5Checksum || '').toLowerCase();
          const remoteSha = String(existing.appProperties?.sha256 || '').toLowerCase();
          const remoteSize = Number(existing.size || 0);
          if (
            (remoteMd5 && remoteMd5 === md5Checksum) ||
            (remoteSha && remoteSha === sha256 && remoteSize === bytes.byteLength)
          ) {
            const webViewLink =
              existing.webViewLink || `https://drive.google.com/file/d/${existing.id}/view`;
            const manifest: DriveSyncFileManifest = {
              id: `${kind}_${studentId || existing.id}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128),
              studentId,
              classId,
              kind,
              fileName,
              driveFileId: existing.id,
              driveWebViewLink: webViewLink,
              driveFolderId: folderId,
              mimeType,
              byteSize: bytes.byteLength,
              sha256,
              md5Checksum,
              syncVersion: Date.now(),
              appDataBackedUp: space === 'appDataFolder',
              updatedAtMs: Date.now(),
              updatedByEmail,
            };
            onProgress?.({
              phase: 'done',
              fileName,
              bytesTransferred: bytes.byteLength,
              totalBytes: bytes.byteLength,
              percent: 100,
              completedFiles: 1,
              totalFiles: 1,
              verifiedCount: 1,
              failedCount: 0,
            });
            return {
              fileId: existing.id,
              name: existing.name || fileName,
              webViewLink,
              thumbnailLink: existing.thumbnailLink,
              sizeBytes: bytes.byteLength,
              sha256,
              md5Checksum,
              verified: true,
              skippedIdentical: true,
              resumedSession: false,
              manifest,
            };
          }
        }
      }
    } catch {
      // segue para upload se busca prévia falhar
    }
  }

  const metadata: Record<string, unknown> = {
    name: fileName,
    mimeType,
    description: description || `Arquivo lossless verificado SHA-256: ${sha256.slice(0, 16)}...`,
    appProperties: {
      sha256,
      md5: md5Checksum,
      kind,
      ...(studentId ? { studentId } : {}),
    },
  };
  if (!targetFileId && parentId) {
    metadata.parents = [parentId];
  }

  let uploadedMeta: any = null;
  let resumedSession = false;
  const chunkSize = getConfiguredChunkBytes();

  if (bytes.byteLength <= DRIVE_RESUMABLE_CHUNK_ALIGN) {
    // Upload Multipart rápido para arquivos <= 256 KiB (sem perda)
    const boundary = `emeb_lossless_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const metaPart = new TextEncoder().encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
        metadata
      )}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
    );
    const closingPart = new TextEncoder().encode(`\r\n--${boundary}--`);
    const bodyBytes = new Uint8Array(metaPart.byteLength + bytes.byteLength + closingPart.byteLength);
    bodyBytes.set(metaPart, 0);
    bodyBytes.set(bytes, metaPart.byteLength);
    bodyBytes.set(closingPart, metaPart.byteLength + bytes.byteLength);

    const endpoint = targetFileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(
          targetFileId
        )}?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,thumbnailLink,size,md5Checksum,appProperties`
      : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,thumbnailLink,size,md5Checksum,appProperties`;

    for (let attempt = 1; attempt <= 3; attempt++) {
      if (waitIfPaused) await waitIfPaused();
      onProgress?.({
        phase: 'uploading',
        fileName,
        bytesTransferred: 0,
        totalBytes: bytes.byteLength,
        percent: 10,
        completedFiles: 0,
        totalFiles: 1,
        verifiedCount: 0,
        failedCount: 0,
      });

      const res = await fetch(endpoint, {
        method: targetFileId ? 'PATCH' : 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: bodyBytes.buffer.slice(bodyBytes.byteOffset, bodyBytes.byteOffset + bodyBytes.byteLength),
        signal,
      });

      if (res.ok) {
        uploadedMeta = await res.json();
        break;
      }

      if ((res.status === 429 || res.status >= 500) && attempt < 3) {
        await sleepBackoff(attempt, signal);
        continue;
      }
      const errData = await res.json().catch(() => ({}));
      throw new Error(
        errData?.error?.message || `Erro no upload multipart para o Drive (HTTP ${res.status}).`
      );
    }
  } else {
    // Resumable Upload com chunks múltiplos de 256 KiB e retomada HTTP 308
    const sessionKey = `${parentId || 'root'}:${fileName}:${sha256}`;
    let uploadUri = getStoredResumableUri(sessionKey, bytes.byteLength);
    let offset = 0;

    if (uploadUri) {
      // Consulta quantos bytes já chegaram ao Google Drive
      try {
        const probeRes = await fetch(uploadUri, {
          method: 'PUT',
          headers: {
            'Content-Range': `bytes */${bytes.byteLength}`,
          },
          signal,
        });
        if (probeRes.status === 308) {
          const rangeHeader = probeRes.headers.get('Range');
          if (rangeHeader) {
            const match = rangeHeader.match(/bytes=0-(\d+)/i);
            if (match?.[1]) {
              offset = Number(match[1]) + 1;
              resumedSession = offset > 0;
            }
          }
        } else if (probeRes.status === 200 || probeRes.status === 201) {
          uploadedMeta = await probeRes.json();
          resumedSession = true;
        } else {
          uploadUri = null;
          removeStoredResumableUri(sessionKey);
        }
      } catch {
        uploadUri = null;
      }
    }

    if (!uploadUri && !uploadedMeta) {
      const initEndpoint = targetFileId
        ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(
            targetFileId
          )}?uploadType=resumable&supportsAllDrives=true&fields=id,name,webViewLink,thumbnailLink,size,md5Checksum,appProperties`
        : `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,webViewLink,thumbnailLink,size,md5Checksum,appProperties`;

      const initRes = await fetch(initEndpoint, {
        method: targetFileId ? 'PATCH' : 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': mimeType,
          'X-Upload-Content-Length': String(bytes.byteLength),
        },
        body: JSON.stringify(metadata),
        signal,
      });

      if (!initRes.ok) {
        const errData = await initRes.json().catch(() => ({}));
        throw new Error(
          errData?.error?.message ||
            `Falha ao iniciar sessão resumable no Drive (HTTP ${initRes.status}).`
        );
      }

      uploadUri = initRes.headers.get('Location');
      if (!uploadUri) {
        throw new Error('Google Drive não retornou URI de sessão resumable (Location).');
      }
      saveStoredResumableUri(sessionKey, uploadUri, bytes.byteLength);
    }

    while (!uploadedMeta && offset < bytes.byteLength) {
      if (waitIfPaused) await waitIfPaused();
      if (signal?.aborted) {
        throw new DOMException('Upload cancelado pelo usuário.', 'AbortError');
      }

      const endExclusive = Math.min(bytes.byteLength, offset + chunkSize);
      const chunkSlice = bytes.subarray(offset, endExclusive);
      const chunkBuffer = chunkSlice.buffer.slice(
        chunkSlice.byteOffset,
        chunkSlice.byteOffset + chunkSlice.byteLength
      ) as ArrayBuffer;

      let chunkDone = false;
      for (let attempt = 1; attempt <= 4; attempt++) {
        try {
          const putRes = await fetch(uploadUri!, {
            method: 'PUT',
            headers: {
              'Content-Type': mimeType,
              'Content-Range': `bytes ${offset}-${endExclusive - 1}/${bytes.byteLength}`,
            },
            body: chunkBuffer,
            signal,
          });

          if (putRes.status === 200 || putRes.status === 201) {
            uploadedMeta = await putRes.json();
            offset = endExclusive;
            chunkDone = true;
            break;
          }

          if (putRes.status === 308) {
            const rangeHeader = putRes.headers.get('Range');
            const match = rangeHeader?.match(/bytes=0-(\d+)/i);
            offset = match?.[1] ? Number(match[1]) + 1 : endExclusive;
            chunkDone = true;
            break;
          }

          if ((putRes.status === 429 || putRes.status >= 500) && attempt < 4) {
            await sleepBackoff(attempt, signal);
            continue;
          }

          if (putRes.status === 404 || putRes.status === 410) {
            removeStoredResumableUri(sessionKey);
          }
          const errData = await putRes.json().catch(() => ({}));
          throw new Error(
            errData?.error?.message || `Falha no chunk resumable (${putRes.status}).`
          );
        } catch (err: any) {
          if (err?.name === 'AbortError') throw err;
          if (attempt >= 4) throw err;
          await sleepBackoff(attempt, signal);
        }
      }

      if (chunkDone) {
        onProgress?.({
          phase: 'uploading',
          fileName,
          bytesTransferred: offset,
          totalBytes: bytes.byteLength,
          percent: Math.min(99, Math.round((offset / bytes.byteLength) * 100)),
          completedFiles: 0,
          totalFiles: 1,
          verifiedCount: 0,
          failedCount: 0,
          resumedSession,
        });
      }
    }

    removeStoredResumableUri(sessionKey);
  }

  onProgress?.({
    phase: 'verifying',
    fileName,
    bytesTransferred: bytes.byteLength,
    totalBytes: bytes.byteLength,
    percent: 99,
    completedFiles: 0,
    totalFiles: 1,
    verifiedCount: 0,
    failedCount: 0,
    resumedSession,
  });

  if (!uploadedMeta?.id) {
    throw new Error('Google Drive não retornou ID do arquivo após o upload.');
  }

  // Verificação pós-transferência estrita: MD5 + Tamanho/SHA-256
  const remoteMd5 = String(uploadedMeta.md5Checksum || '').toLowerCase();
  const remoteSize = uploadedMeta.size !== undefined ? Number(uploadedMeta.size) : bytes.byteLength;
  const remoteSha = String(uploadedMeta.appProperties?.sha256 || '').toLowerCase();

  if (remoteMd5 && remoteMd5 !== md5Checksum) {
    throw new Error(
      `Falha de integridade MD5 pós-upload para "${fileName}" (local=${md5Checksum}, drive=${remoteMd5}).`
    );
  }
  if (remoteSize !== bytes.byteLength) {
    throw new Error(
      `Falha de integridade de tamanho pós-upload para "${fileName}" (local=${bytes.byteLength}, drive=${remoteSize}).`
    );
  }
  if (remoteSha && remoteSha !== sha256) {
    throw new Error(`Falha de integridade SHA-256 pós-upload para "${fileName}".`);
  }

  const webViewLink: string =
    uploadedMeta.webViewLink || `https://drive.google.com/file/d/${uploadedMeta.id}/view`;

  const manifest: DriveSyncFileManifest = {
    id: `${kind}_${studentId || uploadedMeta.id}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128),
    studentId,
    classId,
    kind,
    fileName: uploadedMeta.name || fileName,
    driveFileId: uploadedMeta.id,
    driveWebViewLink: webViewLink,
    driveFolderId: folderId,
    mimeType,
    byteSize: bytes.byteLength,
    sha256,
    md5Checksum,
    syncVersion: Date.now(),
    appDataBackedUp: space === 'appDataFolder',
    updatedAtMs: Date.now(),
    updatedByEmail,
  };

  onProgress?.({
    phase: 'done',
    fileName: manifest.fileName,
    bytesTransferred: bytes.byteLength,
    totalBytes: bytes.byteLength,
    percent: 100,
    completedFiles: 1,
    totalFiles: 1,
    verifiedCount: 1,
    failedCount: 0,
    resumedSession,
  });

  return {
    fileId: uploadedMeta.id,
    name: uploadedMeta.name || fileName,
    webViewLink,
    thumbnailLink: uploadedMeta.thumbnailLink,
    sizeBytes: bytes.byteLength,
    sha256,
    md5Checksum,
    verified: true,
    skippedIdentical: false,
    resumedSession,
    manifest,
  };
};

export interface LosslessDriveDownloadResult {
  bytes: Uint8Array;
  blob: Blob;
  mimeType: string;
  fileName: string;
  sha256: string;
  md5Checksum: string;
  verified: boolean;
  resumedSession: boolean;
}

/**
 * Download streaming com retomada HTTP `Range` e verificação MD5 + SHA-256 pós-transferência.
 */
export const downloadFileLosslessFromDrive = async (params: {
  accessToken: string;
  driveFileId: string;
  expectedSha256?: string;
  expectedMd5?: string;
  signal?: AbortSignal;
  onProgress?: (progress: DriveTransferProgress) => void;
}): Promise<LosslessDriveDownloadResult> => {
  const { accessToken, driveFileId, expectedSha256, expectedMd5, signal, onProgress } = params;

  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      driveFileId
    )}?fields=id,name,mimeType,size,md5Checksum,appProperties&supportsAllDrives=true`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal,
    }
  );
  if (!metaRes.ok) {
    throw new Error(`Falha ao consultar metadados no Google Drive (HTTP ${metaRes.status}).`);
  }
  const meta = await metaRes.json();
  const fileName: string = meta.name || `${driveFileId}.bin`;
  const mimeType: string = meta.mimeType || 'application/octet-stream';
  const totalBytes = Number(meta.size || 0);
  const remoteMd5 = String(expectedMd5 || meta.md5Checksum || '').toLowerCase();
  const remoteSha = String(expectedSha256 || meta.appProperties?.sha256 || '').toLowerCase();

  const receivedChunks: Uint8Array[] = [];
  let bytesReceived = 0;
  let resumedSession = false;

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
      };
      if (bytesReceived > 0) {
        headers.Range = `bytes=${bytesReceived}-`;
        resumedSession = true;
      }

      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
          driveFileId
        )}?alt=media&supportsAllDrives=true`,
        { headers, signal }
      );

      if (!res.ok && res.status !== 206) {
        if ((res.status === 429 || res.status >= 500) && attempt < 4) {
          await sleepBackoff(attempt, signal);
          continue;
        }
        throw new Error(`Erro no download do Google Drive (HTTP ${res.status}).`);
      }

      if (res.body && typeof res.body.getReader === 'function') {
        const reader = res.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value && value.byteLength > 0) {
            receivedChunks.push(value);
            bytesReceived += value.byteLength;
            onProgress?.({
              phase: 'downloading',
              fileName,
              bytesTransferred: bytesReceived,
              totalBytes: totalBytes || bytesReceived,
              percent:
                totalBytes > 0 ? Math.min(99, Math.round((bytesReceived / totalBytes) * 100)) : 50,
              completedFiles: 0,
              totalFiles: 1,
              verifiedCount: 0,
              failedCount: 0,
              resumedSession,
            });
          }
        }
      } else {
        const buf = new Uint8Array(await res.arrayBuffer());
        receivedChunks.push(buf);
        bytesReceived += buf.byteLength;
      }

      if (totalBytes === 0 || bytesReceived >= totalBytes) {
        break;
      }
      await sleepBackoff(attempt, signal);
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      if (attempt >= 4) throw err;
      await sleepBackoff(attempt, signal);
    }
  }

  const combined = new Uint8Array(bytesReceived);
  let pos = 0;
  for (const c of receivedChunks) {
    combined.set(c, pos);
    pos += c.byteLength;
  }

  onProgress?.({
    phase: 'verifying',
    fileName,
    bytesTransferred: combined.byteLength,
    totalBytes: combined.byteLength,
    percent: 99,
    completedFiles: 0,
    totalFiles: 1,
    verifiedCount: 0,
    failedCount: 0,
    resumedSession,
  });

  const [localSha, localMd5] = await Promise.all([
    computeSha256Hex(combined),
    computeMd5Hex(combined),
  ]);

  if (remoteMd5 && remoteMd5 !== localMd5) {
    throw new Error(
      `Falha de integridade MD5 após download de "${fileName}" (esperado=${remoteMd5}, obtido=${localMd5}).`
    );
  }
  if (remoteSha && remoteSha !== localSha) {
    throw new Error(`Falha de integridade SHA-256 após download de "${fileName}".`);
  }

  const cleanBuf = combined.buffer.slice(
    combined.byteOffset,
    combined.byteOffset + combined.byteLength
  ) as ArrayBuffer;

  onProgress?.({
    phase: 'done',
    fileName,
    bytesTransferred: combined.byteLength,
    totalBytes: combined.byteLength,
    percent: 100,
    completedFiles: 1,
    totalFiles: 1,
    verifiedCount: 1,
    failedCount: 0,
    resumedSession,
  });

  return {
    bytes: combined,
    blob: new Blob([cleanBuf], { type: mimeType }),
    mimeType,
    fileName,
    sha256: localSha,
    md5Checksum: localMd5,
    verified: true,
    resumedSession,
  };
};

/**
 * Sincroniza manifesto de arquivos no escopo oculto `appDataFolder` (`drive.appdata`) com gzip exclusivamente para metadados JSON.
 */
export const syncManifestWithDriveAppData = async (
  accessToken: string,
  localManifests: DriveSyncFileManifest[],
  updatedByEmail = ''
): Promise<{
  mergedManifests: DriveSyncFileManifest[];
  appDataFileId: string;
}> => {
  const q = encodeURIComponent(`name = '${APPDATA_MANIFEST_FILENAME}' and trashed = false`);
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,name,md5Checksum,modifiedTime)&pageSize=1`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  let existingAppDataFileId: string | undefined;
  let remoteManifests: DriveSyncFileManifest[] = [];

  if (listRes.ok) {
    const listData = await listRes.json();
    const existing = Array.isArray(listData.files) ? listData.files[0] : null;
    if (existing?.id) {
      existingAppDataFileId = existing.id;
      try {
        const dl = await downloadFileLosslessFromDrive({
          accessToken,
          driveFileId: existing.id,
          expectedMd5: existing.md5Checksum,
        });
        const decoded = (await decompressJsonMetadataGzip(dl.bytes)) as {
          manifests?: DriveSyncFileManifest[];
        };
        if (Array.isArray(decoded?.manifests)) {
          remoteManifests = decoded.manifests;
        }
      } catch {
        // se corrompido ou vazio, sobrescreve com merge limpo
      }
    }
  }

  const mergedMap = new Map<string, DriveSyncFileManifest>();
  for (const item of [...remoteManifests, ...localManifests]) {
    if (!item?.id) continue;
    const prev = mergedMap.get(item.id);
    if (
      !prev ||
      item.updatedAtMs > prev.updatedAtMs ||
      (item.updatedAtMs === prev.updatedAtMs && item.syncVersion > prev.syncVersion)
    ) {
      mergedMap.set(item.id, { ...item, appDataBackedUp: true });
    }
  }

  const mergedManifests = Array.from(mergedMap.values()).sort(
    (a, b) => b.updatedAtMs - a.updatedAtMs
  );

  const gzipPayload = await compressJsonMetadataGzip({
    schemaVersion: 1,
    updatedAtMs: Date.now(),
    updatedByEmail,
    manifests: mergedManifests,
  });

  const uploadRes = await uploadFileLosslessToDrive({
    accessToken,
    fileName: APPDATA_MANIFEST_FILENAME,
    bytes: gzipPayload.bytes,
    mimeType: gzipPayload.contentType,
    space: 'appDataFolder',
    existingFileId: existingAppDataFileId,
    kind: 'metadata_backup',
    description: 'Manifesto gzipado de integridade SHA-256/MD5 (drive.appdata)',
    updatedByEmail,
  });

  return {
    mergedManifests,
    appDataFileId: uploadRes.fileId,
  };
};
