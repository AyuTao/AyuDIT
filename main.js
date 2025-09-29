const {
  app,
  Menu,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
} = require("electron");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { PDFDocument, rgb, degrees } = require("pdf-lib");
const fontkit = require("fontkit");
const { PNG } = require("pngjs");
const WorkflowIntegration = require("./WorkflowIntegration.node");

const PLUGIN_ID = "com.AyuDITsh.resolve.AyuDIT";
const DEFAULT_LOGO_PATH = path.join(__dirname, "img", "AyuDITtlogo.png");

// --- Custom Application Menu ---
const isMac = process.platform === "darwin";
const menuTemplate = [
  // { appMenu }
  ...(isMac
    ? [
        {
          label: "AyuDIT",
          submenu: [
            { role: "about" },
            { type: "separator" },
            { role: "services" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideothers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" },
          ],
        },
      ]
    : []),
  // { fileMenu }
  {
    label: "File",
    submenu: [isMac ? { role: "close" } : { role: "quit" }],
  },
  // { editMenu }
  {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
    ],
  },
  // { viewMenu }
  {
    label: "View",
    submenu: [
      { role: "reload" },
      { role: "forceReload" },
      { role: "toggleDevTools" },
    ],
  },
  // { windowMenu }
  {
    label: "Window",
    submenu: [
      { role: "minimize" },
      { role: "zoom" },
      ...(isMac
        ? [
            { type: "separator" },
            { role: "front" },
            { type: "separator" },
            { role: "window" },
          ]
        : [{ role: "close" }]),
    ],
  },
];
const menu = Menu.buildFromTemplate(menuTemplate);
Menu.setApplicationMenu(menu);

// --- Settings Management ---
const settingsPath = path.join(app.getPath("userData"), "settings.json");

function getSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const settingsData = fs.readFileSync(settingsPath);
      return JSON.parse(settingsData);
    } else {
      const defaultSettings = {
        language: "en",
        thumbnailSource: "middle",
        reportLogoPath: DEFAULT_LOGO_PATH,
      };
      fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings));
      return defaultSettings;
    }
  } catch (error) {
    console.error("Failed to get settings:", error);
    return {
      language: "en",
      thumbnailSource: "middle",
      reportLogoPath: DEFAULT_LOGO_PATH,
    }; // Fallback to default
  }
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings));
  } catch (error) {
    console.error("Failed to save settings:", error);
  }
}

// --- Language (i18n) Management ---
function loadLanguage(lang) {
  const langPath = path.join(__dirname, "locales", `${lang}.json`);
  try {
    if (fs.existsSync(langPath)) {
      const langData = fs.readFileSync(langPath);
      return JSON.parse(langData);
    } else {
      console.error(`Language file not found: ${langPath}`);
      const defaultLangData = fs.readFileSync(
        path.join(__dirname, "locales", "en.json"),
      );
      return JSON.parse(defaultLangData);
    }
  } catch (error) {
    console.error(`Failed to load language file for ${lang}:`, error);
    return {};
  }
}

// Cached objects
let resolveObj = null;
let projectManagerObj = null;
let mainWindow = null;
let progressWindow = null;

// Function to log into renderer window console.
function debugLog(message) {
  if (mainWindow) {
    mainWindow.webContents.send("log:message", message.toString());
  }
}

// Initialize Resolve interface and returns Resolve object.
async function initResolveInterface() {
  const isSuccess = await WorkflowIntegration.Initialize(PLUGIN_ID);
  if (!isSuccess) {
    debugLog("Error: Failed to initialize Resolve interface!");
    return null;
  }
  const resolve = await WorkflowIntegration.GetResolve();
  if (!resolve) {
    debugLog("Error: Failed to get Resolve object!");
    return null;
  }
  return resolve;
}

// Gets Resolve object.
async function getResolve() {
  if (!resolveObj) {
    resolveObj = await initResolveInterface();
  }
  return resolveObj;
}

// Gets project manager object.
async function getProjectManager() {
  if (!projectManagerObj) {
    const resolve = await getResolve();
    if (resolve) {
      projectManagerObj = await resolve.GetProjectManager();
      if (!projectManagerObj) {
        debugLog("Error: Failed to get ProjectManager object!");
      }
    }
  }
  return projectManagerObj;
}

