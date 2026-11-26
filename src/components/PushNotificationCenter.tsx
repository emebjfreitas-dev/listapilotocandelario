import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  BellRing,
  Check,
  CheckCheck,
  ChevronRight,
  Clock,
  AlertCircle,
  Megaphone,
  Send,
  X,
} from 'lucide-react';
import { SFSymbol } from './ui/SFSymbol';
import { triggerMenuHaptic } from '../utils/haptics';
import {
  AttendanceWindowConfig,
  AuthorizedUser,
  ClassGroup,
  ScreenType,
  UserRole,
} from '../types';
import {
  PushNoticeItem,
  PushNoticeCategory,
  registerPushServiceWorker,
  getPushPermissionState,
  triggerPushNotification,
  getStoredCustomPushNotices,
  getReadPushNoticeIds,
  markPushNoticeAsRead,
  markAllPushNoticesAsRead,
  buildContextualPushNotices,
  onInAppPushBanner,
} from '../services/pushNotificationService';
import {
  registerDeviceForFcm,
  setupCompulsoryFcmAutoActivation,
  subscribeToFcmNotifications,
  evaluateAndTriggerWindowClosingReminder,
  evaluateAndTriggerTeacherEndOfDayReminder,
  evaluateTeacherEndOfDayPendingClasses,
  getNextTeacherEndOfDayReminderDelayMs,
  dispatchWindowClosingFcmAlert,
} from '../services/fcmService';
import { ModalPortal } from './ui/ModalPortal';

interface PushNotificationCenterProps {
  visibleClasses: ClassGroup[];
  allClasses?: ClassGroup[];
  userRole?: UserRole;
  teacherRoleType?: AuthorizedUser['teacherRoleType'];
  userEmail?: string;
  userName?: string;
  assignedClassIds?: string[];
  attendanceWindowConfig?: AttendanceWindowConfig;
  onNavigateScreen?: (screen: ScreenType, targetClassId?: string) => void;
}

