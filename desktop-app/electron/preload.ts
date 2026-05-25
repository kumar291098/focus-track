import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("focusTrack", {
  getAppVersion: () => ipcRenderer.invoke("app:get-version"),
  getDashboardSnapshot: (range?: string) => ipcRenderer.invoke("dashboard:get-snapshot", range),
  getTrackingStatus: () => ipcRenderer.invoke("tracking:get-status"),
  toggleTracking: (start: boolean) => ipcRenderer.invoke("tracking:toggle", start),
  getSettings: () => ipcRenderer.invoke("settings:get-all"),
  saveSetting: (key: string, value: string) => ipcRenderer.invoke("settings:save", key, value),
  updateAppCategory: (appName: string, category: string) => ipcRenderer.invoke("settings:update-category", appName, category),
  clearDatabase: () => ipcRenderer.invoke("database:clear"),
  getLoginItemSettings: () => ipcRenderer.invoke("app:get-login-item-settings"),
  setLoginItemSettings: (openAtLogin: boolean) => ipcRenderer.invoke("app:set-login-item-settings", openAtLogin),
  getHistoryDates: () => ipcRenderer.invoke("database:get-history-dates")
});
