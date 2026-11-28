import rawStudentsJson from '../../public/lista_piloto_2027.json';
import { OFFICIAL_SCHOOL_MATRIX_2027 } from './officialMatrix2027';
import { Student } from '../types';
import { resolveStudentGender } from '../utils/genderDictionary';

export interface RawSedStudent {
  'TIPO DE ENSINO'?: string;
  'SÉRIE'?: string;
  'Nº CHAMADA'?: string | number;
  ESTUDANTE?: string;
  RA?: string;
  'DIG. RA'?: string;
  'UF RA'?: string;
  'DATA DE NASCIMENTO'?: string;
  'TIPO ALOCAÇÃO'?: string;
  'SITUAÇÃO'?: string;
  'DATA MOVIMENTAÇÃO'?: string;
  'CATEGORIA PROFISSIONAL CENSO'?: string;
  'DEFICIÊNCIA'?: string;
  'PÓS DATA CENSO'?: string;
  TURMA: string;
  PERÍODO?: string;
  'DATA DE MATRÍCULA (SED)'?: string;
  'PROCEDÊNCIA ESCOLAR'?: string;
  'IRMÃOS'?: string;
  IDADE?: string;
  ARQUIVO?: string;
  'FILIAÇÃO 1'?: string;
  'FILIAÇÃO 2'?: string;
  'NOME SOCIAL'?: string;
  GÊNERO?: string;
  'TIPO SANGUÍNEO'?: string;
  'RAÇA/COR'?: string;
  NACIONALIDADE?: string;
  'PAÍS DE ORIGEM'?: string;
  'MUNICÍPIO DE NASCIMENTO'?: string;
  CPF?: string;
  RG?: string;
  'DATA EMISSÃO RG'?: string;
  'CARTÃO SUS'?: string;
  NIS?: string;
  CEP?: string;
  LOGRADOURO?: string;
  'N. RESIDENCIA'?: string;
  COMPLEMENTO?: string;
  BAIRRO?: string;
  CIDADE?: string;
  UF?: string;
  TELEFONES?: string;
  'E-MAIL GOOGLE'?: string;
  'E-MAIL MICROSOFT'?: string;
  'EMAIL MUNICIPAL'?: string;
  'ROTA DE ÔNIBUS'?: string;
  'SUCESSÃO ESCOLAR'?: string;
  ESCOLA?: string;
  'DATA MATRÍCULA'?: string;
}

/**
 * Normaliza qualquer nomenclatura de turma da SED para o ID canônico das 40 turmas da EMEB Candelário
 */
