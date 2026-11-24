import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Student } from '../types';
import { StudentAvatar } from './StudentAvatar';
import { uploadStudentPhotoViaApi } from '../services/db';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import { ModalPortal } from './ui/ModalPortal';
import { isSupportedImageFile, collectFilesFromDataTransfer } from '../utils/photoCompressor';
import {
  compressPhotoLosslessWithCanvas,
  persistSingleStudentPhotoToIndexedDb,
} from '../services/photoIndexedDbCache';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  FolderUp,
  Images,
  Info,
  Trash2,
  X,
} from 'lucide-react';

interface UploadFotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  className: string;
  classStudents?: Student[];
  onSelectStudent?: (student: Student) => void;
  onSavePhoto: (
    studentId: string,
    newPhotoUrl: string,
    driveLink?: string,
    driveFileId?: string,
    isManualLink?: boolean
  ) => void;
  onSyncDrivePhotos?: () => Promise<void>;
}

export const UploadFotoModal: React.FC<UploadFotoModalProps> = ({
  isOpen,
  onClose,
  student,
  className,
  classStudents = [],
  onSelectStudent,
  onSavePhoto,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string>(student?.photo || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const carouselContainerRef = useRef<HTMLDivElement>(null);

  // Habilita seleção de pasta completa no input nativo
  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute('webkitdirectory', '');
      folderInputRef.current.setAttribute('directory', '');
    }
  }, []);

  // Bloqueio de rolagem da página de fundo enquanto o modal estiver aberto
  useModalScrollLock(isOpen);

  // Sync state whenever active student changes (e.g. via carousel navigation)
  useEffect(() => {
    if (student) {
      setPreviewUrl(student.photo || '');
      setStatusMsg(null);
      setUploadSuccess(false);
    }
  }, [student?.id, student?.photo]);

  // Order students in class numerically
  const sortedStudents = useMemo(() => {
    if (!classStudents || classStudents.length === 0) {
      return student ? [student] : [];
    }
    return [...classStudents].sort((a, b) => (a.number || 0) - (b.number || 0));
  }, [classStudents, student]);

  const currentIndex = useMemo(() => {
    if (!student) return -1;
    return sortedStudents.findIndex((s) => s.id === student.id);
  }, [sortedStudents, student?.id]);

  const totalStudents = sortedStudents.length;
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex >= 0 && currentIndex < totalStudents - 1;

  const handlePrevStudent = () => {
    if (canGoPrev && onSelectStudent) {
      onSelectStudent(sortedStudents[currentIndex - 1]);
    }
  };

  const handleNextStudent = () => {
    if (canGoNext && onSelectStudent) {
      onSelectStudent(sortedStudents[currentIndex + 1]);
    }
  };

  // Auto-scroll active student in carousel strip into view
  useEffect(() => {
    if (!student || !carouselContainerRef.current) return;
    const activeBtn = carouselContainerRef.current.querySelector<HTMLButtonElement>(
      `[data-student-id="${student.id}"]`
    );
    if (activeBtn) {
      activeBtn.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [student?.id]);

  // Keyboard navigation with Left and Right arrow keys when not typing
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevStudent();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextStudent();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, canGoPrev, canGoNext, currentIndex, sortedStudents]);

  const normalizePhotoText = (str: string): string =>
    str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const matchPhotoToClassStudent = (
    file: File,
    students: Student[],
    fallbackStudent: Student | null,
    isSingleSelection: boolean
  ): { student: Student | null; reason: string } => {
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const cleanDigits = (baseName.match(/\d{5,12}/) || [])[0];

    // 1. RA Oficial (5 a 12 dígitos contínuos no nome)
    if (cleanDigits && students.length > 0) {
      for (const st of students) {
        const stRa = (st.ra || '').replace(/\D/g, '');
        if (stRa && stRa.includes(cleanDigits)) {
          return { student: st, reason: `RA Oficial (${cleanDigits})` };
        }
      }
    }

    // 2. Número da Chamada (ex: "01.jpg", "02.png", "1.webp", "Nº 05", "Chamada 12", "01 - Gabriel")
    const numCallMatch = baseName.match(/(?:^|[-_#\s]|N[ºo]?\s*|chamada\s*)0?(\d{1,2})(?:[-_\s.]|$)/i);
    if (numCallMatch && students.length > 0) {
      const callNum = parseInt(numCallMatch[1], 10);
      const foundByNumber = students.find((s) => s.number === callNum);
      if (foundByNumber) {
        return { student: foundByNumber, reason: `Nº da Chamada ${callNum}` };
      }
    }

    // 3. Nome do Estudante (limpa prefixos comuns como IMG_, FOTO_, ALUNO_, etc.)
    const normFile = normalizePhotoText(baseName)
      .replace(/^(IMG|FOTO|ALUNO|ALUNA|ESTUDANTE|DOC|DSC|DSCN|SCAN|WHATSAPP IMAGE)\s*[-_]?\s*/i, '')
      .replace(/\s*\(\d+\)$/, '')
      .replace(/^[0-9]{1,3}\s*[-_]\s*/, '')
      .trim();

    if (normFile.length >= 3 && students.length > 0) {
      // 3a. Nome Completo Exato
      for (const st of students) {
        const normSt = normalizePhotoText(st.name || st.estudante || '');
        if (normSt && (normSt === normFile || normFile === normSt)) {
          return { student: st, reason: 'Nome Completo' };
        }
      }

      // 3b. Primeiro e Último Nome
      const fileTokens = normFile.split(' ').filter((t) => t.length > 1);
      if (fileTokens.length >= 2) {
        const firstF = fileTokens[0];
        const lastF = fileTokens[fileTokens.length - 1];
        for (const st of students) {
          const stTokens = normalizePhotoText(st.name || st.estudante || '').split(' ').filter((t) => t.length > 1);
          if (stTokens.length >= 2) {
            if (stTokens[0] === firstF && stTokens[stTokens.length - 1] === lastF) {
              return { student: st, reason: 'Primeiro e Último Nome' };
            }
          }
        }
      }
    }

    // 4. Se foi selecionado exatamente 1 arquivo e não combinou com nenhum outro, atribui ao aluno ativo
    if (isSingleSelection && fallbackStudent) {
      return { student: fallbackStudent, reason: 'Aluno Selecionado' };
    }

    return { student: null, reason: 'Não identificado' };
  };

  const processBatchFiles = async (files: File[]) => {
    const valid = files.filter(isSupportedImageFile);
    if (valid.length === 0) {
      setStatusMsg('Nenhuma imagem válida selecionada (formatos: JPG, PNG, WebP, HEIC, AVIF, BMP, GIF, SVG, TIFF).');
      return;
    }

    setIsProcessing(true);
    setUploadSuccess(false);

    const total = valid.length;
    const isSingle = total === 1;
    let savedCount = 0;
    let identicalCount = 0;
    const unmatchedNames: string[] = [];

    for (let i = 0; i < total; i++) {
      const file = valid[i];
      const match = matchPhotoToClassStudent(file, sortedStudents, student, isSingle);
      const targetStudent = match.student;

      if (!targetStudent) {
        unmatchedNames.push(file.name);
        continue;
      }

      setStatusMsg(
        total > 1
          ? `Otimizando foto ${i + 1} de ${total}: Nº ${targetStudent.number} - ${targetStudent.name.split(' ')[0]}...`
          : 'Decodificando e otimizando foto sem perdas visuais...'
      );

      try {
        const optimized = await compressPhotoLosslessWithCanvas(file, {
          maxDimension: 520,
          initialQuality: 0.9,
          minQuality: 0.75,
          targetMaxBytes: 56 * 1024,
          includeDataUrl: true,
        });

        const dataUrl = optimized.dataUrl || '';
        if (!dataUrl) {
          unmatchedNames.push(`${file.name} (erro de decodificação)`);
          continue;
        }

        if (
          targetStudent.photoSha256 &&
          targetStudent.photoSha256 === optimized.sha256 &&
          targetStudent.photo
        ) {
          identicalCount++;
          if (targetStudent.id === student?.id) {
            setPreviewUrl(targetStudent.photo);
          }
          continue;
        }

        const apiRes = await uploadStudentPhotoViaApi(targetStudent.id, {
          bytes: optimized.bytes,
          sha256: optimized.sha256,
          mimeType: optimized.mimeType,
          fallbackDataUrl: dataUrl,
        });

        const finalUrl = apiRes.photoUrl || dataUrl;

        void persistSingleStudentPhotoToIndexedDb({
          studentId: targetStudent.id,
          ra: targetStudent.ra,
          name: targetStudent.estudante || targetStudent.name,
          photoUrl: finalUrl,
          isManualLink: true,
          sha256: optimized.sha256,
          blob: optimized.blob,
          updatedAtMs: Date.now(),
        });

        onSavePhoto(targetStudent.id, finalUrl, undefined, undefined, true);
        savedCount++;

        if (targetStudent.id === student?.id) {
          setPreviewUrl(finalUrl);
        }
      } catch (err) {
        console.warn(`Erro ao salvar foto ${file.name}:`, err);
        unmatchedNames.push(`${file.name} (erro ao salvar)`);
      }
    }

    setIsProcessing(false);

    if (savedCount > 0 || identicalCount > 0) {
      setUploadSuccess(true);
      const messages: string[] = [];
      if (savedCount > 0) {
        messages.push(
          total === 1
            ? '✓ Foto otimizada e sincronizada para a escola!'
            : `✓ ${savedCount} foto(s) associada(s) e sincronizada(s) para a turma!`
        );
      }
      if (identicalCount > 0) {
        messages.push(`${identicalCount} foto(s) idêntica(s) já existente(s)`);
      }
      if (unmatchedNames.length > 0) {
        messages.push(
          `${unmatchedNames.length} pendente(s) (dica: use 01.jpg, 02.jpg ou RA)`
        );
      }
      setStatusMsg(messages.join(' · '));
      setTimeout(() => setUploadSuccess(false), 3500);
    } else if (unmatchedNames.length > 0) {
      setStatusMsg(
        `Nenhuma foto foi associada aos estudantes desta turma (${className}). ` +
        `Dica: nomeie as fotos com o Nº da Chamada (ex: 01.jpg, 02.png), RA ou nome do estudante.`
      );
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      await processBatchFiles(files);
    }
    if (e.target) e.target.value = '';
  };

  const handleFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      await processBatchFiles(files);
    }
    if (e.target) e.target.value = '';
  };

  const handleRemovePhoto = async () => {
    if (!student) return;
    setIsProcessing(true);
    try {
      setPreviewUrl('');
      onSavePhoto(student.id, '', '', '', false);
      setStatusMsg('Foto do estudante removida.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!student || isProcessing) return;
    try {
      const collected = await collectFilesFromDataTransfer(e.dataTransfer, isSupportedImageFile);
      const files = collected.map((c) => c.file);
      if (files.length > 0) {
        await processBatchFiles(files);
      } else {
        const rawFiles = Array.from(e.dataTransfer.files || []).filter(isSupportedImageFile);
        if (rawFiles.length > 0) {
          await processBatchFiles(rawFiles);
        } else {
          setStatusMsg('Nenhum arquivo de imagem compatível foi solto.');
        }
      }
    } catch {
      const fallbackFiles = Array.from(e.dataTransfer.files || []).filter(isSupportedImageFile);
      if (fallbackFiles.length > 0) {
        await processBatchFiles(fallbackFiles);
      } else {
        setStatusMsg('Erro ao ler arquivos soltos.');
      }
    }
  };

  if (!isOpen || !student) return null;

  return (
    <ModalPortal onClose={onClose}>
      <div
        onClick={onClose}
        className="fixed inset-0 z-[120] overflow-hidden flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Foto do estudante — ${student.name}`}
          onClick={(e) => e.stopPropagation()}
          className="modal-shell w-full max-w-xl rounded-3xl overflow-hidden flex flex-col max-h-[88dvh] animate-apple-pop"
        >
        {/* Header Modal com Título e Fechar */}
        <div className="modal-header-surface flex items-center justify-between p-4 sm:p-5 pb-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#eef3f9] text-[#14428c] flex items-center justify-center shrink-0">
              <Camera className="w-[22px] h-[22px]" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-950 break-words leading-snug">
                Foto do Estudante (PEB I)
              </h3>
              <p className="text-xs text-slate-700 break-words font-semibold">
                {className} · EMEB Prof. Joaquim Candelário de Freitas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#eef3f9] hover:bg-[#e2e8f0] text-slate-900 flex items-center justify-center cursor-pointer transition-colors shrink-0"
            aria-label="Fechar"
          >
            <X className="w-[18px] h-[18px]" strokeWidth={2} />
          </button>
        </div>

        {/* CARROSSEL DE ALUNOS DA TURMA */}
        {totalStudents > 1 && (
          <div className="bg-[#f3f6fb] px-4 py-2.5 shrink-0 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handlePrevStudent}
                disabled={!canGoPrev}
                className="flex items-center gap-1 font-bold text-slate-800 hover:text-slate-950 disabled:opacity-30 disabled:hover:text-slate-800 cursor-pointer disabled:cursor-not-allowed transition-colors"
              >
                <ArrowLeft className="w-4 h-4" strokeWidth={2} />
                <span>Anterior</span>
              </button>

              <div className="flex items-center gap-1.5 font-medium text-slate-700">
                <span className="font-bold text-slate-950 tabular-nums">
                  {currentIndex >= 0 ? currentIndex + 1 : 1}
                </span>
                <span>de</span>
                <span className="font-bold text-slate-950 tabular-nums">{totalStudents}</span>
                <span className="text-xs text-slate-700">alunos</span>
              </div>

              <button
                type="button"
                onClick={handleNextStudent}
                disabled={!canGoNext}
                className="flex items-center gap-1 font-bold text-slate-800 hover:text-slate-950 disabled:opacity-30 disabled:hover:text-slate-800 cursor-pointer disabled:cursor-not-allowed transition-colors"
              >
                <span>Próximo</span>
                <ArrowRight className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>

            {/* Strip horizontal rolável de alunos */}
            <div
              ref={carouselContainerRef}
              className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 scrollbar-thin scrollbar-thumb-slate-300"
            >
              {sortedStudents.map((st) => {
                const isCurrent = st.id === student.id;
                const hasPhoto = Boolean(st.photo);
                return (
                  <button
                    key={st.id}
                    type="button"
                    data-student-id={st.id}
                    onClick={() => onSelectStudent?.(st)}
                    className={`shrink-0 flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-all duration-200 cursor-pointer active:scale-[0.97] ${
                      isCurrent
                        ? 'bg-[#14428c] text-white shadow-sm'
                        : 'bg-white hover:bg-[#eef3f9] text-slate-900 shadow-xs'
                    }`}
                    title={`Nº ${st.number} - ${st.name} (${hasPhoto ? 'Com foto' : 'Sem foto'})`}
                  >
                    <div className="relative shrink-0">
                      <StudentAvatar
                        student={st}
                        size="sm"
                        expandableOnClick={false}
                        className="w-6 h-6 rounded-lg object-cover"
                      />
                      {hasPhoto && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-600 rounded-full shadow-xs" />
                      )}
                    </div>
                    <span className="text-xs font-bold tabular-nums">
                      Nº {st.number.toString().padStart(2, '0')}
                    </span>
                    <span className="text-xs font-semibold whitespace-nowrap">
                      {st.name.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Scrollable Body */}
        <div className="modal-scroll-body flex-1 p-4 sm:p-5 space-y-4">
          {/* Card do Estudante Atual */}
          <div className="flex items-center justify-between gap-3 p-3.5 bg-[#f3f6fb] rounded-2xl">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="relative shrink-0">
                <StudentAvatar
                  student={{ ...student, photo: previewUrl }}
                  size="lg"
                  className="w-16 h-16 rounded-2xl shadow-sm object-cover"
                />
                {previewUrl && (
                  <span className="absolute -bottom-1 -right-1 p-1 bg-emerald-600 text-white rounded-full shadow-xs">
                    <Check className="w-[13px] h-[13px] block" strokeWidth={2.5} />
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-white text-slate-950 tabular-nums shrink-0 shadow-xs">
                    Nº {student.number.toString().padStart(2, '0')}
                  </span>
                  <span className="text-sm font-bold text-slate-950 break-words leading-snug">
                    {student.name}
                  </span>
                </div>
                <span className="text-xs text-slate-700 font-medium block break-words mt-0.5">
                  RA: {student.ra || '—'}-{student.digRa || ''} ·{' '}
                  <strong className={previewUrl ? 'text-emerald-900' : 'text-amber-900'}>
                    {previewUrl ? 'Foto Atualizada' : 'Sem foto cadastrada'}
                  </strong>
                </span>
              </div>
            </div>

            {previewUrl && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={isProcessing}
                className="min-h-[38px] px-3 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-950 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                title="Remover foto deste estudante"
              >
                <Trash2 className="w-4 h-4" strokeWidth={2} />
                <span className="hidden sm:inline">Remover</span>
              </button>
            )}
          </div>

          {/* Upload Dropzone & Actions */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="p-6 bg-[#eef3f9] hover:bg-[#e2e8f0] rounded-2xl transition-all duration-200 flex flex-col items-center justify-center text-center space-y-3 shadow-[0_6px_20px_-8px_rgba(11,59,140,0.14)]"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*, .jpg, .jpeg, .png, .webp, .heic, .heif, .avif, .bmp, .gif, .tiff, .svg"
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              onChange={handleFolderChange}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="w-14 h-14 rounded-2xl bg-white text-[#14428c] flex items-center justify-center shadow-sm">
              <Camera className="w-8 h-8" strokeWidth={2} />
            </div>

            <div>
              <p className="text-sm font-bold text-slate-950">
                Arraste uma ou várias fotos aqui ou selecione pelos botões
              </p>
              <p className="text-xs text-slate-700 mt-0.5 max-w-md">
                Associação automática por <strong>Nº da Chamada</strong> (ex: <code>01.jpg</code>, <code>02.png</code>), <strong>RA</strong> ou <strong>Nome</strong>.
                Otimização sem perda e sincronização imediata para a turma.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => fileInputRef.current?.click()}
                className="h-10 px-4 bg-[#14428c] hover:bg-[#0f3370] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-[0.97] transition-all duration-200 disabled:opacity-50"
                title="Selecione uma ou mais fotos (segure Ctrl ou Shift para selecionar várias)"
              >
                <Images className="w-[18px] h-[18px]" strokeWidth={2} />
                <span>Escolher Fotos (Múltiplas)</span>
              </button>

              <button
                type="button"
                disabled={isProcessing}
                onClick={() => folderInputRef.current?.click()}
                className="h-10 px-4 bg-white hover:bg-[#f8fafc] text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-[0.97] transition-all duration-200 disabled:opacity-50"
                title="Selecione uma pasta contendo as fotos da turma"
              >
                <FolderUp className="w-[18px] h-[18px] text-[#14428c]" strokeWidth={2} />
                <span>Selecionar Pasta</span>
              </button>

              <button
                type="button"
                disabled={isProcessing}
                onClick={() => cameraInputRef.current?.click()}
                className="h-10 px-4 bg-white hover:bg-[#f8fafc] text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-[0.97] transition-all duration-200 disabled:opacity-50"
                title="Tirar foto diretamente com a câmera"
              >
                <Camera className="w-[18px] h-[18px] text-[#14428c]" strokeWidth={2} />
                <span>Tirar com Câmera</span>
              </button>
            </div>
          </div>

          {statusMsg && (
            <div className="p-3 rounded-xl bg-[#f3f6fb] text-xs text-slate-900 font-medium flex items-center gap-2">
              <Info className="w-4 h-4 text-slate-700 shrink-0" strokeWidth={2} />
              <span>{statusMsg}</span>
            </div>
          )}

          {uploadSuccess && (
            <div className="p-3 bg-emerald-100 text-emerald-950 rounded-xl font-bold text-xs flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-[18px] h-[18px] text-emerald-800 shrink-0" strokeWidth={2} />
              <span>Foto salva e sincronizada para todos os usuários!</span>
            </div>
          )}
        </div>

        {/* Modal Actions Sticky */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-md shadow-[0_-6px_20px_-8px_rgba(9,15,29,0.08)] p-4 flex gap-2 shrink-0 z-10">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 bg-[#eef3f9] hover:bg-[#e2e8f0] text-slate-950 font-bold text-xs sm:text-sm rounded-2xl transition-colors cursor-pointer"
          >
            Concluir
          </button>

          {canGoNext && (
            <button
              type="button"
              onClick={handleNextStudent}
              className="flex-1 h-11 bg-[#14428c] hover:bg-[#0f3370] text-white font-bold text-xs sm:text-sm rounded-2xl transition-all duration-200 active:scale-[0.97] cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
            >
              <span>Próximo Aluno</span>
              <ArrowRight className="w-[18px] h-[18px]" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};
