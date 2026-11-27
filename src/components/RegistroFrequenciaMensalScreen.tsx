import React, { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { ClassGroup, Student, UserRole } from '../types';
import {
  MONTHLY_SCHOOL_DAYS_2027,
  OFFICIAL_OCTOBER_DAYS,
  getClassSchoolDaysForMonth,
} from '../data/mockData';
import {
  getStudentAttendanceMetrics,
  getClassAttendanceMetrics,
  getDefaultReferencePeriod,
} from '../utils/attendanceRules';
import {
  formatAtestados,
  formatDL,
  formatFaltas,
  formatFreqPercent,
  formatPresencas,
} from '../utils/attendanceAbbreviations';
import { SFSymbol } from './ui/SFSymbol';
import { triggerMenuHaptic } from '../utils/haptics';
import { SyncQueueManager, SyncQueueManagerSnapshot } from '../services/syncQueueManager';
import { StudentAvatar } from './StudentAvatar';
import { PaginationBar } from './ui/PaginationBar';
import { ExportFormatButton } from './ui/ExportFormatButton';
import { exportUniversalReport } from '../utils/universalExport';
import { buildMonthlyAttendanceReport } from '../utils/reportBuilders';

interface RegistroFrequenciaMensalScreenProps {
  classGroup: ClassGroup;
  userRole: UserRole;
  canEdit: boolean;
  instantSyncStatus?: 'idle' | 'syncing' | 'synced';
  onSaveMonthlyAttendance: (updatedClass: ClassGroup) => void;
  onOpenPhotoModal: (student: Student) => void;
  onOpenStudentGrid: (student: Student) => void;
  onOpenStudentPdf?: (student: Student) => void;
  onNavigateToSheet: () => void;
  onNavigateToConsecutiveAbsences?: () => void;
  onBack: () => void;
}

export const RegistroFrequenciaMensalScreen: React.FC<RegistroFrequenciaMensalScreenProps> = ({
  classGroup,
  userRole,
  canEdit,
  instantSyncStatus = 'synced',
  onSaveMonthlyAttendance,
  onOpenStudentGrid,
  onNavigateToConsecutiveAbsences,
  onBack,
}) => {
  const isPeb1 = userRole === 'usuario';
  const defaultRef = useMemo(() => getDefaultReferencePeriod(), []);

  const activeReferenceMonthMeta = useMemo(() => {
    const match = MONTHLY_SCHOOL_DAYS_2027.find(
      (m) => m.month.toLowerCase() === defaultRef.monthName.toLowerCase()
    );
    return match || MONTHLY_SCHOOL_DAYS_2027.find((m) => m.month === 'Outubro') || MONTHLY_SCHOOL_DAYS_2027[MONTHLY_SCHOOL_DAYS_2027.length - 1];
  }, [defaultRef.monthName]);

  const activeReferenceMonthName = activeReferenceMonthMeta.month;
  const activeReferenceMonthNumber = activeReferenceMonthMeta.monthNumber;

  const [selectedMonthName, setSelectedMonthName] = useState<string>(activeReferenceMonthName);
  const [diasLetivosMes, setDiasLetivosMes] = useState<number>(() =>
    getClassSchoolDaysForMonth(classGroup, activeReferenceMonthName)
  );
  const [students, setStudents] = useState<Student[]>(classGroup.students);
  const [searchName, setSearchName] = useState('');
  const [quickFilter, setQuickFilter] = useState<'all' | 'faltas' | 'atestados'>('all');
  const [attendanceViewMode, setAttendanceViewMode] = useState<'compact' | 'cards'>('compact');
  const [currentPage, setCurrentPage] = useState(1);
  const [showAllStudentsInCall, setShowAllStudentsInCall] = useState(false);
  const [syncSnapshot, setSyncSnapshot] = useState<SyncQueueManagerSnapshot>(() =>
    SyncQueueManager.getSnapshot()
  );
  const callListRef = useRef<HTMLDivElement | null>(null);
  const monthStripRef = useRef<HTMLDivElement | null>(null);
  const monthButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const CALL_PAGE_SIZE = 15;

  // Estado de feedback visual e tátil de salvamento
  const [saveFlashState, setSaveFlashState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastSavedStudentId, setLastSavedStudentId] = useState<string | null>(null);
  const saveFlashTimerRef = useRef<number | null>(null);
  const prevSaveFlashStateRef = useRef<'idle' | 'saving' | 'saved'>('idle');
  const lastSavedInfoRef = useRef<{
    studentName?: string;
    studentNumber?: number;
    faltas?: number;
    atestados?: number;
    frequenciaPercent?: number;
    monthName: string;
    presenceRate: number;
    totalFaltasTurma: number;
    savedAt: number;
  } | null>(null);

  // Garante que PEB I permaneça sempre bloqueado no mês de referência vigente
  useEffect(() => {
    if (isPeb1 && selectedMonthName !== activeReferenceMonthName) {
      setSelectedMonthName(activeReferenceMonthName);
      setDiasLetivosMes(getClassSchoolDaysForMonth(classGroup, activeReferenceMonthName));
    }
  }, [isPeb1, selectedMonthName, activeReferenceMonthName, classGroup]);

  useEffect(() => {
    setDiasLetivosMes(
      getClassSchoolDaysForMonth(classGroup, isPeb1 ? activeReferenceMonthName : selectedMonthName)
    );
  }, [classGroup, isPeb1, activeReferenceMonthName, selectedMonthName]);

  useEffect(() => {
    const unsubscribe = SyncQueueManager.subscribe((nextSnap) => {
      setSyncSnapshot(nextSnap);
    });
    return () => {
      unsubscribe();
      if (saveFlashTimerRef.current !== null) {
        window.clearTimeout(saveFlashTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const activeBtn = monthButtonRefs.current[selectedMonthName];
    if (activeBtn && typeof activeBtn.scrollIntoView === 'function') {
      activeBtn.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedMonthName]);

  useEffect(() => {
    if (prevSaveFlashStateRef.current !== 'saved' && saveFlashState === 'saved') {
      const info = lastSavedInfoRef.current;
      triggerMenuHaptic('light');

      if (info) {
        const shortName = info.studentName
          ? info.studentName.trim().split(/\s+/).slice(0, 2).join(' ')
          : '';
        const numberPrefix =
          typeof info.studentNumber === 'number'
            ? `Nº ${info.studentNumber.toString().padStart(2, '0')} · `
            : '';

        const title = shortName
          ? `Faltas salvas · ${numberPrefix}${shortName}`
          : `Frequência de ${info.monthName} salva`;

        const description =
          typeof info.faltas === 'number' && typeof info.atestados === 'number'
            ? `${formatFaltas(info.faltas)} · ${formatAtestados(info.atestados)} · ${formatFreqPercent(
                info.frequenciaPercent ?? info.presenceRate
              )} (${info.monthName})`
            : `Turma ${classGroup.name} · ${info.presenceRate}% de presença global (${formatFaltas(
                info.totalFaltasTurma
              )})`;

        toast.success(title, {
          id: 'registro-frequencia-save-toast',
          description,
          duration: 2400,
          className: 'sonner-sf-toast sonner-attendance-toast',
          icon: (
            <span
              key={info.savedAt}
              className="sonner-tactile-pop w-5 h-5 rounded-full bg-[#047857] text-white flex items-center justify-center shrink-0 shadow-xs"
            >
              <SFSymbol name="check" size={14} weight={600} className="text-white" />
            </span>
          ),
        });
      }
    }
    prevSaveFlashStateRef.current = saveFlashState;
  }, [saveFlashState, classGroup.name]);

  const selectedMonthMeta = useMemo(
    () => MONTHLY_SCHOOL_DAYS_2027.find((m) => m.month === selectedMonthName),
    [selectedMonthName]
  );
  const currentMonthIdx = useMemo(
    () =>
      MONTHLY_SCHOOL_DAYS_2027.findIndex(
        (m) => m.month.toLowerCase() === selectedMonthName.toLowerCase()
      ),
    [selectedMonthName]
  );
  const previousPeriodMeta =
    !isPeb1 && currentMonthIdx > 0 ? MONTHLY_SCHOOL_DAYS_2027[currentMonthIdx - 1] : null;
  const previousPeriodName = previousPeriodMeta?.month || null;
  const nextPeriodMeta =
    !isPeb1 && currentMonthIdx >= 0 && currentMonthIdx < MONTHLY_SCHOOL_DAYS_2027.length - 1
      ? MONTHLY_SCHOOL_DAYS_2027[currentMonthIdx + 1]
      : null;
  const nextPeriodName = nextPeriodMeta?.month || null;

  const isPastMonth = Boolean(
    selectedMonthMeta && selectedMonthMeta.monthNumber < activeReferenceMonthNumber
  );
  const isLockedOutsideActiveMonth =
    userRole !== 'admin' &&
    (isPastMonth || selectedMonthName.toLowerCase() !== activeReferenceMonthName.toLowerCase());
  const effectiveCanEdit = canEdit && !isLockedOutsideActiveMonth;

  const hydrateStudentsForMonth = (
    sourceStudents: Student[],
    monthName: string,
    monthDays: number
  ): Student[] => {
    return sourceStudents.map((s) => {
      const savedTarget = s.monthlyAttendanceByMonth?.[monthName];
      if (savedTarget) {
        const nextRecorte = Math.max(
          1,
          Math.min(monthDays, savedTarget.diasLetivosRecorte || monthDays)
        );
        const nextFaltas = Math.max(0, Math.min(nextRecorte, savedTarget.faltas || 0));
        const nextAtestados = Math.max(0, Math.min(nextFaltas, savedTarget.atestados || 0));
        return {
          ...s,
          diasLetivosRecorte: nextRecorte,
          totalAbsencesMonth: nextFaltas,
          justifiedAbsences: nextAtestados,
        };
      }

      if (monthName.toLowerCase() === activeReferenceMonthName.toLowerCase()) {
        return s;
      }

      const currentMetrics = getStudentAttendanceMetrics(
        s,
        getClassSchoolDaysForMonth(classGroup, activeReferenceMonthName),
        OFFICIAL_OCTOBER_DAYS
      );
      const nextRecorte = currentMetrics.isMesCheio
        ? monthDays
        : Math.min(monthDays, currentMetrics.diasLetivosMatriculados);
      return {
        ...s,
        diasLetivosRecorte: nextRecorte,
        totalAbsencesMonth: 0,
        justifiedAbsences: 0,
      };
    });
  };

  useEffect(() => {
    const targetMonth = isPeb1 ? activeReferenceMonthName : selectedMonthName;
    const targetDays = getClassSchoolDaysForMonth(classGroup, targetMonth);
    setStudents(hydrateStudentsForMonth(classGroup.students, targetMonth, targetDays));
  }, [classGroup.students, classGroup.id, selectedMonthName, isPeb1, activeReferenceMonthName]);

  const triggerRuleAlert = (msg: string) => {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([16, 40, 16]);
      }
    } catch {
      // ignore
    }
    toast.warning(msg, {
      id: 'registro-frequencia-rule-alert',
      duration: 3200,
      className: 'sonner-sf-toast',
    });
  };

  const commitInstantUpdate = (
    nextStudents: Student[],
    customMonthDays: number = diasLetivosMes,
    customMonthName: string = selectedMonthName,
    studentIdSaved?: string
  ) => {
    setStudents(nextStudents);
    if (!effectiveCanEdit) return;

    if (studentIdSaved) {
      setLastSavedStudentId(studentIdSaved);
    }
    setSaveFlashState('saving');

    const tempClass: ClassGroup = {
      ...classGroup,
      classesHeld: customMonthDays,
      classesPlanned: customMonthDays,
      students: nextStudents,
    };
    const classMetrics = getClassAttendanceMetrics(tempClass, OFFICIAL_OCTOBER_DAYS);
    const updatedStudent = studentIdSaved
      ? nextStudents.find((s) => s.id === studentIdSaved)
      : undefined;
    const updatedStudentMetrics = updatedStudent
      ? getStudentAttendanceMetrics(updatedStudent, customMonthDays, OFFICIAL_OCTOBER_DAYS)
      : undefined;

    lastSavedInfoRef.current = {
      studentName: updatedStudent?.name,
      studentNumber: updatedStudent?.number,
      faltas: updatedStudentMetrics?.faltas,
      atestados: updatedStudentMetrics?.atestados,
      frequenciaPercent: updatedStudentMetrics?.frequenciaPercent,
      monthName: customMonthName,
      presenceRate: classMetrics.presenceRate,
      totalFaltasTurma: classMetrics.totalFaltasTurma,
      savedAt: Date.now(),
    };

    const updatedClass: ClassGroup = {
      ...tempClass,
      presenceRate: classMetrics.presenceRate,
      monthlyAbsences: classMetrics.totalFaltasTurma,
      isPending: false,
      statusText: `Fechamento de ${customMonthName}: Sincronizado (${classMetrics.presenceRate}% de presença)`,
    };
    onSaveMonthlyAttendance(updatedClass);

    if (saveFlashTimerRef.current !== null) {
      window.clearTimeout(saveFlashTimerRef.current);
    }

    saveFlashTimerRef.current = window.setTimeout(() => {
      setSaveFlashState('saved');
      saveFlashTimerRef.current = window.setTimeout(() => {
        setSaveFlashState('idle');
        setLastSavedStudentId(null);
      }, 2200);
    }, 150);
  };

  const handleMonthChange = (monthName: string) => {
    if (isPeb1) {
      triggerRuleAlert(
        `Como PEB I, o lançamento de faltas é permitido somente no mês vigente (${activeReferenceMonthName}).`
      );
      return;
    }
    if (monthName === selectedMonthName) return;

    triggerMenuHaptic('light');
    const newMonthDays = getClassSchoolDaysForMonth(classGroup, monthName);
    setSelectedMonthName(monthName);
    setDiasLetivosMes(newMonthDays);
    setSaveFlashState('idle');
    setLastSavedStudentId(null);
    setStudents(hydrateStudentsForMonth(classGroup.students, monthName, newMonthDays));
  };

  const buildUpdatedMonthMap = (
    student: Student,
    nextFaltas: number,
    nextAtestados: number,
    diasLetivosMatriculados: number
  ) => {
    const nextMap = { ...(student.monthlyAttendanceByMonth || {}) };
    if (
      selectedMonthName.toLowerCase() !== activeReferenceMonthName.toLowerCase() &&
      !nextMap[activeReferenceMonthName]
    ) {
      const originStudent = classGroup.students.find((cs) => cs.id === student.id) || student;
      const originDays = getClassSchoolDaysForMonth(classGroup, activeReferenceMonthName);
      nextMap[activeReferenceMonthName] = {
        diasLetivosRecorte: originStudent.diasLetivosRecorte || originDays,
        faltas: originStudent.totalAbsencesMonth || 0,
        atestados: Math.min(
          originStudent.totalAbsencesMonth || 0,
          originStudent.justifiedAbsences || 0
        ),
        observacao: originStudent.notes,
      };
    }
    nextMap[selectedMonthName] = {
      diasLetivosRecorte: diasLetivosMatriculados,
      faltas: nextFaltas,
      atestados: nextAtestados,
      observacao: student.notes,
    };
    return nextMap;
  };

  // Contador 1: Faltas do Mês (+1 ou -1)
  const handleDeltaAbsence = (studentId: string, delta: number) => {
    if (!effectiveCanEdit) return;
    let blocked = false;
    const nextStudents: Student[] = students.map((s) => {
      if (s.id !== studentId) return s;
      const m = getStudentAttendanceMetrics(s, diasLetivosMes, OFFICIAL_OCTOBER_DAYS);

      if (delta > 0 && m.faltas >= m.diasLetivosMatriculados) {
        triggerRuleAlert(
          `Limite atingido: ${s.name} possui ${formatDL(m.diasLetivosMatriculados)} no mês.`
        );
        blocked = true;
        return s;
      }

      const nextFaltas = Math.max(0, Math.min(m.diasLetivosMatriculados, m.faltas + delta));
      const nextAtestados = Math.min(nextFaltas, m.atestados);
      const nextPresencas = Math.max(0, m.diasLetivosMatriculados - nextFaltas);
      const nextFreqPct =
        m.diasLetivosMatriculados > 0
          ? Math.round((nextPresencas / m.diasLetivosMatriculados) * 100)
          : 100;
      const isBelowLegal = nextFreqPct < m.minLegalPresencePercent;

      const nextMonthMap = buildUpdatedMonthMap(
        s,
        nextFaltas,
        nextAtestados,
        m.diasLetivosMatriculados
      );

      return {
        ...s,
        totalAbsencesMonth: nextFaltas,
        justifiedAbsences: nextAtestados,
        monthlyAttendanceByMonth: nextMonthMap,
        status: nextFaltas > 0 ? 'absent' : 'present',
        alert: isBelowLegal
          ? `Presença (${nextFreqPct}%) abaixo de ${m.minLegalPresencePercent}%`
          : undefined,
      };
    });

    if (!blocked) {
      commitInstantUpdate(nextStudents, diasLetivosMes, selectedMonthName, studentId);
    }
  };

  // Contador 2: Atestados (+1 ou -1)
  const handleDeltaAtestado = (studentId: string, delta: number) => {
    if (!effectiveCanEdit) return;
    let blocked = false;
    const nextStudents: Student[] = students.map((s) => {
      if (s.id !== studentId) return s;
      const m = getStudentAttendanceMetrics(s, diasLetivosMes, OFFICIAL_OCTOBER_DAYS);

      if (delta > 0 && m.faltas === 0) {
        triggerRuleAlert(
          `Para registrar atestado, lance primeiro a falta correspondente de ${s.name}.`
        );
        blocked = true;
        return s;
      }

      if (delta > 0 && m.atestados >= m.faltas) {
        triggerRuleAlert(
          `O número de atestados (${m.atestados}) não pode ultrapassar o total de faltas (${m.faltas}).`
        );
        blocked = true;
        return s;
      }

      const nextAtestados = Math.max(0, Math.min(m.faltas, m.atestados + delta));
      const nextMonthMap = buildUpdatedMonthMap(
        s,
        m.faltas,
        nextAtestados,
        m.diasLetivosMatriculados
      );
      return {
        ...s,
        justifiedAbsences: nextAtestados,
        monthlyAttendanceByMonth: nextMonthMap,
      };
    });

    if (!blocked) {
      commitInstantUpdate(nextStudents, diasLetivosMes, selectedMonthName, studentId);
    }
  };

  // Digitação direta do número de Faltas
  const handleDirectSetAbsence = (studentId: string, rawVal: string) => {
    if (!effectiveCanEdit) return;
    const digitsOnly = rawVal.replace(/\D/g, '');
    const parsed = digitsOnly === '' ? 0 : parseInt(digitsOnly, 10);
    const nextStudents: Student[] = students.map((s) => {
      if (s.id !== studentId) return s;
      const m = getStudentAttendanceMetrics(s, diasLetivosMes, OFFICIAL_OCTOBER_DAYS);
      const nextFaltas = Math.max(0, Math.min(m.diasLetivosMatriculados, parsed));
      const nextAtestados = Math.min(nextFaltas, m.atestados);
      const nextPresencas = Math.max(0, m.diasLetivosMatriculados - nextFaltas);
      const nextFreqPct =
        m.diasLetivosMatriculados > 0
          ? Math.round((nextPresencas / m.diasLetivosMatriculados) * 100)
          : 100;
      const isBelowLegal = nextFreqPct < m.minLegalPresencePercent;
      const nextMonthMap = buildUpdatedMonthMap(
        s,
        nextFaltas,
        nextAtestados,
        m.diasLetivosMatriculados
      );
      return {
        ...s,
        totalAbsencesMonth: nextFaltas,
        justifiedAbsences: nextAtestados,
        monthlyAttendanceByMonth: nextMonthMap,
        status: nextFaltas > 0 ? 'absent' : 'present',
        alert: isBelowLegal
          ? `Presença (${nextFreqPct}%) abaixo de ${m.minLegalPresencePercent}%`
          : undefined,
      };
    });
    commitInstantUpdate(nextStudents, diasLetivosMes, selectedMonthName, studentId);
  };

  // Digitação direta do número de Atestados
  const handleDirectSetAtestado = (studentId: string, rawVal: string) => {
    if (!effectiveCanEdit) return;
    const digitsOnly = rawVal.replace(/\D/g, '');
    const parsed = digitsOnly === '' ? 0 : parseInt(digitsOnly, 10);
    const nextStudents: Student[] = students.map((s) => {
      if (s.id !== studentId) return s;
      const m = getStudentAttendanceMetrics(s, diasLetivosMes, OFFICIAL_OCTOBER_DAYS);
      const nextAtestados = Math.max(0, Math.min(m.faltas, parsed));
      const nextMonthMap = buildUpdatedMonthMap(
        s,
        m.faltas,
        nextAtestados,
        m.diasLetivosMatriculados
      );
      return {
        ...s,
        justifiedAbsences: nextAtestados,
        monthlyAttendanceByMonth: nextMonthMap,
      };
    });
    commitInstantUpdate(nextStudents, diasLetivosMes, selectedMonthName, studentId);
  };

  const liveClassMetrics = useMemo(
    () =>
      getClassAttendanceMetrics(
        { ...classGroup, classesHeld: diasLetivosMes, students },
        OFFICIAL_OCTOBER_DAYS
      ),
    [classGroup, diasLetivosMes, students]
  );

  const detailedIndicators = useMemo(() => {
    let countWithFaltas = 0;
    let countZeroFaltas = 0;
    let countWithAtestados = 0;
    let countBelowLegal = 0;
    let ativosCount = 0;

    students.forEach((s) => {
      const sit = (s.situacao || 'ATIVO').toUpperCase().trim();
      const isMov =
        sit.includes('BXTR') ||
        sit.includes('TRANSF') ||
        sit.includes('REMAN') ||
        sit.includes('RM');
      if (!isMov) ativosCount++;

      const m = getStudentAttendanceMetrics(s, diasLetivosMes, OFFICIAL_OCTOBER_DAYS);
      if (m.faltas > 0) countWithFaltas++;
      else countZeroFaltas++;
      if (m.atestados > 0) countWithAtestados++;
      if (m.isBelowLegalThreshold) countBelowLegal++;
    });

    const pctFaltaTurma = Math.max(0, 100 - liveClassMetrics.presenceRate);
    const faltasSemAtestadoTurma = Math.max(
      0,
      liveClassMetrics.totalFaltasTurma - liveClassMetrics.totalAtestadosTurma
    );

    return {
      ativosCount,
      countWithFaltas,
      countZeroFaltas,
      countWithAtestados,
      countBelowLegal,
      pctFaltaTurma,
      faltasSemAtestadoTurma,
    };
  }, [students, diasLetivosMes, liveClassMetrics]);

  const displayedStudents = useMemo(() => {
    const q = searchName.toLowerCase().trim();
    return [...students]
      .sort((a, b) => a.number - b.number)
      .filter((s) => {
        const matchesText =
          q === '' ||
          s.name.toLowerCase().includes(q) ||
          s.number.toString() === q ||
          s.number.toString().padStart(2, '0') === q;
        if (!matchesText) return false;
        if (quickFilter === 'faltas') return (s.totalAbsencesMonth || 0) > 0;
        if (quickFilter === 'atestados') return (s.justifiedAbsences || 0) > 0;
        return true;
      });
  }, [students, searchName, quickFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchName, quickFilter, attendanceViewMode, classGroup.id]);

  const totalPages = Math.max(1, Math.ceil(displayedStudents.length / CALL_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedStudents = useMemo(() => {
    if (showAllStudentsInCall) return displayedStudents;
    const start = (safePage - 1) * CALL_PAGE_SIZE;
    return displayedStudents.slice(start, start + CALL_PAGE_SIZE);
  }, [displayedStudents, safePage, showAllStudentsInCall]);

  const handleCallPageChange = (nextPage: number) => {
    setCurrentPage(nextPage);
    if (callListRef.current) {
      callListRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const isInfantilClass =
    classGroup.name.toUpperCase().startsWith('GRUPO') ||
    classGroup.grade.toUpperCase().includes('INFANTIL');
  const minLegalPresence = isInfantilClass ? 60 : 75;

  const classMetaLine = useMemo(() => {
    const parts = [
      `Turma ${classGroup.name}`,
      classGroup.turmaAbrev || null,
      classGroup.shift ? classGroup.shift.replace('Turno ', '') : null,
      classGroup.room || null,
    ].filter(Boolean);
    return parts.join(' · ');
  }, [classGroup.name, classGroup.turmaAbrev, classGroup.shift, classGroup.room]);

  const isCloudBusy =
    syncSnapshot.isOnline &&
    (saveFlashState === 'saving' ||
      syncSnapshot.isVisibleProcessing ||
      syncSnapshot.visibleActiveTasksCount > 0 ||
      instantSyncStatus === 'syncing');

  return (
    <div className="w-full max-w-[1320px] mx-auto flex flex-col min-w-0 space-y-3 sm:space-y-4 pb-20 animate-gentle-fade">
      {/* Navegação Superior com Alto Contraste */}
      <div className="flex items-center justify-between gap-3 px-0.5 min-w-0">
        <button
          type="button"
          onClick={() => {
            triggerMenuHaptic('light');
            onBack();
          }}
          className="inline-flex items-center gap-1.5 min-h-[36px] px-3 -ml-2 rounded-full text-xs sm:text-[13px] font-semibold text-[#1D1D1F] hover:text-[#0071E3] hover:bg-black/[0.04] transition-colors cursor-pointer shrink-0"
        >
          <SFSymbol name="arrow_back" size={17} weight={550} className="text-[#0071E3]" />
          <span>Voltar para {classGroup.name}</span>
        </button>

        <span className="text-xs font-medium text-[#424245] tabular-nums shrink-0">
          {selectedMonthName}/2027 · {formatDL(diasLetivosMes)}
        </span>
      </div>

      {/* Painel Principal Compacto e Proporcional */}
      <section className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-black/[0.06] shadow-[0_2px_12px_rgba(15,23,42,0.04)] space-y-3 min-w-0">
        {/* Linha 1: Título + Contexto Unificado + Ações */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 min-w-0">
          <div className="space-y-1 min-w-0 flex-1">
            <h1 className="text-xl sm:text-[24px] font-bold text-[#1D1D1F] tracking-[-0.025em] leading-tight break-words">
              Faltas do Mês — {selectedMonthName}
            </h1>

            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-[#424245] leading-snug">
              <span className="font-semibold text-[#1D1D1F]">{classMetaLine}</span>
              <span className="text-[#94A3B8]" aria-hidden="true">·</span>
              <span>
                <span className="font-medium text-[#1D1D1F]">Regente:</span>{' '}
                {classGroup.teacherName || 'Docente Regente'}
              </span>
              <span className="text-[#94A3B8]" aria-hidden="true">·</span>
              <span className="tabular-nums">
                {detailedIndicators.ativosCount}{' '}
                {detailedIndicators.ativosCount === 1 ? 'estudante ativo' : 'estudantes ativos'}
              </span>
              <span className="text-[#94A3B8]" aria-hidden="true">·</span>
              <span className="tabular-nums font-medium text-[#1D1D1F]">
                {formatDL(diasLetivosMes)}
              </span>
            </div>
          </div>

          {/* Direita: Exportação + Status de Sincronismo */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <ExportFormatButton
              label="Baixar Mapa"
              variant="secondary"
              onExport={async (format) => {
                const report = buildMonthlyAttendanceReport({
                  classGroup,
                  students: displayedStudents,
                  monthName: selectedMonthName,
                  diasLetivosMes,
                  minLegalPresence,
                });
                const fileName = await exportUniversalReport(report, format);
                toast.success(`Mapa de frequência ${fileName} baixado!`);
              }}
            />
            {!syncSnapshot.isOnline ? (
              <div
                data-status="warning"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#b45309] text-white font-medium text-xs shadow-2xs"
                title={
                  syncSnapshot.visiblePendingTasksCount > 0
                    ? `${syncSnapshot.visiblePendingTasksCount} alteração(ões) salva(s) neste aparelho e aguardando internet para sincronizar`
                    : 'Sem conexão no momento — alterações ficam salvas neste aparelho e enviam assim que voltar'
                }
              >
                <SFSymbol name="cloud_off" size={14} weight={500} className="text-white" />
                <span>
                  Offline · Salvo local
                  {syncSnapshot.visiblePendingTasksCount > 0
                    ? ` (${syncSnapshot.visiblePendingTasksCount})`
                    : ''}
                </span>
              </div>
            ) : isCloudBusy ? (
              <div
                data-status="saving"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0071E3] text-white font-medium text-xs shadow-2xs"
                title="Sincronizando alterações com a nuvem e dispositivo..."
              >
                <SFSymbol name="sync" size={14} weight={500} className="animate-spin text-white" />
                <span>Sincronizando...</span>
              </div>
            ) : (
              <div
                data-status="success"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1B873F] text-white font-medium text-xs shadow-2xs"
                title="Salvo automaticamente neste dispositivo e sincronizado com a nuvem"
              >
                <SFSymbol
                  name={saveFlashState === 'saved' ? 'check_circle' : 'cloud_done'}
                  size={15}
                  filled
                  className="text-white"
                />
                <span>{saveFlashState === 'saved' ? 'Salvo na nuvem!' : 'Salvo automático'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Linha 2: Seletor de Competência Mensal Compacto e Distribuído */}
        {isPeb1 ? (
          <div
            className="rounded-xl bg-[#F5F5F7] border border-black/[0.05] px-3 py-2 flex items-center justify-between gap-2 min-w-0"
            title={`Como PEB I, o lançamento de faltas é restrito ao mês vigente (${activeReferenceMonthName}).`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-7 h-7 rounded-lg bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center shrink-0">
                <SFSymbol name="lock" size={15} weight={500} />
              </span>
              <span className="text-xs sm:text-sm font-semibold text-[#1D1D1F] truncate">
                Mês vigente: {selectedMonthName} 2027
              </span>
            </div>
            <span
              data-status="info"
              className="px-2.5 py-0.5 rounded-full bg-[#0071E3] text-white font-medium text-xs tabular-nums shrink-0"
            >
              {diasLetivosMes}d letivos
            </span>
          </div>
        ) : (
          <div className="rounded-xl bg-[#F5F5F7] border border-black/[0.05] p-1.5 flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              disabled={!previousPeriodName}
              onClick={() => previousPeriodName && handleMonthChange(previousPeriodName)}
              className="w-8 h-8 rounded-lg bg-white hover:bg-black/[0.04] text-[#1D1D1F] flex items-center justify-center cursor-pointer transition-colors border border-black/[0.06] disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 shrink-0"
              title={previousPeriodName ? `Mês anterior: ${previousPeriodName}` : 'Primeiro mês letivo'}
              aria-label={previousPeriodName ? `Mês anterior: ${previousPeriodName}` : 'Primeiro mês letivo'}
            >
              <SFSymbol name="chevron_left" size={18} weight={600} />
            </button>

            <div
              ref={monthStripRef}
              role="tablist"
              aria-label="Meses letivos de 2027"
              className="flex-1 flex items-center gap-1 overflow-x-auto snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-w-0"
            >
              {MONTHLY_SCHOOL_DAYS_2027.map((m) => {
                const isSelected = m.month.toLowerCase() === selectedMonthName.toLowerCase();
                const daysForClass = getClassSchoolDaysForMonth(classGroup, m.month);
                return (
                  <button
                    key={m.month}
                    ref={(el) => {
                      monthButtonRefs.current[m.month] = el;
                    }}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => handleMonthChange(m.month)}
                    title={`${m.month} 2027 · ${daysForClass} dias letivos`}
                    className={`min-h-[32px] px-2.5 lg:flex-1 justify-center rounded-lg text-xs font-medium whitespace-nowrap shrink-0 snap-center cursor-pointer transition-all active:scale-95 flex items-center gap-1 ${
                      isSelected
                        ? 'bg-[#0071E3] text-white font-semibold shadow-2xs'
                        : 'bg-white/75 text-[#424245] hover:bg-white hover:text-[#1D1D1F] border border-black/[0.04]'
                    }`}
                  >
                    <span>{m.month}</span>
                    {isSelected && (
                      <span className="text-[10px] font-medium text-white/85 tabular-nums">
                        ({daysForClass}d)
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={!nextPeriodName}
              onClick={() => nextPeriodName && handleMonthChange(nextPeriodName)}
              className="w-8 h-8 rounded-lg bg-white hover:bg-black/[0.04] text-[#1D1D1F] flex items-center justify-center cursor-pointer transition-colors border border-black/[0.06] disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 shrink-0"
              title={nextPeriodName ? `Próximo mês: ${nextPeriodName}` : 'Último mês letivo'}
              aria-label={nextPeriodName ? `Próximo mês: ${nextPeriodName}` : 'Último mês letivo'}
            >
              <SFSymbol name="chevron_right" size={18} weight={600} />
            </button>
          </div>
        )}

        {/* Linha 3: Faixa KPI Compacta (3 Colunas Equilibradas) */}
        <div className="grid grid-cols-3 gap-2 sm:gap-2.5 tabular-nums min-w-0">
          <div className="rounded-xl bg-[#F8FAFC] border border-black/[0.05] px-3 py-2 sm:px-3.5 sm:py-2.5 min-w-0">
            <span className="block text-[11px] font-medium text-[#64748B] truncate">
              Presença
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mt-0.5">
              <span className="text-base sm:text-lg font-bold text-[#047857] leading-tight">
                {liveClassMetrics.presenceRate}%
              </span>
              <span className="text-[11px] text-[#64748B] truncate">
                {liveClassMetrics.totalPresencasTurma}/{liveClassMetrics.totalDiasMatriculadosTurma} presenças
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-[#F8FAFC] border border-black/[0.05] px-3 py-2 sm:px-3.5 sm:py-2.5 min-w-0">
            <span className="block text-[11px] font-medium text-[#64748B] truncate">
              Total Faltas
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mt-0.5">
              <span
                className={`text-base sm:text-lg font-bold leading-tight ${
                  liveClassMetrics.totalFaltasTurma > 0 ? 'text-[#be123c]' : 'text-[#1D1D1F]'
                }`}
              >
                {formatFaltas(liveClassMetrics.totalFaltasTurma)}
              </span>
              <span className="text-[11px] text-[#64748B] truncate">
                {detailedIndicators.faltasSemAtestadoTurma} s/ atest. · {formatAtestados(liveClassMetrics.totalAtestadosTurma)}
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-[#F8FAFC] border border-black/[0.05] px-3 py-2 sm:px-3.5 sm:py-2.5 min-w-0">
            <span className="block text-[11px] font-medium text-[#64748B] truncate">
              Assiduidade
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mt-0.5">
              <span className="text-base sm:text-lg font-bold text-[#1D1D1F] leading-tight">
                {detailedIndicators.countZeroFaltas} sem faltas
              </span>
              <span
                className={`text-[11px] truncate ${
                  detailedIndicators.countBelowLegal > 0
                    ? 'text-[#be123c] font-semibold'
                    : 'text-[#64748B]'
                }`}
              >
                {detailedIndicators.countBelowLegal > 0
                  ? `${detailedIndicators.countBelowLegal} abaixo de ${minLegalPresence}%`
                  : `Meta ≥ ${minLegalPresence}%`}
              </span>
            </div>
          </div>
        </div>

        {/* Linha 4: Barra Única de Busca + Filtros + Visualização */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-2 pt-0.5 min-w-0">
          <div className="relative flex-1 min-w-0">
            <SFSymbol
              name="search"
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B] pointer-events-none"
            />
            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="Buscar nº ou nome..."
              aria-label="Buscar por número ou nome do estudante"
              className="w-full h-[38px] pl-9 pr-9 bg-[#F8FAFC] focus:bg-white text-[#1D1D1F] text-sm rounded-xl font-normal placeholder:text-[#86868B] border border-black/[0.08] focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/15 focus:outline-hidden transition-all"
            />
            {searchName && (
              <button
                type="button"
                onClick={() => {
                  triggerMenuHaptic('light');
                  setSearchName('');
                }}
                aria-label="Limpar busca"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-[#64748B] hover:text-[#1D1D1F] cursor-pointer"
              >
                <SFSymbol name="close" size={15} />
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0 min-w-0">
            {/* Filtro Rápido */}
            <div className="grid grid-cols-3 sm:inline-flex items-center gap-1 bg-[#F5F5F7] p-1 rounded-xl w-full sm:w-auto tabular-nums border border-black/[0.06]">
              <button
                type="button"
                onClick={() => {
                  triggerMenuHaptic('light');
                  setQuickFilter('all');
                }}
                className={`min-h-[30px] px-3 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer flex items-center justify-center ${
                  quickFilter === 'all'
                    ? 'bg-[#0071E3] text-white shadow-2xs font-semibold'
                    : 'text-[#424245] hover:text-[#1D1D1F]'
                }`}
              >
                Todos ({students.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerMenuHaptic('light');
                  setQuickFilter('faltas');
                }}
                className={`min-h-[30px] px-3 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer flex items-center justify-center ${
                  quickFilter === 'faltas'
                    ? 'bg-[#D70015] text-white shadow-2xs font-semibold'
                    : 'text-[#D70015] hover:bg-[#FFEBEB]'
                }`}
              >
                Faltas ({detailedIndicators.countWithFaltas})
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerMenuHaptic('light');
                  setQuickFilter('atestados');
                }}
                className={`min-h-[30px] px-3 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer flex items-center justify-center ${
                  quickFilter === 'atestados'
                    ? 'bg-[#0071E3] text-white shadow-2xs font-semibold'
                    : 'text-[#0071E3] hover:bg-[#0071E3]/10'
                }`}
              >
                Atestados ({detailedIndicators.countWithAtestados})
              </button>
            </div>

            {/* Alternador Lista / Cartões */}
            <div className="grid grid-cols-2 sm:inline-flex items-center gap-0.5 bg-[#F5F5F7] p-1 rounded-xl w-full sm:w-auto shrink-0 border border-black/[0.06]">
              <button
                type="button"
                onClick={() => {
                  triggerMenuHaptic('light');
                  setAttendanceViewMode('compact');
                }}
                className={`min-h-[30px] px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all whitespace-nowrap ${
                  attendanceViewMode === 'compact'
                    ? 'bg-white text-[#1D1D1F] font-semibold shadow-2xs'
                    : 'text-[#64748B] hover:text-[#1D1D1F] font-medium'
                }`}
              >
                <SFSymbol name="format_list_bulleted" size={15} />
                <span>Lista</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerMenuHaptic('light');
                  setAttendanceViewMode('cards');
                }}
                className={`min-h-[30px] px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all whitespace-nowrap ${
                  attendanceViewMode === 'cards'
                    ? 'bg-white text-[#1D1D1F] font-semibold shadow-2xs'
                    : 'text-[#64748B] hover:text-[#1D1D1F] font-medium'
                }`}
              >
                <SFSymbol name="grid_view" size={15} />
                <span>Cartões</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ESTADO VAZIO PROPORCIONAL */}
      {displayedStudents.length === 0 ? (
        <section className="bg-white rounded-2xl py-7 px-6 text-center space-y-2.5 border border-black/[0.06] shadow-[0_2px_10px_rgba(15,23,42,0.03)]">
          <div className="w-10 h-10 rounded-full bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center mx-auto">
            <SFSymbol name="groups" size={21} filled />
          </div>
          <h2 className="text-base font-semibold text-[#1D1D1F]">
            {students.length === 0
              ? 'Nenhum estudante matriculado nesta turma'
              : 'Nenhum estudante encontrado com os filtros atuais'}
          </h2>
          <p className="text-xs sm:text-sm text-[#64748B] max-w-md mx-auto leading-relaxed">
            {students.length === 0
              ? `A turma ${classGroup.name} ainda não possui registros nominais vinculados para ${selectedMonthName}.`
              : 'Limpe a busca ou retorne para todos os estudantes da chamada para informar as faltas.'}
          </p>
          {(searchName.trim() !== '' || quickFilter !== 'all') && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  triggerMenuHaptic('light');
                  setSearchName('');
                  setQuickFilter('all');
                }}
                className="min-h-[38px] px-5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold cursor-pointer shadow-xs"
              >
                Mostrar todos os estudantes ({students.length})
              </button>
            </div>
          )}
        </section>
      ) : (
        <>
          {/* VISUALIZAÇÃO 1: LISTA LIMPA E DIRETA */}
          {attendanceViewMode === 'compact' && (
            <div ref={callListRef} className="space-y-2.5 scroll-mt-24">
              {paginatedStudents.map((student) => {
                const m = getStudentAttendanceMetrics(student, diasLetivosMes, OFFICIAL_OCTOBER_DAYS);
                const pctFalta =
                  m.diasLetivosMatriculados > 0
                    ? Math.round((m.faltas / m.diasLetivosMatriculados) * 100)
                    : 0;
                const isMaxFaltasReached = m.faltas >= m.maxFaltasPermitidas;
                const isMaxAtestadosReached = m.atestados >= m.maxAtestadosPermitidos;

                const sit = (student.situacao || 'ATIVO').toUpperCase().trim();
                const isTransferred = sit.includes('BXTR') || sit.includes('TRANSF');
                const isRemanejado = sit.includes('REMAN') || sit.includes('RM');
                const isOtherNonActive =
                  !isTransferred && !isRemanejado && sit !== 'ATIVO' && sit !== '';

                const isJustSaved = lastSavedStudentId === student.id && saveFlashState === 'saved';
                const isSavingThis = lastSavedStudentId === student.id && saveFlashState === 'saving';

                return (
                  <div
                    key={student.id}
                    className={`p-3.5 sm:px-5 sm:py-3.5 rounded-2xl border border-black/[0.06] shadow-[0_2px_10px_rgba(15,23,42,0.03)] flex flex-col lg:flex-row lg:items-center justify-between gap-3 transition-colors duration-200 min-w-0 ${
                      isJustSaved
                        ? 'bg-emerald-50 border-emerald-200 text-slate-950'
                        : isSavingThis
                        ? 'bg-amber-50 border-amber-200 text-slate-950 opacity-95'
                        : isTransferred
                        ? 'bg-amber-50/80 text-slate-950'
                        : isRemanejado
                        ? 'bg-purple-50/80 text-slate-950'
                        : isOtherNonActive
                        ? 'bg-slate-100 text-slate-950'
                        : m.isBelowLegalThreshold
                        ? 'bg-rose-50/90 border-rose-200/80 text-slate-950'
                        : 'bg-white hover:bg-[#f8fafc] text-slate-950'
                    }`}
                  >
                    {/* Identificação Enxuta do Estudante + Indicativo */}
                    <div
                      onClick={() => onOpenStudentGrid(student)}
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                    >
                      <span
                        className={`w-8 h-8 rounded-lg text-white font-semibold text-xs flex items-center justify-center shrink-0 tabular-nums shadow-2xs ${
                          isJustSaved
                            ? 'bg-[#047857]'
                            : isTransferred
                            ? 'bg-[#b45309]'
                            : isRemanejado
                            ? 'bg-[#6d28d9]'
                            : isOtherNonActive
                            ? 'bg-[#334155]'
                            : 'bg-[#0071E3]'
                        }`}
                      >
                        {student.number.toString().padStart(2, '0')}
                      </span>

                      <StudentAvatar student={student} size="md" />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                          <span className="font-semibold text-[15px] sm:text-base text-[#1D1D1F] break-words leading-snug">
                            {student.name}
                          </span>
                          {isJustSaved && (
                            <span
                              data-status="success"
                              className="sonner-tactile-pop px-2 py-0.5 rounded-md bg-[#047857] text-white text-[11px] font-medium inline-flex items-center gap-1"
                            >
                              <SFSymbol name="check" size={12} weight={600} className="text-white" />
                              <span>Salvo!</span>
                            </span>
                          )}
                          {isSavingThis && (
                            <span
                              data-status="saving"
                              className="px-2 py-0.5 rounded-md bg-[#0071E3] text-white text-[11px] font-medium inline-flex items-center gap-1"
                            >
                              <SFSymbol name="sync" size={12} className="animate-spin text-white" />
                              <span>Salvando...</span>
                            </span>
                          )}
                          {isTransferred && (
                            <span
                              data-status="warning"
                              className="px-2 py-0.5 rounded-md bg-[#b45309] text-white text-[11px] font-medium uppercase"
                            >
                              Transferido
                            </span>
                          )}
                          {isRemanejado && (
                            <span
                              data-status="aee"
                              className="px-2 py-0.5 rounded-md bg-[#6d28d9] text-white text-[11px] font-medium uppercase"
                            >
                              Remanejado
                            </span>
                          )}
                        </div>

                        {/* Indicadores Claros com Tags Coloridas + Fonte Branca */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1 tabular-nums text-xs">
                          <span
                            data-status={m.isBelowLegalThreshold ? 'danger' : 'success'}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-white font-medium text-[11px] ${
                              m.isBelowLegalThreshold ? 'bg-[#be123c]' : 'bg-[#047857]'
                            }`}
                          >
                            <span>{formatFreqPercent(m.frequenciaPercent)}</span>
                            <span className="opacity-90">
                              ({m.presencas}/{m.diasLetivosMatriculados}{' '}
                              {m.diasLetivosMatriculados === 1 ? 'Dia Letivo' : 'Dias Letivos'})
                            </span>
                          </span>

                          <span
                            data-status={m.faltas > 0 ? (m.isBelowLegalThreshold ? 'danger' : 'warning') : 'neutral'}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-white font-medium text-[11px] ${
                              m.faltas > 0
                                ? m.isBelowLegalThreshold
                                  ? 'bg-[#be123c]'
                                  : 'bg-[#b45309]'
                                : 'bg-[#334155]'
                            }`}
                          >
                            <span>{formatFaltas(m.faltas)} ({pctFalta}%)</span>
                          </span>

                          {m.atestados > 0 && (
                            <span
                              data-status="info"
                              className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#0071E3] text-white font-medium text-[11px]"
                            >
                              {formatAtestados(m.atestados)}
                            </span>
                          )}

                          {m.faltas > 0 && onNavigateToConsecutiveAbsences && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerMenuHaptic('light');
                                onNavigateToConsecutiveAbsences();
                              }}
                              title="Abrir Busca Ativa para registrar contato com a família"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#0071E3] hover:bg-[#0077ED] text-white font-medium text-[11px] cursor-pointer transition-colors"
                            >
                              <SFSymbol name="gpp_maybe" size={13} weight={500} />
                              <span>Busca Ativa</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* CONTADORES INTERATIVOS TÁTEIS SIMÉTRICOS */}
                    <div className="grid grid-cols-1 min-[520px]:grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2 sm:gap-2.5 shrink-0 w-full lg:w-auto">
                      {/* Contador 1: Faltas do Mês */}
                      <div
                        className={`flex items-center justify-between sm:justify-start gap-2 sm:gap-2.5 px-3 py-2 rounded-xl border border-black/[0.05] transition-colors min-w-0 ${
                          m.faltas > 0
                            ? 'bg-rose-50 text-rose-950 border-rose-200/70'
                            : 'bg-[#F8FAFC] text-slate-900'
                        }`}
                      >
                        <div className="pr-1 min-w-0">
                          <span className="text-xs font-semibold uppercase tracking-wider text-rose-950 block leading-tight">
                            Faltas
                          </span>
                          <span className="text-[11px] font-medium text-[#64748B] tabular-nums block">
                            máx. {m.diasLetivosMatriculados}d
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleDeltaAbsence(student.id, -1)}
                            disabled={!effectiveCanEdit || m.faltas === 0}
                            aria-label={`Diminuir falta de ${student.name}`}
                            className="w-10 h-10 rounded-full bg-white hover:bg-black/[0.05] text-[#1D1D1F] border border-black/[0.08] font-semibold text-lg flex items-center justify-center shadow-2xs disabled:opacity-25 cursor-pointer active:scale-95 transition-transform"
                          >
                            —
                          </button>

                          <input
                            type="text"
                            inputMode="numeric"
                            disabled={!effectiveCanEdit}
                            value={m.faltas}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleDirectSetAbsence(student.id, e.target.value)}
                            aria-label={`Digitar faltas de ${student.name}`}
                            title="Toque para digitar o número de faltas diretamente"
                            className={`w-11 h-10 rounded-xl text-center font-semibold text-base sm:text-lg tabular-nums bg-white border border-black/[0.08] shadow-2xs transition-all ${
                              m.faltas > 0 ? 'text-[#D70015]' : 'text-[#1D1D1F]'
                            }`}
                          />

                          <button
                            type="button"
                            onClick={() => handleDeltaAbsence(student.id, 1)}
                            disabled={!effectiveCanEdit || isMaxFaltasReached}
                            aria-label={`Adicionar falta para ${student.name}`}
                            className="w-10 h-10 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold text-lg flex items-center justify-center shadow-2xs disabled:opacity-25 cursor-pointer active:scale-95 transition-transform"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Contador 2: Atestados */}
                      <div
                        className={`flex items-center justify-between sm:justify-start gap-2 sm:gap-2.5 px-3 py-2 rounded-xl border border-black/[0.05] transition-colors min-w-0 ${
                          m.atestados > 0
                            ? 'bg-[#0071E3]/10 text-[#0071E3] border-[#0071E3]/20'
                            : 'bg-[#F8FAFC] text-[#1D1D1F]'
                        }`}
                      >
                        <div className="pr-1 min-w-0">
                          <span className="text-xs font-semibold uppercase tracking-wider text-[#0071E3] block leading-tight">
                            Atestado
                          </span>
                          <span className="text-[11px] font-medium text-[#64748B] tabular-nums block">
                            {m.faltas === 0 ? '0 faltas' : `de ${m.faltas}`}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleDeltaAtestado(student.id, -1)}
                            disabled={!effectiveCanEdit || m.atestados === 0}
                            aria-label={`Diminuir atestado de ${student.name}`}
                            className="w-10 h-10 rounded-full bg-white hover:bg-black/[0.05] text-[#1D1D1F] border border-black/[0.08] font-semibold text-lg flex items-center justify-center shadow-2xs disabled:opacity-25 cursor-pointer active:scale-95 transition-transform"
                          >
                            —
                          </button>

                          <input
                            type="text"
                            inputMode="numeric"
                            disabled={!effectiveCanEdit || m.faltas === 0}
                            value={m.atestados}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleDirectSetAtestado(student.id, e.target.value)}
                            aria-label={`Digitar atestados de ${student.name}`}
                            title="Toque para digitar o número de atestados diretamente"
                            className={`w-11 h-10 rounded-xl text-center font-semibold text-base sm:text-lg tabular-nums bg-white border border-black/[0.08] shadow-2xs transition-all ${
                              m.atestados > 0 ? 'text-[#0071E3]' : 'text-[#1D1D1F]'
                            }`}
                          />

                          <button
                            type="button"
                            onClick={() => handleDeltaAtestado(student.id, 1)}
                            disabled={!effectiveCanEdit || m.faltas === 0 || isMaxAtestadosReached}
                            aria-label={`Adicionar atestado para ${student.name}`}
                            className="w-10 h-10 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold text-lg flex items-center justify-center shadow-2xs disabled:opacity-25 cursor-pointer active:scale-95 transition-transform"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* VISUALIZAÇÃO 2: CARDS ENXUTOS */}
          {attendanceViewMode === 'cards' && (
            <div ref={callListRef} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 scroll-mt-24">
              {paginatedStudents.map((student) => {
                const m = getStudentAttendanceMetrics(student, diasLetivosMes, OFFICIAL_OCTOBER_DAYS);
                const pctFalta =
                  m.diasLetivosMatriculados > 0
                    ? Math.round((m.faltas / m.diasLetivosMatriculados) * 100)
                    : 0;
                const isMaxFaltasReached = m.faltas >= m.maxFaltasPermitidas;
                const isMaxAtestadosReached = m.atestados >= m.maxAtestadosPermitidos;

                const sit = (student.situacao || 'ATIVO').toUpperCase().trim();
                const isTransferred = sit.includes('BXTR') || sit.includes('TRANSF');
                const isRemanejado = sit.includes('REMAN') || sit.includes('RM');
                const isOtherNonActive =
                  !isTransferred && !isRemanejado && sit !== 'ATIVO' && sit !== '';

                const isJustSaved = lastSavedStudentId === student.id && saveFlashState === 'saved';
                const isSavingThis = lastSavedStudentId === student.id && saveFlashState === 'saving';

                return (
                  <div
                    key={student.id}
                    className={`rounded-2xl p-4 sm:p-5 shadow-[0_6px_22px_-8px_rgba(9,15,29,0.08)] space-y-3.5 transition-colors duration-200 min-w-0 ${
                      isJustSaved
                        ? 'bg-emerald-50 shadow-[0_12px_28px_-6px_rgba(4,120,87,0.24)] text-slate-950'
                        : isSavingThis
                        ? 'bg-amber-50 shadow-[0_10px_24px_-6px_rgba(180,83,9,0.18)] text-slate-950 opacity-95'
                        : isTransferred
                        ? 'bg-amber-50/80 text-slate-950'
                        : isRemanejado
                        ? 'bg-purple-50/80 text-slate-950'
                        : isOtherNonActive
                        ? 'bg-slate-200 text-slate-950'
                        : m.isBelowLegalThreshold
                        ? 'bg-rose-50/90 text-slate-950'
                        : 'bg-white hover:bg-[#f8fafc] text-slate-950'
                    }`}
                  >
                    <div
                      onClick={() => onOpenStudentGrid(student)}
                      className="flex items-start justify-between gap-3 cursor-pointer min-w-0"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <StudentAvatar student={student} size="lg" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-md text-white text-xs font-medium tabular-nums ${
                                isJustSaved ? 'bg-[#047857]' : 'bg-[#0071E3]'
                              }`}
                            >
                              Nº {student.number.toString().padStart(2, '0')}
                            </span>
                            {isJustSaved && (
                              <span
                                data-status="success"
                                className="sonner-tactile-pop px-2 py-0.5 rounded-md bg-[#047857] text-white text-xs font-medium inline-flex items-center gap-1"
                              >
                                <SFSymbol name="check" size={12} weight={600} className="text-white" />
                                <span>Salvo!</span>
                              </span>
                            )}
                            {isSavingThis && (
                              <span
                                data-status="saving"
                                className="px-2 py-0.5 rounded-md bg-[#0071E3] text-white text-xs font-medium inline-flex items-center gap-1"
                              >
                                <SFSymbol name="sync" size={12} className="animate-spin text-white" />
                                <span>Salvando...</span>
                              </span>
                            )}
                            {isTransferred && (
                              <span
                                data-status="warning"
                                className="px-2 py-0.5 rounded-md bg-[#b45309] text-white text-xs font-medium uppercase"
                              >
                                Transferido
                              </span>
                            )}
                            {isRemanejado && (
                              <span
                                data-status="aee"
                                className="px-2 py-0.5 rounded-md bg-[#6d28d9] text-white text-xs font-medium uppercase"
                              >
                                Remanejado
                              </span>
                            )}
                          </div>
                          <h3 className="text-base sm:text-[17px] font-semibold text-slate-950 leading-snug break-words mt-1">
                            {student.name}
                          </h3>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          data-status={m.isBelowLegalThreshold ? 'danger' : 'success'}
                          className={`px-2.5 py-1 rounded-xl text-white font-semibold text-sm tabular-nums inline-block ${
                            m.isBelowLegalThreshold ? 'bg-[#be123c]' : 'bg-[#047857]'
                          }`}
                        >
                          {m.frequenciaPercent}%
                        </span>
                        <span className="block text-[11px] font-medium text-slate-700 mt-1 tabular-nums">
                          {formatPresencas(m.presencas)} · {formatFaltas(m.faltas)} ({pctFalta}%)
                        </span>
                      </div>
                    </div>

                    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-100 ${
                          m.isBelowLegalThreshold ? 'bg-[#be123c]' : 'bg-[#047857]'
                        }`}
                        style={{ width: `${Math.min(100, m.frequenciaPercent)}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-1 min-[460px]:grid-cols-2 gap-2.5 pt-1">
                      <div
                        className={`p-3 rounded-2xl flex flex-col justify-between transition-colors min-w-0 ${
                          m.faltas > 0
                            ? 'bg-rose-100/90 text-rose-950'
                            : 'bg-[#f3f6fb] text-slate-900'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2 gap-1">
                          <span className="text-xs font-semibold uppercase text-rose-950">
                            Faltas
                          </span>
                          <span className="text-[11px] font-medium text-slate-700 tabular-nums">
                            máximo {m.diasLetivosMatriculados}{' '}
                            {m.diasLetivosMatriculados === 1 ? 'dia' : 'dias'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                          <button
                            type="button"
                            onClick={() => handleDeltaAbsence(student.id, -1)}
                            disabled={!effectiveCanEdit || m.faltas === 0}
                            aria-label={`Diminuir falta de ${student.name}`}
                            className="w-11 h-11 rounded-xl bg-white text-slate-950 font-semibold text-xl flex items-center justify-center shadow-xs disabled:opacity-25 cursor-pointer active:scale-95 transition-transform"
                          >
                            —
                          </button>

                          <input
                            type="text"
                            inputMode="numeric"
                            disabled={!effectiveCanEdit}
                            value={m.faltas}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleDirectSetAbsence(student.id, e.target.value)}
                            aria-label={`Digitar faltas de ${student.name}`}
                            className={`w-12 sm:w-14 h-10 rounded-xl text-center text-lg sm:text-xl font-semibold tabular-nums bg-white border border-black/[0.08] shadow-2xs ${
                              m.faltas > 0 ? 'text-[#D70015]' : 'text-[#1D1D1F]'
                            }`}
                          />

                          <button
                            type="button"
                            onClick={() => handleDeltaAbsence(student.id, 1)}
                            disabled={!effectiveCanEdit || isMaxFaltasReached}
                            aria-label={`Adicionar falta para ${student.name}`}
                            className="w-10 h-10 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold text-xl flex items-center justify-center shadow-xs disabled:opacity-25 cursor-pointer active:scale-95 transition-transform"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div
                        className={`p-3 rounded-2xl flex flex-col justify-between transition-colors min-w-0 ${
                          m.atestados > 0
                            ? 'bg-[#0071E3]/10 text-[#0071E3]'
                            : 'bg-[#F5F5F7] text-[#1D1D1F]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2 gap-1">
                          <span className="text-xs font-semibold uppercase text-[#0071E3]">
                            Atestados
                          </span>
                          <span className="text-[11px] font-medium text-[#86868B] tabular-nums">
                            {m.faltas === 0 ? '0 faltas' : `máximo ${m.faltas}`}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                          <button
                            type="button"
                            onClick={() => handleDeltaAtestado(student.id, -1)}
                            disabled={!effectiveCanEdit || m.atestados === 0}
                            aria-label={`Diminuir atestado de ${student.name}`}
                            className="w-10 h-10 rounded-full bg-white hover:bg-black/[0.05] text-[#1D1D1F] border border-black/[0.06] font-semibold text-xl flex items-center justify-center shadow-xs disabled:opacity-25 cursor-pointer active:scale-95 transition-transform"
                          >
                            —
                          </button>

                          <input
                            type="text"
                            inputMode="numeric"
                            disabled={!effectiveCanEdit || m.faltas === 0}
                            value={m.atestados}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleDirectSetAtestado(student.id, e.target.value)}
                            aria-label={`Digitar atestados de ${student.name}`}
                            className={`w-12 sm:w-14 h-10 rounded-xl text-center text-lg sm:text-xl font-semibold tabular-nums bg-white border border-black/[0.08] shadow-2xs ${
                              m.atestados > 0 ? 'text-[#0071E3]' : 'text-[#1D1D1F]'
                            }`}
                          />

                          <button
                            type="button"
                            onClick={() => handleDeltaAtestado(student.id, 1)}
                            disabled={!effectiveCanEdit || m.faltas === 0 || isMaxAtestadosReached}
                            aria-label={`Adicionar atestado para ${student.name}`}
                            className="w-10 h-10 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold text-xl flex items-center justify-center shadow-xs disabled:opacity-25 cursor-pointer active:scale-95 transition-transform"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {displayedStudents.length > CALL_PAGE_SIZE && (
            <PaginationBar
              currentPage={showAllStudentsInCall ? 1 : safePage}
              totalItems={displayedStudents.length}
              pageSize={showAllStudentsInCall ? displayedStudents.length : CALL_PAGE_SIZE}
              onPageChange={handleCallPageChange}
              itemLabel="estudantes"
              extraAction={
                <button
                  type="button"
                  onClick={() => {
                    triggerMenuHaptic('light');
                    setShowAllStudentsInCall((prev) => !prev);
                  }}
                  className="px-3 py-1 rounded-full bg-[#F5F5F7] hover:bg-black/[0.05] text-[#0071E3] text-xs font-medium cursor-pointer transition-colors"
                >
                  {showAllStudentsInCall
                    ? `Paginar (${CALL_PAGE_SIZE} por página)`
                    : `Ver todos (${displayedStudents.length})`}
                </button>
              }
            />
          )}
        </>
      )}

      {/* Rodapé Resumido Proporcional */}
      <section className="bg-white rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4 border border-black/[0.06] shadow-[0_2px_10px_rgba(15,23,42,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm sm:text-base font-semibold text-[#1D1D1F] break-words">
            Faltas de {selectedMonthName}
          </h3>
          <p className="text-xs text-[#64748B] font-normal mt-0.5 break-words tabular-nums">
            {formatFaltas(liveClassMetrics.totalFaltasTurma)} registradas ·{' '}
            {liveClassMetrics.presenceRate}% de presença global ·{' '}
            {syncSnapshot.isOnline
              ? 'Salvo no dispositivo e sincronizado na nuvem'
              : 'Modo offline ativo: salvo no dispositivo e fila segura'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto min-w-0">
          {!isPeb1 && previousPeriodName && (
            <button
              type="button"
              onClick={() => handleMonthChange(previousPeriodName)}
              className="w-full sm:w-auto min-h-[36px] py-1.5 px-4 rounded-full bg-[#F5F5F7] hover:bg-black/[0.05] text-[#1D1D1F] font-medium text-xs flex items-center justify-center text-center whitespace-normal gap-1.5 cursor-pointer transition-colors border border-black/[0.06]"
              title={`Voltar ao período anterior: ${previousPeriodName}`}
            >
              <SFSymbol name="history" size={16} className="text-[#0071E3] shrink-0" />
              <span>Período Anterior ({previousPeriodName})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              triggerMenuHaptic('light');
              onBack();
            }}
            className="w-full sm:w-auto min-h-[36px] py-1.5 px-5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold text-xs flex items-center justify-center text-center whitespace-normal gap-1.5 cursor-pointer transition-colors shadow-xs"
          >
            <SFSymbol name="arrow_back" size={16} className="text-white shrink-0" />
            <span>Voltar para Turma</span>
          </button>
        </div>
      </section>
    </div>
  );
};
