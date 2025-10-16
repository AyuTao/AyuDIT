let refreshIntervalId = null;
let i18nData = {};
let currentSettings = {};

const DEFAULT_LOGO_PATH = "./img/ayuditlogo.png";

// --- Initialization ---
window.addEventListener("DOMContentLoaded", async () => {
  // Listen for logs from the main process
  if (window.resolveAPI.onLogMessage) {
    window.resolveAPI.onLogMessage((message) => {
      console.log(`%cMAIN:`, "color: #800", message);
    });
  }

  currentSettings = await window.resolveAPI.getSettings();
  if (!currentSettings.thumbnailSource) {
    currentSettings.thumbnailSource = "middle";
  }
  if (!currentSettings.reportLogoPath) {
    currentSettings.reportLogoPath = DEFAULT_LOGO_PATH;
  }
  if (typeof currentSettings.coverPageEnabled === "undefined") {
    currentSettings.coverPageEnabled = true;
  }
  if (typeof currentSettings.coverDITName === "undefined") {
    currentSettings.coverDITName = "";
  }
  if (typeof currentSettings.coverCustomFieldsText === "undefined") {
    currentSettings.coverCustomFieldsText = "";
  }

  await loadAndApplyLanguage(currentSettings.language || "en");
  // 设置缩略图来源单选框
  const thumbVal = currentSettings.thumbnailSource || "middle";
  const radioToCheck = document.querySelector(`input[name="thumb-source"][value="${thumbVal}"]`);
  if (radioToCheck) radioToCheck.checked = true;
  const coverEnabledEl = document.getElementById("cover-enabled");
  if (coverEnabledEl) coverEnabledEl.checked = !!currentSettings.coverPageEnabled;
  const coverDitEl = document.getElementById("cover-dit-name");
  if (coverDitEl) coverDitEl.value = currentSettings.coverDITName || "";
  const coverFieldsEl = document.getElementById("cover-custom-fields");
  if (coverFieldsEl) coverFieldsEl.value = currentSettings.coverCustomFieldsText || "";
  // 抓帧设置赋值
  const capWaitEl = document.getElementById("capture-wait-ms");
  if (capWaitEl) capWaitEl.value = currentSettings.captureMaxWaitMs ?? 2000;
  const capRetryEl = document.getElementById("capture-retry-count");
  if (capRetryEl) capRetryEl.value = currentSettings.captureRetryCount ?? 3;
  const capIntervalsEl = document.getElementById("capture-retry-intervals");
  if (capIntervalsEl) capIntervalsEl.value = (currentSettings.captureRetryIntervals || [250,500,800]).join(",");
  updateLogoPreview();
  setupEventListeners();
  updateDashboard();
  populateTimelineList();
  startAutoRefresh();
});

// --- I18n & Translation ---
async function loadAndApplyLanguage(lang) {
  i18nData = await window.resolveAPI.loadLanguage(lang);
  applyTranslations();
  document.getElementById("language-select").value = lang;
  // Update refresh icon tooltip
  const refreshBtn = document.getElementById("refresh-button");
  if (refreshBtn) {
    const label = i18nData.refreshNow || "Refresh Now";
    refreshBtn.setAttribute("title", label);
    refreshBtn.setAttribute("aria-label", label);
  }
  // Update floating buttons tooltips (donate/github)
  const donateFab = document.getElementById("donate-fab");
  if (donateFab) {
    const label = i18nData.donate || "Donate";
    donateFab.setAttribute("title", label);
    donateFab.setAttribute("aria-label", label);
  }
  const githubFab = document.getElementById("github-fab");
  if (githubFab) {
    const label = i18nData.github || "GitHub";
    githubFab.setAttribute("title", label);
    githubFab.setAttribute("aria-label", label);
  }
  const issueFab2 = document.getElementById("issue-fab");
  if (issueFab2) {
    const label = i18nData.reportBug || "Report Bug";
    issueFab2.setAttribute("title", label);
    issueFab2.setAttribute("aria-label", label);
  }
}

function applyTranslations() {
  document.querySelectorAll("[data-i18n-key]").forEach((el) => {
    const key = el.getAttribute("data-i18n-key");
    if (i18nData[key]) {
      el.textContent = i18nData[key];
    }
  });
}

