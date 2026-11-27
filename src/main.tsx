import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { warmupPhotoIndexedDbCache } from './services/photoIndexedDbCache';

void warmupPhotoIndexedDbCache();

createRoot(document.getElementById('root')!).render(<App />);

// Registro do Service Worker para PWA e suporte offline com atualização automática segura
if ('serviceWorker' in navigator && typeof window !== 'undefined') {
  const SW_RELOAD_TS_KEY = 'lp_sw_controller_reload_ts';
  const SW_UPDATE_COOLDOWN_MS = 2 * 60 * 1000;
  const SW_RELOAD_COOLDOWN_MS = 20 * 1000;
  const hadControllerAtBoot = Boolean(navigator.serviceWorker.controller);
  let lastSwUpdateCheckMs = 0;
  let isReloadingForSwUpdate = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadControllerAtBoot || isReloadingForSwUpdate) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    try {
      const lastRaw = window.sessionStorage.getItem(SW_RELOAD_TS_KEY);
      const lastTs = lastRaw ? Number(lastRaw) : 0;
      const now = Date.now();
      if (Number.isFinite(lastTs) && now - lastTs < SW_RELOAD_COOLDOWN_MS) {
        return;
      }
      window.sessionStorage.setItem(SW_RELOAD_TS_KEY, String(now));
    } catch {
      // ignora restrição de sessionStorage
    }
    isReloadingForSwUpdate = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const swUrl = `${baseUrl}sw.js`;

    navigator.serviceWorker
      .register(swUrl, { scope: baseUrl, updateViaCache: 'none' })
      .then((registration) => {
        const triggerSwUpdateCheck = (force = false) => {
          if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
          const now = Date.now();
          if (!force && now - lastSwUpdateCheckMs < SW_UPDATE_COOLDOWN_MS) return;
          lastSwUpdateCheckMs = now;
          registration.update().catch(() => {});
        };

        if (registration.waiting && navigator.serviceWorker.controller) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        triggerSwUpdateCheck(true);

        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('Nova versão do Lista Piloto 2027 pronta para uso offline.');
                installingWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            };
          }
        };

        const handleResumeUpdateCheck = () => {
          if (document.visibilityState === 'visible') {
            triggerSwUpdateCheck(false);
          }
        };
        window.addEventListener('focus', handleResumeUpdateCheck);
        window.addEventListener('online', () => triggerSwUpdateCheck(false));
        document.addEventListener('visibilitychange', handleResumeUpdateCheck);
      })
      .catch((err) => {
        console.warn('Registro de Service Worker PWA:', err);
      });
  });
}

