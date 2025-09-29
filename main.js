// NOTE: Follow the security guide while implementing plugin app https://www.electronjs.org/docs/tutorial/security

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
const { PDFDocument, rgb } = require("pdf-lib");
const fontkit = require("fontkit");
const { PNG } = require("pngjs");
const WorkflowIntegration = require("./WorkflowIntegration.node");

const PLUGIN_ID = "com.ayudish.resolve.ayuditools";

// --- Custom Application Menu ---
const isMac = process.platform === "darwin";
const menuTemplate = [
  // { appMenu }
  ...(isMac
    ? [
        {
          label: "ayuDITools",
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
      const defaultSettings = { language: "en" };
      fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings));
      return defaultSettings;
    }
  } catch (error) {
    console.error("Failed to get settings:", error);
    return { language: "en" }; // Fallback to default
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
    image: 0,
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
          } else if (clipType === "Still") {
            stats.image++;
            categorized = true;
          } else if (clipType === "Timeline") {
            categorized = true;
          }

          const filePath = props["File Path"];
          if (filePath) {
            if (!categorized) {
              const imageExtensions = [
                ".jpg",
                ".jpeg",
                ".png",
                ".dng",
                ".tiff",
                ".tga",
                ".exr",
                ".bmp",
                ".gif",
              ];
              const ext = path.extname(filePath).toLowerCase();
              if (imageExtensions.includes(ext)) {
                stats.image++;
                categorized = true;
              }
            }
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
    timelines.push({ name: await timeline.GetName() });
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

async function generatePdfReport(filePath, timelineNames) {
  const resolve = await getResolve();
  if (!resolve) {
    debugLog("Could not get Resolve object for PDF generation.");
    return;
  }

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

  try {
    if (mustSwitchPage) {
      debugLog(`Temporarily switching to 'edit' page to generate report.`);
      await resolve.OpenPage("edit");
    }

    debugLog("Starting PDF report generation...");
    const project = await getCurrentProject();
    if (!project) {
      debugLog("No project open.");
      return;
    }

    const timelineCount = await project.GetTimelineCount();
    const timelineMap = new Map();
    for (let i = 1; i <= timelineCount; i++) {
      const tl = await project.GetTimelineByIndex(i);
      timelineMap.set(await tl.GetName(), tl);
    }

    for (const timelineName of timelineNames) {
      let page = pdfDoc.addPage();
      const { width, height } = page.getSize();
      let y = height - 40;
      const margin = 40;

      const timeline = timelineMap.get(timelineName);
      if (!timeline) {
        debugLog(`Timeline "${timelineName}" not found.`);
        continue;
      }

      await project.SetCurrentTimeline(timeline);
      const originalTimecode = await timeline.GetCurrentTimecode();
      const timelineFrameRate = parseFloat(
        await timeline.GetSetting("timelineFrameRate"),
      );

      const videoTracks = await timeline.GetTrackCount("video");
      let clips = [];
      for (let i = 1; i <= videoTracks; i++) {
        const items = await timeline.GetItemListInTrack("video", i);
        if (items) {
          clips.push(...items);
        }
      }

      debugLog(`Found ${clips.length} clips in timeline: ${timelineName}`);

      page.drawText("DIT Report", { x: margin, y, size: 24, font: customFont });
      y -= 20;
      page.drawText(`Timeline: ${timelineName}`, {
        x: margin,
        y,
        size: 16,
        font: customFont,
      });
      y -= 15;
      page.drawText(`Generated on: ${new Date().toLocaleString()}`, {
        x: margin,
        y,
        size: 10,
        font: customFont,
      });
      y -= 25;

      for (const [i, clip] of clips.entries()) {
        const clipBlockHeight = 100;
        if (y < margin + clipBlockHeight) {
          page = pdfDoc.addPage();
          y = height - margin;
        }

        const clipName = await clip.GetName();
        const middleFrame =
          (await clip.GetStart()) + (await clip.GetDuration()) / 2;

        await timeline.SetCurrentTimecode(
          framesToTimecode(middleFrame, timelineFrameRate),
        );
        await new Promise((resolve) => setTimeout(resolve, 200));

        const tempDir = os.tmpdir();
        const tempFilePath = path.join(tempDir, `resolve_thumb_${i}.jpg`);
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
          debugLog(`Failed to export still for clip: ${clipName}`);
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
        const lineGap = 12;
        const mediaPoolItem = await clip.GetMediaPoolItem();
        const props = mediaPoolItem
          ? await mediaPoolItem.GetClipProperty()
          : null;

        page.drawText(`${i + 1}. ${clipName}`, {
          x: metaX,
          y: metaY,
          font: customFont,
          size: 11,
        });
        metaY -= lineGap + 5;

        const sourceStartTC = props ? props["Start TC"] : "N/A";
        const sourceEndTC = props ? props["End TC"] : "N/A";
        const sourceDuration = props ? props["Duration"] : "N/A";
        const sourceFPS = props ? props["FPS"] : "N/A";
        let fileSize = "N/A";
        if (props && props["File Path"]) {
          try {
            const fileStats = fs.statSync(props["File Path"]);
            fileSize = formatBytes(fileStats.size);
          } catch (e) {
            /* ignore */
          }
        }

        page.drawText(`Source TC: ${sourceStartTC} - ${sourceEndTC}`, {
          x: metaX,
          y: metaY,
          font: customFont,
          size: 9,
        });
        metaY -= lineGap;
        page.drawText(`Duration: ${sourceDuration}`, {
          x: metaX,
          y: metaY,
          font: customFont,
          size: 9,
        });
        metaY -= lineGap;
        page.drawText(`Frame Rate: ${sourceFPS} fps`, {
          x: metaX,
          y: metaY,
          font: customFont,
          size: 9,
        });
        metaY -= lineGap;
        page.drawText(`File Size: ${fileSize}`, {
          x: metaX,
          y: metaY,
          font: customFont,
          size: 9,
        });
        metaY -= lineGap;
        if (props) {
          page.drawText(`Resolution: ${props["Resolution"] || "N/A"}`, {
            x: metaX,
            y: metaY,
            font: customFont,
            size: 9,
          });
          metaY -= lineGap + 2;
          page.drawText(`File Path: ${props["File Path"] || "N/A"}`, {
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

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(filePath, pdfBytes);
    debugLog(`PDF report saved to ${filePath}`);
    shell.openPath(filePath);
  } catch (error) {
    debugLog(`Error generating PDF report: ${error.toString()}`);
  } finally {
    if (mustSwitchPage) {
      debugLog(`Switching back to original page: ${currentPage}`);
      await resolve.OpenPage(currentPage);
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

  ipcMain.handle("export-dit-report", async (event, timelineNames) => {
    const { filePath } = await dialog.showSaveDialog({
      title: "Export DIT Report",
      defaultPath: `DIT_Report_${Date.now()}.pdf`,
      filters: [{ name: "PDF Files", extensions: ["pdf"] }],
    });

    if (filePath) {
      if (timelineNames && timelineNames.length > 0) {
        generatePdfReport(filePath, timelineNames);
      } else {
        // Fallback to current timeline if none are selected
        const project = await getCurrentProject();
        const timeline = await project.GetCurrentTimeline();
        if (timeline) {
          generatePdfReport(filePath, [await timeline.GetName()]);
        }
      }
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600, // Increased height for the new UI
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
  mainWindow.webContents.openDevTools();
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
