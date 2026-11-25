import React, { useState, useMemo } from 'react';
import {
  AuthorizedUser,
  ClassGroup,
  ConsecutiveAbsenceOccurrence,
  Student,
  UserRole,
} from '../types';
import {
  AlertTriangle,
  CalendarX2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  MessageCircle,
  X,
} from 'lucide-react';
import { StudentAvatar } from './StudentAvatar';
import { getStudentCumulativeOccurrences } from '../services/pushNotificationService';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import { ModalPortal } from './ui/ModalPortal';

export interface CriticalAbsenceItem {
  cls: ClassGroup;
  student: Student;
  occurrences: ConsecutiveAbsenceOccurrence[];
  latestOccurrence?: ConsecutiveAbsenceOccurrence;
  consecutiveDaysCount: number;
  totalConsecutiveDaysYear: number;
  monthlyUnjustifiedAbsences: number;
  hasFamilyFeedback: boolean;
  familyFeedbackText: string;
}

interface ResumoFaltasCriticasCardProps {
  classes: ClassGroup[];
  userRole: UserRole;
  teacherRoleType?: AuthorizedUser['teacherRoleType'];
  defaultThreshold?: number;
  onSelectStudentForConsecutiveScreen?: (cls: ClassGroup, student: Student) => void;
  onOpenStudentGrid?: (
    student: Student,
    classId: string,
    className: string,
    diasLetivosMes: number
  ) => void;
  onOpenStudentPdf?: (student: Student, className: string) => void;
}

const THRESHOLD_STORAGE_KEY = 'emeb_candelario_critical_absence_threshold_2027';

