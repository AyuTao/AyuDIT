let filePath = null;
let I18N = {};

// --- I18n ---
async function applyTranslations() {
  const settings = await window.progressAPI.getSettings();
  I18N = await window.progressAPI.loadLanguage(
    settings.language || "en",
  );
  document.querySelectorAll("[data-i18n-key]").forEach((el) => {
    const key = el.getAttribute("data-i18n-key");
    if (I18N[key]) {
      el.textContent = I18N[key];
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
    const errLabel = I18N.error || "Error";
    completionMessage.textContent = `${errLabel}: ${error}`;
    document.getElementById("open-file-btn").style.display = "none";
    document.getElementById("open-folder-btn").style.display = "none";
  } else {
    completionMessage.textContent = I18N.exportComplete || "Export Complete!";
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

// 移除进度窗日志显示，日志已写入本地 log 文件
  // render failures if any
  const failBox = document.getElementById("failures");
  if (failBox) {
    if (failures && failures.length > 0) {
      const lines = failures.slice(0, 50).map((f) => {
        const t = f.timeline ? `[${f.timeline}]` : "";
        const c = f.clip ? ` ${f.clip}` : "";
        const tc = f.timecode ? ` @ ${f.timecode}` : "";
        return `- ${t}${c}${tc}`;
      });
      if (failures.length > 50) lines.push(`... (${failures.length - 50} more)`);
      failBox.textContent = `Failed items (first ${Math.min(50, failures.length)}):\n` + lines.join("\n");
    } else {
      failBox.textContent = "";
    }
  }
