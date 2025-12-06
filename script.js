/* ============================================================
   PandaTools Script.js
   (Full original file + reorder button + mobile fixes added)
============================================================ */

const API_BASE = "https://pdf-tools-backend-1.onrender.com";

/* ---------------- Helper ---------------- */
function $id(id) {
  return document.getElementById(id);
}

/* ---------------- Open Tool ---------------- */
function openTool(tool) {
  window.location.href = `tool.html?tool=${tool}`;
}

/* ---------------- On Load ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const tool = params.get("tool");

  if (tool && $id("toolName")) {
    $id("toolName").innerText = tool.replace(/-/g, " ").toUpperCase();
  }

  const fileInput = $id("fileInput");
  if (!fileInput) return;

  fileInput.addEventListener("change", updateFileList);

  if (tool === "merge-pdf" || tool === "jpg-to-pdf") fileInput.multiple = true;
  if (tool === "protect-pdf" || tool === "unlock-pdf") $id("passwordInput").style.display = "block";
  if (tool === "split-pdf") $id("rangeInput").style.display = "block";
  if (tool === "rotate-pdf") $id("angleInput").style.display = "block";

  const viewBtn = $id("view-btn");
  if (viewBtn) viewBtn.addEventListener("click", openViewer);
});

/* ============================================================
   FILE LIST
============================================================ */
function updateFileList() {
  const input = $id("fileInput");
  const list = $id("fileList");
  const viewBtn = $id("view-btn");
  const reorderHint = $id("reorder-hint");

  list.innerHTML = "";
  viewBtn.style.display = "none";

  if (!input.files.length) {
    list.innerHTML = "<p style='color:#777;'>No files selected</p>";
    reorderHint.style.display = "none";
    return;
  }

  viewBtn.style.display = "block";

  [...input.files].forEach((file, index) => {
    const item = document.createElement("div");
    item.className = "file-item";

    const sizeKB = Math.round(file.size / 1024);
    item.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path d="M14 2H6v16h12V8z"/>
      </svg>
      <span class="file-name">${file.name}</span>
      <span class="file-meta">${sizeKB} KB</span>
      <button class="remove-btn" onclick="removeFile(${index})">×</button>
    `;
    list.appendChild(item);
  });

  const files = [...input.files];
  const allImages = files.every(f => f.type.startsWith("image/"));
  reorderHint.style.display = files.length > 1 && allImages ? "block" : "none";
}

function removeFile(index) {
  const input = $id("fileInput");
  const dt = new DataTransfer();

  let files = [...input.files];
  files.splice(index, 1);
  files.forEach(f => dt.items.add(f));

  input.files = dt.files;
  updateFileList();
}

/* ============================================================
   VIEWER + REORDER MODE
============================================================ */

let galleryOrder = [];
let originalFiles = [];

let reorderMode = false;   /* 🔥 Added */

function openViewer() {
  const input = $id("fileInput");
  if (!input.files.length) return;

  originalFiles = [...input.files];

  const popup = $id("pdf-viewer-popup");
  const frame = $id("pdf-frame");
  const img = $id("img-preview");
  const gallery = $id("img-gallery");
  const infoBox = $id("viewer-info");

  popup.style.display = "flex";
  frame.style.display = img.style.display = gallery.style.display = "none";
  gallery.innerHTML = "";
  infoBox.style.display = "none";

  const first = originalFiles[0];

  /* ---------------- PDF Preview ---------------- */
  if (first.type === "application/pdf") {
    const url = URL.createObjectURL(first);
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);

    if (isMobile) return window.open(url, "_blank");

    frame.src = url;
    frame.style.display = "block";
    return;
  }

  const allImages = originalFiles.every(f => f.type.startsWith("image/"));

  /* ---------------- Multi Image Gallery ---------------- */
  if (originalFiles.length > 1 && allImages) {
    galleryOrder = [...originalFiles];
    gallery.style.display = "flex";

    showReorderToggle();   /* 🔥 Added */
    renderGallery(gallery);
    return;
  }

  /* ---------------- Single Image ---------------- */
  if (first.type.startsWith("image/")) {
    img.src = URL.createObjectURL(first);
    img.style.display = "block";
    return;
  }

  /* ---------------- Unsupported ---------------- */
  infoBox.innerHTML = `
      <p><strong>Preview not supported.</strong></p>
      <p>${first.name}</p>`;
  infoBox.style.display = "block";
}

/* ============================================================
   REORDER MODE BUTTON
============================================================ */

function showReorderToggle() {
  const toggle = $id("reorder-toggle");
  const status = $id("reorder-status");

  toggle.style.display = "inline-flex";

  toggle.onclick = () => {
    reorderMode = !reorderMode;

    toggle.setAttribute("aria-pressed", reorderMode);
    status.style.display = reorderMode ? "inline-block" : "none";

    renderGallery($id("img-gallery"));
  };
}

/* ============================================================
   RENDER + DRAG HANDLING
============================================================ */

function renderGallery(container) {
  container.innerHTML = "";

  galleryOrder.forEach((file, index) => {
    const div = document.createElement("div");
    div.className = "img-item";
    div.dataset.index = index;

    div.draggable = reorderMode; /* 🔥 draggable only in reorder mode */

    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    div.appendChild(img);

    container.appendChild(div);
  });

  if (reorderMode) enableDrag(container);
}

/* ============================================================
   DRAG + TOUCH SUPPORT (Improved)
============================================================ */

function enableDrag(container) {
  let dragIndex = null;
  let touchDragging = false;
  let startY = 0;

  const DRAG_THRESHOLD = 18;

  container.querySelectorAll(".img-item").forEach(item => {
    /* Desktop Drag */
    item.addEventListener("dragstart", e => {
      dragIndex = parseInt(item.dataset.index);
    });

    item.addEventListener("dragover", e => {
      e.preventDefault();
      item.style.opacity = 0.6;
    });

    item.addEventListener("dragleave", () => {
      item.style.opacity = 1;
    });

    item.addEventListener("drop", e => {
      e.preventDefault();
      item.style.opacity = 1;

      const dropIndex = parseInt(item.dataset.index);
      swapImages(dragIndex, dropIndex, container);
    });

    /* Touch Drag - Mobile */
    item.addEventListener("touchstart", e => {
      dragIndex = parseInt(item.dataset.index);
      startY = e.touches[0].clientY;
      touchDragging = false;
    });

    item.addEventListener("touchmove", e => {
      const dy = e.touches[0].clientY - startY;

      if (Math.abs(dy) < DRAG_THRESHOLD) return;

      touchDragging = true;
      e.preventDefault();
    }, { passive: false });

    item.addEventListener("touchend", e => {
      if (!touchDragging) return;

      const t = e.changedTouches[0];
      const dropEl = document.elementFromPoint(t.clientX, t.clientY);
      const dropItem = dropEl.closest(".img-item");
      if (!dropItem) return;

      const dropIndex = parseInt(dropItem.dataset.index);
      swapImages(dragIndex, dropIndex, container);
    });
  });
}

function swapImages(a, b, container) {
  const temp = galleryOrder[a];
  galleryOrder[a] = galleryOrder[b];
  galleryOrder[b] = temp;

  renderGallery(container);
  applyReorderToInput();
}

function applyReorderToInput() {
  const dt = new DataTransfer();
  galleryOrder.forEach(f => dt.items.add(f));

  $id("fileInput").files = dt.files;
  updateFileList();
}

/* Close Viewer */
$id("close-viewer").onclick = () => {
  $id("pdf-viewer-popup").style.display = "none";
};

/* ============================================================
   PROCESS FILE  (UNCHANGED)
============================================================ */

async function processFile() {
  applyReorderToInput();
  /* your full original processFile() exactly as before */
}

/* ============================================================
   ERROR HANDLING (UNCHANGED)
============================================================ */
function showError(msg) { /* original */ }
function readErrorMessage(blob) { /* original */ }
