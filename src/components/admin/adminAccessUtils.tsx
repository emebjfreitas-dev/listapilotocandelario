import React from 'react';
import { Eye, HeartHandshake, ShieldCheck, Users } from 'lucide-react';
import { AuthorizedUser, UserRole } from '../../types';
import { isOfficialSchoolAdminEmail } from '../../services/db';

export type AccessLevelKey = 'admin' | 'usuario' | 'peb2' | 'aee';

export interface AccessLevelMeta {
  key: AccessLevelKey;
  shortLabel: string;
  badgeLabel: string;
  description: string;
  badgeClass: string;
  activeSegmentClass: string;
}

export const ACCESS_LEVEL_META: Record<AccessLevelKey, AccessLevelMeta> = {
  admin: {
    key: 'admin',
    shortLabel: 'ADMIN',
    badgeLabel: 'ADMIN',
    description: 'Acesso pleno e gestão',
    badgeClass: 'bg-[#0071E3] text-white',
    activeSegmentClass: 'bg-[#0071E3] text-white shadow-xs',
  },
  usuario: {
    key: 'usuario',
    shortLabel: 'PEB I',
    badgeLabel: 'PEB I (Usuário)',
    description: 'Regente · Sua turma',
    badgeClass: 'bg-[#EAF7EE] text-[#1B873F]',
    activeSegmentClass: 'bg-[#1B873F] text-white shadow-xs',
  },
  peb2: {
    key: 'peb2',
    shortLabel: 'PEB II',
    badgeLabel: 'PEB II (Visualização)',
    description: 'Especialista · Leitura',
    badgeClass: 'bg-[#0071E3]/10 text-[#0071E3]',
    activeSegmentClass: 'bg-[#0071E3] text-white shadow-xs',
  },
  aee: {
    key: 'aee',
    shortLabel: 'AEE',
    badgeLabel: 'AEE',
    description: 'Educação Especial · Leitura',
    badgeClass: 'bg-[#FFF5E5] text-[#B25000]',
    activeSegmentClass: 'bg-[#B25000] text-white shadow-xs',
  },
};

export const ACCESS_LEVEL_ORDER: AccessLevelKey[] = ['admin', 'usuario', 'peb2', 'aee'];
export const NEW_USER_LEVEL_ORDER: AccessLevelKey[] = ['usuario', 'peb2', 'aee'];

export interface MatrixDraft {
  teacherName: string;
  teacherPronoun: string;
  teacherFirstName: string;
  room: string;
  shift: 'Turno Manhã' | 'Turno Tarde';
  turmaSedName: string;
  classeSedCode: string;
  artTeacher: string;
  peTeacher: string;
  englishTeacher: string;
}

export interface DraftUserEdit {
  role: UserRole;
  accessLevel: AccessLevelKey;
  assignedClassId: string;
  assignedClassName: string;
  assignedClassIds: string[];
  assignedClassNames: string[];
}

export const normalizeSearchText = (value?: string): string =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export const resolveAccessLevel = (
  u: Pick<AuthorizedUser, 'email' | 'role' | 'teacherRoleType' | 'subjectName'>,
  draftLevel?: AccessLevelKey
): AccessLevelKey => {
  if (draftLevel) {
    if (draftLevel === 'admin' && !isOfficialSchoolAdminEmail(u.email)) {
      return 'usuario';
    }
    return draftLevel;
  }
  if (isOfficialSchoolAdminEmail(u.email)) {
    return 'admin';
  }
  if (
    u.teacherRoleType === 'aee' ||
    (u.subjectName || '').toUpperCase().includes('AEE') ||
    (u.subjectName || '').toUpperCase().includes('EDUCAÇÃO ESPECIAL')
  ) {
    return 'aee';
  }
  if (u.role === 'peb2' || u.teacherRoleType === 'apoio') {
    return 'peb2';
  }
  return 'usuario';
};

export const renderAccessLevelIcon = (level: AccessLevelKey, className = 'w-3 h-3 shrink-0') => {
  switch (level) {
    case 'admin':
      return <ShieldCheck className={className} />;
    case 'usuario':
      return <Users className={className} />;
    case 'peb2':
      return <Eye className={className} />;
    case 'aee':
      return <HeartHandshake className={className} />;
  }
};

interface ToggleSwitchProps {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  activeText: string;
  inactiveText: string;
  ariaLabel: string;
  activeColorClass?: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  disabled = false,
  onChange,
  activeText,
  inactiveText,
  ariaLabel,
  activeColorClass = 'bg-[#047857]',
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    disabled={disabled}
    onClick={onChange}
    className={`inline-flex items-center gap-2 text-left transition-opacity duration-100 ${
      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
    }`}
  >
    <span
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-150 ${
        checked ? activeColorClass : 'bg-[#d1d5db]'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow-xs transform transition-transform duration-150 ${
          checked ? 'translate-x-5.5' : 'translate-x-0.5'
        }`}
      />
    </span>
    <span
      className={`text-xs font-semibold whitespace-nowrap ${
        checked ? 'text-[#047857]' : 'text-[#991b1b]'
      }`}
    >
      {checked ? activeText : inactiveText}
    </span>
  </button>
);
