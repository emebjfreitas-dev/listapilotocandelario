import React from 'react';
import {
  CalendarClock,
  Edit3,
  Eye,
  Plus,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { AuthorizedUser, ClassGroup } from '../../types';
import { INSTITUTIONAL_EMAIL_DOMAIN } from '../../data/mockData';
import {
  formatAccessExpirationDateBR,
  formatDurationHuman,
  isOfficialSchoolAdminEmail,
  isUserAccessEffectivelyActive,
  isUserAccessExpired,
} from '../../services/db';
import { exportUniversalReport } from '../../utils/universalExport';
import { buildAuthorizedUsersReport } from '../../utils/reportBuilders';
import { CustomSelect } from '../CustomSelect';
import { ExportFormatButton } from '../ui/ExportFormatButton';
import { PaginationBar } from '../ui/PaginationBar';
import {
  ACCESS_LEVEL_META,
  ACCESS_LEVEL_ORDER,
  AccessLevelKey,
  DraftUserEdit,
  NEW_USER_LEVEL_ORDER,
  ToggleSwitch,
  renderAccessLevelIcon,
  resolveAccessLevel,
} from './adminAccessUtils';

interface AdminContasAcessoTabProps {
  authorizedUsers: AuthorizedUser[];
  filteredUsers: AuthorizedUser[];
  visibleFilteredUsers: AuthorizedUser[];
  classes: ClassGroup[];
  canManage: boolean;
  usersPage: number;
  pageSize: number;
  searchTerm: string;
  roleFilter: 'all' | AccessLevelKey;
  statusFilter: 'all' | 'active' | 'blocked' | 'temporary' | 'expired';
  userSortBy: 'default' | 'name_asc' | 'email_asc' | 'access_desc';
  onlyAccessedFilter: boolean;
  hasActiveUserFilters: boolean;
  activeUsersCount: number;
  blockedUsersCount: number;
  temporaryUsersCount: number;
  expiredUsersCount: number;
  adminCount: number;
  peb1Count: number;
  peb2Count: number;
  aeeCount: number;
  totalUsersWhoAccessed: number;
  showAddUserForm: boolean;
  emailPrefix: string;
  name: string;
  newAccessLevel: AccessLevelKey;
  assignedClassId: string;
  newExpirationDate: string;
  draftEdits: Record<string, DraftUserEdit>;
  recentlySavedUserIds: Record<string, boolean>;
  onChangeSearchTerm: (val: string) => void;
  onChangeRoleFilter: (val: 'all' | AccessLevelKey) => void;
  onChangeStatusFilter: (val: 'all' | 'active' | 'blocked' | 'temporary' | 'expired') => void;
  onChangeUserSortBy: (val: 'default' | 'name_asc' | 'email_asc' | 'access_desc') => void;
  onToggleOnlyAccessedFilter: () => void;
  onResetUserFilters: () => void;
  onChangeUsersPage: (page: number) => void;
  onToggleShowAddForm: () => void;
  onChangeEmailPrefix: (val: string) => void;
  onChangeName: (val: string) => void;
  onChangeNewAccessLevel: (val: AccessLevelKey) => void;
  onChangeAssignedClassId: (val: string) => void;
  onChangeNewExpirationDate: (val: string) => void;
  onAddUser: (e: React.FormEvent) => void;
  onToggleActive: (userId: string) => void;
  onSelectAccessLevel: (userId: string, level: AccessLevelKey) => void;
  onUpdateUserExpiration: (userId: string, date: string) => void;
  onOpenAssignModal: (userId: string) => void;
  onRemoveUser: (user: AuthorizedUser) => void;
  onSimulateTeacherProfile?: (teacher: AuthorizedUser) => void;
  onFeedback: (type: 'success' | 'error', text: string) => void;
}

export const AdminContasAcessoTab: React.FC<AdminContasAcessoTabProps> = ({
  authorizedUsers,
  filteredUsers,
  visibleFilteredUsers,
  classes,
  canManage,
  usersPage,
  pageSize,
  searchTerm,
  roleFilter,
  statusFilter,
  userSortBy,
  onlyAccessedFilter,
  hasActiveUserFilters,
  activeUsersCount,
  blockedUsersCount,
  temporaryUsersCount,
  expiredUsersCount,
  adminCount,
  peb1Count,
  peb2Count,
  aeeCount,
  totalUsersWhoAccessed,
  showAddUserForm,
  emailPrefix,
  name,
  newAccessLevel,
  assignedClassId,
  newExpirationDate,
  draftEdits,
  recentlySavedUserIds,
  onChangeSearchTerm,
  onChangeRoleFilter,
  onChangeStatusFilter,
  onChangeUserSortBy,
  onToggleOnlyAccessedFilter,
  onResetUserFilters,
  onChangeUsersPage,
  onToggleShowAddForm,
  onChangeEmailPrefix,
  onChangeName,
  onChangeNewAccessLevel,
  onChangeAssignedClassId,
  onChangeNewExpirationDate,
  onAddUser,
  onToggleActive,
  onSelectAccessLevel,
  onUpdateUserExpiration,
  onOpenAssignModal,
  onRemoveUser,
  onSimulateTeacherProfile,
  onFeedback,
}) => {
  return (
    <div className="space-y-4">
      <section className="bg-white rounded-3xl p-4 sm:p-5 border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-4">
        <div className="space-y-3">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-700 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => onChangeSearchTerm(e.target.value)}
                aria-label="Buscar usuários autorizados por nome, e-mail ou turma"
                placeholder="Buscar servidor por nome, e-mail (@educacao.jundiai...), disciplina ou turma..."
                className="w-full min-h-[44px] pl-10 pr-10 rounded-2xl bg-[#f3f6fb] focus:bg-white text-sm text-slate-950 placeholder:text-slate-600 transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => onChangeSearchTerm('')}
                  aria-label="Limpar busca de usuários"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-700 hover:text-slate-950 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div
                role="group"
                aria-label="Filtrar por status de acesso"
                className="inline-flex flex-wrap items-center p-1 rounded-xl bg-[#f3f6fb] gap-1"
              >
                {(
                  [
                    { id: 'all', label: `Todos (${authorizedUsers.length})` },
                    { id: 'active', label: `Liberados (${activeUsersCount})` },
                    { id: 'blocked', label: `Bloqueados (${blockedUsersCount})` },
                    { id: 'temporary', label: `Temporários (${temporaryUsersCount})` },
                    { id: 'expired', label: `Expirados (${expiredUsersCount})` },
                  ] as const
                ).map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => onChangeStatusFilter(st.id)}
                    className={`min-h-[34px] px-2.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                      statusFilter === st.id
                        ? st.id === 'blocked' || st.id === 'expired'
                          ? 'bg-[#991b1b] text-white shadow-2xs'
                          : st.id === 'temporary'
                          ? 'bg-[#b45309] text-white shadow-2xs'
                          : st.id === 'active'
                          ? 'bg-[#047857] text-white shadow-2xs'
                          : 'bg-white text-slate-950 shadow-2xs'
                        : 'text-slate-700 hover:text-slate-950'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              <CustomSelect
                value={userSortBy}
                onChange={(val) =>
                  onChangeUserSortBy(
                    val as 'default' | 'name_asc' | 'email_asc' | 'access_desc'
                  )
                }
                ariaLabel="Ordenar lista de usuários"
                className="min-h-[42px] bg-[#f3f6fb] text-xs font-semibold text-[#0f172a]"
                options={[
                  { value: 'default', label: 'Ordem padrão' },
                  { value: 'name_asc', label: 'Nome (A–Z)' },
                  { value: 'email_asc', label: 'E-mail (A–Z)' },
                  { value: 'access_desc', label: 'Mais acessos' },
                ]}
              />

              <ExportFormatButton
                label="Exportar Contas"
                variant="secondary"
                disabled={filteredUsers.length === 0}
                onExport={async (format) => {
                  const filterLabel =
                    roleFilter === 'all'
                      ? `Todos os perfis (${statusFilter})`
                      : `Perfil ${roleFilter.toUpperCase()} (${statusFilter})`;
                  const report = buildAuthorizedUsersReport(filteredUsers, filterLabel);
                  const fileName = await exportUniversalReport(report, format);
                  onFeedback('success', `Relação de contas ${fileName} baixada.`);
                }}
              />

              {canManage && (
                <button
                  type="button"
                  onClick={onToggleShowAddForm}
                  className="min-h-[42px] px-4 rounded-2xl bg-[#047857] hover:bg-[#065f46] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0 transition-colors duration-100"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{showAddUserForm ? 'Fechar Cadastro' : 'Novo E-mail'}</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  {
                    id: 'all',
                    label: `Todos (${authorizedUsers.length})`,
                    activeClass: 'bg-[#14428c] text-white font-semibold',
                  },
                  {
                    id: 'admin',
                    label: `ADMIN (${adminCount})`,
                    activeClass: 'bg-[#14428c] text-white font-semibold',
                  },
                  {
                    id: 'usuario',
                    label: `PEB I · Usuário (${peb1Count})`,
                    activeClass: 'bg-[#047857] text-white font-semibold',
                  },
                  {
                    id: 'peb2',
                    label: `PEB II · Visualização (${peb2Count})`,
                    activeClass: 'bg-[#14428c] text-white font-semibold',
                  },
                  {
                    id: 'aee',
                    label: `AEE (${aeeCount})`,
                    activeClass: 'bg-[#b45309] text-white font-semibold',
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onChangeRoleFilter(tab.id)}
                  className={`min-h-[36px] px-3 rounded-xl text-xs font-medium cursor-pointer transition-colors duration-100 ${
                    roleFilter === tab.id
                      ? tab.activeClass
                      : 'bg-[#f3f6fb] text-[#334155] hover:bg-[#dfe8f4]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}

              <div className="px-3 py-1.5 rounded-xl bg-[#f3f6fb] inline-flex items-center">
                <ToggleSwitch
                  checked={onlyAccessedFilter}
                  onChange={onToggleOnlyAccessedFilter}
                  activeText={`Já acessaram (${totalUsersWhoAccessed})`}
                  inactiveText={`Somente quem acessou (${totalUsersWhoAccessed})`}
                  ariaLabel="Filtrar contas que já acessaram"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-700 tabular-nums shrink-0">
              <span>
                Exibindo <strong className="text-slate-950">{filteredUsers.length}</strong> de{' '}
                <strong className="text-slate-950">{authorizedUsers.length}</strong> contas
              </span>
              {hasActiveUserFilters && (
                <button
                  type="button"
                  onClick={onResetUserFilters}
                  className="px-2.5 py-1 rounded-lg bg-[#eef3f9] hover:bg-[#e8f0fe] text-[#14428c] font-semibold cursor-pointer transition-colors"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Legenda dos 4 Níveis */}
        <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-slate-700">
          <span className="font-semibold text-slate-950">Níveis:</span>
          {ACCESS_LEVEL_ORDER.map((lvl) => {
            const meta = ACCESS_LEVEL_META[lvl];
            return (
              <span key={lvl} className="inline-flex items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold ${meta.badgeClass}`}
                >
                  {renderAccessLevelIcon(lvl)}
                  <span>{meta.badgeLabel}</span>
                </span>
                <span className="hidden sm:inline">{meta.description}</span>
              </span>
            );
          })}
        </div>

        {/* Formulário Expansível de Cadastro */}
        {canManage && showAddUserForm && (
          <form
            onSubmit={onAddUser}
            className="p-4 rounded-2xl bg-[#eef3f9] space-y-3 animate-gentle-fade"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-950 break-words">
                Liberar Novo E-mail Institucional ({INSTITUTIONAL_EMAIL_DOMAIN})
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-3 items-end">
              <div className="xl:col-span-3 space-y-1">
                <label className="block text-xs font-medium text-slate-700">
                  E-mail institucional
                </label>
                <div className="flex items-center rounded-xl bg-white overflow-hidden">
                  <input
                    type="text"
                    required
                    value={emailPrefix}
                    onChange={(e) => onChangeEmailPrefix(e.target.value)}
                    placeholder="nome.sobrenome"
                    className="w-full min-h-[42px] px-3 bg-transparent text-slate-950 placeholder:text-slate-600 text-sm min-w-0"
                  />
                  {!emailPrefix.includes('@') && (
                    <span className="px-2.5 py-2 bg-[#dfe8f4] text-slate-800 text-xs font-medium shrink-0">
                      {INSTITUTIONAL_EMAIL_DOMAIN}
                    </span>
                  )}
                </div>
              </div>

              <div className="xl:col-span-3 space-y-1">
                <label className="block text-xs font-medium text-slate-700">
                  Nome completo
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => onChangeName(e.target.value)}
                  placeholder="Ex: Maria Aparecida da Silva"
                  className="w-full min-h-[42px] px-3 rounded-xl bg-white text-slate-950 placeholder:text-slate-600 text-sm"
                />
              </div>

              <div className="xl:col-span-3 space-y-1">
                <label className="block text-xs font-medium text-slate-700">
                  Nível de Permissão (Docente / Equipe)
                </label>
                <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white">
                  {NEW_USER_LEVEL_ORDER.map((lvl) => {
                    const meta = ACCESS_LEVEL_META[lvl];
                    const isSelected = newAccessLevel === lvl;
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => onChangeNewAccessLevel(lvl)}
                        className={`min-w-0 min-h-[38px] px-2 py-1 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer transition-colors duration-100 whitespace-normal text-center ${
                          isSelected
                            ? meta.activeSegmentClass
                            : 'text-slate-800 hover:bg-[#eef3f9]'
                        }`}
                      >
                        {renderAccessLevelIcon(lvl)}
                        <span>{meta.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="xl:col-span-2 space-y-1">
                <label className="block text-xs font-medium text-slate-700">
                  Turma vinculada
                </label>
                {newAccessLevel === 'usuario' ? (
                  <CustomSelect
                    value={assignedClassId}
                    onChange={onChangeAssignedClassId}
                    ariaLabel="Turma vinculada"
                    searchPlaceholder="Buscar turma..."
                    className="w-full min-h-[42px] bg-[#ecfdf5] hover:bg-[#d1fae5] text-[#047857] text-xs font-semibold"
                    options={classes.map((cls) => ({
                      value: cls.id,
                      label: `${cls.name} (${cls.shift.replace('Turno ', '')})`,
                    }))}
                  />
                ) : (
                  <div className="min-h-[42px] px-3 rounded-xl bg-white text-slate-700 text-xs flex items-center">
                    {ACCESS_LEVEL_META[newAccessLevel].description}
                  </div>
                )}
              </div>

              <div className="xl:col-span-1">
                <button
                  type="submit"
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#047857] hover:bg-[#065f46] text-white font-semibold text-xs inline-flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Salvar</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 pt-1">
              <label
                htmlFor="new-user-expiration-date"
                className="text-xs font-medium text-slate-700 inline-flex items-center gap-1.5 shrink-0"
              >
                <CalendarClock className="w-3.5 h-3.5 text-slate-700" />
                <span>Data de expiração (opcional para temporários):</span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="new-user-expiration-date"
                  type="date"
                  value={newExpirationDate}
                  onChange={(e) => onChangeNewExpirationDate(e.target.value)}
                  className="min-h-[38px] px-3 rounded-xl bg-white text-xs font-medium text-slate-950 tabular-nums"
                />
                {newExpirationDate && (
                  <button
                    type="button"
                    onClick={() => onChangeNewExpirationDate('')}
                    className="min-h-[34px] px-2.5 rounded-lg bg-white text-xs font-semibold text-slate-700 hover:text-slate-950 cursor-pointer"
                  >
                    Limpar data (Permanente)
                  </button>
                )}
                <span className="text-xs text-slate-700">
                  {newExpirationDate
                    ? `Acesso será revogado automaticamente após ${formatAccessExpirationDateBR(
                        newExpirationDate
                      )}.`
                    : 'Deixe em branco para acesso permanente.'}
                </span>
              </div>
            </div>
          </form>
        )}

        {filteredUsers.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#f3f6fb] text-center space-y-2.5">
            <p className="text-sm font-semibold text-slate-950">
              Nenhuma conta encontrada para os critérios informados.
            </p>
            <p className="text-xs text-slate-700">
              Verifique a grafia do nome ou e-mail, ou limpe os filtros ativos.
            </p>
            {hasActiveUserFilters && (
              <button
                type="button"
                onClick={onResetUserFilters}
                className="min-h-[38px] px-4 rounded-xl bg-[#14428c] hover:bg-[#0f3370] text-white text-xs font-semibold cursor-pointer transition-colors"
              >
                Limpar busca e filtros
              </button>
            )}
          </div>
        ) : (
          <>
            {/* VISÃO MOBILE & TABLET */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:hidden">
              {visibleFilteredUsers.map((u) => {
                const effectiveLevel = resolveAccessLevel(
                  u,
                  draftEdits[u.id]?.accessLevel
                );
                const levelMeta = ACCESS_LEVEL_META[effectiveLevel];
                const effectiveClassName =
                  draftEdits[u.id]?.assignedClassName || u.assignedClassName;
                const wasRecentlySaved = Boolean(recentlySavedUserIds[u.id]);
                const isExpired = isUserAccessExpired(u);
                const isEffectivelyActive = isUserAccessEffectivelyActive(u);

                return (
                  <article
                    key={u.id}
                    className={`rounded-2xl p-4 space-y-3 bg-[#f3f6fb] transition-opacity duration-150 min-w-0 break-words ${
                      !isEffectivelyActive ? 'opacity-75' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${levelMeta.badgeClass}`}
                          >
                            {renderAccessLevelIcon(effectiveLevel)}
                            <span>{levelMeta.badgeLabel}</span>
                          </span>
                          {u.accessExpiresAt && (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold tabular-nums ${
                                isExpired
                                  ? 'bg-[#fee2e2] text-[#991b1b]'
                                  : 'bg-[#fef3c7] text-[#92400e]'
                              }`}
                            >
                              <CalendarClock className="w-3 h-3 shrink-0" />
                              <span>
                                {isExpired
                                  ? `Expirado (${formatAccessExpirationDateBR(u.accessExpiresAt)})`
                                  : `Até ${formatAccessExpirationDateBR(u.accessExpiresAt)}`}
                              </span>
                            </span>
                          )}
                          {u.subjectName &&
                            u.subjectName !== 'GESTÃO / ADMIN' &&
                            u.subjectName !== 'REGENTE PEB I' &&
                            u.subjectName !== 'EDUCAÇÃO ESPECIAL (AEE)' && (
                              <span className="px-2 py-0.5 rounded-md bg-white text-[#334155] text-xs font-medium">
                                {u.subjectName}
                              </span>
                            )}
                        </div>

                        <h3 className="text-sm font-semibold text-[#0f172a] break-words">
                          {u.name}
                        </h3>
                        <p className="text-xs text-[#047857] break-all">
                          {u.email}
                        </p>
                      </div>

                      <ToggleSwitch
                        checked={isEffectivelyActive}
                        disabled={!canManage}
                        onChange={() => onToggleActive(u.id)}
                        activeText="Ativo"
                        inactiveText={isExpired ? 'Expirado' : 'Bloq.'}
                        ariaLabel={`Alternar acesso de ${u.name}`}
                      />
                    </div>

                    <div className="space-y-1">
                      <span className="text-xs font-medium text-slate-700 block">
                        Nível de acesso
                      </span>
                      <div className="grid grid-cols-2 min-[420px]:grid-cols-4 gap-1 p-1 rounded-xl bg-white">
                        {ACCESS_LEVEL_ORDER.map((lvl) => {
                          const meta = ACCESS_LEVEL_META[lvl];
                          const isSelected = effectiveLevel === lvl;
                          const isSchoolAdmin = isOfficialSchoolAdminEmail(u.email);
                          const isLockedAdmin = !isSchoolAdmin && lvl === 'admin';
                          const isLockedSchoolAdmin = isSchoolAdmin && lvl !== 'admin';
                          const isDisabled = !canManage || isLockedAdmin || isLockedSchoolAdmin;
                          const btnTitle = isLockedAdmin
                            ? 'Perfil Administrador é exclusivo de emebjfreitas@jundiai.sp.gov.br'
                            : isLockedSchoolAdmin
                            ? 'Conta oficial da escola é o Administrador titular'
                            : meta.description;

                          return (
                            <button
                              key={lvl}
                              type="button"
                              disabled={isDisabled}
                              onClick={() => onSelectAccessLevel(u.id, lvl)}
                              title={btnTitle}
                              className={`min-w-0 min-h-[38px] px-2 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1 transition-all duration-100 whitespace-normal text-center ${
                                isSelected
                                  ? meta.activeSegmentClass
                                  : isLockedAdmin
                                  ? 'text-slate-600 bg-slate-100/70 opacity-75 cursor-not-allowed'
                                  : 'text-slate-800 hover:bg-[#eef3f9]'
                              } ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              {renderAccessLevelIcon(lvl)}
                              <span className="break-words leading-tight">{meta.shortLabel}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <span className="text-xs font-medium text-slate-700 block mb-1">
                        Turma(s) e Função
                      </span>
                      {canManage ? (
                        <button
                          type="button"
                          onClick={() => onOpenAssignModal(u.id)}
                          className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white hover:bg-[#e8f0fe]/60 text-left text-xs font-semibold text-slate-950 flex items-center justify-between gap-2 cursor-pointer transition-colors duration-100"
                        >
                          <span className="break-words leading-snug min-w-0 flex-1 text-left">
                            {effectiveClassName}
                          </span>
                          <Edit3 className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                        </button>
                      ) : (
                        <p className="text-xs text-slate-950 bg-white rounded-xl px-3 py-2.5 break-words">
                          {effectiveClassName}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="text-xs font-medium text-slate-700 block">
                        Validade de acesso (temporário)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="date"
                          value={u.accessExpiresAt || ''}
                          disabled={!canManage}
                          onChange={(e) => onUpdateUserExpiration(u.id, e.target.value)}
                          aria-label={`Data de expiração de ${u.name}`}
                          className="flex-1 min-w-0 min-h-[38px] px-2.5 rounded-xl bg-white text-xs font-medium text-slate-950 tabular-nums disabled:opacity-60"
                        />
                        {canManage && u.accessExpiresAt && (
                          <button
                            type="button"
                            onClick={() => onUpdateUserExpiration(u.id, '')}
                            className="min-h-[38px] px-2.5 rounded-xl bg-white text-xs font-semibold text-slate-700 hover:text-slate-950 cursor-pointer shrink-0"
                          >
                            Permanente
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700 tabular-nums">
                      <span>
                        {u.totalAccessCount || 0} acessos ·{' '}
                        {formatDurationHuman(u.totalDurationSeconds)}
                      </span>
                      {wasRecentlySaved && (
                        <span className="text-[#047857] font-semibold">Salvo</span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      {onSimulateTeacherProfile && (
                        <button
                          type="button"
                          onClick={() => onSimulateTeacherProfile(u)}
                          className="flex-1 min-w-0 min-h-[40px] px-3 py-1.5 rounded-xl bg-[#ecfdf5] text-[#047857] font-semibold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-normal text-center"
                        >
                          <Eye className="w-3.5 h-3.5 shrink-0" />
                          <span>Abrir Visão</span>
                        </button>
                      )}
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => onRemoveUser(u)}
                          className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-white text-[#be123c] font-semibold text-xs inline-flex items-center justify-center gap-1 cursor-pointer whitespace-normal text-center"
                        >
                          <Trash2 className="w-3.5 h-3.5 shrink-0" />
                          <span>Remover</span>
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {/* VISÃO DESKTOP */}
            <div className="hidden lg:block overflow-x-auto rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#eef3f9] text-slate-800 font-semibold text-xs">
                  <tr>
                    <th className="py-3 px-3 rounded-tl-xl">Status</th>
                    <th className="py-3 px-3">Educador(a) e Nível</th>
                    <th className="py-3 px-3">Alternar Nível de Acesso</th>
                    <th className="py-3 px-3">Turma(s) &amp; Vínculo</th>
                    <th className="py-3 px-3">Validade</th>
                    <th className="py-3 px-3 text-center">Acessos</th>
                    <th className="py-3 px-3">Tempo de Uso</th>
                    <th className="py-3 px-3 text-right rounded-tr-xl">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleFilteredUsers.map((u) => {
                    const effectiveLevel = resolveAccessLevel(
                      u,
                      draftEdits[u.id]?.accessLevel
                    );
                    const levelMeta = ACCESS_LEVEL_META[effectiveLevel];
                    const effectiveClassName =
                      draftEdits[u.id]?.assignedClassName || u.assignedClassName;
                    const wasRecentlySaved = Boolean(recentlySavedUserIds[u.id]);
                    const isExpired = isUserAccessExpired(u);
                    const isEffectivelyActive = isUserAccessEffectivelyActive(u);

                    return (
                      <tr
                        key={u.id}
                        className={`odd:bg-[#f3f6fb] even:bg-white hover:bg-[#e8f0fe]/50 transition-colors duration-100 ${
                          !isEffectivelyActive ? 'opacity-80' : ''
                        }`}
                      >
                        <td className="py-3 px-3 align-middle whitespace-nowrap">
                          <ToggleSwitch
                            checked={isEffectivelyActive}
                            disabled={!canManage}
                            onChange={() => onToggleActive(u.id)}
                            activeText="Liberado"
                            inactiveText={isExpired ? 'Expirado' : 'Bloqueado'}
                            ariaLabel={`Alternar acesso de ${u.name}`}
                          />
                        </td>

                        <td className="py-3 px-3 align-top">
                          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${levelMeta.badgeClass}`}
                            >
                              {renderAccessLevelIcon(effectiveLevel)}
                              <span>{levelMeta.badgeLabel}</span>
                            </span>
                            {u.subjectName &&
                              u.subjectName !== 'GESTÃO / ADMIN' &&
                              u.subjectName !== 'REGENTE PEB I' &&
                              u.subjectName !== 'EDUCAÇÃO ESPECIAL (AEE)' && (
                                <span className="px-2 py-0.5 rounded-md bg-[#f3f6fb] text-[#334155] text-xs font-medium">
                                  {u.subjectName}
                                </span>
                              )}
                          </div>
                          <span className="font-semibold text-[#0f172a] block break-words">
                            {u.name}
                          </span>
                          <span className="text-xs text-[#047857] block break-all">
                            {u.email}
                          </span>
                        </td>

                        <td className="py-3 px-3 align-middle whitespace-nowrap">
                          <div
                            role="group"
                            aria-label={`Nível de permissão para ${u.name}`}
                            className="inline-flex items-center p-1 rounded-xl bg-[#dfe8f4] gap-0.5"
                          >
                            {ACCESS_LEVEL_ORDER.map((lvl) => {
                              const meta = ACCESS_LEVEL_META[lvl];
                              const isSelected = effectiveLevel === lvl;
                              const isSchoolAdmin = isOfficialSchoolAdminEmail(u.email);
                              const isLockedAdmin = !isSchoolAdmin && lvl === 'admin';
                              const isLockedSchoolAdmin = isSchoolAdmin && lvl !== 'admin';
                              const isDisabled = !canManage || isLockedAdmin || isLockedSchoolAdmin;
                              const btnTitle = isLockedAdmin
                                ? 'Perfil Administrador é exclusivo de emebjfreitas@jundiai.sp.gov.br'
                                : isLockedSchoolAdmin
                                ? 'Conta oficial da escola é o Administrador titular'
                                : meta.description;

                              return (
                                <button
                                  key={lvl}
                                  type="button"
                                  disabled={isDisabled}
                                  onClick={() => onSelectAccessLevel(u.id, lvl)}
                                  title={btnTitle}
                                  className={`min-h-[36px] px-2.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-all duration-100 ${
                                    isSelected
                                      ? meta.activeSegmentClass
                                      : isLockedAdmin
                                      ? 'text-slate-600 bg-slate-100/70 opacity-75 cursor-not-allowed'
                                      : 'text-slate-800 hover:bg-white/80'
                                  } ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                  {renderAccessLevelIcon(lvl)}
                                  <span>{meta.shortLabel}</span>
                                </button>
                              );
                            })}
                          </div>
                        </td>

                        <td className="py-3 px-3 align-middle max-w-xs">
                          {canManage ? (
                            <div className="flex items-center gap-2 min-w-0">
                              <button
                                type="button"
                                onClick={() => onOpenAssignModal(u.id)}
                                className="px-3 py-1.5 min-h-[36px] rounded-xl bg-[#ecfdf5] hover:bg-[#d1fae5] text-[#047857] font-semibold text-xs inline-flex items-center gap-1.5 max-w-[260px] cursor-pointer transition-colors duration-100 text-left whitespace-normal"
                              >
                                <span className="break-words leading-snug">{effectiveClassName}</span>
                                <Edit3 className="w-3.5 h-3.5 shrink-0" />
                              </button>
                              {wasRecentlySaved && (
                                <span className="text-xs font-semibold text-[#047857] shrink-0">
                                  Salvo
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-700 text-xs break-words">
                              {effectiveClassName}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 align-middle whitespace-nowrap">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <input
                                type="date"
                                value={u.accessExpiresAt || ''}
                                disabled={!canManage}
                                onChange={(e) => onUpdateUserExpiration(u.id, e.target.value)}
                                aria-label={`Validade de ${u.name}`}
                                className={`min-h-[32px] px-2 rounded-lg text-xs font-medium tabular-nums ${
                                  isExpired
                                    ? 'bg-[#fee2e2] text-[#991b1b]'
                                    : u.accessExpiresAt
                                    ? 'bg-[#fef3c7] text-[#92400e]'
                                    : 'bg-[#eef3f9] text-slate-700'
                                }`}
                              />
                              {canManage && u.accessExpiresAt && (
                                <button
                                  type="button"
                                  onClick={() => onUpdateUserExpiration(u.id, '')}
                                  title="Remover validade (tornar acesso permanente)"
                                  aria-label={`Remover data de expiração de ${u.name}`}
                                  className="w-7 h-7 rounded-lg bg-[#eef3f9] hover:bg-[#e8f0fe] text-slate-700 hover:text-slate-950 flex items-center justify-center cursor-pointer transition-colors"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                            <span
                              className={`text-[11px] font-medium block tabular-nums ${
                                isExpired
                                  ? 'text-[#991b1b]'
                                  : u.accessExpiresAt
                                  ? 'text-[#92400e]'
                                  : 'text-slate-700'
                              }`}
                            >
                              {isExpired
                                ? `Expirado (${formatAccessExpirationDateBR(u.accessExpiresAt)})`
                                : u.accessExpiresAt
                                ? `Temporário até ${formatAccessExpirationDateBR(u.accessExpiresAt)}`
                                : 'Permanente'}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-3 align-middle text-center tabular-nums">
                          <span
                            className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                              (u.totalAccessCount || 0) > 0
                                ? 'bg-[#ecfdf5] text-[#047857]'
                                : 'bg-[#eef3f9] text-slate-700'
                            }`}
                          >
                            {u.totalAccessCount || 0}x
                          </span>
                        </td>

                        <td className="py-3 px-3 align-middle tabular-nums">
                          <span className="font-semibold text-slate-950 block">
                            {formatDurationHuman(u.totalDurationSeconds)}
                          </span>
                          {u.lastLoginAt && (
                            <span className="text-xs text-slate-700 block">
                              {u.lastLoginAt}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 align-middle text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {onSimulateTeacherProfile && (
                              <button
                                type="button"
                                onClick={() => onSimulateTeacherProfile(u)}
                                className="px-2.5 py-1.5 rounded-lg bg-[#ecfdf5] hover:bg-[#d1fae5] text-[#047857] font-semibold text-xs cursor-pointer"
                              >
                                Abrir Visão
                              </button>
                            )}
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => onRemoveUser(u)}
                                className="px-2.5 py-1.5 rounded-lg bg-[#fee2e2] hover:bg-[#fecaca] text-[#991b1b] font-semibold text-xs cursor-pointer"
                              >
                                Remover
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <PaginationBar
              currentPage={usersPage}
              totalItems={filteredUsers.length}
              pageSize={pageSize}
              itemLabel="contas autorizadas"
              onPageChange={onChangeUsersPage}
            />
          </>
        )}
      </section>
    </div>
  );
};
