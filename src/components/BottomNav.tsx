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
      iconBgClass: 'bg-[#b45309] text-white shadow-[0_4px_12px_rgba(180,83,9,0.28)]',
    },
    {
      id: 'dias_letivos',
      label: 'Calendário Escolar',
      description: 'Dias letivos mensais, bimestres e meta de 200 dias',
      symbolName: 'calendar_month',
      iconBgClass: 'bg-[#047857] text-white shadow-[0_4px_12px_rgba(4,120,87,0.28)]',
    },
    {
      id: 'usuarios_acesso',
      label: 'Central Administrativa',
      description: 'Acessos, segurança, uploads e backup no Drive',
      symbolName: 'admin_panel_settings',
      iconBgClass: 'bg-[#0e3a8a] text-white shadow-[0_4px_12px_rgba(14,58,138,0.32)]',
    },
    {
      id: 'diagnostico_bd',
      label: 'Diagnóstico & Banco',
      description: 'Integridade da nuvem, fila de envio e registros',
      symbolName: 'database',
      iconBgClass: 'bg-[#6d28d9] text-white shadow-[0_4px_12px_rgba(109,40,217,0.28)]',
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
      {/* Barra de Navegação Inferior (Mobile & Tablet) */}
      <nav
        aria-label="Barra de Navegação Inferior"
        className="fixed bottom-0 left-0 right-0 w-full z-40 pb-safe bg-[#081326]/96 backdrop-blur-2xl shadow-[0_-1px_0_rgba(148,163,184,0.16),0_-12px_32px_rgba(2,6,23,0.65)] lg:hidden"
      >
        <div
          className={`grid ${gridColsClass} items-center h-[66px] px-2 max-w-lg mx-auto gap-1`}
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
                className="group relative flex flex-col items-center justify-center w-full min-w-0 min-h-[48px] h-full py-1.5 px-1 cursor-pointer select-none rounded-2xl"
              >
                <div className="relative flex items-center justify-center w-13 h-8 rounded-2xl">
                  {isActive && (
                    <motion.span
                      layoutId={prefersReducedMotion ? undefined : 'bottomNavActivePill'}
                      transition={{ type: 'spring', stiffness: 460, damping: 34, mass: 0.7 }}
                      aria-hidden="true"
                      className="absolute inset-0 rounded-2xl bg-gradient-to-b from-[#2563eb] to-[#1649a8] shadow-[0_6px_16px_rgba(37,99,235,0.45)]"
                    />
                  )}
                  <SFSymbol
                    name={item.symbolName}
                    filled={isActive}
                    size={21}
                    weight={isActive ? 540 : 410}
                    className={`relative z-10 ${
                      isActive
                        ? 'text-white'
                        : 'text-slate-300 group-hover:text-white'
                    }`}
                  />
                </div>
                <span
                  className={`text-[11px] tracking-tight leading-none mt-1.5 whitespace-nowrap truncate max-w-full transition-colors ${
                    isActive
                      ? 'font-semibold text-white'
                      : 'font-medium text-slate-300 group-hover:text-white'
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
              className="group relative flex flex-col items-center justify-center w-full min-w-0 min-h-[48px] h-full py-1.5 px-1 cursor-pointer select-none rounded-2xl"
            >
              <div className="relative flex items-center justify-center w-13 h-8 rounded-2xl">
                {(isMoreActive || showMoreMenu) && (
                  <motion.span
                    layoutId={prefersReducedMotion ? undefined : 'bottomNavActivePill'}
                    transition={{ type: 'spring', stiffness: 460, damping: 34, mass: 0.7 }}
                    aria-hidden="true"
                    className="absolute inset-0 rounded-2xl bg-gradient-to-b from-[#2563eb] to-[#1649a8] shadow-[0_6px_16px_rgba(37,99,235,0.45)]"
                  />
                )}
                <SFSymbol
                  name="tune"
                  filled={isMoreActive || showMoreMenu}
                  size={21}
                  weight={isMoreActive || showMoreMenu ? 540 : 410}
                  className={`relative z-10 ${
                    isMoreActive || showMoreMenu
                      ? 'text-white'
                      : 'text-slate-300 group-hover:text-white'
                  }`}
                />
                {hasPendingCloud && (
                  <span className="absolute -top-0.5 right-1 z-20 w-2.5 h-2.5 rounded-full bg-[#f59e0b] shadow-[0_0_0_2px_#081326]" />
                )}
              </div>
              <span
                className={`text-[11px] tracking-tight leading-none mt-1.5 whitespace-nowrap truncate max-w-full transition-colors ${
                  isMoreActive || showMoreMenu
                    ? 'font-semibold text-white'
                    : 'font-medium text-slate-300 group-hover:text-white'
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
              className="group flex flex-col items-center justify-center w-full min-w-0 min-h-[48px] h-full py-1.5 px-1 cursor-pointer select-none rounded-2xl"
            >
              <div className="flex items-center justify-center w-13 h-8 rounded-2xl bg-[#be123c]/25 text-rose-200 group-hover:bg-[#be123c]/40 transition-colors">
                <SFSymbol name="logout" filled size={20} weight={480} />
              </div>
              <span className="text-[11px] font-medium tracking-tight leading-none mt-1.5 whitespace-nowrap truncate max-w-full text-rose-200 group-hover:text-white">
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
              className="fixed inset-0 bg-[#050d1d]/70 backdrop-blur-sm animate-backdrop-in"
              onClick={() => {
                triggerMenuHaptic('light');
                setShowMoreMenu(false);
              }}
            />
            <div className="relative bg-white rounded-t-[28px] shadow-[0_-24px_60px_rgba(2,6,23,0.45)] px-5 pt-3 pb-7 space-y-3.5 max-h-[88dvh] modal-scroll-body animate-ios-sheet min-w-0">
              <div
                aria-hidden="true"
                className="w-10 h-1 rounded-full bg-slate-300 mx-auto"
              />

              <div className="flex items-center justify-between gap-3 pt-0.5 min-w-0">
                <div className="min-w-0 flex-1">
                  <h2 className="text-[18px] font-semibold tracking-tight text-[#071e46] break-words">
                    Ferramentas de Gestão
                  </h2>
                  <p className="text-xs text-slate-600 break-words mt-0.5">
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
                  className="w-10 h-10 rounded-full bg-[#eef3fa] hover:bg-[#dfe9f7] flex items-center justify-center text-[#0e3a8a] cursor-pointer transition-colors shrink-0"
                  aria-label="Fechar menu de gestão"
                >
                  <SFSymbol name="close" size={20} weight={500} />
                </motion.button>
              </div>

              {/* Cartão Navy Institucional de Nuvem & Sincronização */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#071e46] via-[#0c2f6e] to-[#08224f] text-white shadow-[0_12px_28px_rgba(7,30,70,0.28)] flex items-center justify-between gap-3 min-w-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white ${
                      isActivelySyncing
                        ? 'bg-[#1d4ed8]'
                        : hasPendingCloud
                        ? 'bg-[#b45309]'
                        : 'bg-[#047857]'
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
                      size={21}
                      className={isActivelySyncing ? 'animate-spin' : ''}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white leading-snug">
                        {hasPendingCloud
                          ? `${unifiedPendingCount} pendência(s)`
                          : 'Nuvem Sincronizada'}
                      </span>
                      <span
                        data-status={hasPendingCloud ? 'warning' : 'success'}
                        className="px-2 py-0.5 rounded-md text-[10.5px] font-medium text-white leading-none"
                      >
                        {isActivelySyncing
                          ? 'Enviando'
                          : hasPendingCloud
                          ? 'Pendente'
                          : 'Ativo'}
                      </span>
                    </div>
                    <span className="text-[11.5px] text-blue-100/85 block break-words mt-0.5">
                      Sincronização automática em segundo plano
                    </span>
                  </div>
                </div>
                <motion.button
                  type="button"
                  whileTap={tapAnimation}
                  onClick={handleManualSync}
                  disabled={isFlushingCloud}
                  className="min-h-[38px] px-3.5 py-2 rounded-xl bg-[#1d4ed8] hover:bg-[#2563eb] text-white font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors disabled:opacity-55 shadow-[0_4px_12px_rgba(29,78,216,0.4)]"
                >
                  <SFSymbol
                    name="sync"
                    size={16}
                    weight={500}
                    className={isFlushingCloud ? 'animate-spin' : ''}
                  />
                  <span>{isFlushingCloud ? 'Enviando' : 'Sincronizar'}</span>
                </motion.button>
              </div>

              {/* Lista de Módulos com Ícones SF Symbols e Navy Institucional */}
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
                      whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                      onClick={() => {
                        triggerMenuHaptic('light');
                        setShowMoreMenu(false);
                        onChangeScreen(item.id);
                      }}
                      className={`w-full p-3 rounded-2xl flex items-center justify-between gap-3 text-left transition-all duration-150 cursor-pointer min-w-0 ${
                        isActive
                          ? 'bg-gradient-to-r from-[#0e3a8a] to-[#1649a8] text-white shadow-[0_10px_24px_rgba(14,58,138,0.32)]'
                          : 'bg-[#f2f6fc] hover:bg-[#e5edf9] text-[#071e46]'
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
                            size={21}
                            weight={500}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="font-semibold text-[14.5px] block break-words leading-snug">
                            {item.label}
                          </span>
                          <span
                            className={`text-xs block break-words leading-snug mt-0.5 ${
                              isActive ? 'text-blue-100' : 'text-slate-700'
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
                            : 'bg-[#e2eaf6] text-[#0e3a8a]'
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
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                    onClick={() => {
                      triggerMenuHaptic('medium');
                      setShowMoreMenu(false);
                      setShowLogoutConfirm(true);
                    }}
                    className="w-full min-h-[48px] py-2.5 px-4 rounded-2xl text-[#9f1239] bg-[#fff1f2] hover:bg-[#ffe4e6] font-semibold text-sm flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <span className="w-7 h-7 rounded-lg bg-[#be123c] text-white flex items-center justify-center shrink-0">
                      <SFSymbol name="logout" filled size={16} weight={500} />
                    </span>
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
              className="absolute inset-0 bg-[#050d1d]/70 backdrop-blur-sm"
              onClick={() => setShowLogoutConfirm(false)}
            />
            <div className="relative bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-gentle-fade text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#fff1f2] text-[#be123c] flex items-center justify-center mx-auto shadow-xs">
                <SFSymbol name="logout" filled size={22} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-950">Deseja realmente sair?</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Sua sessão será encerrada e você retornará à tela de identificação institucional.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="min-h-[44px] py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    onLogout?.();
                  }}
                  className="min-h-[44px] py-2 px-4 rounded-xl bg-[#be123c] hover:bg-[#9f1239] text-white text-xs font-semibold cursor-pointer transition-colors shadow-xs"
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
