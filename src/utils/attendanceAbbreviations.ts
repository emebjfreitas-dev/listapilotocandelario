/**
 * Utilitário oficial de constantes e funções de formatação para padronizar
 * os rótulos por extenso de dias letivos, faltas e frequências em todo o app.
 */

export const ATTENDANCE_ABBREVIATIONS = {
  DIAS_LETIVOS: 'Dias Letivos',
  DIAS_LETIVOS_FULL: 'Dias Letivos',
  FALTAS: 'Faltas',
  FALTAS_FULL: 'Faltas',
  PRESENCAS: 'Presenças',
  PRESENCAS_FULL: 'Presenças',
  FREQUENCIA: 'Frequência',
  FREQUENCIA_FULL: 'Frequência',
  ATESTADOS: 'Atestados',
  ATESTADOS_FULL: 'Atestados',
  FALTAS_JUSTIFICADAS: 'Faltas Justificadas',
  FALTAS_JUSTIFICADAS_FULL: 'Faltas Justificadas',
  FALTAS_NAO_JUSTIFICADAS: 'Faltas Não Justificadas',
  FALTAS_NAO_JUSTIFICADAS_FULL: 'Faltas Não Justificadas',
  PORCENTAGEM_FREQUENCIA: '% Frequência',
  PORCENTAGEM_FALTAS: '% Faltas',
} as const;

export type AttendanceMetricType = 'DL' | 'F' | 'P' | 'Freq' | 'At' | 'FJ' | 'FNJ';

/**
 * Retorna o rótulo por extenso correspondente a uma métrica de frequência.
 */
export function getAttendanceAbbr(type: AttendanceMetricType): string {
  return getAttendanceFullLabel(type);
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
 * Formata Dias Letivos por extenso: ex: "20 Dias Letivos" ou "Dias Letivos: 20"
 */
export function formatDL(value: number, prefix: boolean = false): string {
  const safeVal = Math.max(0, Math.round(value || 0));
  const unit = safeVal === 1 ? 'Dia Letivo' : 'Dias Letivos';
  return prefix ? `Dias Letivos: ${safeVal}` : `${safeVal} ${unit}`;
}

/**
 * Formata Faltas por extenso: ex: "2 Faltas" ou "Faltas: 2"
 */
export function formatFaltas(value: number, prefix: boolean = false): string {
  const safeVal = Math.max(0, Math.round(value || 0));
  const unit = safeVal === 1 ? 'Falta' : 'Faltas';
  return prefix ? `Faltas: ${safeVal}` : `${safeVal} ${unit}`;
}

/**
 * Formata Presenças por extenso: ex: "18 Presenças" ou "Presenças: 18"
 */
export function formatPresencas(value: number, prefix: boolean = false): string {
  const safeVal = Math.max(0, Math.round(value || 0));
  const unit = safeVal === 1 ? 'Presença' : 'Presenças';
  return prefix ? `Presenças: ${safeVal}` : `${safeVal} ${unit}`;
}

/**
 * Formata Atestados por extenso: ex: "1 Atestado" ou "Atestados: 1"
 */
export function formatAtestados(value: number, prefix: boolean = false): string {
  const safeVal = Math.max(0, Math.round(value || 0));
  const unit = safeVal === 1 ? 'Atestado' : 'Atestados';
  return prefix ? `Atestados: ${safeVal}` : `${safeVal} ${unit}`;
}

/**
 * Formata porcentagem de frequência por extenso: ex: "90% Frequência" ou "Frequência: 90%"
 */
export function formatFreqPercent(percent: number, prefix: boolean = false): string {
  const safeVal = Math.max(0, Math.min(100, Math.round(percent || 0)));
  return prefix ? `Frequência: ${safeVal}%` : `${safeVal}% Frequência`;
}

/**
 * Formata linha de métricas resumidas para cartões de turmas e estudantes:
 * Ex: "20 Dias Letivos · 18 Presenças · 2 Faltas · 90% Frequência"
 */
export function formatAttendanceSummaryLine(
  diasLetivos: number,
  presencas: number,
  faltas: number,
  freqPercent: number
): string {
  return `${formatDL(diasLetivos)} · ${formatPresencas(presencas)} · ${formatFaltas(faltas)} · ${formatFreqPercent(freqPercent)}`;
}
