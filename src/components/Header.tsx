import React, { useState, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  AttendanceWindowConfig,
  AuthorizedUser,
  ClassGroup,
  ScreenType,
  UserRole,
} from '../types';
import { APP_LOGO_URL, APP_LOGO_FALLBACK_URL, SCHOOL_NAME } from '../data/mockData';
import { StudentAvatar } from './StudentAvatar';
import { PushNotificationCenter } from './PushNotificationCenter';
import { PWAInstallButton } from './PWAInstallButton';
import {
  subscribeToSyncStatus,
  SyncStatusSnapshot,
} from '../services/firebaseSync';
import { flushPendingOfflineQueue } from '../services/db';
import { SyncQueueManager, SyncQueueManagerSnapshot } from '../services/syncQueueManager';
import { ModalPortal } from './ui/ModalPortal';
import { SFSymbol } from './ui/SFSymbol';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import { triggerMenuHaptic } from '../utils/haptics';
import { useFullscreen } from '../hooks/useFullscreen';

interface HeaderProps {
  currentScreen: ScreenType;
  userEmail?: string;
  userName?: string;
  userRole?: UserRole;
  teacherRoleType?: AuthorizedUser['teacherRoleType'];
  assignedClassIds?: string[];
  attendanceWindowConfig?: AttendanceWindowConfig;
  visibleClasses?: ClassGroup[];
  allClasses?: ClassGroup[];
  instantSheetSyncStatus?: 'idle' | 'syncing' | 'synced';
  onRestoreAdminRole?: () => void;
  onChangeScreen?: (screen: ScreenType) => void;
  onSelectClassById?: (classId: string) => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentScreen,
  userEmail,
  userName,
  userRole = 'admin',
  teacherRoleType,
  assignedClassIds = [],
  attendanceWindowConfig,
  visibleClasses = [],
  allClasses = [],
  instantSheetSyncStatus = 'idle',
  onRestoreAdminRole,
  onChangeScreen,
  onSelectClassById,
  onLogout,
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLogoutSheet, setShowLogoutSheet] = useState(false);
  useModalScrollLock(showLogoutSheet);
  const prefersReducedMotion = useReducedMotion();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isFlushingCloud, setIsFlushingCloud] = useState(false);
  const [showAdminNavDropdown, setShowAdminNavDropdown] = useState(false);
  const { isFullscreen, enterFullscreen, exitFullscreen, toggleFullscreen } = useFullscreen();
  const headerTouchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const adminMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(e.target as Node)) {
        setShowAdminNavDropdown(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    if (showAdminNavDropdown || showProfileMenu) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showAdminNavDropdown, showProfileMenu]);

  const unifiedPendingCount = Math.max(syncSnapshot.pendingCount, queueSnapshot.pendingTasksCount);
  const unifiedIsSyncing =
    isFlushingCloud ||
    syncSnapshot.status === 'syncing' ||
    queueSnapshot.isProcessing ||
    instantSheetSyncStatus === 'syncing';

  const handleCloudFlushClick = async () => {
    if (isFlushingCloud) return;
    triggerMenuHaptic('medium');
    setIsFlushingCloud(true);
    try {
      await Promise.all([SyncQueueManager.flushNow(), flushPendingOfflineQueue()]);
    } catch (err) {
      console.warn('Aviso ao sincronizar nuvem Firebase:', err);
    } finally {
      setIsFlushingCloud(false);
    }
  };

  const handleConfirmLogoutWithFlush = async () => {
    if (isLoggingOut) return;
    triggerMenuHaptic('medium');
    setIsLoggingOut(true);
    try {
      if (unifiedPendingCount > 0) {
        await Promise.race([
          Promise.all([SyncQueueManager.flushNow(), flushPendingOfflineQueue()]),
          new Promise((resolve) => setTimeout(resolve, 1800)),
        ]);
      }
    } catch {
      // safe fallback
    } finally {
      setIsLoggingOut(false);
      setShowLogoutSheet(false);
      setShowProfileMenu(false);
      onLogout();
    }
  };

  if (currentScreen === 'login') return null;

  const isAdmin =
    userRole === 'admin' && teacherRoleType !== 'apoio' && teacherRoleType !== 'aee';

  const navigateTo = (screen: ScreenType) => {
    triggerMenuHaptic('light');
    setShowAdminNavDropdown(false);
    setShowProfileMenu(false);
    onChangeScreen?.(screen);
  };

  const primaryNavItems: Array<{
    id: ScreenType;
    label: string;
    activeMatch: boolean;
    symbolName: string;
  }> = [
    {
      id: 'home',
      label: 'Início',
      activeMatch: currentScreen === 'home',
      symbolName: 'home',
    },
    {
      id: userRole === 'usuario' ? 'detalhes' : 'turmas',
      label: userRole === 'usuario' ? 'Minha Turma' : 'Turmas',
      activeMatch: currentScreen === 'turmas' || currentScreen === 'detalhes',
      symbolName: 'groups',
    },
    ...(userRole !== 'peb2'
      ? [
          {
            id: 'frequencia_mensal' as ScreenType,
            label: 'Faltas do Mês',
            activeMatch: currentScreen === 'frequencia_mensal',
            symbolName: 'event_available',
          },
        ]
      : []),
    {
      id: 'faltas_consecutivas',
      label: 'Busca Ativa',
      activeMatch: currentScreen === 'faltas_consecutivas',
      symbolName: 'gpp_maybe',
    },
  ];

  const adminEssentialItems: Array<{
    id: ScreenType;
    label: string;
    subtitle: string;
    symbolName: string;
    iconBgClass: string;
  }> = [
    {
      id: 'bolsa_familia',
      label: 'Bolsa Família',
      subtitle: 'Beneficiários e apuração bimestral de faltas',
      symbolName: 'volunteer_activism',
      iconBgClass: 'bg-[#b45309] text-white shadow-[0_4px_10px_rgba(180,83,9,0.24)]',
    },
    {
      id: 'dias_letivos',
      label: 'Calendário Escolar',
      subtitle: 'Dias letivos, bimestres e meta de 200 dias',
      symbolName: 'calendar_month',
      iconBgClass: 'bg-[#047857] text-white shadow-[0_4px_10px_rgba(4,120,87,0.24)]',
    },
    {
      id: 'usuarios_acesso',
      label: 'Central Administrativa',
      subtitle: 'Acessos, segurança, uploads e backup Drive',
      symbolName: 'admin_panel_settings',
      iconBgClass: 'bg-[#0e3a8a] text-white shadow-[0_4px_10px_rgba(14,58,138,0.28)]',
    },
    {
      id: 'diagnostico_bd',
      label: 'Diagnóstico & Banco',
      subtitle: 'Integridade da nuvem, fila e registros',
      symbolName: 'database',
      iconBgClass: 'bg-[#6d28d9] text-white shadow-[0_4px_10px_rgba(109,40,217,0.24)]',
    },
  ];

  const isAdminScreenActive = [
    'bolsa_familia',
    'usuarios_acesso',
    'dias_letivos',
    'diagnostico_bd',
    'importar_deficiencias_htm',
  ].includes(currentScreen);

  const roleShortLabel = isAdmin
    ? 'Admin'
    : teacherRoleType === 'aee'
    ? 'AEE'
    : teacherRoleType === 'apoio'
    ? 'Apoio'
    : userRole === 'usuario'
    ? 'PEB I'
    : 'PEB II';

  const tapAnimation = prefersReducedMotion ? undefined : { scale: 0.96 };

  const handleHeaderTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    headerTouchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
  };

  const handleHeaderTouchEnd = (e: React.TouchEvent<HTMLElement>) => {
    const start = headerTouchStartRef.current;
    headerTouchStartRef.current = null;
    if (!start) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const deltaY = touch.clientY - start.y;
    const deltaX = touch.clientX - start.x;
    const elapsed = Date.now() - start.time;
    if (elapsed > 650) return;

    const isMostlyVertical = Math.abs(deltaY) > Math.abs(deltaX) * 1.25;
    if (!isMostlyVertical) return;

    if (deltaY <= -30 && !isFullscreen) {
      triggerMenuHaptic('medium');
      void enterFullscreen(false);
    } else if (deltaY >= 46 && isFullscreen) {
      triggerMenuHaptic('light');
      void exitFullscreen();
    }
  };

  return (
    <>
      <header
        onTouchStart={handleHeaderTouchStart}
        onTouchEnd={handleHeaderTouchEnd}
        className="fixed top-0 left-0 right-0 w-full z-40 pt-safe bg-white/96 backdrop-blur-2xl border-b border-slate-200/90 shadow-[0_4px_24px_rgba(15,23,42,0.06),0_1px_0_rgba(255,255,255,0.8)_inset]"
      >
        <div className="relative h-14 sm:h-16 px-3 sm:px-5 lg:px-6 max-w-[1600px] mx-auto flex items-center justify-between gap-2 lg:gap-4 xl:gap-6 min-w-0">
          {/* Indicador sutil de gesto deslizante no topo em telas touch */}
          {!isFullscreen && (
            <span
              aria-hidden="true"
              className="sm:hidden pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full bg-slate-300/80"
            />
          )}

          {/* Zona 1: Identidade Institucional */}
          <motion.button
            type="button"
            whileTap={tapAnimation}
            onClick={() => navigateTo('home')}
            className="flex items-center gap-2 sm:gap-3 cursor-pointer group select-none min-w-0 shrink text-left min-h-[44px]"
            title="Ir para o Início"
          >
            <span className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <img
                src={APP_LOGO_URL}
                alt="Brasão de Jundiaí"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = APP_LOGO_FALLBACK_URL;
                }}
                className="w-full h-full object-contain drop-shadow-xs"
              />
            </span>
            <div className="flex flex-col min-w-0">
              <span className="text-[14px] sm:text-[15px] xl:text-[16px] font-bold tracking-[-0.02em] text-slate-900 group-hover:text-[#1649a8] transition-colors truncate leading-tight">
                <span className="sm:hidden">Lista Piloto 2027</span>
                <span className="hidden sm:inline">Lista Piloto Candelário 2027</span>
              </span>
              <span className="hidden md:block text-[10.5px] font-bold text-slate-700 tracking-wide uppercase">
                Prefeitura de Jundiaí · EMEB J. Candelário
              </span>
            </div>
          </motion.button>

          {/* Zona 2: Navegação Principal Limpa com Ícones SF Symbols (lg+) */}
          {onChangeScreen && (
            <nav
              aria-label="Navegação Principal"
              className="hidden lg:flex items-center gap-1 xl:gap-1.5 h-full shrink-0"
            >
              {primaryNavItems.map((item) => (
                <motion.button
                  key={item.id}
                  type="button"
                  whileTap={tapAnimation}
                  onClick={() => navigateTo(item.id)}
                  aria-current={item.activeMatch ? 'page' : undefined}
                  className={`relative h-9 px-2.5 xl:px-3.5 rounded-xl text-[13px] xl:text-[13.5px] transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    item.activeMatch
                      ? 'text-white font-semibold bg-[#1649a8] shadow-[0_4px_14px_rgba(22,73,168,0.3)] after:content-[""] after:absolute after:-bottom-1 after:inset-x-3 after:h-[2.5px] after:bg-sky-400 after:rounded-full'
                      : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100 font-semibold'
                  }`}
                >
                  <SFSymbol
                    name={item.symbolName}
                    filled={item.activeMatch}
                    size={19}
                    weight={item.activeMatch ? 530 : 450}
                    className={item.activeMatch ? 'text-white' : 'text-[#1649a8]'}
                  />
                  <span>{item.label}</span>
                </motion.button>
              ))}

              {/* Menu Gestão (Apenas Admin) */}
              {isAdmin && (
                <div className="relative" ref={adminMenuRef}>
                  <motion.button
                    type="button"
                    whileTap={tapAnimation}
                    onClick={() => {
                      triggerMenuHaptic('light');
                      setShowAdminNavDropdown((prev) => !prev);
                      setShowProfileMenu(false);
                    }}
                    aria-expanded={showAdminNavDropdown}
                    className={`relative h-9 px-2.5 xl:px-3.5 rounded-xl text-[13px] xl:text-[13.5px] transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                      isAdminScreenActive || showAdminNavDropdown
                        ? 'text-white font-semibold bg-[#1649a8] shadow-[0_4px_14px_rgba(22,73,168,0.3)] after:content-[""] after:absolute after:-bottom-1 after:inset-x-3 after:h-[2.5px] after:bg-sky-400 after:rounded-full'
                        : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100 font-semibold'
                    }`}
                  >
                    <SFSymbol
                      name="tune"
                      filled={isAdminScreenActive || showAdminNavDropdown}
                      size={19}
                      weight={isAdminScreenActive || showAdminNavDropdown ? 530 : 450}
                      className={
                        isAdminScreenActive || showAdminNavDropdown
                          ? 'text-white'
                          : 'text-[#1649a8]'
                      }
                    />
                    <span>Gestão</span>
                    {syncSnapshot.pendingCount > 0 && (
                      <span
                        className="w-2 h-2 rounded-full bg-[#f59e0b] shrink-0"
                        title={`${syncSnapshot.pendingCount} pendente(s)`}
                      />
                    )}
                    <SFSymbol
                      name="keyboard_arrow_down"
                      size={18}
                      weight={450}
                      className={`transition-transform duration-150 ${
                        showAdminNavDropdown
                          ? 'rotate-180 text-white'
                          : isAdminScreenActive
                          ? 'text-white'
                          : 'text-slate-600'
                      }`}
                    />
                  </motion.button>

                  {showAdminNavDropdown && (
                    <div className="absolute right-0 mt-2.5 w-[min(23.5rem,calc(100vw-1.5rem))] bg-white rounded-3xl shadow-[0_24px_56px_rgba(7,30,70,0.28),0_4px_14px_rgba(7,30,70,0.12)] p-3 space-y-2 z-50 animate-apple-pop">
                      <div className="px-2.5 pt-1 pb-0.5 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0e3a8a]">
                          Ferramentas de Gestão
                        </span>
                        <span
                          data-status={syncSnapshot.pendingCount > 0 ? 'warning' : 'success'}
                          className="px-2 py-0.5 rounded-md text-[10.5px] font-medium text-white leading-none"
                        >
                          {syncSnapshot.pendingCount > 0
                            ? `${syncSnapshot.pendingCount} pendente(s)`
                            : 'Nuvem Ativa'}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {adminEssentialItems.map((item) => {
                          const active =
                            currentScreen === item.id ||
                            (item.id === 'usuarios_acesso' &&
                              currentScreen === 'importar_deficiencias_htm');
                          return (
                            <motion.button
                              key={item.id}
                              type="button"
                              whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                              onClick={() => navigateTo(item.id)}
                              className={`w-full px-3 py-2.5 rounded-2xl text-left flex items-center gap-3 transition-all duration-150 cursor-pointer min-w-0 ${
                                active
                                  ? 'bg-gradient-to-r from-[#0e3a8a] to-[#1649a8] text-white shadow-[0_8px_20px_rgba(14,58,138,0.32)]'
                                  : 'bg-[#f2f6fc] text-[#071e46] hover:bg-[#e5edf9]'
                              }`}
                            >
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                  active ? 'bg-white/20 text-white' : item.iconBgClass
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
                                <span className="text-sm font-semibold block break-words leading-snug">
                                  {item.label}
                                </span>
                                <span
                                  className={`text-xs block break-words leading-snug mt-0.5 ${
                                    active ? 'text-blue-100' : 'text-slate-700'
                                  }`}
                                >
                                  {item.subtitle}
                                </span>
                              </div>
                              <SFSymbol
                                name="chevron_right"
                                size={18}
                                weight={500}
                                className={active ? 'text-blue-100' : 'text-[#0e3a8a]'}
                              />
                            </motion.button>
                          );
                        })}
                      </div>

                      {/* Cartão Navy Institucional de Sincronização em Nuvem dentro de Gestão */}
                      <div className="pt-0.5">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-[#071e46] via-[#0c2f6e] to-[#08224f] text-white flex items-center justify-between gap-2.5 min-w-0 shadow-[0_8px_20px_rgba(7,30,70,0.28)]">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div
                              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white ${
                                unifiedIsSyncing
                                  ? 'bg-[#1d4ed8]'
                                  : unifiedPendingCount > 0
                                  ? 'bg-[#b45309]'
                                  : 'bg-[#047857]'
                              }`}
                            >
                              <SFSymbol
                                name={
                                  unifiedIsSyncing
                                    ? 'sync'
                                    : unifiedPendingCount > 0
                                    ? 'cloud_upload'
                                    : 'cloud_done'
                                }
                                filled
                                size={18}
                                className={unifiedIsSyncing ? 'animate-spin' : ''}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-semibold text-white block break-words">
                                {unifiedPendingCount > 0
                                  ? `${unifiedPendingCount} pendente(s) na fila`
                                  : 'Nuvem sincronizada'}
                              </span>
                              <span className="text-[11px] text-blue-100/85 block break-words">
                                Envio automático ativo
                              </span>
                            </div>
                          </div>
                          <motion.button
                            type="button"
                            whileTap={tapAnimation}
                            onClick={handleCloudFlushClick}
                            disabled={isFlushingCloud}
                            className="min-h-[34px] px-3 py-1.5 rounded-xl bg-[#1d4ed8] hover:bg-[#2563eb] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors disabled:opacity-50"
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
                      </div>
                    </div>
                  )}
                </div>
              )}
            </nav>
          )}

          {/* Zona 3: Ações Rápidas e Perfil */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <PWAInstallButton variant="header" />

            <motion.button
              type="button"
              whileTap={tapAnimation}
              onClick={() => {
                triggerMenuHaptic('medium');
                void toggleFullscreen();
              }}
              aria-label={isFullscreen ? 'Sair do modo tela cheia' : 'Expandir para tela cheia'}
              title={
                isFullscreen
                  ? 'Sair da tela cheia'
                  : 'Expandir para tela cheia (ou deslize para cima no topo)'
              }
              className={`h-9 w-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                isFullscreen
                  ? 'bg-[#1649a8] text-white shadow-[0_4px_14px_rgba(22,73,168,0.3)]'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-950 shadow-2xs'
              }`}
            >
              <SFSymbol
                name={isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
                size={20}
                weight={480}
              />
            </motion.button>



            <PushNotificationCenter
              visibleClasses={visibleClasses}
              allClasses={allClasses}
              userRole={userRole}
              teacherRoleType={teacherRoleType}
              userEmail={userEmail}
              userName={userName}
              assignedClassIds={assignedClassIds}
              attendanceWindowConfig={attendanceWindowConfig}
              onNavigateScreen={(targetScreen, targetClassId) => {
                if (targetClassId && onSelectClassById) {
                  onSelectClassById(targetClassId);
                }
                navigateTo(targetScreen);
              }}
            />

            <div className="relative" ref={profileMenuRef}>
              <motion.button
                type="button"
                whileTap={tapAnimation}
                onClick={() => {
                  triggerMenuHaptic('light');
                  setShowProfileMenu((prev) => !prev);
                  setShowAdminNavDropdown(false);
                }}
                aria-label="Menu do perfil e sair"
                className="h-9 pl-1.5 pr-2 sm:pr-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center gap-1.5 sm:gap-2 cursor-pointer transition-colors whitespace-nowrap shrink-0 shadow-2xs"
              >
                <StudentAvatar
                  name={userName || userEmail || 'Educador'}
                  size="xs"
                  expandableOnClick={false}
                  className="w-6 h-6 text-[11px] rounded-lg bg-[#1649a8] text-white"
                />
                <span className="hidden sm:inline text-[13px] font-semibold text-slate-800 max-w-[78px] truncate">
                  {roleShortLabel}
                </span>
                <SFSymbol
                  name="keyboard_arrow_down"
                  size={17}
                  weight={480}
                  className={`hidden sm:inline-flex text-slate-600 transition-transform duration-150 ${
                    showProfileMenu ? 'rotate-180 text-slate-900' : ''
                  }`}
                />
              </motion.button>

              {showProfileMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowProfileMenu(false)}
                  />
                  <div className="absolute right-0 mt-2.5 w-[min(20rem,calc(100vw-1.5rem))] bg-white rounded-3xl shadow-[0_24px_56px_rgba(7,30,70,0.28),0_4px_14px_rgba(7,30,70,0.12)] p-3 z-50 animate-apple-pop space-y-2">
                    <div className="p-3 rounded-2xl bg-[#eef3fa] flex items-center gap-3 min-w-0">
                      <StudentAvatar
                        name={userName || userEmail || 'Educador'}
                        size="sm"
                        expandableOnClick={false}
                        className="w-10 h-10 text-sm shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#071e46] break-words leading-snug">
                          {userName || 'Professor(a)'}
                        </p>
                        <p className="text-xs font-medium text-[#0e3a8a] break-all leading-snug mt-0.5">
                          {userEmail || ''}
                        </p>
                        <p className="text-xs font-medium text-slate-700 mt-0.5">
                          {isAdmin
                            ? 'Equipe Administrativa'
                            : teacherRoleType === 'aee'
                            ? 'Educação Especial (AEE)'
                            : teacherRoleType === 'apoio'
                            ? 'Apoio Pedagógico'
                            : userRole === 'usuario'
                            ? 'Docente Regente (PEB I)'
                            : 'Docente Especialista (PEB II)'}
                        </p>
                      </div>
                    </div>

                    {!isAdmin &&
                      onRestoreAdminRole &&
                      userEmail?.trim().toLowerCase().startsWith('emebjfreitas@') && (
                        <motion.button
                          type="button"
                          whileTap={tapAnimation}
                          onClick={() => {
                            triggerMenuHaptic('light');
                            setShowProfileMenu(false);
                            onRestoreAdminRole();
                          }}
                          className="w-full min-h-[42px] text-left px-3.5 py-2 rounded-2xl text-sm text-[#0e3a8a] hover:bg-[#e5edf9] flex items-center gap-2.5 cursor-pointer font-semibold transition-colors"
                        >
                          <SFSymbol name="manage_accounts" filled size={19} />
                          <span>Voltar ao Perfil Administrador</span>
                        </motion.button>
                      )}

                    <PWAInstallButton variant="menu" />

                    <motion.button
                      type="button"
                      whileTap={tapAnimation}
                      onClick={() => {
                        triggerMenuHaptic('medium');
                        setShowProfileMenu(false);
                        setShowLogoutSheet(true);
                      }}
                      className="w-full min-h-[42px] text-left px-3.5 py-2 rounded-2xl text-sm text-[#be123c] hover:bg-[#fff1f2] flex items-center gap-2.5 cursor-pointer font-semibold transition-colors"
                    >
                      <SFSymbol name="logout" filled size={19} />
                      <span>Encerrar Sessão</span>
                    </motion.button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Modal de Saída Segura */}
      {showLogoutSheet && (
        <ModalPortal onClose={() => !isLoggingOut && setShowLogoutSheet(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Encerrar sessão institucional"
            className="fixed inset-0 z-[130] overflow-hidden bg-[#050d1d]/65 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4 animate-backdrop-in"
            onClick={() => !isLoggingOut && setShowLogoutSheet(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[400px] bg-white rounded-3xl shadow-[0_28px_68px_rgba(2,6,23,0.45)] overflow-hidden text-center p-6 space-y-4 animate-apple-pop"
            >
              <div className="mx-auto w-14 h-14 rounded-full bg-[#eef3fa] flex items-center justify-center">
                <StudentAvatar
                  name={userName || userEmail || 'Educador'}
                  size="md"
                  expandableOnClick={false}
                  className="w-14 h-14 text-base"
                />
              </div>

              <div className="space-y-1.5 min-w-0">
                <h2 className="text-lg font-semibold text-[#0a2d6b] break-words">
                  Encerrar Sessão Institucional?
                </h2>
                <p className="text-sm text-slate-600 break-words leading-snug">
                  {(() => {
                    const displayIdentity = (userName || userEmail || '').trim();
                    if (!displayIdentity) return SCHOOL_NAME;
                    const norm = displayIdentity.toLowerCase();
                    if (norm.includes('emeb') || norm.includes('candelário') || norm.includes('candelario')) {
                      return displayIdentity;
                    }
                    return `${displayIdentity} · ${SCHOOL_NAME}`;
                  })()}
                </p>
              </div>

              <div className="pt-2 space-y-2.5">
                <motion.button
                  type="button"
                  whileTap={tapAnimation}
                  disabled={isLoggingOut}
                  onClick={handleConfirmLogoutWithFlush}
                  className="w-full min-h-[48px] text-sm font-semibold rounded-2xl bg-[#be123c] hover:bg-[#9f1239] text-white transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <SFSymbol name="logout" filled size={18} />
                  <span>{isLoggingOut ? 'Salvando e Saindo...' : 'Sim, Encerrar Sessão'}</span>
                </motion.button>

                <motion.button
                  type="button"
                  whileTap={tapAnimation}
                  disabled={isLoggingOut}
                  onClick={() => {
                    triggerMenuHaptic('light');
                    setShowLogoutSheet(false);
                  }}
                  className="w-full min-h-[44px] text-sm font-semibold rounded-2xl bg-[#eef3fa] hover:bg-[#dfe9f7] text-[#0a2d6b] transition-colors cursor-pointer"
                >
                  Continuar Conectado
                </motion.button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
};
