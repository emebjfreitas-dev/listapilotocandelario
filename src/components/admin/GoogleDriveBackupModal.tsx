import React, { useState, useEffect, useMemo } from 'react';
import { ClassGroup } from '../../types';
import {
  buildSchoolJsonBackupPayload,
  exportSchoolDataToJsonFile,
} from '../../services/db';
import {
  getSavedBackupDriveFolderInfo,
  saveBackupDriveFolderUrl,
  extractDriveFileOrFolderId,
  getDriveAuthState,
  getCurrentGoogleUser,
  requestDriveAndSheetsPermission,
  verifyDriveFolderAccess,
  createBackupDriveFolder,
  listJsonBackupsInDriveFolder,
  uploadJsonBackupToGoogleDrive,
  getStoredDriveBackupHistory,
  DriveFolderCheckResult,
  DriveJsonBackupFile,
  DriveBackupHistoryItem,
  DEFAULT_BACKUP_DRIVE_FOLDER_NAME,
} from '../../services/googleSheetsApi';
import { ModalPortal } from '../ui/ModalPortal';
import { useModalScrollLock } from '../../hooks/useModalScrollLock';
import {
  ShieldCheck,
  X,
  FolderPlus,
  FolderOpen,
  CloudUpload,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  KeyRound,
  ExternalLink,
  Download,
  FileJson,
  Clock,
  Check,
  SearchCheck,
} from 'lucide-react';
import { toast } from 'sonner';

interface GoogleDriveBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: ClassGroup[];
  currentUserEmail?: string;
}

const formatFileSize = (bytes?: number): string => {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
};

const formatDateTimeBR = (iso?: string): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

