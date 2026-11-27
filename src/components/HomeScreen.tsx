import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  AuthorizedUser,
  ClassGroup,
  Student,
  UserRole,
  SchoolNotice,
  AttendanceWindowConfig,
  ScreenType,
} from '../types';
import {
  evaluateAttendanceLaunchWindow,
  getStoredOfficialCalendarConfig,
} from '../services/db';
import { getDefaultReferencePeriod } from '../utils/attendanceRules';
import { QuadroAvisosDirecao } from './QuadroAvisosDirecao';
import { LembretePrazoFrequenciaCard } from './LembretePrazoFrequenciaCard';
import { ResumoFaltasCriticasCard } from './ResumoFaltasCriticasCard';
import { PaginationBar } from './ui/PaginationBar';
import { SyncElapsedTimeBadge } from './SyncElapsedTimeBadge';
import { motion, useReducedMotion } from 'framer-motion';
import { SFSymbol } from './ui/SFSymbol';
import { triggerMenuHaptic } from '../utils/haptics';
import { toast } from 'sonner';
import { ExportFormatButton } from './ui/ExportFormatButton';
import { exportUniversalReport } from '../utils/universalExport';
import { buildHomeSchoolOverviewReport } from '../utils/reportBuilders';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
} from 'recharts';

interface HomeScreenProps {
  userRole: UserRole;
  teacherRoleType?: AuthorizedUser['teacherRoleType'];
  userName?: string;
  userEmail?: string;
  classes: ClassGroup[];
  assignedClassId: string;
  assignedClassIds?: string[];
  schoolNotices?: SchoolNotice[];
  attendanceWindowConfig: AttendanceWindowConfig;
  onNavigateToScreen: (screen: ScreenType) => void;
  onSelectClassForDetails?: (cls: ClassGroup) => void;
  onSelectClassForMonthlyAttendance: (cls: ClassGroup) => void;
  onSelectStudentForConsecutiveScreen?: (classId: string, studentId: string) => void;
  onOpenStudentGrid?: (student: Student) => void;
  onOpenStudentPdf?: (student: Student, className: string) => void;
  onSaveSchoolNotices?: (updatedNotices: SchoolNotice[]) => void;
  onMarkNoticeRead?: (
    noticeIds: string[],
    reader: { userEmail: string; userName: string; userRole?: string }
  ) => void;
  onNavigateToAcessos?: () => void;
  onOpenClassPendingFichas?: (cls: ClassGroup) => void;
}

