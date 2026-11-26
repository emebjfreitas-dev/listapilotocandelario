import React, { Suspense, useState } from 'react';
import {
  AlertTriangle,
  Database,
  FileSpreadsheet,
  HardDrive,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { ClassGroup } from '../../types';
import { lazyWithRetry } from '../../utils/lazyWithRetry';
import { LazyErrorBoundary } from '../ui/LazyErrorBoundary';

const AtualizarDadosJsonModal = lazyWithRetry(
  () => import('../AtualizarDadosJsonModal').then((m) => ({ default: m.AtualizarDadosJsonModal })),
  'AtualizarDadosJsonModal'
);

interface AdminSystemCloudTabProps {
  classes: ClassGroup[];
  currentUserEmail: string;
  onUpdateClasses: (updatedClasses: ClassGroup[]) => void;
  onOpenSheetsModal: () => void;
  onOpenDriveBackupModal: () => void;
  onOpenPhotoStorageModal: () => void;
  onFeedback: (type: 'success' | 'error', text: string) => void;
}

export const AdminSystemCloudTab: React.FC<AdminSystemCloudTabProps> = ({
  classes,
  currentUserEmail,
  onUpdateClasses,
  onOpenSheetsModal,
  onOpenDriveBackupModal,
  onOpenPhotoStorageModal,
  onFeedback,
}) => {
  const [showJsonTools, setShowJsonTools] = useState(false);

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-3xl p-4 sm:p-5 border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-slate-950">
            Nuvem, Backups &amp; Armazenamento Local
          </h2>
          <p className="text-xs text-slate-700">
            Integrações de infraestrutura escolar, contingência no Google Drive e manutenção do cache offline.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={onOpenSheetsModal}
            className="text-left p-4 rounded-2xl bg-[#f3f6fb] hover:bg-[#eef3f9] border border-black/[0.06] card-interactive cursor-pointer flex flex-col justify-between gap-3 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EAF7EE] text-[#1B873F] flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-950">
                  Google Sheets &amp; Nuvem
                </h3>
                <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">
                  Gerenciar credenciais, IDs de pastas e testar conexão em tempo real com a planilha oficial.
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-[#1B873F]">
              Configurar e testar conexão →
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenDriveBackupModal}
            className="text-left p-4 rounded-2xl bg-[#f3f6fb] hover:bg-[#eef3f9] border border-black/[0.06] card-interactive cursor-pointer flex flex-col justify-between gap-3 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-950">
                  Backup de Contingência (Drive)
                </h3>
                <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">
                  Exportar cópia completa das turmas, matrículas e frequências para pasta segura do Google Drive.
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-[#0071E3]">
              Gerar cópia de segurança →
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenPhotoStorageModal}
            className="text-left p-4 rounded-2xl bg-[#f3f6fb] hover:bg-[#eef3f9] border border-black/[0.06] card-interactive cursor-pointer flex flex-col justify-between gap-3 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white text-[#1D1D1F] border border-black/[0.06] flex items-center justify-center shrink-0">
                <HardDrive className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-950">
                  Cache de Fotos (IndexedDB)
                </h3>
                <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">
                  Monitorar armazenamento offline de retratos dos alunos e liberar cache de turmas anteriores.
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-slate-950">
              Inspecionar armazenamento →
            </span>
          </button>
        </div>
      </section>

      {/* Área Técnica de Base JSON (Isolada com alerta de segurança) */}
      <section className="bg-white rounded-3xl p-4 sm:p-5 border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#fef3c7] text-[#b45309] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-semibold text-slate-950">
                Manutenção da Base JSON &amp; Reset Técnico
              </h3>
              <p className="text-xs text-slate-700 leading-relaxed">
                Área sensível separada das importações diárias: permite exportar snapshot JSON completo, restaurar backup ou restaurar padrões de fábrica.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowJsonTools((prev) => !prev)}
            className="min-h-[40px] px-4 rounded-xl bg-[#f3f6fb] hover:bg-[#dfe8f4] text-slate-950 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
          >
            <Database className="w-3.5 h-3.5" />
            <span>{showJsonTools ? 'Ocultar Ferramentas JSON' : 'Abrir Ferramentas JSON'}</span>
          </button>
        </div>

        {showJsonTools && (
          <LazyErrorBoundary resetKey="system_json_tools">
            <Suspense
              fallback={
                <div className="rounded-2xl bg-[#f3f6fb] p-6 flex items-center justify-center gap-2 text-xs font-semibold text-slate-700">
                  <Loader2 className="w-4 h-4 text-[#0071E3] animate-spin" />
                  <span>Carregando gerenciador de base JSON...</span>
                </div>
              }
            >
              <AtualizarDadosJsonModal
                isOpen
                embedded
                onClose={() => setShowJsonTools(false)}
                classes={classes}
                onUpdateClasses={(updatedClasses) => {
                  onUpdateClasses(updatedClasses);
                  onFeedback('success', 'Base de dados atualizada via JSON.');
                }}
                currentUserEmail={currentUserEmail}
              />
            </Suspense>
          </LazyErrorBoundary>
        )}
      </section>
    </div>
  );
};
