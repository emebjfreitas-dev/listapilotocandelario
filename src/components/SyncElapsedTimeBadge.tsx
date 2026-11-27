import React, { useState, useEffect } from 'react';
import { subscribeToSyncStatus, SyncStatusSnapshot } from '../services/firebaseSync';
import { SFSymbol } from './ui/SFSymbol';

interface SyncElapsedTimeBadgeProps {
  className?: string;
  syncSnapshot?: SyncStatusSnapshot;
}

export const SyncElapsedTimeBadge: React.FC<SyncElapsedTimeBadgeProps> = ({
  className = '',
  syncSnapshot: propSnapshot,
}) => {
  const [snapshot, setSnapshot] = useState<SyncStatusSnapshot>(
    propSnapshot || {
      status: 'synced',
      pendingCount: 0,
      lastSyncedAtISO: null,
      lastError: null,
      queue: [],
    }
  );

  useEffect(() => {
    if (propSnapshot) {
      setSnapshot(propSnapshot);
      return;
    }
    const unsub = subscribeToSyncStatus((snap) => {
      setSnapshot(snap);
    });
    return () => unsub();
  }, [propSnapshot]);

  const [elapsedText, setElapsedText] = useState<string>('Aguardando sincronização');

  useEffect(() => {
    const updateElapsed = () => {
      const iso = snapshot.lastSyncedAtISO;
      if (!iso) {
        setElapsedText('Nunca sincronizado');
        return;
      }
      const diffMs = Date.now() - new Date(iso).getTime();
      if (diffMs < 6000) {
        setElapsedText('Sincronizado agora mesmo');
        return;
      }
      const secs = Math.floor(diffMs / 1000);
      if (secs < 60) {
        setElapsedText(`Sincronizado há ${secs}s`);
        return;
      }
      const mins = Math.floor(secs / 60);
      if (mins < 60) {
        setElapsedText(`Sincronizado há ${mins}m`);
        return;
      }
      const hours = Math.floor(mins / 60);
      if (hours < 24) {
        setElapsedText(`Sincronizado há ${hours}h`);
        return;
      }
      const days = Math.floor(hours / 24);
      setElapsedText(`Sincronizado há ${days}d`);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 10000);
    return () => clearInterval(interval);
  }, [snapshot.lastSyncedAtISO]);

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium bg-black/[0.04] text-[#424245] border border-black/[0.06] backdrop-blur-md shadow-2xs ${className}`}
      title={
        snapshot.lastSyncedAtISO
          ? `Última sincronização: ${new Date(snapshot.lastSyncedAtISO).toLocaleString('pt-BR')}`
          : 'Nenhuma sincronização recente'
      }
    >
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${
          snapshot.status === 'error'
            ? 'bg-[#FF3B30]'
            : snapshot.pendingCount > 0
            ? 'bg-[#FF9500]'
            : 'bg-[#34C759]'
        }`}
      />
      <SFSymbol name="sync" size={13} weight={420} className="text-[#86868B]" />
      <span>{elapsedText}</span>
    </div>
  );
};
