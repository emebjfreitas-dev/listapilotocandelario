import React from 'react';
import { Ban, Check, CheckCircle2, History, Lock } from 'lucide-react';
import { RBAC_ROLE_DEFINITIONS } from '../../services/db';

interface AdminRbacMatrizTabProps {
  selectedRbacRoleKey: string;
  onSelectRbacRoleKey: (key: string) => void;
  onOpenSecurityAudit: () => void;
}

const RBAC_MODULES = [
  {
    module: 'Visualizar Turmas e Estudantes',
    subtitle: 'Identificação e fotos escolares',
    admin: 'Acesso total',
    peb1: 'Sua turma',
    peb2: '40 turmas',
    aee: '40 turmas',
    apoio: 'Acesso total',
  },
  {
    module: 'Lançamento de Faltas do Mês',
    subtitle: 'Registro de ausências e atestados',
    admin: 'Acesso total',
    peb1: 'Sua turma',
    peb2: 'Bloqueado',
    aee: 'Bloqueado',
    apoio: 'Bloqueado',
  },
  {
    module: 'Busca Ativa e Devolutivas',
    subtitle: 'Alertas de 3, 5 e 10 dias',
    admin: 'Acesso total',
    peb1: 'Registra e lê',
    peb2: 'Bloqueado',
    aee: 'Acesso total',
    apoio: 'Acesso total',
  },
  {
    module: 'Dados Sensíveis (LGPD Art. 14)',
    subtitle: 'CPF, NIS, endereço e laudos',
    admin: 'Auditado',
    peb1: 'Mascarado',
    peb2: 'Mascarado',
    aee: 'Mascarado',
    apoio: 'Auditado',
  },
  {
    module: 'Dias Letivos Oficiais',
    subtitle: 'Calendário de 200 dias e feriados',
    admin: 'Acesso total',
    peb1: 'Bloqueado',
    peb2: 'Bloqueado',
    aee: 'Bloqueado',
    apoio: 'Bloqueado',
  },
  {
    module: 'Gestão de Acessos e Auditoria',
    subtitle: 'Contas, perfis e logs',
    admin: 'Acesso total',
    peb1: 'Bloqueado',
    peb2: 'Bloqueado',
    aee: 'Bloqueado',
    apoio: 'Bloqueado',
  },
  {
    module: 'Diagnóstico BD e Upload .HTM (AEE)',
    subtitle: 'Consistência de dados e importação SED',
    admin: 'Acesso total',
    peb1: 'Bloqueado',
    peb2: 'Bloqueado',
    aee: 'Bloqueado',
    apoio: 'Bloqueado',
  },
];

