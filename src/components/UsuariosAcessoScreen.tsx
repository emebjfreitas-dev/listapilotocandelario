import React, { useState, useMemo, useEffect, Suspense } from 'react';
import {
  AuthorizedUser,
  ClassGroup,
  ScreenType,
  UserRole,
  AttendanceWindowConfig,
  UserAccessSessionLog,
  SecurityAuditLogEntry,
  LgpdProtectionConfig,
  FcmSystemConfig,
} from '../types';
import {
  INSTITUTIONAL_EMAIL_DOMAIN,
  INITIAL_AUTHORIZED_USERS,
  INITIAL_CLASSES,
  OFFICIAL_MATRIX_REVISION,
} from '../data/mockData';
import {
  isOfficialSchoolAdminEmail,
  isValidInstitutionalEmail,
  evaluateAttendanceLaunchWindow,
  formatDurationHuman,
  getStoredSecurityAuditLogs,
  addSecurityAuditLog,
  clearStoredSecurityAuditLogs,
  getStoredLgpdConfig,
  saveStoredLgpdConfig,
  pushLgpdConfigToServer,
  exportSecurityAuditLogsCSV,
  getLocalTodayDateISO,
  isUserAccessExpired,
  isUserAccessEffectivelyActive,
  formatAccessExpirationDateBR,
  getStoredOfficialCalendarConfig,
} from '../services/db';
import { SyncStatusSnapshot } from '../services/firebaseSync';
import { ExportFormatButton } from './ui/ExportFormatButton';
import { exportUniversalReport } from '../utils/universalExport';
import { buildSecurityAuditReport } from '../utils/reportBuilders';
import { lazyWithRetry } from '../utils/lazyWithRetry';
import { LazyErrorBoundary } from './ui/LazyErrorBoundary';
import {
  ArrowLeft,
  School,
  Users,
  ShieldCheck,
  Lock,
  Unlock,
  Activity,
  X,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Upload,
  Clock,
  Key,
  Database,
  FileCode2,
  BellRing,
  Images,
  FileText,
  CalendarDays,
  Loader2,
  Smartphone,
  Cloud,
} from 'lucide-react';
import {
  FcmBackendStatus,
  dispatchWindowClosingFcmAlert,
  fetchFcmBackendStatus,
  getStoredFcmSystemConfig,
  saveFcmSystemConfiguration,
} from '../services/fcmService';
import { AdminSecurityLogsTab } from './admin/AdminSecurityLogsTab';
import { AdminSessionLogsSection } from './admin/AdminSessionLogsSection';
import { AdminUserAssignModal } from './admin/AdminUserAssignModal';
import { AdminQuadroTurmasTab } from './admin/AdminQuadroTurmasTab';
import { AdminContasAcessoTab } from './admin/AdminContasAcessoTab';
import { AdminRbacMatrizTab } from './admin/AdminRbacMatrizTab';
import { AdminFcmAlertsCard } from './admin/AdminFcmAlertsCard';
import { AdminSystemCloudTab } from './admin/AdminSystemCloudTab';
import {
  ACCESS_LEVEL_META,
  AccessLevelKey,
  DraftUserEdit,
  MatrixDraft,
  ToggleSwitch,
  normalizeSearchText,
  resolveAccessLevel,
} from './admin/adminAccessUtils';

const AdminArrasteFotosModal = lazyWithRetry(
  () => import('./AdminArrasteFotosModal').then((m) => ({ default: m.AdminArrasteFotosModal })),
  'AdminArrasteFotosModal'
);
const AdminArrastePdfsModal = lazyWithRetry(
  () => import('./AdminArrastePdfsModal').then((m) => ({ default: m.AdminArrastePdfsModal })),
  'AdminArrastePdfsModal'
);
const ImportarDeficienciasHtmScreen = lazyWithRetry(
  () =>
    import('./ImportarDeficienciasHtmScreen').then((m) => ({
      default: m.ImportarDeficienciasHtmScreen,
    })),
  'ImportarDeficienciasHtmScreen'
);
const DiagnosticoBancoDadosScreen = lazyWithRetry(
  () =>
    import('./DiagnosticoBancoDadosScreen').then((m) => ({
      default: m.DiagnosticoBancoDadosScreen,
    })),
  'DiagnosticoBancoDadosScreen'
);
const DiasLetivosScreen = lazyWithRetry(
  () => import('./DiasLetivosScreen').then((m) => ({ default: m.DiasLetivosScreen })),
  'DiasLetivosScreen'
);
const PwaIconsHealthScanner = lazyWithRetry(
  () => import('./PwaIconsHealthScanner').then((m) => ({ default: m.PwaIconsHealthScanner })),
  'PwaIconsHealthScanner'
);
const IndexedDbPhotoStorageModal = lazyWithRetry(
  () =>
    import('./IndexedDbPhotoStorageModal').then((m) => ({ default: m.IndexedDbPhotoStorageModal })),
  'IndexedDbPhotoStorageModal'
);
const GoogleSheetsCredentialsModal = lazyWithRetry(
  () =>
    import('./admin/GoogleSheetsCredentialsModal').then((m) => ({
      default: m.GoogleSheetsCredentialsModal,
    })),
  'GoogleSheetsCredentialsModal'
);
const GoogleDriveBackupModal = lazyWithRetry(
  () =>
    import('./admin/GoogleDriveBackupModal').then((m) => ({
      default: m.GoogleDriveBackupModal,
    })),
  'GoogleDriveBackupModal'
);

export type AdminCenterSection = 'acesso' | 'calendario' | 'uploads' | 'seguranca' | 'diagnostico';
export type AdminUploadTool = 'fotos' | 'pdfs' | 'htm' | 'json';
export type AdminCenterSubTab =
  | 'quadro_turmas'
  | 'contas_acesso'
  | 'rbac_matriz'
  | 'calendario_200'
  | 'janela_fcm'
  | 'seguranca_lgpd'
  | 'monitoramento'
  | 'diagnostico_bd'
  | 'nuvem_backup'
  | 'pwa_identidade';

type SubTabId = AdminCenterSubTab;

const getDefaultSubTabForSection = (section: AdminCenterSection): SubTabId => {
  switch (section) {
    case 'acesso':
      return 'quadro_turmas';
    case 'calendario':
      return 'calendario_200';
    case 'seguranca':
      return 'seguranca_lgpd';
    case 'diagnostico':
      return 'diagnostico_bd';
    case 'uploads':
    default:
      return 'quadro_turmas';
  }
};

const isSubTabValidForSection = (section: AdminCenterSection, subTab: SubTabId): boolean => {
  if (section === 'acesso') {
    return subTab === 'quadro_turmas' || subTab === 'contas_acesso' || subTab === 'rbac_matriz';
  }
  if (section === 'calendario') {
    return subTab === 'calendario_200' || subTab === 'janela_fcm';
  }
  if (section === 'seguranca') {
    return subTab === 'seguranca_lgpd' || subTab === 'monitoramento';
  }
  if (section === 'diagnostico') {
    return subTab === 'diagnostico_bd' || subTab === 'nuvem_backup' || subTab === 'pwa_identidade';
  }
  return false;
};

interface UsuariosAcessoScreenProps {
  authorizedUsers: AuthorizedUser[];
  accessSessionLogs?: UserAccessSessionLog[];
  onClearAccessLogs?: () => void;
  classes: ClassGroup[];
  onUpdateClasses?: (updatedClasses: ClassGroup[]) => void;
  currentUserEmail: string;
  userRole: UserRole;
  teacherRoleType?: AuthorizedUser['teacherRoleType'];
  syncSnapshot?: SyncStatusSnapshot;
  attendanceWindowConfig: AttendanceWindowConfig;
  onUpdateAttendanceWindowConfig: (nextConfig: AttendanceWindowConfig) => void;
  onSaveAuthorizedUsers: (updatedUsers: AuthorizedUser[]) => void;
  onSelectPreviewClassId?: (classId: string) => void;
  onSimulateTeacherProfile?: (teacher: AuthorizedUser) => void;
  onNavigateScreen?: (screen: ScreenType) => void;
  onSyncScreenFromSection?: (section: AdminCenterSection) => void;
  onOpenClassDetails?: (cls: ClassGroup) => void;
  initialSection?: AdminCenterSection;
  initialSubTab?: AdminCenterSubTab;
  initialUploadTool?: AdminUploadTool;
  onBack: () => void;
}