// --- Event Listeners ---
function setupEventListeners() {
  const modal = document.getElementById("settings-modal");
  const settingsButton = document.getElementById("settings-button");
  // Scope the close button to the settings modal to avoid conflicts
  const closeButton = modal ? modal.querySelector(".close-button") : null;

  if (settingsButton && modal) {
    settingsButton.onclick = () => {
      modal.style.display = "block";
    };
  }
  if (closeButton && modal) {
    closeButton.onclick = () => (modal.style.display = "none");
  }

  document
    .getElementById("auto-refresh")
    .addEventListener("change", startOrStopAutoRefresh);
  document
    .getElementById("refresh-interval")
    .addEventListener("change", startOrStopAutoRefresh);
  const refreshButton = document.getElementById("refresh-button");
  if (refreshButton) {
    refreshButton.addEventListener("click", async () => {
      await updateDashboard();
      await populateTimelineList(); // ensure timelines reflect current project
    });
  }
  document
    .getElementById("language-select")
    .addEventListener("change", handleLanguageChange);
  // 缩略图来源单选框事件
  document.querySelectorAll('input[name="thumb-source"]').forEach((el) => {
    el.addEventListener("change", handleThumbnailSourceChange);
  });
  const coverEnabled = document.getElementById("cover-enabled");
  if (coverEnabled) coverEnabled.addEventListener("change", handleCoverEnabledChange);
  const coverDit = document.getElementById("cover-dit-name");
  if (coverDit) coverDit.addEventListener("input", handleCoverDitChange);
  const coverFields = document.getElementById("cover-custom-fields");
  if (coverFields) coverFields.addEventListener("input", handleCoverFieldsChange);
  const capWait = document.getElementById("capture-wait-ms");
  if (capWait) capWait.addEventListener("change", handleCaptureWaitChange);
  const capRetry = document.getElementById("capture-retry-count");
  if (capRetry) capRetry.addEventListener("change", handleCaptureRetryChange);
  const capIntervals = document.getElementById("capture-retry-intervals");
  if (capIntervals) capIntervals.addEventListener("change", handleCaptureIntervalsChange);
  document
    .getElementById("change-logo-button")
    .addEventListener("click", handleChangeLogo);
  document
    .getElementById("reset-logo-button")
    .addEventListener("click", handleResetLogo);
  const openLogDirBtn = document.getElementById('open-log-dir-button');
  if (openLogDirBtn) {
    openLogDirBtn.addEventListener('click', async ()=>{
      try {
        const dir = await window.resolveAPI.getLogDir();
        if (dir) {
          window.resolveAPI.openPath(dir);
        }
      } catch(e) { console.error(e); }
    });
  }
  document
    .getElementById("generate-pdf-button")
    .addEventListener("click", () => handleGenerateReportFromSelection("pdf"));
  document
    .getElementById("export-csv-button")
    .addEventListener("click", () => handleGenerateReportFromSelection("csv"));
  const renderVideoButton = document.getElementById("render-video-button");
  if (renderVideoButton) {
    renderVideoButton.addEventListener("click", () => {
      if (!hasSelectedTimelines()) {
        alert(i18nData.selectTimelineAlert || "Please select at least one timeline.");
        return;
      }
      openRenderModal();
    });
  }
  document
    .getElementById("select-all-timelines")
    .addEventListener("click", () => { setAllTimelinesSelected(true); updateExportButtonsState(); });
  document
    .getElementById("deselect-all-timelines")
    .addEventListener("click", () => { setAllTimelinesSelected(false); updateExportButtonsState(); });

  // Donate modal events
  const donateFab = document.getElementById("donate-fab");
  const donateModal = document.getElementById("donate-modal");
  if (donateFab && donateModal) {
    donateFab.addEventListener("click", () => (donateModal.style.display = "block"));
    const closeBtn = donateModal.querySelector(".close-button");
    if (closeBtn) closeBtn.addEventListener("click", () => (donateModal.style.display = "none"));
    const paypalLink = document.getElementById("paypal-link");
    if (paypalLink) {
      paypalLink.addEventListener("click", (e) => {
        e.preventDefault();
        const href = paypalLink.getAttribute("href");
        if (href) window.resolveAPI.openExternal(href);
      });
    }
  }

  // GitHub button
  const githubFab = document.getElementById("github-fab");
  if (githubFab) {
    githubFab.addEventListener("click", () => {
      window.resolveAPI.openExternal("https://github.com/AyuTao/AyuDIT");
    });
  }

  // Issue (bug report) button - bottom-right
  const issueFab = document.getElementById("issue-fab");
  if (issueFab) {
    issueFab.addEventListener("click", () => {
      window.resolveAPI.openExternal("https://github.com/AyuTao/AyuDIT/issues/new");
    });
  }

  // 缩略图导出相关事件
  const exportThumbnailsButton = document.getElementById("export-thumbnails-button");
  if (exportThumbnailsButton) {
    exportThumbnailsButton.addEventListener("click", function() {
      console.log("缩略图按钮被点击了");
      // 若未选择任何时间线，先提示再返回
      if (!hasSelectedTimelines()) {
        alert(i18nData.selectTimelineAlert || "Please select at least one timeline.");
        return;
      }
      showThumbnailExportModal();
    });
    console.log("缩略图导出按钮事件监听器已添加");
  } else {
    console.error("找不到缩略图导出按钮");
  }
  
  // 缩略图导出模态框事件
  const thumbnailModal = document.getElementById("thumbnail-export-modal");
  if (thumbnailModal) {
    const thumbnailCloseButton = thumbnailModal.querySelector(".close-button");
    if (thumbnailCloseButton) {
      thumbnailCloseButton.onclick = () => (thumbnailModal.style.display = "none");
    }
    
    const exportAllButton = document.getElementById("export-all-thumbnails");
    if (exportAllButton) {
      exportAllButton.addEventListener("click", () => handleThumbnailExport("all"));
    }
    
    const exportMarkedButton = document.getElementById("export-marked-thumbnails");
    if (exportMarkedButton) {
      exportMarkedButton.addEventListener("click", () => handleThumbnailExport("marked"));
    }
  }

  // 渲染导出模态框
  const renderModal = document.getElementById("render-modal");
  if (renderModal) {
    const renderClose = renderModal.querySelector('.close-button');
    if (renderClose) renderClose.onclick = () => (renderModal.style.display = 'none');
    const startRenderBtn = document.getElementById('start-render-button');
    if (startRenderBtn) startRenderBtn.addEventListener('click', handleStartRender);
    const reloadBtn = document.getElementById('reload-presets-button');
    if (reloadBtn) reloadBtn.addEventListener('click', async ()=>{ try{ await loadRenderPresetsIntoSelect(); }catch(e){ console.error(e);} });
    const chooseDirBtn = document.getElementById('choose-render-dir-button');
    if (chooseDirBtn) chooseDirBtn.addEventListener('click', async ()=>{
      const p = await window.resolveAPI.openDirectoryDialog();
      if (p) {
        const el = document.getElementById('render-output-dir');
        if (el) el.value = p;
      }
    });
    const presetSel = document.getElementById('render-preset-select');
    if (presetSel) presetSel.addEventListener('change', updatePresetCount);
  }
  
  // 点击模态框外部关闭 - 处理所有模态框
  window.addEventListener("click", (event) => {
    const settingsModal = document.getElementById("settings-modal");
    const thumbnailModal = document.getElementById("thumbnail-export-modal");
    const donateModal = document.getElementById("donate-modal");
    const renderModal = document.getElementById("render-modal");
    
    if (event.target == settingsModal) {
      settingsModal.style.display = "none";
    }
    if (event.target == thumbnailModal) {
      thumbnailModal.style.display = "none";
    }
    if (event.target == donateModal) {
      donateModal.style.display = "none";
    }
    if (event.target == renderModal) {
      renderModal.style.display = "none";
    }
  });
}

