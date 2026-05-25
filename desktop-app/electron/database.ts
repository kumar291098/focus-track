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

export function getCategory(db: FocusTrackDatabase, appName: string): string {
  const normalized = appName.trim().toLowerCase();
  
  // 1. Check exact match override
  let categoryOverride = db.getSetting(`app_category:${normalized}`, "");
  if (categoryOverride === "Productive" || categoryOverride === "Neutral" || categoryOverride === "Distracting") {
    return categoryOverride;
  }

  // 2. If it's a browser tab with a domain in parentheses, check the domain override
  const match = normalized.match(/\(([^)]+)\)/);
  if (match && match[1]) {
    const domain = match[1].trim();
    categoryOverride = db.getSetting(`app_category:${domain}`, "");
    if (categoryOverride === "Productive" || categoryOverride === "Neutral" || categoryOverride === "Distracting") {
      return categoryOverride;
    }
    
    if (PRODUCTIVE_APPS.has(domain)) {
      return "Productive";
    }
    if (DISTRACTING_APPS.has(domain)) {
      return "Distracting";
    }
  }

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
    database.initializeDefaultSettings();
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

  private initializeDefaultSettings() {
    this.saveSetting("poll_interval_ms", this.getSetting("poll_interval_ms", "5000"));
    this.saveSetting("idle_threshold_seconds", this.getSetting("idle_threshold_seconds", "60"));
  }

  saveSetting(key: string, value: string) {
    this.db.run(
      `REPLACE INTO settings (key, value) VALUES (?, ?)`,
      [key, value]
    );
    this.persist();
  }

  getSetting(key: string, defaultValue: string): string {
    try {
      const stmt = this.db.prepare("SELECT value FROM settings WHERE key = ?");
      stmt.bind([key]);
      if (stmt.step()) {
        const val = String(stmt.getAsObject().value);
        stmt.free();
        return val;
      }
      stmt.free();
    } catch (e) {
      // Ignored
    }
    return defaultValue;
  }

  getAllSettings(): Record<string, string> {
    const settings: Record<string, string> = {};
    try {
      const stmt = this.db.prepare("SELECT key, value FROM settings");
      while (stmt.step()) {
        const obj = stmt.getAsObject();
        settings[String(obj.key)] = String(obj.value);
      }
      stmt.free();
    } catch (e) {
      // Ignored
    }
    return settings;
  }

  clearDatabase() {
    this.db.run("DELETE FROM app_activity");
    this.persist();
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

  getDashboardSnapshot(activeSession?: LiveAppActivitySession, range: string = "today"): DashboardSnapshot {
    let startTimestamp: string;
    let endTimestamp: string;
    const now = new Date();

    if (range.match(/^\d{4}-\d{2}-\d{2}:\d{4}-\d{2}-\d{2}$/)) {
      const [startStr, endStr] = range.split(":");
      const startParts = startStr.split("-").map(Number);
      const endParts = endStr.split("-").map(Number);
      const start = new Date(startParts[0], startParts[1] - 1, startParts[2]);
      const end = new Date(endParts[0], endParts[1] - 1, endParts[2]);
      end.setDate(end.getDate() + 1);
      startTimestamp = start.toISOString();
      endTimestamp = end.toISOString();
    } else if (range.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const parts = range.split("-").map(Number);
      const start = new Date(parts[0], parts[1] - 1, parts[2]);
      startTimestamp = start.toISOString();
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      endTimestamp = end.toISOString();
    } else if (range.match(/^\d{4}-\d{2}$/)) {
      const parts = range.split("-").map(Number);
      const start = new Date(parts[0], parts[1] - 1, 1);
      startTimestamp = start.toISOString();
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      endTimestamp = end.toISOString();
    } else if (range === "weekly") {
      const start = new Date();
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      startTimestamp = start.toISOString();

      const end = new Date();
      end.setDate(now.getDate() + 1);
      end.setHours(0, 0, 0, 0);
      endTimestamp = end.toISOString();
    } else if (range === "all") {
      startTimestamp = "1970-01-01T00:00:00.000Z";
      endTimestamp = "2999-12-31T23:59:59.000Z";
    } else {
      // today
      const todayStart = startOfToday();
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);
      startTimestamp = todayStart.toISOString();
      endTimestamp = todayEnd.toISOString();
    }

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

    statement.bind([startTimestamp, endTimestamp]);

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

      const category = getCategory(this, session.appName);
      categoryMap.set(category, (categoryMap.get(category) ?? 0) + session.durationSeconds);
    }

    const topApps = [...topAppsMap.entries()]
      .map(([name, seconds]) => ({ name, seconds }))
      .sort((left, right) => right.seconds - left.seconds)
      .slice(0, 100); // Allow more top apps for detailed list filtering

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
      recentSessions: sessions
    };
  }

  persist() {
    fs.writeFileSync(this.dbPath, Buffer.from(this.db.export()));
  }

  getHistoryDates(): { days: string[]; months: string[] } {
    const days: string[] = [];
    const months: string[] = [];
    try {
      // Unique days containing activity
      const dayStmt = this.db.prepare(
        `SELECT DISTINCT substr(start_time, 1, 10) as date_str 
         FROM app_activity 
         ORDER BY date_str DESC`
      );
      while (dayStmt.step()) {
        const val = String(dayStmt.getAsObject().date_str);
        if (val && val !== "undefined" && val !== "null") {
          days.push(val);
        }
      }
      dayStmt.free();

      // Unique months containing activity
      const monthStmt = this.db.prepare(
        `SELECT DISTINCT substr(start_time, 1, 7) as month_str 
         FROM app_activity 
         ORDER BY month_str DESC`
      );
      while (monthStmt.step()) {
        const val = String(monthStmt.getAsObject().month_str);
        if (val && val !== "undefined" && val !== "null") {
          months.push(val);
        }
      }
      monthStmt.free();
    } catch (e) {
      // Ignored
    }
    return { days, months };
  }
}

