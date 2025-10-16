/*
 * 文件名: preload_progress.js
 * 描述: 进度窗口预加载脚本。暴露进度与结果的 IPC 接口。
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

const { contextBridge, ipcRenderer } = require("electron/renderer");

contextBridge.exposeInMainWorld("progressAPI", {
  // Main -> Renderer
  onProgress: (callback) =>
    ipcRenderer.on("generation-progress", (_event, data) => callback(data)),
  onComplete: (callback) =>
    ipcRenderer.on("generation-complete", (_event, data) => callback(data)),
  onLogMessage: (callback) =>
    ipcRenderer.on("log:message", (_event, message) => callback(message)),

  // Renderer -> Main
  getSettings: () => ipcRenderer.invoke("settings:get"),
  loadLanguage: (lang) => ipcRenderer.invoke("language:load", lang),
  close: () => ipcRenderer.send("progress:close"),
  openFile: (path) => ipcRenderer.send("progress:open-file", path),
  showItem: (path) => ipcRenderer.send("progress:show-item", path),
});