export const AdminRbacMatrizTab: React.FC<AdminRbacMatrizTabProps> = ({
  selectedRbacRoleKey,
  onSelectRbacRoleKey,
  onOpenSecurityAudit,
}) => {
  const renderPermissionBadge = (val: string) => {
    if (val === 'Bloqueado') {
      return (
        <span className="inline-flex items-center gap-1 text-slate-700">
          <Ban className="w-3.5 h-3.5" />
          <span>Não</span>
        </span>
      );
    }
    if (val === 'Mascarado') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#fef3c7] text-[#92400e] font-medium">
          <Lock className="w-3 h-3" />
          <span>Mascarado</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#ecfdf5] text-[#047857] font-medium">
        <Check className="w-3 h-3" />
        <span>{val}</span>
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-3xl p-4 sm:p-5 border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-slate-950">
              Perfis e Permissões de Acesso (RBAC)
            </h2>
            <p className="text-xs text-slate-700">
              Cada servidor acessa apenas os recursos autorizados para sua função, incluindo Educação Especial (AEE).
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenSecurityAudit}
            className="min-h-[40px] px-4 rounded-xl bg-[#eef3f9] hover:bg-[#e8f0fe] text-slate-950 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer self-start sm:self-auto transition-colors"
          >
            <History className="w-3.5 h-3.5" />
            <span>Ver Auditoria LGPD</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {RBAC_ROLE_DEFINITIONS.map((r) => {
            const isSelected = selectedRbacRoleKey === r.roleKey;
            return (
              <button
                key={r.roleKey}
                type="button"
                onClick={() => onSelectRbacRoleKey(r.roleKey)}
                className={`text-left p-4 rounded-2xl transition-all duration-150 card-interactive cursor-pointer flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'bg-[#14428c] text-white shadow-[0_12px_28px_-10px_rgba(9,27,59,0.45)]'
                    : 'bg-[#f3f6fb] hover:bg-[#eef3f9] text-slate-950'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-md text-xs font-semibold uppercase ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-white text-slate-700'
                      }`}
                    >
                      {r.badgeLabel}
                    </span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-[#34d399] shrink-0" />}
                  </div>
                  <h3 className="font-semibold text-sm">{r.name}</h3>
                  <p
                    className={`text-xs leading-relaxed ${
                      isSelected ? 'text-slate-200' : 'text-slate-700'
                    }`}
                  >
                    {r.description}
                  </p>
                </div>

                <div
                  className={`pt-2 text-xs flex items-center justify-between gap-2 ${
                    isSelected ? 'text-slate-200' : 'text-slate-700'
                  }`}
                >
                  <span>
                    {r.roleKey === 'admin'
                      ? 'Acesso pleno'
                      : r.roleKey === 'usuario'
                      ? 'Turma atribuída'
                      : r.roleKey === 'peb2' || r.roleKey === 'aee'
                      ? '40 turmas (leitura)'
                      : 'Acompanhamento'}
                  </span>
                  <span className="font-semibold">
                    {r.canEditAttendance ? 'Edita chamada' : 'Somente leitura'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="bg-white rounded-3xl p-4 sm:p-5 border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-4">
        <div>
          <h3 className="text-base font-semibold text-slate-950">
            Permissões por Módulo
          </h3>
          <p className="text-xs text-slate-700">
            Comparativo detalhado entre os cinco perfis institucionais (incluindo AEE)
          </p>
        </div>

        {/* Cards Mobile */}
        <div className="grid grid-cols-1 gap-2.5 md:hidden">
          {RBAC_MODULES.map((row) => (
            <div key={row.module} className="p-3.5 rounded-2xl bg-[#f3f6fb] space-y-2.5">
              <div>
                <h4 className="text-xs font-semibold text-slate-950 break-words">{row.module}</h4>
                <p className="text-xs text-slate-700 break-words">{row.subtitle}</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs">
                <div className="bg-white rounded-xl p-2">
                  <span className="text-slate-700 block">Admin</span>
                  <span className="font-semibold text-[#047857]">{row.admin}</span>
                </div>
                <div className="bg-white rounded-xl p-2">
                  <span className="text-slate-700 block">PEB I</span>
                  <span className="font-semibold text-slate-950">{row.peb1}</span>
                </div>
                <div className="bg-white rounded-xl p-2">
                  <span className="text-slate-700 block">PEB II</span>
                  <span className="font-semibold text-slate-950">{row.peb2}</span>
                </div>
                <div className="bg-white rounded-xl p-2">
                  <span className="text-slate-700 block">AEE</span>
                  <span className="font-semibold text-[#B25000]">{row.aee}</span>
                </div>
                <div className="bg-white rounded-xl p-2">
                  <span className="text-slate-700 block">Coordenação</span>
                  <span className="font-semibold text-slate-950">{row.apoio}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabela Desktop */}
        <div className="hidden md:block overflow-x-auto rounded-2xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#eef3f9] text-slate-800 text-xs font-semibold">
              <tr>
                <th className="py-3 px-4 rounded-tl-xl">Recurso do Sistema</th>
                <th className="py-3 px-4 text-center">Admin</th>
                <th className="py-3 px-4 text-center">PEB I</th>
                <th className="py-3 px-4 text-center">PEB II</th>
                <th className="py-3 px-4 text-center">AEE</th>
                <th className="py-3 px-4 text-center rounded-tr-xl">Coordenação</th>
              </tr>
            </thead>
            <tbody>
              {RBAC_MODULES.map((row) => (
                <tr key={row.module} className="odd:bg-[#f3f6fb] even:bg-white hover:bg-[#e8f0fe]/50 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-950 block">
                      {row.module}
                    </span>
                    <span className="text-xs text-slate-700">{row.subtitle}</span>
                  </td>
                  <td className="py-3 px-4 text-center">{renderPermissionBadge(row.admin)}</td>
                  <td className="py-3 px-4 text-center">{renderPermissionBadge(row.peb1)}</td>
                  <td className="py-3 px-4 text-center">{renderPermissionBadge(row.peb2)}</td>
                  <td className="py-3 px-4 text-center">{renderPermissionBadge(row.aee)}</td>
                  <td className="py-3 px-4 text-center">{renderPermissionBadge(row.apoio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
