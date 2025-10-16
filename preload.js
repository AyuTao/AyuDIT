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
  startThumbnailExport: (payload) => ipcRenderer.send("export-thumbnails", payload),
  // Render video export
  getRenderPresets: () => ipcRenderer.invoke("render:get-presets"),
  startRender: (payload) => ipcRenderer.send("render:start", payload),
  openPath: (path) => ipcRenderer.send("shell:openPath", path),
  showItemInFolder: (path) => ipcRenderer.send("shell:showItemInFolder", path),
  openExternal: (url) => ipcRenderer.send("shell:openExternal", url),
  openImageDialog: () => ipcRenderer.invoke("dialog:open-image"),
  getMoviesDir: () => ipcRenderer.invoke("path:get-movies"),
  openDirectoryDialog: () => ipcRenderer.invoke("dialog:open-directory"),
  getLogPath: () => ipcRenderer.invoke("log:get-path"),
  getLogDir: () => ipcRenderer.invoke("log:get-dir"),
  quitApp: () => ipcRenderer.send("app:quit"),
});
/*
 * 文件名: preload.js
 * 描述: 预加载脚本。通过 contextBridge 暴露 API 给渲染进程。
 *
 * GPLv3许可证声明:
 * Copyright (C) 2025 AyuTao
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 *
 * 作者: AyuTao
 * GitHub: https://github.com/AyuTao/AyuDIT
 */
