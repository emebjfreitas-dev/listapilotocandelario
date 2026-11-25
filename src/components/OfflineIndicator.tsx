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
          className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] left-4 z-[125] flex items-center gap-2.5 rounded-full bg-[#D70015] px-4 py-2 text-xs font-medium text-white shadow-[0_12px_30px_rgba(215,0,21,0.28)] animate-gentle-fade"
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
          className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] left-4 z-[125] flex items-center gap-2.5 rounded-full bg-[#1D1D1F]/92 backdrop-blur-xl px-4 py-2 text-xs font-medium text-white shadow-[0_12px_30px_rgba(0,0,0,0.18)] animate-gentle-fade"
        >
          <CloudOff className="w-4 h-4 shrink-0 text-[#FFD60A]" />
          <span className="text-white">
            Nuvem em modo local — Cota diária do Firestore atingida. Dados 100% seguros em cache e planilha.
          </span>
        </div>
      </ModalPortal>
    );
  }

  // Estado Conexão Lenta / Instável
  return (
    <ModalPortal>
      <div
        role="status"
        aria-live="polite"
        data-status="warning"
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] left-4 z-[125] flex items-center gap-2.5 rounded-full bg-[#B25000] px-4 py-2 text-xs font-medium text-white shadow-[0_12px_30px_rgba(178,80,0,0.28)] animate-gentle-fade"
      >
        <AlertTriangle className="w-4 h-4 shrink-0 text-white" />
        <span className="text-white">
          Conexão Lenta {averageLatencyMs ? `(~${averageLatencyMs}ms)` : ''} — O sincronismo com a nuvem pode demorar um pouco mais.
        </span>
      </div>
    </ModalPortal>
  );
};