// Gets current project object.
async function getCurrentProject() {
  const projManager = await getProjectManager();
  if (projManager) {
    const currentProject = await projManager.GetCurrentProject();
    if (!currentProject) {
      debugLog("Error: Failed to get current project object!");
    }
    return currentProject;
  }
  return null;
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

// Gets media stats from the current project.
async function getMediaStats() {
  const project = await getCurrentProject();
  if (!project) {
    return null;
  }

  const mediaPool = await project.GetMediaPool();
  if (!mediaPool) {
    return null;
  }

  const rootFolder = await mediaPool.GetRootFolder();

  let stats = {
    projectName: await project.GetName(),
    video: 0,
    audio: 0,
    timeline: 0,
    other: 0,
    totalSize: 0,
  };

  const timelineCount = await project.GetTimelineCount();
  stats.timeline = timelineCount || 0;

  async function scanFolder(folder) {
    const clips = await folder.GetClipList();
    if (clips) {
      for (const clip of clips) {
        try {
          const props = await clip.GetClipProperty();
          const clipType = props["Type"];
          let categorized = false;

          if (
            clipType === "Video" ||
            clipType === "Video + Audio" ||
            (props["Video Codec"] &&
              props["Video Codec"] !== "N/A" &&
              props["Video Codec"] !== "")
          ) {
            stats.video++;
            categorized = true;
          } else if (
            clipType === "Audio" ||
            (props["Audio Channels"] &&
              parseInt(props["Audio Channels"]) > 0 &&
              (!props["Video Codec"] ||
                props["Video Codec"] === "N/A" ||
                props["Video Codec"] === ""))
          ) {
            stats.audio++;
            categorized = true;
          } else if (clipType === "Timeline") {
            categorized = true;
          }

          const filePath = props["File Path"];
          if (filePath) {
            try {
              const fileStats = fs.statSync(filePath);
              stats.totalSize += fileStats.size;
            } catch (e) {
              debugLog(`Could not get stats for file: ${filePath}`);
            }
          }
          if (!categorized) {
            stats.other++;
          }
        } catch (e) {
          debugLog("Error getting clip properties");
        }
      }
    }
    const subFolders = await folder.GetSubFolderList();
    if (subFolders) {
      for (const subFolder of subFolders) {
        await scanFolder(subFolder);
      }
    }
  }

  await scanFolder(rootFolder);
  return stats;
}

async function getTimelineList() {
  const project = await getCurrentProject();
  if (!project) return [];
  const timelineCount = await project.GetTimelineCount();
  const timelines = [];
  for (let i = 1; i <= timelineCount; i++) {
    const timeline = await project.GetTimelineByIndex(i);
    const frameRate = parseFloat(
      await timeline.GetSetting("timelineFrameRate"),
    );
    const durationFrames =
      (await timeline.GetEndFrame()) - (await timeline.GetStartFrame());

    let clipCount = 0;
    let totalSize = 0;
    const countedMedia = new Set();
    const videoTracks = await timeline.GetTrackCount("video");
    for (let j = 1; j <= videoTracks; j++) {
      const items = await timeline.GetItemListInTrack("video", j);
      if (!items) continue;

      for (const item of items) {
        try {
          const mediaPoolItem = await item.GetMediaPoolItem();
          if (mediaPoolItem) {
            clipCount++; // Only count items that are actual media
            const mediaId = await mediaPoolItem.GetMediaId();
            if (!countedMedia.has(mediaId)) {
              const props = await mediaPoolItem.GetClipProperty();
              if (props && props["File Path"]) {
                try {
                  const fileStats = fs.statSync(props["File Path"]);
                  totalSize += fileStats.size;
                  countedMedia.add(mediaId);
                } catch (e) {
                  /* ignore stat sync errors */
                }
              }
            }
          }
        } catch (e) {
          debugLog(
            `Skipping item in timeline scan (not a standard media clip): ${await item.GetName()}`,
          );
        }
      }
    }

    timelines.push({
      name: await timeline.GetName(),
      resolution: `${await timeline.GetSetting("timelineResolutionWidth")}x${await timeline.GetSetting("timelineResolutionHeight")}`,
      frameRate: frameRate,
      duration: framesToTimecode(durationFrames, frameRate),
      clipCount: clipCount,
      totalSize: formatBytes(totalSize),
    });
  }
  return timelines;
}

function framesToTimecode(frames, frameRate) {
  if (frameRate == 0) return "00:00:00:00";
  const fps_int = Math.round(frameRate);
  const h = Math.floor(frames / (3600 * fps_int));
  const m = Math.floor((frames % (3600 * fps_int)) / (60 * fps_int));
  const s = Math.floor(
    ((frames % (3600 * fps_int)) % (60 * fps_int)) / fps_int,
  );
  const f = frames % fps_int;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}:${f.toString().padStart(2, "0")}`;
}

async function generatePdfReport(
  filePath,
  { timelines: timelineNames, thumbnailSource, reportLogoPath },
  progressCb,
) {
  const resolve = await getResolve();
  if (!resolve) return;

  const supportedPages = ["edit", "color", "cut", "fairlight", "deliver"];
  const currentPage = await resolve.GetCurrentPage();
  const mustSwitchPage = !supportedPages.includes(currentPage);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const fontBytes = fs.readFileSync(
    path.join(
      __dirname,
      "fonts",
      "Alibaba_PuHuiTi_2.0_55_Regular_55_Regular.ttf",
    ),
  );
  const customFont = await pdfDoc.embedFont(fontBytes);
  const margin = 40;

  // --- Logo Handling ---
  let logoImage, logoDims;
  const logoPath =
    reportLogoPath && fs.existsSync(reportLogoPath)
      ? reportLogoPath
      : DEFAULT_LOGO_PATH;
  try {
    const logoBytes = fs.readFileSync(logoPath);
    if (logoPath.toLowerCase().endsWith(".png")) {
      logoImage = await pdfDoc.embedPng(logoBytes);
    } else {
      logoImage = await pdfDoc.embedJpg(logoBytes);
    }
    logoDims = logoImage.scaleToFit(80, 40);
  } catch (e) {
    debugLog(`Could not load or embed logo: ${e.toString()}`);
  }
  // --- End Logo Handling ---

  try {
    if (mustSwitchPage) {
      await resolve.OpenPage("edit");
    }

    const project = await getCurrentProject();
    if (!project) return;
    const projectName = await project.GetName();

    const timelineCount = await project.GetTimelineCount();
    const timelineMap = new Map();
    for (let i = 1; i <= timelineCount; i++) {
      const tl = await project.GetTimelineByIndex(i);
      timelineMap.set(await tl.GetName(), tl);
    }

    let totalClipsToProcess = 0;
    for (const timelineName of timelineNames) {
      const timeline = timelineMap.get(timelineName);
      if (!timeline) continue;
      const videoTracks = await timeline.GetTrackCount("video");
      for (let i = 1; i <= videoTracks; i++) {
        const items = (await timeline.GetItemListInTrack("video", i)) || [];
        totalClipsToProcess += items.length;
      }
    }
    let clipsProcessed = 0;

    for (const timelineName of timelineNames) {
      let page = pdfDoc.addPage();
      const { width, height } = page.getSize();
      let y = height - 40;

      // Add logo to top right
      if (logoImage) {
        page.drawImage(logoImage, {
          x: width - margin - logoDims.width,
          y: height - margin - logoDims.height,
          width: logoDims.width,
          height: logoDims.height,
        });
      }

      const timeline = timelineMap.get(timelineName);
      if (!timeline) continue;

      await project.SetCurrentTimeline(timeline);
      const originalTimecode = await timeline.GetCurrentTimecode();
      const timelineFrameRate = parseFloat(
        await timeline.GetSetting("timelineFrameRate"),
      );

      const videoTracks = await timeline.GetTrackCount("video");
      let clips = [];
      for (let i = 1; i <= videoTracks; i++) {
        const items = await timeline.GetItemListInTrack("video", i);
        if (items) clips.push(...items);
      }

      let totalSize = 0;
      let mediaClipCount = 0;
      for (const clip of clips) {
        try {
          const mediaPoolItem = await clip.GetMediaPoolItem();
          if (mediaPoolItem) {
            mediaClipCount++;
            const props = await mediaPoolItem.GetClipProperty();
            if (props && props["File Path"]) {
              try {
                const fileStats = fs.statSync(props["File Path"]);
                totalSize += fileStats.size;
              } catch (e) {
                /* ignore */
              }
            }
          }
        } catch (e) {
          /* ignore */
        }
      }

      page.drawText(`${projectName} - DIT Report`, {
        x: margin,
        y,
        size: 24,
        font: customFont,
      });
      y -= 20;
      page.drawText(`Timeline: ${timelineName}`, {
        x: margin,
        y,
        size: 16,
        font: customFont,
      });
      y -= 15;
      page.drawText(
        `Stats: ${mediaClipCount} clips | Total Size: ${formatBytes(totalSize)}`,
        { x: margin, y, size: 10, font: customFont },
      );
      y -= 25;

      for (const clip of clips) {
        clipsProcessed++;
        progressCb({ progress: (clipsProcessed / totalClipsToProcess) * 100 });

        let mediaPoolItem;
        try {
          mediaPoolItem = await clip.GetMediaPoolItem();
        } catch (e) {
          continue;
        }
        if (!mediaPoolItem) continue;

        const clipBlockHeight = 140;
        if (y < margin + clipBlockHeight) {
          page = pdfDoc.addPage();
          y = height - margin;
        }

        const clipName = await clip.GetName();
        const startFrame = await clip.GetStart();
        const endFrame = await clip.GetEnd();
        const duration = await clip.GetDuration();

        let frameToExport;
        switch (thumbnailSource) {
          case "first":
            frameToExport = startFrame;
            break;
          case "last":
            frameToExport = endFrame;
            break;
          case "middle":
          default:
            frameToExport = startFrame + Math.floor(duration / 2);
            break;
        }

        await timeline.SetCurrentTimecode(
          framesToTimecode(frameToExport, timelineFrameRate),
        );
        await new Promise((resolve) => setTimeout(resolve, 200));

        const tempDir = os.tmpdir();
        const tempFilePath = path.join(
          tempDir,
          `resolve_thumb_${Date.now()}.jpg`,
        );
        const success = await project.ExportCurrentFrameAsStill(tempFilePath);

        const blockStartY = y;
        const thumbX = margin;
        const thumbWidth = 120;
        const thumbHeight = clipBlockHeight - 20;

        if (success) {
          try {
            const jpgBytes = fs.readFileSync(tempFilePath);
            const jpgImage = await pdfDoc.embedJpg(jpgBytes);
            const jpgDims = jpgImage.scaleToFit(thumbWidth, thumbHeight);
            page.drawImage(jpgImage, {
              x: thumbX,
              y: blockStartY - jpgDims.height,
              width: jpgDims.width,
              height: jpgDims.height,
            });
            fs.unlinkSync(tempFilePath);
          } catch (e) {
            debugLog(`Could not embed image for ${clipName}: ${e.toString()}`);
          }
        } else {
          page.drawRectangle({
            x: thumbX,
            y: blockStartY - thumbHeight,
            width: thumbWidth,
            height: thumbHeight,
            color: rgb(0.9, 0.9, 0.9),
          });
          page.drawText("No Thumbnail", {
            x: thumbX + 25,
            y: blockStartY - thumbHeight / 2,
            font: customFont,
            size: 8,
            color: rgb(0.5, 0.5, 0.5),
          });
        }

        let metaX = thumbX + thumbWidth + 15;
        let metaY = blockStartY - 5;
        const lineGap = 11;
        const props = await mediaPoolItem.GetClipProperty();
        const metadata = await mediaPoolItem.GetMetadata();

        page.drawText(clipName, {
          x: metaX,
          y: metaY,
          font: customFont,
          size: 11,
        });
        metaY -= lineGap + 4;

        page.drawText(
          `Source TC: ${props["Start TC"] || "N/A"} - ${props["End TC"] || "N/A"} | Duration: ${props["Duration"] || "N/A"}`,
          { x: metaX, y: metaY, font: customFont, size: 9 },
        );
        metaY -= lineGap;

        let fileSize = "N/A";
        if (props && props["File Path"]) {
          try {
            const fileStats = fs.statSync(props["File Path"]);
            fileSize = formatBytes(fileStats.size);
          } catch (e) {
            /* ignore */
          }
        }
        page.drawText(
          `FPS: ${props["FPS"] || "N/A"} | Size: ${fileSize} | Res: ${props["Resolution"] || "N/A"}`,
          { x: metaX, y: metaY, font: customFont, size: 9 },
        );
        metaY -= lineGap;

        page.drawText(
          `Scene: ${metadata["Scene"] || "N/A"} | Shot: ${metadata["Shot"] || "N/A"} | Take: ${metadata["Take"] || "N/A"}`,
          { x: metaX, y: metaY, font: customFont, size: 9 },
        );
        metaY -= lineGap;

        page.drawText(
          `Angle: ${metadata["Angle"] || "N/A"} | Move: ${metadata["Move"] || "N/A"} | D/N: ${metadata["Day/Night"] || "N/A"}`,
          { x: metaX, y: metaY, font: customFont, size: 9 },
        );
        metaY -= lineGap;

        let dateCreated =
          props && props["Date Created"]
            ? props["Date Created"].split(" ")[0]
            : "N/A";
        page.drawText(
          `Good Take: ${metadata["Good Take"] || "N/A"} | Created: ${dateCreated}`,
          { x: metaX, y: metaY, font: customFont, size: 9 },
        );
        metaY -= lineGap;

        if (props) {
          page.drawText(`File Name: ${props["File Name"] || "N/A"}`, {
            x: metaX,
            y: metaY,
            font: customFont,
            size: 7,
          });
          metaY -= lineGap;
          page.drawText(`File Path: ${props["File Path"] || "N/A"}`, {
            x: metaX,
            y: metaY,
            font: customFont,
            size: 7,
          });
          metaY -= lineGap;
          page.drawText(`Proxy Path: ${props["Proxy Media Path"] || "N/A"}`, {
            x: metaX,
            y: metaY,
            font: customFont,
            size: 7,
          });
        }

        y -= clipBlockHeight;
      }
      await timeline.SetCurrentTimecode(originalTimecode);
    }

    const pages = pdfDoc.getPages();
    for (const page of pages) {
      page.drawText(`Generated by AyuDIT | https://github.com/AyuTao/AyuDIT`, {
        x: margin,
        y: margin - 20,
        size: 8,
        font: customFont,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(filePath, pdfBytes);
    if (progressWindow) {
      progressWindow.webContents.send("generation-complete", { filePath });
    }
  } catch (error) {
    debugLog(`Error generating PDF report: ${error.toString()}`);
    if (progressWindow) {
      progressWindow.webContents.send("generation-complete", {
        error: error.toString(),
      });
    }
  } finally {
    if (mustSwitchPage) {
      await resolve.OpenPage(currentPage);
    }
  }
}

