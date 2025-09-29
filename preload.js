const { contextBridge, ipcRenderer } = require("electron/renderer");

contextBridge.exposeInMainWorld("resolveAPI", {
  // Main -> Renderer
  onLogMessage: (callback) =>
    ipcRenderer.on("log:message", (_event, message) => callback(message)),
  onGenerationProgress: (callback) =>
    ipcRenderer.on("generation-progress", (_event, data) => callback(data)),
  onGenerationComplete: (callback) =>
    ipcRenderer.on("generation-complete", (_event, data) => callback(data)),

  // Renderer -> Main
  getMediaStats: () => ipcRenderer.invoke("resolve:getMediaStats"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  getTimelineList: () => ipcRenderer.invoke("resolve:getTimelineList"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  loadLanguage: (lang) => ipcRenderer.invoke("language:load", lang),
  startPdfReport: (payload) => ipcRenderer.send("export-pdf-report", payload),
  startCsvReport: (payload) => ipcRenderer.send("export-csv-report", payload),
  openPath: (path) => ipcRenderer.send("shell:openPath", path),
  showItemInFolder: (path) => ipcRenderer.send("shell:showItemInFolder", path),
  openImageDialog: () => ipcRenderer.invoke("dialog:open-image"),
  quitApp: () => ipcRenderer.send("app:quit"),
});
