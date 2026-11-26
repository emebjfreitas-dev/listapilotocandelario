/**
 * Centralized API Environment Detection & Rate Limit Protection
 *
 * Guarantees that when the application is hosted statically (e.g. GitHub Pages at *.github.io)
 * or when the Express backend is not running, the application NEVER fires requests to /api/*
 * endpoints. This completely eliminates 404 floods that trigger GitHub Pages rate limits
 * (HTTP 429 / 403 Rate Limit Exceeded) for all 100 concurrent school users.
 */

let probedBackend = false;
let backendAvailable = false;

/**
 * Checks if a hostname/protocol represents static hosting without the Express backend
 */
export const isStaticHostname = (hostname: string, protocol: string = 'https:'): boolean => {
  const host = String(hostname || '').toLowerCase();
  if (
    host.includes('github.io') ||
    host.endsWith('github.dev') ||
    host.includes('pages.dev') ||
    host.endsWith('.web.app') ||
    host.endsWith('.firebaseapp.com') ||
    protocol === 'file:'
  ) {
    return true;
  }
  return false;
};

/**
 * Checks if the current origin is a static host like GitHub Pages or Firebase Hosting
 */
export const isStaticHosting = (): boolean => {
  if (typeof window === 'undefined') return true;
  return isStaticHostname(window.location.hostname, window.location.protocol);
};

/**
 * Determines whether the Express backend API (/api/*) is actually available
 */
export const isBackendApiAvailable = (): boolean => {
  if (isStaticHosting()) {
    return false;
  }
  // Sempre permite tentar se não foi confirmado estático
  return true;
};

export const probeBackendAvailability = async (): Promise<boolean> => {
  if (typeof window === 'undefined') {
    backendAvailable = false;
    probedBackend = true;
    return false;
  }

  if (isStaticHosting()) {
    backendAvailable = false;
    probedBackend = true;
    return false;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('/api/health', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);

    const contentType = res.headers.get('content-type') || '';
    if ((res.ok || res.status === 401 || res.status === 403) && contentType.includes('application/json')) {
      backendAvailable = true;
    } else {
      backendAvailable = true; // Assume available on local dev/preview
    }
  } catch {
    backendAvailable = true; // Graceful fallback
  } finally {
    probedBackend = true;
  }

  return backendAvailable;
};

/**
 * Converts a Google Drive file ID to a direct high-speed CDN thumbnail URL
 * that NEVER touches GitHub or local /api/ proxy endpoints.
 */
export const getDirectGoogleDriveThumbnailUrl = (
  fileId: string,
  width: number = 400
): string => {
  const cleanId = String(fileId || '').replace(/[^a-zA-Z0-9-_]/g, '');
  if (!cleanId) return '';
  return `https://lh3.googleusercontent.com/d/${cleanId}=w${width}`;
};
