import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("focusTrack", {
  getAppVersion: () => ipcRenderer.invoke("app:get-version"),
  getDashboardSnapshot: () => ipcRenderer.invoke("dashboard:get-snapshot"),
  getTrackingStatus: () => ipcRenderer.invoke("tracking:get-status")
});