function hasSelectedTimelines() {
  const timelineListEl = document.getElementById("timeline-list");
  if (!timelineListEl) return false;
  const checkboxes = timelineListEl.querySelectorAll('input[type="checkbox"]');
  return Array.from(checkboxes).some(cb => cb.checked);
}

async function handleLanguageChange(event) {
  const newLang = event.target.value;
  currentSettings.language = newLang;
  await window.resolveAPI.saveSettings(currentSettings);
  await loadAndApplyLanguage(newLang);
}

async function handleThumbnailSourceChange(event) {
  const checked = document.querySelector('input[name="thumb-source"]:checked');
  const newValue = checked ? checked.value : "middle";
  currentSettings.thumbnailSource = newValue;
  await window.resolveAPI.saveSettings(currentSettings);
}

async function handleCoverEnabledChange(event) {
  currentSettings.coverPageEnabled = event.target.checked;
  await window.resolveAPI.saveSettings(currentSettings);
}

async function handleCoverDitChange(event) {
  currentSettings.coverDITName = event.target.value;
  await window.resolveAPI.saveSettings(currentSettings);
}

async function handleCoverFieldsChange(event) {
  currentSettings.coverCustomFieldsText = event.target.value;
  await window.resolveAPI.saveSettings(currentSettings);
}

