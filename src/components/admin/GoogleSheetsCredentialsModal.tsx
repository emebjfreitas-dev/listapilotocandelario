import React, { useState, useEffect } from 'react';
import {
  getSavedSpreadsheetInfo,
  saveSpreadsheetInfo,
  extractSpreadsheetId,
  getSavedPhotosDriveFolderInfo,
  savePhotosDriveFolderUrl,
  getSavedFichasPdfDriveFolderInfo,
  saveFichasPdfDriveFolderUrl,
  getDriveAuthState,
  getCurrentGoogleUser,
  testGoogleSpreadsheetConnection,
  requestDriveAndSheetsPermission,
  SpreadsheetConnectionTestResult,
  OFFICIAL_SPREADSHEET_TITLE,
  OFFICIAL_PHOTOS_FOLDER_URL,
  OFFICIAL_FICHAS_PDF_FOLDER_URL,
} from '../../services/googleSheetsApi';
import { ModalPortal } from '../ui/ModalPortal';
import { useModalScrollLock } from '../../hooks/useModalScrollLock';
import {
  FileSpreadsheet,
  X,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  KeyRound,
  FolderOpen,
  Save,
  Check,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

interface GoogleSheetsCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCredentialsUpdated?: () => void;
}

export const GoogleSheetsCredentialsModal: React.FC<GoogleSheetsCredentialsModalProps> = ({
  isOpen,
  onClose,
  onCredentialsUpdated,
}) => {
  useModalScrollLock(isOpen);

  const [sheetInput, setSheetInput] = useState<string>('');
  const [sheetTitle, setSheetTitle] = useState<string>('');
  const [photosFolderInput, setPhotosFolderInput] = useState<string>('');
  const [fichasFolderInput, setFichasFolderInput] = useState<string>('');

  const [authState, setAuthState] = useState(() => getDriveAuthState());
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');

  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<SpreadsheetConnectionTestResult | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;

    const loadSavedLinks = () => {
      const savedSheet = getSavedSpreadsheetInfo();
      const savedPhotos = getSavedPhotosDriveFolderInfo();
      const savedFichas = getSavedFichasPdfDriveFolderInfo();

      setSheetInput(savedSheet.spreadsheetId || '');
      setSheetTitle(savedSheet.title || OFFICIAL_SPREADSHEET_TITLE);
      setPhotosFolderInput(savedPhotos.folderUrl || OFFICIAL_PHOTOS_FOLDER_URL);
      setFichasFolderInput(savedFichas.folderUrl || OFFICIAL_FICHAS_PDF_FOLDER_URL);
    };

    loadSavedLinks();
    setAuthState(getDriveAuthState());
    const user = getCurrentGoogleUser();
    setCurrentUserEmail(user?.email || '');
    setTestResult(null);

    const handleLinksUpdated = () => loadSavedLinks();
    window.addEventListener('emeb-cloud-links-updated', handleLinksUpdated);
    window.addEventListener('storage', handleLinksUpdated);
    return () => {
      window.removeEventListener('emeb-cloud-links-updated', handleLinksUpdated);
      window.removeEventListener('storage', handleLinksUpdated);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const currentExtractedSheetId = extractSpreadsheetId(sheetInput);

  const handleAuthorizeGoogleDrive = async () => {
    setIsAuthenticating(true);
    try {
      const res = await requestDriveAndSheetsPermission();
      setAuthState(getDriveAuthState());
      if (res.userEmail) {
        setCurrentUserEmail(res.userEmail);
      }
      toast.success('Permissão do Google Drive e Planilhas autorizada com sucesso!');
    } catch (err: unknown) {
      toast.error('Falha na autorização do Google Drive', {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const targetId = currentExtractedSheetId.trim();
      const result = await testGoogleSpreadsheetConnection(targetId);
      setTestResult(result);

      if (result.ok) {
        if (result.spreadsheetTitle) {
          setSheetTitle(result.spreadsheetTitle);
        }
        toast.success('Conexão testada com sucesso!', {
          description: `Planilha: "${result.spreadsheetTitle || targetId}" (${result.latencyMs}ms)`,
        });
      } else {
        toast.error('Teste de conexão não foi bem-sucedido', {
          description: result.error,
        });
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveCredentials = () => {
    setIsSaving(true);
    try {
      const cleanSheetId = currentExtractedSheetId.trim();
      if (cleanSheetId) {
        saveSpreadsheetInfo(cleanSheetId, sheetTitle.trim() || OFFICIAL_SPREADSHEET_TITLE);
      }

      if (photosFolderInput.trim()) {
        savePhotosDriveFolderUrl(photosFolderInput.trim());
      }

      if (fichasFolderInput.trim()) {
        saveFichasPdfDriveFolderUrl(fichasFolderInput.trim());
      }

      toast.success('Credenciais e links salvos com sucesso!');
      if (onCredentialsUpdated) onCredentialsUpdated();
      onClose();
    } catch (err: unknown) {
      toast.error('Erro ao salvar credenciais', {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalPortal onClose={onClose}>
      <div
        className="fixed inset-0 z-[125] flex items-center justify-center p-3 sm:p-5 overflow-hidden bg-slate-950/75 backdrop-blur-sm animate-backdrop-in"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sheets-modal-title"
          className="modal-shell relative w-full max-w-2xl bg-white rounded-3xl shadow-[0_28px_68px_rgba(2,6,23,0.5)] flex flex-col max-h-[92dvh] overflow-hidden animate-apple-pop"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cabeçalho */}
          <div className="flex items-center justify-between px-5 py-4 sm:px-6 sm:py-4.5 bg-[#f3f6fb] shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-[#14428c] text-white flex items-center justify-center shrink-0 shadow-xs">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2
                  id="sheets-modal-title"
                  className="text-base sm:text-lg font-bold text-slate-950 truncate tracking-tight"
                >
                  Credenciais da API do Google Sheets
                </h2>
                <p className="text-xs text-slate-600 truncate">
                  Gerenciamento da planilha principal e teste de conexão manual
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
            {/* Card de Status da Autorização OAuth */}
            <div className="p-4 rounded-2xl bg-[#f8fafc] space-y-3 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#14428c] shrink-0" />
                  <span className="text-xs font-bold text-slate-950">Status do Token Google Drive & Sheets</span>
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    authState.hasValidToken
                      ? 'bg-[#047857] text-white'
                      : 'bg-[#b45309] text-white'
                  }`}
                >
                  {authState.hasValidToken ? 'Token Ativo' : 'Não Autorizado'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-700">
                <p className="min-w-0 break-all leading-relaxed">
                  Conta conectada:{' '}
                  <strong className="text-slate-950 font-bold">
                    {currentUserEmail || 'Nenhuma conta Google ativa'}
                  </strong>
                </p>

                <button
                  type="button"
                  onClick={handleAuthorizeGoogleDrive}
                  disabled={isAuthenticating}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#14428c] hover:bg-[#0f3370] text-white font-semibold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 transition-colors shrink-0 shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isAuthenticating ? 'animate-spin' : ''}`} />
                  <span>{isAuthenticating ? 'Autorizando...' : 'Conectar / Renovar Token'}</span>
                </button>
              </div>
            </div>

            {/* Configuração da Planilha Principal */}
            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="input-sheet-id" className="text-xs font-bold text-slate-950 block">
                  Planilha Principal (ID ou URL Google Sheets)
                </label>
                {currentExtractedSheetId && (
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${currentExtractedSheetId}/edit`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-[#14428c] hover:underline inline-flex items-center gap-1"
                  >
                    <span>Abrir Planilha</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <input
                id="input-sheet-id"
                type="text"
                value={sheetInput}
                onChange={(e) => setSheetInput(e.target.value)}
                placeholder="Cole o ID ou URL completa da Planilha Google (ex: 1A2b3C...)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f3f6fb] hover:bg-[#eef3f9] text-xs sm:text-sm text-slate-950 font-mono transition-colors shadow-2xs"
              />

              {currentExtractedSheetId && currentExtractedSheetId !== sheetInput && (
                <p className="text-[11px] text-[#047857] font-semibold tabular-nums">
                  ✓ ID extraído automaticamente: <span className="font-mono">{currentExtractedSheetId}</span>
                </p>
              )}

              <div className="space-y-1">
                <label htmlFor="input-sheet-title" className="text-xs font-bold text-slate-950 block">
                  Título da Planilha
                </label>
                <input
                  id="input-sheet-title"
                  type="text"
                  value={sheetTitle}
                  onChange={(e) => setSheetTitle(e.target.value)}
                  placeholder="Nome exibido nos relatórios e exportações"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#f3f6fb] hover:bg-[#eef3f9] text-xs sm:text-sm text-slate-950 transition-colors shadow-2xs"
                />
              </div>
            </div>

            {/* Pastas no Google Drive */}
            <div className="space-y-3.5 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Pastas Vinculadas no Google Drive
              </h3>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="input-photos-folder" className="text-xs font-semibold text-slate-950 flex items-center gap-1.5">
                    <FolderOpen className="w-3.5 h-3.5 text-[#14428c]" />
                    <span>Pasta de Fotos dos Estudantes</span>
                  </label>
                  {photosFolderInput && (
                    <a
                      href={photosFolderInput.startsWith('http') ? photosFolderInput : `https://drive.google.com/drive/folders/${photosFolderInput}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold text-[#14428c] hover:underline inline-flex items-center gap-1"
                    >
                      <span>Abrir Drive</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
                <input
                  id="input-photos-folder"
                  type="text"
                  value={photosFolderInput}
                  onChange={(e) => setPhotosFolderInput(e.target.value)}
                  placeholder="URL ou ID da pasta Fotos Estudantes no Drive"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#f3f6fb] hover:bg-[#eef3f9] text-xs sm:text-sm text-slate-950 font-mono transition-colors shadow-2xs"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="input-fichas-folder" className="text-xs font-semibold text-slate-950 flex items-center gap-1.5">
                    <FolderOpen className="w-3.5 h-3.5 text-[#14428c]" />
                    <span>Pasta de Fichas Informativas PDF</span>
                  </label>
                  {fichasFolderInput && (
                    <a
                      href={fichasFolderInput.startsWith('http') ? fichasFolderInput : `https://drive.google.com/drive/folders/${fichasFolderInput}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold text-[#14428c] hover:underline inline-flex items-center gap-1"
                    >
                      <span>Abrir Drive</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
                <input
                  id="input-fichas-folder"
                  type="text"
                  value={fichasFolderInput}
                  onChange={(e) => setFichasFolderInput(e.target.value)}
                  placeholder="URL ou ID da pasta Fichas Informativas no Drive"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#f3f6fb] hover:bg-[#eef3f9] text-xs sm:text-sm text-slate-950 font-mono transition-colors shadow-2xs"
                />
              </div>
            </div>

            {/* Área de Teste Manual de Conexão */}
            <div className="p-4 rounded-2xl bg-[#eef3f9] space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-950 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-[#14428c]" />
                    <span>Diagnóstico &amp; Teste Manual da Conexão</span>
                  </h4>
                  <p className="text-[11.5px] text-slate-600 mt-0.5">
                    Verifica a acessibilidade da planilha em tempo real e inspeciona as abas existentes.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting || !currentExtractedSheetId}
                  className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#14428c] hover:bg-[#0f3370] text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>{isTesting ? 'Testando Conexão...' : 'Testar Conexão Agora'}</span>
                </button>
              </div>

              {testResult && (
                <div
                  className={`p-3.5 rounded-xl text-xs space-y-2 animate-apple-pop ${
                    testResult.ok
                      ? 'bg-emerald-50 text-emerald-950'
                      : 'bg-rose-50 text-rose-950'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {testResult.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-[#047857] shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-[#be123c] shrink-0" />
                    )}
                    <span className="font-bold">
                      {testResult.ok
                        ? `Conexão bem-sucedida! Latência: ${testResult.latencyMs}ms`
                        : 'Falha no teste de conexão'}
                    </span>
                  </div>

                  {testResult.ok ? (
                    <div className="space-y-1.5 pl-6">
                      <p>
                        Título confirmado:{' '}
                        <strong>{testResult.spreadsheetTitle}</strong>
                      </p>
                      {testResult.sheetTitles && testResult.sheetTitles.length > 0 && (
                        <div>
                          <p className="font-semibold text-emerald-900 mb-1">
                            Abas encontradas ({testResult.sheetTitles.length}):
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {testResult.sheetTitles.map((tab) => (
                              <span
                                key={tab}
                                className="px-2 py-0.5 rounded-md bg-[#047857] text-white font-medium text-[11px]"
                              >
                                {tab}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="pl-6 text-rose-900 leading-relaxed break-words">
                      {testResult.error || 'Erro desconhecido ao comunicar com a API do Google Sheets.'}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Rodapé de Ações */}
          <div className="flex items-center justify-end gap-2.5 px-5 py-4 sm:px-6 bg-[#f3f6fb] shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-white hover:bg-[#eef3f9] text-slate-800 text-xs sm:text-sm font-semibold cursor-pointer transition-colors shadow-2xs"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSaveCredentials}
              disabled={isSaving}
              className="min-h-[42px] px-5 py-2 rounded-xl bg-[#14428c] hover:bg-[#0f3370] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60 transition-colors shadow-xs"
            >
              <Save className="w-4 h-4 shrink-0" />
              <span>{isSaving ? 'Salvando...' : 'Salvar Configurações'}</span>
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
