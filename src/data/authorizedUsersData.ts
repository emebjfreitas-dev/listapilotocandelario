import type { AuthorizedUser } from '../types/index.ts';
import { OFFICIAL_SCHOOL_MATRIX_2027 } from './officialMatrix2027.ts';

export const CITY_NAME = 'Prefeitura do Município de Jundiaí';
export const SECRETARY_NAME = 'SME · Secretaria Municipal de Educação de Jundiaí';
export const SCHOOL_NAME = 'EMEB Professor Joaquim Candelário de Freitas';
export const INSTITUTIONAL_EMAIL_DOMAIN = '@educacao.jundiai.sp.gov.br';

export const formatDisplayNameFromEmail = (email: string): string => {
  const prefix = email.split('@')[0] || '';
  if (prefix === 'emebjfreitas') {
    return 'Equipe Administrativa';
  }
  return prefix
    .replace(/\d+/g, '')
    .split('.')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};

export const OFFICIAL_WHITELISTED_EMAILS: string[] = [
  'emebjfreitas@jundiai.sp.gov.br',
  'emebjfreitas@educacao.jundiai.sp.gov.br',
  'acacia.silva@educacao.jundiai.sp.gov.br',
  'adilia.lourdes@educacao.jundiai.sp.gov.br',
  'alessandra.costa@educacao.jundiai.sp.gov.br',
  'aline.araujo@educacao.jundiai.sp.gov.br',
  'amanda.storani@educacao.jundiai.sp.gov.br',
  'ana.alvares@educacao.jundiai.sp.gov.br',
  'ana.araujo19@educacao.jundiai.sp.gov.br',
  'ana.boas@educacao.jundiai.sp.gov.br',
  'ana.hermann@educacao.jundiai.sp.gov.br',
  'ana.prado@educacao.jundiai.sp.gov.br',
  'barbara.lima@educacao.jundiai.sp.gov.br',
  'beatriz.silva09@educacao.jundiai.sp.gov.br',
  'bianca.macedo@educacao.jundiai.sp.gov.br',
  'bruna.maximiano@educacao.jundiai.sp.gov.br',
  'camilo.lisboa@educacao.jundiai.sp.gov.br',
  'carol.silva@educacao.jundiai.sp.gov.br',
  'caroline.oliveira@educacao.jundiai.sp.gov.br',
  'cleonice.batistela@educacao.jundiai.sp.gov.br',
  'denis.braz@educacao.jundiai.sp.gov.br',
  'denise.nicolau@educacao.jundiai.sp.gov.br',
  'edmar.vinicius@educacao.jundiai.sp.gov.br',
  'elaine.netto@educacao.jundiai.sp.gov.br',
  'elaine.silva13@educacao.jundiai.sp.gov.br',
  'erika.mori@educacao.jundiai.sp.gov.br',
  'fabio.santos@educacao.jundiai.sp.gov.br',
  'fernanda.aranha@educacao.jundiai.sp.gov.br',
  'fernanda.borges@educacao.jundiai.sp.gov.br',
  'gesica.piccolo@educacao.jundiai.sp.gov.br',
  'giovana.rampin@educacao.jundiai.sp.gov.br',
  'giovanna.ferreira@educacao.jundiai.sp.gov.br',
  'giulia.patez@educacao.jundiai.sp.gov.br',
  'helena.ferraz@educacao.jundiai.sp.gov.br',
  'iara.villela@educacao.jundiai.sp.gov.br',
  'isabel.zanchin@educacao.jundiai.sp.gov.br',
  'isabella.correa@educacao.jundiai.sp.gov.br',
  'joana.leopoldino@educacao.jundiai.sp.gov.br',
  'karen.merlim@educacao.jundiai.sp.gov.br',
  'karina.trientini@educacao.jundiai.sp.gov.br',
  'layla.rocha@educacao.jundiai.sp.gov.br',
  'liana.poiani@educacao.jundiai.sp.gov.br',
  'lilian.gomes@educacao.jundiai.sp.gov.br',
  'lilian.rizzi@educacao.jundiai.sp.gov.br',
  'luana.mezavila@educacao.jundiai.sp.gov.br',
  'lucimeire.perobelli@educacao.jundiai.sp.gov.br',
  'luiza.kabata@educacao.jundiai.sp.gov.br',
  'lygea.ramos@educacao.jundiai.sp.gov.br',
  'marcelo.aguiar@educacao.jundiai.sp.gov.br',
  'marcos.fernandes@educacao.jundiai.sp.gov.br',
  'maria.almeida16@educacao.jundiai.sp.gov.br',
  'maria.ferreira@educacao.jundiai.sp.gov.br',
  'maria.julia@educacao.jundiai.sp.gov.br',
  'mariana.cristina@educacao.jundiai.sp.gov.br',
  'mariane.santos@educacao.jundiai.sp.gov.br',
  'marina.petraquim@educacao.jundiai.sp.gov.br',
  'monica.iamonti@educacao.jundiai.sp.gov.br',
  'patricia.araujo@educacao.jundiai.sp.gov.br',
  'pedro.rosa@educacao.jundiai.sp.gov.br',
  'priscila.damasceno@educacao.jundiai.sp.gov.br',
  'rafaela.gobbi@educacao.jundiai.sp.gov.br',
  'rita.aparecida@educacao.jundiai.sp.gov.br',
  'roberta.saldanha@educacao.jundiai.sp.gov.br',
  'rosangela.paula@educacao.jundiai.sp.gov.br',
  'sandra.furlan@educacao.jundiai.sp.gov.br',
  'silvia.aguiar@educacao.jundiai.sp.gov.br',
  'silvia.restino@educacao.jundiai.sp.gov.br',
  'simone.souza@educacao.jundiai.sp.gov.br',
  'sophia.zaros@educacao.jundiai.sp.gov.br',
  'stella.ferrari@educacao.jundiai.sp.gov.br',
  'tais.buzetto@educacao.jundiai.sp.gov.br',
  'vanessa.santos@educacao.jundiai.sp.gov.br',
  'viviane.guidi@educacao.jundiai.sp.gov.br',
  'yuri.nicholas@educacao.jundiai.sp.gov.br',
];

