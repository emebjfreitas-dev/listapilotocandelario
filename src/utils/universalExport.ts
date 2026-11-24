import type { PDFFont, PDFPage } from 'pdf-lib';

export type UniversalExportFormat = 'docx' | 'xlsx' | 'xls' | 'pdf' | 'csv';

export interface ExportMetadataItem {
  label: string;
  value: string;
}

export interface ExportSummaryMetric {
  label: string;
  value: string;
  detail?: string;
}

export interface ExportSheetSection {
  sheetName: string;
  sectionTitle?: string;
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
  columnWidths?: number[];
}

export interface UniversalExportReport {
  fileNameBase: string;
  title: string;
  subtitle?: string;
  schoolName?: string;
  generatedBy?: string;
  lgpdNotice?: string;
  orientation?: 'portrait' | 'landscape';
  metadata?: ExportMetadataItem[];
  summaryMetrics?: ExportSummaryMetric[];
  sheets: ExportSheetSection[];
}

export const SCHOOL_HEADER_DEFAULT = 'EMEB Prof. Joaquim Candelário de Freitas · Rede Municipal de Jundiaí';
export const DEFAULT_LGPD_NOTICE =
  'Documento gerado pelo Lista Piloto Candelário 2027. Tratamento de dados escolares protegido pela LGPD (Lei nº 13.709/2018, Art. 14).';

export const FORMAT_LABELS: Record<UniversalExportFormat, string> = {
  docx: 'Word (.docx)',
  xlsx: 'Excel (.xlsx)',
  xls: 'Excel Clássico (.xls)',
  pdf: 'PDF (.pdf)',
  csv: 'CSV (.csv)',
};

export function sanitizeFileNameBase(raw: string): string {
  return (
    raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 90) || 'Relatorio_Lista_Piloto_2027'
  );
}

export function sanitizeSpreadsheetCell(val: string | number | boolean | null | undefined): string | number {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  const str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Normaliza texto para codificação WinAnsi (PDF StandardFonts.Helvetica),
 * garantindo que símbolos matemáticos (≥, ≤, →, ✓) ou emojis nunca lancem erro no pdf-lib.
 */
export function toWinAnsiSafeText(input: unknown): string {
  if (input === null || input === undefined) return '';
  const raw = String(input)
    .replace(/\u2265/g, '>=')
    .replace(/\u2264/g, '<=')
    .replace(/\u2192/g, '->')
    .replace(/\u2190/g, '<-')
    .replace(/\u2713|\u2714|\u2705/g, 'OK')
    .replace(/\u2717|\u2718|\u274c/g, 'X')
    .replace(/\u2014|\u2013/g, '-')
    .replace(/\u2022|\u00b7/g, '·')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[\r\n\t]+/g, ' ');

  let safe = '';
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    // ASCII imprimível + Latin-1 Supplement suportado integralmente por WinAnsi
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) {
      safe += raw[i];
    }
  }
  return safe.replace(/\s{2,}/g, ' ').trim();
}

function formatNowBr(): string {
  try {
    return new Date().toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return new Date().toISOString().slice(0, 16).replace('T', ' ');
  }
}

