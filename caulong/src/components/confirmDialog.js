// ─── CUSTOM CONFIRM DIALOG (thay cho confirm() mặc định của trình duyệt) ──
// showConfirm({title, message, yesText, noText, tone}) → Promise<boolean>
// tone: 'danger' (mặc định, icon đỏ) | 'info' (icon xanh)
function showConfirm(opts) {
  const {
    title = "Xác nhận",
    message = "",
    yesText = "Yes!",
    noText = "No, keep it",
    tone = "danger",
  } = typeof opts === "string" ? { message: opts } : opts || {};
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "confirm-backdrop";
    backdrop.innerHTML = `
      <div class="confirm-box">
        <div class="confirm-hd">
          <div class="confirm-icon-wrap ${tone === "info" ? "info" : ""}">
            <div class="diamond"></div>
            <div class="mark">!</div>
          </div>
          <div class="confirm-title">${esc(title)}</div>
        </div>
        <div class="confirm-msg">${esc(message)}</div>
        <div class="confirm-actions">
          <button class="confirm-btn confirm-btn-no" type="button">${esc(noText)}</button>
          <button class="confirm-btn confirm-btn-yes" type="button">${esc(yesText)}</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);
    let done = false;
    const finish = (val) => {
      if (done) return;
      done = true;
      document.removeEventListener("keydown", onKey);
      backdrop.remove();
      resolve(val);
    };
    const onKey = (e) => {
      if (e.key === "Escape") finish(false);
      if (e.key === "Enter") finish(true);
    };
    document.addEventListener("keydown", onKey);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) finish(false);
    });
    backdrop.querySelector(".confirm-btn-yes").onclick = () => finish(true);
    backdrop.querySelector(".confirm-btn-no").onclick = () => finish(false);
    backdrop.querySelector(".confirm-btn-yes").focus();
  });
}

// Jira-styled input prompt (used for admin code entry) — replaces native prompt().
// Returns the entered string, or null if cancelled/closed.
function showPrompt(opts) {
  const {
    title = "Brian Access",
    label = "",
    placeholder = "",
    confirmText = "Log in",
    cancelText = "Cancel",
  } = opts || {};
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "jira-prompt-backdrop";
    backdrop.innerHTML = `
      <div class="jira-prompt-box">
        <div class="jira-prompt-hd">
          <span class="jira-prompt-title">${esc(title)}</span>
          <button type="button" class="jira-prompt-close" aria-label="Close">×</button>
        </div>
        <div class="jira-prompt-bd">
          ${label ? `<label class="jira-prompt-label">${esc(label)}</label>` : ""}
          <input type="text" class="jira-prompt-input" placeholder="${esc(placeholder)}" autocomplete="off">
        </div>
        <div class="jira-prompt-ft">
          <button type="button" class="jira-btn jira-btn-secondary">${esc(cancelText)}</button>
          <button type="button" class="jira-btn jira-btn-primary">${esc(confirmText)}</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);
    const input = backdrop.querySelector(".jira-prompt-input");
    let done = false;
    const finish = (val) => {
      if (done) return;
      done = true;
      document.removeEventListener("keydown", onKey);
      backdrop.remove();
      resolve(val);
    };
    const onKey = (e) => {
      if (e.key === "Escape") finish(null);
      if (e.key === "Enter") finish(input.value);
    };
    document.addEventListener("keydown", onKey);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) finish(null);
    });
    backdrop.querySelector(".jira-prompt-close").onclick = () => finish(null);
    backdrop.querySelector(".jira-btn-secondary").onclick = () => finish(null);
    backdrop.querySelector(".jira-btn-primary").onclick = () =>
      finish(input.value);
    setTimeout(() => input.focus(), 30);
  });
}

