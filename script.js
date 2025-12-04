/* tool.js — Rewritten: Viewer + Smooth Reorder (no full refresh, AJAX-friendly) */

const API_BASE = "https://pdf-tools-backend-1.onrender.com";

/* ---------- Helpers ---------- */
function $id(id){ return document.getElementById(id); }
function isMobileUA(){ return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent); }

/* ---------- State ---------- */
let galleryOrder = [];      // array of File objects in current order (images)
let originalFiles = [];     // snapshot of files when opening viewer

/* -------------------------------------------------------
   Init
------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const tool = params.get("tool");

  if (tool && $id("toolName")) {
    $id("toolName").innerText = tool.replace(/-/g," ").toUpperCase();
  }

  const fileInput = $id("fileInput");
  if (!fileInput) return;

  fileInput.addEventListener("change", updateFileList);

  if (tool === "merge-pdf" || tool === "jpg-to-pdf") fileInput.multiple = true;

  if (tool === "protect-pdf" || tool === "unlock-pdf") {
    const pw = $id("passwordInput");
    if (pw) pw.style.display = "block";
  }
  if (tool === "split-pdf") {
    const r = $id("rangeInput");
    if (r) r.style.display = "block";
  }
  if (tool === "rotate-pdf") {
    const a = $id("angleInput");
    if (a) a.style.display = "block";
  }

  const viewBtn = $id("view-btn");
  if (viewBtn) viewBtn.addEventListener("click", openViewer);

  const closeBtn = $id("close-viewer");
  if (closeBtn) closeBtn.addEventListener("click", closeViewer);

  const reorderToggle = $id("reorder-toggle");
  if (reorderToggle) reorderToggle.addEventListener("click", toggleReorderMode);
});

/* -------------------------------------------------------
   File List UI — creates items with a stable uid
   (so we can reorder DOM nodes later without full refresh)
------------------------------------------------------- */
function updateFileList(){
  const input = $id("fileInput");
  const list = $id("fileList");
  const viewBtn = $id("view-btn");
  const reorderHint = $id("reorder-hint");

  if (!input || !list) return;
  list.innerHTML = "";
  if (viewBtn) viewBtn.style.display = "none";

  if (!input.files || !input.files.length) {
    list.innerHTML = "<p style='color:#777;'>No files selected</p>";
    if (reorderHint) reorderHint.style.display = "none";
    return;
  }

  // ensure view button visible
  if (viewBtn) viewBtn.style.display = "block";

  // For each File we assign a stable uid (if not already assigned)
  [...input.files].forEach((file, index) => {
    // attach a uid to the File object so we can identify it later
    if (!file._uid) {
      file._uid = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}_${index}`;
    }

    const sizeKB = Math.round(file.size / 1024);
    const item = document.createElement("div");
    item.className = "file-item";
    item.dataset.uid = file._uid;
    item.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 
        2 0 0 0 2 2h12a2 2 0 0 
        0 2-2V8l-6-6zm1 7h5.5L15 
        3.5V9z"/>
      </svg>

      <span class="file-name">${escapeHtml(file.name)}</span>
      <span class="file-meta">${sizeKB} KB</span>

      <button class="remove-btn" data-remove-index="${index}">×</button>
    `;
    list.appendChild(item);
  });

  // remove buttons wired (delegation would be better but this is direct)
  list.querySelectorAll(".remove-btn").forEach(btn => {
    btn.onclick = (e) => {
      // find the index from current input.files (we need up-to-date index)
      const idx = parseInt(btn.getAttribute("data-remove-index"), 10);
      removeFile(idx);
    };
  });

  // show hint only if multiple images
  if (reorderHint) {
    const files = [...input.files];
    const allImages = files.every(f => f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(f.name));
    if (files.length > 1 && allImages) reorderHint.style.display = "block";
    else reorderHint.style.display = "none";
  }
}

/* tiny safe escape for file names when injecting HTML */
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, (m)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

/* Remove file at index from input (keeps uid properties on remaining files) */
function removeFile(index){
  const input = $id("fileInput");
  if (!input || !input.files) return;

  const dt = new DataTransfer();
  const files = [...input.files];
  files.splice(index, 1);
  files.forEach(f => dt.items.add(f));
  input.files = dt.files;

  // update file-list DOM without full reload: rebuild list (cheap but stable)
  updateFileList();
}