function escapeXml(value: unknown): string {
  const str = String(value ?? '');
  return str
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function shouldUseLandscape(report: UniversalExportReport): boolean {
  if (report.orientation) return report.orientation === 'landscape';
  return report.sheets.some((s) => s.headers.length >= 6);
}

// ============================================================================
// GERADOR OOXML (.DOCX) PURO EM TYPESCRIPT (ZERO DEPENDÊNCIAS EXTRAS)
// ============================================================================

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntryInput {
  name: string;
  data: Uint8Array;
}

function buildStoredZip(entries: ZipEntryInput[]): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  const now = new Date();
  const dosTime =
    ((now.getHours() & 0x1f) << 11) |
    ((now.getMinutes() & 0x3f) << 5) |
    ((now.getSeconds() >> 1) & 0x1f);
  const dosDate =
    (((Math.max(1980, now.getFullYear()) - 1980) & 0x7f) << 9) |
    (((now.getMonth() + 1) & 0x0f) << 5) |
    (now.getDate() & 0x1f);

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const data = entry.data;
    const crc = crc32(data);

    // Local File Header (30 bytes + name)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
    lv.setUint16(8, 0, true); // STORE (uncompressed)
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, data);

    // Central Directory Header (46 bytes + name)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + data.length;
  }

  const centralSize = centralParts.reduce((sum, p) => sum + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const totalLen = offset + centralSize + eocd.length;
  const out = new Uint8Array(totalLen);
  let cursor = 0;
  for (const part of localParts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  for (const part of centralParts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  out.set(eocd, cursor);
  return out;
}

function buildDocxParagraphXml(
  text: string,
  options?: {
    bold?: boolean;
    sizeHalfPt?: number;
    colorHex?: string;
    spaceBefore?: number;
    spaceAfter?: number;
    shadingHex?: string;
    align?: 'left' | 'center' | 'right';
  }
): string {
  const sz = options?.sizeHalfPt ?? 20;
  const color = options?.colorHex ?? '0F172A';
  const before = options?.spaceBefore ?? 0;
  const after = options?.spaceAfter ?? 80;
  const align = options?.align ?? 'left';
  const shadingXml = options?.shadingHex
    ? `<w:shd w:val="clear" w:color="auto" w:fill="${options.shadingHex}"/>`
    : '';
  const boldXml = options?.bold ? '<w:b/>' : '';

  return `<w:p><w:pPr><w:spacing w:before="${before}" w:after="${after}"/><w:jc w:val="${align}"/>${shadingXml}</w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>${boldXml}<w:color w:val="${color}"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${escapeXml(
    text
  )}</w:t></w:r></w:p>`;
}

function computeNormalizedDxaWidths(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
  totalTableDxa: number,
  explicitWidths?: number[]
): number[] {
  const count = Math.max(1, headers.length);
  const weights = headers.map((h, idx) => {
    if (explicitWidths && explicitWidths[idx] && explicitWidths[idx] > 0) {
      return explicitWidths[idx];
    }
    let maxLen = h.length;
    for (let r = 0; r < Math.min(rows.length, 40); r++) {
      const cellStr = String(rows[r]?.[idx] ?? '');
      if (cellStr.length > maxLen) maxLen = cellStr.length;
    }
    return Math.max(8, Math.min(44, maxLen));
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0) || count;
  const widths = weights.map((w) => Math.max(480, Math.floor((w / totalWeight) * totalTableDxa)));
  const currentSum = widths.reduce((a, b) => a + b, 0);
  widths[widths.length - 1] += totalTableDxa - currentSum;
  return widths;
}

function buildDocxTableXml(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
  totalTableDxa: number,
  explicitWidths?: number[]
): string {
  if (headers.length === 0) return '';
  const colWidths = computeNormalizedDxaWidths(headers, rows, totalTableDxa, explicitWidths);
  const gridColsXml = colWidths.map((w) => `<w:gridCol w:w="${w}"/>`).join('');

  const headerFontHalfPt = headers.length >= 10 ? 15 : headers.length >= 7 ? 17 : 18;
  const cellFontHalfPt = headers.length >= 10 ? 15 : headers.length >= 7 ? 17 : 18;

  const headerCellsXml = headers
    .map(
      (h, idx) => `<w:tc>
  <w:tcPr>
    <w:tcW w:w="${colWidths[idx]}" w:type="dxa"/>
    <w:shd w:val="clear" w:color="auto" w:fill="081326"/>
    <w:vAlign w:val="center"/>
  </w:tcPr>
  <w:p>
    <w:pPr><w:spacing w:before="30" w:after="30"/></w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="${headerFontHalfPt}"/><w:szCs w:val="${headerFontHalfPt}"/></w:rPr>
      <w:t xml:space="preserve">${escapeXml(h)}</w:t>
    </w:r>
  </w:p>
</w:tc>`
    )
    .join('');

  const headerRowXml = `<w:tr><w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>${headerCellsXml}</w:tr>`;

  const safeRows =
    rows.length > 0
      ? rows
      : [headers.map((_, idx) => (idx === 0 ? 'Nenhum registro encontrado.' : '—'))];

  const bodyRowsXml = safeRows
    .map((row, rowIdx) => {
      const fill = rowIdx % 2 === 1 ? 'F3F6FB' : 'FFFFFF';
      const cellsXml = headers
        .map((_, colIdx) => {
          const val = row[colIdx];
          const textVal = val === null || val === undefined || val === '' ? '—' : String(val);
          return `<w:tc>
  <w:tcPr>
    <w:tcW w:w="${colWidths[colIdx]}" w:type="dxa"/>
    <w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>
    <w:vAlign w:val="center"/>
  </w:tcPr>
  <w:p>
    <w:pPr><w:spacing w:before="25" w:after="25"/></w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:color w:val="0F172A"/><w:sz w:val="${cellFontHalfPt}"/><w:szCs w:val="${cellFontHalfPt}"/></w:rPr>
      <w:t xml:space="preserve">${escapeXml(textVal)}</w:t>
    </w:r>
  </w:p>
</w:tc>`;
        })
        .join('');
      return `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cellsXml}</w:tr>`;
    })
    .join('');

  return `<w:tbl>
  <w:tblPr>
    <w:tblW w:w="${totalTableDxa}" w:type="dxa"/>
    <w:tblLayout w:type="fixed"/>
    <w:tblBorders>
      <w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
      <w:bottom w:val="single" w:sz="6" w:space="0" w:color="081326"/>
      <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
      <w:left w:val="none"/>
      <w:right w:val="none"/>
      <w:insideV w:val="none"/>
    </w:tblBorders>
    <w:tblCellMar>
      <w:top w:w="65" w:type="dxa"/>
      <w:left w:w="90" w:type="dxa"/>
      <w:bottom w:w="65" w:type="dxa"/>
      <w:right w:w="90" w:type="dxa"/>
    </w:tblCellMar>
  </w:tblPr>
  <w:tblGrid>${gridColsXml}</w:tblGrid>
  ${headerRowXml}
  ${bodyRowsXml}
</w:tbl>`;
}

export function buildDocxBytes(report: UniversalExportReport): Uint8Array {
  const landscape = shouldUseLandscape(report);
  // A4: 11906 x 16838 dxa. Margins: 720 dxa (~1.27 cm) -> usable 10466 (portrait) or 15398 (landscape)
  const pageW = landscape ? 16838 : 11906;
  const pageH = landscape ? 11906 : 16838;
  const margin = 720;
  const usableW = pageW - margin * 2;
  const generatedAt = formatNowBr();

  const bodyParts: string[] = [];

  // Cabeçalho institucional em tabela navy
  const bannerXml = `<w:tbl>
  <w:tblPr>
    <w:tblW w:w="${usableW}" w:type="dxa"/>
    <w:tblBorders>
      <w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/>
    </w:tblBorders>
    <w:tblCellMar>
      <w:top w:w="140" w:type="dxa"/><w:left w:w="180" w:type="dxa"/><w:bottom w:w="140" w:type="dxa"/><w:right w:w="180" w:type="dxa"/>
    </w:tblCellMar>
  </w:tblPr>
  <w:tblGrid><w:gridCol w:w="${usableW}"/></w:tblGrid>
  <w:tr>
    <w:tc>
      <w:tcPr><w:tcW w:w="${usableW}" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="081326"/></w:tcPr>
      ${buildDocxParagraphXml(report.schoolName || SCHOOL_HEADER_DEFAULT, {
        bold: true,
        sizeHalfPt: 18,
        colorHex: '93C5FD',
        spaceAfter: 40,
      })}
      ${buildDocxParagraphXml(report.title, {
        bold: true,
        sizeHalfPt: 30,
        colorHex: 'FFFFFF',
        spaceAfter: 40,
      })}
      ${
        report.subtitle
          ? buildDocxParagraphXml(report.subtitle, {
              bold: false,
              sizeHalfPt: 20,
              colorHex: 'E2E8F0',
              spaceAfter: 40,
            })
          : ''
      }
      ${buildDocxParagraphXml(
        `Gerado em ${generatedAt}${report.generatedBy ? ` · Por ${report.generatedBy}` : ''}`,
        {
          bold: false,
          sizeHalfPt: 17,
          colorHex: 'CBD5E1',
          spaceAfter: 0,
        }
      )}
    </w:tc>
  </w:tr>
</w:tbl>`;
  bodyParts.push(bannerXml);

  // Metadados (se houver)
  if (report.metadata && report.metadata.length > 0) {
    bodyParts.push(
      buildDocxParagraphXml(
        report.metadata.map((m) => `${m.label}: ${m.value}`).join('   |   '),
        {
          sizeHalfPt: 18,
          colorHex: '334155',
          spaceBefore: 120,
          spaceAfter: 60,
          shadingHex: 'F3F6FB',
        }
      )
    );
  }

  // Métricas Resumo em grade horizontal
  if (report.summaryMetrics && report.summaryMetrics.length > 0) {
    const metrics = report.summaryMetrics;
    const colW = Math.floor(usableW / metrics.length);
    const metricGridCols = metrics.map(() => `<w:gridCol w:w="${colW}"/>`).join('');
    const metricCells = metrics
      .map(
        (m) => `<w:tc>
  <w:tcPr>
    <w:tcW w:w="${colW}" w:type="dxa"/>
    <w:shd w:val="clear" w:color="auto" w:fill="EEF3F9"/>
  </w:tcPr>
  ${buildDocxParagraphXml(m.label.toUpperCase(), {
    bold: true,
    sizeHalfPt: 15,
    colorHex: '475569',
    spaceAfter: 20,
  })}
  ${buildDocxParagraphXml(m.value, {
    bold: true,
    sizeHalfPt: 24,
    colorHex: '0E3A8A',
    spaceAfter: m.detail ? 20 : 0,
  })}
  ${
    m.detail
      ? buildDocxParagraphXml(m.detail, {
          sizeHalfPt: 15,
          colorHex: '475569',
          spaceAfter: 0,
        })
      : ''
  }
</w:tc>`
      )
      .join('');

    bodyParts.push(
      buildDocxParagraphXml('', { spaceBefore: 60, spaceAfter: 0 }),
      `<w:tbl>
  <w:tblPr>
    <w:tblW w:w="${usableW}" w:type="dxa"/>
    <w:tblBorders>
      <w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/>
      <w:insideH w:val="none"/><w:insideV w:val="single" w:sz="8" w:space="0" w:color="FFFFFF"/>
    </w:tblBorders>
    <w:tblCellMar>
      <w:top w:w="90" w:type="dxa"/><w:left w:w="110" w:type="dxa"/><w:bottom w:w="90" w:type="dxa"/><w:right w:w="110" w:type="dxa"/>
    </w:tblCellMar>
  </w:tblPr>
  <w:tblGrid>${metricGridCols}</w:tblGrid>
  <w:tr>${metricCells}</w:tr>
</w:tbl>`
    );
  }

  // Tabelas das seções
  report.sheets.forEach((sheet, idx) => {
    const headingText = sheet.sectionTitle || sheet.sheetName;
    if (headingText) {
      bodyParts.push(
        buildDocxParagraphXml(headingText, {
          bold: true,
          sizeHalfPt: 24,
          colorHex: '071E46',
          spaceBefore: idx === 0 ? 180 : 220,
          spaceAfter: 80,
        })
      );
    }

    // Se houver muitas colunas (> 12) em Word, divide em blocos legíveis mantendo as 2 primeiras colunas de identificação
    if (sheet.headers.length > 12) {
      const idCols = Math.min(2, sheet.headers.length);
      const chunkPayload = 9;
      for (let start = idCols; start < sheet.headers.length; start += chunkPayload) {
        const end = Math.min(sheet.headers.length, start + chunkPayload);
        const subIndices = [
          ...Array.from({ length: idCols }, (_, k) => k),
          ...Array.from({ length: end - start }, (_, k) => start + k),
        ];
        const subHeaders = subIndices.map((i) => sheet.headers[i]);
        const subRows = sheet.rows.map((r) => subIndices.map((i) => r[i]));
        const subWidths = sheet.columnWidths
          ? subIndices.map((i) => sheet.columnWidths![i])
          : undefined;
        bodyParts.push(
          buildDocxParagraphXml(
            `Bloco de colunas ${start + 1}–${end} de ${sheet.headers.length}`,
            {
              bold: true,
              sizeHalfPt: 17,
              colorHex: '475569',
              spaceBefore: 100,
              spaceAfter: 40,
            }
          ),
          buildDocxTableXml(subHeaders, subRows, usableW, subWidths)
        );
      }
    } else {
      bodyParts.push(
        buildDocxTableXml(sheet.headers, sheet.rows, usableW, sheet.columnWidths)
      );
    }
  });

  // Rodapé LGPD
  bodyParts.push(
    buildDocxParagraphXml(report.lgpdNotice || DEFAULT_LGPD_NOTICE, {
      sizeHalfPt: 16,
      colorHex: '475569',
      spaceBefore: 200,
      spaceAfter: 0,
    })
  );

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyParts.join('\n')}
    <w:sectPr>
      <w:pgSz w:w="${pageW}" w:h="${pageH}"${landscape ? ' w:orient="landscape"' : ''}/>
      <w:pgMar w:top="${margin}" w:right="${margin}" w:bottom="${margin}" w:left="${margin}" w:header="450" w:footer="450" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="20"/>
        <w:szCs w:val="20"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>`;

  const encoder = new TextEncoder();
  return buildStoredZip([
    { name: '[Content_Types].xml', data: encoder.encode(contentTypesXml) },
    { name: '_rels/.rels', data: encoder.encode(relsXml) },
    { name: 'word/_rels/document.xml.rels', data: encoder.encode(docRelsXml) },
    { name: 'word/styles.xml', data: encoder.encode(stylesXml) },
    { name: 'word/document.xml', data: encoder.encode(documentXml) },
  ]);
}

// ============================================================================
// GERADOR PDF MULTI-PÁGINA COM PDF-LIB
// ============================================================================

function wrapTextLines(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const safe = toWinAnsiSafeText(text);
  if (!safe) return ['-'];
  const effectiveMax = Math.max(18, maxWidth);
  const words = safe.split(' ');
  const lines: string[] = [];
  let current = '';

  const pushLongWord = (word: string) => {
    let chunk = '';
    for (const ch of word) {
      const candidate = chunk + ch;
      if (font.widthOfTextAtSize(candidate, fontSize) > effectiveMax && chunk.length > 0) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk = candidate;
      }
    }
    if (chunk) current = chunk;
  };

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= effectiveMax) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
        current = '';
      }
      if (font.widthOfTextAtSize(word, fontSize) > effectiveMax) {
        pushLongWord(word);
      } else {
        current = word;
      }
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : ['-'];
}

function computePdfColumnWidths(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
  usableWidth: number,
  explicitWidths?: number[]
): number[] {
  const count = Math.max(1, headers.length);
  const weights = headers.map((h, idx) => {
    if (explicitWidths && explicitWidths[idx] && explicitWidths[idx] > 0) {
      return explicitWidths[idx];
    }
    let maxLen = h.length;
    for (let r = 0; r < Math.min(rows.length, 40); r++) {
      const len = String(rows[r]?.[idx] ?? '').length;
      if (len > maxLen) maxLen = len;
    }
    return Math.max(7, Math.min(42, maxLen));
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0) || count;
  const minColW = Math.min(42, usableWidth / count);
  const widths = weights.map((w) => Math.max(minColW, (w / totalWeight) * usableWidth));
  const sum = widths.reduce((a, b) => a + b, 0);
  const scale = usableWidth / sum;
  return widths.map((w) => w * scale);
}

export async function buildPdfBytes(report: UniversalExportReport): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const landscape = shouldUseLandscape(report);
  const pageWidth = landscape ? 841.89 : 595.28;
  const pageHeight = landscape ? 595.28 : 841.89;
  const marginX = 34;
  const marginTop = 34;
  const marginBottom = 40;
  const usableWidth = pageWidth - marginX * 2;
  const generatedAt = formatNowBr();

  const navy = rgb(8 / 255, 19 / 255, 38 / 255);
  const cobalt = rgb(20 / 255, 66 / 255, 140 / 255);
  const lightSky = rgb(147 / 255, 197 / 255, 253 / 255);
  const softBlueBg = rgb(238 / 255, 243 / 255, 249 / 255);
  const zebraBg = rgb(243 / 255, 246 / 255, 251 / 255);
  const white = rgb(1, 1, 1);
  const textPrimary = rgb(15 / 255, 23 / 255, 42 / 255);
  const textSecondary = rgb(71 / 255, 85 / 255, 105 / 255);
  const dividerColor = rgb(226 / 255, 232 / 255, 240 / 255);

  const pages: PDFPage[] = [];
  let page = doc.addPage([pageWidth, pageHeight]);
  pages.push(page);
  let cursorY = pageHeight - marginTop;

  const drawContinuationHeader = () => {
    page.drawRectangle({
      x: marginX,
      y: pageHeight - marginTop - 24,
      width: usableWidth,
      height: 24,
      color: navy,
    });
    page.drawText(toWinAnsiSafeText(report.title), {
      x: marginX + 10,
      y: pageHeight - marginTop - 16,
      size: 9.5,
      font: fontBold,
      color: white,
    });
    page.drawText(toWinAnsiSafeText(generatedAt), {
      x: pageWidth - marginX - 95,
      y: pageHeight - marginTop - 16,
      size: 8.5,
      font: fontRegular,
      color: lightSky,
    });
    cursorY = pageHeight - marginTop - 36;
  };

  const startNewPage = () => {
    page = doc.addPage([pageWidth, pageHeight]);
    pages.push(page);
    drawContinuationHeader();
  };

  const ensureSpace = (neededHeight: number) => {
    if (cursorY - neededHeight < marginBottom) {
      startNewPage();
    }
  };

  // Banner principal na página 1
  const titleLines = wrapTextLines(report.title, fontBold, 14.5, usableWidth - 24);
  const subtitleLines = report.subtitle
    ? wrapTextLines(report.subtitle, fontRegular, 9.5, usableWidth - 24)
    : [];
  const bannerHeight = 36 + titleLines.length * 17 + subtitleLines.length * 13 + 16;

  page.drawRectangle({
    x: marginX,
    y: cursorY - bannerHeight,
    width: usableWidth,
    height: bannerHeight,
    color: navy,
  });

  let bannerTextY = cursorY - 16;
  page.drawText(toWinAnsiSafeText(report.schoolName || SCHOOL_HEADER_DEFAULT), {
    x: marginX + 12,
    y: bannerTextY,
    size: 8.5,
    font: fontBold,
    color: lightSky,
  });
  bannerTextY -= 17;

  for (const line of titleLines) {
    page.drawText(line, {
      x: marginX + 12,
      y: bannerTextY,
      size: 14.5,
      font: fontBold,
      color: white,
    });
    bannerTextY -= 17;
  }

  for (const line of subtitleLines) {
    page.drawText(line, {
      x: marginX + 12,
      y: bannerTextY,
      size: 9.5,
      font: fontRegular,
      color: rgb(226 / 255, 232 / 255, 240 / 255),
    });
    bannerTextY -= 13;
  }

  page.drawText(
    toWinAnsiSafeText(
      `Gerado em ${generatedAt}${report.generatedBy ? ` · Por ${report.generatedBy}` : ''}`
    ),
    {
      x: marginX + 12,
      y: cursorY - bannerHeight + 10,
      size: 8,
      font: fontRegular,
      color: rgb(203 / 255, 213 / 255, 225 / 255),
    }
  );
  cursorY -= bannerHeight + 10;

  // Metadados
  if (report.metadata && report.metadata.length > 0) {
    const metaStr = report.metadata.map((m) => `${m.label}: ${m.value}`).join('  |  ');
    const metaLines = wrapTextLines(metaStr, fontRegular, 8.5, usableWidth - 16);
    const metaBoxH = metaLines.length * 12 + 10;
    ensureSpace(metaBoxH);
    page.drawRectangle({
      x: marginX,
      y: cursorY - metaBoxH,
      width: usableWidth,
      height: metaBoxH,
      color: zebraBg,
    });
    let my = cursorY - 12;
    for (const ml of metaLines) {
      page.drawText(ml, {
        x: marginX + 8,
        y: my,
        size: 8.5,
        font: fontRegular,
        color: textPrimary,
      });
      my -= 12;
    }
    cursorY -= metaBoxH + 8;
  }

  // Cartões de Métricas Resumo
  if (report.summaryMetrics && report.summaryMetrics.length > 0) {
    const metrics = report.summaryMetrics.slice(0, 6);
    const gap = 6;
    const cardW = (usableWidth - gap * (metrics.length - 1)) / metrics.length;
    const cardH = 42;
    ensureSpace(cardH + 8);
    metrics.forEach((m, idx) => {
      const cx = marginX + idx * (cardW + gap);
      page.drawRectangle({
        x: cx,
        y: cursorY - cardH,
        width: cardW,
        height: cardH,
        color: softBlueBg,
      });
      const labelLines = wrapTextLines(m.label.toUpperCase(), fontBold, 6.8, cardW - 10);
      page.drawText(labelLines[0] || '', {
        x: cx + 6,
        y: cursorY - 11,
        size: 6.8,
        font: fontBold,
        color: textSecondary,
      });
      const valLines = wrapTextLines(m.value, fontBold, 11.5, cardW - 10);
      page.drawText(valLines[0] || '-', {
        x: cx + 6,
        y: cursorY - 25,
        size: 11.5,
        font: fontBold,
        color: cobalt,
      });
      if (m.detail) {
        const detLines = wrapTextLines(m.detail, fontRegular, 6.8, cardW - 10);
        page.drawText(detLines[0] || '', {
          x: cx + 6,
          y: cursorY - 36,
          size: 6.8,
          font: fontRegular,
          color: textSecondary,
        });
      }
    });
    cursorY -= cardH + 12;
  }

  // Renderização das tabelas de cada seção
  const renderTableSection = (
    sectionTitle: string | undefined,
    headers: string[],
    rows: (string | number | boolean | null | undefined)[][],
    explicitWidths?: number[]
  ) => {
    if (headers.length === 0) return;

    if (sectionTitle) {
      ensureSpace(44);
      page.drawText(toWinAnsiSafeText(sectionTitle), {
        x: marginX,
        y: cursorY - 12,
        size: 11,
        font: fontBold,
        color: navy,
      });
      cursorY -= 18;
    }

    const colWidths = computePdfColumnWidths(headers, rows, usableWidth, explicitWidths);
    const fontSize = headers.length >= 10 ? 7 : headers.length >= 7 ? 7.5 : 8.2;
    const lineHeight = fontSize + 2.4;
    const padX = 4;
    const padY = 4;

    const wrappedHeaders = headers.map((h, i) =>
      wrapTextLines(h, fontBold, fontSize, colWidths[i] - padX * 2)
    );
    const headerMaxLines = Math.max(1, ...wrappedHeaders.map((l) => l.length));
    const headerHeight = headerMaxLines * lineHeight + padY * 2;

    const drawTableHeader = () => {
      ensureSpace(headerHeight + 18);
      page.drawRectangle({
        x: marginX,
        y: cursorY - headerHeight,
        width: usableWidth,
        height: headerHeight,
        color: navy,
      });
      let colX = marginX;
      wrappedHeaders.forEach((lines, cIdx) => {
        let lineY = cursorY - padY - fontSize;
        for (const l of lines) {
          page.drawText(l, {
            x: colX + padX,
            y: lineY,
            size: fontSize,
            font: fontBold,
            color: white,
          });
          lineY -= lineHeight;
        }
        colX += colWidths[cIdx];
      });
      cursorY -= headerHeight;
    };

    drawTableHeader();

    const safeRows =
      rows.length > 0
        ? rows
        : [headers.map((_, idx) => (idx === 0 ? 'Nenhum registro encontrado.' : '-'))];

    safeRows.forEach((row, rIdx) => {
      const wrappedCells = headers.map((_, cIdx) => {
        const val = row[cIdx];
        const cellText = val === null || val === undefined || val === '' ? '-' : String(val);
        return wrapTextLines(cellText, fontRegular, fontSize, colWidths[cIdx] - padX * 2);
      });
      const maxCellLines = Math.max(1, ...wrappedCells.map((c) => c.length));
      const rowHeight = Math.min(180, maxCellLines * lineHeight + padY * 2);

      if (cursorY - rowHeight < marginBottom) {
        startNewPage();
        drawTableHeader();
      }

      if (rIdx % 2 === 1) {
        page.drawRectangle({
          x: marginX,
          y: cursorY - rowHeight,
          width: usableWidth,
          height: rowHeight,
          color: zebraBg,
        });
      }

      let colX = marginX;
      wrappedCells.forEach((lines, cIdx) => {
        let lineY = cursorY - padY - fontSize;
        for (const l of lines.slice(0, 14)) {
          page.drawText(l, {
            x: colX + padX,
            y: lineY,
            size: fontSize,
            font: fontRegular,
            color: textPrimary,
          });
          lineY -= lineHeight;
        }
        colX += colWidths[cIdx];
      });

      page.drawLine({
        start: { x: marginX, y: cursorY - rowHeight },
        end: { x: marginX + usableWidth, y: cursorY - rowHeight },
        thickness: 0.5,
        color: dividerColor,
      });

      cursorY -= rowHeight;
    });

    cursorY -= 12;
  };

  for (const sheet of report.sheets) {
    const title = sheet.sectionTitle || sheet.sheetName;
    if (sheet.headers.length > 11) {
      // Particiona tabelas muito largas em blocos legíveis mantendo as 2 primeiras colunas chave
      const idCols = Math.min(2, sheet.headers.length);
      const chunkSize = 8;
      let blockIdx = 1;
      for (let start = idCols; start < sheet.headers.length; start += chunkSize) {
        const end = Math.min(sheet.headers.length, start + chunkSize);
        const indices = [
          ...Array.from({ length: idCols }, (_, k) => k),
          ...Array.from({ length: end - start }, (_, k) => start + k),
        ];
        const subTitle = `${title} (Parte ${blockIdx}: colunas ${start + 1}-${end})`;
        const subHeaders = indices.map((i) => sheet.headers[i]);
        const subRows = sheet.rows.map((r) => indices.map((i) => r[i]));
        const subWidths = sheet.columnWidths
          ? indices.map((i) => sheet.columnWidths![i])
          : undefined;
        renderTableSection(subTitle, subHeaders, subRows, subWidths);
        blockIdx++;
      }
    } else {
      renderTableSection(title, sheet.headers, sheet.rows, sheet.columnWidths);
    }
  }

  // Numeração de páginas e rodapé LGPD em todas as páginas
  const totalPages = pages.length;
  const footerText = toWinAnsiSafeText(report.lgpdNotice || DEFAULT_LGPD_NOTICE);
  pages.forEach((p, idx) => {
    p.drawLine({
      start: { x: marginX, y: 28 },
      end: { x: pageWidth - marginX, y: 28 },
      thickness: 0.6,
      color: dividerColor,
    });
    p.drawText(footerText.slice(0, 120), {
      x: marginX,
      y: 16,
      size: 7.2,
      font: fontRegular,
      color: textSecondary,
    });
    const pageStr = `Pagina ${idx + 1} de ${totalPages}`;
    const pageStrWidth = fontBold.widthOfTextAtSize(pageStr, 7.8);
    p.drawText(pageStr, {
      x: pageWidth - marginX - pageStrWidth,
      y: 16,
      size: 7.8,
      font: fontBold,
      color: navy,
    });
  });

  return await doc.save();
}

// ============================================================================
// GERADORES EXCEL (.XLSX / .XLS) E CSV
// ============================================================================

function toSafeSheetName(raw: string, usedNames: Set<string>): string {
  const cleaned = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\/*?:[\]]/g, '_')
    .trim();
  const base = (cleaned || 'Planilha').slice(0, 28);
  let candidate = base.slice(0, 31);
  let counter = 2;
  while (usedNames.has(candidate)) {
    candidate = `${base.slice(0, 27)}_${counter}`;
    counter++;
  }
  usedNames.add(candidate);
  return candidate;
}

export async function buildWorkbookBytes(
  report: UniversalExportReport,
  format: 'xlsx' | 'xls' = 'xlsx'
): Promise<Uint8Array> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>();

  if (report.summaryMetrics && report.summaryMetrics.length > 0) {
    const summaryObjects = [
      { INDICADOR: 'TÍTULO', VALOR: report.title, DETALHE: report.subtitle || '' },
      {
        INDICADOR: 'INSTITUIÇÃO',
        VALOR: report.schoolName || SCHOOL_HEADER_DEFAULT,
        DETALHE: `Gerado em ${formatNowBr()}`,
      },
      ...report.summaryMetrics.map((m) => ({
        INDICADOR: sanitizeSpreadsheetCell(m.label),
        VALOR: sanitizeSpreadsheetCell(m.value),
        DETALHE: sanitizeSpreadsheetCell(m.detail || ''),
      })),
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryObjects);
    wsSummary['!cols'] = [{ wch: 28 }, { wch: 26 }, { wch: 48 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, toSafeSheetName('Resumo', usedNames));
  }

  report.sheets.forEach((sheet, idx) => {
    const aoa: (string | number)[][] = [
      sheet.headers.map((h) => sanitizeSpreadsheetCell(h)),
      ...sheet.rows.map((r) =>
        sheet.headers.map((_, colIdx) => sanitizeSpreadsheetCell(r[colIdx]))
      ),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = sheet.headers.map((h, colIdx) => {
      if (sheet.columnWidths && sheet.columnWidths[colIdx]) {
        return { wch: sheet.columnWidths[colIdx] };
      }
      let maxLen = h.length + 2;
      for (let r = 0; r < Math.min(sheet.rows.length, 50); r++) {
        const len = String(sheet.rows[r]?.[colIdx] ?? '').length + 2;
        if (len > maxLen) maxLen = len;
      }
      return { wch: Math.max(12, Math.min(48, maxLen)) };
    });
    XLSX.utils.book_append_sheet(
      wb,
      ws,
      toSafeSheetName(sheet.sheetName || `Dados_${idx + 1}`, usedNames)
    );
  });

  const arrayOut = XLSX.write(wb, {
    type: 'array',
    bookType: format === 'xls' ? 'biff8' : 'xlsx',
  }) as ArrayBuffer | Uint8Array;
  return arrayOut instanceof Uint8Array ? arrayOut : new Uint8Array(arrayOut);
}

export function buildCsvString(report: UniversalExportReport): string {
  const primary = report.sheets[0];
  if (!primary) return '';
  const escapeCsv = (val: unknown) => {
    const safe = sanitizeSpreadsheetCell(
      val as string | number | boolean | null | undefined
    );
    return `"${String(safe).replace(/"/g, '""')}"`;
  };
  const lines = [
    primary.headers.map(escapeCsv).join(';'),
    ...primary.rows.map((row) =>
      primary.headers.map((_, i) => escapeCsv(row[i])).join(';')
    ),
  ];
  return '\uFEFF' + lines.join('\r\n');
}

// ============================================================================
// DISPATCHER UNIVERSAL & DOWNLOAD NO NAVEGADOR
// ============================================================================

export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function exportUniversalReport(
  report: UniversalExportReport,
  format: UniversalExportFormat
): Promise<string> {
  const baseName = sanitizeFileNameBase(report.fileNameBase);
  const finalFileName = `${baseName}.${format}`;

  if (format === 'docx') {
    const bytes = buildDocxBytes(report);
    const blob = new Blob([bytes.buffer as ArrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    triggerBlobDownload(blob, finalFileName);
    return finalFileName;
  }

  if (format === 'pdf') {
    const bytes = await buildPdfBytes(report);
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    triggerBlobDownload(blob, finalFileName);
    return finalFileName;
  }

  if (format === 'xlsx' || format === 'xls') {
    const bytes = await buildWorkbookBytes(report, format);
    const mime =
      format === 'xls'
        ? 'application/vnd.ms-excel'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: mime });
    triggerBlobDownload(blob, finalFileName);
    return finalFileName;
  }

  const csv = buildCsvString(report);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  triggerBlobDownload(blob, finalFileName);
  return finalFileName;
}
