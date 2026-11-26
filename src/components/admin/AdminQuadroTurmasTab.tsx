import React from 'react';
import {
  AlertTriangle,
  Check,
  Edit3,
  Eye,
  RefreshCw,
  Search,
  Sun,
  Sunset,
  X,
} from 'lucide-react';
import { AuthorizedUser, ClassGroup } from '../../types';
import { exportOfficialMatrixToXLS, formatDurationHuman } from '../../services/db';
import { exportUniversalReport } from '../../utils/universalExport';
import { buildOfficialMatrixReport } from '../../utils/reportBuilders';
import { CustomSelect } from '../CustomSelect';
import { StudentAvatar } from '../StudentAvatar';
import { ExportFormatButton } from '../ui/ExportFormatButton';
import { MatrixDraft } from './adminAccessUtils';

interface AdminQuadroTurmasTabProps {
  classes: ClassGroup[];
  authorizedUsers: AuthorizedUser[];
  specialistsUsers: AuthorizedUser[];
  filteredMatrixClasses: ClassGroup[];
  visibleMatrixClasses: ClassGroup[];
  visibleMatrixLimit: number;
  manhaTurmasCount: number;
  tardeTurmasCount: number;
  vacantTurmasCount: number;
  matrixShiftFilter: 'ALL' | 'MANHÃ' | 'TARDE' | 'VAGAS';
  matrixSearchTerm: string;
  editingMatrixClassId: string | null;
  matrixDraft: MatrixDraft | null;
  canManage: boolean;
  onChangeShiftFilter: (filter: 'ALL' | 'MANHÃ' | 'TARDE' | 'VAGAS') => void;
  onChangeSearchTerm: (term: string) => void;
  onChangeVisibleLimit: (limit: number) => void;
  onStartEditRow: (cls: ClassGroup) => void;
  onChangeMatrixDraft: (draft: MatrixDraft | null) => void;
  onSaveMatrixRow: (cls: ClassGroup) => void;
  onCancelEditRow: () => void;
  onRestoreOfficialMatrix: () => void;
  onSimulateTeacherProfile?: (teacher: AuthorizedUser) => void;
  findRegenteUserForClass: (cls: ClassGroup) => AuthorizedUser | undefined;
  onFeedback: (type: 'success' | 'error', text: string) => void;
}