interface QuickActionItem {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accentBg: string;
  accentText: string;
  onClick: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  userRole,
  teacherRoleType,
  userName = 'Educador(a)',
  userEmail,
  classes = [],
  assignedClassId,
  assignedClassIds = [],
  schoolNotices = [],
  attendanceWindowConfig,
  onNavigateToScreen,
  onSelectClassForDetails,
  onSelectClassForMonthlyAttendance,
  onSelectStudentForConsecutiveScreen,
  onOpenStudentGrid,
  onOpenStudentPdf,
  onSaveSchoolNotices,
  onMarkNoticeRead,
  onNavigateToAcessos,
  onOpenClassPendingFichas,
}) => {
  const isStrictAdmin =
    userRole === 'admin' && teacherRoleType !== 'apoio' && teacherRoleType !== 'aee';
  const canLaunchAttendance =
    isStrictAdmin || userRole === 'usuario';
  const prefersReducedMotion = useReducedMotion();
  const tapAnimation = prefersReducedMotion ? undefined : { scale: 0.97 };

  const [selectedShiftFilter, setSelectedShiftFilter] = useState<'TODOS' | 'MANHÃ' | 'TARDE'>('TODOS');
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [turmaSearchInput, setTurmaSearchInput] = useState('');
  const [classesPage, setClassesPage] = useState(1);
  const classesSectionRef = useRef<HTMLElement | null>(null);
  const HOME_CLASSES_PAGE_SIZE = 8;
  const [activeHubTab, setActiveHubTab] = useState<'prazos' | 'busca_ativa'>('prazos');
  const [chartFilterShift, setChartFilterShift] = useState<'all' | 'MANHÃ' | 'TARDE'>('all');
  const [chartSortMode, setChartSortMode] = useState<'default' | 'asc'>('default');
  const [showAllMissingFichasClasses, setShowAllMissingFichasClasses] = useState(false);
  const [copiedFamilyFichaPrompt, setCopiedFamilyFichaPrompt] = useState(false);

  const referencePeriod = useMemo(() => getDefaultReferencePeriod(new Date()), []);
  const activeSchoolYear = useMemo(
    () => getStoredOfficialCalendarConfig().year || referencePeriod.year || 2027,
    [referencePeriod.year]
  );
  const windowEval = useMemo(
    () => evaluateAttendanceLaunchWindow(attendanceWindowConfig),
    [attendanceWindowConfig]
  );

  const visibleBaseClasses = useMemo(() => {
    if (userRole !== 'usuario') return classes;
    const allowedIds =
      assignedClassIds.length > 0 ? assignedClassIds : assignedClassId ? [assignedClassId] : [];
    const matched = classes.filter((c) => allowedIds.includes(c.id));
    return matched.length > 0 ? matched : classes.slice(0, 1);
  }, [classes, userRole, assignedClassId, assignedClassIds]);

  const schoolStats = useMemo(() => {
    let totalStudents = 0;
    let activeStudents = 0;
    let aeeCount = 0;
    let sumPresence = 0;
    let countedClasses = 0;
    let criticalConsecutiveCount = 0;
    let morningCount = 0;
    let afternoonCount = 0;

    visibleBaseClasses.forEach((cls) => {
      totalStudents += cls.students.length;
      if (typeof cls.presenceRate === 'number' && cls.presenceRate > 0) {
        sumPresence += cls.presenceRate;
        countedClasses++;
      }

      cls.students.forEach((s) => {
        const sit = (s.situacao || 'ATIVO').toUpperCase().trim();
        const isMoved =
          sit.includes('BXTR') || sit.includes('TRANSF') || sit.includes('REMAN') || sit.includes('RM');
        if (!isMoved) {
          activeStudents++;
          if ((s.deficiencia || '').trim().length > 0) aeeCount++;
        }
        if (s.consecutiveAbsenceAlert?.active) {
          criticalConsecutiveCount++;
        }
      });

      const isMorning =
        (cls.shift || '').toUpperCase().includes('MANHÃ') || cls.periodo === 'MANHÃ';
      if (isMorning) morningCount++;
      else afternoonCount++;
    });

    const avgPresence = countedClasses > 0 ? Math.round(sumPresence / countedClasses) : 0;

    return {
      totalClasses: visibleBaseClasses.length,
      morningCount,
      afternoonCount,
      totalStudents,
      activeStudents,
      aeeCount,
      avgPresence,
      criticalConsecutiveCount,
    };
  }, [visibleBaseClasses]);

  // Levantamento de estudantes ativos ainda sem Ficha Informativa preenchida/anexada
  const missingFichasSummary = useMemo(() => {
    const classesWithMissing: Array<{
      classGroup: ClassGroup;
      missingStudents: Student[];
    }> = [];
    let totalMissing = 0;

    visibleBaseClasses.forEach((cls) => {
      const missingStudents = cls.students.filter((s) => {
        const sit = (s.situacao || 'ATIVO').toUpperCase().trim();
        const isMoved =
          sit.includes('BXTR') || sit.includes('TRANSF') || sit.includes('REMAN') || sit.includes('RM');
        if (isMoved) return false;
        const hasFicha = Boolean(
          (s.fichaPdfDriveUrl && s.fichaPdfDriveUrl.trim().length > 0) ||
            (s.fichaPdfDriveId && s.fichaPdfDriveId.trim().length > 0)
        );
        return !hasFicha;
      });
      if (missingStudents.length > 0) {
        totalMissing += missingStudents.length;
        classesWithMissing.push({
          classGroup: cls,
          missingStudents: [...missingStudents].sort((a, b) => a.number - b.number),
        });
      }
    });

    return {
      totalMissing,
      classesWithMissing,
      firstPendingClass: classesWithMissing[0]?.classGroup || visibleBaseClasses[0],
    };
  }, [visibleBaseClasses]);

  const handleCopyFamilyFichaRequest = async () => {
    const message =
      'Prezados responsáveis, solicitamos a gentileza de preencher e encaminhar a Ficha Informativa do(a) estudante para atualização do prontuário escolar na EMEB Prof. Joaquim Candelário de Freitas. Contamos com a colaboração da família!';
    try {
      await navigator.clipboard.writeText(message);
      setCopiedFamilyFichaPrompt(true);
      toast.success('Recado copiado! Basta repassar no WhatsApp ou bilhete das famílias.');
      window.setTimeout(() => setCopiedFamilyFichaPrompt(false), 3000);
    } catch {
      toast.info(message);
    }
  };

  const filteredClasses = useMemo(() => {
    let list = visibleBaseClasses;
    if (selectedShiftFilter === 'MANHÃ') {
      list = list.filter(
        (c) => (c.shift || '').toUpperCase().includes('MANHÃ') || c.periodo === 'MANHÃ'
      );
    } else if (selectedShiftFilter === 'TARDE') {
      list = list.filter(
        (c) => (c.shift || '').toUpperCase().includes('TARDE') || c.periodo === 'TARDE'
      );
    }

    if (turmaSearchInput.trim()) {
      const q = turmaSearchInput.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.turmaAbrev && c.turmaAbrev.toLowerCase().includes(q)) ||
          (c.teacherName && c.teacherName.toLowerCase().includes(q)) ||
          (c.room && c.room.toLowerCase().includes(q))
      );
    }

    return list;
  }, [visibleBaseClasses, selectedShiftFilter, turmaSearchInput]);

  const globalSearchResults = useMemo(() => {
    const normalizeSearch = (val?: string) =>
      String(val || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    const q = normalizeSearch(globalSearchQuery);
    if (!q) {
      return {
        hasQuery: false,
        classes: [] as ClassGroup[],
        students: [] as Array<{ student: Student; classGroup: ClassGroup }>,
        totalStudentsMatched: 0,
      };
    }

    const qDigits = q.replace(/\D/g, '');
    const matchedClasses = visibleBaseClasses.filter((cls) => {
      return (
        normalizeSearch(cls.name).includes(q) ||
        normalizeSearch(cls.turmaAbrev).includes(q) ||
        normalizeSearch(cls.teacherName).includes(q) ||
        normalizeSearch(cls.room).includes(q) ||
        normalizeSearch(cls.shift).includes(q)
      );
    });

    const matchedStudents: Array<{ student: Student; classGroup: ClassGroup }> = [];
    for (const cls of visibleBaseClasses) {
      for (const st of cls.students) {
        const nameNorm = normalizeSearch(st.estudante || st.name);
        const altNameNorm = normalizeSearch(st.name);
        const raNorm = normalizeSearch(st.ra);
        const raDigits = (st.ra || '').replace(/\D/g, '');
        const numStr = String(st.number ?? '').padStart(2, '0');
        const clsNorm = normalizeSearch(cls.name);

        const matches =
          nameNorm.includes(q) ||
          altNameNorm.includes(q) ||
          raNorm.includes(q) ||
          (qDigits.length >= 2 && raDigits.includes(qDigits)) ||
          numStr === q ||
          String(st.number) === q ||
          (`${clsNorm} ${numStr}`).includes(q);

        if (matches) {
          matchedStudents.push({ student: st, classGroup: cls });
        }
      }
    }

    return {
      hasQuery: true,
      classes: matchedClasses,
      students: matchedStudents.slice(0, 12),
      totalStudentsMatched: matchedStudents.length,
    };
  }, [visibleBaseClasses, globalSearchQuery]);

  useEffect(() => {
    setClassesPage(1);
  }, [selectedShiftFilter, turmaSearchInput]);

  const totalClassesPages = Math.max(1, Math.ceil(filteredClasses.length / HOME_CLASSES_PAGE_SIZE));
  const safeClassesPage = Math.min(classesPage, totalClassesPages);
  const displayedClasses = useMemo(() => {
    const start = (safeClassesPage - 1) * HOME_CLASSES_PAGE_SIZE;
    return filteredClasses.slice(start, start + HOME_CLASSES_PAGE_SIZE);
  }, [filteredClasses, safeClassesPage]);

  const chartData = useMemo(() => {
    const filtered = visibleBaseClasses.filter((c) => {
      if (chartFilterShift === 'all') return true;
      return (c.shift || '').toUpperCase().includes(chartFilterShift);
    });

    const mapped = filtered.map((c) => {
      const presenceVal =
        c.students.length === 0
          ? 0
          : typeof c.presenceRate === 'number' && !Number.isNaN(c.presenceRate)
          ? Math.max(0, Math.min(100, Math.round(c.presenceRate)))
          : 0;
      return {
        id: c.id,
        classRef: c,
        name: c.name,
        shortName: c.name,
        presence: presenceVal,
        studentsCount: c.students.length,
        shift: c.shift || 'Integral',
        teacherName: c.teacherName || 'Regente atribuído',
      };
    });

    if (chartSortMode === 'asc') {
      return [...mapped].sort((a, b) => a.presence - b.presence);
    }
    return mapped;
  }, [visibleBaseClasses, chartFilterShift, chartSortMode]);

  const chartBandSummary = useMemo(() => {
    if (chartData.length === 0) {
      return { avg: 0, regular: 0, attention: 0, below: 0 };
    }
    let sum = 0;
    let regular = 0;
    let attention = 0;
    let below = 0;
    chartData.forEach((d) => {
      sum += d.presence;
      if (d.presence < 75) below++;
      else if (d.presence < 85) attention++;
      else regular++;
    });
    return {
      avg: Math.round(sum / chartData.length),
      regular,
      attention,
      below,
    };
  }, [chartData]);

  const todayFormatted = useMemo(() => {
    try {
      const str = new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(new Date());
      return str.charAt(0).toUpperCase() + str.slice(1);
    } catch {
      return 'Hoje';
    }
  }, []);

  const formattedGreetingName = useMemo(() => {
    if (!userName) return 'Educador(a)';
    const trimmed = userName.trim();
    if (
      trimmed.includes('EMEB Professor Joaquim Candelário') ||
      trimmed.includes('Direção / Admin') ||
      trimmed.includes('Direção') ||
      trimmed.startsWith('EMEB')
    ) {
      return 'Equipe Gestora';
    }
    const clean = trimmed.replace(/\s*\(.*?\)\s*/g, '').trim();
    return clean || 'Educador(a)';
  }, [userName]);

  const roleLabel = isStrictAdmin
    ? 'Equipe Administrativa'
    : teacherRoleType === 'aee'
    ? 'Educação Especial (AEE)'
    : teacherRoleType === 'apoio'
    ? 'Apoio Pedagógico'
    : userRole === 'peb2'
    ? 'Especialista PEB II'
    : 'Regente PEB I';

  const primaryTeacherClass = visibleBaseClasses[0];

  // Ações essenciais com ícones SF Symbols e paleta Navy Institucional
  const quickActions = useMemo<QuickActionItem[]>(() => {
    const items: QuickActionItem[] = [
      {
        id: 'turmas',
        title: userRole === 'usuario' ? 'Minha Turma e Alunos' : 'Turmas e Estudantes',
        subtitle:
          userRole === 'usuario' && primaryTeacherClass
            ? `${primaryTeacherClass.name} · ${schoolStats.activeStudents} estudantes`
            : `${schoolStats.totalClasses} turma(s) · ${schoolStats.activeStudents} ativos`,
        icon: <SFSymbol name="groups" filled size={20} weight={500} />,
        accentBg: 'bg-[#0071E3]',
        accentText: 'text-white shadow-[0_4px_12px_rgba(0,113,227,0.24)]',
        onClick: () => {
          triggerMenuHaptic('light');
          if (userRole === 'usuario') onNavigateToScreen('detalhes');
          else onNavigateToScreen('turmas');
        },
      },
    ];

    if (canLaunchAttendance) {
      items.push({
        id: 'frequencia_mensal',
        title: 'Informar Faltas do Mês',
        subtitle: `${referencePeriod.monthName}/${referencePeriod.year} · ${
          windowEval.isAllowedToLaunch ? 'Janela aberta' : 'Consultar prazo'
        }`,
        icon: <SFSymbol name="event_available" filled size={20} weight={500} />,
        accentBg: 'bg-[#1B873F]',
        accentText: 'text-white shadow-[0_4px_12px_rgba(27,135,63,0.24)]',
        onClick: () => {
          triggerMenuHaptic('light');
          onNavigateToScreen('frequencia_mensal');
        },
      });
    }

    items.push({
      id: 'faltas_consecutivas',
      title: 'Busca Ativa (ECA)',
      subtitle: `${schoolStats.criticalConsecutiveCount} caso(s) em atenção`,
      icon: <SFSymbol name="gpp_maybe" filled size={20} weight={500} />,
      accentBg: 'bg-[#D70015]',
      accentText: 'text-white shadow-[0_4px_12px_rgba(215,0,21,0.24)]',
      onClick: () => {
        triggerMenuHaptic('light');
        onNavigateToScreen('faltas_consecutivas');
      },
    });

    if (isStrictAdmin) {
      items.push(
        {
          id: 'usuarios_acesso',
          title: 'Central Administrativa',
          subtitle: `Acessos, ano letivo ${activeSchoolYear} (200 dias) e ${schoolStats.aeeCount} AEE`,
          icon: <SFSymbol name="admin_panel_settings" filled size={20} weight={500} />,
          accentBg: 'bg-[#1D1D1F]',
          accentText: 'text-white shadow-[0_4px_12px_rgba(29,29,31,0.26)]',
          onClick: () => {
            triggerMenuHaptic('light');
            onNavigateToScreen('usuarios_acesso');
          },
        },
        {
          id: 'bolsa_familia',
          title: 'Bolsa Família',
          subtitle: 'Beneficiários e apuração bimestral de faltas',
          icon: <SFSymbol name="volunteer_activism" filled size={20} weight={500} />,
          accentBg: 'bg-[#B25000]',
          accentText: 'text-white shadow-[0_4px_12px_rgba(178,80,0,0.24)]',
          onClick: () => {
            triggerMenuHaptic('light');
            onNavigateToScreen('bolsa_familia');
          },
        }
      );
    } else {
      items.push({
        id: 'avisos',
        title: 'Quadro de Avisos da Direção',
        subtitle: `${schoolNotices.filter((n) => n.active !== false).length} comunicado(s) ativo(s)`,
        icon: <SFSymbol name="campaign" filled size={20} weight={500} />,
        accentBg: 'bg-[#0071E3]',
        accentText: 'text-white shadow-[0_4px_12px_rgba(0,113,227,0.24)]',
        onClick: () => {
          triggerMenuHaptic('light');
          document.getElementById('quadro-avisos-direcao')?.scrollIntoView({ behavior: 'smooth' });
        },
      });
    }

    return items;
  }, [
    userRole,
    primaryTeacherClass,
    isStrictAdmin,
    canLaunchAttendance,
    schoolStats,
    referencePeriod,
    activeSchoolYear,
    windowEval.isAllowedToLaunch,
    schoolNotices,
    onNavigateToScreen,
  ]);

  const showRoleInSubline =
    formattedGreetingName.trim().toLowerCase() !== roleLabel.trim().toLowerCase();

  return (
    <div className="flex flex-col w-full min-w-0 max-w-[1600px] mx-auto space-y-6 pb-20 text-[#1D1D1F] animate-gentle-fade">
      {/* 1. CABEÇALHO INSTITUCIONAL APPLE HIG + INDICADORES ESSENCIAIS */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 border border-black/[0.06] shadow-sm space-y-6 min-w-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 min-w-0">
          <div className="space-y-1.5 min-w-0 flex-1">
            <p className="text-xs sm:text-[13px] font-semibold text-[#86868B] tracking-tight text-balance break-words flex items-center gap-1.5 uppercase">
              <SFSymbol name="school" filled size={15} className="text-[#0071E3] shrink-0" />
              <span>EMEB Prof. Joaquim Candelário de Freitas · Ano Letivo {activeSchoolYear}</span>
            </p>
            <h1 className="text-2xl sm:text-[32px] font-semibold tracking-tight text-[#1D1D1F] text-balance break-words leading-tight">
              Olá, {formattedGreetingName}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-[#86868B] break-words">
              {showRoleInSubline && (
                <>
                  <span className="font-semibold text-[#1D1D1F]">{roleLabel}</span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              <span className="font-normal text-[#424245]">{todayFormatted}</span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-[#1B873F]">
                {windowEval.isAllowedToLaunch ? 'Chamada aberta' : 'Consulta ativa'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto min-w-0 shrink-0">
            <SyncElapsedTimeBadge />
            <ExportFormatButton
              label="Exportar Panorama"
              variant="secondary"
              onExport={async (format) => {
                const report = buildHomeSchoolOverviewReport({
                  classes: visibleBaseClasses,
                  schoolYear: activeSchoolYear,
                  activeStudents: schoolStats.activeStudents,
                  aeeCount: schoolStats.aeeCount,
                  avgPresence: schoolStats.avgPresence,
                  criticalConsecutiveCount: schoolStats.criticalConsecutiveCount,
                  missingFichasTotal: missingFichasSummary.totalMissing,
                  userName,
                });
                const fileName = await exportUniversalReport(report, format);
                toast.success(`Arquivo ${fileName} baixado com sucesso!`);
              }}
            />

            {canLaunchAttendance ? (
              <motion.button
                type="button"
                whileTap={tapAnimation}
                onClick={() => {
                  triggerMenuHaptic('medium');
                  onNavigateToScreen('frequencia_mensal');
                }}
                className="w-full sm:w-auto min-h-[44px] py-2 px-5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-sm font-semibold inline-flex items-center justify-center text-center whitespace-nowrap gap-2 cursor-pointer transition-all duration-150 active:scale-95 shadow-xs"
              >
                <SFSymbol name="event_available" filled size={18} weight={500} className="shrink-0" />
                <span>Informar Faltas · {referencePeriod.monthName}</span>
              </motion.button>
            ) : (
              <motion.button
                type="button"
                whileTap={tapAnimation}
                onClick={() => {
                  triggerMenuHaptic('light');
                  onNavigateToScreen('turmas');
                }}
                className="w-full sm:w-auto min-h-[44px] py-2 px-5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-sm font-semibold inline-flex items-center justify-center text-center whitespace-nowrap gap-2 cursor-pointer transition-all duration-150 active:scale-95 shadow-xs"
              >
                <SFSymbol name="groups" filled size={18} weight={500} className="shrink-0" />
                <span>Ver Turmas ({schoolStats.totalClasses})</span>
              </motion.button>
            )}
          </div>
        </div>


        {/* Faixa Unificada de KPIs com Ícones SF Symbols e Hierarquia Apple HIG */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 min-w-0 items-stretch">
          <div className="p-4 sm:p-5 rounded-2xl bg-[#F5F5F7] border border-black/[0.04] min-w-0 flex flex-col justify-between h-full">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs sm:text-[13px] font-semibold text-[#86868B] leading-snug">
                Estudantes Ativos
              </span>
              <span className="w-7 h-7 rounded-full bg-white text-[#0071E3] flex items-center justify-center shrink-0 border border-black/[0.06]">
                <SFSymbol name="groups" filled size={15} weight={500} />
              </span>
            </div>
            <span className="text-2xl sm:text-[28px] font-semibold text-[#1D1D1F] tabular-nums block my-1.5 leading-tight">
              {schoolStats.activeStudents}
            </span>
            <span className="text-xs text-[#86868B] font-normal tabular-nums block">
              {schoolStats.aeeCount} em AEE
            </span>
          </div>

          {userRole === 'usuario' && primaryTeacherClass ? (
            <motion.button
              type="button"
              whileTap={tapAnimation}
              onClick={() => {
                triggerMenuHaptic('light');
                onNavigateToScreen('detalhes');
              }}
              className="text-left p-4 sm:p-5 rounded-2xl bg-[#F5F5F7] hover:bg-[#E8E8ED] border border-black/[0.04] transition-colors cursor-pointer min-w-0 flex flex-col justify-between h-full"
            >
              <div className="flex items-start justify-between gap-2 w-full">
                <span className="text-xs sm:text-[13px] font-semibold text-[#86868B] leading-snug">
                  Minha Turma
                </span>
                <span className="w-7 h-7 rounded-full bg-white text-[#0071E3] flex items-center justify-center shrink-0 border border-black/[0.06]">
                  <SFSymbol name="school" filled size={15} weight={500} />
                </span>
              </div>
              <span className="text-xl sm:text-2xl font-semibold text-[#1D1D1F] block my-1.5 leading-tight truncate">
                {primaryTeacherClass.name}
              </span>
              <span className="text-xs text-[#86868B] font-normal block truncate">
                {primaryTeacherClass.shift.replace('Turno ', '')} · {primaryTeacherClass.room || 'Sala'}
              </span>
            </motion.button>
          ) : (
            <motion.button
              type="button"
              whileTap={tapAnimation}
              onClick={() => {
                triggerMenuHaptic('light');
                onNavigateToScreen('turmas');
              }}
              className="text-left p-4 sm:p-5 rounded-2xl bg-[#F5F5F7] hover:bg-[#E8E8ED] border border-black/[0.04] transition-colors cursor-pointer min-w-0 flex flex-col justify-between h-full"
            >
              <div className="flex items-start justify-between gap-2 w-full">
                <span className="text-xs sm:text-[13px] font-semibold text-[#86868B] leading-snug">
                  Turmas
                </span>
                <span className="w-7 h-7 rounded-full bg-white text-[#0071E3] flex items-center justify-center shrink-0 border border-black/[0.06]">
                  <SFSymbol name="school" filled size={15} weight={500} />
                </span>
              </div>
              <span className="text-2xl sm:text-[28px] font-semibold text-[#1D1D1F] tabular-nums block my-1.5 leading-tight">
                {schoolStats.totalClasses}
              </span>
              <span className="text-xs text-[#86868B] font-normal tabular-nums block">
                {schoolStats.morningCount} manhã · {schoolStats.afternoonCount} tarde
              </span>
            </motion.button>
          )}

          <div className="p-4 sm:p-5 rounded-2xl bg-[#F5F5F7] border border-black/[0.04] min-w-0 flex flex-col justify-between h-full">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs sm:text-[13px] font-semibold text-[#86868B] leading-snug">
                Presença Média
              </span>
              <span className="w-7 h-7 rounded-full bg-[#EAF7EE] text-[#1B873F] flex items-center justify-center shrink-0 border border-[#1B873F]/20">
                <SFSymbol name="verified" filled size={15} weight={500} />
              </span>
            </div>
            <span className="text-2xl sm:text-[28px] font-semibold text-[#1B873F] tabular-nums block my-1.5 leading-tight">
              {schoolStats.avgPresence}%
            </span>
            <span className="text-xs text-[#86868B] font-normal block">Meta MEC ≥ 75%</span>
          </div>

          <motion.button
            type="button"
            whileTap={tapAnimation}
            onClick={() => {
              triggerMenuHaptic('light');
              onNavigateToScreen('faltas_consecutivas');
            }}
            className="text-left p-4 sm:p-5 rounded-2xl bg-[#F5F5F7] hover:bg-[#E8E8ED] border border-black/[0.04] transition-colors cursor-pointer min-w-0 flex flex-col justify-between h-full"
          >
            <div className="flex items-start justify-between gap-2 w-full">
              <span className="text-xs sm:text-[13px] font-semibold text-[#86868B] leading-snug">
                Busca Ativa (ECA)
              </span>
              <span className="w-7 h-7 rounded-full bg-[#FFEBEB] text-[#D70015] flex items-center justify-center shrink-0 border border-[#D70015]/20">
                <SFSymbol name="gpp_maybe" filled size={15} weight={500} />
              </span>
            </div>
            <span className="text-2xl sm:text-[28px] font-semibold text-[#D70015] tabular-nums block my-1.5 leading-tight">
              {schoolStats.criticalConsecutiveCount}
            </span>
            <span className="text-xs text-[#86868B] font-normal flex items-center justify-between gap-1 w-full">
              <span>Casos em atenção</span>
              <SFSymbol name="chevron_right" size={15} weight={500} className="text-[#86868B]" />
            </span>
          </motion.button>

          <div className="p-4 sm:p-5 rounded-2xl bg-[#F5F5F7] border border-black/[0.04] col-span-2 sm:col-span-1 min-w-0 flex flex-col justify-between h-full">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs sm:text-[13px] font-semibold text-[#86868B] leading-snug">
                Referência
              </span>
              <span className="w-7 h-7 rounded-full bg-white text-[#0071E3] flex items-center justify-center shrink-0 border border-black/[0.06]">
                <SFSymbol name="calendar_month" filled size={15} weight={500} />
              </span>
            </div>
            <span className="text-lg sm:text-xl font-semibold text-[#1D1D1F] block my-1.5 leading-tight whitespace-nowrap">
              {referencePeriod.monthName}/{referencePeriod.year}
            </span>
            <div className="flex items-center">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium leading-tight ${
                  windowEval.isAllowedToLaunch
                    ? 'bg-[#EAF7EE] text-[#1B873F]'
                    : 'bg-white text-[#424245] border border-black/[0.06]'
                }`}
              >
                {windowEval.isAllowedToLaunch ? 'Janela aberta' : 'Consulta disponível'}
              </span>
            </div>
          </div>
        </div>

        {/* Barra de Pesquisa Global Instantânea (Turmas e Estudantes) */}
        <div className="pt-2 border-t border-black/[0.05] space-y-3 min-w-0">
          <div className="relative w-full">
            <SFSymbol
              name="search"
              size={18}
              weight={500}
              className="text-[#86868B] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              type="search"
              value={globalSearchQuery}
              onChange={(e) => setGlobalSearchQuery(e.target.value)}
              placeholder="Pesquisar turma, docente, estudante ou RA instantaneamente..."
              aria-label="Pesquisa global de turmas e estudantes"
              className="w-full min-h-[46px] pl-11 pr-10 rounded-2xl bg-[#F5F5F7] border border-black/[0.08] focus:bg-white focus:border-[#0071E3] focus:outline-hidden text-sm sm:text-[15px] text-[#1D1D1F] placeholder:text-[#86868B] transition-colors duration-150"
            />
            {globalSearchQuery && (
              <button
                type="button"
                onClick={() => setGlobalSearchQuery('')}
                aria-label="Limpar pesquisa global"
                className="w-7 h-7 rounded-full bg-black/[0.06] hover:bg-black/[0.12] text-[#424245] flex items-center justify-center absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer transition-colors"
              >
                <span className="text-xs font-bold leading-none">✕</span>
              </button>
            )}
          </div>

          {globalSearchResults.hasQuery && (
            <div
              role="region"
              aria-label="Resultados da pesquisa global"
              className="rounded-2xl bg-[#F5F5F7] border border-black/[0.06] p-4 space-y-4 min-w-0 animate-fade-in"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#424245]">
                <span className="font-semibold">
                  Resultados para &ldquo;{globalSearchQuery.trim()}&rdquo;:{' '}
                  <strong className="text-[#1D1D1F] tabular-nums">
                    {globalSearchResults.classes.length} turma(s)
                  </strong>{' '}
                  e{' '}
                  <strong className="text-[#1D1D1F] tabular-nums">
                    {globalSearchResults.totalStudentsMatched} estudante(s)
                  </strong>
                </span>
                {globalSearchResults.totalStudentsMatched > globalSearchResults.students.length && (
                  <span className="text-[11px] font-medium text-[#86868B]">
                    Exibindo os primeiros {globalSearchResults.students.length} estudantes
                  </span>
                )}
              </div>

              {globalSearchResults.classes.length === 0 && globalSearchResults.totalStudentsMatched === 0 ? (
                <div className="p-4 rounded-xl bg-white border border-black/[0.05] text-center space-y-1">
                  <p className="text-sm font-semibold text-[#1D1D1F]">
                    Nenhuma turma ou estudante encontrado.
                  </p>
                  <p className="text-xs text-[#86868B]">
                    Tente buscar por parte do nome do estudante, número do RA, turma (ex: 1º A) ou docente.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 min-w-0">
                  {globalSearchResults.classes.length > 0 && (
                    <div className="space-y-2 min-w-0">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                        Turmas encontradas ({globalSearchResults.classes.length})
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 min-w-0">
                        {globalSearchResults.classes.slice(0, 6).map((cls) => (
                          <button
                            key={`gsearch-cls-${cls.id}`}
                            type="button"
                            onClick={() => {
                              triggerMenuHaptic('light');
                              if (onSelectClassForDetails) onSelectClassForDetails(cls);
                              else onNavigateToScreen('detalhes');
                            }}
                            className="text-left p-3.5 rounded-xl bg-white hover:bg-[#FAFAFC] border border-black/[0.06] flex items-center justify-between gap-2.5 cursor-pointer transition-colors min-w-0 group"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-[#1D1D1F] group-hover:text-[#0071E3] truncate">
                                {cls.name}
                              </p>
                              <p className="text-xs text-[#86868B] truncate">
                                {cls.teacherName || 'Regente'} · {cls.students.length} aluno(s)
                              </p>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-[#EAF7EE] text-[#1B873F] tabular-nums shrink-0">
                              {cls.students.length === 0 ? '—' : `${cls.presenceRate}%`}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {globalSearchResults.students.length > 0 && (
                    <div className="space-y-2 min-w-0">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                        Estudantes encontrados ({globalSearchResults.totalStudentsMatched})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 min-w-0">
                        {globalSearchResults.students.map(({ student: st, classGroup: cls }) => {
                          const hasPdf = Boolean(
                            (st.fichaPdfDriveUrl && st.fichaPdfDriveUrl.trim().length > 0) ||
                              (st.fichaPdfDriveId && st.fichaPdfDriveId.trim().length > 0)
                          );
                          return (
                            <div
                              key={`gsearch-stu-${cls.id}-${st.id}`}
                              className="p-3.5 rounded-xl bg-white border border-black/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-w-0"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="text-xs font-mono font-semibold text-[#0071E3] shrink-0">
                                    #{String(st.number).padStart(2, '0')}
                                  </span>
                                  <p className="text-sm font-semibold text-[#1D1D1F] truncate">
                                    {st.estudante || st.name}
                                  </p>
                                </div>
                                <p className="text-xs text-[#86868B] truncate mt-0.5">
                                  {cls.name}
                                  {st.ra ? ` · RA ${st.ra}` : ''}
                                  {st.situacao && st.situacao !== 'ATIVO' ? ` · ${st.situacao}` : ''}
                                </p>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                {onOpenStudentGrid && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      triggerMenuHaptic('light');
                                      onOpenStudentGrid(st);
                                    }}
                                    className="min-h-[34px] px-3 py-1 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold cursor-pointer transition-colors"
                                  >
                                    Grade
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    triggerMenuHaptic('light');
                                    if (onSelectClassForDetails) onSelectClassForDetails(cls);
                                    else onNavigateToScreen('detalhes');
                                  }}
                                  className="min-h-[34px] px-3 py-1 rounded-full bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] text-xs font-semibold cursor-pointer transition-colors"
                                >
                                  Turma
                                </button>
                                {hasPdf && onOpenStudentPdf && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      triggerMenuHaptic('light');
                                      onOpenStudentPdf(st, cls.name);
                                    }}
                                    className="min-h-[34px] px-3 py-1 rounded-full bg-[#EAF7EE] hover:bg-[#DCF2E3] text-[#1B873F] text-xs font-semibold cursor-pointer transition-colors"
                                  >
                                    Ficha PDF
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* AVISO INICIAL: FICHAS INFORMATIVAS NÃO PREENCHIDAS (Alerta ao Professor para Repassar à Família) */}
      {missingFichasSummary.totalMissing > 0 && (
        <section
          aria-label="Aviso de Fichas Informativas Pendentes"
          className="bg-white rounded-3xl p-5 sm:p-6 border border-black/[0.06] shadow-sm space-y-4 min-w-0"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 min-w-0">
            <div className="flex items-start gap-3.5 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-2xl bg-[#FFF5E5] text-[#B25000] border border-[#B25000]/15 flex items-center justify-center shrink-0 mt-0.5">
                <SFSymbol name="description" filled size={20} weight={500} />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base sm:text-lg font-semibold text-[#1D1D1F] tracking-tight break-words">
                    Fichas Informativas não preenchidas · Repassar pedido às famílias
                  </h2>
                </div>
                <p className="text-xs sm:text-[13.5px] text-[#424245] leading-relaxed break-words">
                  Há{' '}
                  <strong className="font-semibold text-[#B25000] tabular-nums">
                    {missingFichasSummary.totalMissing} estudante(s) ativo(s)
                  </strong>{' '}
                  em{' '}
                  <strong className="font-semibold text-[#1D1D1F] tabular-nums">
                    {missingFichasSummary.classesWithMissing.length} turma(s)
                  </strong>{' '}
                  ainda sem Ficha Informativa preenchida/anexada. Por favor, repasse o pedido de
                  preenchimento às respectivas famílias para atualizar o prontuário escolar.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <motion.button
                type="button"
                whileTap={tapAnimation}
                onClick={() => {
                  triggerMenuHaptic('light');
                  void handleCopyFamilyFichaRequest();
                }}
                className="min-h-[38px] px-4 py-1.5 rounded-full bg-[#F5F5F7] hover:bg-[#E8E8ED] border border-black/[0.06] text-[#1D1D1F] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors active:scale-95"
              >
                {copiedFamilyFichaPrompt ? (
                  <>
                    <SFSymbol name="check" size={16} weight={600} className="text-[#1B873F]" />
                    <span>Recado copiado</span>
                  </>
                ) : (
                  <>
                    <SFSymbol name="content_copy" size={16} weight={500} className="text-[#0071E3]" />
                    <span>Copiar recado para família</span>
                  </>
                )}
              </motion.button>

              {missingFichasSummary.firstPendingClass && (
                <motion.button
                  type="button"
                  whileTap={tapAnimation}
                  onClick={() => {
                    triggerMenuHaptic('light');
                    if (onOpenClassPendingFichas) {
                      onOpenClassPendingFichas(missingFichasSummary.firstPendingClass);
                    } else if (onSelectClassForDetails) {
                      onSelectClassForDetails(missingFichasSummary.firstPendingClass);
                    } else {
                      onNavigateToScreen('detalhes');
                    }
                  }}
                  className="min-h-[38px] px-4 py-1.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors active:scale-95"
                >
                  <span>Ver pendentes</span>
                  <SFSymbol name="chevron_right" size={16} weight={500} />
                </motion.button>
              )}
            </div>
          </div>

          {/* Lista compacta de estudantes/turmas com Ficha Informativa pendente */}
          {userRole === 'usuario' && missingFichasSummary.classesWithMissing[0] ? (
            <div className="p-3.5 rounded-2xl bg-[#FFF8EB] border border-[#B25000]/15 space-y-2">
              <span className="text-xs font-semibold text-[#B25000] block">
                Estudantes sem Ficha Informativa em {missingFichasSummary.classesWithMissing[0].classGroup.name}:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(showAllMissingFichasClasses
                  ? missingFichasSummary.classesWithMissing[0].missingStudents
                  : missingFichasSummary.classesWithMissing[0].missingStudents.slice(0, 8)
                ).map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() =>
                      onOpenStudentPdf
                        ? onOpenStudentPdf(st, missingFichasSummary.classesWithMissing[0].classGroup.name)
                        : onOpenClassPendingFichas?.(missingFichasSummary.classesWithMissing[0].classGroup)
                    }
                    className="px-2.5 py-1 rounded-full bg-white hover:bg-[#FFF5E5] border border-black/[0.06] text-xs font-medium text-[#1D1D1F] tabular-nums cursor-pointer transition-colors"
                  >
                    {st.number.toString().padStart(2, '0')} · {st.name}
                  </button>
                ))}
                {missingFichasSummary.classesWithMissing[0].missingStudents.length > 8 && (
                  <button
                    type="button"
                    onClick={() => setShowAllMissingFichasClasses((prev) => !prev)}
                    className="px-2.5 py-1 rounded-full text-xs font-semibold text-[#0071E3] hover:underline cursor-pointer"
                  >
                    {showAllMissingFichasClasses
                      ? 'Mostrar menos'
                      : `+${missingFichasSummary.classesWithMissing[0].missingStudents.length - 8} estudantes`}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              {(showAllMissingFichasClasses
                ? missingFichasSummary.classesWithMissing
                : missingFichasSummary.classesWithMissing.slice(0, 8)
              ).map(({ classGroup: cls, missingStudents }) => (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => {
                    triggerMenuHaptic('light');
                    if (onOpenClassPendingFichas) {
                      onOpenClassPendingFichas(cls);
                    } else if (onSelectClassForDetails) {
                      onSelectClassForDetails(cls);
                    } else {
                      onNavigateToScreen('detalhes');
                    }
                  }}
                  className="min-h-[34px] px-3.5 py-1 rounded-full bg-[#F5F5F7] hover:bg-[#E8E8ED] border border-black/[0.06] text-[#1D1D1F] text-xs font-semibold inline-flex items-center gap-1.5 tabular-nums cursor-pointer transition-colors"
                >
                  <span>{cls.name}</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#B25000] text-white">
                    {missingStudents.length}
                  </span>
                </button>
              ))}
              {missingFichasSummary.classesWithMissing.length > 8 && (
                <button
                  type="button"
                  onClick={() => setShowAllMissingFichasClasses((prev) => !prev)}
                  className="px-2.5 py-1.5 text-xs font-semibold text-[#0071E3] hover:underline cursor-pointer"
                >
                  {showAllMissingFichasClasses
                    ? 'Ocultar turmas extras'
                    : `Ver todas (${missingFichasSummary.classesWithMissing.length} turmas)`}
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {/* QUADRO DE AVISOS DA DIREÇÃO (Visível para toda a equipe escolar · Admins postam mensagens curtas) */}
      <QuadroAvisosDirecao
        notices={schoolNotices}
        canManage={isStrictAdmin}
        userEmail={userEmail}
        userName={userName}
        userRoleLabel={roleLabel}
        onSaveNotices={onSaveSchoolNotices}
        onMarkNoticesRead={onMarkNoticeRead}
      />

      {/* 2. ACESSO RÁPIDO (ÍCONES SF SYMBOLS E PALETA APPLE HIG) */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 px-1">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#1D1D1F] tracking-tight">
              Acesso Rápido
            </h2>
            <p className="text-xs sm:text-sm text-[#86868B] font-normal">
              Ferramentas principais para {isStrictAdmin ? 'gestão escolar' : 'rotina docente'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 min-w-0 items-stretch">
          {quickActions.map((item) => (
            <motion.button
              key={item.id}
              type="button"
              whileTap={tapAnimation}
              onClick={item.onClick}
              className="w-full h-full min-w-0 min-h-[84px] text-left bg-white hover:bg-[#FAFAFC] border border-black/[0.06] rounded-2xl p-4 sm:p-5 shadow-xs cursor-pointer flex items-center justify-between gap-3.5 group transition-all duration-150 active:scale-[0.98]"
            >
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <div
                  className="w-11 h-11 rounded-2xl bg-[#0071E3] text-white flex items-center justify-center shrink-0 transition-transform duration-150 group-hover:scale-105"
                >
                  {item.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] sm:text-base font-semibold text-[#1D1D1F] group-hover:text-[#0071E3] transition-colors break-words leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-[13px] text-[#86868B] break-words leading-snug mt-0.5">{item.subtitle}</p>
                </div>
              </div>

              <SFSymbol
                name="chevron_right"
                size={20}
                weight={500}
                className="text-[#86868B] group-hover:text-[#0071E3] group-hover:translate-x-0.5 transition-all duration-150 shrink-0"
              />
            </motion.button>
          ))}
        </div>
      </section>

      {/* 3. SELETOR DIRETO DE TURMAS (Apenas para quem gerencia múltiplas turmas) */}
      {userRole !== 'usuario' && (
      <section ref={classesSectionRef} className="bg-white rounded-3xl p-5 sm:p-6 border border-black/[0.06] shadow-sm space-y-5 min-w-0 scroll-mt-24">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 min-w-0">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-semibold text-[#1D1D1F] break-words">
              Turmas da Escola ({filteredClasses.length})
            </h2>
            <p className="text-xs sm:text-sm text-[#86868B] mt-0.5 break-words">
              Toque em uma turma para abrir a lista nominal, chamadas e Fichas Informativas
            </p>
          </div>

          {visibleBaseClasses.length > 1 && (
            <div className="grid grid-cols-3 sm:inline-flex w-full sm:w-auto max-w-full min-w-0 p-1 bg-[#F5F5F7] rounded-full border border-black/[0.06] gap-1">
              <button
                type="button"
                onClick={() => {
                  triggerMenuHaptic('light');
                  setSelectedShiftFilter('TODOS');
                }}
                className={`min-h-[34px] px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-[13px] font-semibold inline-flex items-center justify-center text-center whitespace-nowrap transition-all duration-150 cursor-pointer ${
                  selectedShiftFilter === 'TODOS'
                    ? 'bg-white text-[#1D1D1F] shadow-2xs font-semibold'
                    : 'text-[#424245] hover:text-[#1D1D1F]'
                }`}
              >
                Todas ({schoolStats.totalClasses})
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerMenuHaptic('light');
                  setSelectedShiftFilter('MANHÃ');
                }}
                className={`min-h-[34px] px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-[13px] font-semibold inline-flex items-center justify-center text-center whitespace-nowrap gap-1.5 transition-all duration-150 cursor-pointer ${
                  selectedShiftFilter === 'MANHÃ'
                    ? 'bg-white text-[#1D1D1F] shadow-2xs font-semibold'
                    : 'text-[#424245] hover:text-[#1D1D1F]'
                }`}
              >
                <SFSymbol
                  name="light_mode"
                  filled
                  size={15}
                  className={selectedShiftFilter === 'MANHÃ' ? 'text-[#B25000]' : 'text-[#86868B]'}
                />
                <span>Manhã ({schoolStats.morningCount})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerMenuHaptic('light');
                  setSelectedShiftFilter('TARDE');
                }}
                className={`min-h-[34px] px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-[13px] font-semibold inline-flex items-center justify-center text-center whitespace-nowrap gap-1.5 transition-all duration-150 cursor-pointer ${
                  selectedShiftFilter === 'TARDE'
                    ? 'bg-white text-[#1D1D1F] shadow-2xs font-semibold'
                    : 'text-[#424245] hover:text-[#1D1D1F]'
                }`}
              >
                <SFSymbol
                  name="nights_stay"
                  filled
                  size={15}
                  className={selectedShiftFilter === 'TARDE' ? 'text-[#0071E3]' : 'text-[#86868B]'}
                />
                <span>Tarde ({schoolStats.afternoonCount})</span>
              </button>
            </div>
          )}
        </div>

        {visibleBaseClasses.length > 3 && (
          <div className="relative">
            <SFSymbol
              name="search"
              size={18}
              weight={500}
              className="text-[#86868B] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              type="text"
              value={turmaSearchInput}
              onChange={(e) => setTurmaSearchInput(e.target.value)}
              placeholder="Buscar turma ou docente (ex: G4 A, 1º B, 5º A)..."
              className="w-full min-h-[44px] pl-11 pr-4 rounded-xl bg-[#F5F5F7] border border-black/[0.08] focus:bg-white text-sm sm:text-[15px] text-[#1D1D1F] placeholder:text-[#86868B] transition-colors duration-150"
            />
          </div>
        )}

        <div
          key={`${selectedShiftFilter}-${safeClassesPage}`}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 min-w-0"
        >
          {displayedClasses.map((cls, index) => {
            const isMorning =
              (cls.shift || '').toUpperCase().includes('MANHÃ') || cls.periodo === 'MANHÃ';
            const presenceBadgeStyle =
              cls.students.length === 0
                ? 'bg-[#F5F5F7] text-[#86868B] border border-black/[0.08]'
                : cls.presenceRate < 75
                ? 'bg-[#FFEBEB] text-[#D70015] border border-[#D70015]/20 font-semibold'
                : cls.presenceRate < 85
                ? 'bg-[#FFF5E5] text-[#B25000] border border-[#B25000]/20 font-semibold'
                : 'bg-[#EAF7EE] text-[#1B873F] border border-[#1B873F]/20 font-semibold';

            return (
              <motion.button
                key={cls.id}
                type="button"
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.05 }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0.12, ease: 'easeOut' }
                    : {
                        duration: 0.32,
                        delay: Math.min(index, 7) * 0.035,
                        ease: [0.22, 1, 0.36, 1],
                      }
                }
                whileTap={tapAnimation}
                onClick={() => {
                  triggerMenuHaptic('light');
                  if (onSelectClassForDetails) onSelectClassForDetails(cls);
                  else onNavigateToScreen('detalhes');
                }}
                className="w-full min-w-0 min-h-[122px] text-left bg-[#F5F5F7] hover:bg-[#EFEFF2] border border-black/[0.04] rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-2.5 cursor-pointer group transition-colors"
              >
                <div className="flex items-start justify-between gap-2 w-full min-w-0">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base sm:text-[17px] font-semibold text-[#1D1D1F] group-hover:text-[#0071E3] transition-colors leading-snug break-words">
                      {cls.name}
                    </h3>
                    <p className="text-xs sm:text-[13px] text-[#86868B] break-words leading-snug mt-0.5">
                      {isMorning ? 'Manhã' : 'Tarde'} · {cls.room || '—'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 pt-0.5">
                    <span
                      className={`px-2 py-0.5 rounded-full font-mono text-xs tabular-nums ${presenceBadgeStyle}`}
                    >
                      {cls.students.length === 0 ? '—' : `${cls.presenceRate}%`}
                    </span>
                    <SFSymbol
                      name="chevron_right"
                      size={18}
                      weight={500}
                      className="text-[#86868B] group-hover:text-[#0071E3] group-hover:translate-x-0.5 transition-all duration-150"
                    />
                  </div>
                </div>

                <div className="w-full space-y-0.5 pt-0.5 min-w-0">
                  <p className="text-xs sm:text-[13px] text-[#424245] font-semibold break-words leading-snug">
                    {cls.teacherName || 'Professor(a) atribuído'}
                  </p>
                  <p className="text-xs text-[#86868B] font-normal tabular-nums">
                    {cls.students.length} estudantes
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>

        {filteredClasses.length > HOME_CLASSES_PAGE_SIZE && (
          <PaginationBar
            currentPage={safeClassesPage}
            totalItems={filteredClasses.length}
            pageSize={HOME_CLASSES_PAGE_SIZE}
            onPageChange={(nextPage) => {
              setClassesPage(nextPage);
              classesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            itemLabel="turmas"
          />
        )}

        {filteredClasses.length === 0 && (
          <div className="p-8 text-center bg-[#F5F5F7] rounded-2xl border border-black/[0.05] space-y-1">
            <p className="text-sm font-semibold text-[#1D1D1F]">
              Nenhuma turma encontrada com esse termo.
            </p>
            <p className="text-xs text-[#86868B]">
              Tente buscar por &ldquo;G4&rdquo;, &ldquo;1º&rdquo;, &ldquo;Manhã&rdquo; ou limpe a busca.
            </p>
          </div>
        )}
      </section>
      )}

      {/* 4. PRAZOS E BUSCA ATIVA */}
      <section
        id="central-comunicados"
        className="bg-white rounded-3xl p-5 sm:p-6 border border-black/[0.06] shadow-sm space-y-5 min-w-0"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 min-w-0">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-semibold text-[#1D1D1F] break-words">
              Prazos e Busca Ativa
            </h2>
            <p className="text-xs sm:text-sm text-[#86868B] mt-0.5 break-words">
              Calendário de chamada mensal e casos prioritários de busca ativa
            </p>
          </div>

          <div className="grid grid-cols-2 sm:inline-flex w-full sm:w-auto max-w-full min-w-0 p-1 bg-[#F5F5F7] rounded-full border border-black/[0.06] text-xs sm:text-[13px] font-semibold gap-1">
            <button
              type="button"
              onClick={() => {
                triggerMenuHaptic('light');
                setActiveHubTab('prazos');
              }}
              className={`min-h-[36px] px-4 py-1.5 rounded-full inline-flex items-center justify-center text-center whitespace-nowrap gap-1.5 transition-all duration-150 cursor-pointer ${
                activeHubTab === 'prazos'
                  ? 'bg-white text-[#0071E3] shadow-2xs font-semibold'
                  : 'text-[#424245] hover:text-[#1D1D1F]'
              }`}
            >
              <SFSymbol name="schedule" filled={activeHubTab === 'prazos'} size={17} />
              <span>Prazos do Mês</span>
            </button>
            <button
              type="button"
              onClick={() => {
                triggerMenuHaptic('light');
                setActiveHubTab('busca_ativa');
              }}
              className={`min-h-[36px] px-4 py-1.5 rounded-full inline-flex items-center justify-center text-center whitespace-nowrap gap-1.5 transition-all duration-150 cursor-pointer ${
                activeHubTab === 'busca_ativa'
                  ? 'bg-white text-[#D70015] shadow-2xs font-semibold'
                  : 'text-[#424245] hover:text-[#D70015]'
              }`}
            >
              <SFSymbol name="gpp_maybe" filled={activeHubTab === 'busca_ativa'} size={17} />
              <span>Busca Ativa ({schoolStats.criticalConsecutiveCount})</span>
            </button>
          </div>
        </div>

        {activeHubTab === 'prazos' && (
          <LembretePrazoFrequenciaCard
            attendanceWindowConfig={attendanceWindowConfig}
            userRole={userRole}
            teacherRoleType={teacherRoleType}
            userEmail={userEmail}
            userName={userName}
            classes={classes}
            assignedClassId={assignedClassId}
            assignedClassIds={assignedClassIds}
            onOpenMonthlyAttendance={onSelectClassForMonthlyAttendance}
            onNavigateToAcessos={isStrictAdmin ? onNavigateToAcessos : undefined}
          />
        )}

        {activeHubTab === 'busca_ativa' && (
          <ResumoFaltasCriticasCard
            classes={visibleBaseClasses}
            userRole={userRole}
            teacherRoleType={teacherRoleType}
            onSelectStudentForConsecutiveScreen={(cls, student) => {
              onSelectStudentForConsecutiveScreen?.(cls.id, student.id);
            }}
            onOpenStudentGrid={
              onOpenStudentGrid ? (student) => onOpenStudentGrid(student) : undefined
            }
            onOpenStudentPdf={
              onOpenStudentPdf ? (student, className) => onOpenStudentPdf(student, className) : undefined
            }
          />
        )}
      </section>

      {/* 5. GRÁFICO COMPARATIVO POR TURMA (Exibido apenas para múltiplas turmas) */}
      {userRole !== 'usuario' && visibleBaseClasses.length > 1 && (
      <section className="bg-white rounded-3xl p-5 sm:p-7 border border-black/[0.06] shadow-sm space-y-5 min-w-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 min-w-0">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-semibold text-[#1D1D1F] tracking-tight flex items-center gap-2.5 min-w-0">
              <span className="w-9 h-9 rounded-full bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center shrink-0">
                <SFSymbol name="bar_chart" filled size={20} weight={500} />
              </span>
              <span>Frequência das Turmas — Meta LDB</span>
            </h2>
            <p className="text-xs sm:text-sm text-[#86868B] mt-1 break-words">
              Comparativo por turma com referência mínima de 75% · Toque em uma barra para abrir a turma
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                triggerMenuHaptic('light');
                setChartSortMode((prev) => (prev === 'default' ? 'asc' : 'default'));
              }}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all duration-200 cursor-pointer ${
                chartSortMode === 'asc'
                  ? 'bg-[#0071E3] text-white shadow-sm'
                  : 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-black/[0.05]'
              }`}
              title="Alternar entre ordem das turmas e menor frequência primeiro"
            >
              <SFSymbol name="swap_vert" size={15} weight={500} className="shrink-0" />
              <span>{chartSortMode === 'asc' ? 'Menor % primeiro' : 'Ordem das turmas'}</span>
            </button>

            <div className="inline-flex p-1 bg-[#F5F5F7] rounded-full text-xs font-medium gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  triggerMenuHaptic('light');
                  setChartFilterShift('all');
                }}
                className={`min-h-[32px] px-3.5 py-1 rounded-full whitespace-nowrap shrink-0 transition-all duration-200 cursor-pointer ${
                  chartFilterShift === 'all'
                    ? 'bg-white text-[#1D1D1F] font-semibold shadow-xs'
                    : 'text-[#86868B] hover:text-[#1D1D1F]'
                }`}
              >
                Todas ({schoolStats.totalClasses})
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerMenuHaptic('light');
                  setChartFilterShift('MANHÃ');
                }}
                className={`min-h-[32px] px-3.5 py-1 rounded-full whitespace-nowrap shrink-0 transition-all duration-200 cursor-pointer ${
                  chartFilterShift === 'MANHÃ'
                    ? 'bg-white text-[#1D1D1F] font-semibold shadow-xs'
                    : 'text-[#86868B] hover:text-[#1D1D1F]'
                }`}
              >
                Manhã ({schoolStats.morningCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerMenuHaptic('light');
                  setChartFilterShift('TARDE');
                }}
                className={`min-h-[32px] px-3.5 py-1 rounded-full whitespace-nowrap shrink-0 transition-all duration-200 cursor-pointer ${
                  chartFilterShift === 'TARDE'
                    ? 'bg-white text-[#1D1D1F] font-semibold shadow-xs'
                    : 'text-[#86868B] hover:text-[#1D1D1F]'
                }`}
              >
                Tarde ({schoolStats.afternoonCount})
              </button>
            </div>
          </div>
        </div>

        {/* Faixa de Indicadores Quantitativos */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-[#F5F5F7] text-xs sm:text-[13px]">
          <div className="flex items-baseline justify-between sm:justify-start sm:gap-2.5">
            <span className="text-[#86868B] font-medium">Média do recorte</span>
            <span className="font-mono font-semibold text-[#1D1D1F] text-sm sm:text-base tabular-nums">
              {chartBandSummary.avg}%
            </span>
          </div>
          <div className="flex items-baseline justify-between sm:justify-start sm:gap-2.5">
            <span className="text-[#86868B] font-medium">Regular (≥ 85%)</span>
            <span className="font-mono font-semibold text-[#1B873F] text-sm sm:text-base tabular-nums">
              {chartBandSummary.regular}
            </span>
          </div>
          <div className="flex items-baseline justify-between sm:justify-start sm:gap-2.5">
            <span className="text-[#86868B] font-medium">Atenção (75–84%)</span>
            <span className="font-mono font-semibold text-[#B25000] text-sm sm:text-base tabular-nums">
              {chartBandSummary.attention}
            </span>
          </div>
          <div className="flex items-baseline justify-between sm:justify-start sm:gap-2.5">
            <span className="text-[#86868B] font-medium">Abaixo de 75%</span>
            <span className="font-mono font-semibold text-[#D70015] text-sm sm:text-base tabular-nums">
              {chartBandSummary.below}
            </span>
          </div>
        </div>

        <div className="w-full overflow-x-auto pb-1">
          <div className="min-w-[1120px] w-full h-[290px] sm:h-[330px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 16, right: 36, left: -8, bottom: 18 }}
                barCategoryGap="18%"
              >
                <CartesianGrid
                  vertical={false}
                  stroke="#000000"
                  strokeOpacity={0.06}
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="shortName"
                  interval={0}
                  axisLine={{ stroke: '#000000', strokeOpacity: 0.1 }}
                  tickLine={false}
                  height={72}
                  tick={(props: any) => {
                    const { x, y, payload } = props;
                    const item = chartData.find((d) => d.shortName === payload?.value);
                    const isBelow = item ? item.presence < 75 : false;
                    return (
                      <g transform={`translate(${x},${y})`}>
                        <text
                          x={0}
                          y={0}
                          dy={10}
                          textAnchor="end"
                          fill={isBelow ? '#D70015' : '#86868B'}
                          fontSize={10}
                          fontWeight={isBelow ? 700 : 500}
                          transform="rotate(-38)"
                        >
                          {payload?.value}
                        </text>
                      </g>
                    );
                  }}
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                  tick={{
                    fontSize: 11,
                    fill: '#86868B',
                    fontWeight: 500,
                  }}
                  unit="%"
                />
                <Tooltip
                  cursor={{ fill: 'rgba(0, 113, 227, 0.05)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const statusText =
                        data.presence < 75
                          ? 'Abaixo da meta LDB'
                          : data.presence < 85
                          ? 'Em atenção'
                          : 'Frequência regular';
                      const statusColor =
                        data.presence < 75
                          ? 'text-[#D70015]'
                          : data.presence < 85
                          ? 'text-[#B25000]'
                          : 'text-[#1B873F]';
                      return (
                        <div className="bg-white/95 backdrop-blur-xl border border-black/[0.08] text-[#1D1D1F] px-4 py-3 rounded-2xl text-xs sm:text-[13px] shadow-[0_12px_32px_rgba(0,0,0,0.12)] space-y-1.5 min-w-[200px]">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold text-[#1D1D1F]">{data.name}</span>
                            <span className={`font-mono font-bold tabular-nums ${statusColor}`}>
                              {data.presence}%
                            </span>
                          </div>
                          <div className="text-[#86868B] text-xs">
                            {data.shift} · {data.teacherName}
                          </div>
                          <div className="pt-1.5 bg-[#F5F5F7] -mx-2 px-2.5 py-1.5 rounded-xl flex items-center justify-between gap-3 text-[11px]">
                            <span className={`font-medium ${statusColor}`}>
                              {statusText}
                            </span>
                            <span className="text-[#86868B] tabular-nums">
                              {data.studentsCount} estudantes
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine
                  y={75}
                  stroke="#D70015"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  label={{
                    value: 'Meta 75%',
                    fill: '#D70015',
                    fontSize: 11,
                    fontWeight: 600,
                    position: 'right',
                  }}
                />
                <Bar
                  dataKey="presence"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={24}
                  className="cursor-pointer"
                  onClick={(barEntry: any) => {
                    const cls = barEntry?.payload?.classRef || barEntry?.classRef;
                    if (cls) {
                      if (onSelectClassForDetails) onSelectClassForDetails(cls);
                      else onNavigateToScreen('detalhes');
                    }
                  }}
                >
                  {chartData.map((entry) => {
                    let barColor = '#1B873F';
                    if (entry.presence < 75) barColor = '#D70015';
                    else if (entry.presence < 85) barColor = '#B25000';
                    return (
                      <Cell
                        key={`cell-${entry.id}`}
                        fill={barColor}
                        className="hover:opacity-80 transition-opacity"
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between text-xs text-[#86868B] pt-1 gap-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="flex items-center gap-2 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1B873F] shrink-0" />
              ≥ 85% (Regular)
            </span>
            <span className="flex items-center gap-2 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-[#B25000] shrink-0" />
              75% a 84% (Atenção)
            </span>
            <span className="flex items-center gap-2 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D70015] shrink-0" />
              &lt; 75% (Abaixo da Meta)
            </span>
          </div>
          <span className="font-semibold text-[#1D1D1F] tabular-nums">
            {chartData.length} turma(s) exibida(s)
          </span>
        </div>
      </section>
      )}
    </div>
  );
};
