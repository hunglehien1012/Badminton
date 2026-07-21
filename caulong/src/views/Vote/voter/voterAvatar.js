// ─── OPTIONAL VOTER AVATAR (shown next to their name/votes) ──────
// Resizes+compresses the picked image client-side to a small square JPEG so it
// stays lightweight in the Firebase Realtime Database (no separate Storage needed).
function compressImageFile(file, maxDim = 128, quality = 0.7) {
  return new Promise((resolve, reject) => {
    if (!file.type || !file.type.startsWith("image/")) {
      reject(new Error("Please choose an image file"));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Couldn't read that image"));
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = maxDim;
        canvas.height = maxDim;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, sx, sy, side, side, 0, 0, maxDim, maxDim);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function pickVoterAvatar() {
  const inp = document.getElementById("vv-avatar-input");
  if (inp) inp.click();
}

async function onVoterAvatarSelected(inputEl) {
  const file = inputEl.files && inputEl.files[0];
  inputEl.value = ""; // reset so picking the same file again still fires change
  if (!file) return;
  try {
    const dataUrl = await compressImageFile(file, 128, 0.7);
    if (dataUrl.length > 150000) {
      showToast("That photo is too large — try a simpler/smaller image");
      return;
    }
    ss("hl_voter_avatar", dataUrl); // cached locally so future polls reuse it automatically
    const lockedName = (ls("hl_voter_locked_name") || "").trim();
    if (voterPid && fbReady() && lockedName) {
      const devId = effectiveDevId(voterPid);
      const existing =
        (voterPoll && voterPoll.votes && voterPoll.votes[devId]) || null;
      await fdb.ref(POLLS_ROOT + "/" + voterPid + "/votes/" + devId).set({
        name: lockedName,
        choices: voteChoices(existing),
        at: existing ? existing.at || Date.now() : Date.now(),
        nameKey: nameKey(lockedName),
        avatar: dataUrl,
      });
    }
    showToast("Photo updated");
    renderVoterView();
  } catch (err) {
    console.error(err);
    showToast(err.message || "Couldn't process that photo");
  }
}

async function removeVoterAvatar() {
  try {
    localStorage.removeItem("hl_voter_avatar");
  } catch {}
  const lockedName = (ls("hl_voter_locked_name") || "").trim();
  if (voterPid && fbReady() && lockedName) {
    const devId = effectiveDevId(voterPid);
    const existing =
      (voterPoll && voterPoll.votes && voterPoll.votes[devId]) || null;
    if (existing) {
      await fdb
        .ref(POLLS_ROOT + "/" + voterPid + "/votes/" + devId + "/avatar")
        .remove();
    }
  }
  showToast("Photo removed");
  renderVoterView();
}

