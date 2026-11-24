import React, { useMemo, useState } from 'react';
import { NoticePriority, NoticeReadReceipt, SchoolNotice } from '../types';
import { toast } from 'sonner';
import { SFSymbol } from './ui/SFSymbol';
import { triggerMenuHaptic } from '../utils/haptics';

interface QuadroAvisosDirecaoProps {
  notices: SchoolNotice[];
  canManage: boolean;
  userEmail?: string;
  userName?: string;
  userRoleLabel?: string;
  onSaveNotices?: (updatedNotices: SchoolNotice[]) => void;
  onMarkNoticesRead?: (
    noticeIds: string[],
    reader: { userEmail: string; userName: string; userRole?: string }
  ) => void;
}

const READ_NOTICES_STORAGE_KEY = 'emeb_candelario_read_notices_2027_v1';
const MAX_SHORT_MESSAGE_LENGTH = 280;

const getReadMap = (email: string): Record<string, boolean> => {
  try {
    const raw = localStorage.getItem(
      `${READ_NOTICES_STORAGE_KEY}_${email.trim().toLowerCase()}`
    );
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore storage read error
  }
  return {};
};

const saveReadMap = (email: string, map: Record<string, boolean>) => {
  try {
    localStorage.setItem(
      `${READ_NOTICES_STORAGE_KEY}_${email.trim().toLowerCase()}`,
      JSON.stringify(map)
    );
  } catch {
    // ignore storage write error
  }
};

const PRIORITY_META: Record<
  NoticePriority,
  { label: string; dataStatus: 'danger' | 'warning' | 'info'; surfaceClass: string }
> = {
  urgente: {
    label: 'Urgente',
    dataStatus: 'danger',
    surfaceClass: 'bg-[#fff1f2]',
  },
  importante: {
    label: 'Importante',
    dataStatus: 'warning',
    surfaceClass: 'bg-[#fffbeb]',
  },
  informativo: {
    label: 'Informativo',
    dataStatus: 'info',
    surfaceClass: 'bg-[#f1f5fb]',
  },
};

