const { contextBridge, ipcRenderer } = require("electron/renderer");

contextBridge.exposeInMainWorld("resolveAPI", {
  getMediaStats: () => ipcRenderer.invoke("resolve:getMediaStats"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  getTimelineList: () => ipcRenderer.invoke("resolve:getTimelineList"),
  getAvailableMetadataFields: () =>
    ipcRenderer.invoke("resolve:getAvailableMetadataFields"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  loadLanguage: (lang) => ipcRenderer.invoke("language:load", lang),
  exportPdfReport: (timelines) =>
    ipcRenderer.invoke("export-pdf-report", timelines),
  exportCsvReport: (timelines) =>
    ipcRenderer.invoke("export-csv-report", timelines),
  onLog: (callback) =>
    ipcRenderer.on("log:error", (_event, ...args) => callback(...args)),
  onLogMessage: (callback) =>
    ipcRenderer.on("log:message", (_event, message) => callback(message)),
  quitApp: () => ipcRenderer.send("app:quit"),
});
