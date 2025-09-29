let refreshIntervalId = null;
let i18nData = {};
let currentSettings = {};

// --- Initialization ---
window.addEventListener("DOMContentLoaded", async () => {
  // Listen for logs from the main process
  if (window.resolveAPI.onLogMessage) {
    window.resolveAPI.onLogMessage((message) => {
      console.log(`%cMAIN:`, "color: #800", message);
    });
  }

  currentSettings = await window.resolveAPI.getSettings();
  await loadAndApplyLanguage(currentSettings.language || "en");
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

  settingsButton.onclick = () => (modal.style.display = "block");
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
  document.getElementById("export-dit-report").addEventListener("click", () => {
    // This button now generates a report for the *current* timeline only.
    window.resolveAPI.exportDitReport([]);
  });
  document
    .getElementById("generate-report-button")
    .addEventListener("click", handleGenerateReportFromSelection);
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
      document.getElementById("image-count").textContent = stats.image;
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

      li.appendChild(checkbox);
      li.appendChild(label);
      timelineListEl.appendChild(li);
    });

    addDragAndDropListeners(timelineListEl);
  } catch (error) {
    console.error("Failed to populate timeline list:", error);
    timelineListEl.innerHTML = `<li>Error loading timelines.</li>`;
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

function handleGenerateReportFromSelection() {
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
    window.resolveAPI.exportDitReport(selectedTimelines);
  } else {
    alert("Please select at least one timeline.");
  }
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}
