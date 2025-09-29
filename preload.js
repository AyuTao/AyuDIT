const { contextBridge, ipcRenderer } = require("electron/renderer");

contextBridge.exposeInMainWorld("resolveAPI", {
  getMediaStats: () => ipcRenderer.invoke("resolve:getMediaStats"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  getTimelineList: () => ipcRenderer.invoke("resolve:getTimelineList"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  loadLanguage: (lang) => ipcRenderer.invoke("language:load", lang),
  exportDitReport: () => ipcRenderer.invoke("export-dit-report"),
  onLog: (callback) =>
    ipcRenderer.on("log:error", (_event, ...args) => callback(...args)),
  onLogMessage: (callback) =>
    ipcRenderer.on("log:message", (_event, message) => callback(message)),
  quitApp: () => ipcRenderer.send("app:quit"),
});
