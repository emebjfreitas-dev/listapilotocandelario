/**
 * Utilitário oficial de constantes e funções de formatação para padronizar
 * as abreviações de dias letivos, faltas e frequências em todo o app.
 *
 * Padrão adotado:
 * - DL = Dias Letivos
 * - F = Faltas
 * - P = Presenças
 * - Freq. = Frequência
 * - At. = Atestados
 * - FJ = Faltas Justificadas
 * - FNJ = Faltas Não Justificadas
 */

export const ATTENDANCE_ABBREVIATIONS = {
  DIAS_LETIVOS: 'DL',
  DIAS_LETIVOS_FULL: 'Dias Letivos',
  FALTAS: 'F',
  FALTAS_FULL: 'Faltas',
  PRESENCAS: 'P',
  PRESENCAS_FULL: 'Presenças',
  FREQUENCIA: 'Freq.',
  FREQUENCIA_FULL: 'Frequência',
  ATESTADOS: 'At.',
  ATESTADOS_FULL: 'Atestados',
  FALTAS_JUSTIFICADAS: 'FJ',
  FALTAS_JUSTIFICADAS_FULL: 'Faltas Justificadas',
  FALTAS_NAO_JUSTIFICADAS: 'FNJ',
  FALTAS_NAO_JUSTIFICADAS_FULL: 'Faltas Não Justificadas',
  PORCENTAGEM_FREQUENCIA: '% Freq.',
  PORCENTAGEM_FALTAS: '% Faltas',
} as const;

export type AttendanceMetricType = 'DL' | 'F' | 'P' | 'Freq' | 'At' | 'FJ' | 'FNJ';

/**
 * Retorna a abreviação padronizada correspondente a uma métrica de frequência.
 */
export function getAttendanceAbbr(type: AttendanceMetricType): string {
  switch (type) {
    case 'DL':
      return ATTENDANCE_ABBREVIATIONS.DIAS_LETIVOS;
    case 'F':
      return ATTENDANCE_ABBREVIATIONS.FALTAS;
    case 'P':
      return ATTENDANCE_ABBREVIATIONS.PRESENCAS;
    case 'Freq':
      return ATTENDANCE_ABBREVIATIONS.FREQUENCIA;
    case 'At':
      return ATTENDANCE_ABBREVIATIONS.ATESTADOS;
    case 'FJ':
      return ATTENDANCE_ABBREVIATIONS.FALTAS_JUSTIFICADAS;
    case 'FNJ':
      return ATTENDANCE_ABBREVIATIONS.FALTAS_NAO_JUSTIFICADAS;
    default:
      return '';
  }
}

/**
 * Retorna o rótulo por extenso correspondente a uma métrica.
 */
export function getAttendanceFullLabel(type: AttendanceMetricType): string {
  switch (type) {
    case 'DL':
      return ATTENDANCE_ABBREVIATIONS.DIAS_LETIVOS_FULL;
    case 'F':
      return ATTENDANCE_ABBREVIATIONS.FALTAS_FULL;
    case 'P':
      return ATTENDANCE_ABBREVIATIONS.PRESENCAS_FULL;
    case 'Freq':
      return ATTENDANCE_ABBREVIATIONS.FREQUENCIA_FULL;
    case 'At':
      return ATTENDANCE_ABBREVIATIONS.ATESTADOS_FULL;
    case 'FJ':
      return ATTENDANCE_ABBREVIATIONS.FALTAS_JUSTIFICADAS_FULL;
    case 'FNJ':
      return ATTENDANCE_ABBREVIATIONS.FALTAS_NAO_JUSTIFICADAS_FULL;
    default:
      return '';
  }
}

/**
 * Formata Dias Letivos no padrão conciso: ex: "20 DL" ou "DL: 20"
 */
export function formatDL(value: number, prefix: boolean = false): string {
  const safeVal = Math.max(0, Math.round(value || 0));
  return prefix ? `DL: ${safeVal}` : `${safeVal} DL`;
}

/**
 * Formata Faltas no padrão conciso: ex: "2 F" ou "F: 2"
 */
export function formatFaltas(value: number, prefix: boolean = false): string {
  const safeVal = Math.max(0, Math.round(value || 0));
  return prefix ? `F: ${safeVal}` : `${safeVal} F`;
}

/**
 * Formata Presenças no padrão conciso: ex: "18 P" ou "P: 18"
 */
export function formatPresencas(value: number, prefix: boolean = false): string {
  const safeVal = Math.max(0, Math.round(value || 0));
  return prefix ? `P: ${safeVal}` : `${safeVal} P`;
}

/**
 * Formata Atestados no padrão conciso: ex: "1 At." ou "At: 1"
 */
export function formatAtestados(value: number, prefix: boolean = false): string {
  const safeVal = Math.max(0, Math.round(value || 0));
  return prefix ? `At: ${safeVal}` : `${safeVal} At.`;
}

/**
 * Formata porcentagem de frequência no padrão conciso: ex: "90% Freq." ou "Freq: 90%"
 */
export function formatFreqPercent(percent: number, prefix: boolean = false): string {
  const safeVal = Math.max(0, Math.min(100, Math.round(percent || 0)));
  return prefix ? `Freq: ${safeVal}%` : `${safeVal}% Freq.`;
}

/**
 * Formata linha de métricas resumidas para cartões de turmas e estudantes:
 * Ex: "20 DL · 18 P · 2 F · 90% Freq."
 */
export function formatAttendanceSummaryLine(
  diasLetivos: number,
  presencas: number,
  faltas: number,
  freqPercent: number
): string {
  return `${formatDL(diasLetivos)} · ${formatPresencas(presencas)} · ${formatFaltas(faltas)} · ${formatFreqPercent(freqPercent)}`;
}