export const QuadroAvisosDirecao: React.FC<QuadroAvisosDirecaoProps> = ({
  notices,
  canManage,
  userEmail = 'equipe@educacao.jundiai.sp.gov.br',
  userName = 'Equipe Escolar',
  userRoleLabel = 'Equipe Escolar',
  onSaveNotices,
  onMarkNoticesRead,
}) => {
  const isAdminEditor = canManage && Boolean(onSaveNotices);
  const normalizedCurrentEmail = userEmail.trim().toLowerCase();

  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<NoticePriority>('importante');
  const [pinned, setPinned] = useState(true);
  const [showAllNotices, setShowAllNotices] = useState(false);
  const [expandedReadersByNoticeId, setExpandedReadersByNoticeId] = useState<
    Record<string, boolean>
  >({});

  const [localReadMap, setLocalReadMap] = useState<Record<string, boolean>>(() =>
    getReadMap(normalizedCurrentEmail)
  );

  const visibleNotices = useMemo(() => {
    const prioWeight: Record<NoticePriority, number> = {
      urgente: 3,
      importante: 2,
      informativo: 1,
    };

    return notices
      .filter((n) => n.active !== false)
      .sort((a, b) => {
        if (Boolean(a.pinned) !== Boolean(b.pinned)) {
          return a.pinned ? -1 : 1;
        }
        if (prioWeight[a.priority] !== prioWeight[b.priority]) {
          return prioWeight[b.priority] - prioWeight[a.priority];
        }
        return (b.updatedAtMs || 0) - (a.updatedAtMs || 0);
      });
  }, [notices]);

  const displayedNotices = showAllNotices
    ? visibleNotices
    : visibleNotices.slice(0, 3);

  const hasCurrentUserRead = (notice: SchoolNotice): boolean => {
    if (
      Array.isArray(notice.readBy) &&
      notice.readBy.some(
        (r) => r.userEmail.trim().toLowerCase() === normalizedCurrentEmail
      )
    ) {
      return true;
    }
    return Boolean(localReadMap[notice.id]);
  };

  const unreadNotices = useMemo(
    () => visibleNotices.filter((n) => !hasCurrentUserRead(n)),
    [visibleNotices, localReadMap, normalizedCurrentEmail]
  );

  const resetComposer = () => {
    setEditingNoticeId(null);
    setTitle('');
    setContent('');
    setPriority('importante');
    setPinned(true);
    setIsComposerOpen(false);
  };

  const handleOpenNew = () => {
    setEditingNoticeId(null);
    setTitle('');
    setContent('');
    setPriority('importante');
    setPinned(true);
    setIsComposerOpen(true);
  };

  const handleStartEdit = (notice: SchoolNotice) => {
    setEditingNoticeId(notice.id);
    setTitle(notice.title === 'Aviso da Direção' ? '' : notice.title);
    setContent(notice.content);
    setPriority(notice.priority);
    setPinned(Boolean(notice.pinned));
    setIsComposerOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveNotices) return;

    const cleanContent = content.trim().slice(0, MAX_SHORT_MESSAGE_LENGTH);
    if (!cleanContent) return;

    const cleanTitle = title.trim() || 'Aviso da Direção';
    const nowMs = Date.now();
    const nowISO = new Date(nowMs).toISOString();

    if (editingNoticeId) {
      const updated = notices.map((n) =>
        n.id === editingNoticeId
          ? {
              ...n,
              title: cleanTitle,
              content: cleanContent,
              priority,
              pinned,
              targetAudience: 'all' as const,
              updatedAtMs: nowMs,
            }
          : n
      );
      onSaveNotices(updated);
      toast.success('Aviso atualizado no Quadro da Direção.');
    } else {
      const newNotice: SchoolNotice = {
        id: `notice-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
        title: cleanTitle,
        content: cleanContent,
        priority,
        authorName: userName?.trim() || 'Direção Escolar',
        authorEmail: userEmail,
        createdAtISO: nowISO,
        updatedAtMs: nowMs,
        pinned,
        active: true,
        targetAudience: 'all',
        readBy: [],
      };
      onSaveNotices([newNotice, ...notices]);
      toast.success('Aviso publicado para toda a equipe escolar.');
    }

    resetComposer();
  };

  const handleTogglePin = (id: string) => {
    if (!onSaveNotices) return;
    const nowMs = Date.now();
    onSaveNotices(
      notices.map((n) =>
        n.id === id ? { ...n, pinned: !n.pinned, updatedAtMs: nowMs } : n
      )
    );
  };

  const handleDelete = (id: string) => {
    if (!onSaveNotices) return;
    onSaveNotices(notices.filter((n) => n.id !== id));
    toast.success('Aviso removido do quadro.');
  };

  const persistReadReceipts = (noticeIds: string[]) => {
    if (noticeIds.length === 0) return;

    const nextMap = { ...localReadMap };
    noticeIds.forEach((id) => {
      nextMap[id] = true;
    });
    setLocalReadMap(nextMap);
    saveReadMap(normalizedCurrentEmail, nextMap);

    const readerPayload = {
      userEmail: normalizedCurrentEmail,
      userName: userName?.trim() || normalizedCurrentEmail,
      userRole: userRoleLabel,
    };

    if (onMarkNoticesRead) {
      onMarkNoticesRead(noticeIds, readerPayload);
      return;
    }

    if (onSaveNotices) {
      const nowISO = new Date().toISOString();
      const idSet = new Set(noticeIds);
      const updated = notices.map((notice) => {
        if (!idSet.has(notice.id)) return notice;
        const existingReaders = Array.isArray(notice.readBy) ? notice.readBy : [];
        const alreadyRecorded = existingReaders.some(
          (r) => r.userEmail.trim().toLowerCase() === normalizedCurrentEmail
        );
        if (alreadyRecorded) return notice;
        return {
          ...notice,
          readBy: [
            {
              userEmail: normalizedCurrentEmail,
              userName: readerPayload.userName,
              userRole: readerPayload.userRole,
              readAtISO: nowISO,
            },
            ...existingReaders,
          ],
        };
      });
      onSaveNotices(updated);
    }
  };

  const handleMarkRead = (id: string) => {
    persistReadReceipts([id]);
    toast.success('Ciência registrada com sucesso.');
  };

  const handleMarkAllRead = () => {
    const ids = unreadNotices.map((n) => n.id);
    if (ids.length === 0) return;
    persistReadReceipts(ids);
    toast.success('Ciência registrada em todos os avisos.');
  };

  const toggleReadersPanel = (noticeId: string) => {
    setExpandedReadersByNoticeId((prev) => ({
      ...prev,
      [noticeId]: !prev[noticeId],
    }));
  };

  const formatNoticeDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const formatReadDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      const dateStr = d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      });
      const timeStr = d.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      return `${dateStr} · ${timeStr}`;
    } catch {
      return '';
    }
  };

  const remainingChars = MAX_SHORT_MESSAGE_LENGTH - content.length;

  return (
    <section
      id="quadro-avisos-direcao"
      aria-label="Quadro de Avisos da Direção"
      className="bg-white rounded-3xl p-5 sm:p-6 shadow-[0_8px_28px_-10px_rgba(9,15,29,0.08)] space-y-4 min-w-0"
    >
      {/* Cabeçalho do Quadro */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#0e3a8a] text-white flex items-center justify-center shrink-0 shadow-xs">
            <SFSymbol name="campaign" filled size={21} weight={500} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold text-[#071e46] tracking-tight text-balance break-words">
              Quadro de Avisos da Direção
            </h2>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs sm:text-[13px] text-slate-600 mt-0.5">
              <span>Visível para toda a equipe escolar</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums font-medium text-[#071e46]">
                {visibleNotices.length}{' '}
                {visibleNotices.length === 1 ? 'aviso ativo' : 'avisos ativos'}
              </span>
              {unreadNotices.length > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span
                    data-status="danger"
                    className="px-2 py-0.5 rounded-md text-[11px] font-medium text-white tabular-nums"
                  >
                    {unreadNotices.length}{' '}
                    {unreadNotices.length === 1 ? 'pendente de ciência' : 'pendentes de ciência'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {unreadNotices.length > 0 && (
            <button
              type="button"
              onClick={() => {
                triggerMenuHaptic('light');
                handleMarkAllRead();
              }}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#eef3fa] hover:bg-[#dfe9f7] text-[#071e46] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-all duration-200 active:scale-[0.97]"
            >
              <SFSymbol name="done_all" size={17} weight={500} className="text-[#047857] shrink-0" />
              <span>Dar ciência em tudo</span>
            </button>
          )}

          {isAdminEditor && !isComposerOpen && (
            <button
              type="button"
              onClick={() => {
                triggerMenuHaptic('light');
                handleOpenNew();
              }}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0e3a8a] hover:bg-[#0a2d6b] text-white text-xs sm:text-[13px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-all duration-200 active:scale-[0.97] shadow-[0_6px_16px_rgba(14,58,138,0.24)]"
            >
              <SFSymbol name="add" size={17} weight={550} className="shrink-0" />
              <span>Postar Aviso</span>
            </button>
          )}
        </div>
      </div>

      {/* Formulário Rápido de Mensagem Curta (Exclusivo Administradores) */}
      {isAdminEditor && isComposerOpen && (
        <form
          onSubmit={handleSubmit}
          className="p-4 rounded-2xl bg-[#f1f5fb] space-y-3 animate-fade-in"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[#071e46]">
              {editingNoticeId
                ? 'Editar aviso da Direção'
                : 'Nova mensagem curta para toda a equipe'}
            </h3>
            <button
              type="button"
              onClick={resetComposer}
              className="min-h-[36px] px-2.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-[#071e46] hover:bg-[#e2e8f0] inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              <SFSymbol name="close" size={16} />
              <span>Cancelar</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label
                htmlFor="direcao-notice-title"
                className="block text-xs font-semibold text-slate-800 mb-1"
              >
                Assunto (opcional)
              </label>
              <input
                id="direcao-notice-title"
                type="text"
                maxLength={80}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Conselho de Classe / Fechamento de Chamada"
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-white text-slate-950 placeholder:text-slate-600 text-sm font-medium transition-colors"
              />
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-800 mb-1">
                Prioridade
              </span>
              <div
                role="group"
                aria-label="Prioridade do aviso"
                className="grid grid-cols-3 gap-1 p-1 bg-white rounded-xl shadow-xs"
              >
                {(['informativo', 'importante', 'urgente'] as NoticePriority[]).map(
                  (level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => {
                        triggerMenuHaptic('light');
                        setPriority(level);
                      }}
                      aria-pressed={priority === level}
                      data-status={
                        priority === level
                          ? level === 'urgente'
                            ? 'danger'
                            : level === 'importante'
                            ? 'warning'
                            : 'info'
                          : undefined
                      }
                      className={`min-h-[34px] px-2 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-all duration-200 ${
                        priority === level
                          ? 'text-white'
                          : 'text-[#0a2d6b] hover:bg-[#eef3fa]'
                      }`}
                    >
                      {PRIORITY_META[level].label}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label
                htmlFor="direcao-notice-content"
                className="text-xs font-semibold text-slate-800"
              >
                Mensagem curta para a equipe escolar
              </label>
              <span
                className={`text-xs font-medium tabular-nums ${
                  remainingChars < 30 ? 'text-[#92400e] font-bold' : 'text-slate-700'
                }`}
              >
                {content.length}/{MAX_SHORT_MESSAGE_LENGTH}
              </span>
            </div>
            <textarea
              id="direcao-notice-content"
              required
              rows={2}
              maxLength={MAX_SHORT_MESSAGE_LENGTH}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escreva um recado direto para docentes e funcionários..."
              className="w-full p-3 rounded-xl bg-white text-slate-950 placeholder:text-slate-600 text-sm leading-relaxed transition-colors resize-none"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <label className="inline-flex items-center gap-2 text-xs sm:text-[13px] font-semibold text-slate-900 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                className="w-4 h-4 rounded accent-[#14428c]"
              />
              <span>Fixar no topo do quadro</span>
            </label>

            <button
              type="submit"
              disabled={!content.trim()}
              className="w-full sm:w-auto min-h-[42px] px-5 py-2 rounded-xl bg-[#0e3a8a] hover:bg-[#0a2d6b] disabled:opacity-50 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-all duration-200 active:scale-[0.97]"
            >
              <SFSymbol name="send" filled size={16} className="shrink-0" />
              <span>{editingNoticeId ? 'Salvar alterações' : 'Publicar para equipe'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Lista de Mensagens / Estado Vazio */}
      {visibleNotices.length === 0 ? (
        <div className="py-6 px-4 rounded-2xl bg-[#f1f5fb] text-center space-y-2.5">
          <p className="text-sm font-medium text-slate-700">
            Nenhum aviso publicado pela Direção no momento.
          </p>
          {isAdminEditor && !isComposerOpen && (
            <button
              type="button"
              onClick={() => {
                triggerMenuHaptic('light');
                handleOpenNew();
              }}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0e3a8a] hover:bg-[#0a2d6b] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all duration-200 active:scale-[0.97]"
            >
              <SFSymbol name="add" size={16} />
              <span>Publicar primeiro aviso</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {displayedNotices.map((notice) => {
            const meta = PRIORITY_META[notice.priority] || PRIORITY_META.informativo;
            const isRead = hasCurrentUserRead(notice);
            const readersList: NoticeReadReceipt[] = Array.isArray(notice.readBy)
              ? [...notice.readBy].sort(
                  (a, b) =>
                    new Date(b.readAtISO).getTime() - new Date(a.readAtISO).getTime()
                )
              : [];
            const isReadersExpanded = Boolean(expandedReadersByNoticeId[notice.id]);
            const hasDistinctTitle =
              notice.title &&
              notice.title.trim().length > 0 &&
              notice.title.trim() !== 'Aviso da Direção';

            return (
              <article
                key={notice.id}
                className={`p-4 rounded-2xl ${meta.surfaceClass} transition-all duration-200 space-y-2.5 min-w-0`}
              >
                {/* Linha superior de metadados com tag colorida de status em fonte branca */}
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-xs text-slate-600">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                    <span
                      data-status={meta.dataStatus}
                      className="px-2 py-0.5 rounded-md text-[11px] font-medium text-white leading-tight"
                    >
                      {meta.label}
                    </span>
                    {notice.pinned && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-[#071e46] inline-flex items-center gap-1">
                          <SFSymbol name="push_pin" filled size={13} className="text-[#0e3a8a]" />
                          <span>Fixado</span>
                        </span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-slate-800 break-words">
                      {notice.authorName || 'Direção Escolar'}
                    </span>
                  </div>

                  <time
                    dateTime={notice.createdAtISO}
                    className="tabular-nums font-medium text-slate-600 shrink-0"
                  >
                    {formatNoticeDate(notice.createdAtISO)}
                  </time>
                </div>

                {/* Conteúdo do Aviso */}
                <div className="space-y-1 min-w-0">
                  {hasDistinctTitle && (
                    <h3 className="text-sm sm:text-[15px] font-semibold text-[#071e46] leading-snug break-words">
                      {notice.title}
                    </h3>
                  )}
                  <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line break-words">
                    {notice.content}
                  </p>
                </div>

                {/* Rodapé de Leitura e Gestão */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {!isRead ? (
                      <button
                        type="button"
                        onClick={() => {
                          triggerMenuHaptic('light');
                          handleMarkRead(notice.id);
                        }}
                        className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[#0e3a8a] hover:bg-[#0a2d6b] text-white font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all duration-200 active:scale-[0.97]"
                      >
                        <SFSymbol name="check" size={15} weight={600} className="shrink-0" />
                        <span>Dar ciência</span>
                      </button>
                    ) : (
                      <span
                        data-status="success"
                        className="min-h-[30px] px-2.5 py-1 rounded-lg font-medium text-white inline-flex items-center gap-1.5"
                      >
                        <SFSymbol name="done_all" size={15} weight={550} className="shrink-0" />
                        <span>Ciência confirmada</span>
                      </span>
                    )}

                    {isAdminEditor && (
                      <button
                        type="button"
                        onClick={() => {
                          triggerMenuHaptic('light');
                          toggleReadersPanel(notice.id);
                        }}
                        aria-expanded={isReadersExpanded}
                        className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all duration-200 ${
                          isReadersExpanded
                            ? 'bg-[#0e3a8a] text-white shadow-xs'
                            : 'bg-white hover:bg-[#eef3fa] text-[#071e46] shadow-xs'
                        }`}
                      >
                        <SFSymbol name="groups" filled size={15} className="shrink-0" />
                        <span className="tabular-nums">
                          Confirmados ({readersList.length})
                        </span>
                        <SFSymbol
                          name={isReadersExpanded ? 'expand_less' : 'expand_more'}
                          size={16}
                          className="shrink-0"
                        />
                      </button>
                    )}
                  </div>

                  {isAdminEditor && (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          triggerMenuHaptic('light');
                          handleTogglePin(notice.id);
                        }}
                        className="font-semibold text-slate-700 hover:text-[#071e46] inline-flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors"
                      >
                        <SFSymbol
                          name={notice.pinned ? 'keep_off' : 'push_pin'}
                          size={15}
                        />
                        <span>{notice.pinned ? 'Desafixar' : 'Fixar'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          triggerMenuHaptic('light');
                          handleStartEdit(notice);
                        }}
                        className="font-semibold text-[#0e3a8a] hover:underline inline-flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors"
                      >
                        <SFSymbol name="edit" size={15} />
                        <span>Editar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          triggerMenuHaptic('medium');
                          handleDelete(notice.id);
                        }}
                        className="font-semibold text-[#be123c] hover:underline inline-flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors"
                      >
                        <SFSymbol name="delete" size={15} />
                        <span>Excluir</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Lista de Confirmações de Leitura da Equipe (Visível para Administrador) */}
                {isAdminEditor && isReadersExpanded && (
                  <div className="pt-2.5 space-y-2 animate-fade-in">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#071e46]">
                        Equipe que confirmou a leitura
                      </span>
                      <span className="tabular-nums font-medium text-slate-600">
                        {readersList.length}{' '}
                        {readersList.length === 1 ? 'confirmação' : 'confirmações'}
                      </span>
                    </div>

                    {readersList.length === 0 ? (
                      <p className="text-xs text-slate-600 py-1">
                        Nenhum membro da equipe clicou em &ldquo;Dar ciência&rdquo; neste comunicado ainda.
                      </p>
                    ) : (
                      <ul className="space-y-1 bg-white/95 rounded-xl p-2">
                        {readersList.map((reader, idx) => (
                          <li
                            key={reader.userEmail}
                            className={`py-2 px-2.5 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs min-w-0 ${
                              idx % 2 === 1 ? 'bg-[#f1f5fb]' : 'bg-white'
                            }`}
                          >
                            <div className="min-w-0">
                              <span className="font-semibold text-[#071e46] block break-words">
                                {reader.userName}
                              </span>
                              <span className="text-slate-600 break-all">
                                {reader.userRole ? `${reader.userRole} · ` : ''}
                                {reader.userEmail}
                              </span>
                            </div>
                            <time
                              dateTime={reader.readAtISO}
                              className="tabular-nums font-semibold text-slate-700 shrink-0"
                            >
                              {formatReadDateTime(reader.readAtISO)}
                            </time>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Botão para ver avisos extras além dos 3 principais */}
      {visibleNotices.length > 3 && (
        <div className="pt-1 flex justify-center">
          <button
            type="button"
            onClick={() => {
              triggerMenuHaptic('light');
              setShowAllNotices((prev) => !prev);
            }}
            className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#eef3fa] hover:bg-[#dfe9f7] text-[#071e46] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
          >
            <SFSymbol
              name={showAllNotices ? 'expand_less' : 'expand_more'}
              size={17}
            />
            <span>
              {showAllNotices
                ? 'Mostrar menos avisos'
                : `Ver todos os ${visibleNotices.length} avisos`}
            </span>
          </button>
        </div>
      )}
    </section>
  );
};