export const PushNotificationCenter: React.FC<PushNotificationCenterProps> = ({
  visibleClasses,
  allClasses = [],
  userRole = 'usuario',
  teacherRoleType,
  userEmail = 'emebjfreitas@jundiai.sp.gov.br',
  userName,
  assignedClassIds = [],
  attendanceWindowConfig = { exceptionalOverrideOpen: false },
  onNavigateScreen,
}) => {
  // Apenas Administradores reais podem disparar notificações para a equipe
  const isStrictAdmin =
    userRole === 'admin' && teacherRoleType !== 'apoio' && teacherRoleType !== 'aee';

  const [isOpen, setIsOpen] = useState(false);
  const [actionFeedbackMsg, setActionFeedbackMsg] = useState<string | null>(null);
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);

  const [customNotices, setCustomNotices] = useState<PushNoticeItem[]>(() =>
    getStoredCustomPushNotices()
  );
  const [readIds, setReadIds] = useState<string[]>(() => getReadPushNoticeIds(userEmail));
  const [filterCategory, setFilterCategory] = useState<'all' | PushNoticeCategory>('all');
  const [showComposer, setShowComposer] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newCategory, setNewCategory] = useState<PushNoticeCategory>('prazo');
  const [newTargetClassId, setNewTargetClassId] = useState<string>('all');
  const [activeBanner, setActiveBanner] = useState<PushNoticeItem | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);
  const visibleClassesRef = useRef<ClassGroup[]>(visibleClasses);
  visibleClassesRef.current = visibleClasses;
  const attendanceWindowConfigRef = useRef<AttendanceWindowConfig>(attendanceWindowConfig);
  attendanceWindowConfigRef.current = attendanceWindowConfig;
  const onNavigateScreenRef = useRef(onNavigateScreen);
  onNavigateScreenRef.current = onNavigateScreen;
  const assignedClassIdsKey = assignedClassIds.join(',');
  const visibleClassesIdKey = visibleClasses.map((c) => c.id).join(',');
  const attendanceWindowKey = JSON.stringify(attendanceWindowConfig);

  useEffect(() => {
    setReadIds(getReadPushNoticeIds(userEmail));
  }, [userEmail]);

  // Registra Service Worker (/sw.js), escuta cliques e mantém canal FCM ativo silenciosamente em segundo plano
  useEffect(() => {
    let mounted = true;
    void registerPushServiceWorker();

    const parsedAssignedIds = assignedClassIdsKey
      ? assignedClassIdsKey.split(',').filter(Boolean)
      : [];
    const effectiveAssignedIds =
      parsedAssignedIds.length > 0
        ? parsedAssignedIds
        : visibleClassesRef.current.map((c) => c.id);

    const handleSwMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data && data.type === 'PUSH_NOTIFICATION_CLICKED' && data.targetScreen) {
        onNavigateScreenRef.current?.(data.targetScreen as ScreenType, data.targetClassId);
      } else if (
        data &&
        data.type === 'FCM_SUBSCRIPTION_REFRESH_NEEDED' &&
        getPushPermissionState() === 'granted'
      ) {
        void registerDeviceForFcm({
          userEmail,
          userName: userName || userEmail.split('@')[0],
          userRole,
          assignedClassIds: effectiveAssignedIds,
        });
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    const unsubscribeBanner = onInAppPushBanner((notice) => {
      setCustomNotices(getStoredCustomPushNotices());
      const acknowledgedIds = getReadPushNoticeIds(userEmail);
      if (!acknowledgedIds.includes(notice.id)) {
        setActiveBanner(notice);
      }
    });

    const unsubscribeFcm = subscribeToFcmNotifications({
      userEmail,
      userRole,
      assignedClassIds: effectiveAssignedIds,
      onAlertReceived: () => {
        if (mounted) {
          setCustomNotices(getStoredCustomPushNotices());
        }
      },
    });

    const unsubscribeCompulsoryFcm = setupCompulsoryFcmAutoActivation({
      userEmail,
      userName: userName || userEmail.split('@')[0],
      userRole,
      teacherRoleType,
      assignedClassIds: effectiveAssignedIds,
    });

    return () => {
      mounted = false;
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
      unsubscribeBanner();
      unsubscribeFcm();
      unsubscribeCompulsoryFcm();
    };
  }, [userEmail, userRole, teacherRoleType, userName, assignedClassIdsKey]);

  // Monitora automaticamente o fechamento da janela e dispara lembrete de fim de turno ao educador
  useEffect(() => {
    if (!visibleClassesIdKey) return;
    let cancelled = false;
    let cutoffTimeoutId: number | null = null;
    let pollIntervalId: number | null = null;

    const parsedAssignedIds = assignedClassIdsKey
      ? assignedClassIdsKey.split(',').filter(Boolean)
      : [];

    const runChecks = async () => {
      if (cancelled) return;
      const latestClasses = visibleClassesRef.current;
      const latestWindow = attendanceWindowConfigRef.current;
      await evaluateAndTriggerWindowClosingReminder({
        attendanceWindowConfig: latestWindow,
        visibleClasses: latestClasses,
        userEmail,
        userRole,
      });
      const eodNotice = await evaluateAndTriggerTeacherEndOfDayReminder({
        attendanceWindowConfig: latestWindow,
        visibleClasses: latestClasses,
        userEmail,
        userRole,
        teacherRoleType,
        assignedClassIds: parsedAssignedIds,
        onOpenClassAttendance: (classId) =>
          onNavigateScreenRef.current?.('frequencia_mensal', classId),
      });
      if (!cancelled && eodNotice) {
        setCustomNotices(getStoredCustomPushNotices());
      }
    };

    void runChecks();

    const scheduleCutoffTimer = () => {
      if (cutoffTimeoutId !== null) {
        window.clearTimeout(cutoffTimeoutId);
        cutoffTimeoutId = null;
      }
      const nextDelay = getNextTeacherEndOfDayReminderDelayMs({
        attendanceWindowConfig: attendanceWindowConfigRef.current,
        visibleClasses: visibleClassesRef.current,
        userRole,
        teacherRoleType,
        assignedClassIds: parsedAssignedIds,
      });
      if (nextDelay !== null && nextDelay > 0) {
        const safeDelay = Math.min(nextDelay + 500, 2_147_483_000);
        cutoffTimeoutId = window.setTimeout(() => {
          void runChecks();
          scheduleCutoffTimer();
        }, safeDelay);
      }
    };

    scheduleCutoffTimer();

    pollIntervalId = window.setInterval(() => {
      void runChecks();
    }, 60_000);

    const handleVisibilityWake = () => {
      if (document.visibilityState === 'visible') {
        void runChecks();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityWake);

    return () => {
      cancelled = true;
      if (cutoffTimeoutId !== null) window.clearTimeout(cutoffTimeoutId);
      if (pollIntervalId !== null) window.clearInterval(pollIntervalId);
      document.removeEventListener('visibilitychange', handleVisibilityWake);
    };
  }, [
    attendanceWindowKey,
    visibleClassesIdKey,
    userEmail,
    userRole,
    teacherRoleType,
    assignedClassIdsKey,
  ]);

  // Auto-oculta o banner flutuante após 8 segundos (permanece na central até dar ciência)
  useEffect(() => {
    if (!activeBanner) return;
    const timer = setTimeout(() => {
      setActiveBanner(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [activeBanner]);

  // Auto-limpa mensagem de confirmação administrativa após 4s
  useEffect(() => {
    if (!actionFeedbackMsg) return;
    const timer = setTimeout(() => setActionFeedbackMsg(null), 4000);
    return () => clearTimeout(timer);
  }, [actionFeedbackMsg]);

  // Fecha o popover ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Lista ativa: assim que o usuário dá ciência na notificação, ela desaparece da central
  const activeNotices = useMemo(() => {
    return buildContextualPushNotices(visibleClasses, customNotices, readIds).filter(
      (n) => !n.read
    );
  }, [visibleClasses, customNotices, readIds]);

  const unreadCount = activeNotices.length;

  const filteredNotices = useMemo(() => {
    if (filterCategory === 'all') return activeNotices;
    return activeNotices.filter((n) => n.category === filterCategory);
  }, [activeNotices, filterCategory]);

  const teacherEodSummary = useMemo(
    () =>
      evaluateTeacherEndOfDayPendingClasses({
        attendanceWindowConfig,
        visibleClasses,
        userRole,
        teacherRoleType,
        assignedClassIds,
      }),
    [attendanceWindowConfig, visibleClasses, userRole, teacherRoleType, assignedClassIds]
  );

  const handleQuickWindowClosingAlert = async () => {
    if (!isStrictAdmin || isSendingBroadcast) return;
    setIsSendingBroadcast(true);
    setActionFeedbackMsg(null);
    try {
      const classesPool = allClasses.length > 0 ? allClasses : visibleClasses;
      const res = await dispatchWindowClosingFcmAlert({
        targetAudience: 'pending_only',
        attendanceWindowConfig,
        classes: classesPool,
        senderEmail: userEmail,
        senderName: userName || 'Coordenação Escolar',
        senderRole: userRole,
        senderTeacherRoleType: teacherRoleType,
      });
      setCustomNotices(getStoredCustomPushNotices());
      setActionFeedbackMsg(res.message);
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  const handleCreateAndSendNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStrictAdmin || !newTitle.trim() || !newBody.trim()) return;

    const defaultScreen: ScreenType =
      newCategory === 'prazo'
        ? 'frequencia_mensal'
        : newCategory === 'busca_ativa'
        ? 'faltas_consecutivas'
        : 'home';

    if (newCategory === 'prazo') {
      const classesPool = allClasses.length > 0 ? allClasses : visibleClasses;
      const res = await dispatchWindowClosingFcmAlert({
        title: newTitle.trim(),
        body: newBody.trim(),
        targetAudience: newTargetClassId === 'all' ? 'all' : 'pending_only',
        targetClassIds: [newTargetClassId],
        attendanceWindowConfig,
        classes: classesPool,
        senderEmail: userEmail,
        senderName: userName || 'Coordenação / Admin',
        senderRole: userRole,
        senderTeacherRoleType: teacherRoleType,
      });
      setActionFeedbackMsg(res.message);
    } else {
      await triggerPushNotification(
        {
          title: newTitle.trim(),
          body: newBody.trim(),
          category: newCategory,
          targetClassId: newTargetClassId,
          targetScreen: defaultScreen,
          authorName: userName || 'Coordenação / Admin',
        },
        { saveToFeed: true, showBanner: true, userEmail }
      );
      setActionFeedbackMsg('Notificação enviada para a equipe.');
    }

    setCustomNotices(getStoredCustomPushNotices());
    setNewTitle('');
    setNewBody('');
    setShowComposer(false);
  };

  // Dar ciência sem sair da tela -> notificação some imediatamente para o usuário
  const handleAcknowledgeNotice = (noticeId: string) => {
    const nextRead = markPushNoticeAsRead(noticeId, userEmail);
    setReadIds(nextRead);
    if (activeBanner?.id === noticeId) {
      setActiveBanner(null);
    }
  };

  // Clicar no aviso: registra ciência e navega ao módulo alvo
  const handleNoticeClick = (notice: PushNoticeItem) => {
    handleAcknowledgeNotice(notice.id);
    setIsOpen(false);
    if (notice.targetScreen && onNavigateScreen) {
      onNavigateScreen(
        notice.targetScreen,
        notice.targetClassId && notice.targetClassId !== 'all'
          ? notice.targetClassId
          : undefined
      );
    }
  };

  const handleAcknowledgeAll = () => {
    const ids = activeNotices.map((n) => n.id);
    if (ids.length === 0) return;
    const updated = markAllPushNoticesAsRead(ids, userEmail);
    setReadIds(updated);
    setActiveBanner(null);
  };

  const getCategoryMeta = (cat: PushNoticeCategory) => {
    if (cat === 'prazo') {
      return {
        label: 'Prazo',
        Icon: Clock,
        iconBoxClass: 'bg-[#FFF5E5] text-[#B25000] border border-[#B25000]/15',
      };
    }
    if (cat === 'busca_ativa') {
      return {
        label: 'Busca Ativa',
        Icon: AlertCircle,
        iconBoxClass: 'bg-[#FFEBEB] text-[#D70015] border border-[#D70015]/15',
      };
    }
    return {
      label: 'Aviso',
      Icon: Megaphone,
      iconBoxClass: 'bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/15',
    };
  };

  const classesForTargetSelect = allClasses.length > 0 ? allClasses : visibleClasses;
  const pendingSchoolClassesCount = classesForTargetSelect.filter((c) => c.isPending).length;

  return (
    <>
      {/* Botão de Sino no Cabeçalho */}
      <div className="relative" ref={popoverRef}>
        <button
          type="button"
          onClick={() => {
            triggerMenuHaptic('light');
            setIsOpen((prev) => !prev);
          }}
          aria-label={
            unreadCount > 0
              ? `Notificações (${unreadCount} pendentes)`
              : 'Notificações'
          }
          title="Notificações"
          className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer active:scale-95 ${
            isOpen
              ? 'bg-[#0071E3] text-white shadow-xs'
              : 'bg-[#F5F5F7] hover:bg-[#E8E8ED] border border-black/[0.06] text-[#424245] hover:text-[#1D1D1F]'
          }`}
        >
          <SFSymbol
            name={unreadCount > 0 ? 'notifications_active' : 'notifications'}
            filled={isOpen || unreadCount > 0}
            size={20}
            weight={isOpen ? 520 : 450}
          />

          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#D70015] text-white text-[11px] font-semibold flex items-center justify-center tabular-nums ring-2 ring-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Central de Notificações (Foco Direto nas Notificações Reais) */}
        {isOpen && (
          <div className="animate-apple-pop fixed sm:absolute right-3 sm:right-0 top-[68px] sm:top-auto sm:mt-2.5 w-[calc(100vw-24px)] max-w-[420px] max-h-[calc(100dvh-9.5rem)] overflow-y-auto bg-white/95 backdrop-blur-2xl rounded-3xl border border-black/[0.08] shadow-[0_24px_56px_rgba(0,0,0,0.14)] p-4 sm:p-5 z-50 space-y-3.5">
            {/* Cabeçalho Enxuto */}
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-semibold text-[#1D1D1F] tracking-[-0.02em] leading-tight">
                  Notificações
                </h2>
                <p className="text-xs text-[#86868B] tabular-nums mt-0.5">
                  {unreadCount === 0
                    ? 'Tudo em dia'
                    : unreadCount === 1
                    ? '1 notificação pendente'
                    : `${unreadCount} notificações pendentes`}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleAcknowledgeAll}
                    className="min-h-[34px] px-3 rounded-full bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#0071E3] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                  >
                    <CheckCheck className="w-3.5 h-3.5 stroke-[1.8]" />
                    <span>Dar ciência em tudo</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Fechar notificações"
                  className="w-8 h-8 rounded-full bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#424245] flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Lembrete Acionável de Fim de Turno (Somente quando há turmas pendentes do docente) */}
            {teacherEodSummary.isEligibleTeacherRole &&
              teacherEodSummary.pendingEvaluations.length > 0 &&
              teacherEodSummary.windowEvaluation.isAllowedToLaunch && (
                <div
                  className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                    teacherEodSummary.dueNowEvaluations.length > 0
                      ? 'bg-[#FFF8EB] border-[#B25000]/15 text-[#1D1D1F]'
                      : 'bg-[#F5F5F7] border-black/[0.06] text-[#1D1D1F]'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold leading-snug text-[#1D1D1F]">
                      {teacherEodSummary.dueNowEvaluations.length > 0
                        ? `Fim de turno (${teacherEodSummary.dueNowEvaluations[0].evaluation.closingTimeLabel}) · ${teacherEodSummary.dueNowEvaluations.length} turma(s) pendente(s)`
                        : `Lembrete de lançamento (${teacherEodSummary.pendingEvaluations[0].evaluation.reminderStartTimeLabel})`}
                    </p>
                    <p className="text-xs text-[#86868B] leading-snug mt-0.5 truncate">
                      Turma:{' '}
                      {(
                        teacherEodSummary.dueNowEvaluations[0] ||
                        teacherEodSummary.pendingEvaluations[0]
                      ).cls.name}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const target =
                        teacherEodSummary.dueNowEvaluations[0] ||
                        teacherEodSummary.pendingEvaluations[0];
                      setIsOpen(false);
                      onNavigateScreen?.('frequencia_mensal', target.cls.id);
                    }}
                    className="min-h-[34px] px-3.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                  >
                    Lançar Faltas
                  </button>
                </div>
              )}

            {/* Filtros em Linha Única Sem Quebra de Texto */}
            <div className="flex items-center gap-1 p-1 bg-[#F5F5F7] rounded-full border border-black/[0.05] overflow-x-auto no-scrollbar tabular-nums">
              <button
                type="button"
                onClick={() => setFilterCategory('all')}
                className={`min-h-[32px] flex-1 px-2.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                  filterCategory === 'all'
                    ? 'bg-white text-[#1D1D1F] font-semibold shadow-2xs'
                    : 'text-[#424245] hover:text-[#1D1D1F]'
                }`}
              >
                Todas ({activeNotices.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterCategory('prazo')}
                className={`min-h-[32px] flex-1 px-2.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                  filterCategory === 'prazo'
                    ? 'bg-white text-[#1D1D1F] font-semibold shadow-2xs'
                    : 'text-[#424245] hover:text-[#1D1D1F]'
                }`}
              >
                Prazos
              </button>
              <button
                type="button"
                onClick={() => setFilterCategory('busca_ativa')}
                className={`min-h-[32px] flex-1 px-2.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                  filterCategory === 'busca_ativa'
                    ? 'bg-white text-[#1D1D1F] font-semibold shadow-2xs'
                    : 'text-[#424245] hover:text-[#1D1D1F]'
                }`}
              >
                Busca Ativa
              </button>
              <button
                type="button"
                onClick={() => setFilterCategory('aviso')}
                className={`min-h-[32px] flex-1 px-2.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                  filterCategory === 'aviso'
                    ? 'bg-white text-[#1D1D1F] font-semibold shadow-2xs'
                    : 'text-[#424245] hover:text-[#1D1D1F]'
                }`}
              >
                Avisos
              </button>
            </div>

            {/* Lista Direta das Notificações */}
            <div className="max-h-[360px] overflow-y-auto space-y-2.5 pr-0.5">
              {filteredNotices.length === 0 ? (
                <div className="py-10 text-center space-y-1.5">
                  <div className="w-11 h-11 rounded-2xl bg-[#EAF7EE] text-[#1B873F] flex items-center justify-center mx-auto">
                    <CheckCheck className="w-5 h-5 stroke-[1.7]" />
                  </div>
                  <p className="text-sm font-semibold text-[#1D1D1F]">
                    Nenhuma notificação pendente
                  </p>
                  <p className="text-xs text-[#86868B] max-w-[260px] mx-auto leading-relaxed">
                    Todas as notificações desta categoria já receberam ciência.
                  </p>
                </div>
              ) : (
                filteredNotices.map((notice) => {
                  const meta = getCategoryMeta(notice.category);
                  const CatIcon = meta.Icon;
                  return (
                    <article
                      key={notice.id}
                      className="w-full p-3.5 rounded-2xl bg-[#F5F5F7] hover:bg-[#EFEFF2] border border-black/[0.05] transition-colors flex flex-col gap-2.5"
                    >
                      <button
                        type="button"
                        onClick={() => handleNoticeClick(notice)}
                        className="w-full text-left flex items-start gap-3 cursor-pointer group min-w-0"
                      >
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${meta.iconBoxClass}`}
                        >
                          <CatIcon className="w-[18px] h-[18px] stroke-[1.7]" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2 text-xs text-[#86868B] tabular-nums">
                            <span className="truncate">
                              {meta.label} · {notice.createdAt}
                            </span>
                            <ChevronRight className="w-4 h-4 text-[#86868B] group-hover:text-[#0071E3] shrink-0 transition-colors" />
                          </div>
                          <h3 className="text-[14px] font-semibold text-[#1D1D1F] leading-snug mt-0.5 break-words group-hover:text-[#0071E3] transition-colors">
                            {notice.title}
                          </h3>
                          <p className="text-xs text-[#424245] leading-relaxed mt-1 break-words">
                            {notice.body}
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <span className="text-[11px] text-[#86868B] truncate min-w-0">
                          {notice.authorName || 'Coordenação Escolar'}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleAcknowledgeNotice(notice.id)}
                          className="min-h-[32px] px-3 rounded-full bg-white hover:bg-[#0071E3] text-[#0071E3] hover:text-white border border-black/[0.06] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[1.8]" />
                          <span>Dar ciência</span>
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            {/* Feedback de Envio Real (exibido apenas quando Admin envia uma notificação) */}
            {actionFeedbackMsg && (
              <p className="text-xs font-medium text-[#1B873F] bg-[#EAF7EE] border border-[#1B873F]/15 rounded-2xl px-3.5 py-2.5 break-words">
                {actionFeedbackMsg}
              </p>
            )}

            {/* Ações de Envio Exclusivas de Administradores */}
            {isStrictAdmin && (
              <div className="pt-1 space-y-2">
                {!showComposer ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isSendingBroadcast}
                      onClick={handleQuickWindowClosingAlert}
                      className="min-h-[38px] px-3 rounded-full bg-[#F5F5F7] hover:bg-[#E8E8ED] border border-black/[0.06] text-[#1D1D1F] font-semibold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors disabled:opacity-60"
                    >
                      <BellRing className="w-3.5 h-3.5 shrink-0 text-[#B25000]" />
                      <span className="truncate">
                        {isSendingBroadcast
                          ? 'Enviando...'
                          : `Cobrar pendentes (${pendingSchoolClassesCount})`}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowComposer(true)}
                      className="min-h-[38px] px-3 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
                    >
                      <Send className="w-3.5 h-3.5 shrink-0" />
                      <span>Nova notificação</span>
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleCreateAndSendNotice} className="p-3.5 rounded-2xl bg-[#F5F5F7] border border-black/[0.06] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#1D1D1F]">
                        Enviar notificação à equipe
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowComposer(false)}
                        className="text-xs font-semibold text-[#424245] hover:text-[#1D1D1F] cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={newCategory}
                        onChange={(e) =>
                          setNewCategory(e.target.value as PushNoticeCategory)
                        }
                        aria-label="Categoria da notificação"
                        className="h-[38px] px-2.5 rounded-xl bg-white border border-black/[0.08] text-[#1D1D1F] text-xs font-medium"
                      >
                        <option value="prazo">Prazo Próximo</option>
                        <option value="aviso">Aviso Geral</option>
                        <option value="busca_ativa">Busca Ativa</option>
                      </select>

                      <select
                        value={newTargetClassId}
                        onChange={(e) => setNewTargetClassId(e.target.value)}
                        aria-label="Turma destinatária"
                        className="h-[38px] px-2.5 rounded-xl bg-white border border-black/[0.08] text-[#1D1D1F] text-xs font-medium"
                      >
                        <option value="all">Todas as Turmas</option>
                        {classesForTargetSelect.map((c) => (
                          <option key={c.id} value={c.id}>
                            Turma {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <input
                      type="text"
                      required
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Título (ex: Janela fecha amanhã)"
                      className="w-full h-[38px] px-3 rounded-xl bg-white border border-black/[0.08] text-[#1D1D1F] placeholder:text-[#86868B] text-xs font-medium"
                    />

                    <textarea
                      rows={2}
                      required
                      value={newBody}
                      onChange={(e) => setNewBody(e.target.value)}
                      placeholder="Escreva a mensagem para os professores..."
                      className="w-full p-2.5 rounded-xl bg-white border border-black/[0.08] text-[#1D1D1F] placeholder:text-[#86868B] text-xs resize-none"
                    />

                    <button
                      type="submit"
                      className="w-full min-h-[38px] rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Send className="w-3.5 h-3.5 shrink-0" />
                      <span>Enviar notificação</span>
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Banner Flutuante Discreto quando Nova Notificação Chega */}
      {activeBanner && (
        <ModalPortal>
          <div className="fixed top-[68px] right-4 left-4 sm:left-auto sm:w-[390px] z-[125] animate-gentle-fade">
            <div className="bg-white/95 backdrop-blur-2xl text-[#1D1D1F] border border-black/[0.08] p-4 rounded-3xl shadow-[0_18px_42px_rgba(0,0,0,0.14)] space-y-2.5">
              <div
                onClick={() => {
                  const target = activeBanner;
                  setActiveBanner(null);
                  handleNoticeClick(target);
                }}
                className="flex items-start gap-3 cursor-pointer"
              >
                <div className="w-9 h-9 rounded-2xl bg-[#0071E3] text-white flex items-center justify-center shrink-0">
                  <BellRing className="w-4 h-4 stroke-[1.7]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-[#86868B]">
                      Nova notificação · Agora
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveBanner(null);
                      }}
                      aria-label="Fechar aviso"
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] cursor-pointer"
                    >
                      <X className="w-4 h-4 stroke-[1.6]" />
                    </button>
                  </div>
                  <p className="text-sm font-semibold text-[#1D1D1F] leading-snug mt-0.5 break-words">
                    {activeBanner.title}
                  </p>
                  <p className="text-xs text-[#424245] leading-snug mt-0.5 break-words">
                    {activeBanner.body}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAcknowledgeNotice(activeBanner.id);
                  }}
                  className="min-h-[32px] px-3.5 rounded-full bg-[#F5F5F7] hover:bg-[#0071E3] text-[#0071E3] hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 stroke-[1.8]" />
                  <span>Dar ciência</span>
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
};