export const UsuariosAcessoScreen: React.FC<UsuariosAcessoScreenProps> = ({
  authorizedUsers,
  accessSessionLogs = [],
  onClearAccessLogs,
  classes,
  onUpdateClasses,
  currentUserEmail,
  userRole,
  teacherRoleType,
  syncSnapshot,
  attendanceWindowConfig,
  onUpdateAttendanceWindowConfig,
  onSaveAuthorizedUsers,
  onSelectPreviewClassId,
  onSimulateTeacherProfile,
  onNavigateScreen,
  onSyncScreenFromSection,
  onOpenClassDetails,
  initialSection = 'acesso',
  initialSubTab,
  initialUploadTool = 'fotos',
  onBack,
}) => {
  const [activeSection, setActiveSection] = useState<AdminCenterSection>(initialSection);
  const [activeUploadTool, setActiveUploadTool] = useState<AdminUploadTool>(
    initialUploadTool === 'json' ? 'fotos' : initialUploadTool
  );
  const [isPhotoStorageModalOpen, setIsPhotoStorageModalOpen] = useState(false);
  const [isSheetsCredentialsModalOpen, setIsSheetsCredentialsModalOpen] = useState(false);
  const [isDriveBackupModalOpen, setIsDriveBackupModalOpen] = useState(false);
  const [activeSchoolYear, setActiveSchoolYear] = useState<number>(
    () => getStoredOfficialCalendarConfig().year || 2027
  );
  const [activeSubTab, setActiveSubTab] = useState<SubTabId>(
    initialSubTab || getDefaultSubTabForSection(initialSection)
  );

  // Quadro Docente states
  const [matrixShiftFilter, setMatrixShiftFilter] = useState<'ALL' | 'MANHÃ' | 'TARDE' | 'VAGAS'>('ALL');
  const [matrixSearchTerm, setMatrixSearchTerm] = useState('');
  const [editingMatrixClassId, setEditingMatrixClassId] = useState<string | null>(null);
  const [matrixDraft, setMatrixDraft] = useState<MatrixDraft | null>(null);
  const [visibleMatrixLimit, setVisibleMatrixLimit] = useState(20);

  // Contas Autorizadas states
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [emailPrefix, setEmailPrefix] = useState('');
  const [name, setName] = useState('');
  const [newAccessLevel, setNewAccessLevel] = useState<AccessLevelKey>('usuario');
  const [assignedClassId, setAssignedClassId] = useState<string>(classes[0]?.id || 'g04a');
  const [newExpirationDate, setNewExpirationDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | AccessLevelKey>('all');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'blocked' | 'temporary' | 'expired'
  >('all');
  const [userSortBy, setUserSortBy] = useState<'default' | 'name_asc' | 'email_asc' | 'access_desc'>('default');
  const [onlyAccessedFilter, setOnlyAccessedFilter] = useState(false);
  const [assignModalUserId, setAssignModalUserId] = useState<string | null>(null);
  const [assignModalSearch, setAssignModalSearch] = useState('');
  const [draftEdits, setDraftEdits] = useState<Record<string, DraftUserEdit>>({});
  const [recentlySavedUserIds, setRecentlySavedUserIds] = useState<Record<string, boolean>>({});

  // Paginação e logs
  const USERS_PAGE_SIZE = 25;
  const LOGS_PAGE_SIZE = 25;
  const SECURITY_PAGE_SIZE = 25;
  const [usersPage, setUsersPage] = useState(1);
  const [logsPage, setLogsPage] = useState(1);
  const [securityPage, setSecurityPage] = useState(1);
  const [logSearchTerm, setLogSearchTerm] = useState('');

  // Segurança, LGPD e RBAC
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [securityLogs, setSecurityLogs] = useState<SecurityAuditLogEntry[]>(() =>
    getStoredSecurityAuditLogs()
  );
  const [lgpdConfig, setLgpdConfig] = useState<LgpdProtectionConfig>(() => getStoredLgpdConfig());
  const [securitySearchTerm, setSecuritySearchTerm] = useState('');
  const [securitySeverityFilter, setSecuritySeverityFilter] = useState<
    'all' | 'info' | 'warning' | 'security_alert'
  >('all');
  const [selectedRbacRoleKey, setSelectedRbacRoleKey] = useState<string>('admin');

  // Firebase Cloud Messaging (FCM) — carregado sob demanda na aba Calendário > Janela & FCM
  const [fcmStatus, setFcmStatus] = useState<FcmBackendStatus | null>(null);
  const [fcmConfigDraft, setFcmConfigDraft] = useState<FcmSystemConfig>(() =>
    getStoredFcmSystemConfig()
  );
  const [fcmAudienceTarget, setFcmAudienceTarget] = useState<'pending_only' | 'all'>('pending_only');
  const [isLoadingFcmStatus, setIsLoadingFcmStatus] = useState(false);
  const [isSendingFcmAlert, setIsSendingFcmAlert] = useState(false);
  const [isSavingFcmConfig, setIsSavingFcmConfig] = useState(false);

  useEffect(() => {
    setActiveSection(initialSection);
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
      return;
    }
    setActiveSubTab((prev) =>
      isSubTabValidForSection(initialSection, prev)
        ? prev
        : getDefaultSubTabForSection(initialSection)
    );
  }, [initialSection, initialSubTab]);

  useEffect(() => {
    if (initialUploadTool === 'json') {
      setActiveSection('diagnostico');
      setActiveSubTab('nuvem_backup');
      return;
    }
    setActiveUploadTool(initialUploadTool);
  }, [initialUploadTool]);

  const handleSelectSection = (section: AdminCenterSection, preferredSubTab?: SubTabId) => {
    setActiveSection(section);
    if (preferredSubTab && isSubTabValidForSection(section, preferredSubTab)) {
      setActiveSubTab(preferredSubTab);
    } else if (!isSubTabValidForSection(section, activeSubTab)) {
      setActiveSubTab(getDefaultSubTabForSection(section));
    }
    onSyncScreenFromSection?.(section);
  };

  const refreshFcmStatus = async () => {
    setIsLoadingFcmStatus(true);
    try {
      const status = await fetchFcmBackendStatus();
      if (!status) return;
      setFcmStatus(status);
      if (status.fcmConfig) {
        setFcmConfigDraft(status.fcmConfig);
      }
    } finally {
      setIsLoadingFcmStatus(false);
    }
  };

  // Carrega status FCM apenas quando o admin entra em Calendário & Prazos > Janela & Alertas FCM
  useEffect(() => {
    if (activeSection !== 'calendario' || activeSubTab !== 'janela_fcm') return;
    let active = true;
    setIsLoadingFcmStatus(true);
    fetchFcmBackendStatus()
      .then((status) => {
        if (!active || !status) return;
        setFcmStatus(status);
        if (status.fcmConfig) {
          setFcmConfigDraft(status.fcmConfig);
        }
      })
      .finally(() => {
        if (active) setIsLoadingFcmStatus(false);
      });
    return () => {
      active = false;
    };
  }, [activeSection, activeSubTab]);

  const canManage = userRole === 'admin';

  const triggerFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    window.setTimeout(() => setFeedbackMsg(null), 4500);
  };

  const markUserSavedFlash = (userIds: string[]) => {
    setRecentlySavedUserIds((prev) => {
      const next = { ...prev };
      userIds.forEach((id) => {
        next[id] = true;
      });
      return next;
    });
    window.setTimeout(() => {
      setRecentlySavedUserIds((prev) => {
        const next = { ...prev };
        userIds.forEach((id) => {
          delete next[id];
        });
        return next;
      });
    }, 3000);
  };

  const handleToggleMasking = () => {
    if (!canManage) return;
    const nextVal = !lgpdConfig.maskSensitiveDataByDefault;
    const updated = saveStoredLgpdConfig({ maskSensitiveDataByDefault: nextVal });
    setLgpdConfig(updated);
    void pushLgpdConfigToServer(updated);
    const newEntry = addSecurityAuditLog({
      userEmail: currentUserEmail,
      userName: 'Administrador Escolar',
      userRole: 'admin',
      eventType: 'DATA_MASKING_TOGGLED',
      actionTitle: nextVal
        ? 'Mascaramento LGPD Ativado'
        : 'Mascaramento LGPD Desativado (Modo Auditoria)',
      details: nextVal
        ? 'Dados sensíveis de menores (CPF, NIS, Endereço, Laudos) ocultados automaticamente.'
        : 'Mascaramento desativado temporariamente para conferência administrativa.',
      targetResource: 'Cadastro de Estudantes SED',
      severity: nextVal ? 'info' : 'warning',
    });
    setSecurityLogs((prev) => [newEntry, ...prev]);
    triggerFeedback(
      'success',
      nextVal
        ? 'Mascaramento de dados sensíveis ativado.'
        : 'Mascaramento temporariamente desativado para conferência.'
    );
  };

  const handleExportSecurityAudit = () => {
    exportSecurityAuditLogsCSV();
    const newEntry = addSecurityAuditLog({
      userEmail: currentUserEmail,
      userName: 'Administrador Escolar',
      userRole: 'admin',
      eventType: 'STUDENT_DATA_EXPORTED',
      actionTitle: 'Relatório de Auditoria LGPD Exportado',
      details: 'Download completo do log de acessos e eventos de segurança em formato CSV.',
      targetResource: 'Auditoria de Segurança',
      severity: 'info',
    });
    setSecurityLogs((prev) => [newEntry, ...prev]);
    triggerFeedback('success', 'Relatório de Auditoria LGPD exportado (.CSV).');
  };

  const handleClearSecurityLogs = () => {
    if (!canManage) return;
    const previousCount = securityLogs.length;
    clearStoredSecurityAuditLogs();
    const immutableEntry = addSecurityAuditLog({
      userEmail: currentUserEmail,
      userName: 'Administrador Escolar',
      userRole: 'admin',
      eventType: 'SECURITY_LOGS_CLEARED',
      actionTitle: 'Histórico de Auditoria LGPD Limpo pelo Administrador',
      details: `${previousCount} registro(s) local(is) removidos após confirmação administrativa.`,
      targetResource: 'Trilha de Auditoria LGPD',
      severity: 'warning',
    });
    setSecurityLogs([immutableEntry]);
    setSecurityPage(1);
    triggerFeedback(
      'success',
      'Trilha local limpa com registro imutável da operação mantido na auditoria.'
    );
  };

  const getUserEffectiveClassIds = (u: AuthorizedUser): string[] => {
    const d = draftEdits[u.id];
    if (d && d.assignedClassIds && d.assignedClassIds.length > 0) {
      return d.assignedClassIds;
    }
    if (u.assignedClassIds && u.assignedClassIds.length > 0) {
      return u.assignedClassIds.filter((id) => id !== 'all');
    }
    if (u.assignedClassId && u.assignedClassId !== 'all') {
      return [u.assignedClassId];
    }
    return [classes[0]?.id || 'g04a'];
  };

  const buildClassSummaryFromIds = (
    roleVal: UserRole,
    classIds: string[],
    subjectLabel?: string
  ): {
    assignedClassId: string;
    assignedClassName: string;
    assignedClassIds: string[];
    assignedClassNames: string[];
  } => {
    if (roleVal === 'admin') {
      return {
        assignedClassId: 'all',
        assignedClassName: `Todas as ${classes.length} Turmas (Acesso Pleno)`,
        assignedClassIds: ['all'],
        assignedClassNames: [`Todas as ${classes.length} Turmas (Acesso Pleno)`],
      };
    }
    if (roleVal === 'peb2') {
      const cleanIds = Array.from(new Set(classIds.filter((id) => id && id !== 'all')));
      if (cleanIds.length > 0) {
        const matched = cleanIds
          .map((id) => classes.find((c) => c.id === id))
          .filter((c): c is ClassGroup => Boolean(c));
        const classNamesList = matched.map((c) => c.name).join(', ');
        return {
          assignedClassId: 'all',
          assignedClassName: `${subjectLabel || 'Especialista'} (${matched.length} turmas: ${classNamesList})`,
          assignedClassIds: cleanIds,
          assignedClassNames: matched.map((c) => c.name),
        };
      }
      return {
        assignedClassId: 'all',
        assignedClassName: 'Todas as Turmas (Somente Visualização)',
        assignedClassIds: ['all'],
        assignedClassNames: ['Todas as Turmas (Somente Visualização)'],
      };
    }
    const cleanIds = Array.from(new Set(classIds.filter((id) => id && id !== 'all')));
    const matched = cleanIds
      .map((id) => classes.find((c) => c.id === id))
      .filter((c): c is ClassGroup => Boolean(c));
    const finalClasses = matched.length > 0 ? matched : [classes[0]].filter(Boolean);
    const ids = finalClasses.map((c) => c.id);
    const names = finalClasses.map(
      (c) => `${c.name} (${c.shift.replace('Turno ', '')})`
    );
    return {
      assignedClassId: ids[0] || 'g04a',
      assignedClassName: names.join(' + ') || 'GRUPO 04 A (Manhã)',
      assignedClassIds: ids.length > 0 ? ids : ['g04a'],
      assignedClassNames: names.length > 0 ? names : ['GRUPO 04 A (Manhã)'],
    };
  };

  const findRegenteUserForClass = (cls: ClassGroup): AuthorizedUser | undefined => {
    const byClassId = authorizedUsers.find(
      (u) =>
        u.role === 'usuario' &&
        (u.assignedClassId === cls.id ||
          (u.assignedClassIds && u.assignedClassIds.includes(cls.id)))
    );
    if (byClassId) return byClassId;
    if (cls.teacherName) {
      const normName = cls.teacherName.trim().toUpperCase();
      return authorizedUsers.find((u) => u.name.trim().toUpperCase() === normName);
    }
    return undefined;
  };

  const handleStartEditMatrixRow = (cls: ClassGroup) => {
    if (!canManage) return;
    setEditingMatrixClassId(cls.id);
    setMatrixDraft({
      teacherName: cls.teacherName || '',
      teacherPronoun: cls.teacherPronoun || cls.pronoun || 'PROFESSORA',
      teacherFirstName:
        cls.teacherFirstName || (cls.teacherName || '').split(' ')[0] || '',
      room: cls.room || '',
      shift: cls.shift === 'Turno Tarde' ? 'Turno Tarde' : 'Turno Manhã',
      turmaSedName: cls.turmaSedName || cls.sedClassName || '',
      classeSedCode: cls.classeSedCode || '',
      artTeacher: cls.artTeacher || '',
      peTeacher: cls.peTeacher || '',
      englishTeacher: cls.englishTeacher || '',
    });
  };

  const handleSaveMatrixRow = (cls: ClassGroup) => {
    if (!canManage || !matrixDraft) return;

    const trimmedTeacher = matrixDraft.teacherName.trim().toUpperCase();
    const isVagaNow = trimmedTeacher === 'TURMA VAGA' || trimmedTeacher === '';
    const nextPronoun = matrixDraft.teacherPronoun.trim().toUpperCase();
    const nextSedName = matrixDraft.turmaSedName.trim().toUpperCase();
    const nowMs = Date.now();

    const updatedClasses = classes.map((c) =>
      c.id === cls.id
        ? {
            ...c,
            teacherName: trimmedTeacher || 'TURMA VAGA',
            pronoun: nextPronoun,
            teacherPronoun: nextPronoun,
            teacherFirstName: matrixDraft.teacherFirstName.trim().toUpperCase(),
            room: matrixDraft.room.trim().toUpperCase(),
            shift: matrixDraft.shift,
            periodo: (matrixDraft.shift === 'Turno Tarde' ? 'TARDE' : 'MANHÃ') as 'MANHÃ' | 'TARDE',
            sedClassName: nextSedName,
            turmaSedName: nextSedName,
            classeSedCode: matrixDraft.classeSedCode.trim(),
            artTeacher: matrixDraft.artTeacher.trim().toUpperCase(),
            peTeacher: matrixDraft.peTeacher.trim().toUpperCase(),
            englishTeacher: matrixDraft.englishTeacher.trim().toUpperCase(),
            isVaga: isVagaNow,
            matrixRevision: OFFICIAL_MATRIX_REVISION,
            matrixCustomizedAtMs: nowMs,
            updatedAtMs: nowMs,
          }
        : c
    );

    if (onUpdateClasses) {
      onUpdateClasses(updatedClasses);
    }

    const regenteUser = findRegenteUserForClass(cls);
    if (regenteUser && matrixDraft.teacherName.trim()) {
      const nextUsers = authorizedUsers.map((u) =>
        u.id === regenteUser.id
          ? {
              ...u,
              name: matrixDraft.teacherName.trim().toUpperCase(),
              pronoun: matrixDraft.teacherPronoun.trim().toUpperCase(),
              firstName: matrixDraft.teacherFirstName.trim().toUpperCase(),
              assignedClassName: `${cls.name} (${matrixDraft.shift.replace('Turno ', '')})`,
              updatedAtMs: Date.now(),
            }
          : u
      );
      onSaveAuthorizedUsers(nextUsers);
    }

    setEditingMatrixClassId(null);
    setMatrixDraft(null);
    triggerFeedback('success', `Quadro da turma ${cls.name} atualizado.`);
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    let fullEmail = emailPrefix.trim().toLowerCase();
    if (!fullEmail.includes('@')) {
      fullEmail = `${fullEmail}${INSTITUTIONAL_EMAIL_DOMAIN}`;
    }

    if (!isValidInstitutionalEmail(fullEmail)) {
      triggerFeedback(
        'error',
        `Somente e-mails com final ${INSTITUTIONAL_EMAIL_DOMAIN} podem ser cadastrados.`
      );
      return;
    }

    const localPart = fullEmail.replace(INSTITUTIONAL_EMAIL_DOMAIN, '').trim();
    if (!localPart || localPart.length < 2) {
      triggerFeedback('error', 'Informe o identificador do e-mail institucional.');
      return;
    }

    const exists = authorizedUsers.some(
      (u) => u.email.trim().toLowerCase() === fullEmail
    );
    if (exists) {
      triggerFeedback('error', `O e-mail ${fullEmail} já está cadastrado.`);
      return;
    }

    if (newAccessLevel === 'admin' && !isOfficialSchoolAdminEmail(fullEmail)) {
      triggerFeedback(
        'error',
        'O perfil de Administrador é exclusivo da conta institucional da escola (emebjfreitas@jundiai.sp.gov.br).'
      );
      return;
    }

    const targetRole: UserRole =
      newAccessLevel === 'admin'
        ? 'admin'
        : newAccessLevel === 'usuario'
        ? 'usuario'
        : 'peb2';
    const targetTeacherRoleType: AuthorizedUser['teacherRoleType'] =
      newAccessLevel === 'admin'
        ? 'gestao'
        : newAccessLevel === 'aee'
        ? 'aee'
        : newAccessLevel === 'peb2'
        ? 'especialista'
        : 'regente';
    const targetSubjectName: AuthorizedUser['subjectName'] =
      newAccessLevel === 'admin'
        ? 'GESTÃO / ADMIN'
        : newAccessLevel === 'aee'
        ? 'EDUCAÇÃO ESPECIAL (AEE)'
        : newAccessLevel === 'usuario'
        ? 'REGENTE PEB I'
        : undefined;

    const targetClass = classes.find((c) => c.id === assignedClassId);
    const assignedClassName =
      newAccessLevel === 'admin'
        ? `Todas as ${classes.length} Turmas (Acesso Pleno)`
        : newAccessLevel === 'aee'
        ? 'Educação Especial AEE (Visualização)'
        : newAccessLevel === 'peb2'
        ? 'Todas as Turmas (Somente Visualização)'
        : targetClass
        ? `${targetClass.name} (${targetClass.shift.replace('Turno ', '')})`
        : 'GRUPO 04 A (Manhã)';

    const cleanExp = newExpirationDate.trim();
    const hasValidExp = /^\d{4}-\d{2}-\d{2}$/.test(cleanExp);
    const isAlreadyExpired = hasValidExp && getLocalTodayDateISO() > cleanExp;

    const newUser: AuthorizedUser = {
      id: `usr-${Date.now()}`,
      email: fullEmail,
      name: (name.trim() || `Servidor(a) ${localPart}`).toUpperCase(),
      role: targetRole,
      teacherRoleType: targetTeacherRoleType,
      subjectName: targetSubjectName,
      assignedClassId: targetRole === 'usuario' ? assignedClassId : 'all',
      assignedClassName,
      assignedClassIds: targetRole === 'usuario' ? [assignedClassId] : ['all'],
      assignedClassNames: [assignedClassName],
      active: !isAlreadyExpired,
      ...(hasValidExp ? { accessExpiresAt: cleanExp } : {}),
      createdAt: new Date().toLocaleDateString('pt-BR'),
      updatedAtMs: Date.now(),
    };

    onSaveAuthorizedUsers([newUser, ...authorizedUsers]);
    setEmailPrefix('');
    setName('');
    setNewExpirationDate('');
    setShowAddUserForm(false);
    triggerFeedback(
      isAlreadyExpired ? 'error' : 'success',
      hasValidExp
        ? isAlreadyExpired
          ? `Conta ${fullEmail} cadastrada com data vencida (${formatAccessExpirationDateBR(cleanExp)}) — acesso revogado.`
          : `Acesso ${ACCESS_LEVEL_META[newAccessLevel].badgeLabel} liberado para ${fullEmail} até ${formatAccessExpirationDateBR(cleanExp)}.`
        : `Acesso ${ACCESS_LEVEL_META[newAccessLevel].badgeLabel} liberado para ${fullEmail}.`
    );
  };

  const handleSelectAccessLevel = (userId: string, level: AccessLevelKey) => {
    if (!canManage) return;
    const origUser = authorizedUsers.find((u) => u.id === userId);
    if (!origUser) return;

    const currentLevel = resolveAccessLevel(origUser, draftEdits[userId]?.accessLevel);
    if (currentLevel === level) return;

    const isSchoolAdmin = isOfficialSchoolAdminEmail(origUser.email);
    if (level === 'admin' && !isSchoolAdmin) {
      triggerFeedback(
        'error',
        'O perfil de Administrador é exclusivo da conta institucional da escola (emebjfreitas@jundiai.sp.gov.br).'
      );
      return;
    }
    if (isSchoolAdmin && level !== 'admin') {
      triggerFeedback(
        'error',
        'A conta institucional da escola (emebjfreitas@jundiai.sp.gov.br) deve permanecer como Administrador.'
      );
      return;
    }

    if (currentLevel === 'admin' && level !== 'admin') {
      const activeAdmins = authorizedUsers.filter(
        (u) => u.active && resolveAccessLevel(u) === 'admin'
      );
      if (activeAdmins.length <= 1 && origUser.active) {
        triggerFeedback('error', 'É obrigatório manter pelo menos 1 Administrador ativo.');
        return;
      }
    }

    const newRole: UserRole =
      level === 'admin' ? 'admin' : level === 'usuario' ? 'usuario' : 'peb2';
    const nextTeacherRoleType: AuthorizedUser['teacherRoleType'] =
      level === 'admin'
        ? 'gestao'
        : level === 'aee'
        ? 'aee'
        : level === 'peb2'
        ? 'especialista'
        : 'regente';
    const nextSubjectName: AuthorizedUser['subjectName'] =
      level === 'admin'
        ? 'GESTÃO / ADMIN'
        : level === 'aee'
        ? 'EDUCAÇÃO ESPECIAL (AEE)'
        : level === 'usuario'
        ? 'REGENTE PEB I'
        : origUser.subjectName &&
          origUser.subjectName !== 'GESTÃO / ADMIN' &&
          origUser.subjectName !== 'REGENTE PEB I' &&
          origUser.subjectName !== 'EDUCAÇÃO ESPECIAL (AEE)'
        ? origUser.subjectName
        : undefined;

    const currentClassIds = getUserEffectiveClassIds(origUser);
    const summary = buildClassSummaryFromIds(newRole, currentClassIds, nextSubjectName);
    if (level === 'aee') {
      summary.assignedClassName = 'Educação Especial AEE (Visualização)';
      summary.assignedClassNames = ['Educação Especial AEE (Visualização)'];
    }

    setDraftEdits((prev) => ({
      ...prev,
      [userId]: {
        role: newRole,
        accessLevel: level,
        ...summary,
      },
    }));

    const nowMs = Date.now();
    const next: AuthorizedUser[] = authorizedUsers.map((u) =>
      u.id === userId
        ? {
            ...u,
            role: newRole,
            teacherRoleType: nextTeacherRoleType,
            subjectName: nextSubjectName,
            ...summary,
            updatedAtMs: nowMs,
          }
        : u
    );
    onSaveAuthorizedUsers(next);
    const auditEntry = addSecurityAuditLog({
      userEmail: currentUserEmail,
      userName: 'Administrador Escolar',
      userRole: 'admin',
      eventType: 'ROLE_PERMISSION_CHANGED',
      actionTitle: `Nível alterado para ${ACCESS_LEVEL_META[level].badgeLabel}`,
      details: `${origUser.name} (${origUser.email}) atualizado de ${ACCESS_LEVEL_META[currentLevel].badgeLabel} para ${ACCESS_LEVEL_META[level].badgeLabel}.`,
      targetResource: origUser.email,
      severity: level === 'admin' ? 'warning' : 'info',
    });
    setSecurityLogs((prev) => [auditEntry, ...prev]);
    markUserSavedFlash([userId]);
  };

  const handleToggleUserExtraClass = (userId: string, classId: string) => {
    if (!canManage || !classId) return;
    const origUser = authorizedUsers.find((u) => u.id === userId);
    if (!origUser) return;
    const currentDraft = draftEdits[userId];
    const effectiveRole = currentDraft ? currentDraft.role : origUser.role;
    const effectiveLevel = resolveAccessLevel(origUser, currentDraft?.accessLevel);
    const existingIds = getUserEffectiveClassIds(origUser);
    const exists = existingIds.includes(classId);
    let nextIds: string[];
    if (exists) {
      if (existingIds.length <= 1) return;
      nextIds = existingIds.filter((id) => id !== classId);
    } else {
      nextIds = Array.from(new Set([...existingIds, classId]));
    }
    const summary = buildClassSummaryFromIds(effectiveRole, nextIds, origUser.subjectName);

    setDraftEdits((prev) => ({
      ...prev,
      [userId]: {
        role: effectiveRole,
        accessLevel: effectiveLevel,
        ...summary,
      },
    }));

    const nowMs = Date.now();
    const next = authorizedUsers.map((u) =>
      u.id === userId
        ? {
            ...u,
            role: effectiveRole,
            ...summary,
            updatedAtMs: nowMs,
          }
        : u
    );
    onSaveAuthorizedUsers(next);
    if (!exists && onSelectPreviewClassId) {
      onSelectPreviewClassId(classId);
    }
    markUserSavedFlash([userId]);
  };

  const handleSetUserFunctionPreset = (
    userId: string,
    preset: 'regente' | 'especialista' | 'aee' | 'apoio' | 'admin'
  ) => {
    if (!canManage) return;
    const origUser = authorizedUsers.find((u) => u.id === userId);
    if (!origUser) return;
    const currentLevel = resolveAccessLevel(origUser, draftEdits[userId]?.accessLevel);
    const isSchoolAdmin = isOfficialSchoolAdminEmail(origUser.email);
    if (preset === 'admin' && !isSchoolAdmin) {
      triggerFeedback(
        'error',
        'O perfil de Administrador é exclusivo da conta institucional da escola (emebjfreitas@jundiai.sp.gov.br).'
      );
      return;
    }
    if (isSchoolAdmin && preset !== 'admin') {
      triggerFeedback(
        'error',
        'A conta institucional da escola (emebjfreitas@jundiai.sp.gov.br) deve permanecer como Administrador.'
      );
      return;
    }
    if (currentLevel === 'admin' && preset !== 'admin') {
      const activeAdmins = authorizedUsers.filter(
        (u) => u.active && resolveAccessLevel(u) === 'admin'
      );
      if (activeAdmins.length <= 1 && origUser.active) {
        triggerFeedback('error', 'É obrigatório manter pelo menos 1 Administrador ativo.');
        return;
      }
    }

    const targetRole: UserRole =
      preset === 'admin' ? 'admin' : preset === 'regente' ? 'usuario' : 'peb2';
    const nextLevel: AccessLevelKey =
      preset === 'admin'
        ? 'admin'
        : preset === 'regente'
        ? 'usuario'
        : preset === 'aee'
        ? 'aee'
        : 'peb2';
    const nextTeacherRoleType: AuthorizedUser['teacherRoleType'] =
      preset === 'admin'
        ? 'gestao'
        : preset === 'regente'
        ? 'regente'
        : preset === 'aee'
        ? 'aee'
        : preset === 'apoio'
        ? 'apoio'
        : 'especialista';
    const nextSubjectName: AuthorizedUser['subjectName'] =
      preset === 'admin'
        ? 'GESTÃO / ADMIN'
        : preset === 'regente'
        ? 'REGENTE PEB I'
        : preset === 'aee'
        ? 'EDUCAÇÃO ESPECIAL (AEE)'
        : origUser.subjectName &&
          origUser.subjectName !== 'GESTÃO / ADMIN' &&
          origUser.subjectName !== 'REGENTE PEB I' &&
          origUser.subjectName !== 'EDUCAÇÃO ESPECIAL (AEE)'
        ? origUser.subjectName
        : undefined;

    const currentClassIds = getUserEffectiveClassIds(origUser);
    const summary = buildClassSummaryFromIds(targetRole, currentClassIds, nextSubjectName);
    if (preset === 'aee') {
      summary.assignedClassName = 'Educação Especial AEE (Visualização)';
      summary.assignedClassNames = ['Educação Especial AEE (Visualização)'];
    } else if (preset === 'apoio') {
      summary.assignedClassName = 'Apoio Pedagógico (Leitura)';
      summary.assignedClassNames = ['Apoio Pedagógico (Leitura)'];
    }

    setDraftEdits((prev) => ({
      ...prev,
      [userId]: {
        role: targetRole,
        accessLevel: nextLevel,
        ...summary,
      },
    }));

    const nowMs = Date.now();
    const next = authorizedUsers.map((u) =>
      u.id === userId
        ? {
            ...u,
            role: targetRole,
            teacherRoleType: nextTeacherRoleType,
            subjectName: nextSubjectName,
            ...summary,
            updatedAtMs: nowMs,
          }
        : u
    );
    onSaveAuthorizedUsers(next);
    markUserSavedFlash([userId]);
  };

  const handleToggleActive = (userId: string) => {
    if (!canManage) return;
    const target = authorizedUsers.find((u) => u.id === userId);
    if (!target) return;
    if (!target.active && isUserAccessExpired(target)) {
      triggerFeedback(
        'error',
        `A validade de ${target.name} expirou após ${formatAccessExpirationDateBR(
          target.accessExpiresAt
        )}. Atualize ou remova a data de validade para reativar o acesso.`
      );
      return;
    }
    if (target.active && resolveAccessLevel(target) === 'admin') {
      const activeAdmins = authorizedUsers.filter(
        (u) => u.active && resolveAccessLevel(u) === 'admin'
      );
      if (activeAdmins.length <= 1) {
        triggerFeedback('error', 'É obrigatório manter pelo menos 1 Administrador ativo.');
        return;
      }
    }
    const next = authorizedUsers.map((u) =>
      u.id === userId ? { ...u, active: !u.active, updatedAtMs: Date.now() } : u
    );
    onSaveAuthorizedUsers(next);
    markUserSavedFlash([userId]);
  };

  const handleUpdateUserExpiration = (userId: string, rawDate: string) => {
    if (!canManage) return;
    const target = authorizedUsers.find((u) => u.id === userId);
    if (!target) return;

    const cleanDate = rawDate.trim();
    if (cleanDate && !/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) return;

    const isPastDate = Boolean(cleanDate) && getLocalTodayDateISO() > cleanDate;
    if (isPastDate && resolveAccessLevel(target) === 'admin' && target.active) {
      const activeAdmins = authorizedUsers.filter(
        (u) => u.active && resolveAccessLevel(u) === 'admin'
      );
      if (activeAdmins.length <= 1) {
        triggerFeedback(
          'error',
          'É obrigatório manter pelo menos 1 Administrador ativo com acesso válido.'
        );
        return;
      }
    }

    const wasExpired = isUserAccessExpired(target);
    const nowMs = Date.now();
    const nextUsers: AuthorizedUser[] = authorizedUsers.map((u) => {
      if (u.id !== userId) return u;
      if (!cleanDate) {
        const { accessExpiresAt: _removed, ...rest } = u;
        return {
          ...rest,
          active: wasExpired ? true : u.active,
          updatedAtMs: nowMs,
        };
      }
      return {
        ...u,
        accessExpiresAt: cleanDate,
        active: isPastDate ? false : wasExpired ? true : u.active,
        updatedAtMs: nowMs,
      };
    });

    onSaveAuthorizedUsers(nextUsers);
    markUserSavedFlash([userId]);

    const auditEntry = addSecurityAuditLog({
      userEmail: currentUserEmail,
      userName: 'Administrador Escolar',
      userRole: 'admin',
      eventType: 'ROLE_PERMISSION_CHANGED',
      actionTitle: !cleanDate
        ? 'Validade de acesso removida (acesso permanente)'
        : isPastDate
        ? 'Data de expiração vencida — acesso revogado'
        : `Validade de acesso definida até ${formatAccessExpirationDateBR(cleanDate)}`,
      details: `${target.name} (${target.email}) atualizado para ${
        !cleanDate
          ? 'acesso sem data de expiração'
          : `validade até ${formatAccessExpirationDateBR(cleanDate)}`
      }.`,
      targetResource: target.email,
      severity: isPastDate ? 'warning' : 'info',
    });
    setSecurityLogs((prev) => [auditEntry, ...prev]);

    triggerFeedback(
      isPastDate ? 'error' : 'success',
      !cleanDate
        ? `Validade removida: ${target.name} agora possui acesso permanente.`
        : isPastDate
        ? `Data ${formatAccessExpirationDateBR(cleanDate)} já vencida — acesso de ${target.name} revogado automaticamente.`
        : `Validade de ${target.name} definida até ${formatAccessExpirationDateBR(cleanDate)}.`
    );
  };

  const handleRemoveUser = (user: AuthorizedUser) => {
    if (!canManage) return;
    const adminsActive = authorizedUsers.filter((u) => u.role === 'admin' && u.active);
    if (user.role === 'admin' && adminsActive.length <= 1) {
      triggerFeedback('error', 'É obrigatório manter pelo menos 1 Administrador ativo.');
      return;
    }
    const next = authorizedUsers.filter((u) => u.id !== user.id);
    onSaveAuthorizedUsers(next);
    triggerFeedback('success', `Acesso de ${user.email} removido.`);
  };

  const handleRestoreOfficialSchoolMatrix = () => {
    if (!canManage) return;
    const nowMs = Date.now();
    const metricsByEmail = new Map(
      authorizedUsers.map((u) => [u.email.trim().toLowerCase(), u])
    );
    const mergedUsers = INITIAL_AUTHORIZED_USERS.map((off) => {
      const existing = metricsByEmail.get(off.email.trim().toLowerCase());
      return {
        ...off,
        ...(existing?.accessExpiresAt ? { accessExpiresAt: existing.accessExpiresAt } : {}),
        totalAccessCount: existing?.totalAccessCount || 0,
        totalDurationSeconds: existing?.totalDurationSeconds || 0,
        lastSessionDurationSeconds: existing?.lastSessionDurationSeconds || 0,
        lastLoginAt: existing?.lastLoginAt,
        lastActiveAt: existing?.lastActiveAt,
        lastScreenVisited: existing?.lastScreenVisited,
        updatedAtMs: nowMs,
      };
    });
    onSaveAuthorizedUsers(mergedUsers);

    if (onUpdateClasses) {
      const currentById = new Map(classes.map((c) => [c.id, c]));
      const syncedClasses = INITIAL_CLASSES.map((off) => {
        const current = currentById.get(off.id);
        if (!current) return { ...off, updatedAtMs: nowMs };
        return {
          ...current,
          ...off,
          students: current.students,
          totalStudents: current.students.length,
          classesHeld: current.classesHeld,
          classesPlanned: current.classesPlanned,
          monthlySchoolDays: current.monthlySchoolDays || off.monthlySchoolDays,
          pedagogicalNotes: current.pedagogicalNotes,
          statusText: current.statusText,
          monthlyAbsences: current.monthlyAbsences,
          presenceRate: current.presenceRate,
          weeklyPerformance: current.weeklyPerformance,
          driveFolderUrl: current.driveFolderUrl,
          matrixCustomizedAtMs: undefined,
          matrixRevision: OFFICIAL_MATRIX_REVISION,
          updatedAtMs: nowMs,
        };
      });
      onUpdateClasses(syncedClasses);
    }

    triggerFeedback(
      'success',
      `Quadro Oficial sincronizado com ${classes.length} turmas e especialistas.`
    );
  };

  const filteredMatrixClasses = useMemo(() => {
    const q = matrixSearchTerm.toLowerCase().trim();
    return classes.filter((cls) => {
      if (matrixShiftFilter === 'MANHÃ' && cls.shift !== 'Turno Manhã') return false;
      if (matrixShiftFilter === 'TARDE' && cls.shift !== 'Turno Tarde') return false;
      if (
        matrixShiftFilter === 'VAGAS' &&
        !cls.isVaga &&
        cls.teacherName !== 'TURMA VAGA'
      ) {
        return false;
      }
      if (!q) return true;
      return (
        cls.name.toLowerCase().includes(q) ||
        (cls.turmaAbrev || '').toLowerCase().includes(q) ||
        (cls.teacherName || '').toLowerCase().includes(q) ||
        (cls.teacherFirstName || '').toLowerCase().includes(q) ||
        (cls.room || '').toLowerCase().includes(q) ||
        (cls.turmaSedName || '').toLowerCase().includes(q) ||
        (cls.classeSedCode || '').toLowerCase().includes(q) ||
        (cls.artTeacher || '').toLowerCase().includes(q) ||
        (cls.peTeacher || '').toLowerCase().includes(q) ||
        (cls.englishTeacher || '').toLowerCase().includes(q)
      );
    });
  }, [classes, matrixShiftFilter, matrixSearchTerm]);

  const specialistsUsers = useMemo(
    () => authorizedUsers.filter((u) => resolveAccessLevel(u) === 'peb2'),
    [authorizedUsers]
  );

  const activeUsersCount = useMemo(
    () => authorizedUsers.filter((u) => isUserAccessEffectivelyActive(u)).length,
    [authorizedUsers]
  );
  const blockedUsersCount = useMemo(
    () => authorizedUsers.filter((u) => !isUserAccessEffectivelyActive(u)).length,
    [authorizedUsers]
  );
  const temporaryUsersCount = useMemo(
    () => authorizedUsers.filter((u) => Boolean(u.accessExpiresAt)).length,
    [authorizedUsers]
  );
  const expiredUsersCount = useMemo(
    () => authorizedUsers.filter((u) => isUserAccessExpired(u)).length,
    [authorizedUsers]
  );

  const hasActiveUserFilters =
    searchTerm.trim().length > 0 ||
    roleFilter !== 'all' ||
    statusFilter !== 'all' ||
    onlyAccessedFilter ||
    userSortBy !== 'default';

  const handleResetUserFilters = () => {
    setSearchTerm('');
    setRoleFilter('all');
    setStatusFilter('all');
    setOnlyAccessedFilter(false);
    setUserSortBy('default');
    setUsersPage(1);
  };

  const filteredUsers = useMemo(() => {
    const normalizedQuery = normalizeSearchText(searchTerm);
    const queryTokens = normalizedQuery ? normalizedQuery.split(/\s+/).filter(Boolean) : [];

    const matched = authorizedUsers.filter((u) => {
      const level = resolveAccessLevel(u, draftEdits[u.id]?.accessLevel);
      if (roleFilter !== 'all' && level !== roleFilter) return false;
      if (statusFilter === 'active' && !isUserAccessEffectivelyActive(u)) return false;
      if (statusFilter === 'blocked' && isUserAccessEffectivelyActive(u)) return false;
      if (statusFilter === 'temporary' && !u.accessExpiresAt) return false;
      if (statusFilter === 'expired' && !isUserAccessExpired(u)) return false;
      if (onlyAccessedFilter && (u.totalAccessCount || 0) === 0) return false;
      if (queryTokens.length === 0) return true;

      const haystack = normalizeSearchText(
        [
          u.name,
          u.email,
          u.firstName,
          u.subjectName,
          draftEdits[u.id]?.assignedClassName || u.assignedClassName,
          ...(draftEdits[u.id]?.assignedClassNames || u.assignedClassNames || []),
        ]
          .filter(Boolean)
          .join(' ')
      );
      return queryTokens.every((token) => haystack.includes(token));
    });

    if (userSortBy === 'default') return matched;

    return [...matched].sort((a, b) => {
      if (userSortBy === 'name_asc') {
        return (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' });
      }
      if (userSortBy === 'email_asc') {
        return (a.email || '').localeCompare(b.email || '', 'pt-BR', { sensitivity: 'base' });
      }
      return (b.totalAccessCount || 0) - (a.totalAccessCount || 0);
    });
  }, [authorizedUsers, draftEdits, roleFilter, statusFilter, onlyAccessedFilter, searchTerm, userSortBy]);

  const filteredLogs = useMemo(() => {
    const q = logSearchTerm.toLowerCase().trim();
    if (!q) return accessSessionLogs;
    return accessSessionLogs.filter(
      (l) =>
        l.email.toLowerCase().includes(q) ||
        l.name.toLowerCase().includes(q) ||
        l.assignedClassName.toLowerCase().includes(q)
    );
  }, [accessSessionLogs, logSearchTerm]);

  const filteredSecurityLogs = useMemo(() => {
    const q = securitySearchTerm.toLowerCase().trim();
    return securityLogs.filter((entry) => {
      if (
        securitySeverityFilter !== 'all' &&
        entry.severity !== securitySeverityFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        entry.userEmail.toLowerCase().includes(q) ||
        entry.actionTitle.toLowerCase().includes(q) ||
        entry.details.toLowerCase().includes(q) ||
        entry.eventType.toLowerCase().includes(q) ||
        (entry.userName || '').toLowerCase().includes(q)
      );
    });
  }, [securityLogs, securitySearchTerm, securitySeverityFilter]);

  // KPIs & Pendências Operacionais
  const totalUsersWhoAccessed = authorizedUsers.filter(
    (u) => (u.totalAccessCount || 0) > 0
  ).length;
  const totalAccessesCount = authorizedUsers.reduce(
    (acc, u) => acc + (u.totalAccessCount || 0),
    0
  );
  const totalPlatformDurationSeconds = authorizedUsers.reduce(
    (acc, u) => acc + (u.totalDurationSeconds || 0),
    0
  );
  const activeNowSessionsCount = accessSessionLogs.filter((l) => {
    if (l.logoutTimeISO) return false;
    const diffMs = Date.now() - new Date(l.lastHeartbeatISO).getTime();
    return diffMs < 120000;
  }).length;

  const peb1Count = authorizedUsers.filter((u) => resolveAccessLevel(u) === 'usuario').length;
  const peb2Count = specialistsUsers.length;
  const aeeCount = authorizedUsers.filter((u) => resolveAccessLevel(u) === 'aee').length;
  const adminCount = authorizedUsers.filter((u) => resolveAccessLevel(u) === 'admin').length;

  const windowEval = evaluateAttendanceLaunchWindow(attendanceWindowConfig);

  const handleToggleExceptionalLaunch = () => {
    if (!canManage) return;
    const nextState = !attendanceWindowConfig.exceptionalOverrideOpen;
    onUpdateAttendanceWindowConfig({
      ...attendanceWindowConfig,
      exceptionalOverrideOpen: nextState,
      updatedByEmail: currentUserEmail,
      updatedAt: new Date().toLocaleString('pt-BR'),
    });
    triggerFeedback(
      'success',
      nextState
        ? 'Lançamento de faltas liberado excepcionalmente.'
        : 'Liberação excepcional encerrada.'
    );
  };

  const handleSendWindowClosingFcmFromAcessos = async (
    audienceOverride?: 'pending_only' | 'all'
  ) => {
    if (!canManage || isSendingFcmAlert) return;
    setIsSendingFcmAlert(true);
    try {
      const targetAud = audienceOverride || fcmAudienceTarget;
      const res = await dispatchWindowClosingFcmAlert({
        targetAudience: targetAud,
        attendanceWindowConfig,
        classes,
        senderEmail: currentUserEmail,
        senderName: 'Coordenação / Direção Escolar',
        senderRole: userRole,
        senderTeacherRoleType: teacherRoleType,
      });
      triggerFeedback('success', res.message);
      await refreshFcmStatus();
    } catch {
      triggerFeedback('error', 'Não foi possível disparar o alerta FCM agora.');
    } finally {
      setIsSendingFcmAlert(false);
    }
  };

  const handleSaveFcmConfigFromAcessos = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canManage || isSavingFcmConfig) return;
    setIsSavingFcmConfig(true);
    try {
      const ok = await saveFcmSystemConfiguration(fcmConfigDraft);
      triggerFeedback(
        ok ? 'success' : 'error',
        ok
          ? 'Configurações do Firebase Cloud Messaging (FCM) salvas.'
          : 'Erro ao salvar configurações FCM no servidor.'
      );
      await refreshFcmStatus();
    } finally {
      setIsSavingFcmConfig(false);
    }
  };

  const manhaTurmasCount = classes.filter((c) => c.shift === 'Turno Manhã').length;
  const tardeTurmasCount = classes.filter((c) => c.shift === 'Turno Tarde').length;
  const vacantTurmasCount = classes.filter(
    (c) => c.isVaga || c.teacherName === 'TURMA VAGA'
  ).length;

  const { totalActiveStudentsAll, missingPhotosCount, missingPdfsCount } = useMemo(() => {
    let activeTotal = 0;
    let noPhoto = 0;
    let noPdf = 0;
    for (const c of classes) {
      for (const s of c.students) {
        const sit = (s.situacao || 'ATIVO').toUpperCase().trim();
        if (sit.includes('BXTR') || sit.includes('TRANSF') || sit.includes('REMAN')) continue;
        activeTotal += 1;
        if (!s.photo && !s.photoDriveId && !s.photoDriveUrl) noPhoto += 1;
        if (!s.fichaPdfDriveId && !s.fichaPdfDriveUrl) noPdf += 1;
      }
    }
    return {
      totalActiveStudentsAll: activeTotal,
      missingPhotosCount: noPhoto,
      missingPdfsCount: noPdf,
    };
  }, [classes]);

  const effectiveSyncSnapshot: SyncStatusSnapshot = syncSnapshot ?? {
    status: 'synced',
    pendingCount: 0,
    lastSyncedAtISO: null,
    lastError: null,
    queue: [],
  };

  const primarySections: {
    id: AdminCenterSection;
    label: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'acesso',
      label: 'Acesso & Docentes',
      icon: <Users className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'calendario',
      label: 'Calendário & Prazos',
      icon: <CalendarDays className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'uploads',
      label: 'Importações Escolares',
      icon: <Upload className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'seguranca',
      label: 'Segurança & LGPD',
      icon: <ShieldCheck className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'diagnostico',
      label: 'Sistema & Nuvem',
      icon: <Database className="w-4 h-4 shrink-0" />,
    },
  ];

  const accessSubTabs: { id: SubTabId; label: string; count?: number; icon: React.ReactNode }[] = [
    {
      id: 'quadro_turmas',
      label: 'Quadro Docente',
      count: classes.length,
      icon: <School className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'contas_acesso',
      label: 'E-mails Autorizados & Perfis',
      count: authorizedUsers.length,
      icon: <Users className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'rbac_matriz',
      label: 'Permissões (RBAC)',
      icon: <ShieldCheck className="w-4 h-4 shrink-0" />,
    },
  ];

  const calendarSubTabs: { id: SubTabId; label: string; count?: number; icon: React.ReactNode }[] = [
    {
      id: 'calendario_200',
      label: 'Calendário 200 Dias',
      icon: <CalendarDays className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'janela_fcm',
      label: 'Janela de Faltas & FCM',
      count: classes.filter((c) => c.isPending).length,
      icon: <BellRing className="w-4 h-4 shrink-0" />,
    },
  ];

  const securitySubTabs: { id: SubTabId; label: string; count?: number; icon: React.ReactNode }[] = [
    {
      id: 'seguranca_lgpd',
      label: 'Privacidade LGPD & Auditoria',
      count: securityLogs.length,
      icon: <Lock className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'monitoramento',
      label: 'Tempo de Tela & Sessões',
      count: accessSessionLogs.length,
      icon: <Activity className="w-4 h-4 shrink-0" />,
    },
  ];

  const systemSubTabs: { id: SubTabId; label: string; icon: React.ReactNode }[] = [
    {
      id: 'diagnostico_bd',
      label: 'Integridade do Banco',
      icon: <Database className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'nuvem_backup',
      label: 'Nuvem, Backups & Cache',
      icon: <Cloud className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'pwa_identidade',
      label: 'Ícones iOS & PWA',
      icon: <Smartphone className="w-4 h-4 shrink-0" />,
    },
  ];

  const uploadTools: {
    id: 'fotos' | 'pdfs' | 'htm';
    label: string;
    subtitle: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'fotos',
      label: 'Fotos em Lote',
      subtitle: 'Vincular imagens por RA ou nome',
      icon: <Images className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'pdfs',
      label: 'Fichas PDF em Lote',
      subtitle: 'Vincular PDFs nominais',
      icon: <FileText className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'htm',
      label: 'Deficiências .HTM (AEE)',
      subtitle: 'Importar registros SED',
      icon: <FileCode2 className="w-4 h-4 shrink-0" />,
    },
  ];

  const visibleMatrixClasses = useMemo(
    () => filteredMatrixClasses.slice(0, visibleMatrixLimit),
    [filteredMatrixClasses, visibleMatrixLimit]
  );

  const totalUsersPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PAGE_SIZE));
  const safeUsersPage = Math.min(usersPage, totalUsersPages);
  const visibleFilteredUsers = useMemo(() => {
    const start = (safeUsersPage - 1) * USERS_PAGE_SIZE;
    return filteredUsers.slice(start, start + USERS_PAGE_SIZE);
  }, [filteredUsers, safeUsersPage]);

  const totalLogsPages = Math.max(1, Math.ceil(filteredLogs.length / LOGS_PAGE_SIZE));
  const safeLogsPage = Math.min(logsPage, totalLogsPages);
  const visibleSessionLogs = useMemo(() => {
    const start = (safeLogsPage - 1) * LOGS_PAGE_SIZE;
    return filteredLogs.slice(start, start + LOGS_PAGE_SIZE);
  }, [filteredLogs, safeLogsPage]);

  const totalSecurityPages = Math.max(
    1,
    Math.ceil(filteredSecurityLogs.length / SECURITY_PAGE_SIZE)
  );
  const safeSecurityPage = Math.min(securityPage, totalSecurityPages);
  const visibleSecurityAuditLogs = useMemo(() => {
    const start = (safeSecurityPage - 1) * SECURITY_PAGE_SIZE;
    return filteredSecurityLogs.slice(start, start + SECURITY_PAGE_SIZE);
  }, [filteredSecurityLogs, safeSecurityPage]);

  const assignModalUser = useMemo(
    () => authorizedUsers.find((u) => u.id === assignModalUserId) || null,
    [authorizedUsers, assignModalUserId]
  );

  const hasOperationalBottlenecks =
    missingPhotosCount > 0 || missingPdfsCount > 0 || vacantTurmasCount > 0;

  return (
    <div className="flex flex-col w-full min-w-0 max-w-[1600px] mx-auto space-y-4 pb-20 animate-gentle-fade text-[#0f172a] overflow-x-clip">
      {feedbackMsg && (
        <div
          role="status"
          className={`rounded-2xl px-4 py-3 text-sm font-medium flex items-center justify-between gap-3 shadow-sm transition-all duration-100 ${
            feedbackMsg.type === 'success'
              ? 'bg-[#ecfdf5] text-[#047857]'
              : 'bg-[#fee2e2] text-[#991b1b]'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span className="break-words">{feedbackMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="p-1 rounded-lg hover:bg-black/5 cursor-pointer shrink-0"
            aria-label="Fechar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. CABEÇALHO UNIFICADO DA CENTRAL ADMINISTRATIVA */}
      <section className="bg-white rounded-3xl px-4 py-4 sm:px-6 sm:py-5 border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-4 min-w-0">
        <div className="space-y-1 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0071E3] hover:text-[#0077ED] transition-colors duration-150 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar</span>
          </button>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#1D1D1F] break-words">
            Central Administrativa
          </h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#86868B] tabular-nums">
            <span className="font-semibold text-[#0071E3]">Ano Letivo {activeSchoolYear}</span>
            <span aria-hidden="true">·</span>
            <span>{classes.length} turmas ({manhaTurmasCount} manhã · {tardeTurmasCount} tarde)</span>
            <span aria-hidden="true">·</span>
            <span>{authorizedUsers.length} contas</span>
            <span aria-hidden="true">·</span>
            <span>{totalActiveStudentsAll} alunos ativos</span>
            {activeNowSessionsCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#1B873F] font-semibold">
                  {activeNowSessionsCount} online agora
                </span>
              </>
            )}
          </div>
        </div>

        {/* 4 Indicadores Principais */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => handleSelectSection('acesso', 'quadro_turmas')}
            className="text-left p-4 rounded-2xl bg-[#F5F5F7] hover:bg-black/[0.04] border border-black/[0.06] card-interactive cursor-pointer min-w-0 break-words transition-all"
          >
            <span className="text-xs font-medium text-[#86868B] block">Turmas Oficiais</span>
            <span className="text-2xl sm:text-3xl font-semibold text-[#1D1D1F] tabular-nums block mt-0.5">
              {classes.length}
            </span>
            <span className="text-xs text-[#86868B] tabular-nums block mt-0.5 break-words">
              {manhaTurmasCount} manhã · {tardeTurmasCount} tarde
              {vacantTurmasCount > 0 ? ` · ${vacantTurmasCount} vagas` : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              handleSelectSection('acesso', 'contas_acesso');
              setRoleFilter('all');
            }}
            className="text-left p-4 rounded-2xl bg-[#F5F5F7] hover:bg-black/[0.04] border border-black/[0.06] card-interactive cursor-pointer min-w-0 break-words transition-all"
          >
            <span className="text-xs font-medium text-[#86868B] block">Perfis Cadastrados</span>
            <span className="text-2xl sm:text-3xl font-semibold text-[#1D1D1F] tabular-nums block mt-0.5">
              {authorizedUsers.length}
            </span>
            <span className="text-xs text-[#86868B] tabular-nums block mt-0.5 break-words">
              Admin: {adminCount} · PEB I: {peb1Count} · PEB II: {peb2Count} · AEE: {aeeCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSection('seguranca', 'monitoramento')}
            className="text-left p-4 rounded-2xl bg-[#F5F5F7] hover:bg-black/[0.04] border border-black/[0.06] card-interactive cursor-pointer min-w-0 break-words transition-all"
          >
            <span className="text-xs font-medium text-[#86868B] block">Acessos &amp; Sessões</span>
            <span className="text-2xl sm:text-3xl font-semibold text-[#1D1D1F] tabular-nums block mt-0.5">
              {totalUsersWhoAccessed}/{authorizedUsers.length}
            </span>
            <span className="text-xs text-[#1B873F] font-semibold tabular-nums block mt-0.5 break-words">
              {totalAccessesCount} entradas · {activeNowSessionsCount} online
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSection('seguranca', 'seguranca_lgpd')}
            className="text-left p-4 rounded-2xl bg-[#F5F5F7] hover:bg-black/[0.04] border border-black/[0.06] card-interactive cursor-pointer min-w-0 break-words transition-all"
          >
            <span className="text-xs font-medium text-[#86868B] block">Tempo Total &amp; LGPD</span>
            <span className="text-2xl sm:text-3xl font-semibold text-[#1D1D1F] tabular-nums block mt-0.5 break-words">
              {formatDurationHuman(totalPlatformDurationSeconds)}
            </span>
            <span className="text-xs text-[#86868B] block mt-0.5 break-words">
              {lgpdConfig.maskSensitiveDataByDefault ? 'Mascaramento LGPD ativo' : 'Modo auditoria aberto'}
            </span>
          </button>
        </div>

        {/* Pendências Operacionais Acionáveis */}
        {hasOperationalBottlenecks && (
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <span className="text-xs font-semibold text-[#424245] mr-1">
              Pendências da Secretaria:
            </span>
            {missingPhotosCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  handleSelectSection('uploads');
                  setActiveUploadTool('fotos');
                }}
                className="min-h-[34px] px-3 py-1 rounded-xl bg-[#FFF5E5] hover:bg-[#fde68a]/60 text-[#92400e] border border-[#b45309]/15 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer tabular-nums transition-colors"
              >
                <Images className="w-3.5 h-3.5 shrink-0" />
                <span>{missingPhotosCount} alunos sem foto</span>
              </button>
            )}
            {missingPdfsCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  handleSelectSection('uploads');
                  setActiveUploadTool('pdfs');
                }}
                className="min-h-[34px] px-3 py-1 rounded-xl bg-[#F5F5F7] hover:bg-black/[0.06] text-[#1D1D1F] border border-black/[0.08] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer tabular-nums transition-colors"
              >
                <FileText className="w-3.5 h-3.5 shrink-0 text-[#0071E3]" />
                <span>{missingPdfsCount} sem ficha PDF</span>
              </button>
            )}
            {vacantTurmasCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  handleSelectSection('acesso', 'quadro_turmas');
                  setMatrixShiftFilter('VAGAS');
                }}
                className="min-h-[34px] px-3 py-1 rounded-xl bg-[#fee2e2] hover:bg-[#fecaca]/80 text-[#991b1b] border border-[#991b1b]/15 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer tabular-nums transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{vacantTurmasCount} turmas vagas</span>
              </button>
            )}
          </div>
        )}

        {/* Banner Limpo da Janela de Lançamento de Faltas */}
        <div
          className={`p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            windowEval.isAllowedToLaunch ? 'bg-[#ecfdf5]' : 'bg-[#fef3c7]/80'
          }`}
        >
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white ${
                windowEval.isAllowedToLaunch ? 'bg-[#047857]' : 'bg-[#b45309]'
              }`}
            >
              {windowEval.isAllowedToLaunch ? (
                <Unlock className="w-4 h-4" />
              ) : (
                <Clock className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold text-slate-950">
                {windowEval.statusTitle}
              </p>
              <p className="text-xs text-slate-700 break-words">
                {windowEval.statusDescription}
              </p>
            </div>
          </div>

          {canManage && (
            <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => handleSelectSection('calendario', 'janela_fcm')}
                className="min-h-[38px] px-3.5 rounded-full bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] border border-black/[0.08] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
              >
                <BellRing className="w-3.5 h-3.5 shrink-0 text-[#0071E3]" />
                <span>Regras &amp; FCM</span>
              </button>

              <button
                type="button"
                disabled={isSendingFcmAlert}
                onClick={() => handleSendWindowClosingFcmFromAcessos('pending_only')}
                title="Enviar notificação push Firebase Cloud Messaging para turmas pendentes sobre o fechamento da janela"
                className="min-h-[38px] px-4 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60 transition-colors shadow-2xs whitespace-nowrap shrink-0"
              >
                <BellRing className="w-3.5 h-3.5 shrink-0" />
                <span>{isSendingFcmAlert ? 'Enviando FCM...' : 'Alertar Pendentes (FCM)'}</span>
              </button>

              <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/90">
                <Key className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                <ToggleSwitch
                  checked={attendanceWindowConfig.exceptionalOverrideOpen}
                  onChange={handleToggleExceptionalLaunch}
                  activeText="Liberação Ativa"
                  inactiveText="Liberação Desligada"
                  ariaLabel="Alternar liberação excepcional de lançamento de faltas"
                />
              </div>
            </div>
          )}
        </div>

        {/* Barra Primária dos 5 Pilares */}
        <nav
          aria-label="Seções da central administrativa"
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 p-1 bg-[#F5F5F7] rounded-2xl lg:rounded-full border border-black/[0.06]"
        >
          {primarySections.map((sec) => {
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => handleSelectSection(sec.id)}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl lg:rounded-full text-xs font-medium inline-flex items-center justify-center gap-2 text-center cursor-pointer transition-all ${
                  isActive
                    ? 'bg-white text-[#1D1D1F] font-semibold shadow-xs'
                    : 'text-[#86868B] hover:text-[#1D1D1F]'
                }`}
              >
                {sec.icon}
                <span className="truncate">{sec.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sub-navegação contextual */}
        {activeSection === 'acesso' && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {accessSubTabs.map((t) => {
              const isActive = activeSubTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveSubTab(t.id)}
                  className={`min-h-[34px] px-3.5 py-1.5 rounded-full text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-all border border-black/[0.06] ${
                    isActive
                      ? 'bg-[#0071E3] text-white font-semibold shadow-xs'
                      : 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-black/[0.05]'
                  }`}
                >
                  {t.icon}
                  <span>{t.label}</span>
                  {typeof t.count === 'number' && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[11px] tabular-nums ${
                        isActive ? 'bg-white/20 text-white font-semibold' : 'bg-white text-[#86868B]'
                      }`}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {activeSection === 'calendario' && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {calendarSubTabs.map((t) => {
              const isActive = activeSubTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveSubTab(t.id)}
                  className={`min-h-[34px] px-3.5 py-1.5 rounded-full text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-all border border-black/[0.06] ${
                    isActive
                      ? 'bg-[#0071E3] text-white font-semibold shadow-xs'
                      : 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-black/[0.05]'
                  }`}
                >
                  {t.icon}
                  <span>{t.label}</span>
                  {typeof t.count === 'number' && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[11px] tabular-nums ${
                        isActive ? 'bg-white/20 text-white font-semibold' : 'bg-white text-[#86868B]'
                      }`}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {activeSection === 'seguranca' && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {securitySubTabs.map((t) => {
              const isActive = activeSubTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveSubTab(t.id)}
                  className={`min-h-[34px] px-3.5 py-1.5 rounded-full text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-all border border-black/[0.06] ${
                    isActive
                      ? 'bg-[#0071E3] text-white font-semibold shadow-xs'
                      : 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-black/[0.05]'
                  }`}
                >
                  {t.icon}
                  <span>{t.label}</span>
                  {typeof t.count === 'number' && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[11px] tabular-nums ${
                        isActive ? 'bg-white/20 text-white font-semibold' : 'bg-white text-[#86868B]'
                      }`}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {activeSection === 'diagnostico' && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {systemSubTabs.map((t) => {
              const isActive = activeSubTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveSubTab(t.id)}
                  className={`min-h-[34px] px-3.5 py-1.5 rounded-full text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-all border border-black/[0.06] ${
                    isActive
                      ? 'bg-[#0071E3] text-white font-semibold shadow-xs'
                      : 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-black/[0.05]'
                  }`}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* PILAR 1: ACESSO & DOCENTES */}
      {activeSection === 'acesso' && activeSubTab === 'quadro_turmas' && (
        <AdminQuadroTurmasTab
          classes={classes}
          authorizedUsers={authorizedUsers}
          specialistsUsers={specialistsUsers}
          filteredMatrixClasses={filteredMatrixClasses}
          visibleMatrixClasses={visibleMatrixClasses}
          visibleMatrixLimit={visibleMatrixLimit}
          manhaTurmasCount={manhaTurmasCount}
          tardeTurmasCount={tardeTurmasCount}
          vacantTurmasCount={vacantTurmasCount}
          matrixShiftFilter={matrixShiftFilter}
          matrixSearchTerm={matrixSearchTerm}
          editingMatrixClassId={editingMatrixClassId}
          matrixDraft={matrixDraft}
          canManage={canManage}
          onChangeShiftFilter={setMatrixShiftFilter}
          onChangeSearchTerm={setMatrixSearchTerm}
          onChangeVisibleLimit={setVisibleMatrixLimit}
          onStartEditRow={handleStartEditMatrixRow}
          onChangeMatrixDraft={setMatrixDraft}
          onSaveMatrixRow={handleSaveMatrixRow}
          onCancelEditRow={() => {
            setEditingMatrixClassId(null);
            setMatrixDraft(null);
          }}
          onRestoreOfficialMatrix={handleRestoreOfficialSchoolMatrix}
          onSimulateTeacherProfile={onSimulateTeacherProfile}
          findRegenteUserForClass={findRegenteUserForClass}
          onFeedback={triggerFeedback}
        />
      )}

      {activeSection === 'acesso' && activeSubTab === 'contas_acesso' && (
        <AdminContasAcessoTab
          authorizedUsers={authorizedUsers}
          filteredUsers={filteredUsers}
          visibleFilteredUsers={visibleFilteredUsers}
          classes={classes}
          canManage={canManage}
          usersPage={safeUsersPage}
          pageSize={USERS_PAGE_SIZE}
          searchTerm={searchTerm}
          roleFilter={roleFilter}
          statusFilter={statusFilter}
          userSortBy={userSortBy}
          onlyAccessedFilter={onlyAccessedFilter}
          hasActiveUserFilters={hasActiveUserFilters}
          activeUsersCount={activeUsersCount}
          blockedUsersCount={blockedUsersCount}
          temporaryUsersCount={temporaryUsersCount}
          expiredUsersCount={expiredUsersCount}
          adminCount={adminCount}
          peb1Count={peb1Count}
          peb2Count={peb2Count}
          aeeCount={aeeCount}
          totalUsersWhoAccessed={totalUsersWhoAccessed}
          showAddUserForm={showAddUserForm}
          emailPrefix={emailPrefix}
          name={name}
          newAccessLevel={newAccessLevel}
          assignedClassId={assignedClassId}
          newExpirationDate={newExpirationDate}
          draftEdits={draftEdits}
          recentlySavedUserIds={recentlySavedUserIds}
          onChangeSearchTerm={(val) => {
            setSearchTerm(val);
            setUsersPage(1);
          }}
          onChangeRoleFilter={(val) => {
            setRoleFilter(val);
            setUsersPage(1);
          }}
          onChangeStatusFilter={(val) => {
            setStatusFilter(val);
            setUsersPage(1);
          }}
          onChangeUserSortBy={setUserSortBy}
          onToggleOnlyAccessedFilter={() => {
            setOnlyAccessedFilter((prev) => !prev);
            setUsersPage(1);
          }}
          onResetUserFilters={handleResetUserFilters}
          onChangeUsersPage={setUsersPage}
          onToggleShowAddForm={() => setShowAddUserForm((prev) => !prev)}
          onChangeEmailPrefix={setEmailPrefix}
          onChangeName={setName}
          onChangeNewAccessLevel={setNewAccessLevel}
          onChangeAssignedClassId={setAssignedClassId}
          onChangeNewExpirationDate={setNewExpirationDate}
          onAddUser={handleAddUser}
          onToggleActive={handleToggleActive}
          onSelectAccessLevel={handleSelectAccessLevel}
          onUpdateUserExpiration={handleUpdateUserExpiration}
          onOpenAssignModal={(userId) => {
            setAssignModalSearch('');
            setAssignModalUserId(userId);
          }}
          onRemoveUser={handleRemoveUser}
          onSimulateTeacherProfile={onSimulateTeacherProfile}
          onFeedback={triggerFeedback}
        />
      )}

      {activeSection === 'acesso' && activeSubTab === 'rbac_matriz' && (
        <AdminRbacMatrizTab
          selectedRbacRoleKey={selectedRbacRoleKey}
          onSelectRbacRoleKey={setSelectedRbacRoleKey}
          onOpenSecurityAudit={() => handleSelectSection('seguranca', 'seguranca_lgpd')}
        />
      )}

      {/* PILAR 2: CALENDÁRIO & PRAZOS */}
      {activeSection === 'calendario' && activeSubTab === 'calendario_200' && (
        <LazyErrorBoundary resetKey="calendario_200">
          <Suspense
            fallback={
              <div className="bg-white rounded-3xl p-8 flex items-center justify-center gap-2.5 text-xs font-semibold text-slate-700 shadow-xs">
                <Loader2 className="w-5 h-5 text-[#0f3370] animate-spin" />
                <span>Carregando configurador oficial de 200 dias...</span>
              </div>
            }
          >
            <DiasLetivosScreen
              embedded
              userRole={userRole}
              userEmail={currentUserEmail}
              userName="Administrador Escolar"
              classes={classes}
              onUpdateClasses={(updatedClasses) => {
                const latestCal = getStoredOfficialCalendarConfig();
                if (latestCal?.year) {
                  setActiveSchoolYear(latestCal.year);
                }
                if (onUpdateClasses) onUpdateClasses(updatedClasses);
                triggerFeedback(
                  'success',
                  `Ano letivo ${latestCal?.year || activeSchoolYear} (200 dias) publicado e sincronizado com as turmas.`
                );
              }}
              onNavigateToSheet={() => {
                handleSelectSection('diagnostico', 'nuvem_backup');
                setIsSheetsCredentialsModalOpen(true);
              }}
              onBack={() => handleSelectSection('acesso', 'quadro_turmas')}
            />
          </Suspense>
        </LazyErrorBoundary>
      )}

      {activeSection === 'calendario' && activeSubTab === 'janela_fcm' && (
        <AdminFcmAlertsCard
          classes={classes}
          canManage={canManage}
          attendanceWindowConfig={attendanceWindowConfig}
          fcmStatus={fcmStatus}
          fcmConfigDraft={fcmConfigDraft}
          fcmAudienceTarget={fcmAudienceTarget}
          isLoadingFcmStatus={isLoadingFcmStatus}
          isSendingFcmAlert={isSendingFcmAlert}
          isSavingFcmConfig={isSavingFcmConfig}
          onToggleExceptionalLaunch={handleToggleExceptionalLaunch}
          onChangeAudienceTarget={setFcmAudienceTarget}
          onChangeFcmConfigDraft={setFcmConfigDraft}
          onSendFcmAlert={handleSendWindowClosingFcmFromAcessos}
          onSaveFcmConfig={handleSaveFcmConfigFromAcessos}
          onRefreshFcmStatus={() => {
            void refreshFcmStatus();
          }}
        />
      )}

      {/* PILAR 3: IMPORTAÇÕES ESCOLARES */}
      {activeSection === 'uploads' && (
        <section className="bg-white rounded-3xl p-4 sm:p-5 border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {uploadTools.map((tool) => {
              const isActive = activeUploadTool === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => setActiveUploadTool(tool.id)}
                  className={`min-w-0 text-left p-3.5 rounded-2xl transition-all duration-150 card-interactive cursor-pointer flex items-center gap-3 ${
                    isActive
                      ? 'bg-[#14428c] text-white shadow-xs'
                      : 'bg-[#f3f6fb] hover:bg-[#eef3f9] text-slate-950'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isActive ? 'bg-white/20 text-white' : 'bg-white text-[#14428c]'
                    }`}
                  >
                    {tool.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs sm:text-sm font-semibold block break-words leading-snug">
                      {tool.label}
                    </span>
                    <span
                      className={`text-[11px] block break-words leading-snug mt-0.5 ${
                        isActive ? 'text-slate-200' : 'text-slate-700'
                      }`}
                    >
                      {tool.subtitle}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="pt-1">
            <LazyErrorBoundary resetKey={`uploads:${activeUploadTool}`}>
              <Suspense
                fallback={
                  <div className="rounded-2xl bg-[#f3f6fb] p-8 flex items-center justify-center gap-2.5 text-xs font-semibold text-slate-700">
                    <Loader2 className="w-5 h-5 text-[#0f3370] animate-spin" />
                    <span>Carregando ferramenta de importação...</span>
                  </div>
                }
              >
                {activeUploadTool === 'fotos' && (
                  <AdminArrasteFotosModal
                    isOpen
                    embedded
                    onOpenStorageManager={() => setIsPhotoStorageModalOpen(true)}
                    onClose={() => handleSelectSection('acesso', 'quadro_turmas')}
                    classes={classes}
                    onBatchPhotosSaved={(updatedClasses) => {
                      if (onUpdateClasses) onUpdateClasses(updatedClasses);
                      triggerFeedback('success', 'Lote de fotos salvo e sincronizado.');
                    }}
                  />
                )}

                {activeUploadTool === 'pdfs' && (
                  <AdminArrastePdfsModal
                    isOpen
                    embedded
                    onClose={() => handleSelectSection('acesso', 'quadro_turmas')}
                    classes={classes}
                    onBatchPdfsSaved={(updatedClasses) => {
                      if (onUpdateClasses) onUpdateClasses(updatedClasses);
                      triggerFeedback('success', 'Lote de Fichas PDF vinculado com sucesso.');
                    }}
                  />
                )}

                {activeUploadTool === 'htm' && (
                  <ImportarDeficienciasHtmScreen
                    embedded
                    classes={classes}
                    userRole={userRole}
                    userEmail={currentUserEmail}
                    teacherRoleType={teacherRoleType}
                    onUpdateClasses={(updatedClasses) => {
                      if (onUpdateClasses) onUpdateClasses(updatedClasses);
                    }}
                    onBack={() => handleSelectSection('acesso', 'quadro_turmas')}
                  />
                )}
              </Suspense>
            </LazyErrorBoundary>
          </div>
        </section>
      )}

      {/* PILAR 4: SEGURANÇA & LGPD */}
      {activeSection === 'seguranca' && activeSubTab === 'seguranca_lgpd' && (
        <div className="space-y-4">
          <section className="bg-white rounded-3xl p-4 sm:p-5 border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-semibold text-slate-950">
                  Segurança, Privacidade e LGPD (Art. 14)
                </h2>
                <p className="text-xs text-slate-700 max-w-2xl">
                  Proteção contínua de dados de crianças e adolescentes com mascaramento automático e trilha de auditoria.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <ExportFormatButton
                  label="Exportar Auditoria"
                  variant="primary"
                  includeCsv
                  onExport={async (format) => {
                    if (format === 'csv') {
                      handleExportSecurityAudit();
                      return;
                    }
                    const report = buildSecurityAuditReport(filteredSecurityLogs);
                    const fileName = await exportUniversalReport(report, format);
                    const newEntry = addSecurityAuditLog({
                      userEmail: currentUserEmail,
                      userName: 'Administrador Escolar',
                      userRole: 'admin',
                      eventType: 'STUDENT_DATA_EXPORTED',
                      actionTitle: `Relatório de Auditoria LGPD Exportado (.${format.toUpperCase()})`,
                      details: `Download completo da trilha de auditoria em ${fileName}.`,
                      targetResource: 'Auditoria de Segurança',
                      severity: 'info',
                    });
                    setSecurityLogs((prev) => [newEntry, ...prev]);
                    triggerFeedback('success', `Relatório de Auditoria ${fileName} baixado com sucesso.`);
                  }}
                />

                {canManage && (
                  <div className="px-3.5 py-2 rounded-xl bg-[#eef3f9] inline-flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-slate-700" />
                    <ToggleSwitch
                      checked={lgpdConfig.maskSensitiveDataByDefault}
                      onChange={handleToggleMasking}
                      activeText="Mascaramento LGPD Ativo"
                      inactiveText="Mascaramento Desativado"
                      ariaLabel="Alternar mascaramento LGPD de dados sensíveis"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div className="p-3.5 rounded-2xl bg-[#f3f6fb] space-y-1">
                <span className="text-xs font-semibold text-[#047857] block">Criptografia</span>
                <span className="text-sm font-semibold text-slate-950 block">TLS 1.3 / HTTPS</span>
                <p className="text-xs text-slate-700">
                  Dados protegidos em trânsito e armazenamento local.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#f3f6fb] space-y-1">
                <span className="text-xs font-semibold text-[#14428c] block">Autenticação</span>
                <span className="text-sm font-semibold text-slate-950 block">
                  Domínio Institucional
                </span>
                <p className="text-xs text-slate-700 break-words">
                  Apenas e-mails {INSTITUTIONAL_EMAIL_DOMAIN}.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#f3f6fb] space-y-1">
                <span className="text-xs font-semibold text-slate-700 block">Proteção LGPD</span>
                <span className="text-sm font-semibold text-slate-950 block">
                  {lgpdConfig.maskSensitiveDataByDefault ? 'Dados Mascarados' : 'Modo Auditoria'}
                </span>
                <p className="text-xs text-slate-700">
                  CPF, NIS, endereços e laudos protegidos.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#f3f6fb] space-y-1">
                <span className="text-xs font-semibold text-slate-700 block">Retenção Legal</span>
                <span className="text-sm font-semibold text-slate-950 tabular-nums block">
                  5 Anos Letivos
                </span>
                <p className="text-xs text-slate-700">
                  Guarda de 1.825 dias para auditoria escolar.
                </p>
              </div>
            </div>
          </section>

          <AdminSecurityLogsTab
            securityLogsTotal={securityLogs.length}
            filteredSecurityLogs={filteredSecurityLogs}
            pagedSecurityLogs={visibleSecurityAuditLogs}
            currentPage={safeSecurityPage}
            pageSize={SECURITY_PAGE_SIZE}
            searchTerm={securitySearchTerm}
            severityFilter={securitySeverityFilter}
            canManage={canManage}
            onChangeSearchTerm={(val) => {
              setSecuritySearchTerm(val);
              setSecurityPage(1);
            }}
            onChangeSeverityFilter={(val) => {
              setSecuritySeverityFilter(val);
              setSecurityPage(1);
            }}
            onPageChange={setSecurityPage}
            onExportBeforeClear={handleExportSecurityAudit}
            onClearLogs={handleClearSecurityLogs}
          />
        </div>
      )}

      {activeSection === 'seguranca' && activeSubTab === 'monitoramento' && (
        <AdminSessionLogsSection
          totalLogsCount={accessSessionLogs.length}
          filteredLogs={filteredLogs}
          pagedLogs={visibleSessionLogs}
          currentPage={safeLogsPage}
          pageSize={LOGS_PAGE_SIZE}
          searchTerm={logSearchTerm}
          canManage={canManage}
          hasClearAction={Boolean(onClearAccessLogs)}
          onChangeSearchTerm={(val) => {
            setLogSearchTerm(val);
            setLogsPage(1);
          }}
          onPageChange={setLogsPage}
          onClearLogs={onClearAccessLogs}
        />
      )}

      {/* PILAR 5: SISTEMA & NUVEM */}
      {activeSection === 'diagnostico' && activeSubTab === 'diagnostico_bd' && (
        <LazyErrorBoundary resetKey="diagnostico_bd">
          <Suspense
            fallback={
              <div className="bg-white rounded-3xl p-8 flex items-center justify-center gap-2.5 text-xs font-semibold text-slate-700 shadow-xs">
                <Loader2 className="w-5 h-5 text-[#0f3370] animate-spin" />
                <span>Carregando diagnóstico do banco de dados...</span>
              </div>
            }
          >
            <DiagnosticoBancoDadosScreen
              embedded
              classes={classes}
              authorizedUsers={authorizedUsers}
              syncSnapshot={effectiveSyncSnapshot}
              userRole={userRole}
              userEmail={currentUserEmail}
              teacherRoleType={teacherRoleType}
              onUpdateClasses={(updatedClasses) => {
                if (onUpdateClasses) onUpdateClasses(updatedClasses);
              }}
              onOpenClassDetails={(cls) => {
                if (onOpenClassDetails) {
                  onOpenClassDetails(cls);
                } else if (onNavigateScreen) {
                  onNavigateScreen('detalhes');
                }
              }}
              onNavigateScreen={onNavigateScreen || (() => {})}
              onOpenHtmUpload={() => {
                handleSelectSection('uploads');
                setActiveUploadTool('htm');
              }}
              onOpenPhotoCacheModal={() => setIsPhotoStorageModalOpen(true)}
              onBack={() => handleSelectSection('acesso', 'quadro_turmas')}
            />
          </Suspense>
        </LazyErrorBoundary>
      )}

      {activeSection === 'diagnostico' && activeSubTab === 'nuvem_backup' && (
        <AdminSystemCloudTab
          classes={classes}
          currentUserEmail={currentUserEmail}
          onUpdateClasses={(updatedClasses) => {
            if (onUpdateClasses) onUpdateClasses(updatedClasses);
          }}
          onOpenSheetsModal={() => setIsSheetsCredentialsModalOpen(true)}
          onOpenDriveBackupModal={() => setIsDriveBackupModalOpen(true)}
          onOpenPhotoStorageModal={() => setIsPhotoStorageModalOpen(true)}
          onFeedback={triggerFeedback}
        />
      )}

      {activeSection === 'diagnostico' && activeSubTab === 'pwa_identidade' && (
        <LazyErrorBoundary resetKey="pwa_identidade">
          <Suspense
            fallback={
              <div className="bg-white rounded-3xl p-8 flex items-center justify-center gap-2.5 text-xs font-semibold text-slate-700 shadow-xs">
                <Loader2 className="w-5 h-5 text-[#0f3370] animate-spin" />
                <span>Carregando verificador PWA...</span>
              </div>
            }
          >
            <PwaIconsHealthScanner />
          </Suspense>
        </LazyErrorBoundary>
      )}

      <AdminUserAssignModal
        user={assignModalUser}
        classes={classes}
        canManage={canManage}
        searchQuery={assignModalSearch}
        onChangeSearchQuery={setAssignModalSearch}
        resolveAccessLevel={(u) => resolveAccessLevel(u)}
        getUserEffectiveClassIds={getUserEffectiveClassIds}
        onToggleActive={handleToggleActive}
        onUpdateExpiration={handleUpdateUserExpiration}
        onSetFunctionPreset={handleSetUserFunctionPreset}
        onToggleExtraClass={handleToggleUserExtraClass}
        onClose={() => setAssignModalUserId(null)}
      />

      {isPhotoStorageModalOpen && (
        <LazyErrorBoundary
          mode="modal"
          resetKey={isPhotoStorageModalOpen}
          onDismiss={() => setIsPhotoStorageModalOpen(false)}
        >
          <Suspense fallback={null}>
            <IndexedDbPhotoStorageModal
              isOpen={isPhotoStorageModalOpen}
              onClose={() => setIsPhotoStorageModalOpen(false)}
              classes={classes}
              currentUserEmail={currentUserEmail}
              onCacheUpdated={(msg) => triggerFeedback('success', msg)}
            />
          </Suspense>
        </LazyErrorBoundary>
      )}

      {isSheetsCredentialsModalOpen && (
        <LazyErrorBoundary
          mode="modal"
          resetKey={isSheetsCredentialsModalOpen}
          onDismiss={() => setIsSheetsCredentialsModalOpen(false)}
        >
          <Suspense fallback={null}>
            <GoogleSheetsCredentialsModal
              isOpen={isSheetsCredentialsModalOpen}
              onClose={() => setIsSheetsCredentialsModalOpen(false)}
              onCredentialsUpdated={() => {
                triggerFeedback('success', 'Credenciais e conexões da nuvem atualizadas com sucesso.');
              }}
            />
          </Suspense>
        </LazyErrorBoundary>
      )}

      {isDriveBackupModalOpen && (
        <LazyErrorBoundary
          mode="modal"
          resetKey={isDriveBackupModalOpen}
          onDismiss={() => setIsDriveBackupModalOpen(false)}
        >
          <Suspense fallback={null}>
            <GoogleDriveBackupModal
              isOpen={isDriveBackupModalOpen}
              onClose={() => setIsDriveBackupModalOpen(false)}
              classes={classes}
              currentUserEmail={currentUserEmail}
            />
          </Suspense>
        </LazyErrorBoundary>
      )}
    </div>
  );
};