async function generateCsvReport(
  filePath,
  { timelines: timelineNames },
  progressCb,
) {
  const resolve = await getResolve();
  if (!resolve) return;

  const project = await getCurrentProject();
  if (!project) return;

  const allClipsData = [];
  const allHeaders = new Set(["Timeline Name", "Clip Name"]);

  const timelineCount = await project.GetTimelineCount();
  const timelineMap = new Map();
  for (let i = 1; i <= timelineCount; i++) {
    const tl = await project.GetTimelineByIndex(i);
    timelineMap.set(await tl.GetName(), tl);
  }

  let totalClipsToProcess = 0;
  for (const timelineName of timelineNames) {
    const timeline = timelineMap.get(timelineName);
    if (!timeline) continue;
    const videoTracks = await timeline.GetTrackCount("video");
    for (let i = 1; i <= videoTracks; i++) {
      const items = (await timeline.GetItemListInTrack("video", i)) || [];
      totalClipsToProcess += items.length;
    }
  }
  let clipsProcessed = 0;

  for (const timelineName of timelineNames) {
    const timeline = timelineMap.get(timelineName);
    if (!timeline) continue;

    const videoTracks = await timeline.GetTrackCount("video");
    for (let i = 1; i <= videoTracks; i++) {
      const items = await timeline.GetItemListInTrack("video", i);
      if (!items) continue;

      for (const item of items) {
        clipsProcessed++;
        progressCb({ progress: (clipsProcessed / totalClipsToProcess) * 100 });

        let mediaPoolItem;
        try {
          mediaPoolItem = await item.GetMediaPoolItem();
        } catch (e) {
          continue;
        }
        if (!mediaPoolItem) continue;

        const clipName = await item.GetName();
        const props = await mediaPoolItem.GetClipProperty();
        const metadata = await mediaPoolItem.GetMetadata();
        const allMeta = {
          ...props,
          ...metadata,
          "Timeline Name": timelineName,
          "Clip Name": clipName,
        };

        Object.keys(allMeta).forEach((key) => allHeaders.add(key));
        allClipsData.push(allMeta);
      }
    }
  }

  const sortedHeaders = [...allHeaders].sort();

  const escapeCsvCell = (cell) => {
    if (cell === null || cell === undefined) return "";
    const str = String(cell);
    if (str.includes('"') || str.includes(",") || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = sortedHeaders.map(escapeCsvCell).join(",") + "\n";
  const dataRows = allClipsData
    .map((row) =>
      sortedHeaders.map((header) => escapeCsvCell(row[header])).join(","),
    )
    .join("\n");

  try {
    fs.writeFileSync(filePath, headerRow + dataRows);
    if (progressWindow) {
      progressWindow.webContents.send("generation-complete", { filePath });
    }
  } catch (error) {
    debugLog(`Error writing CSV file: ${error.toString()}`);
    if (progressWindow) {
      progressWindow.webContents.send("generation-complete", {
        error: error.toString(),
      });
    }
  }
}

// Register resolve event handler functions.
function registerResolveEventHandlers() {
  ipcMain.handle("resolve:getMediaStats", getMediaStats);
  ipcMain.handle("resolve:getTimelineList", getTimelineList);
  ipcMain.handle("settings:get", (event) => getSettings());
  ipcMain.handle("settings:save", (event, settings) => saveSettings(settings));
  ipcMain.handle("language:load", (event, lang) => loadLanguage(lang));
  ipcMain.on("app:quit", () => app.quit());

  // Handlers from Progress Window
  ipcMain.on("progress:close", () => {
    if (progressWindow) progressWindow.close();
  });
  ipcMain.on("progress:open-file", (event, path) => {
    shell.openPath(path);
  });
  ipcMain.on("progress:show-item", (event, path) => {
    shell.showItemInFolder(path);
  });

  ipcMain.handle("dialog:open-image", async () => {
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg"] }],
    });
    return filePaths && filePaths.length > 0 ? filePaths[0] : null;
  });

  const createProgressWindow = () => {
    progressWindow = new BrowserWindow({
      width: 400,
      height: 120,
      parent: mainWindow,
      modal: true,
      frame: false,
      resizable: false,
      show: false, // Hide initially to prevent flicker
      webPreferences: {
        preload: path.join(__dirname, "preload_progress.js"),
      },
    });
    progressWindow.once("ready-to-show", () => {
      progressWindow.show();
    });
    progressWindow.loadFile("progress.html");
    progressWindow.on("closed", () => (progressWindow = null));
  };

  ipcMain.on("export-pdf-report", async (event, payload) => {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: "Export PDF Report",
      defaultPath: `DIT_Report_${Date.now()}.pdf`,
      filters: [{ name: "PDF Files", extensions: ["pdf"] }],
    });

    if (filePath) {
      createProgressWindow();
      let { timelines, thumbnailSource, reportLogoPath } = payload;
      if (!timelines || timelines.length === 0) {
        const project = await getCurrentProject();
        const timeline = await project.GetCurrentTimeline();
        if (timeline) timelines = [await timeline.GetName()];
      }
      if (timelines && timelines.length > 0) {
        generatePdfReport(
          filePath,
          { timelines, thumbnailSource, reportLogoPath },
          (progress) => {
            if (progressWindow) {
              progressWindow.webContents.send("generation-progress", progress);
            }
          },
        );
      } else {
        if (progressWindow) progressWindow.close();
      }
    }
  });

  ipcMain.on("export-csv-report", async (event, payload) => {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: "Export CSV Report",
      defaultPath: `DIT_Report_${Date.now()}.csv`,
      filters: [{ name: "CSV Files", extensions: ["csv"] }],
    });

    if (filePath) {
      createProgressWindow();
      let { timelines } = payload;
      if (!timelines || timelines.length === 0) {
        const project = await getCurrentProject();
        const timeline = await project.GetCurrentTimeline();
        if (timeline) timelines = [await timeline.GetName()];
      }
      if (timelines && timelines.length > 0) {
        generateCsvReport(filePath, { timelines }, (progress) => {
          if (progressWindow) {
            progressWindow.webContents.send("generation-progress", progress);
          }
        });
      } else {
        if (progressWindow) progressWindow.close();
      }
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    useContentSize: true,
    icon: path.join(__dirname, "img/logo.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.on("close", function (e) {
    app.quit();
  });

  mainWindow.loadFile("index.html");
}

app.whenReady().then(() => {
  registerResolveEventHandlers();
  createWindow();
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", function () {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
