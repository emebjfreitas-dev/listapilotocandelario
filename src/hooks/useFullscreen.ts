import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    const doc = document as FullscreenDocument;
    return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
  });

  useEffect(() => {
    const syncState = () => {
      const doc = document as FullscreenDocument;
      setIsFullscreen(Boolean(doc.fullscreenElement || doc.webkitFullscreenElement));
    };

    document.addEventListener('fullscreenchange', syncState);
    document.addEventListener('webkitfullscreenchange', syncState);
    return () => {
      document.removeEventListener('fullscreenchange', syncState);
      document.removeEventListener('webkitfullscreenchange', syncState);
    };
  }, []);

  const enterFullscreen = useCallback(async (showHintIfBlocked = true): Promise<boolean> => {
    if (typeof document === 'undefined') return false;
    const doc = document as FullscreenDocument;
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      return true;
    }

    const rootEl = document.documentElement as FullscreenElement;
    try {
      if (typeof rootEl.requestFullscreen === 'function') {
        try {
          await rootEl.requestFullscreen({ navigationUI: 'hide' });
        } catch {
          await rootEl.requestFullscreen();
        }
        return true;
      }
      if (typeof rootEl.webkitRequestFullscreen === 'function') {
        await rootEl.webkitRequestFullscreen();
        return true;
      }
    } catch {
      // Fallback para navegadores mobile (ex: Safari iOS) que restringem requestFullscreen
    }

    // Recolhe suavemente a barra de endereços em navegadores mobile compatíveis com scroll
    try {
      window.scrollTo({ top: Math.max(window.scrollY, 1), behavior: 'smooth' });
    } catch {
      // no-op
    }

    if (showHintIfBlocked) {
      const isStandalone =
        window.matchMedia?.('(display-mode: standalone)').matches ||
        Boolean((window.navigator as { standalone?: boolean }).standalone);
      if (!isStandalone) {
        toast.info('Para tela cheia permanente no celular, adicione o app à Tela de Início.');
      }
    }
    return false;
  }, []);

  const exitFullscreen = useCallback(async (): Promise<void> => {
    if (typeof document === 'undefined') return;
    const doc = document as FullscreenDocument;
    try {
      if (doc.fullscreenElement && typeof doc.exitFullscreen === 'function') {
        await doc.exitFullscreen();
      } else if (doc.webkitFullscreenElement && typeof doc.webkitExitFullscreen === 'function') {
        await doc.webkitExitFullscreen();
      }
    } catch {
      // no-op
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (isFullscreen) {
      await exitFullscreen();
    } else {
      await enterFullscreen(true);
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  return {
    isFullscreen,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
  };
}
