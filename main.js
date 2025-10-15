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
const DEFAULT_LOGO_PATH = path.join(__dirname, "img", "ayuditlogo.png");

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

function detectDefaultLanguage() {
  try {
    const locale = (app.getLocale && app.getLocale()) || process.env.LANG || "en";
    const lc = String(locale).toLowerCase();
    // zh, zh-cn, zh-tw, zh_hans, etc.
    if (lc.startsWith("zh")) return "zh";
    return "en";
  } catch (_) {
    return "en";
  }
}

function getSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const settingsData = fs.readFileSync(settingsPath);
      const s = JSON.parse(settingsData);
      // Backfill defaults for newly added settings
      let updated = false;
      if (typeof s.language === "undefined") { s.language = detectDefaultLanguage(); updated = true; }
      if (typeof s.thumbnailSource === "undefined") { s.thumbnailSource = "middle"; updated = true; }
      if (typeof s.reportLogoPath === "undefined") { s.reportLogoPath = DEFAULT_LOGO_PATH; updated = true; }
      if (typeof s.coverPageEnabled === "undefined") { s.coverPageEnabled = true; updated = true; }
      if (typeof s.coverDITName === "undefined") { s.coverDITName = ""; updated = true; }
      if (typeof s.coverCustomFieldsText === "undefined") { s.coverCustomFieldsText = ""; updated = true; }
      if (typeof s.captureMaxWaitMs === "undefined") { s.captureMaxWaitMs = 2000; updated = true; }
      if (typeof s.captureRetryCount === "undefined") { s.captureRetryCount = 3; updated = true; }
      if (typeof s.captureRetryIntervals === "undefined") { s.captureRetryIntervals = [250, 500, 800]; updated = true; }
      // 兼容旧版本把重试间隔存成字符串的情况
      if (typeof s.captureRetryIntervals === "string") {
        s.captureRetryIntervals = s.captureRetryIntervals.split(/[,\s]+/).map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n));
        updated = true;
      }
      if (updated) fs.writeFileSync(settingsPath, JSON.stringify(s));
      return s;
    } else {
      const defaultSettings = {
        language: detectDefaultLanguage(),
        thumbnailSource: "middle",
        reportLogoPath: DEFAULT_LOGO_PATH,
        coverPageEnabled: true,
        coverDITName: "",
        coverCustomFieldsText: "",
        captureMaxWaitMs: 2000,
        captureRetryCount: 3,
        captureRetryIntervals: [250, 500, 800],
      };
      fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings));
      return defaultSettings;
    }
  } catch (error) {
    console.error("Failed to get settings:", error);
    return {
      language: detectDefaultLanguage(),
      thumbnailSource: "middle",
      reportLogoPath: DEFAULT_LOGO_PATH,
      coverPageEnabled: true,
      coverDITName: "",
      coverCustomFieldsText: "",
      captureMaxWaitMs: 2000,
      captureRetryCount: 3,
      captureRetryIntervals: [250, 500, 800],
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

// --- Helpers ---
function safeFileComponent(str) {
  try {
    return String(str)
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
  } catch (_) {
    return "unknown";
  }
}

function isTruthy(val) {
  if (typeof val === "boolean") return val;
  if (val === null || val === undefined) return false;
  const s = String(val).trim().toLowerCase();
  return (
    s === "true" ||
    s === "yes" ||
    s === "1" ||
    s === "y" ||
    s === "是" ||
    s === "真"
  );
}

function isGoodTake(metadata) {
  if (!metadata) return false;
  const v =
    metadata["Good Take"] ?? metadata["GoodTake"] ?? metadata["Good take"];
  return isTruthy(v);
}

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

// 格式化日期为 YYYYMMDD_HHMMSS 格式
function formatDateForFilename() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
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

  const audioExts = new Set([
    ".wav",
    ".aif",
    ".aiff",
    ".mp3",
    ".m4a",
    ".flac",
    ".ogg",
    ".aac",
    ".wma",
    ".caf",
  ]);

  function looksLikeAudio(props, filePath) {
    try {
      const type = (props["Type"] || "").toString().toLowerCase();
      const videoCodec = (props["Video Codec"] || "").toString();
      const audioCodec = (props["Audio Codec"] || "").toString();
      const audioChannels = parseInt(props["Audio Channels"]) || 0;
      const ext = filePath ? path.extname(filePath).toLowerCase() : "";
      if (type.includes("timeline") || type.includes("时间线")) return false;
      if ((type.includes("audio") || type.includes("音频")) && !(type.includes("video") || type.includes("视频"))) return true;
      if (audioExts.has(ext)) return true;
      if (audioCodec && (!videoCodec || videoCodec === "N/A")) return true;
      if (audioChannels > 0 && (!videoCodec || videoCodec === "N/A")) return true;
    } catch (_) {}
    return false;
  }

  function looksLikeVideo(props, filePath) {
    try {
      const type = (props["Type"] || "").toString().toLowerCase();
      const videoCodec = (props["Video Codec"] || "").toString();
      if (type.includes("video") || type.includes("视频")) return true;
      if (videoCodec && videoCodec !== "N/A" && videoCodec !== "") return true;
    } catch (_) {}
    return false;
  }

  async function scanFolder(folder) {
    const clips = await folder.GetClipList();
    if (clips) {
      for (const clip of clips) {
        try {
          const props = await clip.GetClipProperty();
          const filePath = props["File Path"];
          const type = props["Type"] || "";
          let categorized = false;

          if (looksLikeVideo(props, filePath)) {
            stats.video++;
            categorized = true;
          } else if (looksLikeAudio(props, filePath)) {
            stats.audio++;
            categorized = true;
          } else if (String(type).toLowerCase().includes("timeline")) {
            categorized = true; // ignore timelines in media counts
          }
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

function timecodeToFrames(tc, frameRate) {
  try {
    if (!tc || frameRate == 0) return 0;
    const fps = Math.round(frameRate);
    const parts = String(tc).split(":");
    if (parts.length !== 4) return 0;
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    const s = parseInt(parts[2], 10) || 0;
    const f = parseInt(parts[3], 10) || 0;
    return (((h * 60 + m) * 60 + s) * fps) + f;
  } catch (_) {
    return 0;
  }
}

async function generatePdfReport(
  filePath,
  { timelines: timelineNames, thumbnailSource, reportLogoPath, cover },
  progressCb,
) {
  const resolve = await getResolve();
  if (!resolve) return;

  const targetPage = "edit";
  const currentPage = await resolve.GetCurrentPage();
  const mustSwitchPage = currentPage !== targetPage;

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
  // i18n for cover page labels
  let coverI18n = {};
  try {
    const s = getSettings();
    const lang = (s && s.language) || "en";
    coverI18n = loadLanguage(lang) || {};
  } catch (_) {}

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
      await resolve.OpenPage(targetPage);
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

    // 从设置读取抓帧参数
    const capSettings = getSettings() || {};
    const capMaxWait = capSettings.captureMaxWaitMs || 2000;
    const capRetryCount = capSettings.captureRetryCount || 3;
    const capIntervals = capSettings.captureRetryIntervals || [250, 500, 800];

    // 失败统计
    const failures = [];

    // Preload timeline markers for selected timelines (for marked export mode)
    const markersPerTimeline = new Map();
    for (const timelineName of (timelineNames || [])) {
      const tl = timelineMap.get(timelineName);
      if (!tl) continue;
      try {
        const markers = await tl.GetMarkers();
        const frames = Object.keys(markers || {})
          .map((k) => parseInt(k, 10))
          .filter((n) => Number.isFinite(n))
          .sort((a, b) => a - b);
        markersPerTimeline.set(timelineName, frames);
      } catch (e) {
        markersPerTimeline.set(timelineName, []);
      }
    }

    // markersPerTimeline prepared above (if needed for future use)

    let totalClipsToProcess = 0;
    for (const timelineName of timelineNames) {
      const timeline = timelineMap.get(timelineName);
      if (!timeline) continue;
      const videoTracks = await timeline.GetTrackCount("video");
      for (let i = 1; i <= videoTracks; i++) {
        const raw = await timeline.GetItemListInTrack("video", i);
        const items = Array.isArray(raw) ? raw : Object.values(raw || {});
        totalClipsToProcess += items.length;
      }
    }
    let clipsProcessed = 0;
    try { progressCb({ progress: 0 }); } catch (_) {}

    // ----- Cover Page (optional) -----
    if (cover && cover.enabled) {
      const page = pdfDoc.addPage();
      const { width, height } = page.getSize();
      const margin = 50;
      let y = height - margin;

      const drawCentered = (text, size) => {
        const t = String(text || "");
        const tw = customFont.widthOfTextAtSize(t, size);
        const x = Math.max(margin, (width - tw) / 2);
        page.drawText(t, { x, y, size, font: customFont });
        y -= size + 10;
      };

      // Logo centered on top
      if (logoImage) {
        const coverLogoDims = logoImage.scaleToFit(
          Math.min(width * 0.4, 240),
          Math.min(height * 0.2, 120),
        );
        page.drawImage(logoImage, {
          x: (width - coverLogoDims.width) / 2,
          y: height - margin - coverLogoDims.height,
          width: coverLogoDims.width,
          height: coverLogoDims.height,
        });
        y = height - margin - coverLogoDims.height - 50; // extra spacing to avoid overlap
      }

      // Title and subtitle centered
      drawCentered(projectName, 28);
      drawCentered(coverI18n.coverTitle || "DIT Report", 16);

      // Date centered
      const now = new Date();
      const dateStr = now.toLocaleString();
      drawCentered(`${coverI18n.dateLabel || "Date"}: ${dateStr}`, 12);

      // Project stats centered
      try {
        const stats = await getMediaStats();
        if (stats) {
          const statsLabel = coverI18n.statsLabel || "Stats";
          const footageLabel = coverI18n.footage || "Footage";
          const audioLabel = coverI18n.audio || "Audio";
          const timelinesLabel = coverI18n.timelines || "Timelines";
          const totalSizeLabel = coverI18n.totalSizeLabel || "Total Size";
          drawCentered(
            `${statsLabel}: ${stats.video} ${footageLabel} | ${stats.audio} ${audioLabel} | ${stats.timeline} ${timelinesLabel} | ${totalSizeLabel}: ${formatBytes(stats.totalSize)}`,
            11,
          );
        }
      } catch (_) {}

      // DIT name
      if (cover.ditName) {
        drawCentered(`${coverI18n.ditLabel || "DIT"}: ${cover.ditName}`, 12);
      }

      // Custom fields: one per line "key: value"
      if (cover.customFields && Array.isArray(cover.customFields)) {
        for (const { key, value } of cover.customFields) {
          if (!key) continue;
          drawCentered(`${key}: ${value || ""}`, 11);
        }
      }
    }
    // ----- End Cover Page -----

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
        const raw = await timeline.GetItemListInTrack("video", i);
        const items = Array.isArray(raw) ? raw : Object.values(raw || {});
        if (items && items.length) clips.push(...items);
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
        progressCb({ progress: (clipsProcessed / Math.max(totalClipsToProcess, 1)) * 100 });
        await sleep(0);

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

        const targetTC = framesToTimecode(frameToExport, timelineFrameRate);
        await timeline.SetCurrentTimecode(targetTC);
        await waitForPlayhead(timeline, targetTC, capMaxWait);

        const tempDir = os.tmpdir();
        const tempFilePath = path.join(
          tempDir,
          `resolve_thumb_${Date.now()}.jpg`,
        );
        const success = await exportStillWithRetry(project, tempFilePath, capRetryCount, capIntervals);

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
            failures.push({ timeline: timelineName, clip: clipName, timecode: targetTC, reason: 'embed_failed' });
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
          failures.push({ timeline: timelineName, clip: clipName, timecode: targetTC, reason: 'capture_failed' });
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
      progressWindow.webContents.send("generation-complete", { filePath, failures });
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

  // 始终在 Cut 页面执行，行为更稳定
  const targetPage = "edit";
  const currentPage = await resolve.GetCurrentPage();
  const mustSwitchPage = currentPage !== targetPage;

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
  let clipsProcessed = 0;
  // Emit an initial progress update so the bar doesn't look stuck
  try { progressCb({ progress: 0 }); } catch (_) {}

  try {
    if (mustSwitchPage) {
      await resolve.OpenPage(targetPage);
    }

    // Now that we're on a supported page, compute total items safely
    debugLog(`[CSV] Start export. Timelines: ${timelineNames.join(", ")}`);
    for (const timelineName of timelineNames) {
      const timeline = timelineMap.get(timelineName);
      if (!timeline) continue;
      // 确保设为当前时间线，部分项目下未设定会导致 API 阻塞或返回异常
      try { await project.SetCurrentTimeline(timeline); } catch (_) {}
      const videoTracks = await timeline.GetTrackCount("video");
      for (let i = 1; i <= videoTracks; i++) {
        const raw = await timeline.GetItemListInTrack("video", i);
        const items = Array.isArray(raw) ? raw : Object.values(raw || {});
        totalClipsToProcess += items.length;
      }
      debugLog(`[CSV] ${timelineName} total items so far: ${totalClipsToProcess}`);
    }
    if (totalClipsToProcess === 0) {
      debugLog("[CSV] No items found in selected timelines. Writing header-only CSV.");
    }

    for (const timelineName of timelineNames) {
      const timeline = timelineMap.get(timelineName);
      if (!timeline) continue;
      try { await project.SetCurrentTimeline(timeline); } catch (_) {}

      const videoTracks = await timeline.GetTrackCount("video");
      for (let i = 1; i <= videoTracks; i++) {
        const raw = await timeline.GetItemListInTrack("video", i);
        const items = Array.isArray(raw) ? raw : Object.values(raw || {});
        if (!items || items.length === 0) continue;

        for (const item of items) {
          clipsProcessed++;
          const denom = Math.max(totalClipsToProcess, 1);
          progressCb({ progress: (clipsProcessed / denom) * 100 });
          await sleep(0);

          let mediaPoolItem;
          try {
            mediaPoolItem = await item.GetMediaPoolItem();
          } catch (e) {
            continue;
          }
          if (!mediaPoolItem) continue;

          let clipName = "";
          try { clipName = await item.GetName(); } catch (_) {}
          let props = {};
          let metadata = {};
          try { props = await mediaPoolItem.GetClipProperty(); } catch (_) {}
          try { metadata = await mediaPoolItem.GetMetadata(); } catch (_) {}
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
  } catch (error) {
    debugLog(`Error generating CSV report: ${error.toString()}`);
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
  ipcMain.on("shell:openExternal", (event, url) => {
    try {
      if (url && typeof url === "string") shell.openExternal(url);
    } catch (e) {
      debugLog(`Failed to open external URL: ${url}`);
    }
  });

  ipcMain.handle("dialog:open-image", async () => {
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg"] }],
    });
    return filePaths && filePaths.length > 0 ? filePaths[0] : null;
  });

  function normalizeCoverPayload(cover) {
    const enabled = !!(cover && cover.enabled);
    const ditName = (cover && cover.ditName) || "";
    const text = (cover && cover.customFieldsText) || "";
    const lines = String(text)
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const customFields = lines.map((l) => {
      const idx = l.indexOf(":");
      if (idx === -1) return { key: l, value: "" };
      return { key: l.slice(0, idx).trim(), value: l.slice(idx + 1).trim() };
    });
    return { enabled, ditName, customFields };
  }

  const createProgressWindow = async (opts = {}) => {
    const { modal = true } = opts;
    if (progressWindow && !progressWindow.isDestroyed()) {
      try {
        progressWindow.show();
        progressWindow.focus();
        progressWindow.setAlwaysOnTop(true, "screen-saver");
      } catch (_) {}
      return;
    }
    return new Promise((resolve) => {
      progressWindow = new BrowserWindow({
        width: 400,
        height: 120,
        parent: mainWindow,
        modal,
        frame: false,
        resizable: false,
        show: false, // Hide initially to prevent flicker
        alwaysOnTop: true, // Ensure on top like PDF flow
        webPreferences: {
          preload: path.join(__dirname, "preload_progress.js"),
        },
      });
      progressWindow.once("ready-to-show", () => {
        // Reinforce top-most behavior and focus when shown
        try {
          progressWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
          progressWindow.setAlwaysOnTop(true, "screen-saver");
          progressWindow.show();
          progressWindow.focus();
        } catch (_) {
          progressWindow.show();
        }
      });
      progressWindow.webContents.once("did-finish-load", () => {
        try {
          progressWindow.webContents.send("generation-progress", { progress: 0 });
          // 再次提升置顶等级，防止被宿主窗口覆盖
          try { progressWindow.setAlwaysOnTop(true, "screen-saver"); } catch (_) {}
        } catch (_) {}
        resolve();
      });
      progressWindow.loadFile("progress.html");
      progressWindow.on("closed", () => (progressWindow = null));
    });
  };

  ipcMain.on("export-pdf-report", async (event, payload) => {
    // 获取当前项目名称
    const project = await getCurrentProject();
    const projectName = project ? await project.GetName() : "Unknown_Project";

    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: "Export PDF Report",
      defaultPath: `report_${projectName}_${formatDateForFilename()}.pdf`,
      filters: [{ name: "PDF Files", extensions: ["pdf"] }],
    });

    if (filePath) {
      await createProgressWindow({ modal: true });
      if (progressWindow) progressWindow.webContents.send("generation-progress", { progress: 1 });
      let { timelines, thumbnailSource, reportLogoPath, cover } = payload;
      if (!timelines || timelines.length === 0) {
        const project = await getCurrentProject();
        const timeline = await project.GetCurrentTimeline();
        if (timeline) timelines = [await timeline.GetName()];
      }
      if (timelines && timelines.length > 0) {
        generatePdfReport(
          filePath,
          { timelines, thumbnailSource, reportLogoPath, cover: normalizeCoverPayload(cover) },
          (progress) => {
            if (progressWindow) {
              progressWindow.webContents.send("generation-progress", progress);
            }
          },
        );
      } else {
        if (progressWindow) progressWindow.close();
      }
    } else {
      if (progressWindow) {
        try { progressWindow.close(); } catch (_) {}
      }
    }
  });

  ipcMain.on("export-csv-report", async (event, payload) => {
    // 获取当前项目名称
    const project = await getCurrentProject();
    const projectName = project ? await project.GetName() : "Unknown_Project";

    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: "Export CSV Report",
      defaultPath: `report_${projectName}_${formatDateForFilename()}.csv`,
      filters: [{ name: "CSV Files", extensions: ["csv"] }],
    });

    if (filePath) {
      await createProgressWindow({ modal: true });
      if (progressWindow) progressWindow.webContents.send("generation-progress", { progress: 1 });
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
    } else {
      if (progressWindow) {
        try { progressWindow.close(); } catch (_) {}
      }
    }
  });

  // 批量导出缩略图
  ipcMain.on("export-thumbnails", async (event, payload) => {
    // 解析参数，保证 timelines 准备就绪
    let { timelines, thumbnailSource, exportMode } = payload || {};
    const project = await getCurrentProject();
    const projectName = project ? await project.GetName() : "Unknown_Project";

    if (!timelines || timelines.length === 0) {
      if (project) {
        const timeline = await project.GetCurrentTimeline();
        if (timeline) timelines = [await timeline.GetName()];
      }
    }

    // 语言与 i18n
    let lang = "en";
    let i18nForDialog = {};
    try {
      const settings = getSettings();
      lang = (settings && settings.language) || "en";
      i18nForDialog = loadLanguage(lang) || {};
    } catch (_) {}

    // 若是仅导出标记素材，且当前选择的时间线没有标记，则提示并返回
    if (exportMode === "marked") {
      const hasMarked = await hasAnyMarkedClips(timelines);
      if (!hasMarked) {
        await dialog.showMessageBox(mainWindow, {
          type: "info",
          buttons: [i18nForDialog.ok || "OK"],
          title:
            i18nForDialog.noMarkedClipsTitle ||
            (lang === "zh" ? "没有标记素材" : "No Marked Clips"),
          message:
            i18nForDialog.noMarkedClipsMessage ||
            (lang === "zh"
              ? "当前选择的时间线没有标记素材。"
              : "No marked clips found in the selected timelines."),
        });
        return;
      }
    }

    // 让用户选择导出目录（标题随语言）
    const dialogTitle =
      i18nForDialog.chooseThumbnailSaveDir ||
      (lang === "zh" ? "选择缩略图保存目录" : "Select Folder to Save Thumbnails");

    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: dialogTitle,
      properties: ["openDirectory"],
    });

    if (filePaths && filePaths.length > 0) {
      const baseDir = filePaths[0];
      // 根据语言设置选择导出目录前缀
      let folderPrefix = "Stills"; // default
      try {
        const settings = getSettings();
        const langNow = (settings && settings.language) || "en";
        const i18n = loadLanguage(langNow) || {};
        folderPrefix =
          i18n.thumbnailFolderPrefix || (langNow === "zh" ? "单帧" : "Stills");
      } catch (_) {
        // fallback to default
      }
      const exportDir = path.join(
        baseDir,
        `${folderPrefix}_${projectName}_${formatDateForFilename()}`,
      );

      // 创建导出目录
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      await createProgressWindow({ modal: true });
      if (progressWindow) progressWindow.webContents.send("generation-progress", { progress: 1 });
      if (timelines && timelines.length > 0) {
        exportThumbnails(
          exportDir,
          { timelines, thumbnailSource, exportMode },
          (progress) => {
            if (progressWindow) {
              progressWindow.webContents.send("generation-progress", progress);
            }
          },
        );
      } else {
        if (progressWindow) progressWindow.close();
      }
    } else {
      if (progressWindow) {
        try { progressWindow.close(); } catch (_) {}
      }
    }
  });
}

// 批量导出缩略图函数
async function exportThumbnails(
  exportDir,
  { timelines: timelineNames, thumbnailSource, exportMode },
  progressCb,
) {
  const resolve = await getResolve();
  if (!resolve) return;

  const targetPage = "edit";
  const currentPage = await resolve.GetCurrentPage();
  const mustSwitchPage = currentPage !== targetPage;

  try {
    if (mustSwitchPage) {
      await resolve.OpenPage(targetPage);
    }

    const project = await getCurrentProject();
    if (!project) return;

    // 抓帧设置
    const capSettings = getSettings() || {};
    const capMaxWait = capSettings.captureMaxWaitMs || 2000;
    const capRetryCount = capSettings.captureRetryCount || 3;
    const capIntervals = capSettings.captureRetryIntervals || [250, 500, 800];

    const timelineCount = await project.GetTimelineCount();
    const timelineMap = new Map();
    for (let i = 1; i <= timelineCount; i++) {
      const tl = await project.GetTimelineByIndex(i);
      timelineMap.set(await tl.GetName(), tl);
    }

    // Preload timeline markers for selected timelines (for marked export mode)
    const markersPerTimeline = new Map();
    for (const timelineName of (timelineNames || [])) {
      const tl = timelineMap.get(timelineName);
      if (!tl) continue;
      try {
        const markers = await tl.GetMarkers();
        const frames = Object.keys(markers || {})
          .map((k) => parseInt(k, 10))
          .filter((n) => Number.isFinite(n))
          .sort((a, b) => a - b);
        markersPerTimeline.set(timelineName, frames);
      } catch (e) {
        markersPerTimeline.set(timelineName, []);
      }
    }

    let totalClipsToProcess = 0;
    for (const timelineName of timelineNames) {
      const timeline = timelineMap.get(timelineName);
      if (!timeline) continue;

      if (exportMode === "marked") {
        // In marked mode, total work equals number of timeline markers
        const markerFrames = markersPerTimeline.get(timelineName) || [];
        totalClipsToProcess += markerFrames.length;
        continue;
      }

      const videoTracks = await timeline.GetTrackCount("video");
      for (let i = 1; i <= videoTracks; i++) {
        const raw = await timeline.GetItemListInTrack("video", i);
        const items = Array.isArray(raw) ? raw : Object.values(raw || {});
        totalClipsToProcess += items.length;
      }
    }

    let clipsProcessed = 0;

    for (const timelineName of timelineNames) {
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

      // If marked mode: export frames at timeline marker positions
      if (exportMode === "marked") {
        const markerFrames = markersPerTimeline.get(timelineName) || [];
        for (const mf of markerFrames) {
          // advance progress by one marker
          clipsProcessed++;
          progressCb({ progress: (clipsProcessed / Math.max(totalClipsToProcess, 1)) * 100 });
          await sleep(0);

          const timelineFrameRate = parseFloat(
            await timeline.GetSetting("timelineFrameRate"),
          );
          // Convert marker frame (relative to timeline start) to absolute timecode
          const startTc = await timeline.GetStartTimecode();
          const startFrames = timecodeToFrames(startTc, timelineFrameRate);
          // Marker frames are 1-based relative to timeline start; align to start timecode
          const absFrames = startFrames + Math.max(0, (mf - 1));
          const tc = framesToTimecode(absFrames, timelineFrameRate);
          await timeline.SetCurrentTimecode(tc);
          await waitForPlayhead(timeline, tc, capMaxWait);

          // Try to find the clip under this marker (for naming)
          let clipBase = "no-clip";
          // First, ask Resolve for the current timeline video item
          try {
            const currentItem = await timeline.GetCurrentVideoItem();
            if (currentItem) {
              const mpi = await currentItem.GetMediaPoolItem();
              const props = mpi ? await mpi.GetClipProperty() : null;
              const fn = props && props["File Name"];
              if (fn) clipBase = path.parse(fn).name;
            }
          } catch (_) {
            // fall back to manual scan below
          }
          try {
            if (clipBase === "no-clip") {
              for (const c of clips) {
                const s = await c.GetStart();
                const e = await c.GetEnd();
                // treat end as exclusive to avoid boundary ambiguity
                if (absFrames >= s && absFrames < e) {
                  const mpi = await c.GetMediaPoolItem();
                  const props = mpi ? await mpi.GetClipProperty() : null;
                  const fileName = props && props["File Name"];
                  if (fileName) clipBase = path.parse(fileName).name;
                  break;
                }
              }
            }
          } catch (_) {
            // naming fallback already set
          }

          const safeTc = String(tc).replace(/[\\/:*?"<>|;]/g, "-");
          const timelinePart = safeFileComponent(timelineName);
          const thumbnailPath = path.join(
            exportDir,
            `${timelinePart}-${safeTc}.jpg`,
          );
          const success = await exportStillWithRetry(project, thumbnailPath, capRetryCount, capIntervals);
          if (!success) {
            debugLog(`Failed to export thumbnail at marker ${tc} for timeline ${timelineName}`);
            if (!globalThis.__thumbFailures) globalThis.__thumbFailures = [];
            globalThis.__thumbFailures.push({ timeline: timelineName, timecode: tc, reason: 'capture_failed' });
          }
        }

        await timeline.SetCurrentTimecode(originalTimecode);
        continue; // move to next timeline
      }

      // Else: export per clip (all mode)
      for (const clip of clips) {
        let mediaPoolItem;
        try {
          mediaPoolItem = await clip.GetMediaPoolItem();
        } catch (e) {
          continue;
        }
        if (!mediaPoolItem) continue;

        // All mode does not filter by markers

        clipsProcessed++;
        progressCb({ progress: (clipsProcessed / Math.max(totalClipsToProcess, 1)) * 100 });
        await sleep(0);

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

        const tcForName = framesToTimecode(frameToExport, timelineFrameRate);
        await timeline.SetCurrentTimecode(tcForName);
        await waitForPlayhead(timeline, tcForName, capMaxWait);

        // 获取文件名
        const props = await mediaPoolItem.GetClipProperty();
        const fileName = props["File Name"] || `clip_${clipsProcessed}`;
        const baseName = path.parse(fileName).name; // 去掉扩展名
        const timelinePart = safeFileComponent(timelineName);
        const safeTc = String(tcForName).replace(/[\\/:*?"<>|;]/g, "-");
        const thumbnailPath = path.join(
          exportDir,
          `${timelinePart}-${safeTc}.jpg`,
        );

        const success = await exportStillWithRetry(project, thumbnailPath, capRetryCount, capIntervals);

        if (!success) {
          debugLog(`Failed to export thumbnail for: ${fileName}`);
          if (!globalThis.__thumbFailures) globalThis.__thumbFailures = [];
          globalThis.__thumbFailures.push({ timeline: timelineName, clip: baseName, timecode: tcForName, reason: 'capture_failed' });
        }
      }

      await timeline.SetCurrentTimecode(originalTimecode);
    }

    const failures = globalThis.__thumbFailures || [];
    globalThis.__thumbFailures = [];
    if (progressWindow) {
      progressWindow.webContents.send("generation-complete", {
        filePath: exportDir,
        message: `缩略图已导出到: ${exportDir}`,
        failures,
      });
    }
  } catch (error) {
    debugLog(`Error exporting thumbnails: ${error.toString()}`);
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

// 检查所选时间线中是否存在时间线标记
async function hasAnyMarkedClips(timelineNames) {
  if (!timelineNames || timelineNames.length === 0) return false;
  const resolve = await getResolve();
  if (!resolve) return false;

  const targetPage = "edit";
  const currentPage = await resolve.GetCurrentPage();
  const mustSwitchPage = currentPage !== targetPage;

  try {
    if (mustSwitchPage) {
      await resolve.OpenPage(targetPage);
    }
    const project = await getCurrentProject();
    if (!project) return false;

    const timelineCount = await project.GetTimelineCount();
    const timelineMap = new Map();
    for (let i = 1; i <= timelineCount; i++) {
      const tl = await project.GetTimelineByIndex(i);
      timelineMap.set(await tl.GetName(), tl);
    }

    for (const name of timelineNames) {
      const timeline = timelineMap.get(name);
      if (!timeline) continue;
      try {
        const markers = await timeline.GetMarkers();
        if (markers && Object.keys(markers).length > 0) return true;
      } catch (_) {}
    }
    return false;
  } finally {
    if (mustSwitchPage) {
      await resolve.OpenPage(currentPage);
    }
  }
}
// --- Small async helpers ---
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 等待播放头到达指定时间码（避免低性能机器上未就位就抓帧）
async function waitForPlayhead(timeline, targetTC, timeoutMs = 2000) {
  const start = Date.now();
  try {
    while (Date.now() - start < timeoutMs) {
      const cur = await timeline.GetCurrentTimecode();
      if (cur === targetTC) return true;
      await sleep(50);
    }
  } catch (_) {
    // 忽略异常，按超时处理
  }
  return false;
}

// 多次重试抓帧，适配低配机器（渲染/解码慢）
async function exportStillWithRetry(project, outPath, retries = 3, waits = [200, 400, 800]) {
  for (let i = 0; i < retries; i++) {
    const ok = await project.ExportCurrentFrameAsStill(outPath);
    if (ok) {
      try {
        const st = fs.statSync(outPath);
        if (st && st.size > 0) return true;
      } catch (_) {}
    }
    const wait = waits[i] || waits[waits.length - 1] || 300;
    await sleep(wait);
  }
  return false;
}
