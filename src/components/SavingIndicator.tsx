import React, { useState, useEffect, useRef } from 'react';
import { SyncQueueManager, SyncQueueManagerSnapshot } from '../services/syncQueueManager';
import { ModalPortal } from './ui/ModalPortal';
import { SFSymbol } from './ui/SFSymbol';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

export const SavingIndicator: React.FC = () => {
  const [snapshot, setSnapshot] = useState<SyncQueueManagerSnapshot>(() =>
    SyncQueueManager.getSnapshot()
  );
  const [feedbackMode, setFeedbackMode] = useState<'none' | 'saved' | 'offline_saved'>('none');
  const [timedOutSafeguard, setTimedOutSafeguard] = useState<boolean>(false);
  const initialActive =
    snapshot.isOnline && (snapshot.isVisibleProcessing || snapshot.visibleActiveTasksCount > 0);
  const prevSavingRef = useRef<boolean>(initialActive);
  const prevVisiblePendingRef = useRef<number>(snapshot.visiblePendingTasksCount);
  const hideTimerRef = useRef<number | null>(null);
  const safetyTimerRef = useRef<number | null>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const scheduleAutoHide = () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
      hideTimerRef.current = window.setTimeout(() => {
        setFeedbackMode('none');
        hideTimerRef.current = null;
      }, 2200);
    };

    const syncStateFromSnapshot = (nextSnap: SyncQueueManagerSnapshot) => {
      setSnapshot(nextSnap);

      const isCurrentlySaving =
        nextSnap.isOnline &&
        (nextSnap.isVisibleProcessing || nextSnap.visibleActiveTasksCount > 0);
      const wasSaving = prevSavingRef.current;
      prevSavingRef.current = isCurrentlySaving;

      const prevPending = prevVisiblePendingRef.current;
      prevVisiblePendingRef.current = nextSnap.visiblePendingTasksCount;

      if (isCurrentlySaving && !wasSaving) {
        setTimedOutSafeguard(false);
        if (safetyTimerRef.current !== null) {
          window.clearTimeout(safetyTimerRef.current);
        }
        safetyTimerRef.current = window.setTimeout(() => {
          setTimedOutSafeguard(true);
          safetyTimerRef.current = null;
        }, 16000);
      } else if (!isCurrentlySaving && safetyTimerRef.current !== null) {
        window.clearTimeout(safetyTimerRef.current);
        safetyTimerRef.current = null;
        setTimedOutSafeguard(false);
      }

      if (isCurrentlySaving) {
        if (hideTimerRef.current !== null) {
          window.clearTimeout(hideTimerRef.current);
          hideTimerRef.current = null;
        }
        setFeedbackMode('none');
      } else if (!nextSnap.isOnline && nextSnap.visiblePendingTasksCount > prevPending) {
        setFeedbackMode('offline_saved');
        scheduleAutoHide();
      } else if (
        wasSaving &&
        !isCurrentlySaving &&
        nextSnap.retryingTasksCount === 0 &&
        nextSnap.failedTasksCount === 0
      ) {
        setFeedbackMode('saved');
        scheduleAutoHide();
      }
    };

    const unsubscribe = SyncQueueManager.subscribe(syncStateFromSnapshot);

    return () => {
      unsubscribe();
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
      if (safetyTimerRef.current !== null) {
        window.clearTimeout(safetyTimerRef.current);
      }
    };
  }, []);

  const isSaving =
    !timedOutSafeguard &&
    snapshot.isOnline &&
    (snapshot.isVisibleProcessing || snapshot.visibleActiveTasksCount > 0);
  const isVisible = isSaving || feedbackMode !== 'none';

  const statusAttr = isSaving
    ? 'saving'
    : feedbackMode === 'offline_saved'
    ? 'warning'
    : 'success';

  const bgClass = isSaving
    ? 'bg-[#0e3a8a]'
    : feedbackMode === 'offline_saved'
    ? 'bg-[#b45309]'
    : 'bg-[#047857]';

  return (
    <ModalPortal>
      <AnimatePresence mode="wait">
        {isVisible && (
          <motion.div
            key={isSaving ? 'saving' : feedbackMode}
            aria-live="polite"
            role="status"
            data-status={statusAttr}
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 10, scale: 0.96 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 8, scale: 0.96 }
            }
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`pointer-events-none fixed bottom-[82px] right-4 lg:bottom-6 lg:right-6 z-[120] flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium shadow-[0_14px_34px_rgba(7,30,70,0.45)] select-none text-white ${bgClass}`}
          >
            {isSaving ? (
              <>
                <SFSymbol
                  name="sync"
                  size={16}
                  weight={500}
                  className={prefersReducedMotion ? 'text-white' : 'animate-spin text-white'}
                />
                <span className="tracking-tight text-white">Salvando na nuvem...</span>
              </>
            ) : feedbackMode === 'offline_saved' ? (
              <>
                <SFSymbol name="cloud_off" size={16} weight={500} className="text-white" />
                <span className="tracking-tight text-white">Salvo offline (fila segura)</span>
              </>
            ) : (
              <>
                <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <SFSymbol name="check" size={13} weight={600} className="text-white" />
                </span>
                <span className="tracking-tight text-white">Salvo na nuvem</span>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </ModalPortal>
  );
};