async function handleCaptureWaitChange(event) {
  const v = parseInt(event.target.value, 10);
  currentSettings.captureMaxWaitMs = Number.isFinite(v) && v >= 0 ? v : 2000;
  await window.resolveAPI.saveSettings(currentSettings);
}

async function handleCaptureRetryChange(event) {
  const v = parseInt(event.target.value, 10);
  currentSettings.captureRetryCount = Number.isFinite(v) && v >= 0 ? v : 3;
  await window.resolveAPI.saveSettings(currentSettings);
}

async function handleCaptureIntervalsChange(event) {
  const text = event.target.value || "";
  const arr = text.split(/[,\s]+/).map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n) && n >= 0);
  currentSettings.captureRetryIntervals = arr.length > 0 ? arr : [250,500,800];
  await window.resolveAPI.saveSettings(currentSettings);
}

async function handleChangeLogo() {
  const newPath = await window.resolveAPI.openImageDialog();
  if (newPath) {
    currentSettings.reportLogoPath = newPath;
    await window.resolveAPI.saveSettings(currentSettings);
    updateLogoPreview();
  }

  // 初始化导出按钮状态
  updateExportButtonsState();
}

async function handleResetLogo() {
  currentSettings.reportLogoPath = DEFAULT_LOGO_PATH;
  await window.resolveAPI.saveSettings(currentSettings);
  updateLogoPreview();
}

function updateLogoPreview() {
  const preview = document.getElementById("logo-preview");
  preview.src = `${currentSettings.reportLogoPath}?t=${new Date().getTime()}`;
}

// --- Auto Refresh Logic ---
function startOrStopAutoRefresh() {
  if (document.getElementById("auto-refresh").checked) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
}

function startAutoRefresh() {
  stopAutoRefresh();
  const interval = document.getElementById("refresh-interval").value * 1000;
  if (interval > 0) {
    refreshIntervalId = setInterval(async () => {
      await updateDashboard();
      await populateTimelineList();
    }, interval);
  }
}

function stopAutoRefresh() {
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
  }
}

// --- Data & UI Update ---
async function updateDashboard() {
  console.log("Updating dashboard...");
  const projectNameEl = document.getElementById("project-name");
  projectNameEl.textContent = i18nData.loading || "Loading...";

  try {
    const stats = await window.resolveAPI.getMediaStats();
    if (stats) {
      projectNameEl.textContent = stats.projectName;
      document.getElementById("video-count").textContent = stats.video;
      document.getElementById("audio-count").textContent = stats.audio;
      document.getElementById("timeline-count").textContent = stats.timeline;
      document.getElementById("total-size").textContent = formatBytes(
        stats.totalSize,
      );
    } else {
      projectNameEl.textContent =
        i18nData.noProject || "No project open or media found.";
    }
  } catch (error) {
    console.error("Failed to update dashboard:", error);
    projectNameEl.textContent = i18nData.errorLoading || "Error loading data.";
  }
}

