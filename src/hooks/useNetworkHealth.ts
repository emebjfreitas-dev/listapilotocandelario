import { useState, useEffect, useRef, useCallback } from 'react';
import { useOnlineStatus } from './useOnlineStatus';

export type NetworkQuality = 'good' | 'slow' | 'unstable' | 'offline';

export interface NetworkHealthState {
  isOnline: boolean;
  isSlow: boolean;
  isUnstable: boolean;
  latencyMs: number | null;
  averageLatencyMs: number | null;
  networkQuality: NetworkQuality;
  consecutiveSlowCount: number;
  lastCheckedAtMs: number | null;
  checkNow: () => Promise<void>;
}

const LATENCY_SLOW_THRESHOLD_MS = 1600; // Respostas acima de 1.6s são consideradas lentas
const CONSECUTIVE_SLOW_TRIGGER = 3;     // Exige 3 medições consecutivas lentas para evitar falso-positivo em oscilações pontuais
const PING_INTERVAL_MS = 25000;         // Intervalo de verificação periódica de 25s
const SAMPLES_WINDOW_SIZE = 5;          // Janela móvel de amostras de latência

/**
 * Hook para monitorar a latência real de requisições ao backend e detectar
 * conexões consistentemente lentas ou instáveis, filtrando oscilações temporárias.
 */
export function useNetworkHealth(): NetworkHealthState {
  const isOnline = useOnlineStatus();
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [averageLatencyMs, setAverageLatencyMs] = useState<number | null>(null);
  const [consecutiveSlowCount, setConsecutiveSlowCount] = useState<number>(0);
  const [isSlow, setIsSlow] = useState<boolean>(false);
  const [isUnstable, setIsUnstable] = useState<boolean>(false);
  const [lastCheckedAtMs, setLastCheckedAtMs] = useState<number | null>(null);

  const samplesRef = useRef<number[]>([]);
  const isCheckingRef = useRef<boolean>(false);

  const performPing = useCallback(async () => {
    if (!navigator.onLine || isCheckingRef.current) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }

    isCheckingRef.current = true;
    const start = performance.now();

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 6500);

      const res = await fetch('/api/health?t=' + Date.now(), {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      }).catch(async () => {
        // Fallback para endpoint raiz health se a rota api falhar
        return fetch('/health?t=' + Date.now(), {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        });
      });

      window.clearTimeout(timeoutId);
      const end = performance.now();
      const duration = Math.round(end - start);

      if (res && res.ok) {
        // Atualiza janela de amostras
        samplesRef.current = [...samplesRef.current.slice(-(SAMPLES_WINDOW_SIZE - 1)), duration];
        const sum = samplesRef.current.reduce((acc, v) => acc + v, 0);
        const avg = Math.round(sum / samplesRef.current.length);

        setLatencyMs(duration);
        setAverageLatencyMs(avg);
        setLastCheckedAtMs(Date.now());

        if (duration >= LATENCY_SLOW_THRESHOLD_MS) {
          setConsecutiveSlowCount((prev) => {
            const next = prev + 1;
            if (next >= CONSECUTIVE_SLOW_TRIGGER) {
              setIsSlow(true);
            }
            return next;
          });
        } else {
          // Recuperação: resposta rápida restabelece o estado bom
          setConsecutiveSlowCount(0);
          setIsSlow(false);
          setIsUnstable(false);
        }
      } else {
        // Resposta sem status 200
        setConsecutiveSlowCount((prev) => {
          const next = prev + 1;
          if (next >= 2) {
            setIsUnstable(true);
          }
          return next;
        });
      }
    } catch {
      // Falha de rede ou timeout
      setConsecutiveSlowCount((prev) => {
        const next = prev + 1;
        if (next >= 2) {
          setIsUnstable(true);
        }
        return next;
      });
    } finally {
      isCheckingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isOnline) {
      setIsSlow(false);
      setIsUnstable(false);
      setLatencyMs(null);
      return;
    }

    // Ping inicial com pequeno atraso para não competir com o boot principal
    const initialTimer = window.setTimeout(() => {
      void performPing();
    }, 4500);

    const intervalId = window.setInterval(() => {
      void performPing();
    }, PING_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void performPing();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isOnline, performPing]);

  const networkQuality: NetworkQuality = !isOnline
    ? 'offline'
    : isUnstable
    ? 'unstable'
    : isSlow
    ? 'slow'
    : 'good';

  return {
    isOnline,
    isSlow,
    isUnstable,
    latencyMs,
    averageLatencyMs,
    networkQuality,
    consecutiveSlowCount,
    lastCheckedAtMs,
    checkNow: performPing,
  };
}
