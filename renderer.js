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

  await loadAndApplyLanguage(currentSettings.language || "en");
  document.getElementById("thumbnail-source-select").value =
    currentSettings.thumbnailSource;
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
  const closeButton = document.querySelector(".close-button");

  settingsButton.onclick = () => {
    modal.style.display = "block";
  };
  closeButton.onclick = () => (modal.style.display = "none");
  window.onclick = (event) => {
    if (event.target == modal) {
      modal.style.display = "none";
    }
  };

  document
    .getElementById("auto-refresh")
    .addEventListener("change", startOrStopAutoRefresh);
  document
    .getElementById("refresh-interval")
    .addEventListener("change", startOrStopAutoRefresh);
  document
    .getElementById("refresh-now")
    .addEventListener("click", updateDashboard);
  document
    .getElementById("language-select")
    .addEventListener("change", handleLanguageChange);
  document
    .getElementById("thumbnail-source-select")
    .addEventListener("change", handleThumbnailSourceChange);
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
}

async function handleLanguageChange(event) {
  const newLang = event.target.value;
  currentSettings.language = newLang;
  await window.resolveAPI.saveSettings(currentSettings);
  await loadAndApplyLanguage(newLang);
}

async function handleThumbnailSourceChange(event) {
  const newValue = event.target.value;
  currentSettings.thumbnailSource = newValue;
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
    refreshIntervalId = setInterval(updateDashboard, interval);
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
