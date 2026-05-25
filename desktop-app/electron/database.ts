import fs from "node:fs";
import path from "node:path";
import initSqlJs, { Database } from "sql.js";

export interface AppActivityRow {
  id: number;
  appName: string;
  windowTitle: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
}

export interface DashboardSnapshot {
  todayTotalSeconds: number;
  sessionCount: number;
  topApps: Array<{ name: string; seconds: number }>;
  hourlyUsage: Array<{ hour: string; seconds: number }>;
  categoryUsage: Array<{ name: string; seconds: number }>;
  recentSessions: AppActivityRow[];
}

export type AppActivitySession = Omit<AppActivityRow, "id">;
export type LiveAppActivitySession = AppActivitySession & { id?: number };

const PRODUCTIVE_APPS = new Set([
  "visual studio code",
  "code",
  "intellij idea",
  "webstorm",
  "pycharm",
  "terminal",
  "windows terminal",
  "postman",
  "notion"
]);

const DISTRACTING_APPS = new Set([
  "youtube",
  "netflix",
  "spotify",
  "discord"
]);

function getCategory(appName: string) {
  const normalized = appName.trim().toLowerCase();

  if (PRODUCTIVE_APPS.has(normalized)) {
    return "Productive";
  }

  if (DISTRACTING_APPS.has(normalized)) {
    return "Distracting";
  }

  return "Neutral";
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function toIsoTimestamp(date: Date) {
  return date.toISOString();
}

function fromSqlRow(result: Record<string, unknown>): AppActivityRow {
  return {
    id: Number(result.id),
    appName: String(result.app_name),
    windowTitle: String(result.window_title),
    startTime: String(result.start_time),
    endTime: String(result.end_time),
    durationSeconds: Number(result.duration_seconds)
  };
}

export class FocusTrackDatabase {
  private dbPath: string;
  private db!: Database;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  static async create(userDataPath: string) {
    const SQL = await initSqlJs();
    const dbPath = path.join(userDataPath, "focustrack.db");
    const fileBuffer = fs.existsSync(dbPath) ? fs.readFileSync(dbPath) : undefined;
    const database = new FocusTrackDatabase(dbPath);

    database.db = fileBuffer
      ? new SQL.Database(new Uint8Array(fileBuffer))
      : new SQL.Database();

    database.initializeSchema();
    database.persist();

    return database;
  }

  private initializeSchema() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS app_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_name TEXT NOT NULL,
        window_title TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL CHECK(duration_seconds >= 0)
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  insertAppActivity(session: AppActivitySession) {
    this.db.run(
      `
        INSERT INTO app_activity (
          app_name,
          window_title,
          start_time,
          end_time,
          duration_seconds
        ) VALUES (?, ?, ?, ?, ?)
      `,
      [
        session.appName,
        session.windowTitle,
        session.startTime,
        session.endTime,
        session.durationSeconds
      ]
    );

    this.persist();

    const result = this.db.exec("SELECT MAX(id) AS id FROM app_activity");
    const id = result[0]?.values[0]?.[0];
    return Number(id);
  }

  updateAppActivity(id: number, session: AppActivitySession) {
    this.db.run(
      `
        UPDATE app_activity
        SET
          app_name = ?,
          window_title = ?,
          start_time = ?,
          end_time = ?,
          duration_seconds = ?
        WHERE id = ?
      `,
      [
        session.appName,
        session.windowTitle,
        session.startTime,
        session.endTime,
        session.durationSeconds,
        id
      ]
    );

    this.persist();
  }

  getDashboardSnapshot(activeSession?: LiveAppActivitySession): DashboardSnapshot {
    const todayStart = startOfToday();
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const statement = this.db.prepare(
      `
        SELECT
          id,
          app_name,
          window_title,
          start_time,
          end_time,
          duration_seconds
        FROM app_activity
        WHERE start_time >= ? AND start_time < ?
        ORDER BY start_time DESC
      `
    );

    statement.bind([toIsoTimestamp(todayStart), toIsoTimestamp(todayEnd)]);

    const sessions: AppActivityRow[] = [];

    while (statement.step()) {
      sessions.push(fromSqlRow(statement.getAsObject()));
    }

    statement.free();

    if (activeSession?.id) {
      const existingSessionIndex = sessions.findIndex(
        (session) => session.id === activeSession.id
      );

      if (existingSessionIndex >= 0) {
        sessions.splice(existingSessionIndex, 1);
      }
    }

    if (activeSession) {
      sessions.unshift({
        id: activeSession.id ?? 0,
        ...activeSession
      });
    }

    const topAppsMap = new Map<string, number>();
    const hourlyMap = new Map<string, number>();
    const categoryMap = new Map<string, number>([
      ["Productive", 0],
      ["Neutral", 0],
      ["Distracting", 0]
    ]);

    let todayTotalSeconds = 0;

    for (const session of sessions) {
      todayTotalSeconds += session.durationSeconds;
      topAppsMap.set(
        session.appName,
        (topAppsMap.get(session.appName) ?? 0) + session.durationSeconds
      );

      const sessionHour = new Date(session.startTime).getHours();
      const hourLabel = `${String(sessionHour).padStart(2, "0")}:00`;
      hourlyMap.set(hourLabel, (hourlyMap.get(hourLabel) ?? 0) + session.durationSeconds);

      const category = getCategory(session.appName);
      categoryMap.set(category, (categoryMap.get(category) ?? 0) + session.durationSeconds);
    }

    const topApps = [...topAppsMap.entries()]
      .map(([name, seconds]) => ({ name, seconds }))
      .sort((left, right) => right.seconds - left.seconds)
      .slice(0, 5);

    const hourlyUsage = Array.from({ length: 24 }, (_, hour) => {
      const label = `${String(hour).padStart(2, "0")}:00`;
      return {
        hour: label,
        seconds: hourlyMap.get(label) ?? 0
      };
    });

    const categoryUsage = [...categoryMap.entries()].map(([name, seconds]) => ({
      name,
      seconds
    }));

    return {
      todayTotalSeconds,
      sessionCount: sessions.length,
      topApps,
      hourlyUsage,
      categoryUsage,
      recentSessions: sessions.slice(0, 10)
    };
  }

  persist() {
    fs.writeFileSync(this.dbPath, Buffer.from(this.db.export()));
  }
}
