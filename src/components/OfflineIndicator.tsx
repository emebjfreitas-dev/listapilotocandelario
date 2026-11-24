import React, { useState, useEffect } from 'react';
import { useNetworkHealth } from '../hooks/useNetworkHealth';
import { WifiOff, AlertTriangle, CloudOff } from 'lucide-react';
import { ModalPortal } from './ui/ModalPortal';
import { subscribeToSyncStatus, isFirestoreQuotaExceeded } from '../services/firebaseSync';

export const OfflineIndicator: React.FC = () => {
  const { isOnline, isSlow, isUnstable, averageLatencyMs } = useNetworkHealth();
  const [quotaExceeded, setQuotaExceeded] = useState(() => isFirestoreQuotaExceeded());

  useEffect(() => {
    const unsub = subscribeToSyncStatus((snap) => {
      setQuotaExceeded(Boolean(snap.isQuotaExceeded || isFirestoreQuotaExceeded()));
    });
    return () => unsub();
  }, []);

  if (isOnline && !isSlow && !isUnstable && !quotaExceeded) return null;

  if (!isOnline) {
    return (
      <ModalPortal>
        <div
          role="status"
          aria-live="polite"
          data-status="offline"
          className="fixed bottom-20 lg:bottom-6 left-4 z-[125] flex items-center gap-2.5 rounded-2xl bg-[#be123c] px-4 py-2.5 text-xs font-medium text-white shadow-[0_14px_34px_rgba(2,6,23,0.45)] animate-gentle-fade"
        >
          <WifiOff className="w-4 h-4 shrink-0 text-white" />
          <span className="text-white">Modo Offline Ativo — Os dados locais continuam salvos e acessíveis.</span>
        </div>
      </ModalPortal>
    );
  }

  if (quotaExceeded) {
    return (
      <ModalPortal>
        <div
          role="status"
          aria-live="polite"
          data-status="info"
          className="fixed bottom-20 lg:bottom-6 left-4 z-[125] flex items-center gap-2.5 rounded-2xl bg-[#0f2e6b] px-4 py-2.5 text-xs font-medium text-white shadow-[0_14px_34px_rgba(2,6,23,0.4)] animate-gentle-fade"
        >
          <CloudOff className="w-4 h-4 shrink-0 text-amber-300" />
          <span className="text-white">
            Nuvem em modo local — Cota diária do Firestore atingida. Dados 100% seguros em cache e planilha.
          </span>
        </div>
      </ModalPortal>
    );
  }

  // Estado Conexão Lenta / Instável (aviso amarelo/âmbar acessível com fonte branca)
  return (
    <ModalPortal>
      <div
        role="status"
        aria-live="polite"
        data-status="warning"
        className="fixed bottom-20 lg:bottom-6 left-4 z-[125] flex items-center gap-2.5 rounded-2xl bg-[#b45309] px-4 py-2.5 text-xs font-medium text-white shadow-[0_14px_34px_rgba(2,6,23,0.4)] animate-gentle-fade"
      >
        <AlertTriangle className="w-4 h-4 shrink-0 text-white" />
        <span className="text-white">
          Conexão Lenta {averageLatencyMs ? `(~${averageLatencyMs}ms)` : ''} — O sincronismo com a nuvem pode demorar um pouco mais.
        </span>
      </div>
    </ModalPortal>
  );
};
