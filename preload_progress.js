const { contextBridge, ipcRenderer } = require("electron/renderer");

contextBridge.exposeInMainWorld("progressAPI", {
  // Main -> Renderer
  onProgress: (callback) =>
    ipcRenderer.on("generation-progress", (_event, data) => callback(data)),
  onComplete: (callback) =>
    ipcRenderer.on("generation-complete", (_event, data) => callback(data)),

  // Renderer -> Main
  getSettings: () => ipcRenderer.invoke("settings:get"),
  loadLanguage: (lang) => ipcRenderer.invoke("language:load", lang),
  close: () => ipcRenderer.send("progress:close"),
  openFile: (path) => ipcRenderer.send("progress:open-file", path),
  showItem: (path) => ipcRenderer.send("progress:show-item", path),
});
