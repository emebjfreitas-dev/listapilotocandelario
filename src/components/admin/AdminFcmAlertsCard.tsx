import React from 'react';
import { BellRing, Clock, Key, RefreshCw, Send, Unlock } from 'lucide-react';
import { AttendanceWindowConfig, ClassGroup, FcmSystemConfig } from '../../types';
import { FcmBackendStatus } from '../../services/fcmService';
import { evaluateAttendanceLaunchWindow } from '../../services/db';
import { CustomSelect } from '../CustomSelect';
import { ToggleSwitch } from './adminAccessUtils';

interface AdminFcmAlertsCardProps {
  classes: ClassGroup[];
  canManage: boolean;
  attendanceWindowConfig: AttendanceWindowConfig;
  fcmStatus: FcmBackendStatus | null;
  fcmConfigDraft: FcmSystemConfig;
  fcmAudienceTarget: 'pending_only' | 'all';
  isLoadingFcmStatus: boolean;
  isSendingFcmAlert: boolean;
  isSavingFcmConfig: boolean;
  onToggleExceptionalLaunch: () => void;
  onChangeAudienceTarget: (target: 'pending_only' | 'all') => void;
  onChangeFcmConfigDraft: (updater: (prev: FcmSystemConfig) => FcmSystemConfig) => void;
  onSendFcmAlert: (audienceOverride?: 'pending_only' | 'all') => void;
  onSaveFcmConfig: (e: React.FormEvent) => void;
  onRefreshFcmStatus: () => void;
}

