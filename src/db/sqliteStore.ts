import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export interface SqliteDatabaseStats {
  engine: 'sqlite';
  journalMode: string;
  dbPath: string;
  dbFileSizeBytes: number;
  classesCount: number;
  studentsCount: number;
  usersCount: number;
  holidaysCount: number;
  logsCount: number;
  quotaLimit: 'unlimited';
  firestoreEnabled: false;
}

let dbInstance: DatabaseSync | null = null;
let resolvedDbPath = '';

const safeJsonParse = <T>(raw: string | null | undefined, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const createSchema = (db: DatabaseSync): void => {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS school_classes (
      id TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL DEFAULT 0,
      name TEXT NOT NULL,
      shift TEXT,
      teacher_name TEXT,
      teacher_email TEXT,
      total_students INTEGER NOT NULL DEFAULT 0,
      presence_rate REAL NOT NULL DEFAULT 0,
      monthly_absences INTEGER NOT NULL DEFAULT 0,
      updated_at_ms INTEGER NOT NULL DEFAULT 0,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS school_students (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL,
      ra TEXT,
      name TEXT NOT NULL,
      number INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      total_absences_month INTEGER NOT NULL DEFAULT 0,
      consecutive_absences INTEGER NOT NULL DEFAULT 0,
      updated_at_ms INTEGER NOT NULL DEFAULT 0,
      payload_json TEXT NOT NULL,
      FOREIGN KEY (class_id) REFERENCES school_classes(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_school_students_class_id
      ON school_students(class_id, number);
    CREATE INDEX IF NOT EXISTS idx_school_students_ra
      ON school_students(ra);
    CREATE INDEX IF NOT EXISTS idx_school_students_name
      ON school_students(name);

    CREATE TABLE IF NOT EXISTS school_users (
      email TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL DEFAULT 0,
      id TEXT,
      name TEXT,
      role TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      updated_at_ms INTEGER NOT NULL DEFAULT 0,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS school_holidays (
      id TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL DEFAULT 0,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      is_official INTEGER NOT NULL DEFAULT 1,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS school_logs (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at_ms INTEGER NOT NULL DEFAULT 0,
      payload_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_school_logs_kind_ts
      ON school_logs(kind, sort_order, created_at_ms DESC);

    CREATE TABLE IF NOT EXISTS school_meta (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at_ms INTEGER NOT NULL DEFAULT 0
    );
  `);
};

export const initSqliteStore = (dataDir: string): string => {
  if (dbInstance) return resolvedDbPath;

  const candidatePaths = [
    process.env.EMEB_SQLITE_PATH?.trim(),
    path.join(dataDir, 'candelario_2027.sqlite'),
    path.join(os.tmpdir(), 'candelario_2027.sqlite'),
  ].filter((p): p is string => Boolean(p));

  let lastErr: unknown = null;
  for (const candidate of candidatePaths) {
    try {
      const dir = path.dirname(candidate);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const db = new DatabaseSync(candidate);
      createSchema(db);
      dbInstance = db;
      resolvedDbPath = candidate;
      return resolvedDbPath;
    } catch (err) {
      lastErr = err;
    }
  }

  throw new Error(
    `Falha ao inicializar banco de dados SQLite: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`
  );
};

const ensureDb = (): DatabaseSync => {
  if (!dbInstance) {
    initSqliteStore(path.join(process.cwd(), '.emeb_data'));
  }
  return dbInstance!;
};

export const readSharedStateFromSqlite = <T extends Record<string, any>>(): T | null => {
  const db = ensureDb();

  const metaRows = db
    .prepare('SELECT key, value_json FROM school_meta')
    .all() as Array<{ key: string; value_json: string }>;

  const userRows = db
    .prepare('SELECT payload_json FROM school_users ORDER BY sort_order ASC')
    .all() as Array<{ payload_json: string }>;

  const classRows = db
    .prepare('SELECT id, payload_json FROM school_classes ORDER BY sort_order ASC')
    .all() as Array<{ id: string; payload_json: string }>;

  if (metaRows.length === 0 && userRows.length === 0 && classRows.length === 0) {
    return null;
  }

  const state: Record<string, any> = {};
  for (const row of metaRows) {
    if (row.key === 'core_meta') {
      const core = safeJsonParse<Record<string, any>>(row.value_json, {});
      Object.assign(state, core);
    } else {
      state[row.key] = safeJsonParse(row.value_json, undefined);
    }
  }

  if (userRows.length > 0) {
    state.authorizedUsers = userRows
      .map((r) => safeJsonParse<any>(r.payload_json, null))
      .filter(Boolean);
  }

  const holidayRows = db
    .prepare('SELECT payload_json FROM school_holidays ORDER BY sort_order ASC')
    .all() as Array<{ payload_json: string }>;
  if (holidayRows.length > 0) {
    state.holidays = holidayRows
      .map((r) => safeJsonParse<any>(r.payload_json, null))
      .filter(Boolean);
  }

  if (classRows.length > 0) {
    const studentRows = db
      .prepare('SELECT class_id, payload_json FROM school_students ORDER BY number ASC, rowid ASC')
      .all() as Array<{ class_id: string; payload_json: string }>;
    const studentsByClass = new Map<string, any[]>();
    for (const stRow of studentRows) {
      const parsedStudent = safeJsonParse<any>(stRow.payload_json, null);
      if (!parsedStudent) continue;
      const list = studentsByClass.get(stRow.class_id);
      if (list) {
        list.push(parsedStudent);
      } else {
        studentsByClass.set(stRow.class_id, [parsedStudent]);
      }
    }

    state.classes = classRows
      .map((cRow) => {
        const parsedClass = safeJsonParse<any>(cRow.payload_json, null);
        if (!parsedClass) return null;
        const sqlStudents = studentsByClass.get(cRow.id);
        return {
          ...parsedClass,
          students: sqlStudents ?? (Array.isArray(parsedClass.students) ? parsedClass.students : []),
        };
      })
      .filter(Boolean);
  }

  const logRows = db
    .prepare('SELECT kind, payload_json FROM school_logs ORDER BY sort_order ASC, created_at_ms DESC')
    .all() as Array<{ kind: string; payload_json: string }>;

  const logBuckets: Record<string, any[]> = {
    access_session: [],
    school_notice: [],
    calendar_audit: [],
    security_audit: [],
    fcm_alert: [],
  };

  for (const row of logRows) {
    const parsed = safeJsonParse<any>(row.payload_json, null);
    if (!parsed) continue;
    if (!logBuckets[row.kind]) logBuckets[row.kind] = [];
    logBuckets[row.kind].push(parsed);
  }

  if (logBuckets.access_session.length > 0) state.accessSessionLogs = logBuckets.access_session;
  if (logBuckets.school_notice.length > 0) state.schoolNotices = logBuckets.school_notice;
  if (logBuckets.calendar_audit.length > 0) state.calendarAuditLogs = logBuckets.calendar_audit;
  if (logBuckets.security_audit.length > 0) state.securityAuditLogs = logBuckets.security_audit;
  if (logBuckets.fcm_alert.length > 0) state.fcmAlerts = logBuckets.fcm_alert;

  if (typeof state.updatedAtMs !== 'number') {
    state.updatedAtMs = Date.now();
  }

  return state as T;
};

export const writeSharedStateToSqlite = (state: Record<string, any>): void => {
  const db = ensureDb();
  const nowMs = Date.now();

  db.exec('BEGIN IMMEDIATE');
  try {
    const upsertMeta = db.prepare(`
      INSERT INTO school_meta (key, value_json, updated_at_ms)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value_json = excluded.value_json,
        updated_at_ms = excluded.updated_at_ms
    `);
    const deleteMeta = db.prepare('DELETE FROM school_meta WHERE key = ?');

    const coreMeta = {
      cleanResetEpochId: state.cleanResetEpochId,
      classesUpdatedAtMs: state.classesUpdatedAtMs || 0,
      updatedAtMs: state.updatedAtMs || nowMs,
      lastAutoFcmWindowKey: state.lastAutoFcmWindowKey,
    };
    upsertMeta.run('core_meta', JSON.stringify(coreMeta), nowMs);

    const jsonMetaKeys = [
      'attendanceWindowConfig',
      'discoveredNominalPdfs',
      'discoveredDrivePhotos',
      'genderDictionary',
      'officialCalendarConfig',
      'lgpdConfig',
      'fcmTokens',
      'fcmConfig',
      'cloudLinks',
    ] as const;

    for (const key of jsonMetaKeys) {
      if (state[key] !== undefined) {
        upsertMeta.run(key, JSON.stringify(state[key]), nowMs);
      } else {
        deleteMeta.run(key);
      }
    }

    if (Array.isArray(state.authorizedUsers)) {
      db.exec('DELETE FROM school_users');
      const insertUser = db.prepare(`
        INSERT INTO school_users (email, sort_order, id, name, role, active, updated_at_ms, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      state.authorizedUsers.forEach((u: any, idx: number) => {
        if (!u || typeof u.email !== 'string') return;
        const email = u.email.trim().toLowerCase();
        if (!email) return;
        insertUser.run(
          email,
          idx,
          String(u.id || `usr-${idx + 1}`),
          String(u.name || ''),
          String(u.role || 'usuario'),
          u.active === false ? 0 : 1,
          Number(u.updatedAtMs || 0),
          JSON.stringify({ ...u, email })
        );
      });
    }

    if (Array.isArray(state.holidays)) {
      db.exec('DELETE FROM school_holidays');
      const insertHoliday = db.prepare(`
        INSERT INTO school_holidays (id, sort_order, date, name, type, is_official, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const seenHolIds = new Set<string>();
      state.holidays.forEach((h: any, idx: number) => {
        if (!h || !h.date) return;
        let hid = String(h.id || `hol-${idx + 1}`);
        if (seenHolIds.has(hid)) hid = `${hid}-${idx + 1}`;
        seenHolIds.add(hid);
        insertHoliday.run(
          hid,
          idx,
          String(h.date),
          String(h.name || ''),
          String(h.type || 'nacional'),
          h.isOfficial === false ? 0 : 1,
          JSON.stringify({ ...h, id: hid })
        );
      });
    }

    if (Array.isArray(state.classes)) {
      db.exec('DELETE FROM school_students');
      db.exec('DELETE FROM school_classes');

      const insertClass = db.prepare(`
        INSERT INTO school_classes (
          id, sort_order, name, shift, teacher_name, teacher_email,
          total_students, presence_rate, monthly_absences, updated_at_ms, payload_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertStudent = db.prepare(`
        INSERT INTO school_students (
          id, class_id, ra, name, number, active,
          total_absences_month, consecutive_absences, updated_at_ms, payload_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const seenClassIds = new Set<string>();
      const seenStudentIds = new Set<string>();

      state.classes.forEach((cls: any, clsIdx: number) => {
        if (!cls || typeof cls !== 'object') return;
        let classId = String(cls.id || `cls-${clsIdx + 1}`);
        if (seenClassIds.has(classId)) classId = `${classId}-${clsIdx + 1}`;
        seenClassIds.add(classId);

        const studentsList = Array.isArray(cls.students) ? cls.students : [];
        const classSkeleton = {
          ...cls,
          id: classId,
          totalStudents: studentsList.length,
          students: [],
        };

        insertClass.run(
          classId,
          clsIdx,
          String(cls.name || classId),
          String(cls.shift || cls.periodo || ''),
          String(cls.teacherName || ''),
          String(cls.teacherEmail || ''),
          studentsList.length,
          Number(cls.presenceRate || 0),
          Number(cls.monthlyAbsences || 0),
          Number(cls.updatedAtMs || nowMs),
          JSON.stringify(classSkeleton)
        );

        studentsList.forEach((st: any, stIdx: number) => {
          if (!st || typeof st !== 'object') return;
          const stName = String(st.name || '').trim();
          if (!stName) return;
          let stId = String(st.id || `${classId}-s${st.number || stIdx + 1}`);
          if (seenStudentIds.has(stId)) stId = `${stId}-${clsIdx}-${stIdx}`;
          seenStudentIds.add(stId);

          const isActive = st.active !== false && st.status !== 'TRANSFERIDO' && st.status !== 'REMANEJADO' ? 1 : 0;
          insertStudent.run(
            stId,
            classId,
            st.ra ? String(st.ra).trim() : null,
            stName,
            Number(st.number || stIdx + 1),
            isActive,
            Number(st.totalAbsencesMonth || 0),
            Number(st.consecutiveAbsences || 0),
            Number(st.updatedAtMs || cls.updatedAtMs || 0),
            JSON.stringify({ ...st, id: stId })
          );
        });
      });
    }

    db.exec('DELETE FROM school_logs');
    const insertLog = db.prepare(`
      INSERT INTO school_logs (id, kind, sort_order, created_at_ms, payload_json)
      VALUES (?, ?, ?, ?, ?)
    `);
    const seenLogIds = new Set<string>();
    const writeLogBucket = (kind: string, items: any[] | undefined, maxItems: number) => {
      if (!Array.isArray(items)) return;
      items.slice(0, maxItems).forEach((item, idx) => {
        if (!item || typeof item !== 'object') return;
        let logId = String(item.id || `${kind}-${idx}-${Date.now()}`);
        const scopedId = `${kind}:${logId}`;
        if (seenLogIds.has(scopedId)) {
          logId = `${logId}-${idx}`;
        }
        seenLogIds.add(`${kind}:${logId}`);
        const createdMs = Number(
          item.createdAtMs ||
            item.timestampMs ||
            (item.timestampISO ? Date.parse(item.timestampISO) : 0) ||
            (item.loginAt ? Date.parse(item.loginAt) : 0) ||
            nowMs
        );
        insertLog.run(
          `${kind}:${logId}`,
          kind,
          idx,
          Number.isFinite(createdMs) ? createdMs : nowMs,
          JSON.stringify(item)
        );
      });
    };

    writeLogBucket('access_session', state.accessSessionLogs, 150);
    writeLogBucket('school_notice', state.schoolNotices, 60);
    writeLogBucket('calendar_audit', state.calendarAuditLogs, 200);
    writeLogBucket('security_audit', state.securityAuditLogs, 300);
    writeLogBucket('fcm_alert', state.fcmAlerts, 60);

    db.exec('COMMIT');
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    throw err;
  }
};

export const queryStudentsFromSqlite = (options?: {
  classId?: string;
  search?: string;
  limit?: number;
}): Array<{
  id: string;
  classId: string;
  ra: string | null;
  name: string;
  number: number;
  active: boolean;
  totalAbsencesMonth: number;
  consecutiveAbsences: number;
}> => {
  const db = ensureDb();
  const maxRows = Math.min(Math.max(Number(options?.limit || 100), 1), 1500);
  const cleanClassId = options?.classId?.trim() || '';
  const cleanSearch = options?.search?.trim() || '';

  const whereClauses: string[] = [];
  const params: Array<string | number> = [];

  if (cleanClassId) {
    whereClauses.push('class_id = ?');
    params.push(cleanClassId);
  }
  if (cleanSearch) {
    whereClauses.push('(UPPER(name) LIKE UPPER(?) OR ra LIKE ?)');
    params.push(`%${cleanSearch}%`, `%${cleanSearch}%`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  params.push(maxRows);

  const rows = db
    .prepare(
      `SELECT id, class_id, ra, name, number, active, total_absences_month, consecutive_absences
       FROM school_students
       ${whereSql}
       ORDER BY class_id ASC, number ASC
       LIMIT ?`
    )
    .all(...params) as Array<{
    id: string;
    class_id: string;
    ra: string | null;
    name: string;
    number: number;
    active: number;
    total_absences_month: number;
    consecutive_absences: number;
  }>;

  return rows.map((r) => ({
    id: r.id,
    classId: r.class_id,
    ra: r.ra,
    name: r.name,
    number: r.number,
    active: r.active === 1,
    totalAbsencesMonth: r.total_absences_month,
    consecutiveAbsences: r.consecutive_absences,
  }));
};

export const getSqliteDatabaseStats = (): SqliteDatabaseStats => {
  const db = ensureDb();
  const countTable = (tableName: string): number => {
    const row = db.prepare(`SELECT COUNT(*) AS cnt FROM ${tableName}`).get() as { cnt: number };
    return Number(row?.cnt || 0);
  };
  let journalMode = 'wal';
  try {
    const jm = db.prepare('PRAGMA journal_mode').get() as { journal_mode?: string };
    if (jm?.journal_mode) journalMode = String(jm.journal_mode);
  } catch {
    // ignore
  }
  let dbFileSizeBytes = 0;
  try {
    if (resolvedDbPath && fs.existsSync(resolvedDbPath)) {
      dbFileSizeBytes = fs.statSync(resolvedDbPath).size;
    }
  } catch {
    // ignore
  }

  return {
    engine: 'sqlite',
    journalMode,
    dbPath: resolvedDbPath,
    dbFileSizeBytes,
    classesCount: countTable('school_classes'),
    studentsCount: countTable('school_students'),
    usersCount: countTable('school_users'),
    holidaysCount: countTable('school_holidays'),
    logsCount: countTable('school_logs'),
    quotaLimit: 'unlimited',
    firestoreEnabled: false,
  };
};