/* -------------------------------------------------------
   Viewer: open viewer popup (pdf, single image, multiple images)
------------------------------------------------------- */
function openViewer(){
  const input = $id("fileInput");
  if (!input || !input.files || !input.files.length) return;

  originalFiles = [...input.files];

  const popup = $id("pdf-viewer-popup");
  const frame = $id("pdf-frame");
  const img = $id("img-preview");
  const gallery = $id("img-gallery");
  const infoBox = $id("viewer-info");
  const reorderToggle = $id("reorder-toggle");
  const reorderStatus = $id("reorder-status");

  if (!popup) return;
  popup.style.display = "flex";
  popup.setAttribute("aria-hidden","false");

  // reset inner states
  if (frame) frame.style.display = "none";
  if (img) { img.style.display = "none"; img.src = ""; }
  if (gallery) { gallery.style.display = "none"; gallery.innerHTML = ""; }
  if (infoBox) { infoBox.style.display = "none"; infoBox.innerHTML = ""; }

  if (reorderToggle) { reorderToggle.style.display = "none"; reorderToggle.setAttribute("aria-pressed","false"); }
  if (reorderStatus) reorderStatus.style.display = "none";

  const first = originalFiles[0];

  if (first.type === "application/pdf") {
    const blobURL = URL.createObjectURL(first);
    if (isMobileUA()) {
      window.open(blobURL, "_blank");
      return;
    }
    if (frame) {
      frame.style.display = "block";
      try { frame.src = blobURL; } catch (err) {
        if (infoBox) { infoBox.style.display = "block"; infoBox.innerHTML = `<p>Could not preview PDF: ${first.name}</p>`; }
      }
    }
    return;
  }

  // multiple images -> gallery
  const allImages = originalFiles.every(f => f.type.startsWith("image/"));
  if (originalFiles.length > 1 && allImages) {
    if (!gallery) return;
    gallery.style.display = "flex";
    // ensure each File has a _uid (updateFileList creates if needed)
    originalFiles.forEach((f, i) => { if (!f._uid) f._uid = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}_${i}`; });
    galleryOrder = [...originalFiles];
    renderGallery(gallery);

    // show reorder toggle + hint
    if (reorderToggle) reorderToggle.style.display = "inline-flex";
    if (reorderStatus) { reorderStatus.style.display = "inline-block"; reorderStatus.innerText = "Reorder is OFF"; }
    return;
  }

  // single image
  if (first.type.startsWith("image/")) {
    if (img) {
      img.src = URL.createObjectURL(first);
      img.style.display = "block";
    }
    return;
  }

  // other file types
  if (infoBox) {
    infoBox.style.display = "block";
    infoBox.innerHTML = `<div style="padding:12px;"><p><strong>Preview not supported</strong></p><p>${first.name}</p></div>`;
  }
}

/* Render gallery rows (does not touch file input) */
function renderGallery(container){
  container.innerHTML = "";
  container.style.display = "flex";
  container.style.flexDirection = "column";

  galleryOrder.forEach((file, idx) => {
    const row = document.createElement("div");
    row.className = "img-item";
    row.dataset.uid = file._uid || "";
    row.dataset.index = idx;
    row.draggable = true;

    // image element
    const img = document.createElement("img");
    img.alt = file.name || `image-${idx}`;
    img.src = URL.createObjectURL(file);
    img.style.width = "100%";
    img.style.height = "auto";
    img.style.maxHeight = "none";
    img.style.objectFit = "contain";

    row.appendChild(img);
    container.appendChild(row);
  });

  // attach drag handlers (works only when reorder mode ON)
  enableDrag(container);
}

/* -------------------------------------------------------
   Drag / Touch handlers
   - Better touch handling with threshold
   - Does NOT automatically reorder unless user performs drag
------------------------------------------------------- */
let reorderMode = false; // toggle via reorder button

function enableDrag(container){
  const items = container.querySelectorAll(".img-item");
  // remove old listeners by cloning nodes (simple cleanup)
  items.forEach(node => {
    const clone = node.cloneNode(true);
    node.parentNode.replaceChild(clone, node);
  });

  container.querySelectorAll(".img-item").forEach(item => {
    // DESKTOP drag
    item.addEventListener("dragstart", e => {
      if (!reorderMode) { e.preventDefault(); return; }
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", item.dataset.uid || item.dataset.index);
      item.classList.add("dragging");
    });

    item.addEventListener("dragover", e => {
      if (!reorderMode) return;
      e.preventDefault();
      item.style.opacity = "0.6";
    });

    item.addEventListener("dragleave", () => {
      item.style.opacity = "1";
    });

    item.addEventListener("drop", e => {
      if (!reorderMode) return;
      e.preventDefault();
      const fromUid = e.dataTransfer.getData("text/plain");
      const toUid = item.dataset.uid;
      if (!fromUid || !toUid) return;
      const fromIndex = galleryOrder.findIndex(f => f._uid === fromUid);
      const toIndex = galleryOrder.findIndex(f => f._uid === toUid);
      if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
        swapImages(fromIndex, toIndex);
      }
      item.style.opacity = "1";
    });

    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
    });

    // TOUCH - simple: detect vertical movement > threshold -> consider drag
    let touchStartY = 0, touchMoved = false;
    const THRESH = 12;

    item.addEventListener("touchstart", e => {
      if (!reorderMode) return;
      touchStartY = e.touches[0].clientY;
      touchMoved = false;
      item.classList.add("dragging");
    }, { passive: true });

    item.addEventListener("touchmove", e => {
      if (!reorderMode) return;
      const dy = e.touches[0].clientY - touchStartY;
      if (Math.abs(dy) > THRESH) touchMoved = true;
      // we do not call preventDefault here globally — reorderMode will handle body overflow when toggled
    }, { passive: true });

    item.addEventListener("touchend", e => {
      if (!reorderMode) { item.classList.remove("dragging"); return; }
      item.classList.remove("dragging");
      if (!touchMoved) return;

      // determine drop target
      const t = e.changedTouches[0];
      const dropEl = document.elementFromPoint(t.clientX, t.clientY);
      const dropItem = dropEl ? dropEl.closest(".img-item") : null;
      if (!dropItem) return;
      const fromUid = item.dataset.uid;
      const toUid = dropItem.dataset.uid;
      const fromIndex = galleryOrder.findIndex(f => f._uid === fromUid);
      const toIndex = galleryOrder.findIndex(f => f._uid === toUid);
      if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
        swapImages(fromIndex, toIndex);
      }
    }, { passive: true });
  });
}

/* swap helper: updates galleryOrder, re-renders gallery, updates input and DOM file list without full refresh */
function swapImages(a, b){
  const tmp = galleryOrder[a];
  galleryOrder[a] = galleryOrder[b];
  galleryOrder[b] = tmp;

  // re-render gallery quickly
  const gallery = $id("img-gallery");
  if (gallery) renderGallery(gallery);

  // apply order to the <input> and update file-list DOM (without full rebuild)
  applyReorderToInput();
}

/* -------------------------------------------------------
   applyReorderToInput
   - updates the real file input via DataTransfer
   - reorders the file-list DOM by uid (no full updateFileList call)
------------------------------------------------------- */
function applyReorderToInput(){
  if (!galleryOrder || !galleryOrder.length) return;

  const dt = new DataTransfer();
  galleryOrder.forEach(f => dt.items.add(f));
  const fileInput = $id("fileInput");
  if (!fileInput) return;
  fileInput.files = dt.files;

  // Reorder the visible file-list DOM based on uid (keep other attributes intact)
  const list = $id("fileList");
  if (!list) return;

  // Build uid -> node map (for efficient reorder)
  const nodes = Array.from(list.children).filter(n => n.dataset && n.dataset.uid);
  const uidToNode = {};
  nodes.forEach(n => { uidToNode[n.dataset.uid] = n; });

  // Append nodes in new order - missing nodes (non-images) are left as-is
  galleryOrder.forEach((f, idx) => {
    const uid = f._uid;
    const node = uidToNode[uid];
    if (node) {
      list.appendChild(node); // moves node to end in this new order sequence
      // update remove-index attributes to be consistent (optional)
      const removeBtn = node.querySelector(".remove-btn");
      if (removeBtn) removeBtn.setAttribute("data-remove-index", idx);
    }
  });

  // For any remaining nodes (non-image files or unmatched), keep their relative order
}

/* -------------------------------------------------------
   Reorder toggle: prevents accidental scroll-based reorder on mobile
   When ON: block body scroll, set reorderMode true
   When OFF: restore body scroll
------------------------------------------------------- */
function toggleReorderMode(){
  const popupInner = document.querySelector(".popup-inner");
  const reorderToggle = $id("reorder-toggle");
  const reorderStatus = $id("reorder-status");

  reorderMode = !reorderMode;
  if (reorderMode){
    // enable reorder
    document.body.style.overflow = "hidden"; // stop background scroll
    if (popupInner) popupInner.classList.add("reorder-mode");
    if (reorderToggle) reorderToggle.setAttribute("aria-pressed","true");
    if (reorderStatus) reorderStatus.innerText = "Reorder is ON — drag items";
  } else {
    // disable reorder
    document.body.style.overflow = "";
    if (popupInner) popupInner.classList.remove("reorder-mode");
    if (reorderToggle) reorderToggle.setAttribute("aria-pressed","false");
    if (reorderStatus) reorderStatus.innerText = "Reorder is OFF";
  }
}

/* -------------------------------------------------------
   Close viewer
------------------------------------------------------- */
function closeViewer(){
  const popup = $id("pdf-viewer-popup");
  if (!popup) return;
  popup.style.display = "none";
  popup.setAttribute("aria-hidden","true");

  // cleanup iframe
  const frame = $id("pdf-frame");
  if (frame) frame.src = "";

  // restore scrolling and turn off reorder if needed
  if (reorderMode) toggleReorderMode();
}

/* -------------------------------------------------------
   Process file (upload) — uses XHR (keeps your UI)
   unchanged but wrapped in async promise as before.
------------------------------------------------------- */
async function processFile(){
  // ensure current order applied before sending
  // (if galleryOrder exists, apply; else apply from input directly)
  if (galleryOrder && galleryOrder.length) applyReorderToInput();

  const params = new URLSearchParams(window.location.search);
  const tool = params.get("tool");

  let fd = new FormData();
  const input = $id("fileInput");
  const inputFiles = input && input.files ? [...input.files] : [];

  if (tool === "merge-pdf" || tool === "jpg-to-pdf") {
    if (!inputFiles.length) return showError("Please select files.");
    inputFiles.forEach(f => fd.append("files", f));
  } else {
    const f = inputFiles[0];
    if (!f) return showError("Please select a file.");
    fd.append("file", f);
  }

  if (tool === "split-pdf") fd.append("ranges", $id("rangeInput").value);
  if (tool === "rotate-pdf") fd.append("angle", $id("angleInput").value);
  if (tool === "protect-pdf" || tool === "unlock-pdf") fd.append("password", $id("passwordInput").value);

  const wrapper = $id("progress-wrapper");
  const bar = $id("progress-bar");
  const percent = $id("progress-percent");
  const downloadBtn = $id("download-btn");
  const msgBox = $id("status-msg");

  if (wrapper) wrapper.style.display = "block";
  if (bar) bar.style.width = "0%";
  if (percent) percent.innerText = "0%";
  if (downloadBtn) downloadBtn.style.display = "none";
  if (msgBox) msgBox.style.display = "none";

  return new Promise((resolve, reject) => {
    let xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/${tool}`);
    xhr.responseType = "blob";

    xhr.upload.onprogress = e => {
      if (!e.lengthComputable) return;
      const p = Math.round((e.loaded / e.total) * 100);
      if (bar) bar.style.width = p + "%";
      if (percent) percent.innerText = p + "%";
    };

    xhr.onload = () => {
      if (xhr.status !== 200) {
        readErrorMessage(xhr.response);
        return reject();
      }

      if (bar) bar.style.width = "100%";
      if (percent) percent.innerText = "100%";

      const blob = xhr.response;
      const url = URL.createObjectURL(blob);

      const names = {
        "pdf-to-word": "output.docx",
        "pdf-to-jpg": "output.jpg",
        "jpg-to-pdf": "output.pdf",
        "merge-pdf": "merged.pdf",
        "split-pdf": "split.zip",
        "rotate-pdf": "rotated.pdf",
        "compress-pdf": "compressed.pdf",
        "word-to-pdf": "output.pdf",
        "ppt-to-pdf": "output.pdf",
        "extract-text": "output.txt"
      };

      if (downloadBtn) {
        downloadBtn.href = url;
        downloadBtn.download = names[tool] || "output.pdf";
        downloadBtn.textContent = "⬇️ Download File";
        downloadBtn.style.display = "flex";
      }

      resolve();
    };

    xhr.onerror = () => {
      showError("Network error. Try again.");
      reject();
    };

    xhr.send(fd);
  });
}

/* -------------------------------------------------------
   Error helpers
------------------------------------------------------- */
function showError(msg){
  const msgBox = $id("status-msg");
  if (!msgBox) return;
  msgBox.className = "error-msg";
  msgBox.innerText = "⚠️ " + msg;
  msgBox.style.display = "block";
}

function readErrorMessage(blob){
  if (!blob) {
    showError("Something went wrong.");
    return;
  }
  let reader = new FileReader();
  reader.onload = () => {
    let text = reader.result || "";
    let match = text.match(/<p>(.*?)<\/p>/i);
    if (match && match[1]) return showError(match[1]);

    let clean = text.replace(/<[^>]+>/g,"").trim();
    if (clean.length) return showError(clean);

    showError("Something went wrong.");
  };
  reader.readAsText(blob);
}