export function resolveCanonicalClassId(turmaStr: string): string {
  const t = (turmaStr || '').trim().toUpperCase();

  // 1. Abreviações canônicas diretas do JSON oficial 2027 (ex: G4A -> g04a, 1A -> 1a)
  if (t.startsWith('G4') && t.length >= 3) {
    return 'g04' + t.slice(2).toLowerCase();
  }
  if (t.startsWith('G5') && t.length >= 3) {
    return 'g05' + t.slice(2).toLowerCase();
  }
  if (/^[1-5][A-G]$/.test(t)) {
    return t.toLowerCase();
  }

  // 2. Busca exata por turmaAbrev, id ou sedClassName
  const exact = OFFICIAL_SCHOOL_MATRIX_2027.find(
    (c) =>
      c.turmaAbrev.toUpperCase() === t ||
      c.id.toUpperCase() === t ||
      c.sedClassName.toUpperCase() === t
  );
  if (exact) return exact.id;

  const isManha = t.includes('MANHA') || t.includes('MANHÃ');

  // 3. Pré-escola G4 (1ª Etapa)
  if (t.includes('1ª ETAPA') || t.includes('PRÉ-ESCOLA 4') || t.includes('G4')) {
    if (t.includes('4A') || t.includes(' A ')) return 'g04a';
    if (t.includes('4B') || t.includes(' B ')) return isManha ? 'g04b' : 'g04d';
    if (t.includes('4C') || t.includes(' C ')) return isManha ? 'g04c' : 'g04d';
    if (t.includes('4D') || t.includes(' D ')) return 'g04d';
    if (t.includes('4E') || t.includes(' E ')) return 'g04e';
    return isManha ? 'g04a' : 'g04d';
  }

  // 4. Pré-escola G5 (2ª Etapa)
  if (t.includes('2ª ETAPA') || t.includes('PRÉ-ESCOLA 5') || t.includes('G5')) {
    if (t.includes('5A') || t.includes(' A ')) return 'g05a';
    if (t.includes('5B') || t.includes(' B ')) return 'g05b';
    if (t.includes('5C') || t.includes(' C ')) return isManha ? 'g05a' : 'g05c';
    if (t.includes('5D') || t.includes(' D ')) return 'g05d';
    if (t.includes('5E') || t.includes(' E ')) return 'g05e';
    return isManha ? 'g05a' : 'g05d';
  }

  // 5. 1º Ano
  if (t.includes('1° ANO') || t.includes('1º ANO')) {
    if (t.includes('1A') || t.includes(' A ')) return isManha ? '1a' : '1d';
    if (t.includes('1B') || t.includes(' B ')) return isManha ? '1b' : '1e';
    if (t.includes('1C') || t.includes(' C ')) return isManha ? '1c' : '1f';
    if (t.includes('1D') || t.includes(' D ')) return '1d';
    if (t.includes('1E') || t.includes(' E ')) return '1e';
    if (t.includes('1F') || t.includes(' F ')) return '1f';
    return isManha ? '1a' : '1d';
  }

  // 6. 2º Ano
  if (t.includes('2° ANO') || t.includes('2º ANO')) {
    if (t.includes('2A') || t.includes(' A ')) return isManha ? '2a' : '2d';
    if (t.includes('2B') || t.includes(' B ') || t.includes('BM')) return isManha ? '2b' : '2e';
    if (t.includes('2C') || t.includes(' C ')) return isManha ? '2c' : '2f';
    if (t.includes('2D') || t.includes(' D ')) return '2d';
    if (t.includes('2E') || t.includes(' E ')) return '2e';
    if (t.includes('2F') || t.includes(' F ')) return '2f';
    return isManha ? '2a' : '2d';
  }

  // 7. 3º Ano
  if (t.includes('3° ANO') || t.includes('3º ANO')) {
    if (t.includes('3A') || t.includes(' A ')) return isManha ? '3a' : '3d';
    if (t.includes('3B') || t.includes(' B ')) return isManha ? '3b' : '3e';
    if (t.includes('3C') || t.includes(' C ')) return isManha ? '3c' : '3f';
    if (t.includes('3D') || t.includes(' D ')) return '3d';
    if (t.includes('3E') || t.includes(' E ')) return '3e';
    if (t.includes('3F') || t.includes(' F ') || t.includes('FI')) return '3f';
    if (t.includes('3G') || t.includes(' G ')) return '3f';
    return isManha ? '3a' : '3d';
  }

  // 8. 4º Ano
  if (t.includes('4° ANO') || t.includes('4º ANO')) {
    if (t.includes('4A') || t.includes(' A ')) return isManha ? '4a' : '4d';
    if (t.includes('4B') || t.includes(' B ')) return isManha ? '4b' : '4e';
    if (t.includes('4C') || t.includes(' C ')) return isManha ? '4c' : '4f';
    if (t.includes('4D') || t.includes(' D ')) return '4d';
    if (t.includes('4E') || t.includes(' E ')) return '4e';
    if (t.includes('4F') || t.includes(' F ')) return '4f';
    if (t.includes('4G') || t.includes(' G ')) return '4g';
    return isManha ? '4a' : '4d';
  }

  // 9. 5º Ano
  if (t.includes('5° ANO') || t.includes('5º ANO')) {
    if (t.includes('5A') || t.includes(' A ')) return isManha ? '5a' : '5d';
    if (t.includes('5B') || t.includes(' B ')) return isManha ? '5b' : '5e';
    if (t.includes('5C') || t.includes(' C ') || t.includes('CM')) return isManha ? '5c' : '5e';
    if (t.includes('5D') || t.includes(' D ')) return '5d';
    if (t.includes('5E') || t.includes(' E ')) return '5e';
    return isManha ? '5a' : '5d';
  }

  return '1a';
}

/**
 * Mapeia todos os 1.050 alunos oficiais fornecidos pela matriz 2027 agrupados por ID canônico de turma
 */