export const PEB2_SPECIALISTS_BY_EMAIL: Record<
  string,
  {
    fullName: string;
    firstName: string;
    pronoun: string;
    subject: 'ARTE' | 'EDUCAÇÃO FÍSICA' | 'LÍNGUA INGLESA';
  }
> = {
  'yuri.nicholas@educacao.jundiai.sp.gov.br': {
    fullName: 'YURI NICHOLAS TOFFANETTO',
    firstName: 'YURI NICHOLAS',
    pronoun: 'PROFESSOR',
    subject: 'ARTE',
  },
  'sophia.zaros@educacao.jundiai.sp.gov.br': {
    fullName: 'SOPHIA WOLF ZAROS',
    firstName: 'SOPHIA',
    pronoun: 'PROFESSORA',
    subject: 'ARTE',
  },
  'stella.ferrari@educacao.jundiai.sp.gov.br': {
    fullName: 'STELLA MARIS PRADO COSTA FERRARI',
    firstName: 'STELLA MARIS',
    pronoun: 'PROFESSORA',
    subject: 'EDUCAÇÃO FÍSICA',
  },
  'acacia.silva@educacao.jundiai.sp.gov.br': {
    fullName: 'ACÁCIA FERNANDES DE ALBUQUERQUE DA SILVA',
    firstName: 'ACÁCIA',
    pronoun: 'PROFESSORA',
    subject: 'EDUCAÇÃO FÍSICA',
  },
  'pedro.rosa@educacao.jundiai.sp.gov.br': {
    fullName: 'PEDRO HENRIQUE DA ROSA',
    firstName: 'PEDRO HENRIQUE',
    pronoun: 'PROFESSOR',
    subject: 'EDUCAÇÃO FÍSICA',
  },
  'fernanda.aranha@educacao.jundiai.sp.gov.br': {
    fullName: 'FERNANDA MIHO WATANABE ARANHA',
    firstName: 'FERNANDA MIHO',
    pronoun: 'PROFESSORA',
    subject: 'EDUCAÇÃO FÍSICA',
  },
  'elaine.silva13@educacao.jundiai.sp.gov.br': {
    fullName: 'ELAINE CRISTINA DA SILVA',
    firstName: 'ELAINE CRISTINA',
    pronoun: 'PROFESSORA',
    subject: 'LÍNGUA INGLESA',
  },
  'giovanna.ferreira@educacao.jundiai.sp.gov.br': {
    fullName: 'GIOVANNA CHAGAS FERREIRA',
    firstName: 'GIOVANNA',
    pronoun: 'PROFESSORA',
    subject: 'LÍNGUA INGLESA',
  },
  'lygea.ramos@educacao.jundiai.sp.gov.br': {
    fullName: 'LYGEA DE SOUZA RAMOS',
    firstName: 'LYGEA',
    pronoun: 'PROFESSORA',
    subject: 'LÍNGUA INGLESA',
  },
  'alessandra.costa@educacao.jundiai.sp.gov.br': {
    fullName: 'ALESSANDRA ISCARO COSTA',
    firstName: 'ALESSANDRA',
    pronoun: 'PROFESSORA',
    subject: 'LÍNGUA INGLESA',
  },
};

