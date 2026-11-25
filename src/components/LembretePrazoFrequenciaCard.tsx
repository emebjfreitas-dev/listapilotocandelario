import React, { useState } from 'react';
import { AttendanceWindowConfig, AuthorizedUser, ClassGroup, UserRole } from '../types';
import { evaluateAttendanceLaunchWindow } from '../services/db';
import {
  dispatchWindowClosingFcmAlert,
  evaluateTeacherEndOfDayPendingClasses,
  setupCompulsoryFcmAutoActivation,
} from '../services/fcmService';
import {
  Clock,
  LockOpen,
  CalendarCheck,
  AlertTriangle,
  Settings,
  Bell,
  Send,
  X,
} from 'lucide-react';

interface LembretePrazoFrequenciaCardProps {
  attendanceWindowConfig: AttendanceWindowConfig;
  userRole?: UserRole;
  teacherRoleType?: AuthorizedUser['teacherRoleType'];
  userEmail?: string;
  userName?: string;
  classes?: ClassGroup[];
  assignedClassId?: string;
  assignedClassIds?: string[];
  onOpenMonthlyAttendance?: (cls: ClassGroup) => void;
  onNavigateToAcessos?: () => void;
}

export const LembretePrazoFrequenciaCard: React.FC<LembretePrazoFrequenciaCardProps> = ({
  attendanceWindowConfig,
  userRole = 'usuario',
  teacherRoleType,
  userEmail = 'emebjfreitas@jundiai.sp.gov.br',
  userName,
  classes = [],
  assignedClassId,
  assignedClassIds = [],
  onOpenMonthlyAttendance,
  onNavigateToAcessos,
}) => {
  const isStrictAdmin =
    userRole === 'admin' && teacherRoleType !== 'apoio' && teacherRoleType !== 'aee';
  const [isDismissed, setIsDismissed] = useState(false);
  const [fcmActionLoading, setFcmActionLoading] = useState(false);
  const [fcmToastMsg, setFcmToastMsg] = useState<string | null>(null);

  const win = evaluateAttendanceLaunchWindow(attendanceWindowConfig);

  const targetClass = React.useMemo(() => {
    if (assignedClassId) {
      const found = classes.find((c) => c.id === assignedClassId);
      if (found) return found;
    }
    if (assignedClassIds.length > 0) {
      const found = classes.find((c) => assignedClassIds.includes(c.id));
      if (found) return found;
    }
    return classes[0];
  }, [classes, assignedClassId, assignedClassIds]);

  const pendingSummary = React.useMemo(() => {
    const list =
      userRole === 'usuario'
        ? classes.filter((c) => assignedClassIds.includes(c.id) || c.id === assignedClassId)
        : classes;
    const pending = list.filter((c) => c.isPending);
    return {
      total: list.length,
      pendingCount: pending.length,
      firstPendingClass: pending[0] || list[0],
    };
  }, [classes, userRole, assignedClassId, assignedClassIds]);

  const teacherEodSummary = React.useMemo(() => {
    const effectiveAssigned =
      assignedClassIds.length > 0
        ? assignedClassIds
        : assignedClassId
        ? [assignedClassId]
        : [];
    return evaluateTeacherEndOfDayPendingClasses({
      attendanceWindowConfig,
      visibleClasses: classes,
      userRole,
      teacherRoleType,
      assignedClassIds: effectiveAssigned,
    });
  }, [
    attendanceWindowConfig,
    classes,
    userRole,
    teacherRoleType,
    assignedClassId,
    assignedClassIds,
  ]);

  const dueTeacherReminder = teacherEodSummary.dueNowEvaluations[0];
  const upcomingTeacherReminder = teacherEodSummary.upcomingEvaluations[0];

  React.useEffect(() => {
    const unsub = setupCompulsoryFcmAutoActivation({
      userEmail,
      userName: userName || userEmail.split('@')[0],
      userRole,
      teacherRoleType,
      assignedClassIds:
        assignedClassIds.length > 0
          ? assignedClassIds
          : assignedClassId
          ? [assignedClassId]
          : [],
    });
    return unsub;
  }, [userEmail, userName, userRole, teacherRoleType, assignedClassIds, assignedClassId]);

  const handleAdminNotifyPendingViaFcm = async () => {
    if (!isStrictAdmin || fcmActionLoading) return;
    setFcmActionLoading(true);
    setFcmToastMsg(null);
    try {
      const res = await dispatchWindowClosingFcmAlert({
        targetAudience: 'pending_only',
        attendanceWindowConfig,
        classes,
        senderEmail: userEmail,
        senderName: userName || 'Gestão Escolar',
        senderRole: userRole,
        senderTeacherRoleType: teacherRoleType,
      });
      setFcmToastMsg(res.message);
    } finally {
      setFcmActionLoading(false);
    }
  };

  if (isDismissed) {
    return (
      <div className="flex items-center justify-between px-3.5 py-2 rounded-2xl bg-[#F5F5F7] border border-black/[0.06] text-xs text-[#1D1D1F] animate-gentle-fade">
        <div className="flex items-center gap-1.5">
          <Bell className="w-3.5 h-3.5 text-[#0071E3]" />
          <span className="font-medium">Lembrete de prazos minimizado</span>
        </div>
        <button
          type="button"
          onClick={() => setIsDismissed(false)}
          className="font-semibold text-[#0071E3] hover:underline cursor-pointer"
        >
          Reexibir
        </button>
      </div>
    );
  }

  const hasEndOfDayPendingAlert = Boolean(dueTeacherReminder);
  const isUrgent = win.urgencyLevel === 'urgent' || hasEndOfDayPendingAlert;
  const isWarning = win.urgencyLevel === 'warning';
  const isOpen = win.isAllowedToLaunch;

  const bgClass = isUrgent
    ? 'bg-[#FFF5E5] border border-[#B25000]/20'
    : isOpen
    ? 'bg-[#EAF7EE] border border-[#1B873F]/20'
    : isWarning
    ? 'bg-[#FFF8EB] border border-[#B25000]/20'
    : 'bg-[#F5F5F7] border border-black/[0.06]';

  const badgeBg = isUrgent
    ? 'bg-[#D70015] text-white font-semibold'
    : isOpen
    ? 'bg-[#1B873F] text-white font-semibold'
    : isWarning
    ? 'bg-[#B25000] text-white font-semibold'
    : 'bg-[#0071E3] text-white font-semibold';

  const iconBg = isUrgent
    ? 'bg-[#FFEBEB] text-[#D70015]'
    : isOpen
    ? 'bg-[#EAF7EE] text-[#1B873F]'
    : isWarning
    ? 'bg-[#FFF5E5] text-[#B25000]'
    : 'bg-[#0071E3]/10 text-[#0071E3]';

  return (
    <aside
      aria-label="Lembrete Oficial de Prazo de Fechamento da Frequência"
      className={`rounded-3xl p-4 sm:p-5 transition-all duration-200 space-y-2.5 animate-gentle-fade ${bgClass}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left Side: Icon + Message */}
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${iconBg}`}
          >
            {isUrgent ? (
              <AlertTriangle className="w-5 h-5 text-[#D70015]" />
            ) : isOpen ? (
              <LockOpen className="w-5 h-5 text-[#1B873F]" />
            ) : (
              <Clock className="w-5 h-5 text-[#0071E3]" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs uppercase tracking-wider ${badgeBg}`}
              >
                {hasEndOfDayPendingAlert
                  ? 'Fim do Turno · Pendente'
                  : isOpen
                  ? 'Janela Aberta'
                  : 'Lembrete de Prazo'}
              </span>

              <span className="text-xs text-[#86868B] font-medium tabular-nums">
                {win.currentDateFormatted} · Mês de {win.targetMonthName}
              </span>

              {pendingSummary.pendingCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-white border border-black/[0.08] text-[#1D1D1F] text-xs font-semibold tabular-nums">
                  {pendingSummary.pendingCount} fechamento(s) pendente(s)
                </span>
              )}
            </div>

            <h2 className="text-base tracking-tight leading-snug mt-1 font-semibold text-[#1D1D1F]">
              {dueTeacherReminder ? (
                <span>
                  Fim do {dueTeacherReminder.evaluation.shiftLabel} (
                  {dueTeacherReminder.evaluation.closingTimeLabel}) — Frequência da turma{' '}
                  {dueTeacherReminder.cls.name} ainda não lançada
                </span>
              ) : isOpen ? (
                <span>
                  Prazo de Fechamento Aberto — Encerramento em {win.closingDateFormatted}
                </span>
              ) : (
                <span>
                  Próxima Abertura de Lançamento: {win.nextWindowOpenDateFormatted}
                </span>
              )}
            </h2>

            <p className="text-xs sm:text-sm text-[#424245] font-normal leading-normal mt-0.5">
              {dueTeacherReminder ? (
                <span>
                  Seu expediente do {dueTeacherReminder.evaluation.shiftLabel.toLowerCase()} encerra às{' '}
                  <strong className="tabular-nums font-semibold text-[#1D1D1F]">
                    {dueTeacherReminder.evaluation.closingTimeLabel}
                  </strong>
                  . Atualize o registro de faltas da sua turma agora (salvamento automático · prazo até{' '}
                  {win.closingDateFormatted}).
                </span>
              ) : upcomingTeacherReminder ? (
                <span>
                  Lembrete automático de fim de turno programado para{' '}
                  <strong className="tabular-nums font-semibold text-[#1D1D1F]">
                    {upcomingTeacherReminder.evaluation.reminderStartTimeLabel}
                  </strong>{' '}
                  ({upcomingTeacherReminder.evaluation.shiftLabel} · até{' '}
                  {upcomingTeacherReminder.evaluation.closingTimeLabel}). Prazo mensal até{' '}
                  {win.closingDateFormatted}.
                </span>
              ) : isOpen ? (
                <span>
                  Os educadores devem preencher as faltas e atestados antes do prazo final ({win.closingDateFormatted}, 2º dia letivo). Tudo é salvo automaticamente.
                </span>
              ) : (
                <span>
                  {win.reasonLabel}. {win.windowRuleDescription}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right Side: Quick Action CTA Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0 pt-1 sm:pt-0">
          {isOpen && onOpenMonthlyAttendance && (dueTeacherReminder?.cls || targetClass) && (
            <button
              type="button"
              onClick={() =>
                onOpenMonthlyAttendance(
                  dueTeacherReminder?.cls || pendingSummary.firstPendingClass || targetClass
                )
              }
              className={`min-h-[36px] px-4 rounded-full text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 active:scale-95 ${
                hasEndOfDayPendingAlert
                  ? 'bg-[#D70015] hover:bg-[#B20010]'
                  : 'bg-[#0071E3] hover:bg-[#0077ED]'
              }`}
            >
              <CalendarCheck className="w-3.5 h-3.5 text-white shrink-0" />
              <span>
                {hasEndOfDayPendingAlert
                  ? 'Lançar Minhas Faltas Agora'
                  : userRole === 'usuario'
                  ? 'Lançar Minhas Faltas'
                  : 'Conferir Fechamentos'}
              </span>
            </button>
          )}

          {isStrictAdmin && (
            <button
              type="button"
              disabled={fcmActionLoading}
              onClick={handleAdminNotifyPendingViaFcm}
              title="Enviar lembrete de fechamento para professores com turmas pendentes"
              className="min-h-[36px] px-3.5 rounded-full bg-[#F5F5F7] hover:bg-[#E8E8ED] border border-black/[0.08] text-[#1D1D1F] font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 active:scale-95"
            >
              <Send className="w-3.5 h-3.5 text-[#0071E3]" />
              <span>
                {fcmActionLoading ? 'Enviando...' : 'Notificar Pendentes'}
              </span>
            </button>
          )}

          {isStrictAdmin && onNavigateToAcessos && (
            <button
              type="button"
              onClick={onNavigateToAcessos}
              title="Configurar Janela de Lançamento e Prazos"
              className="min-h-[36px] px-3.5 rounded-full bg-white hover:bg-[#F5F5F7] border border-black/[0.08] text-[#1D1D1F] font-semibold text-xs flex items-center gap-1.5 transition-colors active:scale-95 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-[#86868B]" />
              <span>Ajustar Prazos</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            title="Dispensar lembrete temporariamente"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/5 transition-colors active:scale-90 cursor-pointer"
            aria-label="Dispensar lembrete temporariamente"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {fcmToastMsg && (
        <div className="px-3 py-2 rounded-xl bg-white border border-black/[0.08] text-xs font-medium text-[#1D1D1F] flex items-center justify-between gap-2 animate-gentle-fade">
          <span>{fcmToastMsg}</span>
          <button
            type="button"
            onClick={() => setFcmToastMsg(null)}
            className="text-xs font-semibold text-[#86868B] hover:text-[#1D1D1F] cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}
    </aside>
  );
};
