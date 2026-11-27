export interface ClearSwCacheResult {
  cleared: boolean;
  updateFound: boolean;
  updateActivated: boolean;
}

const SEND_CLEAR_TIMEOUT_MS = 1200;

async function sendClearCacheMessageToWorker(
  worker: ServiceWorker | null | undefined
): Promise<boolean> {
  if (!worker) return false;
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };

    const timer =
      typeof window !== 'undefined'
        ? window.setTimeout(() => finish(false), SEND_CLEAR_TIMEOUT_MS)
        : null;

    try {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => {
        if (timer !== null && typeof window !== 'undefined') {
          window.clearTimeout(timer);
        }
        finish(Boolean(event.data?.cleared));
      };
      worker.postMessage({ type: 'CLEAR_SW_CACHE' }, [channel.port2]);
    } catch {
      if (timer !== null && typeof window !== 'undefined') {
        window.clearTimeout(timer);
      }
      try {
        worker.postMessage({ type: 'CLEAR_SW_CACHE' });
      } catch {
        // ignore
      }
      finish(false);
    }
  });
}

/**
 * Limpa todo o CacheStorage do Service Worker (preservando dados offline do usuário
 * no localStorage e fotos em IndexedDB) e solicita verificação imediata de nova versão no servidor.
 */
export async function clearServiceWorkerCachesAndUpdate(): Promise<ClearSwCacheResult> {
  let clearedByWorker = false;
  let clearedDirectly = false;
  let updateFound = false;
  let updateActivated = false;

  if (typeof window === 'undefined') {
    return { cleared: false, updateFound: false, updateActivated: false };
  }

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      const targetWorker =
        navigator.serviceWorker.controller ||
        registration?.active ||
        registration?.waiting ||
        null;

      if (targetWorker) {
        clearedByWorker = await sendClearCacheMessageToWorker(targetWorker);
      }

      if (registration) {
        if (registration.waiting && navigator.serviceWorker.controller) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          updateFound = true;
          updateActivated = true;
        }
        try {
          await registration.update();
          if (registration.installing || registration.waiting) {
            updateFound = true;
            if (registration.waiting && navigator.serviceWorker.controller) {
              registration.waiting.postMessage({ type: 'SKIP_WAITING' });
              updateActivated = true;
            }
          }
        } catch {
          // ignore transient SW update check errors
        }
      }
    }
  } catch {
    // ignore SW access errors
  }

  try {
    if ('caches' in window && typeof window.caches?.keys === 'function') {
      const keys = await window.caches.keys();
      if (keys.length > 0) {
        await Promise.all(keys.map((key) => window.caches.delete(key)));
      }
      clearedDirectly = true;
    }
  } catch {
    // ignore CacheStorage access errors
  }

  return {
    cleared: clearedByWorker || clearedDirectly,
    updateFound,
    updateActivated,
  };
}
