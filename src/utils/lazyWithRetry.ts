import React from 'react';

const RETRY_DELAYS_MS = [250, 650, 1200];
const CHUNK_RELOAD_STORAGE_KEY = 'lp_chunk_reload_ts';
const RELOAD_COOLDOWN_MS = 20_000;

function isDynamicImportError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : String(error || '');
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /ChunkLoadError/i.test(message) ||
    /Loading chunk [\d]+ failed/i.test(message)
  );
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Carrega módulos com React.lazy de forma resiliente:
 * 1. Tenta automaticamente até 3 vezes com backoff curto em falhas transitórias de rede/dev server.
 * 2. Se um novo deploy invalidou hashes antigos e o navegador está online, executa no máximo 1 reload automático a cada 20s.
 * 3. Caso persista, propaga o erro para o LazyErrorBoundary exibir recuperação amigável sem quebrar a árvore React.
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  moduleLabel?: string
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        return await importer();
      } catch (err) {
        lastError = err;
        if (!isDynamicImportError(err)) {
          throw err;
        }
        if (attempt < RETRY_DELAYS_MS.length) {
          await waitMs(RETRY_DELAYS_MS[attempt]);
        }
      }
    }

    if (
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      navigator.onLine !== false &&
      isDynamicImportError(lastError)
    ) {
      try {
        const lastReloadRaw = window.sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY);
        const lastReloadTs = lastReloadRaw ? Number(lastReloadRaw) : 0;
        const now = Date.now();
        if (!Number.isFinite(lastReloadTs) || now - lastReloadTs > RELOAD_COOLDOWN_MS) {
          window.sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(now));
          window.location.reload();
          // Mantém a Promise pendente brevemente enquanto o navegador recarrega
          await waitMs(5000);
        }
      } catch {
        // Ignora bloqueios de sessionStorage e deixa o ErrorBoundary assumir
      }
    }

    if (moduleLabel && lastError instanceof Error) {
      console.error(`Falha ao carregar módulo "${moduleLabel}":`, lastError);
    }
    throw lastError;
  });
}