export const ResumoFaltasCriticasCard: React.FC<ResumoFaltasCriticasCardProps> = ({
  classes,
  userRole,
  teacherRoleType,
  defaultThreshold = 3,
  onSelectStudentForConsecutiveScreen,
  onOpenStudentGrid,
  onOpenStudentPdf,
}) => {
  const isStrictAdmin =
    userRole === 'admin' && teacherRoleType !== 'apoio' && teacherRoleType !== 'aee';
  const isPeb1 = userRole === 'usuario';
  const [threshold, setThreshold] = useState<number>(() => {
    try {
      const saved = parseInt(localStorage.getItem(THRESHOLD_STORAGE_KEY) || '', 10);
      if ([3, 5, 10].includes(saved)) return saved;
    } catch {
      // ignore
    }
    return defaultThreshold;
  });

  const [statusFilter, setStatusFilter] = useState<
    'todos' | 'pendente_retorno' | 'com_retorno'
  >('todos');
  const [selectedDetailItem, setSelectedDetailItem] =
    useState<CriticalAbsenceItem | null>(null);
  const [showAllStudents, setShowAllStudents] = useState(false);

  useModalScrollLock(Boolean(selectedDetailItem));

  const handleUpdateThreshold = (nextVal: number) => {
    setThreshold(nextVal);
    try {
      localStorage.setItem(THRESHOLD_STORAGE_KEY, String(nextVal));
    } catch {
      // ignore
    }
  };

  // Identifica todos os estudantes que atingiram o limiar de faltas consecutivas configurado (ou faltas seguidas acumuladas)
  const criticalItems = useMemo(() => {
    const list: CriticalAbsenceItem[] = [];

    classes.forEach((cls) => {
      const activeStudents = cls.students.filter((s) => {
        const sit = (s.situacao || 'ATIVO').toUpperCase().trim();
        return (
          !sit.includes('BXTR') &&
          !sit.includes('TRANSF') &&
          !sit.includes('REMAN') &&
          !sit.includes('RM')
        );
      });

      activeStudents.forEach((student) => {
        const occurrences = getStudentCumulativeOccurrences(student);
        const latestOcc =
          occurrences.length > 0 ? occurrences[occurrences.length - 1] : undefined;

        const maxOccStreak = occurrences.reduce(
          (max, occ) => Math.max(max, occ.selectedDates?.length || 0),
          0
        );
        const totalConsecutiveDaysYear = occurrences.reduce(
          (sum, occ) => sum + (occ.selectedDates?.length || 0),
          0
        );

        const monthlyUnjustified = Math.max(
          0,
          (student.totalAbsencesMonth || 0) - (student.justifiedAbsences || 0)
        );

        // Estudante atinge o limiar quando possui ocorrência de faltas seguidas >= threshold
        // ou quando acumula faltas não justificadas no mês >= threshold
        const effectiveStreak =
          maxOccStreak > 0 ? maxOccStreak : monthlyUnjustified >= threshold ? monthlyUnjustified : 0;

        if (effectiveStreak >= threshold) {
          const feedbackText = (
            latestOcc?.familyFeedback ||
            student.consecutiveAbsenceAlert?.familyFeedback ||
            ''
          ).trim();

          list.push({
            cls,
            student,
            occurrences,
            latestOccurrence: latestOcc,
            consecutiveDaysCount: effectiveStreak,
            totalConsecutiveDaysYear:
              totalConsecutiveDaysYear > 0 ? totalConsecutiveDaysYear : effectiveStreak,
            monthlyUnjustifiedAbsences: monthlyUnjustified,
            hasFamilyFeedback: feedbackText.length > 0,
            familyFeedbackText: feedbackText,
          });
        }
      });
    });

    // Ordena priorizando quem ainda aguarda retorno da família e maior número de dias consecutivos
    return list.sort((a, b) => {
      if (a.hasFamilyFeedback !== b.hasFamilyFeedback) {
        return a.hasFamilyFeedback ? 1 : -1;
      }
      if (b.consecutiveDaysCount !== a.consecutiveDaysCount) {
        return b.consecutiveDaysCount - a.consecutiveDaysCount;
      }
      return a.student.name.localeCompare(b.student.name, 'pt-BR');
    });
  }, [classes, threshold]);

  const filteredItems = useMemo(() => {
    return criticalItems.filter((item) => {
      if (statusFilter === 'pendente_retorno') return !item.hasFamilyFeedback;
      if (statusFilter === 'com_retorno') return item.hasFamilyFeedback;
      return true;
    });
  }, [criticalItems, statusFilter]);

  const pendingFeedbackCount = useMemo(
    () => criticalItems.filter((i) => !i.hasFamilyFeedback).length,
    [criticalItems]
  );
  const withFeedbackCount = useMemo(
    () => criticalItems.filter((i) => i.hasFamilyFeedback).length,
    [criticalItems]
  );

  const visibleItems = showAllStudents ? filteredItems : filteredItems.slice(0, 6);

  return (
    <>
      <section className="bg-white rounded-3xl p-4 sm:p-5 border border-black/[0.06] shadow-sm space-y-4">
        {/* Cabeçalho do Resumo de Faltas Críticas */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-2">
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#D70015]">
              <AlertTriangle className="w-[18px] h-[18px] shrink-0" />
              <span>Busca Ativa Escolar · Monitoramento de Faltas Consecutivas</span>
              <span aria-hidden="true" className="text-[#86868B]">·</span>
              <span className="text-[#424245] font-mono tabular-nums">
                Limiar: {threshold}+ dias seguidos
              </span>
            </div>
            <h2 className="text-lg font-semibold text-[#1D1D1F] tracking-tight">
              Resumo de Faltas Críticas ({criticalItems.length})
            </h2>
            <p className="text-sm text-[#424245]">
              Alerta visual para cada estudante que atingiu o limiar de faltas seguidas. Clique sobre o estudante para inspecionar os dias faltosos, histórico anual e retorno da família.
            </p>
          </div>

          {/* Controles: Seletor de Limiar Configurado (3+, 5+, 10+ dias) & Filtros Rápidos */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="flex flex-wrap items-center gap-1 bg-[#F5F5F7] p-1 rounded-full border border-black/[0.06]">
              <span className="text-xs font-semibold text-[#424245] px-2.5">
                Limiar:
              </span>
              {[3, 5, 10].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleUpdateThreshold(val)}
                  className={`min-h-[32px] px-3 rounded-full text-xs font-semibold font-mono tabular-nums transition-all duration-150 active:scale-95 cursor-pointer whitespace-nowrap text-center ${
                    threshold === val
                      ? val === 10
                        ? 'bg-[#D70015] text-white shadow-2xs'
                        : val === 5
                        ? 'bg-[#B25000] text-white shadow-2xs'
                        : 'bg-[#0071E3] text-white shadow-2xs'
                      : 'text-[#424245] hover:text-[#1D1D1F] hover:bg-white/80'
                  }`}
                >
                  {val}+ dias
                </button>
              ))}
            </div>

            <div className="ios-segmented">
              <button
                type="button"
                onClick={() => setStatusFilter('todos')}
                className={`ios-segmented-item ${
                  statusFilter === 'todos' ? 'ios-segmented-item-active' : ''
                }`}
              >
                Todos ({criticalItems.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('pendente_retorno')}
                className={`ios-segmented-item ${
                  statusFilter === 'pendente_retorno' ? 'ios-segmented-item-active' : ''
                }`}
              >
                Sem Retorno ({pendingFeedbackCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('com_retorno')}
                className={`ios-segmented-item ${
                  statusFilter === 'com_retorno' ? 'ios-segmented-item-active' : ''
                }`}
              >
                Com Feedback ({withFeedbackCount})
              </button>
            </div>
          </div>
        </div>

        {/* Lista de Cards de Alerta Visual por Estudante */}
        {filteredItems.length === 0 ? (
          <div className="py-6 px-4 text-center bg-[#F5F5F7] rounded-2xl border border-black/[0.05] space-y-1">
            <p className="text-sm font-semibold text-[#1D1D1F]">
              Nenhum estudante atingiu o limiar de {threshold}+ faltas críticas neste filtro
            </p>
            <p className="text-xs text-[#86868B]">
              Todos os estudantes monitorados estão abaixo do limite configurado ou já foram filtrados.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-stretch">
            {visibleItems.map((item) => {
              const {
                cls,
                student,
                occurrences,
                latestOccurrence,
                consecutiveDaysCount,
                totalConsecutiveDaysYear,
                hasFamilyFeedback,
                familyFeedbackText,
              } = item;

              const datesList =
                latestOccurrence?.selectedDates && latestOccurrence.selectedDates.length > 0
                  ? latestOccurrence.selectedDates.join(', ')
                  : 'Dias registrados no lançamento mensal';

              const cardTierColor =
                consecutiveDaysCount >= 10
                  ? 'bg-[#FFEBEB] hover:bg-[#FFDEDE] border border-[#D70015]/15'
                  : consecutiveDaysCount >= 5
                  ? 'bg-[#FFF5E5] hover:bg-[#FFEAD0] border border-[#B25000]/15'
                  : 'bg-[#F5F5F7] hover:bg-[#EFEFF2] border border-black/[0.05]';

              const badgeTierColor =
                consecutiveDaysCount >= 10
                  ? 'bg-[#D70015] text-white'
                  : consecutiveDaysCount >= 5
                  ? 'bg-[#B25000] text-white'
                  : 'bg-[#0071E3] text-white';

              return (
                <div
                  key={`crit-${cls.id}-${student.id}`}
                  onClick={() => setSelectedDetailItem(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedDetailItem(item);
                    }
                  }}
                  className={`card-interactive group rounded-2xl p-4 cursor-pointer flex flex-col justify-between gap-2.5 h-full min-h-[118px] transition-colors ${cardTierColor}`}
                >
                  <div className="flex items-start justify-between gap-2.5 min-w-0">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <StudentAvatar student={student} size="md" />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm sm:text-base font-semibold text-[#1D1D1F] group-hover:text-[#0071E3] transition-colors duration-150 break-words leading-snug">
                          {student.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#424245] font-medium">
                          <span className="font-semibold text-[#1D1D1F]">{cls.name}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            Nº {student.number.toString().padStart(2, '0')}
                          </span>
                          {cls.teacherFirstName && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="break-words">Professor(a) {cls.teacherFirstName}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-mono font-semibold text-xs tabular-nums inline-block ${badgeTierColor}`}
                      >
                        {consecutiveDaysCount >= 10
                          ? `10+ DIAS (${consecutiveDaysCount} dias)`
                          : consecutiveDaysCount >= 5
                          ? `5+ DIAS (${consecutiveDaysCount} dias)`
                          : `3+ DIAS (${consecutiveDaysCount} dias)`}
                      </span>
                      <span className="text-xs text-[#86868B] font-mono tabular-nums block mt-0.5">
                        Ano: {totalConsecutiveDaysYear} {totalConsecutiveDaysYear === 1 ? 'dia' : 'dias'} ({occurrences.length || 1}x)
                      </span>
                    </div>
                  </div>

                  {/* Linha de Datas e Status do Retorno da Família */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs min-w-0">
                    <div className="min-w-0 flex-1 break-words">
                      <span className="text-[#86868B]">Datas: </span>
                      <span className="font-mono font-semibold text-[#1D1D1F] break-words">
                        {datesList}
                      </span>
                    </div>

                    <span
                      className={`font-semibold shrink-0 flex items-center gap-1 ${
                        hasFamilyFeedback ? 'text-[#1B873F]' : 'text-[#D70015]'
                      }`}
                    >
                      <span>
                        {hasFamilyFeedback ? 'Feedback recebido' : 'Aguardando contato'}
                      </span>
                      <ChevronRight className="w-4 h-4 shrink-0" />
                    </span>
                  </div>

                  {hasFamilyFeedback && (
                    <p className="text-xs text-[#1D1D1F] bg-white/95 border border-black/[0.06] px-3 py-2 rounded-xl font-normal break-words leading-relaxed">
                      “{familyFeedbackText}”
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Rodapé com botão de expandir/recolher e atalho direto para a tela Faltas Seguidas */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {filteredItems.length > 6 ? (
            <button
              type="button"
              onClick={() => setShowAllStudents(!showAllStudents)}
              className="text-sm font-semibold text-[#0071E3] hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>
                {showAllStudents
                  ? 'Mostrar menos estudantes'
                  : `Ver todos os ${filteredItems.length} estudantes em alerta crítico`}
              </span>
              {showAllStudents ? (
                <ChevronUp className="w-[17px] h-[17px] shrink-0" />
              ) : (
                <ChevronDown className="w-[17px] h-[17px] shrink-0" />
              )}
            </button>
          ) : (
            <span className="text-xs text-[#86868B]">
              Clique em qualquer estudante acima para abrir os detalhes completos da ocorrência.
            </span>
          )}

          {onSelectStudentForConsecutiveScreen &&
            (criticalItems.length > 0 || (classes[0] && classes[0].students[0])) && (
            <button
              type="button"
              onClick={() =>
                onSelectStudentForConsecutiveScreen(
                  (criticalItems[0] || { cls: classes[0], student: classes[0].students[0] }).cls,
                  (criticalItems[0] || { cls: classes[0], student: classes[0].students[0] }).student
                )
              }
              className="min-h-[36px] px-4 py-1.5 rounded-full bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] border border-black/[0.08] font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors active:scale-95"
            >
              <CalendarX2 className="w-[17px] h-[17px] text-[#D70015] shrink-0" />
              <span>
                {isStrictAdmin
                  ? 'Atender Contatos & Feedbacks'
                  : isPeb1
                  ? 'Pedir Contato à Secretaria'
                  : 'Abrir Painel de Busca Ativa'}
              </span>
            </button>
          )}
        </div>
      </section>

      {/* Modal Minimalista de Detalhes da Falta Crítica (Renderizado em Portal) */}
      {selectedDetailItem && (
        <ModalPortal>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Alerta de faltas críticas — ${selectedDetailItem.student.name}`}
            className="fixed inset-0 z-[110] bg-black/35 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-hidden animate-backdrop-in"
            onClick={() => setSelectedDetailItem(null)}
          >
            <div
              className="rounded-3xl bg-white border border-black/[0.08] max-w-xl w-full p-5 sm:p-6 space-y-4 max-h-[86dvh] modal-scroll-body shadow-[0_24px_60px_rgba(0,0,0,0.18)] animate-apple-pop"
              onClick={(e) => e.stopPropagation()}
            >
            {/* Cabeçalho do Modal */}
            <div className="flex items-start justify-between gap-3 pb-2">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <StudentAvatar student={selectedDetailItem.student} size="lg" />
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-[#D70015] block break-words">
                    Alerta de Faltas Críticas · Turma {selectedDetailItem.cls.name}
                  </span>
                  <h3 className="text-lg font-semibold text-[#1D1D1F] break-words leading-snug">
                    {selectedDetailItem.student.name}
                  </h3>
                  <p className="text-xs text-[#86868B] font-mono tabular-nums break-words">
                    Nº {selectedDetailItem.student.number.toString().padStart(2, '0')} · RA{' '}
                    {selectedDetailItem.student.ra || '—'} · Regente:{' '}
                    {selectedDetailItem.cls.teacherName || 'PEB I'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDetailItem(null)}
                aria-label="Fechar detalhes"
                className="w-8 h-8 rounded-full bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#424245] hover:text-[#1D1D1F] flex items-center justify-center shrink-0 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Resumo Numérico do Estudante */}
            <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-2.5 text-center">
              <div className="bg-[#FFEBEB] border border-[#D70015]/15 rounded-2xl p-3.5 min-w-0">
                <span className="text-xs font-semibold text-[#D70015] block">
                  Sequência Atual
                </span>
                <span className="text-xl font-bold text-[#D70015] font-mono tabular-nums">
                  {selectedDetailItem.consecutiveDaysCount} dias
                </span>
              </div>

              <div className="bg-[#F5F5F7] border border-black/[0.05] rounded-2xl p-3.5 min-w-0">
                <span className="text-xs font-semibold text-[#86868B] block">
                  Ocorrências no Ano
                </span>
                <span className="text-lg font-semibold text-[#1D1D1F] font-mono tabular-nums">
                  {selectedDetailItem.occurrences.length || 1}x ({selectedDetailItem.totalConsecutiveDaysYear} dias)
                </span>
              </div>

              <div className="bg-[#F5F5F7] border border-black/[0.05] rounded-2xl p-3.5 min-w-0">
                <span className="text-xs font-semibold text-[#86868B] block">
                  Faltas no Mês
                </span>
                <span className="text-lg font-semibold text-[#1D1D1F] font-mono tabular-nums">
                  {selectedDetailItem.student.totalAbsencesMonth || 0} faltas ·{' '}
                  {selectedDetailItem.student.justifiedAbsences || 0} atest.
                </span>
              </div>
            </div>

            {/* Contato Rápido com a Família (WhatsApp Direto) */}
            <div className="bg-[#F5F5F7] border border-black/[0.05] rounded-2xl p-3.5 space-y-1.5">
              <span className="text-xs font-semibold text-[#86868B] block">
                Responsável Familiar &amp; Contato Direto
              </span>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-[#1D1D1F]">
                  {selectedDetailItem.student.filiacao1 ||
                    selectedDetailItem.student.guardianName ||
                    'Familiar Responsável'}
                </span>
                {(() => {
                  const rawPhone =
                    selectedDetailItem.student.telefones ||
                    selectedDetailItem.student.guardianPhone ||
                    '';
                  const firstPhone = rawPhone.split('/')[0]?.trim() || '';
                  const digits = firstPhone.replace(/\D/g, '');
                  if (!digits) {
                    return (
                      <span className="text-xs text-[#86868B]">
                        Telefone não informado
                      </span>
                    );
                  }
                  const waNumber = digits.startsWith('55') ? digits : `55${digits}`;
                  const waHref = `https://wa.me/${waNumber}?text=${encodeURIComponent(
                    `Olá, família de ${selectedDetailItem.student.name}! Aqui é da EMEB Prof. Joaquim Candelário de Freitas. Notamos ${selectedDetailItem.consecutiveDaysCount} faltas seguidas recentes. Está tudo bem com o(a) estudante?`
                  )}`;
                  return (
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-mono font-semibold text-[#1B873F] hover:underline"
                    >
                      <MessageCircle className="w-4 h-4 shrink-0" />
                      <span>{firstPhone} (WhatsApp)</span>
                    </a>
                  );
                })()}
              </div>
            </div>

            {/* Histórico Acumulado de Sequências de Faltas Seguidas e Feedbacks da Família */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-[#1D1D1F]">
                Histórico de Sequências e Devolutivas da Família no Ano
              </h4>

              {selectedDetailItem.occurrences.length === 0 ? (
                <div className="rounded-2xl bg-[#FFEBEB] border border-[#D70015]/15 p-3.5 space-y-1">
                  <p className="text-sm font-semibold text-[#1D1D1F]">
                    {selectedDetailItem.monthlyUnjustifiedAbsences} faltas não justificadas registradas no mês
                  </p>
                  <p className="text-xs text-[#424245]">
                    {isStrictAdmin
                      ? 'Aguardando o(a) docente PEB I solicitar contato na aba Busca Ativa caso identifique 3 ou mais faltas seguidas.'
                      : isPeb1
                      ? 'Clique em "Pedir Contato à Secretaria" abaixo para informar os dias exatos de faltas seguidas.'
                      : 'Aguardando solicitação de contato pelo(a) docente PEB I e devolutiva da secretaria.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedDetailItem.occurrences.map((occ, idx) => {
                    const seq = occ.sequenceNumber || idx + 1;
                    const fb = (occ.familyFeedback || '').trim();
                    return (
                      <div
                        key={occ.id || `occ-${idx}`}
                        className="rounded-2xl bg-[#F5F5F7] border border-black/[0.05] p-3.5 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[#1D1D1F]">
                            {seq}ª Solicitação · {occ.selectedDates.join(', ')} (
                            {occ.selectedDates.length} dias)
                          </span>
                          <span className="text-xs text-[#86868B] font-mono tabular-nums">
                            {occ.reportedAt || 'Registrado'}
                          </span>
                        </div>
                        {fb ? (
                          <div className="bg-white rounded-xl border border-black/[0.06] p-2.5 text-sm text-[#1D1D1F]">
                            <span className="font-semibold text-[#1B873F] block text-xs">
                              Devolutiva da Família ({occ.feedbackByName || 'Secretaria'} · {occ.feedbackUpdatedAt || 'Recente'}):
                            </span>
                            <p className="mt-0.5 leading-relaxed text-xs text-[#424245]">{fb}</p>
                          </div>
                        ) : (
                          <p className="text-xs text-[#D70015] font-medium">
                            {isStrictAdmin
                              ? 'Pendente de contato com a família e preenchimento do feedback.'
                              : 'Aguardando contato e devolutiva da secretaria com a família.'}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Ações Diretas no Rodapé do Modal */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-3">
              {onOpenStudentGrid && (
                <button
                  type="button"
                  onClick={() => {
                    const item = selectedDetailItem;
                    setSelectedDetailItem(null);
                    onOpenStudentGrid(
                      item.student,
                      item.cls.id,
                      item.cls.name,
                      item.cls.classesHeld || 20
                    );
                  }}
                  className="w-full sm:w-auto min-h-[38px] px-4 py-2 rounded-full bg-[#F5F5F7] hover:bg-[#E8E8ED] border border-black/[0.08] text-[#1D1D1F] font-semibold text-xs sm:text-sm cursor-pointer transition-colors whitespace-normal text-center"
                >
                  Ficha Completa (48 Dados)
                </button>
              )}

              {onOpenStudentPdf && (
                <button
                  type="button"
                  onClick={() => {
                    const item = selectedDetailItem;
                    setSelectedDetailItem(null);
                    onOpenStudentPdf(item.student, item.cls.name);
                  }}
                  className="w-full sm:w-auto min-h-[38px] px-4 py-2 rounded-full bg-[#F5F5F7] hover:bg-[#E8E8ED] border border-black/[0.08] text-[#1D1D1F] font-semibold text-xs sm:text-sm cursor-pointer transition-colors whitespace-normal text-center"
                >
                  Ficha Informativa do Estudante
                </button>
              )}

              {onSelectStudentForConsecutiveScreen && (
                <button
                  type="button"
                  onClick={() => {
                    const item = selectedDetailItem;
                    setSelectedDetailItem(null);
                    onSelectStudentForConsecutiveScreen(item.cls, item.student);
                  }}
                  className="w-full sm:w-auto min-h-[38px] px-4 py-2 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all duration-150 active:scale-95 whitespace-normal text-center"
                >
                  <ExternalLink className="w-4 h-4 shrink-0" />
                  <span>
                    {isStrictAdmin
                      ? 'Contatar e Registrar Feedback'
                      : isPeb1
                      ? 'Pedir Contato à Secretaria'
                      : 'Ver na Busca Ativa'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </>
  );
};
