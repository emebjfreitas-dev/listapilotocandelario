import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  CACHE_SIZE_UNLIMITED,
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  getDocFromServer,
  getDocsFromServer,
  runTransaction,
  onSnapshot,
  query,
  where,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  Query,
  QuerySnapshot,
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  disableNetwork,
  enableNetwork,
  setLogLevel,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  ClassGroup,
  AuthorizedUser,
  AttendanceWindowConfig,
  UserAccessSessionLog,
  PendingSyncOperation,
  SyncStateStatus,
  DriveSyncFileManifest,
} from '../types';
import {
  NameGenderEntry,
  saveStoredNameGenderEntries,
} from '../utils/genderDictionary';
import { getStoredClasses } from './db';

export const CLEAN_DB_RESET_EPOCH_ID = 'clean_zero_data_2026_11_16_v1';
export const DB_CLEAN_EPOCH_STORAGE_KEY = 'emeb_candelario_db_clean_epoch_v1';
export const DB_EPOCH_META_STORAGE_KEY = 'emeb_candelario_db_epoch_meta_v1';
export const CLASSES_UPDATED_AT_STORAGE_KEY = 'emeb_candelario_classes_updated_at_ms_2027';
export const CONFIG_UPDATED_AT_STORAGE_KEY = 'emeb_candelario_config_updated_at_ms_2027';

const getLocalConfigUpdatedAtMs = (): number => {
  try {
    if (typeof localStorage === 'undefined') return 0;
    const raw = localStorage.getItem(CONFIG_UPDATED_AT_STORAGE_KEY);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
};

const setLocalConfigUpdatedAtMs = (tsMs: number): void => {
  try {
    if (typeof localStorage === 'undefined' || !Number.isFinite(tsMs) || tsMs <= 0) return;
    const current = getLocalConfigUpdatedAtMs();
    if (tsMs > current) {
      localStorage.setItem(CONFIG_UPDATED_AT_STORAGE_KEY, String(tsMs));
    }
  } catch {
    // ignore storage quota errors
  }
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const firebaseApp = app;

const rawFirebaseConfig = firebaseConfig as Record<string, string | undefined>;
let firestoreDbInstance: Firestore;
try {
  let localCache;
  try {
    localCache = persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
      cacheSizeBytes: CACHE_SIZE_UNLIMITED,
    });
  } catch {
    localCache = memoryLocalCache();
  }
  const settings = {
    localCache,
    ignoreUndefinedProperties: true,
    experimentalAutoDetectLongPolling: true,
  };
  firestoreDbInstance = rawFirebaseConfig.firestoreDatabaseId
    ? initializeFirestore(app, settings, rawFirebaseConfig.firestoreDatabaseId)
    : initializeFirestore(app, settings);
} catch {
  firestoreDbInstance = rawFirebaseConfig.firestoreDatabaseId
    ? getFirestore(app, rawFirebaseConfig.firestoreDatabaseId)
    : getFirestore(app);
}
export const firestoreDb = firestoreDbInstance;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

try {
  setLogLevel('silent');
} catch {
  // ignore
}

const FIRESTORE_QUOTA_STORAGE_KEY = 'emeb_candelario_firestore_quota_paused_until_v1';
let memoryQuotaPausedUntilMs = 0;
let isFirestoreNetworkDisabled = false;

export const isFirestoreQuotaExceededError = (error: unknown): boolean => {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  const code = (error as any)?.code;
  return (
    code === 'resource-exhausted' ||
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota exceeded')
  );
};

export const isFirestoreInternalAssertionError = (error: unknown): boolean => {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('INTERNAL ASSERTION FAILED') ||
    msg.includes('Unexpected state') ||
    msg.includes('Target ID already exists')
  );
};

export const isFirestoreQuotaExceeded = (): boolean => {
  const now = Date.now();
  if (memoryQuotaPausedUntilMs > now) return true;
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(FIRESTORE_QUOTA_STORAGE_KEY);
      if (stored) {
        const until = parseInt(stored, 10);
        if (until > now) {
          memoryQuotaPausedUntilMs = until;
          return true;
        } else {
          localStorage.removeItem(FIRESTORE_QUOTA_STORAGE_KEY);
        }
      }
    }
  } catch {
    // ignore storage access errors
  }
  return false;
};

export const markFirestoreQuotaExceeded = (_error?: unknown): void => {
  // Cooldown until next UTC midnight or minimum 6 hours
  const now = new Date();
  const nextMidnightUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 5, 0)
  );
  const until = Math.max(Date.now() + 6 * 60 * 60 * 1000, nextMidnightUtc.getTime());
  memoryQuotaPausedUntilMs = until;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(FIRESTORE_QUOTA_STORAGE_KEY, String(until));
    }
  } catch {
    // ignore
  }
  if (!isFirestoreNetworkDisabled) {
    isFirestoreNetworkDisabled = true;
    try {
      void disableNetwork(firestoreDbInstance).catch(() => {});
    } catch {
      // ignore
    }
  }
  notifySyncListeners();
};

