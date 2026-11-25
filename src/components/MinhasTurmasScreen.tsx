import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ClassGroup, UserRole } from '../types';
import {
  Search,
  X,
  LayoutGrid,
  Table as TableIcon,
  ShieldCheck,
  ChevronRight,
  Sun,
  Sunset,
  Users,
} from 'lucide-react';
import { getStoredOfficialCalendarConfig } from '../services/db';
import { PaginationBar } from './ui/PaginationBar';
import { formatFaltas } from '../utils/attendanceAbbreviations';
import { ExportFormatButton } from './ui/ExportFormatButton';
import { exportUniversalReport } from '../utils/universalExport';
import { buildTurmasOverviewReport } from '../utils/reportBuilders';
import { toast } from 'sonner';

interface MinhasTurmasScreenProps {
  classes: ClassGroup[];
  userRole: UserRole;
  onSelectClassForDetails: (classGroup: ClassGroup) => void;
  onOpenConfigDaysModal?: () => void;
  onNavigateToAcessos?: () => void;
}

export const MinhasTurmasScreen: React.FC<MinhasTurmasScreenProps> = ({
  classes,
  userRole,
  onSelectClassForDetails,
  onOpenConfigDaysModal,
  onNavigateToAcessos,
}) => {
  const [selectedShift, setSelectedShift] = useState<'Todos' | 'Turno Manhã' | 'Turno Tarde'>('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [turmasViewMode, setTurmasViewMode] = useState<'grid' | 'table'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [showAllClasses, setShowAllClasses] = useState(false);
  const classesTopRef = useRef<HTMLDivElement | null>(null);
  const PAGE_SIZE = 16;
  const activeSchoolYear = useMemo(
    () => getStoredOfficialCalendarConfig().year || 2027,
    []
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedShift, searchTerm, turmasViewMode]);


  const manhaCount = useMemo(
    () => classes.filter((c) => c.shift === 'Turno Manhã').length,
    [classes]
  );
  const tardeCount = useMemo(
    () => classes.filter((c) => c.shift === 'Turno Tarde').length,
    [classes]
  );

  const missingScannedFichasSummary = useMemo(() => {
    let totalMissing = 0;
    classes.forEach((cls) => {
      cls.students.forEach((s) => {
        const hasPdf = Boolean(
          (s.fichaPdfDriveUrl && s.fichaPdfDriveUrl.trim().length > 0) ||
            (s.fichaPdfDriveId && s.fichaPdfDriveId.trim().length > 0)
        );
        if (!hasPdf) totalMissing++;
      });
    });
    return { totalMissing };
  }, [classes]);

  const cleanSearch = searchTerm.toLowerCase().replace(/[^a-z0-9]/g, '');
  const rawSearchLower = searchTerm.toLowerCase().trim();

  const filteredClasses = useMemo(() => {
    return classes.filter((cls) => {
      if (selectedShift !== 'Todos' && cls.shift !== selectedShift) {
        return false;
      }

      if (!searchTerm.trim()) {
        return true;
      }

      const nameNormalized = cls.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const teacherNormalized = (cls.teacherName || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      const sedNormalized = (cls.classeSedCode || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      const artNormalized = (cls.artTeacher || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      const peNormalized = (cls.peTeacher || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      const englishNormalized = (cls.englishTeacher || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

      return (
        nameNormalized.includes(cleanSearch) ||
        cls.name.toLowerCase().includes(rawSearchLower) ||
        (cls.turmaAbrev &&
          cls.turmaAbrev.toLowerCase().replace(/[^a-z0-9]/g, '').includes(cleanSearch)) ||
        teacherNormalized.includes(cleanSearch) ||
        cls.room.toLowerCase().includes(rawSearchLower) ||
        sedNormalized.includes(cleanSearch) ||
        artNormalized.includes(cleanSearch) ||
        peNormalized.includes(cleanSearch) ||
        englishNormalized.includes(cleanSearch)
      );
    });
  }, [classes, selectedShift, searchTerm, cleanSearch, rawSearchLower]);

  return (
    <div className="flex flex-col w-full min-w-0 max-w-[1600px] mx-auto space-y-5 pb-16 animate-gentle-fade text-[#1D1D1F]">
      {/* Cabeçalho Institucional */}
      <section className="bg-white rounded-3xl p-6 sm:p-7 border border-black/[0.06] shadow-sm min-w-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 min-w-0">
          <div className="space-y-1.5 min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1D1D1F] break-words">
              Turmas
            </h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-[#86868B] break-words">
              <span className="font-semibold text-[#1D1D1F]">Ano Letivo {activeSchoolYear}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums font-medium">
                {classes.length} turmas ({manhaCount} Manhã · {tardeCount} Tarde)
              </span>
              {missingScannedFichasSummary.totalMissing > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#D70015] font-semibold tabular-nums">
                    {missingScannedFichasSummary.totalMissing} sem Ficha Informativa
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto min-w-0 shrink-0">
            <ExportFormatButton
              label="Exportar Turmas"
              variant="secondary"
              disabled={filteredClasses.length === 0}
              onExport={async (format) => {
                const report = buildTurmasOverviewReport({
                  classes: filteredClasses,
                  schoolYear: activeSchoolYear,
                  shiftFilterLabel: selectedShift === 'Todos' ? 'Todos os turnos' : selectedShift,
                  searchTerm,
                });
                const fileName = await exportUniversalReport(report, format);
                toast.success(`Arquivo ${fileName} baixado com sucesso!`);
              }}
            />

            {userRole === 'admin' && (onNavigateToAcessos || onOpenConfigDaysModal) && (
              <button
                onClick={onNavigateToAcessos || onOpenConfigDaysModal}
                type="button"
                className="w-full sm:w-auto min-h-[40px] py-2 px-4 rounded-full bg-[#F5F5F7] hover:bg-black/[0.05] text-[#1D1D1F] font-medium text-xs sm:text-[13px] flex items-center justify-center text-center whitespace-normal gap-2 cursor-pointer transition-colors border border-black/[0.06]"
              >
                <ShieldCheck className="w-4 h-4 text-[#0071E3] shrink-0" />
                <span>Central Administrativa</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 min-w-0">
        <div className="flex flex-wrap sm:inline-flex items-center p-1 bg-white rounded-full text-xs font-medium w-full sm:w-auto max-w-full gap-1 border border-black/[0.06] shadow-2xs">
          <button
            onClick={() => setSelectedShift('Todos')}
            type="button"
            className={`flex-1 sm:flex-initial min-h-[34px] px-3.5 py-1.5 rounded-full transition-all duration-150 cursor-pointer text-center whitespace-normal ${
              selectedShift === 'Todos'
                ? 'bg-[#0071E3] text-white shadow-xs font-semibold'
                : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#F5F5F7]'
            }`}
          >
            Todas ({classes.length})
          </button>
          <button
            onClick={() => setSelectedShift('Turno Manhã')}
            type="button"
            className={`flex-1 sm:flex-initial min-h-[34px] px-3.5 py-1.5 rounded-full transition-all duration-150 cursor-pointer flex items-center justify-center text-center whitespace-normal gap-1.5 ${
              selectedShift === 'Turno Manhã'
                ? 'bg-[#0071E3] text-white shadow-xs font-semibold'
                : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#F5F5F7]'
            }`}
          >
            <Sun className={`w-3.5 h-3.5 shrink-0 ${selectedShift === 'Turno Manhã' ? 'text-white' : 'text-[#B25000]'}`} />
            <span>Manhã ({manhaCount})</span>
          </button>
          <button
            onClick={() => setSelectedShift('Turno Tarde')}
            type="button"
            className={`flex-1 sm:flex-initial min-h-[34px] px-3.5 py-1.5 rounded-full transition-all duration-150 cursor-pointer flex items-center justify-center text-center whitespace-normal gap-1.5 ${
              selectedShift === 'Turno Tarde'
                ? 'bg-[#0071E3] text-white shadow-xs font-semibold'
                : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#F5F5F7]'
            }`}
          >
            <Sunset className={`w-3.5 h-3.5 shrink-0 ${selectedShift === 'Turno Tarde' ? 'text-white' : 'text-[#0071E3]'}`} />
            <span>Tarde ({tardeCount})</span>
          </button>
        </div>

        <div className="flex items-center gap-2.5 flex-1 min-w-0 sm:max-w-md">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868B]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar turma, regente ou código SED..."
              className="w-full min-h-[42px] pl-10 pr-9 bg-white text-[#1D1D1F] text-sm rounded-full transition-all placeholder:text-[#86868B] border border-black/[0.08] shadow-2xs focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 focus:outline-hidden"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#86868B] hover:text-[#1D1D1F] cursor-pointer"
                aria-label="Limpar busca"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="inline-flex items-center p-1 bg-white rounded-full shrink-0 border border-black/[0.06] shadow-2xs gap-0.5">
            <button
              type="button"
              onClick={() => setTurmasViewMode('grid')}
              title="Grade de Cartões"
              aria-label="Visualizar em cartões"
              className={`min-h-[34px] min-w-[34px] p-1.5 rounded-full transition-all duration-150 cursor-pointer flex items-center justify-center ${
                turmasViewMode === 'grid'
                  ? 'bg-[#0071E3] text-white shadow-xs'
                  : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#F5F5F7]'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setTurmasViewMode('table')}
              title="Tabela de Dados"
              aria-label="Visualizar em tabela"
              className={`min-h-[34px] min-w-[34px] p-1.5 rounded-full transition-all duration-150 cursor-pointer flex items-center justify-center ${
                turmasViewMode === 'table'
                  ? 'bg-[#0071E3] text-white shadow-xs'
                  : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#F5F5F7]'
              }`}
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Exibição: Tabela ou Cartões Minimalistas (Oculto para PEB 1 para evitar card duplicado) */}
      {userRole !== 'usuario' && (() => {
        const totalClassPages = Math.max(1, Math.ceil(filteredClasses.length / PAGE_SIZE));
        const safeClassPage = Math.min(currentPage, totalClassPages);
        const visibleClassesSlice = showAllClasses
          ? filteredClasses
          : filteredClasses.slice((safeClassPage - 1) * PAGE_SIZE, safeClassPage * PAGE_SIZE);
        const handleClassPageChange = (nextPage: number) => {
          setCurrentPage(nextPage);
          if (classesTopRef.current) {
            classesTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        };

        return (
          <div ref={classesTopRef} className="space-y-4 scroll-mt-24">
            {turmasViewMode === 'table' ? (
        <div className="bg-white rounded-3xl overflow-x-auto border border-black/[0.06] shadow-sm">
          <table className="w-full text-left text-xs sm:text-[13px] min-w-[780px]">
            <thead className="bg-[#F5F5F7] text-[#86868B] font-medium text-xs border-b border-black/[0.06]">
              <tr>
                <th className="py-3.5 px-4">Turma</th>
                <th className="py-3.5 px-3">Turno e Sala</th>
                <th className="py-3.5 px-3">Regente</th>
                <th className="py-3.5 px-3 text-center">Estudantes</th>
                <th className="py-3.5 px-3 text-center">Frequência</th>
                <th className="py-3.5 px-3 text-center">Faltas</th>
                <th className="py-3.5 px-4 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {filteredClasses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[#86868B] text-sm">
                    Nenhuma turma encontrada.
                  </td>
                </tr>
              ) : (
                visibleClassesSlice.map((cls) => {
                  return (
                    <tr
                      key={cls.id}
                      onClick={() => onSelectClassForDetails(cls)}
                      className="odd:bg-[#F5F5F7]/30 hover:bg-[#F5F5F7] cursor-pointer transition-colors group border-b border-black/[0.04] last:border-b-0"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center shrink-0">
                            <Users className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-semibold text-sm text-[#1D1D1F] block">
                              {cls.name}
                            </span>
                            {cls.classeSedCode && (
                              <span className="font-mono text-xs text-[#86868B] tabular-nums">
                                SED {cls.classeSedCode}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-[#1D1D1F]">
                        <span className="block font-medium text-xs sm:text-sm">{cls.shift.replace('Turno ', '')}</span>
                        <span className="text-xs text-[#86868B]">{cls.room}</span>
                      </td>
                      <td className="py-3.5 px-3">
                        {cls.isVaga || cls.teacherName === 'TURMA VAGA' ? (
                          <span className="text-[#B25000] font-medium">Turma vaga</span>
                        ) : (
                          <span className="text-[#424245] block break-words max-w-[260px] leading-snug">
                            {cls.teacherName || 'Regente a atribuir'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-mono tabular-nums font-medium text-[#1D1D1F]">
                        {cls.totalStudents}
                      </td>
                      <td className="py-3 px-3 text-center font-mono tabular-nums font-semibold text-[#1B873F]">
                        {cls.presenceRate}%
                      </td>
                      <td className="py-3 px-3 text-center font-mono tabular-nums">
                        <span className={cls.monthlyAbsences > 0 ? 'text-[#D70015] font-semibold' : 'text-[#86868B]'}>
                          {cls.monthlyAbsences}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="inline-flex items-center gap-1 text-xs sm:text-[13px] font-medium text-[#0071E3] group-hover:translate-x-0.5 transition-transform">
                          <span>Alunos</span>
                          <ChevronRight className="w-4 h-4" />
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Cartões Ultra-Minimalistas (Clique direto abre os estudantes) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 items-stretch">
          {filteredClasses.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-black/[0.06] shadow-sm col-span-full space-y-3">
              <p className="text-sm sm:text-base text-[#86868B]">
                Nenhuma turma encontrada para "{searchTerm}".
              </p>
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="min-h-[40px] px-5 py-2 bg-[#0071E3] text-white font-medium rounded-full text-xs sm:text-sm cursor-pointer hover:bg-[#0077ED] transition-colors"
              >
                Limpar Busca
              </button>
            </div>
          ) : (
            visibleClassesSlice.map((cls) => {
              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => onSelectClassForDetails(cls)}
                  className="w-full min-w-0 text-left bg-white hover:bg-[#F5F5F7]/80 rounded-2xl p-5 border border-black/[0.06] shadow-sm card-interactive flex flex-col justify-between gap-3 cursor-pointer group min-h-[124px] transition-all"
                >
                  <div className="flex items-start justify-between gap-2.5 w-full min-w-0">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-full bg-[#0071E3]/10 group-hover:bg-[#0071E3] text-[#0071E3] group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                        <Users className="w-[18px] h-[18px]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-base sm:text-[17px] font-semibold text-[#1D1D1F] leading-snug break-words tracking-tight">
                          {cls.name}
                        </h2>
                        <p className="text-xs sm:text-[13px] text-[#86868B] break-words leading-snug">
                          {cls.shift.replace('Turno ', '')} · {cls.room}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                      <span className="font-mono font-semibold text-xs sm:text-[13px] text-[#1B873F] tabular-nums">
                        {cls.presenceRate}%
                      </span>
                      <ChevronRight className="w-4 h-4 text-[#86868B] group-hover:text-[#0071E3] group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>

                  <div className="w-full min-w-0 space-y-1 pt-0.5">
                    {cls.isVaga || cls.teacherName === 'TURMA VAGA' ? (
                      <p className="text-xs sm:text-[13px] font-medium text-[#B25000] break-words leading-snug">
                        Turma vaga
                      </p>
                    ) : (
                      <p className="text-xs sm:text-[13px] text-[#424245] break-words leading-snug">
                        {cls.teacherName || 'Regente a atribuir'}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#86868B] font-medium tabular-nums">
                      <span>{cls.totalStudents} estudantes</span>
                      <span aria-hidden="true">·</span>
                      <span className={cls.monthlyAbsences > 0 ? 'text-[#D70015] font-semibold' : ''}>
                        {formatFaltas(cls.monthlyAbsences)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
            )}

            {filteredClasses.length > PAGE_SIZE && (
              <PaginationBar
                currentPage={showAllClasses ? 1 : safeClassPage}
                totalItems={filteredClasses.length}
                pageSize={showAllClasses ? filteredClasses.length : PAGE_SIZE}
                onPageChange={handleClassPageChange}
                itemLabel="turmas"
                extraAction={
                  <button
                    type="button"
                    onClick={() => setShowAllClasses((prev) => !prev)}
                    className="px-3 py-1 rounded-full bg-[#F5F5F7] hover:bg-black/[0.05] text-[#0071E3] text-xs font-medium cursor-pointer transition-colors"
                  >
                    {showAllClasses ? `Paginar (${PAGE_SIZE} por página)` : `Ver todas (${filteredClasses.length})`}
                  </button>
                }
              />
            )}
          </div>
        );
      })()}
    </div>
  );
};

