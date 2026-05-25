import activeWin from "active-win";
import { DashboardSnapshot, FocusTrackDatabase } from "./database.js";

const POLL_INTERVAL_MS = 5_000;

export interface TrackingStatus {
  isTracking: boolean;
  pollIntervalMs: number;
  currentSession: {
    appName: string;
    windowTitle: string;
    startedAt: string;
    durationSeconds: number;
  } | null;
  lastError: string | null;
}

interface ActiveSession {
  id: number;
  appName: string;
  windowTitle: string;
  startedAt: Date;
}

export class ActivityTracker {
  private db: FocusTrackDatabase;
  private log: (message: string, error?: unknown) => void;
  private timer: NodeJS.Timeout | null = null;
  private currentSession: ActiveSession | null = null;
  private lastError: string | null = null;
  private isPolling = false;

  constructor(
    db: FocusTrackDatabase,
    log: (message: string, error?: unknown) => void = () => {}
  ) {
    this.db = db;
    this.log = log;
  }

  start() {
    if (this.timer) {
      return;
    }

    void this.poll();
    this.timer = setInterval(() => {
      this.persistCurrentSession(new Date());
      void this.poll();
    }, POLL_INTERVAL_MS);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.flushCurrentSession(new Date());
  }

  getStatus(): TrackingStatus {
    return {
      isTracking: this.timer !== null,
      pollIntervalMs: POLL_INTERVAL_MS,
      currentSession: this.currentSession
          ? {
            appName: this.currentSession.appName,
            windowTitle: this.currentSession.windowTitle,
            startedAt: this.currentSession.startedAt.toISOString(),
            durationSeconds: Math.max(
              1,
              Math.round((Date.now() - this.currentSession.startedAt.getTime()) / 1000)
            )
          }
        : null,
      lastError: this.lastError
    };
  }

  getDashboardSnapshot(): DashboardSnapshot {
    return this.db.getDashboardSnapshot(this.getActiveSessionForDashboard());
  }

  private async poll() {
    if (this.isPolling) {
      return;
    }

    this.isPolling = true;

    try {
      const result = await activeWin();
      const now = new Date();

      if (!result?.owner?.name) {
        this.flushCurrentSession(now);
        return;
      }

      const nextAppName = result.owner.name.trim() || "Unknown App";
      const nextWindowTitle = result.title?.trim() || "Untitled Window";

      if (!this.currentSession) {
        this.currentSession = this.createSession(nextAppName, nextWindowTitle, now);
        this.lastError = null;
        return;
      }

      const sessionChanged =
        this.currentSession.appName !== nextAppName ||
        this.currentSession.windowTitle !== nextWindowTitle;

      if (!sessionChanged) {
        this.persistCurrentSession(now);
        this.lastError = null;
        return;
      }

      this.flushCurrentSession(now);
      this.currentSession = this.createSession(nextAppName, nextWindowTitle, now);
      this.lastError = null;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : "Unknown tracking error";
      this.log("Activity poll failed", error);
    } finally {
      this.isPolling = false;
    }
  }

  private flushCurrentSession(endTime: Date) {
    if (!this.currentSession) {
      return;
    }

    const durationSeconds = Math.max(
      1,
      Math.round((endTime.getTime() - this.currentSession.startedAt.getTime()) / 1000)
    );

    this.persistCurrentSession(endTime);
    this.currentSession = null;
  }

  private createSession(appName: string, windowTitle: string, startedAt: Date) {
    const session = {
      appName,
      windowTitle,
      startTime: startedAt.toISOString(),
      endTime: startedAt.toISOString(),
      durationSeconds: 1
    };

    const id = this.db.insertAppActivity(session);

    return {
      id,
      appName,
      windowTitle,
      startedAt
    };
  }

  private persistCurrentSession(endTime: Date) {
    if (!this.currentSession) {
      return;
    }

    const durationSeconds = Math.max(
      1,
      Math.round((endTime.getTime() - this.currentSession.startedAt.getTime()) / 1000)
    );

    this.db.updateAppActivity(this.currentSession.id, {
      appName: this.currentSession.appName,
      windowTitle: this.currentSession.windowTitle,
      startTime: this.currentSession.startedAt.toISOString(),
      endTime: endTime.toISOString(),
      durationSeconds
    });
  }

  private getActiveSessionForDashboard() {
    if (!this.currentSession) {
      return undefined;
    }

    const now = new Date();
    const durationSeconds = Math.max(
      1,
      Math.round((now.getTime() - this.currentSession.startedAt.getTime()) / 1000)
    );

    return {
      id: this.currentSession.id,
      appName: this.currentSession.appName,
      windowTitle: this.currentSession.windowTitle,
      startTime: this.currentSession.startedAt.toISOString(),
      endTime: now.toISOString(),
      durationSeconds
    };
  }
}