export const resetFirestoreQuotaExceeded = async (): Promise<void> => {
  const wasPaused = memoryQuotaPausedUntilMs > 0 || isFirestoreNetworkDisabled;
  memoryQuotaPausedUntilMs = 0;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(FIRESTORE_QUOTA_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
  if (isFirestoreNetworkDisabled) {
    isFirestoreNetworkDisabled = false;
    try {
      await enableNetwork(firestoreDbInstance);
    } catch {
      // ignore
    }
  }
  if (wasPaused) {
    notifySyncListeners();
  }
};

// Intercept SDK internal quota/assertion error logs so they degrade cleanly without crashing UI
if (typeof window !== 'undefined') {
  const originalConsoleError = console.error;
  console.error = function (...args: any[]) {
    const text = args
      .map((a) => (typeof a === 'string' ? a : a instanceof Error ? a.message : (a?.message || '')))
      .join(' ');
    if (
      text.includes('resource-exhausted') ||
      text.includes('Quota limit exceeded') ||
      text.includes('Quota exceeded')
    ) {
      markFirestoreQuotaExceeded(text);
      console.warn(
        'Aviso do Firestore: Cota diária gratuita atingida. Operando em cache local e planilha.',
        text
      );
      return;
    }
    if (
      text.includes('INTERNAL ASSERTION FAILED') ||
      text.includes('Target ID already exists')
    ) {
      console.warn('Aviso interno do SDK Firestore (recuperado automaticamente):', text);
      return;
    }
    originalConsoleError.apply(console, args);
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  let currentUser = null;
  try {
    currentUser = getAuth(app).currentUser;
  } catch {
    currentUser = null;
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid ?? null,
      email: currentUser?.email ?? null,
      emailVerified: currentUser?.emailVerified ?? null,
      isAnonymous: currentUser?.isAnonymous ?? null,
      tenantId: currentUser?.tenantId ?? null,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  if (isFirestoreQuotaExceededError(error)) {
    markFirestoreQuotaExceeded(error);
    console.warn(
      'Firestore Quota Exceeded (pausando gravações remotas; operando com segurança em cache local e planilha):',
      errInfo.error
    );
  } else if (isFirestoreInternalAssertionError(error)) {
    console.warn('Firestore SDK estado transitório recuperado:', errInfo.error);
  } else {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }
  return errInfo;
}

export interface LocalEpochMetadata {
  epochId: string;
  epochVersion: number;
  epochUpdatedAtMs: number;
  classesUpdatedAtMs: number;
}

export type FirestoreEpochResolution =
  | 'checking'
  | 'aligned'
  | 'local_newer_preserved'
  | 'remote_newer_accepted'
  | 'remote_epoch_initialized'
  | 'offline_local_preserved';

export interface FirestoreIntegrityReport {
  status: FirestoreEpochResolution;
  connected: boolean;
  checkedAtISO: string | null;
  localEpochId: string;
  remoteEpochId: string | null;
  localEpochVersion: number;
  remoteEpochVersion: number;
  localEpochUpdatedAtMs: number;
  remoteEpochUpdatedAtMs: number;
  localClassesUpdatedAtMs: number;
  remoteClassesUpdatedAtMs: number;
  pendingLocalOperations: number;
  preventedRemoteOverwrite: boolean;
  protectedLocalWatermarkMs: number;
  reason: string;
}

/**
 * Extracts a deterministic comparable revision number from epoch IDs such as
 * `clean_zero_data_2026_11_16_v1` -> 2026111601.
 */
export const parseEpochRevisionNumber = (epochId?: string | null): number => {
  if (!epochId || typeof epochId !== 'string') return 0;
  const match = epochId.match(/(\d{4})_(\d{2})_(\d{2})_v(\d+)/i);
  if (match) {
    const ymd = Number(`${match[1]}${match[2]}${match[3]}`);
    const rev = Number(match[4]);
    if (Number.isFinite(ymd) && Number.isFinite(rev)) {
      return ymd * 100 + Math.min(99, Math.max(0, rev));
    }
  }
  const trailingVersion = epochId.match(/v(\d+)$/i);
  return trailingVersion ? Number(trailingVersion[1]) || 0 : 0;
};

const readStoredClassesUpdatedAtMsDirect = (): number => {
  try {
    if (typeof localStorage === 'undefined') return 0;
    return parseInt(localStorage.getItem(CLASSES_UPDATED_AT_STORAGE_KEY) || '0', 10) || 0;
  } catch {
    return 0;
  }
};

export const getLocalEpochMetadata = (fallbackClassesUpdatedAtMs?: number): LocalEpochMetadata => {
  const defaultVersion = parseEpochRevisionNumber(CLEAN_DB_RESET_EPOCH_ID);
  const directClassesTs = Math.max(
    fallbackClassesUpdatedAtMs || 0,
    readStoredClassesUpdatedAtMsDirect()
  );
  try {
    if (typeof localStorage !== 'undefined') {
      const storedEpochId =
        localStorage.getItem(DB_CLEAN_EPOCH_STORAGE_KEY) || CLEAN_DB_RESET_EPOCH_ID;
      const rawMeta = localStorage.getItem(DB_EPOCH_META_STORAGE_KEY);
      if (rawMeta) {
        const parsed = JSON.parse(rawMeta) as Partial<LocalEpochMetadata>;
        const epochId =
          typeof parsed.epochId === 'string' && parsed.epochId.trim()
            ? parsed.epochId
            : storedEpochId;
        const parsedRevision = parseEpochRevisionNumber(epochId);
        return {
          epochId,
          epochVersion: Math.max(
            typeof parsed.epochVersion === 'number' ? parsed.epochVersion : 0,
            parsedRevision,
            defaultVersion
          ),
          epochUpdatedAtMs:
            typeof parsed.epochUpdatedAtMs === 'number' ? parsed.epochUpdatedAtMs : directClassesTs,
          classesUpdatedAtMs: Math.max(
            typeof parsed.classesUpdatedAtMs === 'number' ? parsed.classesUpdatedAtMs : 0,
            directClassesTs
          ),
        };
      }
      return {
        epochId: storedEpochId,
        epochVersion: Math.max(parseEpochRevisionNumber(storedEpochId), defaultVersion),
        epochUpdatedAtMs: directClassesTs,
        classesUpdatedAtMs: directClassesTs,
      };
    }
  } catch {
    // fallback below
  }
  return {
    epochId: CLEAN_DB_RESET_EPOCH_ID,
    epochVersion: defaultVersion,
    epochUpdatedAtMs: directClassesTs,
    classesUpdatedAtMs: directClassesTs,
  };
};

export const updateLocalEpochMetadata = (
  patch: Partial<LocalEpochMetadata>
): LocalEpochMetadata => {
  const current = getLocalEpochMetadata();
  const nextEpochId = patch.epochId || current.epochId || CLEAN_DB_RESET_EPOCH_ID;
  const next: LocalEpochMetadata = {
    epochId: nextEpochId,
    epochVersion: Math.max(
      patch.epochVersion ?? current.epochVersion,
      parseEpochRevisionNumber(nextEpochId)
    ),
    epochUpdatedAtMs: Math.max(
      patch.epochUpdatedAtMs ?? 0,
      patch.epochUpdatedAtMs === 0 ? 0 : current.epochUpdatedAtMs
    ),
    classesUpdatedAtMs: Math.max(
      patch.classesUpdatedAtMs ?? 0,
      patch.classesUpdatedAtMs === 0 ? 0 : current.classesUpdatedAtMs,
      readStoredClassesUpdatedAtMsDirect()
    ),
  };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DB_CLEAN_EPOCH_STORAGE_KEY, next.epochId);
      localStorage.setItem(DB_EPOCH_META_STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // ignore storage quota errors
  }
  return next;
};

export const touchLocalEpochState = (
  classesUpdatedAtMs: number = Date.now(),
  epochId: string = CLEAN_DB_RESET_EPOCH_ID
): LocalEpochMetadata => {
  return updateLocalEpochMetadata({
    epochId,
    epochVersion: parseEpochRevisionNumber(epochId),
    epochUpdatedAtMs: classesUpdatedAtMs,
    classesUpdatedAtMs,
  });
};

type IntegrityListener = (report: FirestoreIntegrityReport) => void;
const integrityListeners = new Set<IntegrityListener>();

const initialLocalMeta = getLocalEpochMetadata();
let currentIntegrityReport: FirestoreIntegrityReport = {
  status: 'aligned',
  connected: true,
  checkedAtISO: null,
  localEpochId: initialLocalMeta.epochId,
  remoteEpochId: null,
  localEpochVersion: initialLocalMeta.epochVersion,
  remoteEpochVersion: 0,
  localEpochUpdatedAtMs: initialLocalMeta.epochUpdatedAtMs,
  remoteEpochUpdatedAtMs: 0,
  localClassesUpdatedAtMs: initialLocalMeta.classesUpdatedAtMs,
  remoteClassesUpdatedAtMs: 0,
  pendingLocalOperations: 0,
  preventedRemoteOverwrite: false,
  protectedLocalWatermarkMs: initialLocalMeta.classesUpdatedAtMs,
  reason: 'Aguardando verificação de integridade no boot.',
};

const notifyIntegrityListeners = (): void => {
  const snapshot = { ...currentIntegrityReport };
  integrityListeners.forEach((cb) => {
    try {
      cb(snapshot);
    } catch {
      // ignore listener errors
    }
  });
};

const setIntegrityReport = (next: FirestoreIntegrityReport): FirestoreIntegrityReport => {
  currentIntegrityReport = next;
  notifyIntegrityListeners();
  return { ...currentIntegrityReport };
};

export const getFirestoreIntegrityReport = (): FirestoreIntegrityReport => ({
  ...currentIntegrityReport,
});

export const subscribeToFirestoreIntegrity = (listener: IntegrityListener): (() => void) => {
  integrityListeners.add(listener);
  listener(getFirestoreIntegrityReport());
  return () => {
    integrityListeners.delete(listener);
  };
};

/**
 * Synchronously activates boot verification barrier before realtime listeners / polling start,
 * preventing cached snapshots from overwriting newer local edits during app reload.
 */
export const beginBootIntegrityCheck = (localClassesUpdatedAtMs?: number): void => {
  const localMeta = getLocalEpochMetadata(localClassesUpdatedAtMs);
  const queue = loadOfflineSyncQueue();
  const watermark = Math.max(localMeta.classesUpdatedAtMs, localMeta.epochUpdatedAtMs);
  setIntegrityReport({
    ...currentIntegrityReport,
    status: 'checking',
    localEpochId: localMeta.epochId,
    localEpochVersion: localMeta.epochVersion,
    localEpochUpdatedAtMs: localMeta.epochUpdatedAtMs,
    localClassesUpdatedAtMs: localMeta.classesUpdatedAtMs,
    pendingLocalOperations: queue.length,
    preventedRemoteOverwrite: true,
    protectedLocalWatermarkMs: watermark,
    reason: 'Verificando integridade de conexão e precedência do epoch local antes da sincronização.',
  });
};

/**
 * Evaluates whether an incoming remote snapshot/pull is allowed to overwrite or merge into
 * local class state, protecting newer local epochs and offline modifications during boot.
 */
export const shouldAllowRemoteClassesOverwrite = (params: {
  remoteUpdatedAtMs?: number;
  remoteEpochId?: string | null;
  remoteEpochVersion?: number;
  fromCache?: boolean;
}): boolean => {
  const report = currentIntegrityReport;
  const remoteEpochRank = Math.max(
    params.remoteEpochVersion || 0,
    parseEpochRevisionNumber(params.remoteEpochId)
  );
  const localMeta = getLocalEpochMetadata();
  const localEpochRank = Math.max(
    localMeta.epochVersion,
    parseEpochRevisionNumber(localMeta.epochId)
  );

  // If the remote source carries a strictly older epoch revision than local, never overwrite local
  if (params.remoteEpochId && remoteEpochRank > 0 && remoteEpochRank < localEpochRank) {
    return false;
  }

  // Always allow a genuinely newer remote epoch ID/version from server
  if (!params.fromCache && remoteEpochRank > localEpochRank) {
    return true;
  }

  if (report.status === 'checking') {
    return false;
  }

  if (report.status === 'offline_local_preserved') {
    return !params.fromCache && (params.remoteUpdatedAtMs || 0) > report.protectedLocalWatermarkMs;
  }

  if (report.status === 'local_newer_preserved' && report.preventedRemoteOverwrite) {
    if (params.fromCache) return false;
    const incomingTs = params.remoteUpdatedAtMs || 0;
    // Allow only when Firestore advances strictly past our protected local watermark
    if (incomingTs > report.protectedLocalWatermarkMs) {
      return true;
    }
    return false;
  }

  return true;
};

/**
 * Marks cloud state as reconciled once local newer data is successfully pushed to Firestore.
 */
export const markCloudAlignedWithLocalEpoch = (syncedAtMs: number): void => {
  const localMeta = touchLocalEpochState(syncedAtMs, CLEAN_DB_RESET_EPOCH_ID);
  if (
    currentIntegrityReport.status === 'local_newer_preserved' ||
    currentIntegrityReport.status === 'offline_local_preserved' ||
    currentIntegrityReport.preventedRemoteOverwrite
  ) {
    setIntegrityReport({
      ...currentIntegrityReport,
      status: 'aligned',
      connected: true,
      checkedAtISO: new Date().toISOString(),
      localEpochId: localMeta.epochId,
      remoteEpochId: localMeta.epochId,
      localEpochVersion: localMeta.epochVersion,
      remoteEpochVersion: localMeta.epochVersion,
      localEpochUpdatedAtMs: syncedAtMs,
      remoteEpochUpdatedAtMs: syncedAtMs,
      localClassesUpdatedAtMs: syncedAtMs,
      remoteClassesUpdatedAtMs: syncedAtMs,
      pendingLocalOperations: loadOfflineSyncQueue().length,
      preventedRemoteOverwrite: false,
      protectedLocalWatermarkMs: syncedAtMs,
      reason: 'Base local mais recente reconciliada e confirmada no Cloud Firestore.',
    });
  }
};

let inFlightIntegrityMonitorPromise: Promise<FirestoreIntegrityReport> | null = null;

/**
 * Boot-time Firestore connection & epoch integrity monitor.
 * Uses `getDocFromServer` to inspect live server state before allowing any boot overwrite,
 * comparing local vs remote epoch revisions, timestamps, and pending offline queue items.
 */
export async function monitorFirestoreIntegrityOnBoot(options?: {
  baseClasses?: ClassGroup[];
  localClassesUpdatedAtMs?: number;
  hasLocalStudents?: boolean;
}): Promise<FirestoreIntegrityReport> {
  if (inFlightIntegrityMonitorPromise) {
    return inFlightIntegrityMonitorPromise;
  }

  const run = async (): Promise<FirestoreIntegrityReport> => {
    const testPath = 'school_meta_2027/state';
    const localMeta = getLocalEpochMetadata(options?.localClassesUpdatedAtMs);
    const pendingQueue = loadOfflineSyncQueue();
    const localWatermark = Math.max(
      localMeta.classesUpdatedAtMs,
      localMeta.epochUpdatedAtMs,
      options?.localClassesUpdatedAtMs || 0
    );

    beginBootIntegrityCheck(localWatermark);

    if (isFirestoreQuotaExceeded()) {
      return setIntegrityReport({
        status: 'offline_local_preserved',
        connected: false,
        checkedAtISO: new Date().toISOString(),
        localEpochId: localMeta.epochId,
        remoteEpochId: null,
        localEpochVersion: localMeta.epochVersion,
        remoteEpochVersion: 0,
        localEpochUpdatedAtMs: localMeta.epochUpdatedAtMs,
        remoteEpochUpdatedAtMs: 0,
        localClassesUpdatedAtMs: localMeta.classesUpdatedAtMs,
        remoteClassesUpdatedAtMs: 0,
        pendingLocalOperations: pendingQueue.length,
        preventedRemoteOverwrite: true,
        protectedLocalWatermarkMs: localWatermark,
        reason: 'Cota diária do Firestore atingida — operando localmente e via planilha.',
      });
    }

    try {
      const stateSnap = await getDoc(doc(firestoreDb, 'school_meta_2027', 'state'));
      const remoteExists = stateSnap.exists();
      const remoteData = remoteExists ? stateSnap.data() || {} : {};

      const remoteEpochId =
        typeof remoteData.cleanResetEpochId === 'string' && remoteData.cleanResetEpochId.trim()
          ? remoteData.cleanResetEpochId
          : null;
      const remoteEpochRank = parseEpochRevisionNumber(remoteEpochId);
      const localEpochRank = parseEpochRevisionNumber(localMeta.epochId);
      const remoteEpochVersion = Math.max(
        typeof remoteData.epochVersion === 'number' ? remoteData.epochVersion : 0,
        remoteEpochRank
      );
      const localEpochVersion = Math.max(localMeta.epochVersion, localEpochRank);

      const remoteClassesUpdatedAtMs =
        typeof remoteData.classesUpdatedAtMs === 'number'
          ? remoteData.classesUpdatedAtMs
          : typeof remoteData.updatedAtMs === 'number'
          ? remoteData.updatedAtMs
          : 0;
      const remoteEpochUpdatedAtMs =
        typeof remoteData.epochUpdatedAtMs === 'number'
          ? remoteData.epochUpdatedAtMs
          : remoteClassesUpdatedAtMs;

      const checkedAtISO = new Date().toISOString();

      // Case 1: Remote has a strictly newer epoch version than local -> accept remote without overwriting Firestore
      if (
        remoteEpochId &&
        (remoteEpochRank > localEpochRank || remoteEpochVersion > localEpochVersion)
      ) {
        updateLocalEpochMetadata({
          epochId: remoteEpochId,
          epochVersion: remoteEpochVersion,
          epochUpdatedAtMs: remoteEpochUpdatedAtMs,
          classesUpdatedAtMs: remoteClassesUpdatedAtMs,
        });
        return setIntegrityReport({
          status: 'remote_newer_accepted',
          connected: true,
          checkedAtISO,
          localEpochId: remoteEpochId,
          remoteEpochId,
          localEpochVersion: remoteEpochVersion,
          remoteEpochVersion,
          localEpochUpdatedAtMs: localMeta.epochUpdatedAtMs,
          remoteEpochUpdatedAtMs,
          localClassesUpdatedAtMs: localMeta.classesUpdatedAtMs,
          remoteClassesUpdatedAtMs,
          pendingLocalOperations: pendingQueue.length,
          preventedRemoteOverwrite: false,
          protectedLocalWatermarkMs: remoteClassesUpdatedAtMs,
          reason: `Epoch remoto (${remoteEpochId}) é mais recente que o local (${localMeta.epochId}). Hidratação remota autorizada.`,
        });
      }

      // Case 2: Remote has missing or older epoch -> check whether local has newer active data before initializing
      if (!remoteExists || !remoteEpochId || remoteEpochRank < localEpochRank) {
        const localHasNewerData =
          pendingQueue.length > 0 ||
          (Boolean(options?.hasLocalStudents) && localWatermark > remoteClassesUpdatedAtMs);

        if (localHasNewerData) {
          return setIntegrityReport({
            status: 'local_newer_preserved',
            connected: true,
            checkedAtISO,
            localEpochId: localMeta.epochId,
            remoteEpochId,
            localEpochVersion,
            remoteEpochVersion,
            localEpochUpdatedAtMs: localMeta.epochUpdatedAtMs,
            remoteEpochUpdatedAtMs,
            localClassesUpdatedAtMs: localMeta.classesUpdatedAtMs,
            remoteClassesUpdatedAtMs,
            pendingLocalOperations: pendingQueue.length,
            preventedRemoteOverwrite: true,
            protectedLocalWatermarkMs: localWatermark,
            reason:
              'Epoch/dados locais são mais recentes que o servidor remoto. Base local protegida contra sobrescrita no boot.',
          });
        }

        let remoteHasStudents = false;
        try {
          const remoteClassesSnap = await getDocs(
            query(collection(firestoreDb, 'school_classes_2027'), limit(5))
          );
          remoteClassesSnap.forEach((d) => {
            const data = d.data() as ClassGroup;
            if (data && Array.isArray(data.students) && data.students.length > 0) {
              remoteHasStudents = true;
            }
          });
        } catch {
          // ignore query error
        }

        if (remoteHasStudents) {
          return setIntegrityReport({
            status: 'remote_newer_accepted',
            connected: true,
            checkedAtISO,
            localEpochId: localMeta.epochId,
            remoteEpochId: remoteEpochId || CLEAN_DB_RESET_EPOCH_ID,
            localEpochVersion,
            remoteEpochVersion,
            localEpochUpdatedAtMs: localMeta.epochUpdatedAtMs,
            remoteEpochUpdatedAtMs,
            localClassesUpdatedAtMs: localMeta.classesUpdatedAtMs,
            remoteClassesUpdatedAtMs,
            pendingLocalOperations: pendingQueue.length,
            preventedRemoteOverwrite: false,
            protectedLocalWatermarkMs: remoteClassesUpdatedAtMs,
            reason: 'Estudantes salvos detectados no Firestore remoto. Limpeza automática abortada, estado remoto aceito com segurança.',
          });
        }

        if (options?.baseClasses && options.baseClasses.length > 0) {
          await wipeFirestoreSchoolDataOnly(options.baseClasses, CLEAN_DB_RESET_EPOCH_ID);
        }

        const syncedAtMs = Date.now();
        return setIntegrityReport({
          status: 'remote_epoch_initialized',
          connected: true,
          checkedAtISO,
          localEpochId: CLEAN_DB_RESET_EPOCH_ID,
          remoteEpochId: CLEAN_DB_RESET_EPOCH_ID,
          localEpochVersion: parseEpochRevisionNumber(CLEAN_DB_RESET_EPOCH_ID),
          remoteEpochVersion: parseEpochRevisionNumber(CLEAN_DB_RESET_EPOCH_ID),
          localEpochUpdatedAtMs: syncedAtMs,
          remoteEpochUpdatedAtMs: syncedAtMs,
          localClassesUpdatedAtMs: localMeta.classesUpdatedAtMs,
          remoteClassesUpdatedAtMs: syncedAtMs,
          pendingLocalOperations: pendingQueue.length,
          preventedRemoteOverwrite: false,
          protectedLocalWatermarkMs: syncedAtMs,
          reason: 'Epoch remoto inicializado com segurança para a versão atual do banco.',
        });
      }

      // Case 3: Same epoch ID -> compare local timestamps & offline queue vs remote timestamps
      const hasPendingClassWrite = pendingQueue.some((op) => op.type === 'save_classes');
      const localTimestampNewer =
        localMeta.classesUpdatedAtMs > remoteClassesUpdatedAtMs ||
        (localMeta.epochUpdatedAtMs > remoteEpochUpdatedAtMs &&
          Boolean(options?.hasLocalStudents));

      if (hasPendingClassWrite || pendingQueue.length > 0 || localTimestampNewer) {
        return setIntegrityReport({
          status: 'local_newer_preserved',
          connected: true,
          checkedAtISO,
          localEpochId: localMeta.epochId,
          remoteEpochId,
          localEpochVersion,
          remoteEpochVersion,
          localEpochUpdatedAtMs: localMeta.epochUpdatedAtMs,
          remoteEpochUpdatedAtMs,
          localClassesUpdatedAtMs: localMeta.classesUpdatedAtMs,
          remoteClassesUpdatedAtMs,
          pendingLocalOperations: pendingQueue.length,
          preventedRemoteOverwrite: true,
          protectedLocalWatermarkMs: localWatermark,
          reason: hasPendingClassWrite || pendingQueue.length > 0
            ? `Existem ${pendingQueue.length} operação(ões) locais pendentes na fila. Sobrescrita remota bloqueada durante o boot.`
            : 'Timestamp/epoch local é mais recente do que o Firestore remoto. Estado local preservado antes do reenvio.',
        });
      }

      if (remoteClassesUpdatedAtMs > localMeta.classesUpdatedAtMs) {
        updateLocalEpochMetadata({
          epochId: remoteEpochId,
          epochVersion: remoteEpochVersion,
          epochUpdatedAtMs: remoteEpochUpdatedAtMs,
        });
        return setIntegrityReport({
          status: 'remote_newer_accepted',
          connected: true,
          checkedAtISO,
          localEpochId: localMeta.epochId,
          remoteEpochId,
          localEpochVersion,
          remoteEpochVersion,
          localEpochUpdatedAtMs: localMeta.epochUpdatedAtMs,
          remoteEpochUpdatedAtMs,
          localClassesUpdatedAtMs: localMeta.classesUpdatedAtMs,
          remoteClassesUpdatedAtMs,
          pendingLocalOperations: 0,
          preventedRemoteOverwrite: false,
          protectedLocalWatermarkMs: remoteClassesUpdatedAtMs,
          reason: 'Firestore remoto possui atualizações mais recentes. Sincronização liberada no boot.',
        });
      }

      return setIntegrityReport({
        status: 'aligned',
        connected: true,
        checkedAtISO,
        localEpochId: localMeta.epochId,
        remoteEpochId,
        localEpochVersion,
        remoteEpochVersion,
        localEpochUpdatedAtMs: localMeta.epochUpdatedAtMs,
        remoteEpochUpdatedAtMs,
        localClassesUpdatedAtMs: localMeta.classesUpdatedAtMs,
        remoteClassesUpdatedAtMs,
        pendingLocalOperations: 0,
        preventedRemoteOverwrite: false,
        protectedLocalWatermarkMs: Math.max(localWatermark, remoteClassesUpdatedAtMs),
        reason: 'Base local e Firestore remoto estão alinhados no mesmo epoch.',
      });
    } catch (error) {
      const isOfflineErr =
        error instanceof Error &&
        (error.message.includes('the client is offline') ||
          error.message.toLowerCase().includes('offline') ||
          error.message.toLowerCase().includes('unavailable'));

      if (isOfflineErr) {
        console.warn('Firestore operando em modo cache/offline temporário. Base local preservada.');
      } else {
        handleFirestoreError(error, OperationType.GET, testPath);
      }

      return setIntegrityReport({
        status: 'offline_local_preserved',
        connected: false,
        checkedAtISO: new Date().toISOString(),
        localEpochId: localMeta.epochId,
        remoteEpochId: null,
        localEpochVersion: localMeta.epochVersion,
        remoteEpochVersion: 0,
        localEpochUpdatedAtMs: localMeta.epochUpdatedAtMs,
        remoteEpochUpdatedAtMs: 0,
        localClassesUpdatedAtMs: localMeta.classesUpdatedAtMs,
        remoteClassesUpdatedAtMs: 0,
        pendingLocalOperations: pendingQueue.length,
        preventedRemoteOverwrite: true,
        protectedLocalWatermarkMs: localWatermark,
        reason: isOfflineErr
          ? 'Dispositivo sem acesso direto ao servidor Firestore no boot — base local protegida contra cache antigo.'
          : 'Falha ao consultar epoch no servidor Firestore — base local preservada preventivamente.',
      });
    }
  };

  inFlightIntegrityMonitorPromise = run().finally(() => {
    inFlightIntegrityMonitorPromise = null;
  });

  return inFlightIntegrityMonitorPromise;
}

// Validate connection to Firestore after authenticated institutional sign-in
export async function validateFirestoreConnectionOnBoot(): Promise<void> {
  await monitorFirestoreIntegrityOnBoot();
}

const OFFLINE_QUEUE_STORAGE_KEY = 'emeb_candelario_offline_sync_queue_2027_v1';

export interface SyncStatusSnapshot {
  status: SyncStateStatus;
  pendingCount: number;
  lastSyncedAtISO: string | null;
  lastError: string | null;
  queue: PendingSyncOperation[];
  isQuotaExceeded?: boolean;
}

type SyncListener = (snapshot: SyncStatusSnapshot) => void;
const syncListeners = new Set<SyncListener>();

let currentSyncStatus: SyncStateStatus = 'synced';
let lastSyncedAtISO: string | null = null;
let lastSyncError: string | null = null;
let isFlushingQueue = false;

export const loadOfflineSyncQueue = (): PendingSyncOperation[] => {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveOfflineSyncQueue = (queue: PendingSyncOperation[]): void => {
  try {
    if (queue.length === 0) {
      localStorage.removeItem(OFFLINE_QUEUE_STORAGE_KEY);
    } else {
      localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(queue.slice(0, 50)));
    }
  } catch {
    // ignore storage quota errors
  }
  notifySyncListeners();
};

export const getSyncStatusSnapshot = (): SyncStatusSnapshot => {
  const queue = loadOfflineSyncQueue();
  const quotaActive = isFirestoreQuotaExceeded();
  const effectiveStatus: SyncStateStatus =
    quotaActive
      ? 'pending'
      : currentSyncStatus === 'syncing'
      ? 'syncing'
      : queue.length > 0
      ? lastSyncError
        ? 'error'
        : 'pending'
      : currentSyncStatus;
  return {
    status: effectiveStatus,
    pendingCount: queue.length,
    lastSyncedAtISO,
    lastError: quotaActive
      ? 'Cota diária de gravação gratuita do Firestore atingida. Dados salvos localmente e na planilha.'
      : lastSyncError,
    queue,
    isQuotaExceeded: quotaActive,
  };
};

let isNotifyScheduled = false;
const notifySyncListeners = (): void => {
  if (isNotifyScheduled) return;
  isNotifyScheduled = true;
  queueMicrotask(() => {
    isNotifyScheduled = false;
    const snap = getSyncStatusSnapshot();
    syncListeners.forEach((cb) => {
      try {
        cb(snap);
      } catch {
        // ignore listener errors
      }
    });
  });
};

export const subscribeToSyncStatus = (listener: SyncListener): (() => void) => {
  syncListeners.add(listener);
  listener(getSyncStatusSnapshot());
  return () => {
    syncListeners.delete(listener);
  };
};

export const enqueuePendingSyncOperation = (
  type: PendingSyncOperation['type'],
  payloadSummary: string,
  errorMsg?: string
): void => {
  const queue = loadOfflineSyncQueue();
  const existingIdx = queue.findIndex((item) => item.type === type);
  const op: PendingSyncOperation = {
    opId:
      existingIdx >= 0
        ? queue[existingIdx].opId
        : `op-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    createdAtMs: Date.now(),
    attempts: existingIdx >= 0 ? queue[existingIdx].attempts + 1 : 1,
    lastError: errorMsg,
    payloadSummary,
  };

  if (existingIdx >= 0) {
    queue[existingIdx] = op;
  } else {
    queue.push(op);
  }

  lastSyncError = errorMsg || null;
  currentSyncStatus = errorMsg ? 'error' : 'pending';
  saveOfflineSyncQueue(queue);
};

export const markSyncOperationSuccess = (type: PendingSyncOperation['type']): void => {
  const queue = loadOfflineSyncQueue().filter((item) => item.type !== type);
  lastSyncedAtISO = new Date().toISOString();
  if (queue.length === 0) {
    lastSyncError = null;
    currentSyncStatus = 'synced';
  } else {
    currentSyncStatus = 'pending';
  }
  saveOfflineSyncQueue(queue);
};

export const setSyncingActiveState = (): void => {
  currentSyncStatus = 'syncing';
  notifySyncListeners();
};

/**
 * Recursively strips `undefined` properties/elements so Firestore `setDoc`/`writeBatch.set()`
 * never throws `Unsupported field value: undefined`.
 */
export const stripUndefinedDeep = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto === Object.prototype || proto === null) {
      const cleaned: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (v !== undefined) {
          cleaned[k] = stripUndefinedDeep(v);
        }
      }
      return cleaned as T;
    }
  }
  return value;
};

/**
 * Strips heavy inline base64 data URLs and all `undefined` values before writing to Firestore
 * while preserving Drive IDs, Drive links, manual link flags, and compact avatars.
 */
const sanitizeClassForFirestore = (cls: ClassGroup, nowMs: number): ClassGroup => {
  return stripUndefinedDeep({
    ...cls,
    updatedAtMs: cls.updatedAtMs || nowMs,
    students: (cls.students || []).map((st) => ({
      ...st,
      photo:
        st.photo && st.photo.startsWith('data:image') && st.photo.length > 18000
          ? st.photoDriveUrl || ''
          : st.photo || '',
    })),
  });
};

/**
 * Executes a single atomic unary Commit RPC via `runTransaction` (without creating
 * `PersistentWriteStream`), preventing WebChannel WriteStream handshake assertion
 * errors (`ID: da08`) on Firestore Enterprise Edition / buffered proxies.
 */
let serializedCommitChain: Promise<unknown> = Promise.resolve();

export const commitViaUnaryTransaction = async (
  buildWrites: (tx: {
    set: (ref: any, data: any, options?: { merge?: boolean }) => void;
    delete: (ref: any) => void;
  }) => void
): Promise<void> => {
  const exec = async () => {
    await runTransaction(
      firestoreDbInstance,
      async (tx) => {
        buildWrites({
          set: (ref, data, options) => {
            if (options) {
              tx.set(ref, data, options);
            } else {
              tx.set(ref, data);
            }
          },
          delete: (ref) => {
            tx.delete(ref);
          },
        });
      },
      { maxAttempts: 2 }
    );
  };
  const next = serializedCommitChain.then(exec, exec);
  serializedCommitChain = next.catch(() => undefined);
  await next;
};

const classSyncSignatureCache = new Map<string, string>();

/**
 * Computes a structural signature of a class to perform Smart Delta Writes,
 * preventing redundant writes to Cloud Firestore and saving up to 98% of write quota.
 */
export const computeClassFirestoreSignature = (cls: ClassGroup): string => {
  if (!cls || !cls.id) return '';
  return JSON.stringify({
    id: cls.id,
    name: cls.name,
    shift: cls.shift,
    periodo: cls.periodo,
    room: cls.room,
    teacherEmail: (cls.teacherEmail || '').trim().toLowerCase(),
    authorizedTeacherEmails: Array.isArray(cls.authorizedTeacherEmails)
      ? [...cls.authorizedTeacherEmails].map((e) => String(e).trim().toLowerCase()).sort()
      : [],
    isPending: Boolean(cls.isPending),
    studentsCount: cls.students?.length || 0,
    students: (cls.students || []).map((s) => ({
      id: s.id,
      ra: s.ra,
      name: s.name,
      totalAbsencesMonth: s.totalAbsencesMonth,
      justifiedAbsences: s.justifiedAbsences,
      status: s.status,
      monthlyAttendanceByMonth: s.monthlyAttendanceByMonth,
      consecutiveAbsenceAlert: s.consecutiveAbsenceAlert,
      notes: s.notes,
      photo: s.photo ? (s.photo.length > 80 ? s.photo.slice(0, 40) + ':' + s.photo.length : s.photo) : '',
      photoManualLink: s.photoManualLink,
      photoDriveId: s.photoDriveId,
      fichaPdfDriveId: s.fichaPdfDriveId,
      fichaPdfManualLink: s.fichaPdfManualLink,
    })),
  });
};

/**
 * Saves classes to Cloud Firestore (1 document per class in `school_classes_2027` collection)
 * using Smart Delta Writes: only modified classes are sent over the wire, cutting writes by ~97.5%.
 */
export const saveClassesToFirestoreCloud = async (
  classes: ClassGroup[],
  updatedAtMs: number
): Promise<boolean> => {
  if (isFirestoreQuotaExceeded()) {
    return false;
  }
  try {
    const auth = getAuth(app);
    if (!auth.currentUser) {
      return false;
    }
    const currentEmail = (auth.currentUser.email || '').trim().toLowerCase();
    const isAdminUser = isCurrentFirebaseUserOfficialAdmin(currentEmail);

    const targetClasses = isAdminUser
      ? classes
      : classes.filter((cls) => {
          if (!cls || !cls.id) return false;
          const primary = (cls.teacherEmail || '').trim().toLowerCase();
          if (primary && primary === currentEmail) return true;
          if (
            Array.isArray(cls.authorizedTeacherEmails) &&
            cls.authorizedTeacherEmails.some(
              (e) => typeof e === 'string' && e.trim().toLowerCase() === currentEmail
            )
          ) {
            return true;
          }
          return false;
        });

    if (targetClasses.length === 0) {
      return true;
    }

    // Smart Delta Diffing: identifica apenas as turmas cujos dados realmente foram alterados
    const dirtyClasses = targetClasses.filter((cls) => {
      if (!cls || !cls.id) return false;
      const sig = computeClassFirestoreSignature(cls);
      const cachedSig = classSyncSignatureCache.get(cls.id);
      return !cachedSig || cachedSig !== sig;
    });

    if (dirtyClasses.length === 0) {
      // Economia de cota 100%: nenhuma turma alvo sofreu alteração estrutural
      return true;
    }

    const localMeta = touchLocalEpochState(updatedAtMs, CLEAN_DB_RESET_EPOCH_ID);
    const metaRef = doc(firestoreDb, 'school_meta_2027', 'state');
    const changedIds = dirtyClasses.map((c) => c.id).slice(0, 40);

    await commitViaUnaryTransaction((tx) => {
      dirtyClasses.forEach((cls) => {
        if (!cls || !cls.id) return;
        const cleanCls = sanitizeClassForFirestore(cls, updatedAtMs);
        const ref = doc(firestoreDb, 'school_classes_2027', cls.id);
        tx.set(ref, stripUndefinedDeep({ ...cleanCls, updatedAtMs }), { merge: true });
      });
      tx.set(
        metaRef,
        stripUndefinedDeep({
          updatedAtMs,
          classesUpdatedAtMs: updatedAtMs,
          lastChangedClassIds: changedIds,
          epochUpdatedAtMs: updatedAtMs,
          epochVersion: localMeta.epochVersion,
          updatedAtISO: new Date(updatedAtMs).toISOString(),
          cleanResetEpochId: localMeta.epochId,
        }),
        { merge: true }
      );
    });

    // Atualiza cache de assinaturas para as turmas gravadas e invalida snapshot completo em memória
    dirtyClasses.forEach((cls) => {
      classSyncSignatureCache.set(cls.id, computeClassFirestoreSignature(cls));
    });
    cachedCloudState = null;
    lastCloudStateFetchTimeMs = 0;

    markCloudAlignedWithLocalEpoch(updatedAtMs);
    if (isFirestoreNetworkDisabled) {
      await resetFirestoreQuotaExceeded();
    }
    return true;
  } catch (error) {
    if (isFirestoreQuotaExceededError(error)) {
      markFirestoreQuotaExceeded(error);
    }
    handleFirestoreError(error, OperationType.WRITE, 'school_classes_2027');
    return false;
  }
};

let isWipingFirestoreInFlight = false;

/**
 * Wipes ONLY school data in Cloud Firestore (students, absences, notices, logs, PDF/photo caches, alerts)
 * while preserving institutional accounts (authorizedUsers), attendance window, and Google Drive links.
 */
export const wipeFirestoreSchoolDataOnly = async (
  baseClasses: ClassGroup[],
  epochId: string = CLEAN_DB_RESET_EPOCH_ID
): Promise<boolean> => {
  const auth = getAuth(app);
  if (!auth.currentUser) {
    return false;
  }
  if (isWipingFirestoreInFlight) {
    return false;
  }
  isWipingFirestoreInFlight = true;
  try {
    const nowMs = Date.now();
    const epochVersion = parseEpochRevisionNumber(epochId);
    const zeroedClasses: ClassGroup[] = baseClasses.map((c) =>
      sanitizeClassForFirestore(
        {
          ...c,
          students: [],
          totalStudents: 0,
          monthlyAbsences: 0,
          presenceRate: 0,
          statusText: 'Aguardando importação de estudantes',
          isPending: false,
          weeklyPerformance: [],
          pedagogicalNotes: '',
          updatedAtMs: nowMs,
        },
        nowMs
      )
    );

    const validClassIds = new Set(zeroedClasses.map((c) => c.id));
    const staleClassRefs: any[] = [];
    let classCursor: QueryDocumentSnapshot<DocumentData> | null = null;
    for (let page = 0; page < 5; page++) {
      const q: Query<DocumentData> = classCursor
        ? query(collection(firestoreDb, 'school_classes_2027'), startAfter(classCursor), limit(20))
        : query(collection(firestoreDb, 'school_classes_2027'), limit(20));
      const snap: QuerySnapshot<DocumentData> = await getDocs(q);
      snap.forEach((d) => {
        if (!validClassIds.has(d.id)) {
          staleClassRefs.push(d.ref);
        }
      });
      if (snap.docs.length < 20) break;
      classCursor = snap.docs[snap.docs.length - 1];
    }

    const alertsRefs: any[] = [];
    try {
      let alertCursor: QueryDocumentSnapshot<DocumentData> | null = null;
      for (let page = 0; page < 5; page++) {
        const q: Query<DocumentData> = alertCursor
          ? query(collection(firestoreDb, 'school_fcm_alerts_2027'), startAfter(alertCursor), limit(20))
          : query(collection(firestoreDb, 'school_fcm_alerts_2027'), limit(20));
        const alertsSnap: QuerySnapshot<DocumentData> = await getDocs(q);
        alertsSnap.forEach((d) => {
          alertsRefs.push(d.ref);
        });
        if (alertsSnap.docs.length < 20) break;
        alertCursor = alertsSnap.docs[alertsSnap.docs.length - 1];
      }
    } catch {
      // ignore if alerts collection empty or restricted
    }

    await commitViaUnaryTransaction((tx) => {
      zeroedClasses.forEach((cls) => {
        if (!cls || !cls.id) return;
        const ref = doc(firestoreDb, 'school_classes_2027', cls.id);
        tx.set(ref, stripUndefinedDeep(cls));
      });

      const configRef = doc(firestoreDb, 'school_meta_2027', 'config');
      tx.set(
        configRef,
        stripUndefinedDeep({
          updatedAtMs: nowMs,
          accessSessionLogs: [],
          schoolNotices: [],
          discoveredNominalPdfs: [],
          discoveredDrivePhotos: [],
          genderDictionary: [],
          cleanResetEpochId: epochId,
        }),
        { merge: true }
      );

      const stateRef = doc(firestoreDb, 'school_meta_2027', 'state');
      tx.set(
        stateRef,
        stripUndefinedDeep({
          updatedAtMs: nowMs,
          classesUpdatedAtMs: nowMs,
          epochUpdatedAtMs: nowMs,
          epochVersion,
          updatedAtISO: new Date(nowMs).toISOString(),
          cleanResetEpochId: epochId,
        }),
        { merge: true }
      );

      staleClassRefs.forEach((classRef) => {
        tx.delete(classRef);
      });
      alertsRefs.forEach((alertRef) => {
        tx.delete(alertRef);
      });
    });

    updateLocalEpochMetadata({
      epochId,
      epochVersion,
      epochUpdatedAtMs: nowMs,
      classesUpdatedAtMs: nowMs,
    });
    cachedCloudState = null;
    lastCloudStateFetchTimeMs = 0;
    cachedAuthorizedUsers = null;
    lastAuthorizedUsersFetchMs = 0;

    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'school_classes_2027');
    return false;
  } finally {
    isWipingFirestoreInFlight = false;
  }
};

/**
 * Ensures Cloud Firestore has transitioned past CLEAN_DB_RESET_EPOCH_ID when signed in,
 * respecting remote vs local epoch precedence so newer state is never wiped accidentally.
 */
export const ensureFirestoreCleanEpoch = async (
  baseClasses: ClassGroup[],
  localClassesUpdatedAtMs?: number,
  hasLocalStudents?: boolean
): Promise<boolean> => {
  const auth = getAuth(app);
  if (!auth.currentUser) {
    return false;
  }
  const report = await monitorFirestoreIntegrityOnBoot({
    baseClasses,
    localClassesUpdatedAtMs,
    hasLocalStudents,
  });
  return report.connected;
};

const isCurrentFirebaseUserOfficialAdmin = (email?: string | null): boolean => {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return (
    clean === 'emebjfreitas@jundiai.sp.gov.br' ||
    clean === 'emebjfreitas@educacao.jundiai.sp.gov.br'
  );
};

let lastConfigMetaSignature = '';

export const saveConfigMetaToFirestoreCloud = async (payload: {
  authorizedUsers?: AuthorizedUser[];
  accessSessionLogs?: UserAccessSessionLog[];
  attendanceWindowConfig?: AttendanceWindowConfig;
  schoolNotices?: any[];
  cloudLinks?: Record<string, any>;
  discoveredNominalPdfs?: any[];
  discoveredDrivePhotos?: any[];
  genderDictionary?: NameGenderEntry[];
}): Promise<boolean> => {
  if (isFirestoreQuotaExceeded()) {
    return false;
  }
  try {
    const auth = getAuth(app);
    if (!auth.currentUser) {
      return false;
    }
    const isAdminUser = isCurrentFirebaseUserOfficialAdmin(auth.currentUser.email);
    const ref = doc(firestoreDb, 'school_meta_2027', 'config');
    const cleanPayload: Record<string, any> = {};
    if (isAdminUser) {
      if (payload.authorizedUsers) cleanPayload.authorizedUsers = payload.authorizedUsers;
      if (payload.accessSessionLogs) {
        cleanPayload.accessSessionLogs = payload.accessSessionLogs.slice(0, 150);
      }
      if (payload.attendanceWindowConfig) {
        cleanPayload.attendanceWindowConfig = payload.attendanceWindowConfig;
      }
      if (payload.schoolNotices) {
        cleanPayload.schoolNotices = payload.schoolNotices.slice(0, 60);
      }
      if (payload.cloudLinks) cleanPayload.cloudLinks = payload.cloudLinks;
    }
    if (payload.discoveredNominalPdfs) {
      cleanPayload.discoveredNominalPdfs = payload.discoveredNominalPdfs.slice(0, 1200);
    }
    if (payload.discoveredDrivePhotos) {
      cleanPayload.discoveredDrivePhotos = payload.discoveredDrivePhotos.slice(0, 1200);
    }
    if (payload.genderDictionary) {
      cleanPayload.genderDictionary = payload.genderDictionary.slice(0, 1500);
    }
    if (Object.keys(cleanPayload).length === 0) {
      return true;
    }

    // Diffing de metadados: evita escritas repetidas se os dados não mudaram
    const candidateSig = JSON.stringify(cleanPayload);
    if (candidateSig === lastConfigMetaSignature) {
      return true;
    }

    const nowMs = Date.now();
    cleanPayload.updatedAtMs = nowMs;
    const cleanedData = stripUndefinedDeep(cleanPayload);
    const stateRef = doc(firestoreDb, 'school_meta_2027', 'state');
    await commitViaUnaryTransaction((tx) => {
      tx.set(ref, cleanedData, { merge: true });
      tx.set(
        stateRef,
        stripUndefinedDeep({
          updatedAtMs: nowMs,
          configUpdatedAtMs: nowMs,
        }),
        { merge: true }
      );
    });
    lastConfigMetaSignature = candidateSig;
    setLocalConfigUpdatedAtMs(nowMs);
    cachedCloudState = null;
    lastCloudStateFetchTimeMs = 0;
    cachedAuthorizedUsers = null;
    lastAuthorizedUsersFetchMs = 0;

    if (isFirestoreNetworkDisabled) {
      await resetFirestoreQuotaExceeded();
    }
    return true;
  } catch (error) {
    if (isFirestoreQuotaExceededError(error)) {
      markFirestoreQuotaExceeded(error);
    }
    handleFirestoreError(error, OperationType.WRITE, 'school_meta_2027/config');
    return false;
  }
};

let cachedAuthorizedUsers: AuthorizedUser[] | null = null;
let lastAuthorizedUsersFetchMs = 0;
const AUTHORIZED_USERS_CACHE_TTL_MS = 2 * 60 * 1000;

/**
 * Consulta EXCLUSIVAMENTE o documento de configuração (`school_meta_2027/config`) para verificar
 * perfis autorizados de acesso.
 * Consome apenas 1 leitura de documento em vez de 42 (economia massiva de cota de leitura no login)
 * e reaproveita cache em memória + persistentLocalCache do IndexedDB.
 */
export const fetchAuthorizedUsersFromFirestore = async (
  forceRefresh = false
): Promise<AuthorizedUser[] | null> => {
  if (isFirestoreQuotaExceeded()) {
    return cachedAuthorizedUsers;
  }
  const now = Date.now();
  if (
    !forceRefresh &&
    cachedAuthorizedUsers &&
    now - lastAuthorizedUsersFetchMs < AUTHORIZED_USERS_CACHE_TTL_MS
  ) {
    return cachedAuthorizedUsers;
  }
  try {
    const configSnap = await getDocServerFirst(
      doc(firestoreDb, 'school_meta_2027', 'config'),
      forceRefresh
    );
    if (!configSnap.exists()) return null;
    const data = configSnap.data();
    if (Array.isArray(data?.authorizedUsers) && data.authorizedUsers.length > 0) {
      cachedAuthorizedUsers = data.authorizedUsers as AuthorizedUser[];
      lastAuthorizedUsersFetchMs = now;
      return cachedAuthorizedUsers;
    }
  } catch (err) {
    if (isFirestoreQuotaExceededError(err)) {
      markFirestoreQuotaExceeded(err);
    }
  }
  return null;
};

let cachedCloudState: any = null;
let lastCloudStateFetchTimeMs = 0;
const CLOUD_STATE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos de cache em memória para leituras completas

export interface FetchCloudStateOptions {
  forceRefresh?: boolean;
  forceRefreshClasses?: boolean;
  forceRefreshConfig?: boolean;
  classIds?: string[];
  teacherEmail?: string;
  pageSize?: number;
  loadAllPages?: boolean;
  changedClassIds?: string[];
  skipClasses?: boolean;
  skipConfig?: boolean;
}

const getDocServerFirst = async (
  ref: DocumentReference<DocumentData>,
  serverFirst: boolean
): Promise<DocumentSnapshot<DocumentData>> => {
  if (!serverFirst) return getDoc(ref);
  try {
    return await getDocFromServer(ref);
  } catch (err: any) {
    const code = err?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (
      code === 'unavailable' ||
      msg.includes('client is offline') ||
      msg.includes('Failed to get document because the client is offline')
    ) {
      return getDoc(ref);
    }
    throw err;
  }
};

const getDocsServerFirst = async (
  q: Query<DocumentData>,
  serverFirst: boolean
): Promise<QuerySnapshot<DocumentData>> => {
  if (!serverFirst) return getDocs(q);
  try {
    return await getDocsFromServer(q);
  } catch (err: any) {
    const code = err?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (
      code === 'unavailable' ||
      msg.includes('client is offline') ||
      msg.includes('Failed to get document because the client is offline')
    ) {
      return getDocs(q);
    }
    throw err;
  }
};

export const fetchStateFromFirestoreCloud = async (
  options: boolean | FetchCloudStateOptions = false
): Promise<{
  classes?: ClassGroup[];
  classesUpdatedAtMs?: number;
  configUpdatedAtMs?: number;
  stateUpdatedAtMs?: number;
  authorizedUsers?: AuthorizedUser[];
  accessSessionLogs?: UserAccessSessionLog[];
  attendanceWindowConfig?: AttendanceWindowConfig;
  schoolNotices?: any[];
  cloudLinks?: Record<string, any>;
  discoveredNominalPdfs?: any[];
  discoveredDrivePhotos?: any[];
  genderDictionary?: NameGenderEntry[];
  cleanResetEpochId?: string;
  epochVersion?: number;
  epochUpdatedAtMs?: number;
  lastClassDoc?: QueryDocumentSnapshot | null;
  hasMoreClasses?: boolean;
} | null> => {
  if (isFirestoreQuotaExceeded()) {
    return null;
  }
  const opts: FetchCloudStateOptions =
    typeof options === 'boolean' ? { forceRefresh: options } : (options || {});
  const classesServerFirst = Boolean(opts.forceRefresh || opts.forceRefreshClasses);
  const configServerFirst = Boolean(opts.forceRefresh || opts.forceRefreshConfig);
  const stateServerFirst = classesServerFirst || configServerFirst;
  const now = Date.now();
  if (
    !stateServerFirst &&
    !opts.classIds &&
    !opts.teacherEmail &&
    !opts.changedClassIds &&
    !opts.skipClasses &&
    !opts.skipConfig &&
    cachedCloudState &&
    now - lastCloudStateFetchTimeMs < CLOUD_STATE_CACHE_TTL_MS
  ) {
    return cachedCloudState;
  }
  try {
    // 1. Busca metadados pontuais (usa servidor direto quando houver atualização remota detectada)
    const [configSnap, stateSnap] = await Promise.all([
      opts.skipConfig
        ? Promise.resolve(null)
        : getDocServerFirst(doc(firestoreDb, 'school_meta_2027', 'config'), configServerFirst),
      getDocServerFirst(doc(firestoreDb, 'school_meta_2027', 'state'), stateServerFirst),
    ]);

    const configData: Record<string, any> =
      configSnap && configSnap.exists() ? (configSnap.data() || {}) : {};
    const stateData: Record<string, any> = stateSnap.exists() ? (stateSnap.data() || {}) : {};

    const localMeta = getLocalEpochMetadata();
    const remoteEpochId = stateData.cleanResetEpochId as string | undefined;
    const remoteEpochRank = Math.max(
      typeof stateData.epochVersion === 'number' ? stateData.epochVersion : 0,
      parseEpochRevisionNumber(remoteEpochId)
    );
    const localEpochRank = Math.max(
      localMeta.epochVersion,
      parseEpochRevisionNumber(localMeta.epochId)
    );
    const isCleanEpoch =
      Boolean(remoteEpochId) &&
      (remoteEpochId === localMeta.epochId || remoteEpochRank >= localEpochRank);

    const classes: ClassGroup[] = [];
    let maxClassUpdatedAt = 0;
    let lastClassDoc: QueryDocumentSnapshot | null = null;
    let hasMoreClasses = false;

    if (isCleanEpoch && !opts.skipClasses) {
      const storedClasses = getStoredClasses();
      const localHasStudents = storedClasses.some(
        (c) => Array.isArray(c.students) && c.students.length > 0
      );
      const effectiveChangedClassIds = localHasStudents ? opts.changedClassIds : undefined;

      // 2. Delta-only ou consulta filtrada/paginada de turmas (reduz leituras em até 97%)
      if (effectiveChangedClassIds && effectiveChangedClassIds.length > 0 && effectiveChangedClassIds.length <= 10) {
        const allowedScope =
          opts.classIds && opts.classIds.length > 0 && !opts.classIds.includes('all')
            ? new Set(opts.classIds.map((id) => id.toLowerCase()))
            : null;
        const deltaIds = effectiveChangedClassIds
          .filter((id) => !allowedScope || allowedScope.has(id.toLowerCase()))
          .slice(0, 10);
        if (deltaIds.length > 0) {
          const docSnaps = await Promise.all(
            deltaIds.map((cid) =>
              getDocServerFirst(doc(firestoreDb, 'school_classes_2027', cid), classesServerFirst)
            )
          );
          docSnaps.forEach((d) => {
            if (d.exists()) {
              const data = d.data() as ClassGroup;
              if (data && data.id && Array.isArray(data.students)) {
                classes.push(data);
                classSyncSignatureCache.set(data.id, computeClassFirestoreSignature(data));
                if ((data.updatedAtMs || 0) > maxClassUpdatedAt) {
                  maxClassUpdatedAt = data.updatedAtMs || 0;
                }
              }
            }
          });
        }
      } else if (opts.classIds && opts.classIds.length > 0 && !opts.classIds.includes('all')) {
        // Docente regente: busca apenas as turmas atribuídas por doc direto (economiza até 95% de leituras)
        const targetIds = opts.classIds.slice(0, 10);
        const docSnaps = await Promise.all(
          targetIds.map((cid) =>
            getDocServerFirst(doc(firestoreDb, 'school_classes_2027', cid), classesServerFirst)
          )
        );
        docSnaps.forEach((d) => {
          if (d.exists()) {
            const data = d.data() as ClassGroup;
            if (data && data.id && Array.isArray(data.students)) {
              classes.push(data);
              classSyncSignatureCache.set(data.id, computeClassFirestoreSignature(data));
              if ((data.updatedAtMs || 0) > maxClassUpdatedAt) {
                maxClassUpdatedAt = data.updatedAtMs || 0;
              }
            }
          }
        });
      } else if (opts.teacherEmail) {
        // Filtro where(...) com limit(20) por email docente
        const pageLimit = opts.pageSize || 20;
        const q = query(
          collection(firestoreDb, 'school_classes_2027'),
          where('teacherEmail', '==', opts.teacherEmail.trim().toLowerCase()),
          limit(pageLimit)
        );
        const snap = await getDocsServerFirst(q, classesServerFirst);
        snap.forEach((d) => {
          const data = d.data() as ClassGroup;
          if (data && data.id && Array.isArray(data.students)) {
            classes.push(data);
            classSyncSignatureCache.set(data.id, computeClassFirestoreSignature(data));
            if ((data.updatedAtMs || 0) > maxClassUpdatedAt) {
              maxClassUpdatedAt = data.updatedAtMs || 0;
            }
          }
        });
        lastClassDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
        hasMoreClasses = snap.docs.length === pageLimit;
      } else {
        // Consulta paginada com limit(20); quando loadAllPages=true ou localHasStudents=false carrega as páginas restantes (max 3 = 40 turmas)
        const pageLimit = opts.pageSize || 20;
        const maxPages = opts.loadAllPages || !localHasStudents ? 3 : 1;
        let cursor: QueryDocumentSnapshot | null = null;
        for (let pageIdx = 0; pageIdx < maxPages; pageIdx++) {
          const q: Query<DocumentData> = cursor
            ? query(collection(firestoreDb, 'school_classes_2027'), startAfter(cursor), limit(pageLimit))
            : query(collection(firestoreDb, 'school_classes_2027'), limit(pageLimit));
          const snap = await getDocsServerFirst(q, classesServerFirst);
          snap.forEach((d) => {
            const data = d.data() as ClassGroup;
            if (data && data.id && Array.isArray(data.students)) {
              classes.push(data);
              classSyncSignatureCache.set(data.id, computeClassFirestoreSignature(data));
              if ((data.updatedAtMs || 0) > maxClassUpdatedAt) {
                maxClassUpdatedAt = data.updatedAtMs || 0;
              }
            }
          });
          lastClassDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
          hasMoreClasses = snap.docs.length === pageLimit;
          if (!hasMoreClasses || !lastClassDoc) break;
          cursor = lastClassDoc;
        }
      }
    }

    if (isCleanEpoch && Array.isArray(configData.genderDictionary) && configData.genderDictionary.length > 0) {
      saveStoredNameGenderEntries(configData.genderDictionary);
    }

    const classesUpdatedAtMs = Math.max(
      maxClassUpdatedAt,
      stateData.classesUpdatedAtMs || 0
    );

    if (classes.length === 0 && Object.keys(configData).length === 0) {
      return null;
    }

    const result = {
      classes: classes.length > 0 ? classes : undefined,
      classesUpdatedAtMs,
      configUpdatedAtMs: Number(stateData.configUpdatedAtMs || configData.updatedAtMs || 0),
      stateUpdatedAtMs: Number(stateData.updatedAtMs || 0),
      authorizedUsers: configData.authorizedUsers,
      accessSessionLogs: isCleanEpoch ? configData.accessSessionLogs : [],
      attendanceWindowConfig: configData.attendanceWindowConfig,
      schoolNotices: isCleanEpoch ? configData.schoolNotices : [],
      cloudLinks: configData.cloudLinks,
      discoveredNominalPdfs: isCleanEpoch ? configData.discoveredNominalPdfs : [],
      discoveredDrivePhotos: isCleanEpoch ? configData.discoveredDrivePhotos : [],
      genderDictionary: isCleanEpoch ? configData.genderDictionary : [],
      cleanResetEpochId: remoteEpochId,
      epochVersion: remoteEpochRank,
      epochUpdatedAtMs: stateData.epochUpdatedAtMs || 0,
      lastClassDoc,
      hasMoreClasses,
    };

    if (!opts.classIds && !opts.teacherEmail && !opts.changedClassIds && !opts.skipClasses && !opts.skipConfig) {
      cachedCloudState = result;
      lastCloudStateFetchTimeMs = now;
    }
    return result;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'school_classes_2027');
    return null;
  }
};

/**
 * Consulta paginada com limit(20) e startAfter para carregamento sob demanda ("Carregar mais"),
 * impedindo o consumo em massa da cota diária do Firestore.
 */
export const fetchClassesFromFirestorePaginated = async (options?: {
  pageSize?: number;
  lastDoc?: QueryDocumentSnapshot;
  teacherEmail?: string;
}): Promise<{
  classes: ClassGroup[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}> => {
  if (isFirestoreQuotaExceeded()) {
    return { classes: [], lastDoc: null, hasMore: false };
  }
  try {
    const size = options?.pageSize || 20;
    const constraints: any[] = [];
    if (options?.teacherEmail) {
      constraints.push(where('teacherEmail', '==', options.teacherEmail.trim().toLowerCase()));
    }
    constraints.push(limit(size));
    if (options?.lastDoc) {
      constraints.push(startAfter(options.lastDoc));
    }

    const q = query(collection(firestoreDb, 'school_classes_2027'), ...constraints);
    const snap = await getDocs(q);

    const classes: ClassGroup[] = [];
    snap.forEach((d) => {
      const data = d.data() as ClassGroup;
      if (data && data.id && Array.isArray(data.students)) {
        classes.push(data);
      }
    });

    const newLastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
    return {
      classes,
      lastDoc: newLastDoc,
      hasMore: snap.docs.length === size,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'school_classes_2027');
    return { classes: [], lastDoc: null, hasMore: false };
  }
};

let activeRealtimeUnsubscribe: (() => void) | null = null;
let activeDeltaSyncTrigger: ((forceStateCheck?: boolean, forcePullAll?: boolean) => Promise<void>) | null = null;
let lastResumeDeltaCheckMs = 0;

/**
 * Executa verificação pontual de 1 única leitura no servidor (`school_meta_2027/state`)
 * ao retornar ao aplicativo (focus / visibilitychange / reconexão) na hospedagem estática.
 * Se nada mudou, consome apenas 1 leitura; se houver delta novo, baixa somente o que mudou.
 */
export const checkFirestoreDeltaOnResume = async (): Promise<void> => {
  if (isFirestoreQuotaExceeded() || !activeDeltaSyncTrigger) return;
  const now = Date.now();
  if (now - lastResumeDeltaCheckMs < 10000) return;
  lastResumeDeltaCheckMs = now;
  try {
    await activeDeltaSyncTrigger(true, false);
  } catch {
    // ignore transient offline checks
  }
};

/**
 * Invalida caches locais em memória e força leitura direta do servidor Firestore
 * para obter imediatamente o estado mais recente (usado no botão "Sincronizar Agora").
 */
export const forceRefreshFirestoreFromServer = async (): Promise<boolean> => {
  if (isFirestoreQuotaExceeded()) return false;
  cachedCloudState = null;
  lastCloudStateFetchTimeMs = 0;
  cachedAuthorizedUsers = null;
  lastAuthorizedUsersFetchMs = 0;
  lastResumeDeltaCheckMs = 0;

  if (activeDeltaSyncTrigger) {
    try {
      await activeDeltaSyncTrigger(true, true);
      return true;
    } catch {
      return false;
    }
  }
  return false;
};

/**
 * Otimização de tempo real: substitui o onSnapshot da coleção inteira 'school_classes_2027'
 * por carga inicial completa + ouvinte leve EXCLUSIVAMENTE no documento 'school_meta_2027/state'.
 * Quando ocorrem alterações em outro dispositivo, baixa somente o delta exato (config e/ou turmas alteradas)
 * diretamente do servidor, garantindo atualização perfeita com consumo mínimo de cota (~1-2 leituras).
 */
export const subscribeToFirestoreRealtimeState = (callbacks: {
  classIds?: string[];
  teacherEmail?: string;
  onClassesUpdate?: (
    classes: ClassGroup[],
    updatedAtMs: number,
    pagination?: { lastDoc: QueryDocumentSnapshot | null; hasMore: boolean }
  ) => void;
  onMetaConfigUpdate?: (config: {
    authorizedUsers?: AuthorizedUser[];
    accessSessionLogs?: UserAccessSessionLog[];
    attendanceWindowConfig?: AttendanceWindowConfig;
    schoolNotices?: any[];
    cloudLinks?: Record<string, any>;
    discoveredNominalPdfs?: any[];
    discoveredDrivePhotos?: any[];
    genderDictionary?: NameGenderEntry[];
  }) => void;
}): (() => void) => {
  if (activeRealtimeUnsubscribe) {
    try {
      activeRealtimeUnsubscribe();
    } catch {
      // ignore
    }
    activeRealtimeUnsubscribe = null;
  }

  if (isFirestoreQuotaExceeded()) {
    return () => {};
  }

  const unsubs: Array<() => void> = [];
  let isCancelled = false;
  let lastDeltaFetchMs = 0;
  let lastAppliedStateUpdatedMs = 0;
  let lastAppliedConfigUpdatedMs = getLocalConfigUpdatedAtMs();
  let lastAppliedClassesUpdatedMs = getLocalEpochMetadata().classesUpdatedAtMs || 0;
  let trailingTimer: number | null = null;
  let inFlightDeltaPull = false;

  const deliverCloudPayload = (
    cloudData: Awaited<ReturnType<typeof fetchStateFromFirestoreCloud>>,
    fromCache: boolean
  ) => {
    if (isCancelled || !cloudData) return;
    if (cloudData.stateUpdatedAtMs) {
      lastAppliedStateUpdatedMs = Math.max(lastAppliedStateUpdatedMs, cloudData.stateUpdatedAtMs);
    }
    if (cloudData.configUpdatedAtMs) {
      lastAppliedConfigUpdatedMs = Math.max(lastAppliedConfigUpdatedMs, cloudData.configUpdatedAtMs);
      setLocalConfigUpdatedAtMs(cloudData.configUpdatedAtMs);
    }
    if (cloudData.classesUpdatedAtMs) {
      lastAppliedClassesUpdatedMs = Math.max(lastAppliedClassesUpdatedMs, cloudData.classesUpdatedAtMs);
    }
    if (
      cloudData.classes &&
      cloudData.classes.length > 0 &&
      callbacks.onClassesUpdate &&
      shouldAllowRemoteClassesOverwrite({
        remoteUpdatedAtMs: cloudData.classesUpdatedAtMs,
        remoteEpochId: cloudData.cleanResetEpochId,
        remoteEpochVersion: cloudData.epochVersion,
        fromCache,
      })
    ) {
      callbacks.onClassesUpdate(
        cloudData.classes,
        cloudData.classesUpdatedAtMs || Date.now(),
        {
          lastDoc: cloudData.lastClassDoc || null,
          hasMore: Boolean(cloudData.hasMoreClasses),
        }
      );
    }
    if (callbacks.onMetaConfigUpdate) {
      callbacks.onMetaConfigUpdate({
        authorizedUsers: cloudData.authorizedUsers,
        accessSessionLogs: cloudData.accessSessionLogs,
        attendanceWindowConfig: cloudData.attendanceWindowConfig,
        schoolNotices: cloudData.schoolNotices,
        cloudLinks: cloudData.cloudLinks,
        discoveredNominalPdfs: cloudData.discoveredNominalPdfs,
        discoveredDrivePhotos: cloudData.discoveredDrivePhotos,
        genderDictionary: cloudData.genderDictionary,
      });
    }
  };

  const applyDeltaFromStateData = async (stateData: Record<string, any>) => {
    if (isCancelled || inFlightDeltaPull) return;
    const remoteClassesUpdated = Number(stateData.classesUpdatedAtMs || 0);
    const remoteConfigUpdated = Number(stateData.configUpdatedAtMs || 0);
    const remoteMetaUpdated = Number(stateData.updatedAtMs || remoteClassesUpdated || 0);
    const localUpdated = Math.max(
      getLocalEpochMetadata().classesUpdatedAtMs || 0,
      lastAppliedClassesUpdatedMs
    );

    const hasNewerClasses = remoteClassesUpdated > localUpdated;
    const hasNewerConfig =
      remoteConfigUpdated > lastAppliedConfigUpdatedMs ||
      (remoteConfigUpdated === 0 && remoteMetaUpdated > lastAppliedStateUpdatedMs);

    if (!hasNewerClasses && !hasNewerConfig) {
      lastAppliedStateUpdatedMs = Math.max(lastAppliedStateUpdatedMs, remoteMetaUpdated);
      return;
    }

    const now = Date.now();
    const cooldownMs = 4000;
    const waitRemaining = cooldownMs - (now - lastDeltaFetchMs);
    if (waitRemaining > 0) {
      if (trailingTimer === null && typeof window !== 'undefined') {
        trailingTimer = window.setTimeout(() => {
          trailingTimer = null;
          void applyDeltaFromStateData(stateData);
        }, waitRemaining + 100);
      }
      return;
    }

    lastDeltaFetchMs = now;
    inFlightDeltaPull = true;
    try {
      const changedIds = Array.isArray(stateData.lastChangedClassIds)
        ? (stateData.lastChangedClassIds as unknown[]).filter(
            (id): id is string => typeof id === 'string' && id.trim().length > 0
          )
        : undefined;

      const fresh = await fetchStateFromFirestoreCloud({
        forceRefresh: true,
        classIds: callbacks.classIds,
        teacherEmail: callbacks.teacherEmail,
        pageSize: 20,
        loadAllPages: hasNewerClasses && (!changedIds || changedIds.length > 10),
        changedClassIds: hasNewerClasses ? changedIds : undefined,
        skipClasses: !hasNewerClasses,
        skipConfig: !hasNewerConfig,
      });

      lastAppliedStateUpdatedMs = Math.max(lastAppliedStateUpdatedMs, remoteMetaUpdated);
      if (hasNewerConfig && remoteConfigUpdated > 0) {
        lastAppliedConfigUpdatedMs = Math.max(lastAppliedConfigUpdatedMs, remoteConfigUpdated);
        setLocalConfigUpdatedAtMs(remoteConfigUpdated);
        cachedAuthorizedUsers = null;
        lastAuthorizedUsersFetchMs = 0;
      }
      if (hasNewerClasses && remoteClassesUpdated > 0) {
        lastAppliedClassesUpdatedMs = Math.max(lastAppliedClassesUpdatedMs, remoteClassesUpdated);
      }
      if (hasNewerClasses || hasNewerConfig) {
        cachedCloudState = null;
        lastCloudStateFetchTimeMs = 0;
      }
      deliverCloudPayload(fresh, false);
    } finally {
      inFlightDeltaPull = false;
    }
  };

  activeDeltaSyncTrigger = async (forceStateCheck = false, forcePullAll = false) => {
    if (isCancelled || isFirestoreQuotaExceeded()) return;
    const authUser = getAuth(app).currentUser;
    if (!authUser || !authUser.emailVerified) return;

    if (forcePullAll) {
      inFlightDeltaPull = true;
      try {
        const fresh = await fetchStateFromFirestoreCloud({
          forceRefresh: true,
          classIds: callbacks.classIds,
          teacherEmail: callbacks.teacherEmail,
          pageSize: 20,
          loadAllPages: true,
        });
        if (fresh) {
          deliverCloudPayload(fresh, false);
        }
      } finally {
        inFlightDeltaPull = false;
      }
      return;
    }

    const stateSnap = await getDocServerFirst(
      doc(firestoreDb, 'school_meta_2027', 'state'),
      forceStateCheck
    );
    if (stateSnap.exists()) {
      await applyDeltaFromStateData(stateSnap.data() || {});
    }
  };

  // 1. Carga inicial no boot: verifica o state no servidor (1 leitura) e só baixa do servidor o que realmente mudou
  void (async () => {
    try {
      const authUser = getAuth(app).currentUser;
      let refreshClassesFromServer = false;
      let refreshConfigFromServer = false;
      if (authUser && authUser.emailVerified) {
        try {
          const srvState = await getDocServerFirst(
            doc(firestoreDb, 'school_meta_2027', 'state'),
            true
          );
          if (srvState.exists()) {
            const sData = srvState.data() || {};
            const srvClassesTs = Number(sData.classesUpdatedAtMs || 0);
            const srvConfigTs = Number(sData.configUpdatedAtMs || 0);
            const srvMetaTs = Number(sData.updatedAtMs || srvClassesTs || 0);
            refreshClassesFromServer =
              srvClassesTs > lastAppliedClassesUpdatedMs ||
              (srvConfigTs === 0 && srvMetaTs > lastAppliedClassesUpdatedMs);
            refreshConfigFromServer =
              srvConfigTs > lastAppliedConfigUpdatedMs ||
              (srvConfigTs === 0 && srvMetaTs > lastAppliedConfigUpdatedMs);
          }
        } catch {
          // fallback para cache local se offline
        }
      }
      const cloudData = await fetchStateFromFirestoreCloud({
        forceRefresh: refreshClassesFromServer && refreshConfigFromServer,
        forceRefreshClasses: refreshClassesFromServer,
        forceRefreshConfig: refreshConfigFromServer,
        classIds: callbacks.classIds,
        teacherEmail: callbacks.teacherEmail,
        pageSize: 20,
        loadAllPages: true,
      });
      deliverCloudPayload(cloudData, false);
    } catch {
      // ignore boot fetch error
    }
  })();

  // 2. Ouvinte leve EXCLUSIVAMENTE no documento de metadados ('school_meta_2027/state')
  // Só ativa se usuário autenticado no Firebase Auth; elimina o onSnapshot na coleção inteira 'school_classes_2027'
  try {
    const authUser = getAuth(app).currentUser;
    if (authUser && authUser.emailVerified) {
      const unsubState = onSnapshot(
        doc(firestoreDb, 'school_meta_2027', 'state'),
        (stateSnap) => {
          if (isCancelled || !stateSnap.exists() || stateSnap.metadata.fromCache) return;
          void applyDeltaFromStateData(stateSnap.data() || {});
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, 'school_meta_2027/state');
        }
      );
      unsubs.push(unsubState);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'school_meta_2027/state');
  }

  const compositeUnsub = () => {
    isCancelled = true;
    if (trailingTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(trailingTimer);
      trailingTimer = null;
    }
    if (activeDeltaSyncTrigger) {
      activeDeltaSyncTrigger = null;
    }
    unsubs.forEach((u) => {
      try {
        u();
      } catch {
        // ignore
      }
    });
    if (activeRealtimeUnsubscribe === compositeUnsub) {
      activeRealtimeUnsubscribe = null;
    }
  };

  activeRealtimeUnsubscribe = compositeUnsub;
  return compositeUnsub;
};

export const registerOfflineFlushHandler = (flushFn: () => Promise<void>): (() => void) => {
  if (typeof window === 'undefined') return () => {};
  const handleOnline = () => {
    if (!isFlushingQueue && loadOfflineSyncQueue().length > 0) {
      isFlushingQueue = true;
      flushFn().finally(() => {
        isFlushingQueue = false;
      });
    }
  };
  window.addEventListener('online', handleOnline);
  return () => window.removeEventListener('online', handleOnline);
};

/**
 * Verifies live Firestore connectivity against the server using getDocFromServer.
 */
export const testFirestoreConnection = async (): Promise<{
  connected: boolean;
  offline: boolean;
  error?: string;
}> => {
  try {
    await getDocFromServer(doc(firestoreDb, 'school_meta_2027', 'state'));
    return { connected: true, offline: false };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    const isOffline =
      msg.includes('the client is offline') ||
      msg.includes('Failed to get document because the client is offline');
    if (isOffline) {
      return { connected: false, offline: true, error: msg };
    }
    return { connected: false, offline: false, error: msg };
  }
};

const sanitizeDriveManifestForFirestore = (
  manifest: DriveSyncFileManifest
): DriveSyncFileManifest => {
  const cleanId = manifest.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const authEmail = getAuth(app).currentUser?.email || manifest.updatedByEmail || 'emebjfreitas@jundiai.sp.gov.br';
  const cleaned: DriveSyncFileManifest = {
    id: cleanId,
    kind: manifest.kind,
    fileName: (manifest.fileName || `${cleanId}.bin`).slice(0, 240),
    driveFileId: manifest.driveFileId.slice(0, 160),
    mimeType: (manifest.mimeType || 'application/octet-stream').slice(0, 120),
    byteSize: Math.max(0, Number(manifest.byteSize || 0)),
    sha256: manifest.sha256.slice(0, 128),
    md5Checksum: manifest.md5Checksum.slice(0, 64),
    syncVersion: Math.max(1, Number(manifest.syncVersion || Date.now())),
    updatedAtMs: Math.max(1, Number(manifest.updatedAtMs || Date.now())),
    updatedByEmail: authEmail.slice(0, 160),
    appDataBackedUp: Boolean(manifest.appDataBackedUp),
  };
  if (manifest.studentId) cleaned.studentId = manifest.studentId.slice(0, 128);
  if (manifest.classId) cleaned.classId = manifest.classId.slice(0, 128);
  if (manifest.driveWebViewLink) cleaned.driveWebViewLink = manifest.driveWebViewLink.slice(0, 512);
  if (manifest.driveFolderId) cleaned.driveFolderId = manifest.driveFolderId.slice(0, 160);
  return cleaned;
};

/**
 * Upserts a single verified Google Drive file manifest into /school_drive_sync_2027/{fileKey}.
 */
export const upsertDriveFileSyncManifest = async (
  manifest: DriveSyncFileManifest
): Promise<boolean> => {
  return upsertDriveFileSyncBatch([manifest]);
};

/**
 * Upserts verified Google Drive file manifests into /school_drive_sync_2027/{fileKey}
 * in bounded transactions so all institutional users see identical lossless assets.
 */
export const upsertDriveFileSyncBatch = async (
  manifests: DriveSyncFileManifest[]
): Promise<boolean> => {
  if (manifests.length === 0 || isFirestoreQuotaExceeded()) {
    return false;
  }
  const auth = getAuth(app);
  if (!auth.currentUser || !auth.currentUser.emailVerified) {
    return false;
  }

  try {
    const CHUNK_SIZE = 20;
    for (let i = 0; i < manifests.length; i += CHUNK_SIZE) {
      const batch = manifests.slice(i, i + CHUNK_SIZE).map(sanitizeDriveManifestForFirestore);
      await commitViaUnaryTransaction((tx) => {
        for (const item of batch) {
          if (!item.id || !item.driveFileId) continue;
          const ref = doc(firestoreDb, 'school_drive_sync_2027', item.id);
          tx.set(ref, stripUndefinedDeep(item), { merge: true });
        }
      });
    }
    return true;
  } catch (error) {
    if (isFirestoreQuotaExceededError(error)) {
      markFirestoreQuotaExceeded(error);
    }
    handleFirestoreError(error, OperationType.WRITE, 'school_drive_sync_2027');
    return false;
  }
};

/**
 * Fetches verified Drive lossless file manifests from Firestore for cross-device reconciliation.
 */
export const fetchDriveFileSyncManifests = async (
  pageLimit = 200
): Promise<DriveSyncFileManifest[]> => {
  if (isFirestoreQuotaExceeded()) {
    return [];
  }
  const auth = getAuth(app);
  if (!auth.currentUser || !auth.currentUser.emailVerified) {
    return [];
  }
  try {
    const q = query(collection(firestoreDb, 'school_drive_sync_2027'), limit(pageLimit));
    const snap = await getDocs(q);
    const items: DriveSyncFileManifest[] = [];
    snap.forEach((d) => {
      const data = d.data() as DriveSyncFileManifest;
      if (data && data.id && data.driveFileId) {
        items.push(data);
      }
    });
    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'school_drive_sync_2027');
    return [];
  }
};



