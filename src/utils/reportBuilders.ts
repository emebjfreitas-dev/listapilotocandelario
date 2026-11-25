import {
  AuthorizedUser,
  ClassGroup,
  SchoolDay,
  SecurityAuditLogEntry,
  Student,
} from '../types';
import { OFFICIAL_OCTOBER_DAYS } from '../data/mockData';
import {
  getClassAttendanceMetrics,
  getStudentAttendanceMetrics,
  StudentBimesterReportRow,
} from './attendanceRules';
import { getStudentCumulativeOccurrences } from '../services/pushNotificationService';
import {
  getStudentGenderLabel,
  resolveGuardianRelationshipInfo,
} from './genderDictionary';
import { getStoredLgpdConfig, maskSensitiveText } from '../services/securityAuditService';
import {
  formatAccessExpirationDateBR,
  formatDurationHuman,
  isUserAccessExpired,
} from '../services/authSessionService';
import {
  ExportSheetSection,
  UniversalExportReport,
} from './universalExport';

function maskIfEnabled(
  value: string | undefined | null,
  type: 'cpf' | 'nis' | 'phone' | 'rg' | 'address' | 'sus' | 'cep',
  anonymize: boolean,
  emptyFallback = '—'
): string {
  if (!value || !String(value).trim()) return emptyFallback;
  return anonymize ? maskSensitiveText(String(value), type) : String(value);
}

function isStudentMoved(s: Student): boolean {
  const sit = (s.situacao || 'ATIVO').toUpperCase().trim();
  return (
    sit.includes('BXTR') ||
    sit.includes('TRANSF') ||
    sit.includes('REMAN') ||
    sit.includes('RM')
  );
}

// 1. PANORAMA ESCOLAR (HOME SCREEN)
export function buildHomeSchoolOverviewReport(params: {
  classes: ClassGroup[];
  schoolYear: number;
  activeStudents: number;
  aeeCount: number;
  avgPresence: number;
  criticalConsecutiveCount: number;
  missingFichasTotal: number;
  userName?: string;
}): UniversalExportReport {
  const {
    classes,
    schoolYear,
    activeStudents,
    aeeCount,
    avgPresence,
    criticalConsecutiveCount,
    missingFichasTotal,
    userName,
  } = params;

  const classRows = classes.map((cls) => {
    const cm = getClassAttendanceMetrics(cls, OFFICIAL_OCTOBER_DAYS);
    const activeCount = cls.students.filter((s) => !isStudentMoved(s)).length;
    const consecCount = cls.students.filter((s) => s.consecutiveAbsenceAlert?.active).length;
    return [
      cls.name,
      cls.shift.replace('Turno ', ''),
      cls.room || '—',
      cls.teacherName || '—',
      activeCount,
      `${cm.presenceRate}%`,
      cm.totalFaltasTurma,
      cm.totalAtestadosTurma,
      consecCount,
      cls.isPending ? 'Pendente' : 'Sincronizado',
    ];
  });

  return {
    fileNameBase: `Panorama_Escolar_EMEB_Candelario_${schoolYear}`,
    title: `Panorama Escolar Geral — Ano Letivo ${schoolYear}`,
    subtitle: `${classes.length} turma(s) acompanhadas · Frequência, Matrículas e Busca Ativa`,
    generatedBy: userName,
    orientation: 'landscape',
    summaryMetrics: [
      { label: 'Turmas', value: String(classes.length), detail: 'Matriz oficial' },
      { label: 'Estudantes Ativos', value: String(activeStudents), detail: `${aeeCount} em AEE` },
      { label: 'Presença Média', value: `${avgPresence}%`, detail: 'Consolidado escolar' },
      { label: 'Busca Ativa', value: String(criticalConsecutiveCount), detail: '3+ faltas seguidas' },
      { label: 'Fichas Pendentes', value: String(missingFichasTotal), detail: 'Sem PDF anexado' },
    ],
    sheets: [
      {
        sheetName: 'Turmas_Consolidado',
        sectionTitle: 'Quadro Consolidado das Turmas',
        headers: [
          'Turma',
          'Turno',
          'Sala',
          'Regente',
          'Ativos',
          '% Presença',
          'Faltas',
          'Atestados',
          'Busca Ativa',
          'Status',
        ],
        rows: classRows,
      },
    ],
  };
}

