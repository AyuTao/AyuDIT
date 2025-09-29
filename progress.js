let filePath = null;

// --- I18n ---
async function applyTranslations() {
  const settings = await window.progressAPI.getSettings();
  const i18nData = await window.progressAPI.loadLanguage(
    settings.language || "en",
  );
  document.querySelectorAll("[data-i18n-key]").forEach((el) => {
    const key = el.getAttribute("data-i18n-key");
    if (i18nData[key]) {
      el.textContent = i18nData[key];
    }
  });
}

window.addEventListener("DOMContentLoaded", () => {
  applyTranslations();
});

window.progressAPI.onProgress(({ progress }) => {
  const bar = document.getElementById("progress-bar");
  const percent = document.getElementById("progress-percent");
  const roundedProgress = Math.round(progress);
  bar.style.width = `${roundedProgress}%`;
  percent.textContent = `${roundedProgress}%`;
});

window.progressAPI.onComplete((data) => {
  filePath = data.filePath;
  const error = data.error;

  const progressContainer = document.getElementById("progress-container");
  const completionContainer = document.getElementById("completion-container");
  const completionMessage = document.getElementById("completion-message");

  if (error) {
    completionMessage.textContent = `Error: ${error}`;
    document.getElementById("open-file-btn").style.display = "none";
    document.getElementById("open-folder-btn").style.display = "none";
  } else {
    completionMessage.textContent = "Export Complete!";
  }

  progressContainer.style.display = "none";
  completionContainer.style.display = "flex";
});

document.getElementById("ok-btn").addEventListener("click", () => {
  window.progressAPI.close();
});

document.getElementById("open-file-btn").addEventListener("click", () => {
  if (filePath) {
    window.progressAPI.openFile(filePath);
  }
  window.progressAPI.close();
});

document.getElementById("open-folder-btn").addEventListener("click", () => {
  if (filePath) {
    window.progressAPI.showItem(filePath);
  }
  window.progressAPI.close();
});
