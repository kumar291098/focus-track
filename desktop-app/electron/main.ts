import { app, BrowserWindow, ipcMain } from "electron";
import fs from "node:fs";
import path from "node:path";
import { FocusTrackDatabase } from "./database.js";
import { ActivityTracker } from "./tracker.js";

const isDev = !!process.env.VITE_DEV_SERVER_URL;
let tracker: ActivityTracker | null = null;
let mainWindow: BrowserWindow | null = null;

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

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
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

    ipcMain.handle("app:get-version", () => app.getVersion());
    ipcMain.handle("dashboard:get-snapshot", () => tracker?.getDashboardSnapshot() ?? database.getDashboardSnapshot());
    ipcMain.handle("tracking:get-status", () => tracker?.getStatus() ?? null);

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
});
