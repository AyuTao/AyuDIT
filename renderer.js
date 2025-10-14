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
  document
    .getElementById("change-logo-button")
    .addEventListener("click", handleChangeLogo);
  document
    .getElementById("reset-logo-button")
    .addEventListener("click", handleResetLogo);
  document
    .getElementById("generate-pdf-button")
    .addEventListener("click", () => handleGenerateReportFromSelection("pdf"));
  document
    .getElementById("export-csv-button")
    .addEventListener("click", () => handleGenerateReportFromSelection("csv"));
  document
    .getElementById("select-all-timelines")
    .addEventListener("click", () => setAllTimelinesSelected(true));
  document
    .getElementById("deselect-all-timelines")
    .addEventListener("click", () => setAllTimelinesSelected(false));

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
  
  // 点击模态框外部关闭 - 处理所有模态框
  window.addEventListener("click", (event) => {
    const settingsModal = document.getElementById("settings-modal");
    const thumbnailModal = document.getElementById("thumbnail-export-modal");
    const donateModal = document.getElementById("donate-modal");
    
    if (event.target == settingsModal) {
      settingsModal.style.display = "none";
    }
    if (event.target == thumbnailModal) {
      thumbnailModal.style.display = "none";
    }
    if (event.target == donateModal) {
      donateModal.style.display = "none";
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

async function handleChangeLogo() {
  const newPath = await window.resolveAPI.openImageDialog();
  if (newPath) {
    currentSettings.reportLogoPath = newPath;
    await window.resolveAPI.saveSettings(currentSettings);
    updateLogoPreview();
  }
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
    const payload = {
      timelines: selectedTimelines,
      thumbnailSource: currentSettings.thumbnailSource,
      exportMode: exportMode
    };
    
    console.log("发送导出请求:", payload);
    window.resolveAPI.startThumbnailExport(payload);
    
    // 关闭模态框
    document.getElementById("thumbnail-export-modal").style.display = "none";
  } else {
    alert(
      i18nData.selectTimelineAlert || "Please select at least one timeline.",
    );
  }
}