// --- Timeline Selection Logic ---
async function populateTimelineList() {
  const timelineListEl = document.getElementById("timeline-list");
  if (!timelineListEl) return;

  try {
    const timelines = await window.resolveAPI.getTimelineList();
    timelineListEl.innerHTML = ""; // Clear existing list
    timelines.forEach((timeline) => {
      const li = document.createElement("li");
      li.draggable = true;
      li.dataset.timelineName = timeline.name;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = false; // Default to unselected
      checkbox.addEventListener('change', updateExportButtonsState);

      const label = document.createElement("span");
      label.textContent = timeline.name;
      label.className = "timeline-name";

      const meta = document.createElement("span");
      meta.className = "timeline-meta";
      meta.textContent = `(${timeline.resolution} | ${timeline.frameRate}fps | ${timeline.duration} | ${timeline.clipCount} ${i18nData.clips || "clips"} | ${timeline.totalSize})`;

      li.appendChild(checkbox);
      li.appendChild(label);
      li.appendChild(meta);
      timelineListEl.appendChild(li);
    });

    addDragAndDropListeners(timelineListEl);
    updateExportButtonsState();
  } catch (error) {
    console.error("Failed to populate timeline list:", error);
    timelineListEl.innerHTML = `<li>${i18nData.errorLoading || "Error loading timelines."}</li>`;
  }
}

function addDragAndDropListeners(listEl) {
  let draggedItem = null;

  listEl.addEventListener("dragstart", (e) => {
    draggedItem = e.target;
    setTimeout(() => {
      e.target.classList.add("dragging");
    }, 0);
  });

  listEl.addEventListener("dragend", (e) => {
    setTimeout(() => {
      draggedItem.classList.remove("dragging");
      draggedItem = null;
    }, 0);
  });

  listEl.addEventListener("dragover", (e) => {
    e.preventDefault();
    const afterElement = getDragAfterElement(listEl, e.clientY);
    const currentElement = document.querySelector(".dragging");
    if (afterElement == null) {
      listEl.appendChild(currentElement);
    } else {
      listEl.insertBefore(currentElement, afterElement);
    }
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [
    ...container.querySelectorAll("li:not(.dragging)"),
  ];

  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    },
    { offset: Number.NEGATIVE_INFINITY },
  ).element;
}

function handleGenerateReportFromSelection(type) {
  const timelineListEl = document.getElementById("timeline-list");
  const selectedTimelines = [];
  const listItems = timelineListEl.querySelectorAll("li");

  listItems.forEach((li) => {
    const checkbox = li.querySelector('input[type="checkbox"]');
    if (checkbox.checked) {
      selectedTimelines.push(li.dataset.timelineName);
    }
  });

  if (selectedTimelines.length > 0) {
    const payload = {
      timelines: selectedTimelines,
      thumbnailSource: currentSettings.thumbnailSource,
      reportLogoPath: currentSettings.reportLogoPath,
      cover: {
        enabled: !!currentSettings.coverPageEnabled,
        ditName: currentSettings.coverDITName || "",
        customFieldsText: currentSettings.coverCustomFieldsText || "",
      },
    };
    if (type === "pdf") {
      window.resolveAPI.startPdfReport(payload);
    } else if (type === "csv") {
      window.resolveAPI.startCsvReport(payload);
    }
  } else {
    alert(
      i18nData.selectTimelineAlert || "Please select at least one timeline.",
    );
  }
}

function setAllTimelinesSelected(isSelected) {
  const timelineListEl = document.getElementById("timeline-list");
  const checkboxes = timelineListEl.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach((checkbox) => (checkbox.checked = isSelected));
}

function updateExportButtonsState() {
  const enabled = hasSelectedTimelines();
  const needTip = i18nData.selectTimelineAlert || 'Please select at least one timeline.';
  const labels = {
    render: i18nData.renderVideo || 'Render Video',
    thumbs: i18nData.exportThumbnails || 'Export Thumbnails',
    pdf: i18nData.generatePdf || 'Generate PDF',
    csv: i18nData.exportCsv || 'Export CSV',
  };
  const setBtn = (id, label) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.disabled = !enabled;
    el.setAttribute('title', enabled ? label : needTip);
    el.setAttribute('aria-label', enabled ? label : needTip);
  };
  setBtn('render-video-button', labels.render);
  setBtn('export-thumbnails-button', labels.thumbs);
  setBtn('generate-pdf-button', labels.pdf);
  setBtn('export-csv-button', labels.csv);
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

// --- 缩略图导出相关函数 ---
function showThumbnailExportModal() {
  console.log("显示缩略图导出模态框");
  const modal = document.getElementById("thumbnail-export-modal");
  if (modal) {
    modal.style.display = "block";
    console.log("模态框已显示");
  } else {
    console.error("找不到缩略图导出模态框元素");
  }
}