export const AdminQuadroTurmasTab: React.FC<AdminQuadroTurmasTabProps> = ({
  classes,
  authorizedUsers,
  specialistsUsers,
  filteredMatrixClasses,
  visibleMatrixClasses,
  visibleMatrixLimit,
  manhaTurmasCount,
  tardeTurmasCount,
  vacantTurmasCount,
  matrixShiftFilter,
  matrixSearchTerm,
  editingMatrixClassId,
  matrixDraft,
  canManage,
  onChangeShiftFilter,
  onChangeSearchTerm,
  onChangeVisibleLimit,
  onStartEditRow,
  onChangeMatrixDraft,
  onSaveMatrixRow,
  onCancelEditRow,
  onRestoreOfficialMatrix,
  onSimulateTeacherProfile,
  findRegenteUserForClass,
  onFeedback,
}) => {
  return (
    <div className="space-y-4">
      <section className="bg-white rounded-3xl p-4 sm:p-5 border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#F5F5F7] rounded-full border border-black/[0.06]">
            <button
              type="button"
              onClick={() => onChangeShiftFilter('ALL')}
              className={`min-h-[36px] px-3.5 rounded-full text-xs font-semibold cursor-pointer transition-colors duration-150 ${
                matrixShiftFilter === 'ALL'
                  ? 'bg-[#0071E3] text-white'
                  : 'text-[#1D1D1F] hover:text-black'
              }`}
            >
              Todas ({classes.length})
            </button>
            <button
              type="button"
              onClick={() => onChangeShiftFilter('MANHÃ')}
              className={`min-h-[36px] px-3.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors duration-150 ${
                matrixShiftFilter === 'MANHÃ'
                  ? 'bg-[#0071E3] text-white'
                  : 'text-[#1D1D1F] hover:text-black'
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-[#B25000]" />
              <span>Manhã ({manhaTurmasCount})</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeShiftFilter('TARDE')}
              className={`min-h-[36px] px-3.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors duration-150 ${
                matrixShiftFilter === 'TARDE'
                  ? 'bg-[#0071E3] text-white'
                  : 'text-[#1D1D1F] hover:text-black'
              }`}
            >
              <Sunset className="w-3.5 h-3.5 text-[#0071E3]" />
              <span>Tarde ({tardeTurmasCount})</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeShiftFilter('VAGAS')}
              className={`min-h-[36px] px-3.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors duration-150 ${
                matrixShiftFilter === 'VAGAS'
                  ? 'bg-[#b45309] text-white'
                  : 'bg-[#fef3c7] text-[#92400e] hover:bg-[#fde68a]'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Turmas Vagas ({vacantTurmasCount})</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 xl:max-w-2xl justify-end">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-700 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={matrixSearchTerm}
                onChange={(e) => onChangeSearchTerm(e.target.value)}
                placeholder="Buscar turma, professor, sala ou código SED..."
                className="w-full min-h-[40px] pl-10 pr-9 rounded-xl bg-[#f3f6fb] focus:bg-white text-sm text-slate-950 placeholder:text-slate-600"
              />
              {matrixSearchTerm && (
                <button
                  type="button"
                  onClick={() => onChangeSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-700 hover:text-slate-950 p-1 cursor-pointer"
                  aria-label="Limpar busca"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <ExportFormatButton
                label="Exportar Quadro"
                variant="secondary"
                onExport={async (format) => {
                  if (format === 'xls') {
                    exportOfficialMatrixToXLS(classes, authorizedUsers);
                    onFeedback('success', 'Arquivo do Quadro Oficial (.xls) baixado.');
                    return;
                  }
                  const report = buildOfficialMatrixReport(classes, authorizedUsers);
                  const fileName = await exportUniversalReport(report, format);
                  onFeedback('success', `Quadro Oficial ${fileName} baixado com sucesso.`);
                }}
              />

              {canManage && (
                <button
                  type="button"
                  onClick={onRestoreOfficialMatrix}
                  className="min-h-[40px] px-3 rounded-xl bg-[#f3f6fb] hover:bg-[#dfe8f4] text-[#0f172a] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                  <span>Sincronizar Quadro</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {filteredMatrixClasses.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#f3f6fb] text-center text-sm font-medium text-slate-700">
            Nenhuma turma encontrada para o filtro informado.
          </div>
        ) : (
          <>
            {/* VISÃO MOBILE & TABLET */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:hidden">
              {visibleMatrixClasses.map((cls) => {
                const regenteUser = findRegenteUserForClass(cls);
                const isEditing =
                  editingMatrixClassId === cls.id && matrixDraft !== null;
                const isVaga = cls.isVaga || cls.teacherName === 'TURMA VAGA';
                const activeCount = cls.students.filter((s) => {
                  const sit = (s.situacao || 'ATIVO').toUpperCase().trim();
                  return (
                    !sit.includes('BXTR') &&
                    !sit.includes('TRANSF') &&
                    !sit.includes('REMAN')
                  );
                }).length;

                return (
                  <article
                    key={cls.id}
                    className={`rounded-2xl p-4 space-y-3 transition-colors duration-100 min-w-0 break-words ${
                      isEditing ? 'bg-[#ecfdf5]' : 'bg-[#f3f6fb]/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-950 break-words leading-snug">
                            {cls.name}
                          </h3>
                          {isVaga && (
                            <span className="px-2 py-0.5 rounded-full font-semibold text-[11px] bg-[#fef3c7] text-[#92400e]">
                              Turma vaga
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-700 break-words leading-snug mt-0.5">
                          {cls.shift.replace('Turno ', '')} · {cls.room}
                        </p>
                      </div>

                      <span className="text-xs font-semibold text-[#047857] bg-white px-2.5 py-1 rounded-xl tabular-nums shrink-0">
                        {activeCount} alunos
                      </span>
                    </div>

                    {isEditing && matrixDraft ? (
                      <div className="space-y-2.5 pt-1">
                        <div>
                          <label className="text-xs font-medium text-slate-700 block mb-1">
                            Professor(a) Regente
                          </label>
                          <input
                            type="text"
                            value={matrixDraft.teacherName}
                            onChange={(e) =>
                              onChangeMatrixDraft({
                                ...matrixDraft,
                                teacherName: e.target.value,
                              })
                            }
                            className="w-full min-h-[40px] px-3 rounded-xl bg-white text-xs font-medium text-slate-950"
                          />
                        </div>

                        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs font-medium text-slate-700 block mb-1">
                              Pronome
                            </label>
                            <CustomSelect
                              value={matrixDraft.teacherPronoun}
                              onChange={(val) =>
                                onChangeMatrixDraft({
                                  ...matrixDraft,
                                  teacherPronoun: val,
                                })
                              }
                              ariaLabel="Pronome"
                              className="w-full bg-white text-xs font-medium text-slate-950"
                              options={[
                                { value: 'PROFESSORA', label: 'PROFESSORA' },
                                { value: 'PROFESSOR', label: 'PROFESSOR' },
                              ]}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-700 block mb-1">
                              Prenome
                            </label>
                            <input
                              type="text"
                              value={matrixDraft.teacherFirstName}
                              onChange={(e) =>
                                onChangeMatrixDraft({
                                  ...matrixDraft,
                                  teacherFirstName: e.target.value,
                                })
                              }
                              className="w-full min-h-[40px] px-3 rounded-xl bg-white text-xs font-medium text-slate-950"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs font-medium text-slate-700 block mb-1">
                              Sala
                            </label>
                            <input
                              type="text"
                              value={matrixDraft.room}
                              onChange={(e) =>
                                onChangeMatrixDraft({ ...matrixDraft, room: e.target.value })
                              }
                              className="w-full min-h-[40px] px-3 rounded-xl bg-white text-xs font-medium text-slate-950"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-700 block mb-1">
                              Período
                            </label>
                            <CustomSelect
                              value={matrixDraft.shift}
                              onChange={(val) =>
                                onChangeMatrixDraft({
                                  ...matrixDraft,
                                  shift: val as 'Turno Manhã' | 'Turno Tarde',
                                })
                              }
                              ariaLabel="Período"
                              className="w-full bg-white text-xs font-medium text-slate-950"
                              options={[
                                { value: 'Turno Manhã', label: 'Manhã' },
                                { value: 'Turno Tarde', label: 'Tarde' },
                              ]}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs font-medium text-slate-700 block mb-1">
                              Turma SED
                            </label>
                            <input
                              type="text"
                              value={matrixDraft.turmaSedName}
                              onChange={(e) =>
                                onChangeMatrixDraft({
                                  ...matrixDraft,
                                  turmaSedName: e.target.value,
                                })
                              }
                              className="w-full min-h-[40px] px-3 rounded-xl bg-white text-xs font-medium text-slate-950"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-700 block mb-1">
                              Código SED
                            </label>
                            <input
                              type="text"
                              value={matrixDraft.classeSedCode}
                              onChange={(e) =>
                                onChangeMatrixDraft({
                                  ...matrixDraft,
                                  classeSedCode: e.target.value,
                                })
                              }
                              className="w-full min-h-[40px] px-3 rounded-xl bg-white text-xs font-medium text-[#0f172a]"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                          <input
                            type="text"
                            placeholder="Professor(a) Arte"
                            value={matrixDraft.artTeacher}
                            onChange={(e) =>
                              onChangeMatrixDraft({
                                ...matrixDraft,
                                artTeacher: e.target.value,
                              })
                            }
                            className="w-full min-h-[38px] px-3 rounded-xl bg-white text-xs text-[#0f172a]"
                          />
                          <input
                            type="text"
                            placeholder="Professor(a) de Educação Física"
                            value={matrixDraft.peTeacher}
                            onChange={(e) =>
                              onChangeMatrixDraft({
                                ...matrixDraft,
                                peTeacher: e.target.value,
                              })
                            }
                            className="w-full min-h-[38px] px-3 rounded-xl bg-white text-xs text-[#0f172a]"
                          />
                          <input
                            type="text"
                            placeholder="Professor(a) Língua Inglesa"
                            value={matrixDraft.englishTeacher}
                            onChange={(e) =>
                              onChangeMatrixDraft({
                                ...matrixDraft,
                                englishTeacher: e.target.value,
                              })
                            }
                            className="w-full min-h-[38px] px-3 rounded-xl bg-white text-xs text-[#0f172a]"
                          />
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => onSaveMatrixRow(cls)}
                            className="flex-1 min-h-[42px] rounded-xl bg-[#047857] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                            <span>Salvar</span>
                          </button>
                          <button
                            type="button"
                            onClick={onCancelEditRow}
                            className="min-h-[42px] px-4 rounded-xl bg-white hover:bg-[#eef3f9] text-slate-700 text-xs font-semibold cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="bg-white rounded-xl p-3 space-y-1">
                          {isVaga ? (
                            <div className="flex items-center gap-2 text-[#b45309] text-xs font-semibold">
                              <AlertTriangle className="w-4 h-4 shrink-0" />
                              <span>Turma vaga · Aguardando atribuição</span>
                            </div>
                          ) : (
                            <>
                              <p className="text-xs font-semibold text-slate-950 break-words">
                                {cls.teacherName || regenteUser?.name || '—'}
                              </p>
                              {regenteUser ? (
                                <p className="text-xs text-[#047857] break-all">
                                  {regenteUser.email}
                                </p>
                              ) : (
                                <p className="text-xs text-[#be123c]">
                                  Sem e-mail vinculado
                                </p>
                              )}
                            </>
                          )}
                        </div>

                        <div className="text-xs text-slate-700 space-y-1">
                          {(cls.turmaSedName || cls.classeSedCode) && (
                            <p className="tabular-nums break-words">
                              SED: {cls.turmaSedName || '—'} · Código {cls.classeSedCode || '—'}
                            </p>
                          )}
                          {(cls.artTeacher || cls.peTeacher || cls.englishTeacher) && (
                            <p className="break-words">
                              Especialistas:{' '}
                              {[
                                cls.artTeacher && `Arte: ${cls.artTeacher}`,
                                cls.peTeacher && `Educação Física: ${cls.peTeacher}`,
                                cls.englishTeacher && `Inglês: ${cls.englishTeacher}`,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => onStartEditRow(cls)}
                              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-white hover:bg-[#eef3f9] text-[#0f172a] text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-normal text-center"
                            >
                              <Edit3 className="w-3.5 h-3.5 shrink-0" />
                              <span>{isVaga ? 'Designar' : 'Editar'}</span>
                            </button>
                          )}

                          {regenteUser && onSimulateTeacherProfile && (
                            <button
                              type="button"
                              onClick={() => onSimulateTeacherProfile(regenteUser)}
                              className="flex-1 min-w-0 min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#ecfdf5] hover:bg-[#d1fae5] text-[#047857] text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-normal text-center"
                            >
                              <Eye className="w-3.5 h-3.5 shrink-0" />
                              <span>Abrir Visão</span>
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </article>
                );
              })}
            </div>

            {/* VISÃO DESKTOP */}
            <div className="hidden lg:block overflow-x-auto rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#eef3f9] text-slate-800 font-semibold text-xs">
                  <tr>
                    <th className="py-3 px-3 rounded-tl-xl">Turma</th>
                    <th className="py-3 px-3">Professor(a) Regente e E-mail</th>
                    <th className="py-3 px-3">Sala e Período</th>
                    <th className="py-3 px-3">Identificação SED</th>
                    <th className="py-3 px-3 text-center">Alunos</th>
                    <th className="py-3 px-3">Especialistas (PEB II)</th>
                    <th className="py-3 px-3 text-right rounded-tr-xl">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMatrixClasses.map((cls) => {
                    const regenteUser = findRegenteUserForClass(cls);
                    const isEditing =
                      editingMatrixClassId === cls.id && matrixDraft !== null;
                    const isVaga = cls.isVaga || cls.teacherName === 'TURMA VAGA';
                    const activeCount = cls.students.filter((s) => {
                      const sit = (s.situacao || 'ATIVO').toUpperCase().trim();
                      return (
                        !sit.includes('BXTR') &&
                        !sit.includes('TRANSF') &&
                        !sit.includes('REMAN')
                      );
                    }).length;

                    return (
                      <tr
                        key={cls.id}
                        className={`transition-colors duration-100 ${
                          isEditing
                            ? 'bg-[#ecfdf5]'
                            : 'odd:bg-[#f3f6fb] even:bg-white hover:bg-[#e8f0fe]/50'
                        }`}
                      >
                        <td className="py-3 px-3 align-top whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#0f172a]">
                              {cls.name}
                            </span>
                            {isVaga && (
                              <span className="px-2 py-0.5 rounded-full font-semibold text-[11px] bg-[#fef3c7] text-[#92400e]">
                                Vaga
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3 align-top">
                          {isEditing && matrixDraft ? (
                            <div className="space-y-1.5 min-w-[230px]">
                              <input
                                type="text"
                                value={matrixDraft.teacherName}
                                onChange={(e) =>
                                  onChangeMatrixDraft({
                                    ...matrixDraft,
                                    teacherName: e.target.value,
                                  })
                                }
                                placeholder="Nome completo"
                                className="w-full px-2.5 py-1.5 rounded-lg bg-white text-xs font-medium text-[#0f172a]"
                              />
                              <div className="flex gap-1.5">
                                <CustomSelect
                                  value={matrixDraft.teacherPronoun}
                                  onChange={(val) =>
                                    onChangeMatrixDraft({
                                      ...matrixDraft,
                                      teacherPronoun: val,
                                    })
                                  }
                                  size="sm"
                                  ariaLabel="Pronome"
                                  className="bg-white text-xs font-medium"
                                  options={[
                                    { value: 'PROFESSORA', label: 'PROFESSORA' },
                                    { value: 'PROFESSOR', label: 'PROFESSOR' },
                                  ]}
                                />
                                <input
                                  type="text"
                                  value={matrixDraft.teacherFirstName}
                                  onChange={(e) =>
                                    onChangeMatrixDraft({
                                      ...matrixDraft,
                                      teacherFirstName: e.target.value,
                                    })
                                  }
                                  placeholder="Prenome"
                                  className="w-28 px-2.5 min-h-[36px] rounded-lg bg-white text-xs"
                                />
                              </div>
                            </div>
                          ) : isVaga ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#fef3c7] text-[#92400e] font-medium text-xs">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Turma Vaga
                              </span>
                              {canManage && (
                                <button
                                  type="button"
                                  onClick={() => onStartEditRow(cls)}
                                  className="block text-xs text-[#047857] hover:underline font-medium cursor-pointer"
                                >
                                  Designar docente
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <span className="font-semibold text-[#0f172a] block break-words">
                                {cls.teacherName || regenteUser?.name || '—'}
                              </span>
                              {regenteUser ? (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-xs text-[#047857] break-all">
                                    {regenteUser.email}
                                  </span>
                                  {(regenteUser.totalAccessCount || 0) > 0 && (
                                    <span className="px-2 py-0.5 rounded-md bg-[#ecfdf5] text-[#047857] text-xs font-medium tabular-nums">
                                      {regenteUser.totalAccessCount}x ·{' '}
                                      {formatDurationHuman(regenteUser.totalDurationSeconds)}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-[#be123c]">
                                  Sem e-mail vinculado
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-3 align-top whitespace-nowrap">
                          {isEditing && matrixDraft ? (
                            <div className="space-y-1.5">
                              <input
                                type="text"
                                value={matrixDraft.room}
                                onChange={(e) =>
                                  onChangeMatrixDraft({ ...matrixDraft, room: e.target.value })
                                }
                                className="w-32 px-2.5 min-h-[36px] rounded-lg bg-white text-xs"
                              />
                              <CustomSelect
                                value={matrixDraft.shift}
                                onChange={(val) =>
                                  onChangeMatrixDraft({
                                    ...matrixDraft,
                                    shift: val as 'Turno Manhã' | 'Turno Tarde',
                                  })
                                }
                                size="sm"
                                ariaLabel="Período"
                                className="w-32 bg-white text-xs font-medium"
                                options={[
                                  { value: 'Turno Manhã', label: 'Manhã' },
                                  { value: 'Turno Tarde', label: 'Tarde' },
                                ]}
                              />
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <span className="text-[#0f172a] font-medium block">
                                {cls.room}
                              </span>
                              <span
                                className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${
                                  cls.shift === 'Turno Manhã'
                                    ? 'bg-[#fef3c7] text-[#92400e]'
                                    : 'bg-[#e0f2fe] text-[#075985]'
                                }`}
                              >
                                {cls.shift.replace('Turno ', '')}
                              </span>
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-3 align-top">
                          {isEditing && matrixDraft ? (
                            <div className="space-y-1.5">
                              <input
                                type="text"
                                value={matrixDraft.turmaSedName}
                                onChange={(e) =>
                                  onChangeMatrixDraft({
                                    ...matrixDraft,
                                    turmaSedName: e.target.value,
                                  })
                                }
                                placeholder="Turma SED"
                                className="w-36 px-2.5 py-1.5 rounded-lg bg-white text-xs"
                              />
                              <input
                                type="text"
                                value={matrixDraft.classeSedCode}
                                onChange={(e) =>
                                  onChangeMatrixDraft({
                                    ...matrixDraft,
                                    classeSedCode: e.target.value,
                                  })
                                }
                                placeholder="Código SED"
                                className="block w-36 px-2.5 min-h-[36px] rounded-lg bg-white text-xs tabular-nums"
                              />
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <span className="text-slate-950 block">
                                {cls.turmaSedName || '—'}
                              </span>
                              <span className="text-xs text-slate-700 tabular-nums block">
                                Código {cls.classeSedCode || '—'}
                              </span>
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-3 align-top text-center tabular-nums">
                          <span className="font-semibold text-[#047857] text-sm">
                            {activeCount}
                          </span>
                          {cls.students.length !== activeCount && (
                            <span className="block text-xs text-slate-700">
                              ({cls.students.length})
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 align-top">
                          {isEditing && matrixDraft ? (
                            <div className="space-y-1 min-w-[200px]">
                              <input
                                type="text"
                                placeholder="Arte"
                                value={matrixDraft.artTeacher}
                                onChange={(e) =>
                                  onChangeMatrixDraft({
                                    ...matrixDraft,
                                    artTeacher: e.target.value,
                                  })
                                }
                                className="w-full px-2.5 min-h-[36px] rounded-lg bg-white text-xs"
                              />
                              <input
                                type="text"
                                placeholder="Educação Física"
                                value={matrixDraft.peTeacher}
                                onChange={(e) =>
                                  onChangeMatrixDraft({
                                    ...matrixDraft,
                                    peTeacher: e.target.value,
                                  })
                                }
                                className="w-full px-2.5 min-h-[36px] rounded-lg bg-white text-xs"
                              />
                              <input
                                type="text"
                                placeholder="Inglês"
                                value={matrixDraft.englishTeacher}
                                onChange={(e) =>
                                  onChangeMatrixDraft({
                                    ...matrixDraft,
                                    englishTeacher: e.target.value,
                                  })
                                }
                                className="w-full px-2.5 min-h-[36px] rounded-lg bg-white text-xs"
                              />
                            </div>
                          ) : (
                            <div className="text-xs text-slate-700 space-y-1 max-w-[260px]">
                              {cls.artTeacher && (
                                <p className="break-words leading-snug">
                                  <span className="text-slate-950 font-semibold">Arte:</span>{' '}
                                  {cls.artTeacher}
                                </p>
                              )}
                              {cls.peTeacher && (
                                <p className="break-words leading-snug">
                                  <span className="text-slate-950 font-semibold">Educação Física:</span>{' '}
                                  {cls.peTeacher}
                                </p>
                              )}
                              {cls.englishTeacher && (
                                <p className="break-words leading-snug">
                                  <span className="text-slate-950 font-semibold">Inglês:</span>{' '}
                                  {cls.englishTeacher}
                                </p>
                              )}
                              {!cls.artTeacher && !cls.peTeacher && !cls.englishTeacher && (
                                <span>—</span>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-3 align-top text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onSaveMatrixRow(cls)}
                                  className="px-3 py-1.5 rounded-lg bg-[#047857] text-white font-semibold text-xs inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Salvar</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={onCancelEditRow}
                                  className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-[#eef3f9] text-slate-700 font-medium text-xs cursor-pointer"
                                >
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <>
                                {canManage && (
                                  <button
                                    type="button"
                                    onClick={() => onStartEditRow(cls)}
                                    className="px-2.5 py-1.5 rounded-lg bg-[#f3f6fb] hover:bg-[#dfe8f4] text-[#0f172a] font-medium text-xs inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>Editar</span>
                                  </button>
                                )}
                                {regenteUser && onSimulateTeacherProfile && (
                                  <button
                                    type="button"
                                    onClick={() => onSimulateTeacherProfile(regenteUser)}
                                    className="px-2.5 py-1.5 rounded-lg bg-[#ecfdf5] hover:bg-[#d1fae5] text-[#047857] font-semibold text-xs inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Abrir</span>
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredMatrixClasses.length > visibleMatrixLimit && (
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => onChangeVisibleLimit(visibleMatrixLimit + 20)}
                  className="min-h-[40px] px-4 rounded-xl bg-[#f3f6fb] hover:bg-[#dfe8f4] text-[#0f172a] text-xs font-semibold cursor-pointer"
                >
                  Carregar mais turmas ({filteredMatrixClasses.length - visibleMatrixLimit} restantes)
                </button>
                <button
                  type="button"
                  onClick={() => onChangeVisibleLimit(filteredMatrixClasses.length)}
                  className="min-h-[40px] px-4 rounded-xl bg-white hover:bg-[#eef3f9] text-slate-700 hover:text-slate-950 text-xs font-semibold cursor-pointer"
                >
                  Exibir todas ({filteredMatrixClasses.length})
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Quadro Consolidado de Especialistas PEB II */}
      <section className="bg-white rounded-3xl p-4 sm:p-5 border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              Especialistas PEB II ({specialistsUsers.length})
            </h2>
            <p className="text-xs text-slate-700">
              Arte, Educação Física e Língua Inglesa com visualização das turmas atribuídas
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {specialistsUsers.map((spec) => {
            const specClasses = classes.filter(
              (c) =>
                (c.artTeacher || '').toUpperCase() === spec.name.toUpperCase() ||
                (c.peTeacher || '').toUpperCase() === spec.name.toUpperCase() ||
                (c.englishTeacher || '').toUpperCase() === spec.name.toUpperCase() ||
                (spec.assignedClassIds && spec.assignedClassIds.includes(c.id))
            );
            return (
              <div
                key={spec.id}
                className="p-4 rounded-2xl bg-[#f3f6fb] flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <StudentAvatar name={spec.name} size="xs" expandableOnClick={false} />
                    <div className="min-w-0 flex-1">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-[#fef3c7] text-[#92400e] text-xs font-semibold uppercase">
                        {spec.subjectName || 'ESPECIALISTA PEB II'}
                      </span>
                      <h3 className="font-semibold text-sm text-slate-950 break-words leading-snug mt-0.5">
                        {spec.name}
                      </h3>
                      <p className="text-xs text-[#047857] break-all">
                        {spec.email}
                      </p>
                    </div>
                  </div>

                  {onSimulateTeacherProfile && (
                    <button
                      type="button"
                      onClick={() => onSimulateTeacherProfile(spec)}
                      className="min-h-[38px] px-3.5 rounded-xl bg-white hover:bg-[#14428c] text-slate-950 hover:text-white font-semibold text-xs shrink-0 cursor-pointer transition-colors duration-150"
                    >
                      Abrir
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-slate-700 block">
                    {specClasses.length} turmas vinculadas
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {specClasses.map((c) => (
                      <span
                        key={c.id}
                        className="px-2 py-0.5 rounded-md bg-white text-xs font-medium text-[#0f172a] tabular-nums"
                      >
                        {c.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