export const AdminFcmAlertsCard: React.FC<AdminFcmAlertsCardProps> = ({
  classes,
  canManage,
  attendanceWindowConfig,
  fcmStatus,
  fcmConfigDraft,
  fcmAudienceTarget,
  isLoadingFcmStatus,
  isSendingFcmAlert,
  isSavingFcmConfig,
  onToggleExceptionalLaunch,
  onChangeAudienceTarget,
  onChangeFcmConfigDraft,
  onSendFcmAlert,
  onSaveFcmConfig,
  onRefreshFcmStatus,
}) => {
  const windowEval = evaluateAttendanceLaunchWindow(attendanceWindowConfig);
  const pendingClassesCount = classes.filter((c) => c.isPending).length;

  return (
    <div className="space-y-4">
      {/* Controle da Janela de Lançamento */}
      <section className="bg-white rounded-3xl p-4 sm:p-5 border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white ${
                windowEval.isAllowedToLaunch ? 'bg-[#047857]' : 'bg-[#b45309]'
              }`}
            >
              {windowEval.isAllowedToLaunch ? (
                <Unlock className="w-5 h-5" />
              ) : (
                <Clock className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-semibold text-slate-950">
                {windowEval.statusTitle}
              </h2>
              <p className="text-xs text-slate-700 break-words">
                {windowEval.statusDescription}
              </p>
            </div>
          </div>

          {canManage && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#f3f6fb]">
                <Key className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                <ToggleSwitch
                  checked={attendanceWindowConfig.exceptionalOverrideOpen}
                  onChange={onToggleExceptionalLaunch}
                  activeText="Liberação Ativa"
                  inactiveText="Liberação Desligada"
                  ariaLabel="Alternar liberação excepcional de lançamento de faltas"
                />
              </div>
              <button
                type="button"
                disabled={isSendingFcmAlert}
                onClick={() => onSendFcmAlert('pending_only')}
                className="min-h-[40px] px-4 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60 transition-colors"
              >
                <BellRing className="w-3.5 h-3.5" />
                <span>{isSendingFcmAlert ? 'Enviando FCM...' : 'Alertar Pendentes'}</span>
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Central Firebase Cloud Messaging (FCM) */}
      <section className="bg-white rounded-3xl p-4 sm:p-5 border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold text-slate-950">
                Central Firebase Cloud Messaging (FCM) · Prazos da Janela
              </h3>
              <span
                className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                  fcmStatus?.fcmHttpV1Ready
                    ? 'bg-[#ecfdf5] text-[#047857]'
                    : fcmStatus?.hasFirebaseAdminAccount
                    ? 'bg-[#e8f0fe] text-[#14428c]'
                    : 'bg-[#fef3c7] text-[#92400e]'
                }`}
              >
                {fcmStatus?.fcmHttpV1Ready
                  ? 'FCM HTTP v1 + VAPID Configurados'
                  : fcmStatus?.hasFirebaseAdminAccount
                  ? 'Service Account Ativa · Web Push Pronto'
                  : 'Modo Web Push / Tempo Real Ativo'}
              </span>
            </div>
            <p className="text-xs text-slate-700 max-w-2xl">
              Integração oficial via Firebase Cloud Messaging (VAPID + Service Account) com monitoramento automático para lembrar professores antes do fechamento da chamada ({windowEval.closingDateFormatted}).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isLoadingFcmStatus}
              onClick={onRefreshFcmStatus}
              className="min-h-[38px] px-3 rounded-xl bg-[#f3f6fb] hover:bg-[#dfe8f4] text-slate-950 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFcmStatus ? 'animate-spin' : ''}`} />
              <span>Atualizar Status</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="p-3.5 rounded-2xl bg-[#f3f6fb] space-y-1">
            <span className="text-xs font-semibold text-slate-700 block">
              Dispositivos Inscritos
            </span>
            <span className="text-xl font-semibold text-slate-950 tabular-nums block">
              {fcmStatus?.totalRegisteredDevices ?? 0} dispositivo(s)
            </span>
            <span className="text-xs text-[#047857] font-medium block">
              {fcmStatus?.realFcmTokensCount ?? fcmStatus?.activeFcmTokensCount ?? 0} token(s) FCM pronto(s) em segundo plano
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#f3f6fb] space-y-1">
            <span className="text-xs font-semibold text-slate-700 block">
              Turmas Pendentes Agora
            </span>
            <span className="text-xl font-semibold text-slate-950 tabular-nums block">
              {pendingClassesCount} de {classes.length}
            </span>
            <span className="text-xs text-slate-700 block">
              Encerramento oficial: {windowEval.closingDateFormatted}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#f3f6fb] space-y-1">
            <span className="text-xs font-semibold text-slate-700 block">
              Disparos Realizados
            </span>
            <span className="text-xl font-semibold text-slate-950 tabular-nums block">
              {fcmStatus?.recentDispatches?.length ?? 0} alerta(s)
            </span>
            <span className="text-xs text-slate-700 block">
              Navegação direta para Frequência Mensal
            </span>
          </div>
        </div>

        {canManage && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-[#f3f6fb] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-950">
                  Disparo Manual Imediato (Push / FCM)
                </span>
                <div className="inline-flex rounded-xl bg-white p-0.5">
                  <button
                    type="button"
                    onClick={() => onChangeAudienceTarget('pending_only')}
                    className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                      fcmAudienceTarget === 'pending_only'
                        ? 'bg-[#14428c] text-white'
                        : 'text-slate-700 hover:text-slate-950'
                    }`}
                  >
                    Só Pendentes
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeAudienceTarget('all')}
                    className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                      fcmAudienceTarget === 'all'
                        ? 'bg-[#14428c] text-white'
                        : 'text-slate-700 hover:text-slate-950'
                    }`}
                  >
                    Todos Professores
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                Envia notificação push imediata lembrando a data de fechamento da janela e abrindo a tela de lançamento ao tocar.
              </p>
              <button
                type="button"
                disabled={isSendingFcmAlert}
                onClick={() => onSendFcmAlert()}
                className="w-full min-h-[42px] px-4 rounded-xl bg-[#14428c] hover:bg-[#0f3370] text-white text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Send className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {isSendingFcmAlert
                    ? 'Disparando Alerta Push...'
                    : fcmAudienceTarget === 'pending_only'
                    ? `Alertar Professores Pendentes (${pendingClassesCount} turmas)`
                    : 'Alertar Todos os Professores Agora'}
                </span>
              </button>
            </div>

            <form
              onSubmit={onSaveFcmConfig}
              className="p-4 rounded-2xl bg-[#ecfdf5]/70 space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#047857]">
                    Regras de Alerta Automático (FCM HTTP v1)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-white text-[#047857] text-xs font-semibold">
                    {fcmStatus?.hasViteVapidKey ? 'VAPID Ativo' : 'Web Push Ativo'}
                  </span>
                </div>
                <p className="text-xs text-[#334155] leading-relaxed">
                  Credenciais Firebase e chave VAPID conectadas no servidor. O monitor verifica automaticamente a janela a cada 15 minutos.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <label className="space-y-1 block">
                  <span className="text-xs font-semibold text-[#0f172a] block">
                    Antecedência do Aviso
                  </span>
                  <CustomSelect
                    value={fcmConfigDraft.notifyDaysBeforeClose}
                    onChange={(val) =>
                      onChangeFcmConfigDraft((prev) => ({
                        ...prev,
                        notifyDaysBeforeClose: Number(val),
                      }))
                    }
                    ariaLabel="Antecedência do Aviso"
                    className="w-full bg-white text-xs font-semibold text-[#0f172a]"
                    options={[1, 2, 3, 4, 5].map((d) => ({
                      value: String(d),
                      label: `${d} ${d === 1 ? 'dia' : 'dias'} antes de abrir`,
                    }))}
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="text-xs font-semibold text-[#0f172a] block">
                    Público-Alvo Automático
                  </span>
                  <CustomSelect
                    value={fcmConfigDraft.remindPendingTeachersOnly ? 'pending' : 'all'}
                    onChange={(val) =>
                      onChangeFcmConfigDraft((prev) => ({
                        ...prev,
                        remindPendingTeachersOnly: val === 'pending',
                      }))
                    }
                    ariaLabel="Público-Alvo Automático"
                    className="w-full bg-white text-xs font-semibold text-[#0f172a]"
                    options={[
                      { value: 'pending', label: 'Apenas turmas pendentes' },
                      { value: 'all', label: 'Todos os docentes' },
                    ]}
                  />
                </label>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-xs text-[#334155]">
                  {fcmStatus?.hasFirebaseAdminAccount
                    ? 'Service Account verificada para envio em segundo plano.'
                    : 'Envio em tempo real via Service Worker ativo.'}
                </span>
                <button
                  type="submit"
                  disabled={isSavingFcmConfig}
                  className="min-h-[38px] px-3.5 rounded-xl bg-[#14428c] hover:bg-[#0f3370] text-white text-xs font-semibold cursor-pointer disabled:opacity-60 shrink-0"
                >
                  {isSavingFcmConfig ? 'Salvando...' : 'Salvar Regras'}
                </button>
              </div>
            </form>
          </div>
        )}

        {fcmStatus && fcmStatus.recentDispatches.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-[#334155] block">
              Últimos Alertas FCM Disparados
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {fcmStatus.recentDispatches.slice(0, 4).map((item) => (
                <div key={item.id} className="p-3 rounded-2xl bg-[#f3f6fb] space-y-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                        item.urgency === 'urgent'
                          ? 'bg-[#fee2e2] text-[#991b1b]'
                          : 'bg-[#fef3c7] text-[#92400e]'
                      }`}
                    >
                      {item.urgency === 'urgent' ? 'Crítico' : 'Prazo'}
                    </span>
                    <span className="text-xs text-slate-700 tabular-nums">
                      {new Date(item.createdAtMs).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-950 break-words">{item.title}</p>
                  <p className="text-xs text-slate-700 break-words leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
