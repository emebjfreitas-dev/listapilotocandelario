import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AuthorizedUser, ScreenType, UserRole } from '../types';
import { subscribeToSyncStatus, SyncStatusSnapshot } from '../services/firebaseSync';
import { flushPendingOfflineQueue } from '../services/db';
import { SyncQueueManager, SyncQueueManagerSnapshot } from '../services/syncQueueManager';
import { ModalPortal } from './ui/ModalPortal';
import { SFSymbol } from './ui/SFSymbol';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import { triggerMenuHaptic } from '../utils/haptics';

interface BottomNavProps {
  currentScreen: ScreenType;
  userRole?: UserRole;
  teacherRoleType?: AuthorizedUser['teacherRoleType'];
  onChangeScreen: (screen: ScreenType) => void;
  onLogout?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentScreen,
  userRole = 'admin',
  teacherRoleType,
  onChangeScreen,
  onLogout,
}) => {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  useModalScrollLock(showMoreMenu || showLogoutConfirm);
  const prefersReducedMotion = useReducedMotion();
  const [isFlushingCloud, setIsFlushingCloud] = useState(false);
  const [syncSnapshot, setSyncSnapshot] = useState<SyncStatusSnapshot>({
    status: 'synced',
    pendingCount: 0,
    lastSyncedAtISO: null,
    lastError: null,
    queue: [],
  });
  const [queueSnapshot, setQueueSnapshot] = useState<SyncQueueManagerSnapshot>(() =>
    SyncQueueManager.getSnapshot()
  );

  useEffect(() => {
    const unsubSync = subscribeToSyncStatus((snap) => {
      setSyncSnapshot(snap);
    });
    const unsubQueue = SyncQueueManager.subscribe((snap) => {
      setQueueSnapshot(snap);
    });
    return () => {
      unsubSync();
      unsubQueue();
    };
  }, []);

  const handleManualSync = async () => {
    if (isFlushingCloud) return;
    triggerMenuHaptic('medium');
    setIsFlushingCloud(true);
    try {
      await Promise.all([SyncQueueManager.flushNow(), flushPendingOfflineQueue()]);
    } catch (err) {
      console.warn('Aviso ao sincronizar nuvem:', err);
    } finally {
      setIsFlushingCloud(false);
    }
  };

  if (currentScreen === 'login') {
    return null;
  }

  const isAdmin =
    userRole === 'admin' && teacherRoleType !== 'apoio' && teacherRoleType !== 'aee';

  const coreNavItems: Array<{
    id: ScreenType;
    label: string;
    symbolName: string;
  }> = [
    {
      id: 'home',
      label: 'Início',
      symbolName: 'home',
    },
    {
      id: userRole === 'usuario' ? 'detalhes' : 'turmas',
      label: userRole === 'usuario' ? 'Turma' : 'Turmas',
      symbolName: 'groups',
    },
    ...(userRole !== 'peb2'
      ? [
          {
            id: 'frequencia_mensal' as ScreenType,
            label: 'Faltas',
            symbolName: 'event_available',
          },
        ]
      : []),
    {
      id: 'faltas_consecutivas',
      label: 'Busca Ativa',
      symbolName: 'gpp_maybe',
    },
  ];

  const adminMoreItems: Array<{
    id: ScreenType;
    label: string;
    description: string;
    symbolName: string;
    iconBgClass: string;
  }> = [
    {
      id: 'bolsa_familia',
      label: 'Bolsa Família',
      description: 'Beneficiários e apuração bimestral de faltas',
      symbolName: 'volunteer_activism',
      iconBgClass: 'bg-[#B25000]/10 text-[#B25000]',
    },
    {
      id: 'dias_letivos',
      label: 'Calendário Escolar',
      description: '200 dias letivos, janela de faltas e alertas FCM',
      symbolName: 'calendar_month',
      iconBgClass: 'bg-[#1B873F]/10 text-[#1B873F]',
    },
    {
      id: 'usuarios_acesso',
      label: 'Central Administrativa',
      description: 'Docentes, perfis RBAC, segurança LGPD e importações',
      symbolName: 'admin_panel_settings',
      iconBgClass: 'bg-[#0071E3]/10 text-[#0071E3]',
    },
    {
      id: 'diagnostico_bd',
      label: 'Sistema & Nuvem',
      description: 'Diagnóstico BD, Sheets, Drive Backup, cache e PWA',
      symbolName: 'database',
      iconBgClass: 'bg-[#424245]/10 text-[#1D1D1F]',
    },
  ];

  const getIsActive = (itemId: ScreenType) => {
    if (itemId === 'turmas') {
      return currentScreen === 'turmas' || currentScreen === 'detalhes';
    }
    return currentScreen === itemId;
  };

  const isMoreActive =
    isAdmin &&
    [
      'bolsa_familia',
      'dias_letivos',
      'usuarios_acesso',
      'diagnostico_bd',
      'importar_deficiencias_htm',
    ].includes(currentScreen);

  const unifiedPendingCount = Math.max(syncSnapshot.pendingCount, queueSnapshot.pendingTasksCount);
  const hasPendingCloud = unifiedPendingCount > 0;
  const isActivelySyncing =
    isFlushingCloud || syncSnapshot.status === 'syncing' || queueSnapshot.isProcessing;

  const totalSlots = coreNavItems.length + (isAdmin ? 1 : onLogout ? 1 : 0);
  const gridColsClass =
    totalSlots <= 3
      ? 'grid-cols-3'
      : totalSlots === 4
      ? 'grid-cols-4'
      : 'grid-cols-5';

  const tapAnimation = prefersReducedMotion ? undefined : { scale: 0.92 };

  return (
    <>
      {/* Barra de Navegação Inferior Estilo Apple (Mobile & Tablet) */}
      <nav
        aria-label="Barra de Navegação Inferior"
        className="fixed bottom-0 left-0 right-0 w-full z-40 pb-safe bg-white/90 backdrop-blur-2xl border-t border-black/[0.08] shadow-[0_-4px_20px_rgba(0,0,0,0.04)] lg:hidden"
      >
        <div
          className={`grid ${gridColsClass} items-center h-[64px] px-2 max-w-lg mx-auto gap-1`}
        >
          {coreNavItems.map((item) => {
            const isActive = getIsActive(item.id) && !showMoreMenu;
            return (
              <motion.button
                key={item.id}
                type="button"
                whileTap={tapAnimation}
                transition={{ type: 'spring', stiffness: 520, damping: 32 }}
                onClick={() => {
                  triggerMenuHaptic('light');
                  setShowMoreMenu(false);
                  onChangeScreen(item.id);
                }}
                aria-current={isActive ? 'page' : undefined}
                className="group relative flex flex-col items-center justify-center w-full min-w-0 min-h-[48px] h-full py-1 px-1 cursor-pointer select-none rounded-2xl"
              >
                <div className="relative flex items-center justify-center w-12 h-7 rounded-full">
                  {isActive && (
                    <motion.span
                      layoutId={prefersReducedMotion ? undefined : 'bottomNavActivePill'}
                      transition={{ type: 'spring', stiffness: 460, damping: 34, mass: 0.7 }}
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full bg-[#0071E3]/12"
                    />
                  )}
                  <SFSymbol
                    name={item.symbolName}
                    filled={isActive}
                    size={21}
                    weight={isActive ? 540 : 410}
                    className={`relative z-10 transition-colors ${
                      isActive
                        ? 'text-[#0071E3]'
                        : 'text-[#86868B] group-hover:text-[#1D1D1F]'
                    }`}
                  />
                </div>
                <span
                  className={`text-[11px] tracking-tight leading-none mt-1 whitespace-nowrap truncate max-w-full transition-colors ${
                    isActive
                      ? 'font-semibold text-[#0071E3]'
                      : 'font-medium text-[#424245] group-hover:text-[#1D1D1F]'
                  }`}
                >
                  {item.label}
                </span>
              </motion.button>
            );
          })}

          {isAdmin && (
            <motion.button
              type="button"
              whileTap={tapAnimation}
              transition={{ type: 'spring', stiffness: 520, damping: 32 }}
              onClick={() => {
                triggerMenuHaptic('light');
                setShowMoreMenu((prev) => !prev);
              }}
              aria-expanded={showMoreMenu}
              className="group relative flex flex-col items-center justify-center w-full min-w-0 min-h-[48px] h-full py-1 px-1 cursor-pointer select-none rounded-2xl"
            >
              <div className="relative flex items-center justify-center w-12 h-7 rounded-full">
                {(isMoreActive || showMoreMenu) && (
                  <motion.span
                    layoutId={prefersReducedMotion ? undefined : 'bottomNavActivePill'}
                    transition={{ type: 'spring', stiffness: 460, damping: 34, mass: 0.7 }}
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-[#0071E3]/12"
                  />
                )}
                <SFSymbol
                  name="tune"
                  filled={isMoreActive || showMoreMenu}
                  size={21}
                  weight={isMoreActive || showMoreMenu ? 540 : 410}
                  className={`relative z-10 transition-colors ${
                    isMoreActive || showMoreMenu
                      ? 'text-[#0071E3]'
                      : 'text-[#86868B] group-hover:text-[#1D1D1F]'
                  }`}
                />
                {hasPendingCloud && (
                  <span className="absolute -top-0.5 right-1 z-20 w-2.5 h-2.5 rounded-full bg-[#B25000] ring-2 ring-white" />
                )}
              </div>
              <span
                className={`text-[11px] tracking-tight leading-none mt-1 whitespace-nowrap truncate max-w-full transition-colors ${
                  isMoreActive || showMoreMenu
                    ? 'font-semibold text-[#0071E3]'
                    : 'font-medium text-[#424245] group-hover:text-[#1D1D1F]'
                }`}
              >
                Gestão
              </span>
            </motion.button>
          )}

          {onLogout && !isAdmin && (
            <motion.button
              type="button"
              whileTap={tapAnimation}
              transition={{ type: 'spring', stiffness: 520, damping: 32 }}
              onClick={() => {
                triggerMenuHaptic('medium');
                setShowLogoutConfirm(true);
              }}
              className="group flex flex-col items-center justify-center w-full min-w-0 min-h-[48px] h-full py-1 px-1 cursor-pointer select-none rounded-2xl"
            >
              <div className="flex items-center justify-center w-12 h-7 rounded-full bg-[#D70015]/10 text-[#D70015] group-hover:bg-[#D70015]/15 transition-colors">
                <SFSymbol name="logout" filled size={19} weight={480} />
              </div>
              <span className="text-[11px] font-medium tracking-tight leading-none mt-1 whitespace-nowrap truncate max-w-full text-[#D70015]">
                Sair
              </span>
            </motion.button>
          )}
        </div>
      </nav>

      {/* Sheet Modal de Gestão (Mobile/Tablet) */}
      {showMoreMenu && isAdmin && (
        <ModalPortal onClose={() => setShowMoreMenu(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Ferramentas de gestão"
            className="fixed inset-0 z-[120] overflow-hidden lg:hidden flex flex-col justify-end"
          >
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-backdrop-in"
              onClick={() => {
                triggerMenuHaptic('light');
                setShowMoreMenu(false);
              }}
            />
            <div className="relative bg-white border-t border-black/[0.08] rounded-t-[28px] shadow-[0_-20px_50px_rgba(0,0,0,0.16)] px-5 pt-3 pb-7 space-y-3.5 max-h-[88dvh] modal-scroll-body animate-ios-sheet min-w-0">
              <div
                aria-hidden="true"
                className="w-10 h-1 rounded-full bg-black/15 mx-auto"
              />

              <div className="flex items-center justify-between gap-3 pt-0.5 min-w-0">
                <div className="min-w-0 flex-1">
                  <h2 className="text-[18px] font-semibold tracking-tight text-[#1D1D1F] break-words">
                    Ferramentas de Gestão
                  </h2>
                  <p className="text-xs text-[#86868B] break-words mt-0.5">
                    Módulos administrativos, calendário letivo e nuvem
                  </p>
                </div>
                <motion.button
                  type="button"
                  whileTap={tapAnimation}
                  onClick={() => {
                    triggerMenuHaptic('light');
                    setShowMoreMenu(false);
                  }}
                  className="w-9 h-9 rounded-full bg-[#F5F5F7] hover:bg-[#E8E8ED] flex items-center justify-center text-[#424245] cursor-pointer transition-colors shrink-0"
                  aria-label="Fechar menu de gestão"
                >
                  <SFSymbol name="close" size={19} weight={500} />
                </motion.button>
              </div>

              {/* Cartão Apple de Nuvem & Sincronização */}
              <div className="p-3.5 rounded-2xl bg-[#F5F5F7] border border-black/[0.06] text-[#1D1D1F] flex items-center justify-between gap-3 min-w-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white ${
                      isActivelySyncing
                        ? 'bg-[#0071E3]'
                        : hasPendingCloud
                        ? 'bg-[#B25000]'
                        : 'bg-[#1B873F]'
                    }`}
                  >
                    <SFSymbol
                      name={
                        isActivelySyncing
                          ? 'sync'
                          : hasPendingCloud
                          ? 'cloud_upload'
                          : 'cloud_done'
                      }
                      filled
                      size={20}
                      className={isActivelySyncing ? 'animate-spin' : ''}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[#1D1D1F] leading-snug">
                        {hasPendingCloud
                          ? `${unifiedPendingCount} pendência(s)`
                          : 'Nuvem Sincronizada'}
                      </span>
                      <span
                        data-status={hasPendingCloud ? 'warning' : 'success'}
                        className="px-2 py-0.5 rounded-full text-[10.5px] font-medium text-white leading-none"
                      >
                        {isActivelySyncing
                          ? 'Enviando'
                          : hasPendingCloud
                          ? 'Pendente'
                          : 'Ativo'}
                      </span>
                    </div>
                    <span className="text-[11.5px] text-[#86868B] block break-words mt-0.5">
                      Sincronização automática em segundo plano
                    </span>
                  </div>
                </div>
                <motion.button
                  type="button"
                  whileTap={tapAnimation}
                  onClick={handleManualSync}
                  disabled={isFlushingCloud}
                  className="min-h-[36px] px-3.5 py-1.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-medium text-xs inline-flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors disabled:opacity-55"
                >
                  <SFSymbol
                    name="sync"
                    size={15}
                    weight={500}
                    className={isFlushingCloud ? 'animate-spin' : ''}
                  />
                  <span>{isFlushingCloud ? 'Enviando' : 'Sincronizar'}</span>
                </motion.button>
              </div>

              {/* Lista de Módulos */}
              <div className="space-y-2">
                {adminMoreItems.map((item) => {
                  const isActive =
                    currentScreen === item.id ||
                    (item.id === 'usuarios_acesso' &&
                      currentScreen === 'importar_deficiencias_htm');
                  return (
                    <motion.button
                      key={item.id}
                      type="button"
                      whileTap={prefersReducedMotion ? undefined : { scale: 0.985 }}
                      onClick={() => {
                        triggerMenuHaptic('light');
                        setShowMoreMenu(false);
                        onChangeScreen(item.id);
                      }}
                      className={`w-full p-3 rounded-2xl border flex items-center justify-between gap-3 text-left transition-all duration-150 cursor-pointer min-w-0 ${
                        isActive
                          ? 'bg-[#0071E3] border-transparent text-white'
                          : 'bg-[#F5F5F7]/70 hover:bg-[#F5F5F7] border-black/[0.05] text-[#1D1D1F]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            isActive ? 'bg-white/20 text-white' : item.iconBgClass
                          }`}
                        >
                          <SFSymbol
                            name={item.symbolName}
                            filled
                            size={20}
                            weight={500}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="font-semibold text-[14.5px] block break-words leading-snug">
                            {item.label}
                          </span>
                          <span
                            className={`text-xs block break-words leading-snug mt-0.5 ${
                              isActive ? 'text-white/85' : 'text-[#86868B]'
                            }`}
                          >
                            {item.description}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                          isActive
                            ? 'bg-white/15 text-white'
                            : 'bg-white text-[#86868B]'
                        }`}
                      >
                        <SFSymbol name="chevron_right" size={18} weight={500} />
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              {onLogout && (
                <div className="pt-1">
                  <motion.button
                    type="button"
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.985 }}
                    onClick={() => {
                      triggerMenuHaptic('medium');
                      setShowMoreMenu(false);
                      setShowLogoutConfirm(true);
                    }}
                    className="w-full min-h-[46px] py-2.5 px-4 rounded-full text-[#D70015] bg-[#D70015]/8 hover:bg-[#D70015]/14 font-medium text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <SFSymbol name="logout" filled size={18} weight={500} />
                    <span>Encerrar Sessão</span>
                  </motion.button>
                </div>
              )}
            </div>
          </div>
        </ModalPortal>
      )}

      {showLogoutConfirm && (
        <ModalPortal onClose={() => setShowLogoutConfirm(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar saída"
            className="fixed inset-0 z-[130] flex items-center justify-center p-4"
          >
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-md"
              onClick={() => setShowLogoutConfirm(false)}
            />
            <div className="relative bg-white border border-black/[0.08] rounded-3xl p-6 max-w-sm w-full shadow-[0_24px_64px_rgba(0,0,0,0.2)] space-y-4 animate-gentle-fade text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#D70015]/10 text-[#D70015] flex items-center justify-center mx-auto">
                <SFSymbol name="logout" filled size={22} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-[#1D1D1F]">Deseja realmente sair?</h3>
                <p className="text-xs text-[#86868B] leading-relaxed">
                  Sua sessão será encerrada e você retornará à tela de identificação institucional.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="min-h-[44px] py-2 px-4 rounded-full bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] text-xs font-medium cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    onLogout?.();
                  }}
                  className="min-h-[44px] py-2 px-4 rounded-full bg-[#D70015] hover:bg-[#B80012] text-white text-xs font-medium cursor-pointer transition-colors"
                >
                  Sim, sair
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
};