// 2. QUADRO DE TURMAS (MINHAS TURMAS SCREEN)
export function buildTurmasOverviewReport(params: {
  classes: ClassGroup[];
  schoolYear: number;
  shiftFilterLabel: string;
  searchTerm?: string;
}): UniversalExportReport {
  const { classes, schoolYear, shiftFilterLabel, searchTerm } = params;
  let totalAtivos = 0;
  let sumPres = 0;
  let totalFaltas = 0;

  const rows = classes.map((cls) => {
    const cm = getClassAttendanceMetrics(cls, OFFICIAL_OCTOBER_DAYS);
    const activeCount = cls.students.filter((s) => !isStudentMoved(s)).length;
    totalAtivos += activeCount;
    sumPres += cm.presenceRate;
    totalFaltas += cm.totalFaltasTurma;

    return [
      cls.name,
      cls.grade,
      cls.shift.replace('Turno ', ''),
      cls.room || '—',
      cls.teacherName || '—',
      [cls.artTeacher, cls.peTeacher, cls.englishTeacher].filter(Boolean).join(' · ') || '—',
      activeCount,
      `${cm.presenceRate}%`,
      cm.totalFaltasTurma,
      cls.isPending ? 'Pendente' : 'Em dia',
    ];
  });

  const avgPres = classes.length > 0 ? Math.round(sumPres / classes.length) : 0;

  return {
    fileNameBase: `Quadro_Turmas_EMEB_Candelario_${schoolYear}`,
    title: `Relação de Turmas — Ano Letivo ${schoolYear}`,
    subtitle: `Filtro: ${shiftFilterLabel}${searchTerm ? ` · Busca: "${searchTerm}"` : ''}`,
    orientation: 'landscape',
    summaryMetrics: [
      { label: 'Turmas Listadas', value: String(classes.length) },
      { label: 'Estudantes Ativos', value: String(totalAtivos) },
      { label: 'Presença Média', value: `${avgPres}%` },
      { label: 'Total de Faltas', value: String(totalFaltas) },
    ],
    sheets: [
      {
        sheetName: 'Turmas',
        sectionTitle: 'Turmas, Docentes e Frequência',
        headers: [
          'Turma',
          'Etapa',
          'Turno',
          'Sala',
          'Professor(a) Regente',
          'Especialistas PEB II',
          'Ativos',
          '% Presença',
          'Faltas',
          'Status',
        ],
        rows,
      },
    ],
  };
}

