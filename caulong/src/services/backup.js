// ─── BACKUP / RESTORE ─────────────────────────────────────────────
function backupData() {
  const data = { members, sessions, exported: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  const d = new Date();
  const fname =
    "caulong-backup-" +
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0") +
    ".json";
  a.href = URL.createObjectURL(blob);
  a.download = fname;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    document.body.removeChild(a);
  }, 500);
  showToast("Backed up: " + fname);
}

function restoreData(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.members || !data.sessions) throw new Error("Invalid file");
      if (
        !(await showConfirm({
          title: "Restore data",
          message: `Restore data from file "${file.name}"?\nCurrent data will be overwritten.`,
        }))
      )
        return;
      members = data.members;
      sessions = data.sessions;
      saveMembers();
      ss("hl_sessions", sessions);
      renderSessions();
      showToast(
        "✅ Restored " +
          sessions.length +
          " sessions, " +
          members.length +
          " members",
      );
    } catch (err) {
      alert("File read error: " + err.message);
    }
    input.value = "";
  };
  reader.readAsText(file);
}

