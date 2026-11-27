import React, { useState, useEffect } from 'react';
import { subscribeToSyncStatus, SyncStatusSnapshot } from '../services/firebaseSync';
import { SFSymbol } from './ui/SFSymbol';

interface SyncElapsedTimeBadgeProps {
  className?: string;
  syncSnapshot?: SyncStatusSnapshot;
  variant?: 'text' | 'subtle';
}

export const SyncElapsedTimeBadge: React.FC<SyncElapsedTimeBadgeProps> = ({
  className = '',
  syncSnapshot: propSnapshot,
  variant = 'text',
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

  const statusColorClass =
    snapshot.status === 'error'
      ? 'bg-[#FF3B30]'
      : snapshot.pendingCount > 0
      ? 'bg-[#FF9500]'
      : 'bg-[#34C759]';

  if (variant === 'subtle') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-normal text-[#424245] bg-[#F5F5F7] ${className}`}
        title={
          snapshot.lastSyncedAtISO
            ? `Última sincronização: ${new Date(snapshot.lastSyncedAtISO).toLocaleString('pt-BR')}`
            : 'Nenhuma sincronização recente'
        }
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColorClass}`} />
        <SFSymbol name="sync" size={13} weight={400} className="text-[#86868B]" />
        <span>{elapsedText}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs sm:text-sm text-[#86868B] tabular-nums font-normal ${className}`}
      title={
        snapshot.lastSyncedAtISO
          ? `Última sincronização: ${new Date(snapshot.lastSyncedAtISO).toLocaleString('pt-BR')}`
          : 'Nenhuma sincronização recente'
      }
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColorClass}`} />
      <span>{elapsedText}</span>
    </span>
  );
};
