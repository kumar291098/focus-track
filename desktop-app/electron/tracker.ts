import path from "node:path";
import activeWin from "active-win";
import { powerMonitor } from "electron";
import { DashboardSnapshot, FocusTrackDatabase } from "./database.js";
import { getLatestWebActivity } from "./server.js";

function isBrowser(appName: string): boolean {
  const name = appName.toLowerCase();
  return name.includes("chrome") || 
         name.includes("edge") || 
         name.includes("firefox") || 
         name.includes("brave") || 
         name.includes("opera") || 
         name.includes("safari") || 
         name === "msedge";
}

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

    const intervalMs = Number(this.db.getSetting("poll_interval_ms", "5000"));

    void this.poll();
    this.timer = setInterval(() => {
      this.persistCurrentSession(new Date());
      void this.poll();
    }, intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.flushCurrentSession(new Date());
  }

  restart() {
    this.stop();
    this.start();
  }

  getStatus(): TrackingStatus {
    const intervalMs = Number(this.db.getSetting("poll_interval_ms", "5000"));
    return {
      isTracking: this.timer !== null,
      pollIntervalMs: intervalMs,
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

  getDashboardSnapshot(range: "today" | "weekly" | "all" = "today"): DashboardSnapshot {
    return this.db.getDashboardSnapshot(this.getActiveSessionForDashboard(), range);
  }

  private async poll() {
    if (this.isPolling) {
      return;
    }

    this.isPolling = true;

    try {
      const idleThreshold = Number(this.db.getSetting("idle_threshold_seconds", "60"));
      const systemIdleTime = powerMonitor.getSystemIdleTime();
      const isIdle = systemIdleTime >= idleThreshold;

      const now = new Date();
      let nextAppName = "";
      let nextWindowTitle = "";

      if (isIdle) {
        nextAppName = "Idle / Away";
        nextWindowTitle = `Away from computer (idle for ${systemIdleTime}s)`;
      } else {
        const result = await activeWin();

        if (!result?.owner?.name) {
          this.flushCurrentSession(now);
          return;
        }

        let appName = result.owner.name.trim() || "Unknown App";
        const title = result.title?.trim() || "Untitled Window";
        const execPath = result.owner.path;

        // 1. Uniquely recognize this app (FocusTrack)
        if (
          title.includes("FocusTrack") || 
          (execPath && (execPath.toLowerCase().includes("focustrack") || execPath.toLowerCase().includes("focus-track")))
        ) {
          appName = "FocusTrack";
        } 
        // 2. Recognize other Electron apps separately based on their executable name
        else if (appName.toLowerCase() === "electron" || appName.toLowerCase() === "electron.exe") {
          if (execPath) {
            const baseName = path.basename(execPath, path.extname(execPath));
            if (baseName && baseName.toLowerCase() !== "electron") {
              appName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
            } else {
              appName = "Electron App";
            }
          } else {
            appName = "Electron App";
          }
        }

        const latestWeb = getLatestWebActivity();
        if (isBrowser(appName) && latestWeb && (Date.now() - latestWeb.timestamp < 15000)) {
          nextAppName = `${appName} (${latestWeb.domain})`;
          nextWindowTitle = latestWeb.title || title;
        } else {
          nextAppName = appName;
          nextWindowTitle = title;
        }
      }

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