// 确保函数在全局作用域中可用
window.showThumbnailExportModal = showThumbnailExportModal;

// 测试函数
function testThumbnailButton() {
  console.log("测试缩略图按钮");
  alert("缩略图按钮点击测试");
}

function handleThumbnailExport(exportMode) {
  console.log("开始缩略图导出，模式:", exportMode);
  const timelineListEl = document.getElementById("timeline-list");
  const selectedTimelines = [];
  const listItems = timelineListEl.querySelectorAll("li");

  listItems.forEach((li) => {
    const checkbox = li.querySelector('input[type="checkbox"]');
    if (checkbox.checked) {
      selectedTimelines.push(li.dataset.timelineName);
    }
  });

  console.log("选中的时间线:", selectedTimelines);

  if (selectedTimelines.length > 0) {
    // 先选择输出目录（支持新建文件夹）
    window.resolveAPI.openDirectoryDialog().then((dir)=>{
      if (!dir) return; // 用户取消
      const payload = {
        timelines: selectedTimelines,
        thumbnailSource: currentSettings.thumbnailSource,
        exportMode: exportMode,
        exportDir: dir,
      };
      console.log("发送导出请求:", payload);
      window.resolveAPI.startThumbnailExport(payload);
      // 关闭模态框
      document.getElementById("thumbnail-export-modal").style.display = "none";
    });
  } else {
    alert(
      i18nData.selectTimelineAlert || "Please select at least one timeline.",
    );
  }
}
async function openRenderModal() {
  // 预加载预设
  try {
    await loadRenderPresetsIntoSelect();
  } catch (e) { console.error('Failed to load render presets', e); }
  try {
    const outDirEl = document.getElementById('render-output-dir');
    if (outDirEl && !outDirEl.value) {
      const movies = await window.resolveAPI.getMoviesDir();
      if (movies) outDirEl.value = movies;
    }
  } catch (_) {}
  const modal = document.getElementById('render-modal');
  if (modal) modal.style.display = 'block';
}

async function handleStartRender() {
  const timelineListEl = document.getElementById("timeline-list");
  const selectedTimelines = [];
  timelineListEl.querySelectorAll('li').forEach((li)=>{
    const cb = li.querySelector('input[type="checkbox"]');
    if (cb && cb.checked) selectedTimelines.push(li.dataset.timelineName);
  });
  if (selectedTimelines.length === 0) {
    alert(i18nData.selectTimelineAlert || 'Please select at least one timeline.');
    return;
  }
  const presetSel = document.getElementById('render-preset-select');
  const presetNames = presetSel ? Array.from(presetSel.selectedOptions).map(o=>o.value).filter(Boolean) : [];
  const outDirEl = document.getElementById('render-output-dir');
  const targetDir = outDirEl ? outDirEl.value.trim() : '';
  if (!targetDir) { alert('请选择输出目录'); return; }
  const nameTplEl = document.getElementById('render-name-template');
  const nameTemplate = nameTplEl ? nameTplEl.value : '{timeline}_{date}';
  window.resolveAPI.startRender({ timelines: selectedTimelines, presetNames, targetDir, nameTemplate });
  const modal = document.getElementById('render-modal');
  if (modal) modal.style.display = 'none';
}

async function loadRenderPresetsIntoSelect() {
  const presets = await window.resolveAPI.getRenderPresets();
  const sel = document.getElementById('render-preset-select');
  if (!sel) return;
  sel.innerHTML = '';
  const list = Array.isArray(presets) ? presets : [];
  if (list.length === 0) {
    const opt = document.createElement('option');
    opt.disabled = true;
    opt.textContent = (i18nData.noPresets || 'No presets available');
    sel.appendChild(opt);
  } else {
    list.forEach((name) => {
      const opt = document.createElement('option');
      opt.value = name; opt.textContent = name; sel.appendChild(opt);
    });
  }
  updatePresetCount();
}

function updatePresetCount() {
  const sel = document.getElementById('render-preset-select');
  const countEl = document.getElementById('preset-count');
  if (!sel || !countEl) return;
  const count = Array.from(sel.selectedOptions||[]).length;
  const tpl = (i18nData.selectedCount || 'Selected: {count}');
  countEl.textContent = tpl.replace('{count}', count);
}
