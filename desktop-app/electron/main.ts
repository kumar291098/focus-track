import { app, BrowserWindow, ipcMain, powerMonitor, Tray, Menu } from "electron";
import fs from "node:fs";
import path from "node:path";
import { FocusTrackDatabase } from "./database.js";
import { ActivityTracker } from "./tracker.js";
import { startServer, stopServer } from "./server.js";

const isDev = !!process.env.VITE_DEV_SERVER_URL;
let tracker: ActivityTracker | null = null;
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

app.setName("FocusTrack");

const singleInstanceLock = app.requestSingleInstanceLock();

if (!singleInstanceLock) {
  app.quit();
}

function writeStartupLog(message: string, error?: unknown) {
  const logDir = path.join(process.env.APPDATA ?? process.cwd(), "FocusTrack");
  const logPath = path.join(logDir, "startup.log");
  const detail = error instanceof Error ? `${error.message}\n${error.stack}` : "";

  fs.mkdirSync(logDir, { recursive: true });
  fs.appendFileSync(
    logPath,
    `[${new Date().toISOString()}] ${message}${detail ? `\n${detail}` : ""}\n`
  );
}

process.on("uncaughtException", (error) => {
  writeStartupLog("Uncaught exception", error);
});

process.on("unhandledRejection", (error) => {
  writeStartupLog("Unhandled rejection", error);
});

function createWindow() {
  writeStartupLog("Creating browser window");
  mainWindow = new BrowserWindow({
      width: 1440,
      height: 920,
      minWidth: 1100,
      minHeight: 760,
      icon: path.join(__dirname, "../../build/icon.ico"),
    backgroundColor: "#07111f",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }

  mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      return false;
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createTray() {
  let finalIconPath = path.join(__dirname, "../../build/icon.ico");
  if (!fs.existsSync(finalIconPath)) {
    finalIconPath = path.join(app.getAppPath(), "build/icon.ico");
  }

  try {
    tray = new Tray(finalIconPath);
    tray.setToolTip("FocusTrack");

    tray.on("click", () => {
      mainWindow?.show();
      mainWindow?.focus();
    });

    tray.on("double-click", () => {
      mainWindow?.show();
      mainWindow?.focus();
    });
  } catch (err) {
    writeStartupLog("Failed to create tray icon", err);
  }
}

function updateTrayMenu() {
  if (!tray || !tracker) return;
  const status = tracker.getStatus();
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show Dashboard",
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      }
    },
    {
      label: status.isTracking ? "Pause Tracking (Active 🟢)" : "Start Tracking (Paused 🔴)",
      click: () => {
        if (status.isTracking) {
          tracker?.stop();
        } else {
          tracker?.start();
        }
        updateTrayMenu();
      }
    },
    { type: "separator" },
    {
      label: "Quit FocusTrack",
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
}

app.whenReady()
  .then(async () => {
    if (!singleInstanceLock) {
      return;
    }

    writeStartupLog(`App ready. userData=${app.getPath("userData")}`);
    const database = await FocusTrackDatabase.create(app.getPath("userData"));
    writeStartupLog("Database initialized");
    tracker = new ActivityTracker(database, writeStartupLog);
    tracker.start();
    writeStartupLog("Activity tracker started");
    startServer();
    writeStartupLog("Web activity server started");

    createTray();
    updateTrayMenu();

    // Configure autostart by default on first launch if not configured yet
    if (app.isPackaged) {
      const loginSettings = app.getLoginItemSettings() as any;
      const autostartConfigured = database.getSetting("autostart_configured", "false");
      if (autostartConfigured !== "true" || loginSettings.path !== app.getPath("exe")) {
        app.setLoginItemSettings({
          openAtLogin: true,
          path: app.getPath("exe")
        });
        database.saveSetting("autostart_configured", "true");
        writeStartupLog(`First-run auto-start enabled/updated by default for: ${app.getPath("exe")}`);
      }
    } else {
      writeStartupLog("Auto-start configuration skipped in development mode");
      // Clean up any stray/broken development auto-start settings pointing to electron.exe
      try {
        const loginSettings = app.getLoginItemSettings() as any;
        if (loginSettings.openAtLogin && loginSettings.path && loginSettings.path.toLowerCase().includes("electron.exe")) {
          app.setLoginItemSettings({
            openAtLogin: false,
            path: loginSettings.path
          });
          writeStartupLog("Cleaned up broken development auto-start registry entry");
        }
      } catch (err) {
        writeStartupLog("Failed to clean up development auto-start settings", err);
      }
    }

    powerMonitor.on("shutdown", () => {
      writeStartupLog("System shutting down. Saving tracking state...");
      tracker?.stop();
      stopServer();
    });

    powerMonitor.on("suspend", () => {
      writeStartupLog("System suspending. Flushing tracker state...");
      tracker?.stop();
    });

    powerMonitor.on("lock-screen", () => {
      writeStartupLog("Screen locked. Flushing tracker state...");
      tracker?.stop();
    });

    powerMonitor.on("resume", () => {
      writeStartupLog("System resumed. Restarting tracker...");
      tracker?.start();
    });

    powerMonitor.on("unlock-screen", () => {
      writeStartupLog("Screen unlocked. Restarting tracker...");
      tracker?.start();
    });

    ipcMain.handle("app:get-version", () => app.getVersion());
    ipcMain.handle("dashboard:get-snapshot", (event, range) => {
      const selectedRange = range === "weekly" || range === "all" ? range : "today";
      return tracker?.getDashboardSnapshot(selectedRange) ?? database.getDashboardSnapshot(undefined, selectedRange);
    });
    ipcMain.handle("tracking:get-status", () => tracker?.getStatus() ?? null);
    ipcMain.handle("tracking:toggle", (event, start: boolean) => {
      if (start) {
        tracker?.start();
      } else {
        tracker?.stop();
      }
      updateTrayMenu();
      return tracker?.getStatus() ?? null;
    });
    ipcMain.handle("settings:get-all", () => database.getAllSettings());
    ipcMain.handle("settings:save", (event, key: string, value: string) => {
      database.saveSetting(key, value);
      tracker?.restart();
      return true;
    });
    ipcMain.handle("settings:update-category", (event, appName: string, category: string) => {
      database.saveSetting(`app_category:${appName.toLowerCase().trim()}`, category);
      return true;
    });
    ipcMain.handle("database:clear", () => {
      tracker?.stop();
      database.clearDatabase();
      tracker?.start();
      return true;
    });
    ipcMain.handle("database:get-history-dates", () => {
      return database.getHistoryDates();
    });
    ipcMain.handle("app:get-login-item-settings", () => {
      if (!app.isPackaged) {
        return false;
      }
      return app.getLoginItemSettings().openAtLogin;
    });
    ipcMain.handle("app:set-login-item-settings", (event, openAtLogin: boolean) => {
      if (app.isPackaged) {
        app.setLoginItemSettings({
          openAtLogin,
          path: app.getPath("exe")
        });
      } else {
        writeStartupLog(`Skipped changing autostart to ${openAtLogin} in development mode`);
      }
      return openAtLogin;
    });

    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });

    app.on("second-instance", () => {
      if (!mainWindow) {
        createWindow();
        return;
      }

      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }

      mainWindow.focus();
    });
  })
  .catch((error) => {
    writeStartupLog("App startup failed", error);
    app.quit();
  });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  tracker?.stop();
  stopServer();
});
