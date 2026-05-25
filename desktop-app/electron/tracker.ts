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

function extractDomainFromTitle(windowTitle: string): { domain: string; cleanTitle: string } | null {
  if (!windowTitle) return null;

  // 1. Clean the title by removing browser suffixes
  let cleanTitle = windowTitle;
  const browserSuffixes = [
    / - Google Chrome$/i,
    / - Microsoft Edge$/i,
    / - Brave$/i,
    / - Mozilla Firefox$/i,
    / - Opera$/i,
    / - Vivaldi$/i,
    / - Safari$/i,
    / - Chromium$/i,
    / - msedge$/i,
    / - chrome$/i
  ];

  for (const suffix of browserSuffixes) {
    if (suffix.test(cleanTitle)) {
      cleanTitle = cleanTitle.replace(suffix, "");
      break;
    }
  }

  cleanTitle = cleanTitle.trim();

  // 2. Check for explicit domain in the title
  // Looking for pattern like "example.com" or "sub.domain.org"
  // Avoiding matching things like "Node.js" by validating the domain extension
  const domainRegex = /\b((?:[a-z0-9-]+\.)+(?:com|org|net|edu|gov|io|co|dev|ai|me|info|biz|tv|cc|us|uk|ca|in|de|jp|fr|ru|br|au))\b/i;
  const match = cleanTitle.match(domainRegex);
  if (match && match[1]) {
    let domain = match[1].toLowerCase();
    if (domain.startsWith("www.")) {
      domain = domain.substring(4);
    }
    // Make sure it doesn't match node.js or similar common terms
    if (domain !== "node.js" && domain !== "chart.js" && domain !== "sql.js" && domain !== "three.js" && domain !== "vue.js" && domain !== "react.js" && domain !== "socket.io" && domain !== "d3.js") {
      return { domain, cleanTitle };
    }
  }

  // 3. Fallback to keyword-based detection for popular sites
  const lowerTitle = cleanTitle.toLowerCase();
  
  const rules = [
    { keywords: ["youtube"], domain: "youtube.com" },
    { keywords: ["github"], domain: "github.com" },
    { keywords: ["gitlab"], domain: "gitlab.com" },
    { keywords: ["stackoverflow", "stack overflow"], domain: "stackoverflow.com" },
    { keywords: ["stackexchange", "stack exchange"], domain: "stackexchange.com" },
    { keywords: ["reddit"], domain: "reddit.com" },
    { keywords: ["linkedin"], domain: "linkedin.com" },
    { keywords: ["twitter", " x.com", "tweet"], domain: "twitter.com" },
    { keywords: ["wikipedia"], domain: "wikipedia.org" },
    { keywords: ["facebook"], domain: "facebook.com" },
    { keywords: ["amazon"], domain: "amazon.com" },
    { keywords: ["netflix"], domain: "netflix.com" },
    { keywords: ["spotify"], domain: "spotify.com" },
    { keywords: ["gmail", "google mail"], domain: "mail.google.com" },
    { keywords: ["chatgpt", "openai"], domain: "chatgpt.com" },
    { keywords: ["claude", "anthropic"], domain: "claude.ai" },
    { keywords: ["notion"], domain: "notion.so" },
    { keywords: ["slack"], domain: "slack.com" },
    { keywords: ["figma"], domain: "figma.com" },
    { keywords: ["google meet", "meet.google"], domain: "meet.google.com" },
    { keywords: ["zoom"], domain: "zoom.us" },
    { keywords: ["microsoft teams", "teams.microsoft"], domain: "teams.microsoft.com" },
    { keywords: ["outlook", "hotmail"], domain: "outlook.live.com" },
    { keywords: ["google docs", "google document"], domain: "docs.google.com" },
    { keywords: ["google sheets", "google spreadsheet"], domain: "sheets.google.com" },
    { keywords: ["medium"], domain: "medium.com" },
    { keywords: ["npmjs", " npm "], domain: "npmjs.com" },
    { keywords: ["stackblitz"], domain: "stackblitz.com" },
    { keywords: ["vercel"], domain: "vercel.com" },
    { keywords: ["netlify"], domain: "netlify.com" },
    { keywords: ["firebase"], domain: "firebase.google.com" },
    { keywords: ["aws", "amazon web services"], domain: "aws.amazon.com" },
    { keywords: ["coursera"], domain: "coursera.org" },
    { keywords: ["udemy"], domain: "udemy.com" },
    { keywords: ["duolingo"], domain: "duolingo.com" },
    { keywords: ["yahoo"], domain: "yahoo.com" },
    { keywords: ["pinterest"], domain: "pinterest.com" },
    { keywords: ["instagram"], domain: "instagram.com" },
    { keywords: ["twitch"], domain: "twitch.tv" },
    { keywords: ["quora"], domain: "quora.com" },
    { keywords: ["tiktok"], domain: "tiktok.com" },
    { keywords: ["dropbox"], domain: "dropbox.com" },
    { keywords: ["whatsapp"], domain: "web.whatsapp.com" },
    { keywords: ["telegram"], domain: "web.telegram.org" },
    { keywords: ["discord"], domain: "discord.com" },
    { keywords: ["w3schools"], domain: "w3schools.com" },
    { keywords: ["geeksforgeeks"], domain: "geeksforgeeks.org" },
    { keywords: ["mdn", "mozilla developer"], domain: "developer.mozilla.org" },
    { keywords: ["trello"], domain: "trello.com" },
    { keywords: ["canva"], domain: "canva.com" },
    { keywords: ["dev.to"], domain: "dev.to" },
    { keywords: ["google search", "google translation", "google translate"], domain: "google.com" }
  ];

  for (const rule of rules) {
    if (rule.keywords.some(keyword => lowerTitle.includes(keyword))) {
      return { domain: rule.domain, cleanTitle };
    }
  }

  if (lowerTitle === "google" || lowerTitle.startsWith("google ")) {
    return { domain: "google.com", cleanTitle };
  }

  return null;
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
        if (isBrowser(appName)) {
          if (latestWeb && (Date.now() - latestWeb.timestamp < 15000)) {
            nextAppName = `${appName} (${latestWeb.domain})`;
            nextWindowTitle = latestWeb.title || title;
          } else {
            const fallback = extractDomainFromTitle(title);
            if (fallback) {
              nextAppName = `${appName} (${fallback.domain})`;
              nextWindowTitle = fallback.cleanTitle;
            } else {
              nextAppName = appName;
              nextWindowTitle = title;
            }
          }
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