// 3. FICHA INDIVIDUAL COMPLETA DO ESTUDANTE (EXPANSÃO & GRADE DADOS CRIANÇA MODAL)
export function buildStudentIndividualReport(params: {
  student: Student;
  classGroup: ClassGroup;
  diasLetivosMes?: number;
}): UniversalExportReport {
  const { student, classGroup, diasLetivosMes } = params;
  const anonymize = Boolean(getStoredLgpdConfig().maskSensitiveDataByDefault);
  const dl = diasLetivosMes ?? classGroup.classesHeld ?? 20;
  const metrics = getStudentAttendanceMetrics(student, dl, OFFICIAL_OCTOBER_DAYS);
  const genderInfo = getStudentGenderLabel(student);
  const g1 = resolveGuardianRelationshipInfo(
    student.filiacao1 || student.guardianName,
    'filiacao1',
    student.notes
  );
  const g2 = resolveGuardianRelationshipInfo(
    student.filiacao2,
    'filiacao2',
    student.notes
  );
  const occs = getStudentCumulativeOccurrences(student);

  const addressJoined = [
    maskIfEnabled(student.logradouro, 'address', anonymize, ''),
    student.numeroResidencia
      ? `nº ${anonymize ? '***' : student.numeroResidencia}`
      : '',
    student.complemento ? (anonymize ? '***' : student.complemento) : '',
    student.bairro || '',
    student.cidade ? `${student.cidade}/${student.uf || 'SP'}` : '',
    student.cep ? `CEP ${maskIfEnabled(student.cep, 'cep', anonymize, '')}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const sheets: ExportSheetSection[] = [
    {
      sheetName: 'Identificacao',
      sectionTitle: 'Identificação e Matrícula',
      headers: ['Campo', 'Informação Oficial'],
      columnWidths: [32, 54],
      rows: [
        ['Nome do(a) Estudante', student.name],
        ['Nome Social', student.nomeSocial || '—'],
        ['Turma / Turno / Sala', `${classGroup.name} · ${classGroup.shift.replace('Turno ', '')} · ${classGroup.room || '—'}`],
        ['Nº da Chamada', String(student.number).padStart(2, '0')],
        ['RA Completo', student.ra ? `${student.ra}-${student.digRa || ''}/${student.ufRa || 'SP'}` : '—'],
        ['Data de Nascimento / Idade', `${student.dataNascimento || '—'}${student.idade ? ` (${student.idade})` : ''}`],
        ['Gênero', genderInfo.label],
        ['Situação Cadastral', student.situacao || 'ATIVO'],
        ['Data Matrícula SED', student.dataMatriculaSed || '03/02/2027'],
        ['Data Movimentação', student.dataMovimentacao || '—'],
        ['Procedência / Sucessão', [student.procedenciaEscolar, student.sucessaoEscolar].filter(Boolean).join(' · ') || '—'],
      ],
    },
    {
      sheetName: 'Frequencia',
      sectionTitle: 'Frequência e Assiduidade no Período',
      headers: ['Indicador', 'Valor', 'Detalhamento'],
      columnWidths: [30, 18, 42],
      rows: [
        ['Frequência (% Presença)', `${metrics.frequenciaPercent}%`, `Meta mínima legal: ${metrics.minLegalPresencePercent}%`],
        ['Dias Letivos no Recorte', metrics.diasLetivosMatriculados, metrics.recorteLabel],
        ['Presenças Registradas', metrics.presencas, `${metrics.presencas} dia(s) com comparecimento`],
        ['Total de Faltas', metrics.faltas, `${metrics.atestados} com atestado · ${Math.max(0, metrics.faltas - metrics.atestados)} sem justificativa`],
        ['Status Legal (LDB / MEC)', metrics.isBelowLegalThreshold ? `ABAIXO DA META (<${metrics.minLegalPresencePercent}%)` : `REGULAR (>=${metrics.minLegalPresencePercent}%)`, student.notes || 'Sem observações registradas'],
      ],
    },
    {
      sheetName: 'Familia_Endereco',
      sectionTitle: 'Filiação, Contatos e Endereço',
      headers: ['Campo', 'Dado Registrado'],
      columnWidths: [32, 54],
      rows: [
        [`Responsável 1 (${g1.roleLabel})`, g1.cleanName || 'Não informado'],
        [`Responsável 2 (${g2.roleLabel})`, g2.cleanName || 'Não informado'],
        ['Telefones / WhatsApp', maskIfEnabled(student.telefones || student.guardianPhone, 'phone', anonymize)],
        ['E-mail Institucional', student.emailMunicipal || '—'],
        ['E-mail Google / Microsoft', [student.emailGoogle, student.emailMicrosoft].filter(Boolean).join(' · ') || '—'],
        ['Irmãos na Escola', student.irmaos || 'Não informado'],
        ['Endereço Completo', addressJoined || 'Não cadastrado'],
      ],
    },
    {
      sheetName: 'Documentos_Saude',
      sectionTitle: 'Documentos, Benefícios e Educação Especial (AEE)',
      headers: ['Campo', 'Registro'],
      columnWidths: [32, 54],
      rows: [
        ['CPF', maskIfEnabled(student.cpf, 'cpf', anonymize)],
        ['RG / Emissão', `${maskIfEnabled(student.rg, 'rg', anonymize)}${student.dataEmissaoRg ? ` (${anonymize ? '**/**/****' : student.dataEmissaoRg})` : ''}`],
        ['NIS (Bolsa Família)', maskIfEnabled(student.nis, 'nis', anonymize)],
        ['Cartão SUS', maskIfEnabled(student.cartaoSus, 'sus', anonymize)],
        ['Deficiência / AEE', student.deficiencia || 'Nenhuma informada'],
        ['Tipo Sanguíneo / Raça-Cor', [student.tipoSanguineo, student.racaCor].filter(Boolean).join(' · ') || '—'],
        ['Município de Nascimento', student.municipioNascimento || 'JUNDIAI - SP'],
      ],
    },
  ];

  if (occs.length > 0) {
    sheets.push({
      sheetName: 'Busca_Ativa',
      sectionTitle: 'Histórico de Busca Ativa (3+ Faltas Seguidas)',
      headers: ['Ocorrência', 'Datas das Faltas', 'Data Registro', 'Status / Canal', 'Devolutiva da Família'],
      rows: occs.map((o, idx) => [
        `${o.sequenceNumber || idx + 1}ª`,
        o.selectedDates.join(', ') || '—',
        o.reportedAt || '—',
        o.contactStatus || 'Aguardando contato',
        o.familyFeedback || 'Aguardando retorno',
      ]),
    });
  }

  return {
    fileNameBase: `Ficha_${student.name}_${classGroup.name}_2027`,
    title: `Ficha Individual do Estudante — ${student.name}`,
    subtitle: `Chamada Nº ${String(student.number).padStart(2, '0')} · ${classGroup.name} · ${classGroup.shift.replace('Turno ', '')}`,
    orientation: 'portrait',
    metadata: [
      { label: 'RA', value: student.ra ? `${student.ra}-${student.digRa || ''}` : '—' },
      { label: 'Nascimento', value: student.dataNascimento || '—' },
      { label: 'Regente', value: classGroup.teacherName || '—' },
      { label: 'LGPD', value: anonymize ? 'Dados sensíveis mascarados' : 'Modo completo' },
    ],
    summaryMetrics: [
      { label: 'Frequência', value: `${metrics.frequenciaPercent}%`, detail: `${metrics.presencas}/${metrics.diasLetivosMatriculados} dias` },
      { label: 'Total Faltas', value: String(metrics.faltas), detail: `${metrics.atestados} atestado(s)` },
      { label: 'Situação', value: student.situacao || 'ATIVO', detail: classGroup.name },
      { label: 'Busca Ativa', value: `${occs.length} ${occs.length === 1 ? 'registro' : 'registros'}`, detail: 'Ocorrências no ano' },
    ],
    sheets,
  };
}

// 4. REGISTRO DE FREQUÊNCIA MENSAL
export function buildMonthlyAttendanceReport(params: {
  classGroup: ClassGroup;
  students: Student[];
  monthName: string;
  diasLetivosMes: number;
  minLegalPresence: number;
}): UniversalExportReport {
  const { classGroup, students, monthName, diasLetivosMes, minLegalPresence } = params;
  const sorted = [...students].sort((a, b) => a.number - b.number);
  let sumDias = 0;
  let sumPresencas = 0;
  let sumFaltas = 0;
  let sumAtestados = 0;
  let belowCount = 0;

  const rows = sorted.map((s) => {
    const m = getStudentAttendanceMetrics(s, diasLetivosMes, OFFICIAL_OCTOBER_DAYS);
    const fnj = Math.max(0, m.faltas - m.atestados);
    sumDias += m.diasLetivosMatriculados;
    sumPresencas += m.presencas;
    sumFaltas += m.faltas;
    sumAtestados += m.atestados;
    if (m.isBelowLegalThreshold) belowCount++;

    return [
      String(s.number).padStart(2, '0'),
      s.name,
      s.situacao || 'ATIVO',
      m.diasLetivosMatriculados,
      m.presencas,
      m.faltas,
      m.atestados,
      fnj,
      `${m.frequenciaPercent}%`,
      m.isBelowLegalThreshold ? `ABAIXO (<${minLegalPresence}%)` : `REGULAR (>=${minLegalPresence}%)`,
      s.notes || '—',
    ];
  });

  const avgPres = sumDias > 0 ? Math.round((sumPresencas / sumDias) * 100) : 100;

  return {
    fileNameBase: `Frequencia_${monthName}_${classGroup.name}_2027`,
    title: `Mapa de Frequência Mensal — ${monthName}/2027`,
    subtitle: `${classGroup.name} · ${classGroup.shift.replace('Turno ', '')} · ${classGroup.room || 'Sala'} · Regente: ${classGroup.teacherName || '—'}`,
    orientation: 'landscape',
    summaryMetrics: [
      { label: 'Estudantes', value: String(sorted.length) },
      { label: 'Dias Letivos', value: `${diasLetivosMes} ${diasLetivosMes === 1 ? 'dia' : 'dias'}`, detail: `Mês de ${monthName}` },
      { label: 'Presença Turma', value: `${avgPres}%`, detail: `${sumPresencas}/${sumDias} presenças` },
      { label: 'Faltas / Atestados', value: `${sumFaltas} / ${sumAtestados}`, detail: `${belowCount} abaixo da meta` },
    ],
    sheets: [
      {
        sheetName: `Freq_${monthName}`.slice(0, 31),
        sectionTitle: `Lançamento Nominal de Frequência — ${monthName} 2027`,
        headers: [
          'Nº',
          'Estudante',
          'Situação',
          'Dias Recorte',
          'Presenças',
          'Faltas',
          'Atestados',
          'Faltas sem Justificativa',
          '% Presença',
          'Meta Legal',
          'Observações / Atestado',
        ],
        rows,
      },
    ],
  };
}

// 5. FALTAS CONSECUTIVAS / BUSCA ATIVA
export interface ConsecutiveEntryLike {
  cls: ClassGroup;
  student: Student;
  occurrences: ReturnType<typeof getStudentCumulativeOccurrences>;
}

export function buildConsecutiveAbsencesReport(params: {
  entries: ConsecutiveEntryLike[];
  scopeLabel: string;
  filterLabel: string;
}): UniversalExportReport {
  const { entries, scopeLabel, filterLabel } = params;
  const anonymize = Boolean(getStoredLgpdConfig().maskSensitiveDataByDefault);

  const rows: (string | number)[][] = [];
  let pendingCount = 0;
  let feedbackCount = 0;

  entries.forEach(({ cls, student, occurrences }) => {
    const guardian = resolveGuardianRelationshipInfo(
      student.filiacao1 || student.guardianName,
      'filiacao1',
      student.notes
    );
    const phone = maskIfEnabled(
      student.telefones || student.guardianPhone,
      'phone',
      anonymize
    );

    if (occurrences.length === 0) {
      rows.push([
        cls.name,
        String(student.number).padStart(2, '0'),
        student.name,
        student.totalAbsencesMonth || 0,
        'Sem ocorrências',
        '—',
        'Sem solicitação',
        guardian.cleanName || '—',
        phone,
        '—',
      ]);
      return;
    }

    occurrences.forEach((occ, idx) => {
      const hasFeedback = Boolean((occ.familyFeedback || '').trim());
      if (hasFeedback) feedbackCount++;
      else pendingCount++;

      rows.push([
        cls.name,
        String(student.number).padStart(2, '0'),
        student.name,
        student.totalAbsencesMonth || 0,
        `${occ.sequenceNumber || idx + 1}ª (${occ.selectedDates.length} ${occ.selectedDates.length === 1 ? 'dia' : 'dias'})`,
        occ.selectedDates.join(', ') || '—',
        hasFeedback
          ? occ.contactStatus === 'justificado_atestado'
            ? 'Justificado / Atestado'
            : occ.contactStatus === 'encaminhado_busca'
            ? 'Encaminhado Busca Ativa'
            : 'Contato realizado'
          : occ.contactStatus === 'em_tentativa'
          ? 'Em tentativa'
          : occ.contactStatus === 'encaminhado_busca'
          ? 'Encaminhado Busca Ativa'
          : 'Aguardando contato',
        guardian.cleanName || '—',
        phone,
        occ.familyFeedback || 'Aguardando devolutiva',
      ]);
    });
  });

  return {
    fileNameBase: 'Busca_Ativa_Faltas_Consecutivas_2027',
    title: 'Relatório de Busca Ativa — Faltas Consecutivas (ECA)',
    subtitle: `Escopo: ${scopeLabel} · Filtro: ${filterLabel}`,
    orientation: 'landscape',
    summaryMetrics: [
      { label: 'Estudantes Listados', value: String(entries.length) },
      { label: 'Registros / Ocorrências', value: String(rows.length) },
      { label: 'Com Devolutiva', value: String(feedbackCount) },
      { label: 'Aguardando Retorno', value: String(pendingCount) },
    ],
    sheets: [
      {
        sheetName: 'Busca_Ativa',
        sectionTitle: 'Acompanhamento de Solicitações e Contatos Familiares',
        headers: [
          'Turma',
          'Nº',
          'Estudante',
          'Faltas Mês',
          'Ocorrência',
          'Dias Consecutivos',
          'Status Contato',
          'Responsável',
          'Telefone',
          'Devolutiva Família / Secretaria',
        ],
        rows,
      },
    ],
  };
}

// 6. FAMÍLIAS COM MÚLTIPLOS ESTUDANTES / IRMÃOS
export interface MultiFamilyExportItem {
  relationSummary: string;
  sharedGuardians: { roleLabel: string; name: string }[];
  members: unknown[];
  memberMetrics: {
    student: Student;
    cls: ClassGroup;
    frequenciaPercent: number;
  }[];
  distinctClassNames: string[];
  rawPhonesJoined: string;
  hasAlert: boolean;
  alertCount: number;
}

export function buildMultiStudentFamiliesReport(params: {
  families: MultiFamilyExportItem[];
  totalLinkedStudents: number;
  multiClassFamilies: number;
  familiesWithAlerts: number;
}): UniversalExportReport {
  const { families, totalLinkedStudents, multiClassFamilies, familiesWithAlerts } = params;
  const anonymize = Boolean(getStoredLgpdConfig().maskSensitiveDataByDefault);

  const rows = families.map((fam, idx) => [
    `Família ${idx + 1}`,
    fam.relationSummary,
    fam.sharedGuardians.map((g) => `${g.roleLabel}: ${g.name}`).join(' | '),
    fam.members.length,
    fam.distinctClassNames.join(', '),
    maskIfEnabled(fam.rawPhonesJoined, 'phone', anonymize, 'Não cadastrado'),
    fam.memberMetrics
      .map((m) => `${m.student.name} (${m.cls.name} · ${m.frequenciaPercent}%)`)
      .join(' | '),
    fam.hasAlert ? `${fam.alertCount} em atenção` : 'Regular',
  ]);

  return {
    fileNameBase: 'Familias_Multiplos_Estudantes_EMEB_2027',
    title: 'Famílias com Múltiplos Estudantes na Escola (Irmãos)',
    subtitle: 'Cruzamento automático por filiação para agilizar contatos da Busca Ativa',
    orientation: 'landscape',
    summaryMetrics: [
      { label: 'Famílias', value: String(families.length) },
      { label: 'Estudantes Vinculados', value: String(totalLinkedStudents) },
      { label: 'Em Turmas Diferentes', value: String(multiClassFamilies) },
      { label: 'Com Alerta Frequência', value: String(familiesWithAlerts) },
    ],
    sheets: [
      {
        sheetName: 'Familias_Irmaos',
        sectionTitle: 'Núcleos Familiares Identificados',
        headers: [
          'Núcleo',
          'Vínculo',
          'Responsáveis Compartilhados',
          'Quantidade de Filhos',
          'Turmas',
          'Telefones',
          'Estudantes (Nome · Turma · Frequência)',
          'Situação Busca Ativa',
        ],
        rows,
      },
    ],
  };
}

// 7. LISTAS NOMINAIS / BOLSA FAMÍLIA
export interface BolsaFamiliaRowLike {
  cls: ClassGroup;
  student: Student;
  rep: StudentBimesterReportRow;
  hasAtestado: boolean;
  worstMonthName: string;
  worstMonthPercent: number;
  isBelowTarget: boolean;
}

export function buildBolsaFamiliaNominalReport(params: {
  rows: BolsaFamiliaRowLike[];
  bimesterId: string;
  bimesterLabel: string;
  bimesterShortLabel: string;
}): UniversalExportReport {
  const { rows, bimesterId, bimesterLabel, bimesterShortLabel } = params;
  const anonymize = Boolean(getStoredLgpdConfig().maskSensitiveDataByDefault);

  const monthNames =
    rows[0]?.rep.monthsBreakdown.map((mb) => mb.monthName.toUpperCase()) || [];

  const headers = [
    'Ordem',
    'Turma',
    'Estudante',
    'Etapa',
    'Meta Legal',
    ...monthNames.flatMap((m) => [`${m} %`, `${m} (Faltas / Atestados)`]),
    'Faltas no Bimestre',
    'Atestados',
    '% Presença',
    'Status Meta',
    'RA',
    'NIS (Bolsa Família)',
    'Responsável / Telefone',
  ];

  const belowCount = rows.filter((r) => r.isBelowTarget).length;
  const atestadoCount = rows.filter((r) => r.hasAtestado).length;

  const tableRows = rows.map((r, index) => {
    const phone = maskIfEnabled(
      r.student.telefones || r.student.guardianPhone,
      'phone',
      anonymize
    );
    const guardian = r.student.filiacao1 || r.student.guardianName || '—';
    return [
      index + 1,
      r.cls.name,
      r.student.name,
      r.rep.isEducacaoInfantil ? 'Educação Infantil' : 'Ensino Fundamental',
      `>=${r.rep.minLegalPresencePercent}%`,
      ...r.rep.monthsBreakdown.flatMap((mb) => [
        `${mb.frequenciaPercent}%`,
        `${mb.faltas} faltas / ${mb.atestados} atestados`,
      ]),
      r.rep.totalFaltasBimestre,
      r.rep.totalAtestadosBimestre,
      `${r.rep.frequenciaBimestrePercent}%`,
      r.isBelowTarget
        ? `ABAIXO (<${r.rep.minLegalPresencePercent}%)`
        : `REGULAR (>=${r.rep.minLegalPresencePercent}%)`,
      r.student.ra ? `${r.student.ra}-${r.student.digRa || ''}` : '—',
      maskIfEnabled(r.student.nis, 'nis', anonymize),
      `${guardian} (${phone})`,
    ];
  });

  return {
    fileNameBase: `Listas_Nominais_Bolsa_Familia_${bimesterId}_2027`,
    title: `Estudantes Beneficiados do Bolsa Família — ${bimesterShortLabel}`,
    subtitle: `${bimesterLabel} · Meta MEC/LDB: >=60% Educação Infantil / >=75% Ensino Fundamental`,
    orientation: 'landscape',
    summaryMetrics: [
      { label: 'Estudantes Listados', value: String(rows.length) },
      { label: 'Abaixo da Meta', value: String(belowCount) },
      { label: 'Com Atestado', value: String(atestadoCount) },
      { label: 'Período', value: bimesterShortLabel },
    ],
    sheets: [
      {
        sheetName: `Bolsa_${bimesterId.toUpperCase()}`.slice(0, 31),
        sectionTitle: `Apuração Nominal — ${bimesterLabel}`,
        headers,
        rows: tableRows,
      },
    ],
  };
}

// 8. CALENDÁRIO ESCOLAR OFICIAL 200 DIAS LETIVOS
export function buildCalendar200DaysReport(params: {
  year: number;
  calendarDays: {
    date: string;
    dayOfWeek: string;
    month: string;
    isSaturday?: boolean;
    holidayConflict?: string;
  }[];
}): UniversalExportReport {
  const { year, calendarDays } = params;
  const saturdayCount = calendarDays.filter((d) => d.isSaturday).length;
  const monthCounts = new Map<string, number>();
  calendarDays.forEach((d) => {
    monthCounts.set(d.month, (monthCounts.get(d.month) || 0) + 1);
  });

  return {
    fileNameBase: `Calendario_Oficial_200_Dias_${year}`,
    title: `Calendário Escolar Oficial — ${year} (${calendarDays.length} Dias Letivos)`,
    subtitle: 'Homologação conforme Lei de Diretrizes e Bases (LDB — mínimo 200 dias)',
    orientation: 'portrait',
    summaryMetrics: [
      { label: 'Total Dias Letivos', value: `${calendarDays.length}/200` },
      { label: 'Sábados Letivos', value: String(saturdayCount) },
      { label: 'Meses Cobertos', value: String(monthCounts.size) },
    ],
    sheets: [
      {
        sheetName: `Calendario_${year}`,
        sectionTitle: `Relação Cronológica dos Dias Letivos (${year})`,
        headers: ['Ordem', 'Data', 'Dia da Semana', 'Mês', 'Classificação'],
        columnWidths: [10, 14, 18, 16, 32],
        rows: calendarDays.map((d, idx) => [
          idx + 1,
          d.date,
          d.dayOfWeek,
          d.month,
          d.isSaturday ? 'Sábado Letivo' : d.holidayConflict || 'Dia Letivo Regular',
        ]),
      },
      {
        sheetName: 'Resumo_Mensal',
        sectionTitle: 'Distribuição de Dias Letivos por Mês',
        headers: ['Mês', 'Quantidade de Dias Letivos'],
        columnWidths: [24, 20],
        rows: Array.from(monthCounts.entries()).map(([month, count]) => [month, count]),
      },
    ],
  };
}

// 9. QUADRO OFICIAL DE TURMAS, PROFESSORES & ACESSOS (ADMIN)
export function buildOfficialMatrixReport(
  classes: ClassGroup[],
  authorizedUsers: AuthorizedUser[]
): UniversalExportReport {
  const matrixRows = classes.map((cls) => {
    const activeCount = cls.students.filter((s) => !isStudentMoved(s)).length;
    const transfCount = cls.students.filter((s) => {
      const sit = (s.situacao || 'ATIVO').toUpperCase().trim();
      return sit.includes('BXTR') || sit.includes('TRANSF');
    }).length;
    const remanCount = cls.students.filter((s) => {
      const sit = (s.situacao || 'ATIVO').toUpperCase().trim();
      return sit.includes('REMAN') || sit.includes('RM');
    }).length;
    const regenteUser = authorizedUsers.find(
      (u) =>
        u.role === 'usuario' &&
        ((u.assignedClassIds && u.assignedClassIds.includes(cls.id)) ||
          u.assignedClassId === cls.id)
    );
    const periodo = cls.shift.toUpperCase().includes('TARDE') ? 'TARDE' : 'MANHÃ';

    return [
      cls.name,
      cls.room || '—',
      periodo,
      regenteUser?.name || cls.teacherName || '—',
      regenteUser?.email || cls.teacherEmail || '—',
      activeCount,
      transfCount,
      remanCount,
      cls.artTeacher || '—',
      cls.peTeacher || '—',
      cls.englishTeacher || '—',
      cls.classeSedCode || '—',
    ];
  });

  const accessRows = authorizedUsers.map((u, idx) => [
    idx + 1,
    u.name,
    u.email,
    u.role === 'admin'
      ? 'ADMIN'
      : u.role === 'usuario'
      ? 'PEB I Regente'
      : `PEB II (${u.subjectName || 'Especialista'})`,
    u.assignedClassNames?.length ? u.assignedClassNames.join(' + ') : u.assignedClassName,
    isUserAccessExpired(u) ? 'EXPIRADO' : u.active ? 'ATIVO' : 'BLOQUEADO',
    u.accessExpiresAt ? formatAccessExpirationDateBR(u.accessExpiresAt) : 'Permanente',
    u.totalAccessCount || 0,
    formatDurationHuman(u.totalDurationSeconds || 0),
    u.lastLoginAt || 'Ainda não acessou',
  ]);

  return {
    fileNameBase: 'Quadro_Oficial_Turmas_Professores_Acessos_EMEB_Candelario_2027',
    title: 'Quadro Oficial de Turmas, Professores & Acessos',
    subtitle: 'Matriz organizacional completa · EMEB Prof. Joaquim Candelário de Freitas',
    orientation: 'landscape',
    summaryMetrics: [
      { label: 'Turmas Oficiais', value: String(classes.length) },
      { label: 'Servidores Autorizados', value: String(authorizedUsers.length) },
      {
        label: 'Contas Ativas',
        value: String(authorizedUsers.filter((u) => u.active && !isUserAccessExpired(u)).length),
      },
    ],
    sheets: [
      {
        sheetName: 'Quadro_Turmas_Docentes',
        sectionTitle: 'Quadro Oficial de Turmas e Professores',
        headers: [
          'Turma',
          'Sala',
          'Período',
          'Professor(a) Regente',
          'E-mail Regente',
          'Ativos',
          'Transferidos',
          'Remanejados',
          'Arte',
          'Educação Física',
          'Inglês',
          'Código SED',
        ],
        rows: matrixRows,
      },
      {
        sheetName: 'Acessos_Servidores',
        sectionTitle: 'Contas Autorizadas e Monitoramento de Acessos',
        headers: [
          'Ordem',
          'Servidor(a)',
          'E-mail Institucional',
          'Perfil',
          'Turmas Vinculadas',
          'Status',
          'Validade',
          'Acessos',
          'Tempo Conectado',
          'Último Acesso',
        ],
        rows: accessRows,
      },
    ],
  };
}

// 10. CONTAS E PERFIS AUTORIZADOS (SUB-ABA CONTAS)
export function buildAuthorizedUsersReport(
  users: AuthorizedUser[],
  filterLabel: string
): UniversalExportReport {
  const activeCount = users.filter((u) => u.active && !isUserAccessExpired(u)).length;
  return {
    fileNameBase: 'Contas_Acessos_Autorizados_EMEB_2027',
    title: 'Relação de Contas e Perfis Autorizados',
    subtitle: `Filtro aplicado: ${filterLabel} · ${users.length} conta(s)`,
    orientation: 'landscape',
    summaryMetrics: [
      { label: 'Total Listado', value: String(users.length) },
      { label: 'Ativas', value: String(activeCount) },
      { label: 'Bloqueadas/Expiradas', value: String(users.length - activeCount) },
    ],
    sheets: [
      {
        sheetName: 'Contas_Autorizadas',
        sectionTitle: 'Servidores Autorizados (@educacao.jundiai.sp.gov.br)',
        headers: [
          'Nº',
          'Nome do Servidor',
          'E-mail Institucional',
          'Perfil / Função',
          'Turmas Vinculadas',
          'Status',
          'Validade',
          'Total Acessos',
          'Tempo Total',
          'Último Login',
        ],
        rows: users.map((u, idx) => [
          idx + 1,
          u.name,
          u.email,
          u.role === 'admin'
            ? 'ADMIN'
            : u.role === 'usuario'
            ? 'PEB I Regente'
            : `PEB II (${u.subjectName || 'Especialista'})`,
          u.assignedClassNames?.length ? u.assignedClassNames.join(' + ') : u.assignedClassName,
          isUserAccessExpired(u) ? 'EXPIRADO' : u.active ? 'ATIVO' : 'BLOQUEADO',
          u.accessExpiresAt ? formatAccessExpirationDateBR(u.accessExpiresAt) : 'Permanente',
          u.totalAccessCount || 0,
          formatDurationHuman(u.totalDurationSeconds || 0),
          u.lastLoginAt || 'Nunca acessou',
        ]),
      },
    ],
  };
}

// 11. AUDITORIA DE SEGURANÇA & LGPD
export function buildSecurityAuditReport(
  logs: SecurityAuditLogEntry[]
): UniversalExportReport {
  return {
    fileNameBase: `Auditoria_Seguranca_LGPD_Candelario_${new Date().toISOString().slice(0, 10)}`,
    title: 'Relatório de Auditoria de Segurança e LGPD (Art. 14)',
    subtitle: 'Trilha cronológica de eventos de acesso, privacidade e alterações administrativas',
    orientation: 'landscape',
    summaryMetrics: [
      { label: 'Eventos Registrados', value: String(logs.length) },
      {
        label: 'Alertas / Críticos',
        value: String(logs.filter((l) => l.severity !== 'info').length),
      },
    ],
    sheets: [
      {
        sheetName: 'Auditoria_LGPD',
        sectionTitle: 'Registros da Trilha de Auditoria',
        headers: [
          'ID',
          'Data/Hora',
          'Usuário (E-mail)',
          'Nome',
          'Perfil',
          'Evento',
          'Ação',
          'Severidade',
          'Detalhes',
          'IP',
        ],
        rows: logs.map((l) => [
          l.id,
          new Date(l.timestampISO).toLocaleString('pt-BR'),
          l.userEmail,
          l.userName || '—',
          l.userRole.toUpperCase(),
          l.eventType,
          l.actionTitle || '—',
          l.severity.toUpperCase(),
          l.details || '—',
          l.clientIp || '127.0.0.1',
        ]),
      },
    ],
  };
}

// 12. DIAGNÓSTICO DE CONSISTÊNCIA DO BANCO DE DADOS
export interface DiagnosticIssueExportLike {
  severity: string;
  categoryLabel: string;
  className?: string;
  studentNumber?: number;
  studentName?: string;
  affectedField: string;
  currentValue: string;
  expectedValue: string;
  description: string;
  suggestedAction: string;
}

export function buildDiagnosticsReport(params: {
  issues: DiagnosticIssueExportLike[];
  healthScore: number;
  classesCount: number;
  activeStudentsCount: number;
  aeeCount: number;
}): UniversalExportReport {
  const { issues, healthScore, classesCount, activeStudentsCount, aeeCount } = params;
  const critCount = issues.filter((i) => i.severity === 'critical').length;
  const warnCount = issues.filter((i) => i.severity === 'warning').length;

  return {
    fileNameBase: `Diagnostico_BD_Candelario_${new Date().toISOString().slice(0, 10)}`,
    title: 'Diagnóstico Técnico e Consistência do Banco de Dados',
    subtitle: `Auditoria em ${classesCount} turmas, ${activeStudentsCount} estudantes ativos (${aeeCount} AEE)`,
    orientation: 'landscape',
    summaryMetrics: [
      { label: 'Índice de Saúde', value: `${healthScore}%` },
      { label: 'Apontamentos', value: String(issues.length) },
      { label: 'Críticas', value: String(critCount) },
      { label: 'Alertas', value: String(warnCount) },
    ],
    sheets: [
      {
        sheetName: 'Diagnostico_BD',
        sectionTitle: 'Inconsistências e Verificações Estruturais',
        headers: [
          'Gravidade',
          'Categoria',
          'Turma',
          'Chamada',
          'Estudante',
          'Campo Afetado',
          'Valor Atual',
          'Valor Esperado',
          'Diagnóstico',
          'Ação Sugerida',
        ],
        rows: issues.map((i) => [
          i.severity.toUpperCase(),
          i.categoryLabel,
          i.className || 'Geral',
          i.studentNumber ? String(i.studentNumber) : '—',
          i.studentName || '—',
          i.affectedField,
          i.currentValue,
          i.expectedValue,
          i.description,
          i.suggestedAction,
        ]),
      },
    ],
  };
}

// 13. EDUCAÇÃO ESPECIAL / AEE (BANCO ATUAL OU LOTE .HTM IMPORTADO)
export function buildAeeDisabilitiesReport(params: {
  classes: ClassGroup[];
  importedPreviewRows?: {
    matchedStudentName?: string;
    rawName: string;
    matchedClassName?: string;
    rawTurma: string;
    matchedStudentRa?: string;
    rawRa: string;
    matchStatus: string;
    currentDeficiencia: string;
    editedDeficiencia: string;
  }[];
}): UniversalExportReport {
  const { classes, importedPreviewRows } = params;

  const baseAeeRows: (string | number)[][] = [];
  classes.forEach((cls) => {
    cls.students.forEach((st) => {
      if ((st.deficiencia || '').trim().length > 0) {
        baseAeeRows.push([
          cls.name,
          cls.shift.replace('Turno ', ''),
          String(st.number).padStart(2, '0'),
          st.name,
          st.ra ? `${st.ra}-${st.digRa || ''}` : '—',
          st.situacao || 'ATIVO',
          st.deficiencia || '—',
        ]);
      }
    });
  });

  const sheets: ExportSheetSection[] = [];

  if (importedPreviewRows && importedPreviewRows.length > 0) {
    sheets.push({
      sheetName: 'Previa_Importacao_HTM',
      sectionTitle: 'Registros Extraídos do Arquivo .HTM (SED)',
      headers: [
        'Estudante',
        'Turma',
        'RA',
        'Vínculo',
        'Atual no Banco',
        'Deficiência / AEE (.HTM)',
      ],
      rows: importedPreviewRows.map((r) => [
        r.matchedStudentName || r.rawName,
        r.matchedClassName || r.rawTurma || '—',
        r.matchedStudentRa || r.rawRa || '—',
        r.matchStatus === 'matched' ? 'Vinculado' : 'Sem vínculo',
        r.currentDeficiencia || '—',
        r.editedDeficiencia || 'Limpar registro',
      ]),
    });
  }

  sheets.push({
    sheetName: 'Estudantes_AEE_Banco',
    sectionTitle: 'Relação Nominal Atual de Estudantes em Educação Especial (AEE)',
    headers: ['Turma', 'Turno', 'Nº', 'Estudante', 'RA', 'Situação', 'Deficiência / AEE'],
    rows: baseAeeRows,
  });

  return {
    fileNameBase: 'Educacao_Especial_AEE_EMEB_Candelario_2027',
    title: 'Relatório Nominal de Educação Especial (AEE)',
    subtitle: `${baseAeeRows.length} estudante(s) registrados na base escolar`,
    orientation: 'landscape',
    summaryMetrics: [
      { label: 'Estudantes AEE (Base)', value: String(baseAeeRows.length) },
      ...(importedPreviewRows && importedPreviewRows.length > 0
        ? [{ label: 'Linhas .HTM Carregadas', value: String(importedPreviewRows.length) }]
        : []),
    ],
    sheets,
  };
}