export const GoogleDriveBackupModal: React.FC<GoogleDriveBackupModalProps> = ({
  isOpen,
  onClose,
  classes,
  currentUserEmail = 'emebjfreitas@jundiai.sp.gov.br',
}) => {
  useModalScrollLock(isOpen);

  const [folderInput, setFolderInput] = useState<string>('');
  const [folderName, setFolderName] = useState<string>(DEFAULT_BACKUP_DRIVE_FOLDER_NAME);
  const [includeAuthorizedUsers, setIncludeAuthorizedUsers] = useState<boolean>(true);

  const [authState, setAuthState] = useState(() => getDriveAuthState());
  const [googleUserEmail, setGoogleUserEmail] = useState<string>('');

  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [isVerifyingFolder, setIsVerifyingFolder] = useState<boolean>(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);

  const [folderCheck, setFolderCheck] = useState<DriveFolderCheckResult | null>(null);
  const [confirmUploadPending, setConfirmUploadPending] = useState<boolean>(false);
  const [lastUploadedItem, setLastUploadedItem] = useState<DriveBackupHistoryItem | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [driveFiles, setDriveFiles] = useState<DriveJsonBackupFile[]>([]);
  const [localHistory, setLocalHistory] = useState<DriveBackupHistoryItem[]>([]);

  const totalStudents = useMemo(
    () => classes.reduce((acc, c) => acc + (c.students?.length || 0), 0),
    [classes]
  );

  const estimatedSizeLabel = useMemo(() => {
    try {
      const payload = buildSchoolJsonBackupPayload(
        classes,
        googleUserEmail || currentUserEmail,
        includeAuthorizedUsers
      );
      const sizeBytes = new Blob([JSON.stringify(payload)]).size;
      return formatFileSize(sizeBytes);
    } catch {
      return '—';
    }
  }, [classes, googleUserEmail, currentUserEmail, includeAuthorizedUsers]);

  const extractedFolderId = useMemo(
    () => extractDriveFileOrFolderId(folderInput),
    [folderInput]
  );

  const refreshDriveFilesList = async (targetFolderId: string) => {
    if (!targetFolderId || !getDriveAuthState().hasValidToken) {
      setDriveFiles([]);
      return;
    }
    setIsLoadingFiles(true);
    try {
      const files = await listJsonBackupsInDriveFolder(targetFolderId);
      setDriveFiles(files);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const loadSavedBackupLinks = () => {
      const saved = getSavedBackupDriveFolderInfo();
      setFolderInput(saved.folderUrl || saved.folderId || '');
      setFolderName(saved.folderName || DEFAULT_BACKUP_DRIVE_FOLDER_NAME);
      return saved;
    };

    const saved = loadSavedBackupLinks();

    const currentAuth = getDriveAuthState();
    setAuthState(currentAuth);
    const gUser = getCurrentGoogleUser();
    setGoogleUserEmail(gUser?.email || '');

    setFolderCheck(null);
    setConfirmUploadPending(false);
    setLastUploadedItem(null);
    setUploadError(null);
    setLocalHistory(getStoredDriveBackupHistory());

    if (saved.folderId && currentAuth.hasValidToken) {
      void refreshDriveFilesList(saved.folderId);
    } else {
      setDriveFiles([]);
    }

    const handleLinksUpdated = () => {
      const updated = loadSavedBackupLinks();
      if (updated.folderId && getDriveAuthState().hasValidToken) {
        void refreshDriveFilesList(updated.folderId);
      }
    };
    window.addEventListener('emeb-cloud-links-updated', handleLinksUpdated);
    window.addEventListener('storage', handleLinksUpdated);
    return () => {
      window.removeEventListener('emeb-cloud-links-updated', handleLinksUpdated);
      window.removeEventListener('storage', handleLinksUpdated);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAuthorizeDrive = async () => {
    setIsAuthenticating(true);
    setUploadError(null);
    try {
      const res = await requestDriveAndSheetsPermission();
      setAuthState(getDriveAuthState());
      if (res.userEmail) {
        setGoogleUserEmail(res.userEmail);
      }
      toast.success('Conta Google Drive autorizada com sucesso!');
      if (extractedFolderId) {
        void refreshDriveFilesList(extractedFolderId);
      }
    } catch (err: unknown) {
      toast.error('Falha ao conectar Google Drive', {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleVerifyFolder = async () => {
    if (!extractedFolderId) {
      toast.error('Cole o link ou ID da pasta do Google Drive.');
      return;
    }
    setIsVerifyingFolder(true);
    setFolderCheck(null);
    setUploadError(null);
    try {
      const result = await verifyDriveFolderAccess(folderInput);
      setFolderCheck(result);
      if (result.ok) {
        if (result.folderName) setFolderName(result.folderName);
        if (result.folderUrl) setFolderInput(result.folderUrl);
        toast.success(`Pasta confirmada: "${result.folderName}"`);
        void refreshDriveFilesList(result.folderId);
      } else {
        toast.error('Pasta não encontrada ou sem acesso', {
          description: result.error,
        });
      }
    } finally {
      setIsVerifyingFolder(false);
    }
  };

  const handleCreateDedicatedFolder = async () => {
    setIsCreatingFolder(true);
    setUploadError(null);
    setFolderCheck(null);
    try {
      const created = await createBackupDriveFolder(DEFAULT_BACKUP_DRIVE_FOLDER_NAME);
      setFolderInput(created.folderUrl);
      setFolderName(created.folderName);
      setFolderCheck({
        ok: true,
        folderId: created.folderId,
        folderName: created.folderName,
        folderUrl: created.folderUrl,
      });
      toast.success(`Pasta "${created.folderName}" pronta no seu Google Drive!`);
      void refreshDriveFilesList(created.folderId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadError(msg);
      toast.error('Não foi possível criar a pasta no Google Drive', {
        description: msg,
      });
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleRequestUploadConfirmation = () => {
    setUploadError(null);
    if (!authState.hasValidToken) {
      toast.error('Conecte sua conta Google Drive antes de enviar o backup.');
      return;
    }
    if (!extractedFolderId) {
      toast.error('Selecione ou crie uma pasta de destino no Google Drive.');
      return;
    }
    saveBackupDriveFolderUrl(folderInput, extractedFolderId, folderName);
    setConfirmUploadPending(true);
  };

  const handleConfirmUploadToDrive = async () => {
    setIsUploading(true);
    setUploadError(null);
    try {
      const result = await uploadJsonBackupToGoogleDrive({
        classes,
        targetFolderId: extractedFolderId,
        targetFolderName: folderName,
        exportedBy: googleUserEmail || currentUserEmail,
        includeAuthorizedUsers,
      });
      setLastUploadedItem(result);
      setConfirmUploadPending(false);
      setLocalHistory(getStoredDriveBackupHistory());
      toast.success('Backup de Segurança salvo no Google Drive!', {
        description: `${result.fileName} (${formatFileSize(result.sizeBytes)})`,
      });
      void refreshDriveFilesList(result.folderId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadError(msg);
      setConfirmUploadPending(false);
      toast.error('Erro ao enviar backup para o Google Drive', {
        description: msg,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadLocalBackup = () => {
    exportSchoolDataToJsonFile(classes, googleUserEmail || currentUserEmail);
    toast.success('Cópia local do Backup JSON baixada!');
  };

  return (
    <ModalPortal onClose={onClose}>
      <div
        className="fixed inset-0 z-[126] flex items-center justify-center p-3 sm:p-5 overflow-hidden bg-slate-950/75 backdrop-blur-sm animate-backdrop-in"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="drive-backup-modal-title"
          className="modal-shell relative w-full max-w-2xl bg-white rounded-3xl shadow-[0_28px_68px_rgba(2,6,23,0.55)] flex flex-col max-h-[92dvh] overflow-hidden animate-apple-pop"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cabeçalho */}
          <div className="flex items-center justify-between px-5 py-4 sm:px-6 bg-[#f3f6fb] shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-[#047857] text-white flex items-center justify-center shrink-0 shadow-xs">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1
                  id="drive-backup-modal-title"
                  className="text-base sm:text-lg font-bold text-slate-950 truncate tracking-tight"
                >
                  Backup de Segurança (Google Drive)
                </h1>
                <p className="text-xs text-slate-600 truncate">
                  Upload lossless retomável com verificação SHA-256/MD5 e manifesto appDataFolder
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-950 hover:bg-black/5 transition-colors cursor-pointer shrink-0"
              aria-label="Fechar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Corpo Rolável */}
          <div className="modal-scroll-body flex-1 p-5 sm:p-6 space-y-5 overflow-y-auto">
            {/* Resumo do Snapshot Atual */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-3.5 rounded-2xl bg-[#f3f6fb] text-center">
                <span className="block text-[11px] font-medium text-slate-600">Turmas Ativas</span>
                <span className="mt-0.5 block text-lg font-semibold text-slate-950 tabular-nums">
                  {classes.length}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#f3f6fb] text-center">
                <span className="block text-[11px] font-medium text-slate-600">Estudantes</span>
                <span className="mt-0.5 block text-lg font-semibold text-slate-950 tabular-nums">
                  {totalStudents}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#f3f6fb] text-center">
                <span className="block text-[11px] font-medium text-slate-600">Tamanho JSON</span>
                <span className="mt-0.5 block text-lg font-semibold text-[#14428c] tabular-nums">
                  {estimatedSizeLabel}
                </span>
              </div>
            </div>

            {/* Status OAuth Google Drive */}
            <div className="p-4 rounded-2xl bg-[#f8fafc] space-y-3 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#14428c] shrink-0" />
                  <span className="text-xs font-semibold text-slate-950">
                    Autorização Google Drive
                  </span>
                </div>
                <span
                  data-status={authState.hasValidToken ? 'success' : 'warning'}
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${
                    authState.hasValidToken ? 'bg-[#047857]' : 'bg-[#b45309]'
                  }`}
                >
                  {authState.hasValidToken ? 'Conectado' : 'Autorização Necessária'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-700">
                <p className="min-w-0 break-all">
                  Conta ativa:{' '}
                  <span className="font-semibold text-slate-950">
                    {googleUserEmail || 'Nenhuma sessão Google Drive ativa'}
                  </span>
                </p>

                <button
                  type="button"
                  onClick={handleAuthorizeDrive}
                  disabled={isAuthenticating}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#14428c] hover:bg-[#0f3370] text-white font-medium text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 transition-colors shrink-0 shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isAuthenticating ? 'animate-spin' : ''}`} />
                  <span>{isAuthenticating ? 'Conectando...' : 'Conectar / Renovar Drive'}</span>
                </button>
              </div>
            </div>

            {/* Pasta de Destino no Google Drive */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="backup-drive-folder-input"
                  className="text-xs font-semibold text-slate-950 flex items-center gap-1.5"
                >
                  <FolderOpen className="w-4 h-4 text-[#14428c]" />
                  <span>Pasta de Destino no Google Drive (URL ou ID)</span>
                </label>

                {extractedFolderId && (
                  <a
                    href={`https://drive.google.com/drive/folders/${extractedFolderId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-[#14428c] hover:underline inline-flex items-center gap-1"
                  >
                    <span>Abrir Pasta no Drive</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="backup-drive-folder-input"
                  type="text"
                  value={folderInput}
                  onChange={(e) => {
                    setFolderInput(e.target.value);
                    setFolderCheck(null);
                  }}
                  placeholder="Cole a URL da pasta (https://drive.google.com/drive/folders/...) ou o ID"
                  className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-[#f3f6fb] hover:bg-[#eef3f9] text-xs sm:text-sm text-slate-950 font-mono transition-colors shadow-2xs"
                />

                <button
                  type="button"
                  onClick={handleVerifyFolder}
                  disabled={isVerifyingFolder || !extractedFolderId || !authState.hasValidToken}
                  className="min-h-[44px] px-3.5 rounded-xl bg-[#eef3f9] hover:bg-[#e2e8f0] text-[#0f3370] font-medium text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors shrink-0"
                >
                  <SearchCheck className="w-4 h-4 shrink-0" />
                  <span>{isVerifyingFolder ? 'Verificando...' : 'Verificar Pasta'}</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleCreateDedicatedFolder}
                  disabled={isCreatingFolder || !authState.hasValidToken}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#047857] hover:bg-[#065f46] text-white font-medium text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors shadow-xs"
                >
                  <FolderPlus className="w-4 h-4 shrink-0 text-white" />
                  <span>
                    {isCreatingFolder
                      ? 'Criando Pasta...'
                      : 'Criar Pasta Oficial de Backup no Drive'}
                  </span>
                </button>

                <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none min-h-[40px]">
                  <input
                    type="checkbox"
                    checked={includeAuthorizedUsers}
                    onChange={(e) => setIncludeAuthorizedUsers(e.target.checked)}
                    className="w-4 h-4 accent-[#14428c] rounded cursor-pointer"
                  />
                  <span>Incluir usuários autorizados e calendário no JSON</span>
                </label>
              </div>

              {folderCheck && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                    folderCheck.ok
                      ? 'bg-emerald-50 text-emerald-950'
                      : 'bg-rose-50 text-rose-950'
                  }`}
                >
                  {folderCheck.ok ? (
                    <CheckCircle2 className="w-4 h-4 text-[#047857] shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-[#be123c] shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    {folderCheck.ok ? (
                      <span>
                        Pasta validada:{' '}
                        <span className="font-semibold">{folderCheck.folderName}</span> (ID:{' '}
                        <span className="font-mono">{folderCheck.folderId}</span>)
                      </span>
                    ) : (
                      <span>{folderCheck.error}</span>
                    )}
                  </div>
                </div>
              )}

              {uploadError && (
                <div className="p-3.5 rounded-xl bg-rose-50 text-rose-950 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-[#be123c] shrink-0 mt-0.5" />
                  <p className="leading-relaxed break-words">{uploadError}</p>
                </div>
              )}

              {lastUploadedItem && (
                <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-start gap-2 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-[#047857] shrink-0 mt-0.5" />
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-semibold text-emerald-950 break-all">
                        Backup lossless verificado (SHA-256/MD5): {lastUploadedItem.fileName}
                      </p>
                      <p className="text-emerald-900">
                        {lastUploadedItem.totalClasses} turmas · {lastUploadedItem.totalStudents}{' '}
                        estudantes · {formatFileSize(lastUploadedItem.sizeBytes)} · Sincronizado no Drive
                      </p>
                    </div>
                  </div>
                  <a
                    href={lastUploadedItem.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#047857] text-white font-medium text-xs inline-flex items-center justify-center gap-1.5 shrink-0 hover:bg-[#065f46] transition-colors"
                  >
                    <span>Abrir Arquivo</span>
                    <ExternalLink className="w-3.5 h-3.5 text-white" />
                  </a>
                </div>
              )}
            </div>

            {/* Confirmação Explícita de Envio para o Google Drive */}
            {confirmUploadPending && (
              <div className="p-4 rounded-2xl bg-[#eef3f9] space-y-3 animate-apple-pop">
                <div className="flex items-start gap-2.5">
                  <CloudUpload className="w-5 h-5 text-[#14428c] shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs text-slate-800">
                    <p className="font-semibold text-slate-950 text-sm">
                      Confirmar envio do Backup de Segurança para o Google Drive?
                    </p>
                    <p className="leading-relaxed">
                      Será criado um novo arquivo <span className="font-mono">.json</span> na
                      pasta{' '}
                      <span className="font-semibold text-slate-950">
                        {folderName || extractedFolderId}
                      </span>{' '}
                      contendo <strong>{classes.length} turmas</strong> e{' '}
                      <strong>{totalStudents} estudantes</strong> (~{estimatedSizeLabel}) pela
                      conta <span className="font-semibold">{googleUserEmail || currentUserEmail}</span>.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmUploadPending(false)}
                    disabled={isUploading}
                    className="min-h-[40px] px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-800 text-xs font-medium cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmUploadToDrive}
                    disabled={isUploading}
                    className="min-h-[40px] px-4 rounded-xl bg-[#047857] hover:bg-[#065f46] text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60 transition-colors shadow-xs"
                  >
                    {isUploading ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <Check className="w-4 h-4 text-white" />
                    )}
                    <span>{isUploading ? 'Enviando para o Drive...' : 'Confirmar Envio'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Histórico de Backups no Drive / Sessão */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#14428c]" />
                  <span>Backups Recentes na Pasta do Drive</span>
                </h3>
                {extractedFolderId && authState.hasValidToken && (
                  <button
                    type="button"
                    onClick={() => refreshDriveFilesList(extractedFolderId)}
                    disabled={isLoadingFiles}
                    className="text-xs font-medium text-[#14428c] hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                    <span>Atualizar</span>
                  </button>
                )}
              </div>

              {driveFiles.length > 0 ? (
                <div className="rounded-2xl bg-[#f8fafc] divide-y divide-slate-200/70 overflow-hidden">
                  {driveFiles.map((file) => (
                    <div
                      key={file.id}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-2.5 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileJson className="w-4 h-4 text-[#047857] shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-950 truncate">{file.name}</p>
                          <p className="text-[11px] text-slate-600 tabular-nums">
                            {formatDateTimeBR(file.createdTime)} · {formatFileSize(file.sizeBytes)}
                          </p>
                        </div>
                      </div>
                      <a
                        href={file.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[34px] px-2.5 py-1 rounded-lg bg-white hover:bg-[#eef3f9] text-[#14428c] font-medium text-[11px] inline-flex items-center gap-1 shrink-0 shadow-2xs"
                      >
                        <span>Ver</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ))}
                </div>
              ) : localHistory.length > 0 ? (
                <div className="rounded-2xl bg-[#f8fafc] divide-y divide-slate-200/70 overflow-hidden">
                  {localHistory.slice(0, 5).map((item) => (
                    <div
                      key={item.fileId}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-2.5 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileJson className="w-4 h-4 text-[#14428c] shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-950 truncate">{item.fileName}</p>
                          <p className="text-[11px] text-slate-600 tabular-nums">
                            {formatDateTimeBR(item.createdAtISO)} · {item.totalClasses} turmas ·{' '}
                            {formatFileSize(item.sizeBytes)}
                          </p>
                        </div>
                      </div>
                      <a
                        href={item.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[34px] px-2.5 py-1 rounded-lg bg-white hover:bg-[#eef3f9] text-[#14428c] font-medium text-[11px] inline-flex items-center gap-1 shrink-0 shadow-2xs"
                      >
                        <span>Ver</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-600 bg-[#f8fafc] px-4 py-3 rounded-2xl">
                  Nenhum backup JSON listado para esta pasta ainda. Crie ou verifique uma pasta e envie sua primeira cópia de contingência.
                </p>
              )}
            </div>
          </div>

          {/* Rodapé */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 px-5 py-4 sm:px-6 bg-[#f3f6fb] shrink-0">
            <button
              type="button"
              onClick={handleDownloadLocalBackup}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-white hover:bg-[#eef3f9] text-slate-900 text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
            >
              <Download className="w-4 h-4 text-[#14428c] shrink-0" />
              <span>Baixar Cópia Local (.json)</span>
            </button>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 text-xs sm:text-sm font-medium cursor-pointer transition-colors shadow-2xs"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleRequestUploadConfirmation}
                disabled={isUploading || !authState.hasValidToken || !extractedFolderId}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-[#047857] hover:bg-[#065f46] text-white text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-colors shadow-xs"
              >
                <CloudUpload className="w-4 h-4 text-white shrink-0" />
                <span>Enviar Backup para o Drive</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
