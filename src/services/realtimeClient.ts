import { getAuth } from 'firebase/auth';
import {
  ClassGroup,
  AuthorizedUser,
  AttendanceWindowConfig,
  UserAccessSessionLog,
  SchoolNotice,
} from '../types';
import { isBackendApiAvailable } from './apiEnvironment';

const TAB_CLIENT_ID_KEY = 'emeb_candelario_realtime_client_id_v1';

const resolveTabClientId = (): string => {
  if (typeof window === 'undefined') {
    return `srv-${Math.random().toString(36).slice(2, 10)}`;
  }
  try {
    const existing = window.sessionStorage.getItem(TAB_CLIENT_ID_KEY);
    if (existing && existing.length >= 6) {
      return existing;
    }
    const generated = `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    window.sessionStorage.setItem(TAB_CLIENT_ID_KEY, generated);
    return generated;
  } catch {
    return `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
};

export const REALTIME_CLIENT_ID = resolveTabClientId();

export const getRealtimeClientId = (): string => REALTIME_CLIENT_ID;

export interface RealtimeClassesUpdatedPayload {
  classes: ClassGroup[];
  classesUpdatedAtMs: number;
  cloudLinks?: Record<string, any>;
  discoveredNominalPdfs?: any[];
  discoveredDrivePhotos?: any[];
  originClientId?: string;
}

export interface RealtimeMetaUpdatedPayload {
  authorizedUsers?: AuthorizedUser[];
  accessSessionLogs?: UserAccessSessionLog[];
  attendanceWindowConfig?: AttendanceWindowConfig;
  schoolNotices?: SchoolNotice[];
  cloudLinks?: Record<string, any>;
  discoveredNominalPdfs?: any[];
  discoveredDrivePhotos?: any[];
  originClientId?: string;
}

export interface RealtimeCalendarUpdatedPayload {
  calendarConfig?: any;
  holidays?: any[];
  auditLogs?: any[];
  classes?: ClassGroup[];
  classesUpdatedAtMs?: number;
  originClientId?: string;
}

export interface RealtimeBusCallbacks {
  onClassesDelta?: (payload: RealtimeClassesUpdatedPayload) => void;
  onClassesReplaced?: (payload: RealtimeClassesUpdatedPayload) => void;
  onMetaUpdated?: (payload: RealtimeMetaUpdatedPayload) => void;
  onCalendarUpdated?: (payload: RealtimeCalendarUpdatedPayload) => void;
  onFcmAlert?: (alert: any) => void;
  onStateReset?: (payload: {
    classes?: ClassGroup[];
    classesUpdatedAtMs: number;
    cleanResetEpochId: string;
    originClientId?: string;
  }) => void;
  onReconnect?: () => void;
}

export interface RealtimeConnectionStatus {
  connected: boolean;
  transport: 'websocket' | 'sse' | 'disconnected';
  lastEventAtMs: number | null;
}

let connectionStatus: RealtimeConnectionStatus = {
  connected: false,
  transport: 'disconnected',
  lastEventAtMs: null,
};

const statusListeners = new Set<(status: RealtimeConnectionStatus) => void>();

const setConnectionStatus = (next: Partial<RealtimeConnectionStatus>) => {
  connectionStatus = { ...connectionStatus, ...next };
  const snapshot = { ...connectionStatus };
  statusListeners.forEach((cb) => {
    try {
      cb(snapshot);
    } catch {
      // ignore listener errors
    }
  });
};

export const getRealtimeConnectionStatus = (): RealtimeConnectionStatus => ({
  ...connectionStatus,
});

export const isRealtimeBusConnected = (): boolean => connectionStatus.connected;

export const subscribeToRealtimeConnectionStatus = (
  listener: (status: RealtimeConnectionStatus) => void
): (() => void) => {
  statusListeners.add(listener);
  listener(getRealtimeConnectionStatus());
  return () => {
    statusListeners.delete(listener);
  };
};

export const subscribeToRealtimeBus = (callbacks: RealtimeBusCallbacks): (() => void) => {
  if (typeof window === 'undefined' || !isBackendApiAvailable()) {
    setConnectionStatus({ connected: false, transport: 'disconnected' });
    return () => {};
  }

  let disposed = false;
  let activeWs: WebSocket | null = null;
  let activeSse: EventSource | null = null;
  let reconnectTimer: number | null = null;
  let heartbeatTimer: number | null = null;
  let wsConsecutiveFailures = 0;
  let reconnectAttempt = 0;
  let hasConnectedOnce = false;

  const clearTimers = () => {
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (heartbeatTimer !== null) {
      window.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };

  const closeTransports = () => {
    clearTimers();
    if (activeWs) {
      try {
        activeWs.onopen = null;
        activeWs.onmessage = null;
        activeWs.onerror = null;
        activeWs.onclose = null;
        activeWs.close();
      } catch {
        // ignore close errors
      }
      activeWs = null;
    }
    if (activeSse) {
      try {
        activeSse.onopen = null;
        activeSse.onmessage = null;
        activeSse.onerror = null;
        activeSse.close();
      } catch {
        // ignore close errors
      }
      activeSse = null;
    }
  };

  const dispatchMessage = (type: string, payload: any) => {
    setConnectionStatus({ lastEventAtMs: Date.now() });
    if (payload?.originClientId && payload.originClientId === REALTIME_CLIENT_ID) {
      return;
    }
    switch (type) {
      case 'classes:updated':
        callbacks.onClassesDelta?.(payload);
        break;
      case 'classes:replaced':
        callbacks.onClassesReplaced?.(payload);
        break;
      case 'meta:updated':
        callbacks.onMetaUpdated?.(payload);
        break;
      case 'calendar:updated':
        callbacks.onCalendarUpdated?.(payload);
        break;
      case 'fcm:alert':
        callbacks.onFcmAlert?.(payload?.alert || payload);
        break;
      case 'state:reset':
        callbacks.onStateReset?.(payload);
        break;
      default:
        break;
    }
  };

  const scheduleReconnect = () => {
    if (disposed || reconnectTimer !== null) return;
    const delayMs = Math.min(15000, 1000 * Math.pow(2, Math.min(4, reconnectAttempt)));
    reconnectAttempt += 1;
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      if (!disposed) {
        connect();
      }
    }, delayMs);
  };

  const connectSseFallback = () => {
    if (disposed || typeof EventSource === 'undefined') return;
    closeTransports();
    try {
      const sseUrl = `/api/realtime/stream?clientId=${encodeURIComponent(REALTIME_CLIENT_ID)}`;
      const es = new EventSource(sseUrl, { withCredentials: true });
      activeSse = es;

      es.onopen = () => {
        if (disposed) return;
        const wasReconnect = hasConnectedOnce;
        hasConnectedOnce = true;
        reconnectAttempt = 0;
        setConnectionStatus({ connected: true, transport: 'sse' });
        if (wasReconnect) {
          callbacks.onReconnect?.();
        }
      };

      es.onmessage = (evt) => {
        if (disposed || !evt.data) return;
        try {
          const parsed = JSON.parse(evt.data);
          if (parsed && typeof parsed.type === 'string') {
            dispatchMessage(parsed.type, parsed.payload);
          }
        } catch {
          // ignore keepalive/malformed events
        }
      };

      es.onerror = () => {
        if (disposed) return;
        setConnectionStatus({ connected: false, transport: 'disconnected' });
        closeTransports();
        scheduleReconnect();
      };
    } catch {
      setConnectionStatus({ connected: false, transport: 'disconnected' });
      scheduleReconnect();
    }
  };

  const connectWebSocket = async () => {
    if (disposed) return;
    closeTransports();

    let idToken = '';
    try {
      idToken = (await getAuth().currentUser?.getIdToken().catch(() => '')) || '';
    } catch {
      idToken = '';
    }
    if (disposed) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/realtime`;

    let opened = false;
    try {
      const ws = new WebSocket(wsUrl);
      activeWs = ws;

      ws.onopen = () => {
        if (disposed) {
          ws.close();
          return;
        }
        opened = true;
        wsConsecutiveFailures = 0;
        reconnectAttempt = 0;
        try {
          ws.send(
            JSON.stringify({
              type: 'auth',
              token: idToken,
              clientId: REALTIME_CLIENT_ID,
            })
          );
        } catch {
          // ignore send errors
        }
        heartbeatTimer = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({ type: 'ping' }));
            } catch {
              // ignore ping errors
            }
          }
        }, 25000);
      };

      ws.onmessage = (evt) => {
        if (disposed || typeof evt.data !== 'string') return;
        try {
          const parsed = JSON.parse(evt.data);
          if (!parsed || typeof parsed.type !== 'string') return;
          if (parsed.type === 'ready') {
            const wasReconnect = hasConnectedOnce;
            hasConnectedOnce = true;
            setConnectionStatus({ connected: true, transport: 'websocket' });
            if (wasReconnect) {
              callbacks.onReconnect?.();
            }
            return;
          }
          if (parsed.type === 'pong') {
            return;
          }
          dispatchMessage(parsed.type, parsed.payload);
        } catch {
          // ignore malformed messages
        }
      };

      ws.onerror = () => {
        // handled cleanly by onclose
      };

      ws.onclose = () => {
        if (disposed) return;
        setConnectionStatus({ connected: false, transport: 'disconnected' });
        clearTimers();
        if (!opened) {
          wsConsecutiveFailures += 1;
        }
        if (wsConsecutiveFailures >= 2) {
          connectSseFallback();
        } else {
          scheduleReconnect();
        }
      };
    } catch {
      wsConsecutiveFailures += 1;
      if (wsConsecutiveFailures >= 2) {
        connectSseFallback();
      } else {
        scheduleReconnect();
      }
    }
  };

  const connect = () => {
    if (disposed) return;
    if (wsConsecutiveFailures >= 2 || typeof WebSocket === 'undefined') {
      connectSseFallback();
    } else {
      void connectWebSocket();
    }
  };

  const handleOnline = () => {
    if (!disposed && !connectionStatus.connected) {
      reconnectAttempt = 0;
      connect();
    }
  };

  window.addEventListener('online', handleOnline);
  connect();

  return () => {
    disposed = true;
    window.removeEventListener('online', handleOnline);
    closeTransports();
    setConnectionStatus({ connected: false, transport: 'disconnected' });
  };
};