export function buildOfficialSedStudentsMap(): Record<string, Student[]> {
  const rawList: RawSedStudent[] = rawStudentsJson as RawSedStudent[];
  const grouped: Record<string, RawSedStudent[]> = {};

  for (const item of rawList) {
    const classId = resolveCanonicalClassId(item.TURMA);
    if (!grouped[classId]) {
      grouped[classId] = [];
    }
    grouped[classId].push(item);
  }

  const result: Record<string, Student[]> = {};

  for (const matrixRow of OFFICIAL_SCHOOL_MATRIX_2027) {
    const classId = matrixRow.id;
    const rawItems = grouped[classId] || [];

    // Ordenação por número de chamada oficial ou alfabética
    const sorted = [...rawItems].sort((a, b) => {
      const numA = Number(a['Nº CHAMADA']) || 999;
      const numB = Number(b['Nº CHAMADA']) || 999;
      if (numA !== numB) return numA - numB;
      return (a.ESTUDANTE || '').localeCompare(b.ESTUDANTE || '', 'pt-BR');
    });

    const isInfantil =
      matrixRow.turmaAbrev.startsWith('G4') || matrixRow.turmaAbrev.startsWith('G5');

    result[classId] = sorted.map((item, index) => {
      const studentName = (item.ESTUDANTE || '').trim().toUpperCase();
      const rawRa = (item.RA || '').trim();
      let cleanRaOnly = rawRa.replace(/\D/g, '');
      let digRa = (item['DIG. RA'] || '').trim();
      if (!digRa && rawRa.includes('-')) {
        const [basePart, digPart] = rawRa.split('-');
        cleanRaOnly = (basePart || '').replace(/\D/g, '');
        digRa = (digPart || '').trim();
      }
      const rawSituacao = (item['SITUAÇÃO'] || 'ATIVO').trim().toUpperCase();
      const isAtivo = rawSituacao === '' || rawSituacao === 'ATIVO';
      const nameParts = studentName.split(/\s+/).filter(Boolean);
      const initials =
        nameParts.length >= 2
          ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`
          : studentName.slice(0, 2);

      const parsedNumber = Number(item['Nº CHAMADA']) || index + 1;
      const filiacao1 = (item['FILIAÇÃO 1'] || '').trim();
      const filiacao2 = (item['FILIAÇÃO 2'] || '').trim();
      const guardianName = filiacao1 || filiacao2 || '';
      const telefones = (item.TELEFONES || '').trim();

      return {
        id: `sed-${classId}-${cleanRaOnly || parsedNumber}`,
        number: parsedNumber,
        numeroChamada: parsedNumber,
        name: studentName,
        estudante: studentName,
        ra: cleanRaOnly,
        digRa,
        ufRa: (item['UF RA'] || 'SP').trim(),
        dataNascimento: (item['DATA DE NASCIMENTO'] || '').trim(),
        tipoAlocacao: (item['TIPO ALOCAÇÃO'] || '').trim(),
        situacao: isAtivo ? 'ATIVO' : rawSituacao,
        dataMovimentacao: (item['DATA MOVIMENTAÇÃO'] || '').trim(),
        categoriaProfissionalCenso: (item['CATEGORIA PROFISSIONAL CENSO'] || '').trim(),
        deficiencia: (item['DEFICIÊNCIA'] || '').trim(),
        posDataCenso: (item['PÓS DATA CENSO'] || '').trim(),
        turma: matrixRow.turmaAbrev,
        periodo: (item.PERÍODO || matrixRow.periodo).trim(),
        tipoEnsino: (item['TIPO DE ENSINO'] || (isInfantil ? 'EDUCACAO INFANTIL' : 'ENSINO FUNDAMENTAL')).trim(),
        serie: (item['SÉRIE'] || matrixRow.name).trim(),
        dataMatriculaSed: (item['DATA DE MATRÍCULA (SED)'] || item['DATA MATRÍCULA'] || '10/02/2027').trim(),
        procedenciaEscolar: (item['PROCEDÊNCIA ESCOLAR'] || item.ESCOLA || '').trim(),
        irmaos: (item.IRMÃOS || '').trim(),
        idade: (item.IDADE || '').trim(),
        arquivo: (item.ARQUIVO || '').trim(),
        filiacao1,
        filiacao2,
        nomeSocial: (item['NOME SOCIAL'] || '').trim(),
        genero: (item.GÊNERO || resolveStudentGender({ name: studentName, estudante: studentName })).trim(),
        tipoSanguineo: (item['TIPO SANGUÍNEO'] || '').trim(),
        racaCor: (item['RAÇA/COR'] || '').trim(),
        nacionalidade: (item.NACIONALIDADE || 'BRASILEIRA').trim(),
        paisOrigem: (item['PAÍS DE ORIGEM'] || '').trim(),
        municipioNascimento: (item['MUNICÍPIO DE NASCIMENTO'] || '').trim(),
        cpf: (item.CPF || '').trim(),
        rg: (item.RG || '').trim(),
        dataEmissaoRg: (item['DATA EMISSÃO RG'] || '').trim(),
        cartaoSus: (item['CARTÃO SUS'] || '').trim(),
        nis: (item.NIS || '').trim(),
        cep: (item.CEP || '').trim(),
        logradouro: (item.LOGRADOURO || '').trim(),
        numeroResidencia: (item['N. RESIDENCIA'] || '').trim(),
        complemento: (item.COMPLEMENTO || '').trim(),
        bairro: (item.BAIRRO || '').trim(),
        cidade: (item.CIDADE || 'JUNDIAI').trim(),
        uf: (item.UF || 'SP').trim(),
        telefones,
        emailGoogle: (item['E-MAIL GOOGLE'] || '').trim(),
        emailMicrosoft: (item['E-MAIL MICROSOFT'] || '').trim(),
        emailMunicipal: (item['EMAIL MUNICIPAL'] || '').trim(),
        sucessaoEscolar: (item['SUCESSÃO ESCOLAR'] || '').trim(),
        guardianName,
        guardianPhone: telefones,
        status: isAtivo ? ('present' as const) : ('absent' as const),
        classesHeld: 20,
        classesAttended: isAtivo ? 19 : 0,
        absences: isAtivo ? 1 : 20,
        totalAbsencesMonth: isAtivo ? 1 : 20,
        attendanceRate: isAtivo ? 95 : 0,
        consecutiveAbsences: 0,
        active: isAtivo,
        initials,
        schoolDaysCount: 20,
        hasPhoto: false,
        hasScannedPdf: false,
      };
    });
  }

  return result;
}

export const OFFICIAL_SED_STUDENTS_MAP = buildOfficialSedStudentsMap();

