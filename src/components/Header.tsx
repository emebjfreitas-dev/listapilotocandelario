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
      iconBgClass: 'bg-[#B25000]/10 text-[#B25000]',
    },
    {
      id: 'dias_letivos',
      label: 'Calendário Escolar',
      subtitle: '200 dias letivos, janela de faltas e alertas FCM',
      symbolName: 'calendar_month',
      iconBgClass: 'bg-[#1B873F]/10 text-[#1B873F]',
    },
    {
      id: 'usuarios_acesso',
      label: 'Central Administrativa',
      subtitle: 'Docentes, perfis RBAC, segurança LGPD e importações',
      symbolName: 'admin_panel_settings',
      iconBgClass: 'bg-[#0071E3]/10 text-[#0071E3]',
    },
    {
      id: 'diagnostico_bd',
      label: 'Sistema & Nuvem',
      subtitle: 'Diagnóstico BD, Sheets, Drive Backup, cache e PWA',
      symbolName: 'database',
      iconBgClass: 'bg-[#424245]/10 text-[#1D1D1F]',
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
        className="fixed top-0 left-0 right-0 w-full z-40 pt-safe bg-white/86 backdrop-blur-2xl border-b border-black/[0.06] shadow-[0_1px_0_rgba(0,0,0,0.03)]"
      >
        <div className="relative h-14 sm:h-16 px-3 sm:px-5 lg:px-6 max-w-[1600px] mx-auto flex items-center justify-between gap-2 lg:gap-4 xl:gap-6 min-w-0">
          {/* Indicador sutil de gesto deslizante no topo em telas touch */}
          {!isFullscreen && (
            <span
              aria-hidden="true"
              className="sm:hidden pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full bg-black/15"
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
              <span className="text-[14px] sm:text-[15px] xl:text-[16px] font-semibold tracking-[-0.02em] text-[#1D1D1F] group-hover:text-[#0071E3] transition-colors truncate leading-tight">
                <span className="sm:hidden">Lista Piloto 2027</span>
                <span className="hidden sm:inline">Lista Piloto Candelário 2027</span>
              </span>
              <span className="hidden md:block text-[10.5px] font-medium text-[#86868B] tracking-wide uppercase">
                Prefeitura de Jundiaí · EMEB J. Candelário
              </span>
            </div>
          </motion.button>

          {/* Zona 2: Navegação Principal Estilo Apple (lg+) */}
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
                  className={`relative h-9 px-3 xl:px-3.5 rounded-full text-[13px] transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    item.activeMatch
                      ? 'text-white font-medium bg-[#0071E3] shadow-[0_2px_8px_rgba(0,113,227,0.28)]'
                      : 'text-[#424245] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] font-medium'
                  }`}
                >
                  <SFSymbol
                    name={item.symbolName}
                    filled={item.activeMatch}
                    size={18}
                    weight={item.activeMatch ? 500 : 420}
                    className={item.activeMatch ? 'text-white' : 'text-[#86868B]'}
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
                    className={`relative h-9 px-3 xl:px-3.5 rounded-full text-[13px] transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                      isAdminScreenActive || showAdminNavDropdown
                        ? 'text-white font-medium bg-[#0071E3] shadow-[0_2px_8px_rgba(0,113,227,0.28)]'
                        : 'text-[#424245] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] font-medium'
                    }`}
                  >
                    <SFSymbol
                      name="tune"
                      filled={isAdminScreenActive || showAdminNavDropdown}
                      size={18}
                      weight={isAdminScreenActive || showAdminNavDropdown ? 500 : 420}
                      className={
                        isAdminScreenActive || showAdminNavDropdown
                          ? 'text-white'
                          : 'text-[#86868B]'
                      }
                    />
                    <span>Gestão</span>
                    {syncSnapshot.pendingCount > 0 && (
                      <span
                        className="w-2 h-2 rounded-full bg-[#B25000] shrink-0"
                        title={`${syncSnapshot.pendingCount} pendente(s)`}
                      />
                    )}
                    <SFSymbol
                      name="keyboard_arrow_down"
                      size={17}
                      weight={420}
                      className={`transition-transform duration-150 ${
                        showAdminNavDropdown
                          ? 'rotate-180 text-white'
                          : isAdminScreenActive
                          ? 'text-white'
                          : 'text-[#86868B]'
                      }`}
                    />
                  </motion.button>

                  {showAdminNavDropdown && (
                    <div className="absolute right-0 mt-2.5 w-[min(23.5rem,calc(100vw-1.5rem))] bg-white/96 backdrop-blur-2xl rounded-2xl border border-black/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.14),0_4px_12px_rgba(0,0,0,0.06)] p-3 space-y-2 z-50 animate-apple-pop">
                      <div className="px-2 pt-0.5 pb-1 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                          Ferramentas de Gestão
                        </span>
                        <span
                          data-status={syncSnapshot.pendingCount > 0 ? 'warning' : 'success'}
                          className="px-2 py-0.5 rounded-full text-[10.5px] font-medium text-white leading-none"
                        >
                          {syncSnapshot.pendingCount > 0
                            ? `${syncSnapshot.pendingCount} pendente(s)`
                            : 'Nuvem Ativa'}
                        </span>
                      </div>

                      <div className="space-y-1">
                        {adminEssentialItems.map((item) => {
                          const active =
                            currentScreen === item.id ||
                            (item.id === 'usuarios_acesso' &&
                              currentScreen === 'importar_deficiencias_htm');
                          return (
                            <motion.button
                              key={item.id}
                              type="button"
                              whileTap={prefersReducedMotion ? undefined : { scale: 0.985 }}
                              onClick={() => navigateTo(item.id)}
                              className={`w-full px-3 py-2.5 rounded-xl text-left flex items-center gap-3 transition-all duration-150 cursor-pointer min-w-0 ${
                                active
                                  ? 'bg-[#0071E3] text-white'
                                  : 'bg-[#F5F5F7]/70 text-[#1D1D1F] hover:bg-[#F5F5F7]'
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
                                  size={19}
                                  weight={500}
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="text-sm font-semibold block break-words leading-snug">
                                  {item.label}
                                </span>
                                <span
                                  className={`text-xs block break-words leading-snug mt-0.5 ${
                                    active ? 'text-white/85' : 'text-[#86868B]'
                                  }`}
                                >
                                  {item.subtitle}
                                </span>
                              </div>
                              <SFSymbol
                                name="chevron_right"
                                size={18}
                                weight={450}
                                className={active ? 'text-white/85' : 'text-[#86868B]'}
                              />
                            </motion.button>
                          );
                        })}
                      </div>

                      {/* Cartão Apple Limpo de Sincronização em Nuvem */}
                      <div className="pt-1 border-t border-black/[0.06]">
                        <div className="p-3 rounded-xl bg-[#F5F5F7] border border-black/[0.05] text-[#1D1D1F] flex items-center justify-between gap-2.5 min-w-0">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white ${
                                unifiedIsSyncing
                                  ? 'bg-[#0071E3]'
                                  : unifiedPendingCount > 0
                                  ? 'bg-[#B25000]'
                                  : 'bg-[#1B873F]'
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
                                size={17}
                                className={unifiedIsSyncing ? 'animate-spin' : ''}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-semibold text-[#1D1D1F] block break-words">
                                {unifiedPendingCount > 0
                                  ? `${unifiedPendingCount} pendente(s) na fila`
                                  : 'Nuvem sincronizada'}
                              </span>
                              <span className="text-[11px] text-[#86868B] block break-words">
                                Envio automático ativo
                              </span>
                            </div>
                          </div>
                          <motion.button
                            type="button"
                            whileTap={tapAnimation}
                            onClick={handleCloudFlushClick}
                            disabled={isFlushingCloud}
                            className="min-h-[32px] px-3 py-1 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors disabled:opacity-50"
                          >
                            <SFSymbol
                              name="sync"
                              size={14}
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
              className={`h-9 w-9 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 border ${
                isFullscreen
                  ? 'bg-[#0071E3] border-transparent text-white shadow-[0_2px_8px_rgba(0,113,227,0.28)]'
                  : 'bg-[#F5F5F7] border-black/[0.06] hover:bg-[#E8E8ED] text-[#424245] hover:text-[#1D1D1F]'
              }`}
            >
              <SFSymbol
                name={isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
                size={19}
                weight={440}
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
                className="h-9 pl-1.5 pr-2 sm:pr-3 rounded-full bg-[#F5F5F7] hover:bg-[#E8E8ED] border border-black/[0.06] flex items-center gap-1.5 sm:gap-2 cursor-pointer transition-colors whitespace-nowrap shrink-0"
              >
                <StudentAvatar
                  name={userName || userEmail || 'Educador'}
                  size="xs"
                  expandableOnClick={false}
                  className="w-6 h-6 text-[11px] rounded-full bg-[#0071E3] text-white"
                />
                <span className="hidden sm:inline text-[13px] font-medium text-[#1D1D1F] max-w-[78px] truncate">
                  {roleShortLabel}
                </span>
                <SFSymbol
                  name="keyboard_arrow_down"
                  size={16}
                  weight={440}
                  className={`hidden sm:inline-flex text-[#86868B] transition-transform duration-150 ${
                    showProfileMenu ? 'rotate-180 text-[#1D1D1F]' : ''
                  }`}
                />
              </motion.button>

              {showProfileMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowProfileMenu(false)}
                  />
                  <div className="absolute right-0 mt-2.5 w-[min(20rem,calc(100vw-1.5rem))] bg-white/96 backdrop-blur-2xl rounded-2xl border border-black/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.14),0_4px_12px_rgba(0,0,0,0.06)] p-3 z-50 animate-apple-pop space-y-2">
                    <div className="p-3 rounded-xl bg-[#F5F5F7] border border-black/[0.04] flex items-center gap-3 min-w-0">
                      <StudentAvatar
                        name={userName || userEmail || 'Educador'}
                        size="sm"
                        expandableOnClick={false}
                        className="w-10 h-10 text-sm shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#1D1D1F] break-words leading-snug">
                          {userName || 'Professor(a)'}
                        </p>
                        <p className="text-xs font-medium text-[#0071E3] break-all leading-snug mt-0.5">
                          {userEmail || ''}
                        </p>
                        <p className="text-xs text-[#86868B] mt-0.5">
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
                          className="w-full min-h-[40px] text-left px-3 py-2 rounded-xl text-sm text-[#0071E3] hover:bg-[#0071E3]/8 flex items-center gap-2.5 cursor-pointer font-medium transition-colors"
                        >
                          <SFSymbol name="manage_accounts" filled size={18} />
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
                      className="w-full min-h-[40px] text-left px-3 py-2 rounded-xl text-sm text-[#D70015] hover:bg-[#D70015]/8 flex items-center gap-2.5 cursor-pointer font-medium transition-colors"
                    >
                      <SFSymbol name="logout" filled size={18} />
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
            className="fixed inset-0 z-[130] overflow-hidden bg-black/40 backdrop-blur-md flex items-end sm:items-center justify-center p-3 sm:p-4 animate-backdrop-in"
            onClick={() => !isLoggingOut && setShowLogoutSheet(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[380px] bg-white border border-black/[0.08] rounded-3xl shadow-[0_24px_64px_rgba(0,0,0,0.22)] overflow-hidden text-center p-6 space-y-4 animate-apple-pop"
            >
              <div className="mx-auto w-14 h-14 rounded-full bg-[#F5F5F7] flex items-center justify-center">
                <StudentAvatar
                  name={userName || userEmail || 'Educador'}
                  size="md"
                  expandableOnClick={false}
                  className="w-14 h-14 text-base"
                />
              </div>

              <div className="space-y-1.5 min-w-0">
                <h2 className="text-lg font-semibold text-[#1D1D1F] break-words">
                  Encerrar Sessão Institucional?
                </h2>
                <p className="text-sm text-[#86868B] break-words leading-snug">
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

              <div className="pt-2 space-y-2">
                <motion.button
                  type="button"
                  whileTap={tapAnimation}
                  disabled={isLoggingOut}
                  onClick={handleConfirmLogoutWithFlush}
                  className="w-full min-h-[46px] text-sm font-medium rounded-full bg-[#D70015] hover:bg-[#B80012] text-white transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
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
                  className="w-full min-h-[44px] text-sm font-medium rounded-full bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] transition-colors cursor-pointer"
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
