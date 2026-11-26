import { getAuth } from 'firebase/auth';
import { AuthorizedUser } from '../types';
import { isBackendApiAvailable } from './apiEnvironment';
import { CLEAN_DB_RESET_EPOCH_ID } from './firebaseSync';
import { getRealtimeClientId } from './realtimeClient';

export const getActiveUserAuthHeaders = (): Record<string, string> => {
  const clientId = getRealtimeClientId();
  try {
    const raw = sessionStorage.getItem('emeb_candelario_tab_session_2027_v2');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.email) {
        const email = String(parsed.email).trim().toLowerCase();
        const role = String(
          parsed.role || (email.startsWith('emebjfreitas@') ? 'admin' : 'usuario')
        )
          .trim()
          .toLowerCase();
        return {
          'x-user-email': email,
          'x-user-role': role,
          'x-user-name': encodeURIComponent(String(parsed.name || '')),
          'x-clean-epoch': CLEAN_DB_RESET_EPOCH_ID,
          'x-realtime-client-id': clientId,
          'X-Requested-With': 'XMLHttpRequest',
        };
      }
    }
  } catch {
    // fallback
  }
  return {
    'x-clean-epoch': CLEAN_DB_RESET_EPOCH_ID,
    'x-realtime-client-id': clientId,
    'X-Requested-With': 'XMLHttpRequest',
  };
};

export const getActiveUserAuthHeadersAsync = async (
  forceRefresh = false
): Promise<Record<string, string>> => {
  const base = getActiveUserAuthHeaders();
  try {
    const currentUser = getAuth().currentUser;
    if (currentUser) {
      const idToken = await currentUser.getIdToken(forceRefresh);
      if (idToken) {
        return {
          ...base,
          Authorization: `Bearer ${idToken}`,
        };
      }
    }
  } catch {
    // fallback to signed HttpOnly session cookie
  }
  return base;
};

export interface SessionEstablishResult {
  ok: boolean;
  status: number;
  code?: string;
  error?: string;
}

export const establishServerAuthSessionCookie = async (
  explicitIdToken?: string
): Promise<boolean> => {
  const res = await establishServerAuthSessionCookieDetailed(explicitIdToken);
  return res.ok;
};

export const establishServerAuthSessionCookieDetailed = async (
  explicitIdToken?: string
): Promise<SessionEstablishResult> => {
  if (!isBackendApiAvailable()) return { ok: false, status: 0, error: 'Backend offline' };
  try {
    const token =
      explicitIdToken ||
      (await getAuth().currentUser?.getIdToken().catch(() => null)) ||
      '';
    if (!token) return { ok: false, status: 401, error: 'Missing token' };
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Requested-With': 'XMLHttpRequest',
        'x-realtime-client-id': getRealtimeClientId(),
      },
      credentials: 'include',
      body: JSON.stringify({ idToken: token }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return { ok: true, status: res.status };
    }
    return {
      ok: false,
      status: res.status,
      code: data.code || 'SESSION_REJECTED',
      error: data.error || 'Falha na autenticação da sessão',
    };
  } catch (err) {
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
};

export const clearServerAuthSessionCookie = async (): Promise<void> => {
  if (!isBackendApiAvailable()) return;
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'x-realtime-client-id': getRealtimeClientId(),
      },
      credentials: 'include',
    });
  } catch {
    // ignore logout error
  }
};

export const formatDurationHuman = (seconds?: number): string => {
  const s = Math.max(0, Math.round(seconds || 0));
  if (s === 0) return '0s';
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}h ${String(mins).padStart(2, '0')}m`;
  }
  if (mins > 0) {
    return `${mins}m ${String(secs).padStart(2, '0')}s`;
  }
  return `${secs}s`;
};

export const getLocalTodayDateISO = (referenceDate: Date = new Date()): string => {
  const year = referenceDate.getFullYear();
  const month = String(referenceDate.getMonth() + 1).padStart(2, '0');
  const day = String(referenceDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const isUserAccessExpired = (
  user: Pick<AuthorizedUser, 'accessExpiresAt'>,
  referenceDate: Date = new Date()
): boolean => {
  const raw = typeof user.accessExpiresAt === 'string' ? user.accessExpiresAt.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  return getLocalTodayDateISO(referenceDate) > raw;
};

export const isUserAccessEffectivelyActive = (
  user: Pick<AuthorizedUser, 'active' | 'accessExpiresAt'>,
  referenceDate: Date = new Date()
): boolean => Boolean(user.active) && !isUserAccessExpired(user, referenceDate);

export const formatAccessExpirationDateBR = (dateISO?: string): string => {
  if (!dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO.trim())) return '';
  const [y, m, d] = dateISO.trim().split('-');
  return `${d}/${m}/${y}`;
};