export const INITIAL_AUTHORIZED_USERS: AuthorizedUser[] = Array.from(
  new Set(OFFICIAL_WHITELISTED_EMAILS.map((e) => e.trim().toLowerCase()))
).map((email, idx) => {
  const isAdminAccount = email.startsWith('emebjfreitas@');
  if (isAdminAccount) {
    return {
      id: `usr-official-${idx + 1}`,
      email,
      name: formatDisplayNameFromEmail(email),
      role: 'admin',
      teacherRoleType: 'admin',
      pronoun: 'DIREÇÃO',
      firstName: 'DIREÇÃO',
      subjectName: 'GESTÃO / ADMIN',
      assignedClassId: 'all',
      assignedClassIds: ['all'],
      assignedClassName: 'Todas as 40 Turmas (Acesso Pleno)',
      assignedClassNames: ['Todas as 40 Turmas (Acesso Pleno)'],
      active: true,
      createdAt: '02/02/2027',
    };
  }

  // 1) Check if this email is a Regente PEB I in OFFICIAL_SCHOOL_MATRIX_2027
  const regenteMatches = OFFICIAL_SCHOOL_MATRIX_2027.filter(
    (m) => m.teacherEmail.trim().toLowerCase() === email
  );
  if (regenteMatches.length > 0) {
    const primary = regenteMatches[0];
    const classIds = regenteMatches.map((m) => m.id);
    const classNames = regenteMatches.map(
      (m) => `${m.name} (${m.periodo === 'MANHÃ' ? 'Manhã' : 'Tarde'})`
    );
    return {
      id: `usr-official-${idx + 1}`,
      email,
      name: `${primary.pronoun === 'PROFESSOR' ? 'Prof.' : 'Profª.'} ${primary.teacherName}`,
      role: 'usuario',
      teacherRoleType: 'peb1',
      pronoun: primary.pronoun,
      firstName: primary.teacherFirstName,
      subjectName: 'REGENTE PEB I',
      assignedClassId: primary.id,
      assignedClassIds: classIds,
      assignedClassName: classNames.join(' + '),
      assignedClassNames: classNames,
      active: true,
      createdAt: '03/02/2027',
    };
  }

  // 2) Check if this email is an official PEB II Specialist (Arte, Educação Física, Língua Inglesa)
  const specialist = PEB2_SPECIALISTS_BY_EMAIL[email];
  if (specialist) {
    const specialistClasses = OFFICIAL_SCHOOL_MATRIX_2027.filter(
      (m) =>
        m.artTeacher === specialist.fullName ||
        m.peTeacher === specialist.fullName ||
        m.englishTeacher === specialist.fullName
    );
    const abrevList = specialistClasses.map((m) => m.turmaAbrev).join(', ');
    return {
      id: `usr-official-${idx + 1}`,
      email,
      name: `${specialist.pronoun === 'PROFESSOR' ? 'Prof.' : 'Profª.'} ${specialist.fullName}`,
      role: 'peb2',
      teacherRoleType: 'peb2',
      pronoun: specialist.pronoun,
      firstName: specialist.firstName,
      subjectName: specialist.subject,
      assignedClassId: 'all',
      assignedClassIds: ['all'],
      assignedClassName: `PEB II (${specialist.subject}) • ${specialistClasses.length} Turmas (${abrevList})`,
      assignedClassNames: [`PEB II (${specialist.subject})`],
      active: true,
      createdAt: '03/02/2027',
    };
  }

  // 3) Remaining authorized institutional educators (Equipe Pedagógica / Apoio / PEB II)
  return {
    id: `usr-official-${idx + 1}`,
    email,
    name: `Prof(a). ${formatDisplayNameFromEmail(email).toUpperCase()}`,
    role: 'peb2',
    teacherRoleType: 'apoio',
    pronoun: 'PROFESSOR(A)',
    firstName: formatDisplayNameFromEmail(email).split(' ')[0]?.toUpperCase() || 'DOCENTE',
    assignedClassId: 'all',
    assignedClassIds: ['all'],
    assignedClassName: 'Todas as Turmas (Consulta / Apoio Pedagógico)',
    assignedClassNames: ['Todas as Turmas (Consulta / Apoio Pedagógico)'],
    active: true,
    createdAt: '03/02/2027',
  };
});
