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
      const compactLabel =
        c.turmaAbrev ||
        c.name
          .replace(/GRUPO\s*0?(\d)\s*/i, 'G$1')
          .replace(/(\d+º)\s*ANO\s*/i, '$1')
          .replace(/\s+/g, '');
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
        shortName: compactLabel,
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
        accentBg: 'bg-[#0e3a8a]',
        accentText: 'text-white shadow-[0_4px_12px_rgba(14,58,138,0.24)]',
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
        accentBg: 'bg-[#047857]',
        accentText: 'text-white shadow-[0_4px_12px_rgba(4,120,87,0.24)]',
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
      accentBg: 'bg-[#be123c]',
      accentText: 'text-white shadow-[0_4px_12px_rgba(190,18,60,0.24)]',
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
          accentBg: 'bg-[#071e46]',
          accentText: 'text-white shadow-[0_4px_12px_rgba(7,30,70,0.26)]',
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
          accentBg: 'bg-[#b45309]',
          accentText: 'text-white shadow-[0_4px_12px_rgba(180,83,9,0.24)]',
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
        accentBg: 'bg-[#0e3a8a]',
        accentText: 'text-white shadow-[0_4px_12px_rgba(14,58,138,0.24)]',
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
    <div className="flex flex-col w-full min-w-0 max-w-[1600px] mx-auto space-y-5 pb-20 text-[#0f172a] animate-gentle-fade">
      {/* 1. CABEÇALHO INSTITUCIONAL NAVY + INDICADORES ESSENCIAIS */}
      <section className="bg-white rounded-3xl p-5 sm:p-7 shadow-[0_14px_38px_-12px_rgba(7,30,70,0.18)] space-y-5 min-w-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 min-w-0">
          <div className="space-y-1.5 min-w-0 flex-1">
            <p className="text-xs sm:text-[13px] font-semibold text-[#0e3a8a] text-balance break-words flex items-center gap-1.5">
              <SFSymbol name="school" filled size={15} className="text-[#0e3a8a] shrink-0" />
              <span>EMEB Prof. Joaquim Candelário de Freitas · Ano Letivo {activeSchoolYear}</span>
            </p>
            <h1 className="text-2xl sm:text-[32px] font-bold tracking-tight text-[#071e46] text-balance break-words leading-tight">
              Olá, {formattedGreetingName}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-slate-600 break-words">
              {showRoleInSubline && (
                <>
                  <span className="font-semibold text-[#0a2d6b]">{roleLabel}</span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              <span className="font-medium text-slate-700">{todayFormatted}</span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-[#047857]">
                {windowEval.isAllowedToLaunch ? 'Chamada aberta' : 'Consulta ativa'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto min-w-0 shrink-0">
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
                className="w-full sm:w-auto min-h-[48px] py-2.5 px-5 rounded-2xl bg-gradient-to-r from-[#0e3a8a] to-[#1649a8] hover:from-[#0a2d6b] hover:to-[#0e3a8a] text-white text-sm font-semibold inline-flex items-center justify-center text-center whitespace-nowrap gap-2 cursor-pointer transition-all duration-150 shadow-[0_10px_24px_-4px_rgba(14,58,138,0.34)]"
              >
                <SFSymbol name="event_available" filled size={19} weight={500} className="shrink-0" />
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
                className="w-full sm:w-auto min-h-[48px] py-2.5 px-5 rounded-2xl bg-gradient-to-r from-[#0e3a8a] to-[#1649a8] hover:from-[#0a2d6b] hover:to-[#0e3a8a] text-white text-sm font-semibold inline-flex items-center justify-center text-center whitespace-nowrap gap-2 cursor-pointer transition-all duration-150 shadow-[0_10px_24px_-4px_rgba(14,58,138,0.34)]"
              >
                <SFSymbol name="groups" filled size={19} weight={500} className="shrink-0" />
                <span>Ver Turmas ({schoolStats.totalClasses})</span>
              </motion.button>
            )}
          </div>
        </div>


        {/* Faixa Unificada de KPIs com Ícones SF Symbols e Hierarquia Tonal */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 min-w-0 items-stretch">
          <div className="p-4 sm:p-5 rounded-2xl bg-[#f1f5fb] min-w-0 flex flex-col justify-between h-full">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs sm:text-[13px] font-semibold text-slate-700 leading-snug">
                Estudantes Ativos
              </span>
              <span className="w-7 h-7 rounded-lg bg-white text-[#0e3a8a] flex items-center justify-center shrink-0 shadow-xs">
                <SFSymbol name="groups" filled size={16} weight={500} />
              </span>
            </div>
            <span className="text-2xl sm:text-[28px] font-semibold text-[#071e46] tabular-nums block my-1.5 leading-tight">
              {schoolStats.activeStudents}
            </span>
            <span className="text-xs text-slate-600 font-medium tabular-nums block">
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
              className="text-left p-4 sm:p-5 rounded-2xl bg-[#f1f5fb] hover:bg-[#e5edf9] card-interactive cursor-pointer min-w-0 flex flex-col justify-between h-full"
            >
              <div className="flex items-start justify-between gap-2 w-full">
                <span className="text-xs sm:text-[13px] font-semibold text-slate-700 leading-snug">
                  Minha Turma
                </span>
                <span className="w-7 h-7 rounded-lg bg-white text-[#1649a8] flex items-center justify-center shrink-0 shadow-xs">
                  <SFSymbol name="school" filled size={16} weight={500} />
                </span>
              </div>
              <span className="text-xl sm:text-2xl font-semibold text-[#071e46] block my-1.5 leading-tight truncate">
                {primaryTeacherClass.name}
              </span>
              <span className="text-xs text-slate-600 font-medium block truncate">
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
              className="text-left p-4 sm:p-5 rounded-2xl bg-[#f1f5fb] hover:bg-[#e5edf9] card-interactive cursor-pointer min-w-0 flex flex-col justify-between h-full"
            >
              <div className="flex items-start justify-between gap-2 w-full">
                <span className="text-xs sm:text-[13px] font-semibold text-slate-700 leading-snug">
                  Turmas
                </span>
                <span className="w-7 h-7 rounded-lg bg-white text-[#1649a8] flex items-center justify-center shrink-0 shadow-xs">
                  <SFSymbol name="school" filled size={16} weight={500} />
                </span>
              </div>
              <span className="text-2xl sm:text-[28px] font-semibold text-[#071e46] tabular-nums block my-1.5 leading-tight">
                {schoolStats.totalClasses}
              </span>
              <span className="text-xs text-slate-600 font-medium tabular-nums block">
                {schoolStats.morningCount} manhã · {schoolStats.afternoonCount} tarde
              </span>
            </motion.button>
          )}

          <div className="p-4 sm:p-5 rounded-2xl bg-[#ecfdf5] min-w-0 flex flex-col justify-between h-full">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs sm:text-[13px] font-semibold text-[#065f46] leading-snug">
                Presença Média
              </span>
              <span className="w-7 h-7 rounded-lg bg-[#047857] text-white flex items-center justify-center shrink-0 shadow-xs">
                <SFSymbol name="verified" filled size={16} weight={500} />
              </span>
            </div>
            <span className="text-2xl sm:text-[28px] font-semibold text-[#047857] tabular-nums block my-1.5 leading-tight">
              {schoolStats.avgPresence}%
            </span>
            <span className="text-xs text-[#065f46] font-medium block">Meta MEC ≥ 75%</span>
          </div>

          <motion.button
            type="button"
            whileTap={tapAnimation}
            onClick={() => {
              triggerMenuHaptic('light');
              onNavigateToScreen('faltas_consecutivas');
            }}
            className="text-left p-4 sm:p-5 rounded-2xl bg-[#fff1f2] hover:bg-[#ffe4e6] card-interactive cursor-pointer min-w-0 flex flex-col justify-between h-full"
          >
            <div className="flex items-start justify-between gap-2 w-full">
              <span className="text-xs sm:text-[13px] font-semibold text-[#9f1239] leading-snug">
                Busca Ativa (ECA)
              </span>
              <span className="w-7 h-7 rounded-lg bg-[#be123c] text-white flex items-center justify-center shrink-0 shadow-xs">
                <SFSymbol name="gpp_maybe" filled size={16} weight={500} />
              </span>
            </div>
            <span className="text-2xl sm:text-[28px] font-semibold text-[#be123c] tabular-nums block my-1.5 leading-tight">
              {schoolStats.criticalConsecutiveCount}
            </span>
            <span className="text-xs text-[#9f1239] font-medium flex items-center justify-between gap-1 w-full">
              <span>Casos em atenção</span>
              <SFSymbol name="chevron_right" size={15} weight={500} className="text-[#be123c]" />
            </span>
          </motion.button>

          <div className="p-4 sm:p-5 rounded-2xl bg-[#e8f0fe] col-span-2 sm:col-span-1 min-w-0 flex flex-col justify-between h-full">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs sm:text-[13px] font-semibold text-[#0a2d6b] leading-snug">
                Referência
              </span>
              <span className="w-7 h-7 rounded-lg bg-[#0e3a8a] text-white flex items-center justify-center shrink-0 shadow-xs">
                <SFSymbol name="calendar_month" filled size={16} weight={500} />
              </span>
            </div>
            <span className="text-lg sm:text-xl font-semibold text-[#071e46] block my-1.5 leading-tight whitespace-nowrap">
              {referencePeriod.monthName}/{referencePeriod.year}
            </span>
            <div className="flex items-center">
              <span
                data-status={windowEval.isAllowedToLaunch ? 'success' : 'info'}
                className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium text-white leading-tight"
              >
                {windowEval.isAllowedToLaunch ? 'Janela aberta' : 'Consulta disponível'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* AVISO INICIAL: FICHAS INFORMATIVAS NÃO PREENCHIDAS (Alerta ao Professor para Repassar à Família) */}
      {missingFichasSummary.totalMissing > 0 && (
        <section
          aria-label="Aviso de Fichas Informativas Pendentes"
          className="bg-white rounded-3xl p-5 sm:p-6 shadow-xs space-y-4 min-w-0"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 min-w-0">
            <div className="flex items-start gap-3.5 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-[#b45309] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                <SFSymbol name="description" filled size={20} weight={500} />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base sm:text-lg font-semibold text-[#071e46] tracking-tight break-words">
                    Fichas Informativas não preenchidas · Repassar pedido às famílias
                  </h2>
                </div>
                <p className="text-xs sm:text-[13.5px] text-slate-700 leading-relaxed break-words">
                  Há{' '}
                  <strong className="font-semibold text-[#b45309] tabular-nums">
                    {missingFichasSummary.totalMissing} estudante(s) ativo(s)
                  </strong>{' '}
                  em{' '}
                  <strong className="font-semibold text-slate-900 tabular-nums">
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
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#eef3fa] hover:bg-[#dfe9f7] text-[#0a2d6b] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
              >
                {copiedFamilyFichaPrompt ? (
                  <>
                    <SFSymbol name="check" size={16} weight={600} className="text-[#047857]" />
                    <span>Recado copiado</span>
                  </>
                ) : (
                  <>
                    <SFSymbol name="content_copy" size={16} weight={500} className="text-[#0e3a8a]" />
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
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
                >
                  <span>Ver pendentes</span>
                  <SFSymbol name="chevron_right" size={16} weight={500} />
                </motion.button>
              )}
            </div>
          </div>

          {/* Lista compacta de estudantes/turmas com Ficha Informativa pendente */}
          {userRole === 'usuario' && missingFichasSummary.classesWithMissing[0] ? (
            <div className="p-3.5 rounded-2xl bg-amber-50/70 space-y-2">
              <span className="text-xs font-semibold text-amber-950 block">
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
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100/70 text-xs font-medium text-slate-900 tabular-nums cursor-pointer transition-colors"
                  >
                    {st.number.toString().padStart(2, '0')} · {st.name}
                  </button>
                ))}
                {missingFichasSummary.classesWithMissing[0].missingStudents.length > 8 && (
                  <button
                    type="button"
                    onClick={() => setShowAllMissingFichasClasses((prev) => !prev)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold text-[#14428c] hover:underline cursor-pointer"
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
                  className="min-h-[34px] px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 text-xs font-semibold inline-flex items-center gap-1.5 tabular-nums cursor-pointer transition-colors"
                >
                  <span>{cls.name}</span>
                  <span data-status="warning" className="px-1.5 py-0.5 rounded text-[11px] font-medium text-white">
                    {missingStudents.length}
                  </span>
                </button>
              ))}
              {missingFichasSummary.classesWithMissing.length > 8 && (
                <button
                  type="button"
                  onClick={() => setShowAllMissingFichasClasses((prev) => !prev)}
                  className="px-2.5 py-1.5 text-xs font-semibold text-[#14428c] hover:underline cursor-pointer"
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

      {/* 2. ACESSO RÁPIDO (ÍCONES SF SYMBOLS E PALETA NAVY INSTITUCIONAL) */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 px-1">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
              Acesso Rápido
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-medium">
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
              className="w-full h-full min-w-0 min-h-[84px] text-left bg-white hover:bg-[#f6f9fe] card-interactive rounded-2xl p-4 sm:p-5 shadow-[0_10px_28px_-8px_rgba(7,30,70,0.22)] cursor-pointer flex items-center justify-between gap-3.5 group"
            >
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <div
                  className={`w-11 h-11 rounded-2xl ${item.accentBg} ${item.accentText} flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105`}
                >
                  {item.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] sm:text-base font-semibold text-[#071e46] break-words leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-[13px] text-slate-600 break-words leading-snug mt-0.5">{item.subtitle}</p>
                </div>
              </div>

              <SFSymbol
                name="chevron_right"
                size={20}
                weight={500}
                className="text-slate-600 group-hover:text-[#0e3a8a] group-hover:translate-x-1 transition-all duration-200 shrink-0"
              />
            </motion.button>
          ))}
        </div>
      </section>

      {/* 3. SELETOR DIRETO DE TURMAS (Apenas para quem gerencia múltiplas turmas) */}
      {userRole !== 'usuario' && (
      <section ref={classesSectionRef} className="bg-white rounded-3xl p-5 sm:p-6 shadow-[0_12px_34px_-10px_rgba(7,30,70,0.18)] space-y-5 min-w-0 scroll-mt-24">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 min-w-0">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-semibold text-[#071e46] break-words">
              Turmas da Escola ({filteredClasses.length})
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5 break-words">
              Toque em uma turma para abrir a lista nominal, chamadas e Fichas Informativas
            </p>
          </div>

          {visibleBaseClasses.length > 1 && (
            <div className="grid grid-cols-3 sm:inline-flex w-full sm:w-auto max-w-full min-w-0 p-1.5 bg-[#eef3fa] rounded-2xl gap-1">
              <button
                type="button"
                onClick={() => {
                  triggerMenuHaptic('light');
                  setSelectedShiftFilter('TODOS');
                }}
                className={`min-h-[40px] px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-[13px] font-semibold inline-flex items-center justify-center text-center whitespace-nowrap transition-all duration-200 cursor-pointer ${
                  selectedShiftFilter === 'TODOS'
                    ? 'bg-gradient-to-r from-[#0e3a8a] to-[#1649a8] text-white shadow-[0_4px_14px_rgba(14,58,138,0.28)]'
                    : 'text-[#0a2d6b] hover:bg-white/75'
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
                className={`min-h-[40px] px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-[13px] font-semibold inline-flex items-center justify-center text-center whitespace-nowrap gap-1.5 transition-all duration-200 cursor-pointer ${
                  selectedShiftFilter === 'MANHÃ'
                    ? 'bg-gradient-to-r from-[#0e3a8a] to-[#1649a8] text-white shadow-[0_4px_14px_rgba(14,58,138,0.28)]'
                    : 'text-[#0a2d6b] hover:bg-white/75'
                }`}
              >
                <SFSymbol
                  name="light_mode"
                  filled
                  size={16}
                  className={selectedShiftFilter === 'MANHÃ' ? 'text-amber-300' : 'text-[#b45309]'}
                />
                <span>Manhã ({schoolStats.morningCount})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerMenuHaptic('light');
                  setSelectedShiftFilter('TARDE');
                }}
                className={`min-h-[40px] px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-[13px] font-semibold inline-flex items-center justify-center text-center whitespace-nowrap gap-1.5 transition-all duration-200 cursor-pointer ${
                  selectedShiftFilter === 'TARDE'
                    ? 'bg-gradient-to-r from-[#0e3a8a] to-[#1649a8] text-white shadow-[0_4px_14px_rgba(14,58,138,0.28)]'
                    : 'text-[#0a2d6b] hover:bg-white/75'
                }`}
              >
                <SFSymbol
                  name="nights_stay"
                  filled
                  size={16}
                  className={selectedShiftFilter === 'TARDE' ? 'text-sky-200' : 'text-[#0e3a8a]'}
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
              className="text-[#0e3a8a] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              type="text"
              value={turmaSearchInput}
              onChange={(e) => setTurmaSearchInput(e.target.value)}
              placeholder="Buscar turma ou docente (ex: G4 A, 1º B, 5º A)..."
              className="w-full min-h-[46px] pl-11 pr-4 rounded-xl bg-[#eef3fa] focus:bg-[#e5edf9] text-sm sm:text-[15px] text-[#071e46] placeholder:text-slate-600 transition-colors duration-150"
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 min-w-0">
          {displayedClasses.map((cls) => {
            const isMorning =
              (cls.shift || '').toUpperCase().includes('MANHÃ') || cls.periodo === 'MANHÃ';
            const presenceStatus =
              cls.students.length === 0
                ? 'neutral'
                : cls.presenceRate < 75
                ? 'danger'
                : cls.presenceRate < 85
                ? 'warning'
                : 'success';

            return (
              <motion.button
                key={cls.id}
                type="button"
                whileTap={tapAnimation}
                onClick={() => {
                  triggerMenuHaptic('light');
                  if (onSelectClassForDetails) onSelectClassForDetails(cls);
                  else onNavigateToScreen('detalhes');
                }}
                className="w-full min-w-0 min-h-[122px] text-left bg-[#f1f5fb] hover:bg-[#e5edf9] card-interactive rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-2.5 cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-2 w-full min-w-0">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base sm:text-[17px] font-semibold text-[#071e46] leading-snug break-words">
                      {cls.name}
                    </h3>
                    <p className="text-xs sm:text-[13px] text-slate-600 break-words leading-snug mt-0.5">
                      {isMorning ? 'Manhã' : 'Tarde'} · {cls.room || '—'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 pt-0.5">
                    <span
                      data-status={presenceStatus}
                      className="px-2 py-0.5 rounded-lg font-mono text-xs font-medium tabular-nums text-white"
                    >
                      {cls.students.length === 0 ? '—' : `${cls.presenceRate}%`}
                    </span>
                    <SFSymbol
                      name="chevron_right"
                      size={18}
                      weight={500}
                      className="text-slate-600 group-hover:text-[#0e3a8a] group-hover:translate-x-0.5 transition-all duration-200"
                    />
                  </div>
                </div>

                <div className="w-full space-y-0.5 pt-0.5 min-w-0">
                  <p className="text-xs sm:text-[13px] text-[#0a2d6b] font-semibold break-words leading-snug">
                    {cls.teacherName || 'Professor(a) atribuído'}
                  </p>
                  <p className="text-xs text-slate-600 font-medium tabular-nums">
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
          <div className="p-8 text-center bg-[#f1f5fb] rounded-2xl space-y-1">
            <p className="text-sm font-semibold text-[#071e46]">
              Nenhuma turma encontrada com esse termo.
            </p>
            <p className="text-xs text-slate-600">
              Tente buscar por &ldquo;G4&rdquo;, &ldquo;1º&rdquo;, &ldquo;Manhã&rdquo; ou limpe a busca.
            </p>
          </div>
        )}
      </section>
      )}

      {/* 4. PRAZOS E BUSCA ATIVA */}
      <section
        id="central-comunicados"
        className="bg-white rounded-3xl p-5 sm:p-6 shadow-[0_10px_28px_-10px_rgba(7,30,70,0.16)] space-y-5 min-w-0"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 min-w-0">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-semibold text-[#071e46] break-words">
              Prazos e Busca Ativa
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5 break-words">
              Calendário de chamada mensal e casos prioritários de busca ativa
            </p>
          </div>

          <div className="grid grid-cols-2 sm:inline-flex w-full sm:w-auto max-w-full min-w-0 p-1.5 bg-[#eef3fa] rounded-2xl text-xs sm:text-[13px] font-semibold gap-1">
            <button
              type="button"
              onClick={() => {
                triggerMenuHaptic('light');
                setActiveHubTab('prazos');
              }}
              className={`min-h-[42px] px-4 py-2 rounded-xl inline-flex items-center justify-center text-center whitespace-nowrap gap-1.5 transition-all duration-150 cursor-pointer ${
                activeHubTab === 'prazos'
                  ? 'bg-gradient-to-r from-[#0e3a8a] to-[#1649a8] text-white shadow-[0_4px_12px_rgba(14,58,138,0.28)]'
                  : 'text-[#0a2d6b] hover:bg-white/70'
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
              className={`min-h-[42px] px-4 py-2 rounded-xl inline-flex items-center justify-center text-center whitespace-nowrap gap-1.5 transition-all duration-150 cursor-pointer ${
                activeHubTab === 'busca_ativa'
                  ? 'bg-[#be123c] text-white shadow-[0_4px_12px_rgba(190,18,60,0.28)]'
                  : 'text-[#9f1239] hover:bg-[#ffe4e6]'
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
      <section className="bg-white rounded-3xl p-5 sm:p-6 shadow-[0_12px_34px_-8px_rgba(2,6,23,0.34)] space-y-5 min-w-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 min-w-0">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-semibold text-[#071e46] flex items-center gap-2.5 min-w-0">
              <span className="w-9 h-9 rounded-xl bg-[#0e3a8a] text-white flex items-center justify-center shrink-0">
                <SFSymbol name="bar_chart" filled size={20} weight={500} />
              </span>
              <span>Frequência das Turmas — Meta LDB</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 break-words">
              Comparativo por turma com referência mínima de 75% · Clique em uma barra para abrir a turma
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                triggerMenuHaptic('light');
                setChartSortMode((prev) => (prev === 'default' ? 'asc' : 'default'));
              }}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all duration-200 cursor-pointer ${
                chartSortMode === 'asc'
                  ? 'bg-[#0e3a8a] text-white shadow-[0_6px_16px_rgba(14,58,138,0.24)]'
                  : 'bg-[#eef3fa] text-[#0a2d6b] hover:bg-[#e2e8f0]'
              }`}
              title="Alternar entre ordem das turmas e menor frequência primeiro"
            >
              <SFSymbol name="swap_vert" size={16} weight={500} className="shrink-0" />
              <span>{chartSortMode === 'asc' ? 'Menor % primeiro' : 'Ordem das turmas'}</span>
            </button>

            <div className="inline-flex p-1 bg-[#eef3fa] rounded-xl text-xs font-semibold gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  triggerMenuHaptic('light');
                  setChartFilterShift('all');
                }}
                className={`min-h-[34px] px-3 py-1.5 rounded-lg whitespace-nowrap shrink-0 transition-all duration-200 cursor-pointer ${
                  chartFilterShift === 'all'
                    ? 'bg-[#0e3a8a] text-white shadow-sm'
                    : 'text-[#0a2d6b] hover:bg-white/70'
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
                className={`min-h-[34px] px-3 py-1.5 rounded-lg whitespace-nowrap shrink-0 transition-all duration-200 cursor-pointer ${
                  chartFilterShift === 'MANHÃ'
                    ? 'bg-[#0e3a8a] text-white shadow-sm'
                    : 'text-[#0a2d6b] hover:bg-white/70'
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
                className={`min-h-[34px] px-3 py-1.5 rounded-lg whitespace-nowrap shrink-0 transition-all duration-200 cursor-pointer ${
                  chartFilterShift === 'TARDE'
                    ? 'bg-[#0e3a8a] text-white shadow-sm'
                    : 'text-[#0a2d6b] hover:bg-white/70'
                }`}
              >
                Tarde ({schoolStats.afternoonCount})
              </button>
            </div>
          </div>
        </div>

        {/* Faixa de Indicadores Quantitativos (Separação Tonal Sem Linhas) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-[#f1f5fb] text-xs sm:text-[13px]">
          <div className="flex items-baseline justify-between sm:justify-start sm:gap-2.5">
            <span className="text-slate-700 font-medium">Média do recorte</span>
            <span className="font-mono font-semibold text-[#071e46] text-sm sm:text-base tabular-nums">
              {chartBandSummary.avg}%
            </span>
          </div>
          <div className="flex items-baseline justify-between sm:justify-start sm:gap-2.5">
            <span className="text-slate-700 font-medium">Regular (≥ 85%)</span>
            <span className="font-mono font-semibold text-[#047857] text-sm sm:text-base tabular-nums">
              {chartBandSummary.regular}
            </span>
          </div>
          <div className="flex items-baseline justify-between sm:justify-start sm:gap-2.5">
            <span className="text-slate-700 font-medium">Atenção (75–84%)</span>
            <span className="font-mono font-semibold text-[#b45309] text-sm sm:text-base tabular-nums">
              {chartBandSummary.attention}
            </span>
          </div>
          <div className="flex items-baseline justify-between sm:justify-start sm:gap-2.5">
            <span className="text-slate-700 font-medium">Abaixo de 75%</span>
            <span className="font-mono font-semibold text-[#be123c] text-sm sm:text-base tabular-nums">
              {chartBandSummary.below}
            </span>
          </div>
        </div>

        <div className="w-full overflow-x-auto pb-1">
          <div className="min-w-[680px] sm:min-w-0 w-full h-[270px] sm:h-[310px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 16, right: 64, left: -12, bottom: 14 }}
                barCategoryGap="18%"
              >
                <CartesianGrid
                  vertical={false}
                  stroke="#e2e8f0"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="shortName"
                  interval={0}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                  height={44}
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
                          fill={isBelow ? '#b91c1c' : '#475569'}
                          fontSize={10.5}
                          fontWeight={isBelow ? 700 : 600}
                          transform="rotate(-35)"
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
                    fill: '#64748b',
                    fontWeight: 600,
                  }}
                  unit="%"
                />
                <Tooltip
                  cursor={{ fill: 'rgba(11, 59, 140, 0.06)' }}
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
                          ? 'text-rose-300'
                          : data.presence < 85
                          ? 'text-amber-300'
                          : 'text-emerald-300';
                      return (
                        <div className="bg-slate-950 text-white px-4 py-3 rounded-2xl text-xs sm:text-[13px] shadow-[0_18px_40px_rgba(2,6,23,0.45)] space-y-1.5 min-w-[200px]">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-bold text-white">{data.name}</span>
                            <span className={`font-mono font-bold tabular-nums ${statusColor}`}>
                              {data.presence}%
                            </span>
                          </div>
                          <div className="text-slate-200 text-xs">
                            {data.shift} · {data.teacherName}
                          </div>
                          <div className="pt-1.5 bg-white/10 -mx-2 px-2 py-1 rounded-xl flex items-center justify-between gap-3 text-[11px]">
                            <span className={`font-semibold ${statusColor}`}>
                              {statusText}
                            </span>
                            <span className="text-slate-200 tabular-nums">
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
                  stroke="#dc2626"
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  label={{
                    value: 'Meta 75%',
                    fill: '#dc2626',
                    fontSize: 11,
                    fontWeight: 700,
                    position: 'right',
                  }}
                />
                <Bar
                  dataKey="presence"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={26}
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
                    let barColor = '#047857';
                    if (entry.presence < 75) barColor = '#dc2626';
                    else if (entry.presence < 85) barColor = '#d97706';
                    return (
                      <Cell
                        key={`cell-${entry.id}`}
                        fill={barColor}
                        className="hover:opacity-85 transition-opacity"
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 pt-1 gap-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="flex items-center gap-2 font-medium">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#047857] shrink-0" />
              ≥ 85% (Regular)
            </span>
            <span className="flex items-center gap-2 font-medium">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#d97706] shrink-0" />
              75% a 84% (Atenção)
            </span>
            <span className="flex items-center gap-2 font-medium">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#dc2626] shrink-0" />
              &lt; 75% (Abaixo da Meta)
            </span>
          </div>
          <span className="font-semibold text-slate-900 tabular-nums">
            {chartData.length} turma(s) exibida(s)
          </span>
        </div>
      </section>
      )}
    </div>
  );
};
