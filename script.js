/* ============================================================
   UNIVERSAL JS FOR BOTH index.html AND tool.html
   Handles:
   ✔ Navigation
   ✔ Tool opener
   ✔ File list UI
   ✔ PDF viewer
   ✔ Image reorder (Drag & Mobile Touch)
   ✔ File processing upload → backend
============================================================ */

const API_BASE = "https://pdf-tools-backend-1.onrender.com";

/* -----------------------
   SAFE GETTER
------------------------ */
const $id = id => document.getElementById(id);

/* -----------------------
   OPEN TOOL FROM INDEX PAGE
------------------------ */
function openTool(tool) {
  window.location.href = `tool.html?tool=${tool}`;
}

/* -----------------------
   GLOBAL PAGE LOADED
------------------------ */
document.addEventListener("DOMContentLoaded", () => {
  safeWireHomePage();      // index.html
  safeWireToolPage();      // tool.html
});

/* -----------------------
   HOMEPAGE JS
------------------------ */
function safeWireHomePage() {
  const cards = document.querySelectorAll(".tool-card");
  if (cards.length) {
    cards.forEach(c => {
      c.addEventListener("click", () => {
        const tool = c.dataset.tool;
        if (tool) openTool(tool);
      });
    });
  }

  const hamburger = $id("hamburger");
  if (hamburger) {
    hamburger.onclick = () => document.body.classList.toggle("nav-open");
  }

  const themeBtn = $id("theme-btn");
  if (themeBtn) {
    themeBtn.onclick = () => document.documentElement.classList.toggle("dark-theme");
  }
}

/* -----------------------
   TOOL PAGE JS
------------------------ */
function safeWireToolPage() {
  const fileInput = $id("fileInput");
  if (!fileInput) return; // not on tool page

  const params = new URLSearchParams(window.location.search);
  const tool = params.get("tool");
  if (tool && $id("toolName")) {
    $id("toolName").innerText = tool.replace(/-/g, " ").toUpperCase();
  }

  fileInput.onchange = updateFileList;

  if (tool === "merge-pdf" || tool === "jpg-to-pdf") fileInput.multiple = true;
  if (tool === "protect-pdf" || tool === "unlock-pdf") showElem("passwordInput");
  if (tool === "split-pdf") showElem("rangeInput");
  if (tool === "rotate-pdf") showElem("angleInput");

  const viewBtn = $id("view-btn");
  if (viewBtn) viewBtn.onclick = openViewer;

  const closeBtn = $id("close-viewer");
  if (closeBtn) closeBtn.onclick = closeViewer;

  const processBtn = $id("process-btn");
  if (processBtn) processBtn.onclick = processFile;
}

function showElem(id) {
  const el = $id(id);
  if (el) el.style.display = "block";
}

/* ============================================================
   FILE LIST
============================================================ */

function updateFileList() {
  const input = $id("fileInput");
  const list = $id("fileList");
  const viewBtn = $id("view-btn");

  if (!list) return;

  list.innerHTML = "";
  if (!input.files.length) {
    list.innerHTML = "<p style='color:#777;'>No files selected</p>";
    if (viewBtn) viewBtn.style.display = "none";
    return;
  }

  if (viewBtn) viewBtn.style.display = "block";

  [...input.files].forEach((file, index) => {
    const item = document.createElement("div");
    item.className = "file-item";

    const sizeKB = Math.round(file.size / 1024);

    item.innerHTML = `
      <svg viewBox="0 0 24 24" width="20">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 
        2 0 0 0 2 2h12a2 2 0 0 
        0 2-2V8l-6-6zm1 7h5.5L15 
        3.5V9z"/>
      </svg>
      <span>${file.name}</span>
      <span>${sizeKB} KB</span>
      <button class="remove-btn" onclick="removeFile(${index})">×</button>
    `;

    list.appendChild(item);
  });
}

function removeFile(index) {
  const input = $id("fileInput");
  if (!input.files.length) return;

  const dt = new DataTransfer();
  [...input.files].forEach((f, i) => {
    if (i !== index) dt.items.add(f);
  });

  input.files = dt.files;
  updateFileList();
}

/* ============================================================
   VIEWER POPUP (PDF + IMAGES + ORDER)
============================================================ */
let galleryOrder = [];
let originalFiles = [];

function openViewer() {
  const input = $id("fileInput");
  if (!input.files.length) return;

  originalFiles = [...input.files];

  const popup = $id("pdf-viewer-popup");
  const frame = $id("pdf-frame");
  const img = $id("img-preview");
  const gallery = $id("img-gallery");
  const info = $id("viewer-info");

  popup.style.display = "flex";
  frame.style.display = img.style.display = gallery.style.display = info.style.display = "none";

  const first = originalFiles[0];

  // PDF
  if (first.type === "application/pdf") {
    frame.src = URL.createObjectURL(first);
    frame.style.display = "block";
    return;
  }

  // Multiple images
  if (originalFiles.every(f => f.type.startsWith("image/")) && originalFiles.length > 1) {
    galleryOrder = [...originalFiles];
    renderGallery(gallery);
    gallery.style.display = "block";
    return;
  }

  // Single image
  if (first.type.startsWith("image/")) {
    img.src = URL.createObjectURL(first);
    img.style.display = "block";
    return;
  }

  // Unsupported
  info.innerHTML = `
    <p><b>Preview not supported.</b></p>
    <p>${first.name}</p>
  `;
  info.style.display = "block";
}

function closeViewer() {
  const popup = $id("pdf-viewer-popup");
  popup.style.display = "none";
}

/* Render gallery (with drag reorder) */
function renderGallery(box) {
  box.innerHTML = "";
  galleryOrder.forEach((file, i) => {
    const div = document.createElement("div");
    div.className = "img-item";
    div.draggable = true;
    div.dataset.i = i;

    div.innerHTML = `
      <img src="${URL.createObjectURL(file)}" style="width:100%; border-radius:10px;">
    `;

    box.appendChild(div);
  });

  enableDrag(box);
}

/* DRAG + DROP reorder */
function enableDrag(box) {
  box.querySelectorAll(".img-item").forEach(item => {
    item.ondragstart = e => {
      e.dataTransfer.setData("i", item.dataset.i);
    };

    item.ondragover = e => e.preventDefault();

    item.ondrop = e => {
      const from = parseInt(e.dataTransfer.getData("i"));
      const to = parseInt(item.dataset.i);

      const temp = galleryOrder[from];
      galleryOrder[from] = galleryOrder[to];
      galleryOrder[to] = temp;

      applyReorder();
      renderGallery(box);
    };
  });
}

function applyReorder() {
  const dt = new DataTransfer();
  galleryOrder.forEach(f => dt.items.add(f));
  $id("fileInput").files = dt.files;
  updateFileList();
}

/* ============================================================
   PROCESS FILE
============================================================ */
async function processFile() {
  applyReorder();

  const input = $id("fileInput");
  const files = [...input.files];

  if (!files.length) return showError("Select a file");

  const params = new URLSearchParams(location.search);
  const tool = params.get("tool");

  let fd = new FormData();

  if (tool === "merge-pdf" || tool === "jpg-to-pdf") {
    files.forEach(f => fd.append("files", f));
  } else {
    fd.append("file", files[0]);
  }

  if (tool === "split-pdf") fd.append("ranges", $id("rangeInput").value);
  if (tool === "rotate-pdf") fd.append("angle", $id("angleInput").value);
  if (tool === "protect-pdf" || tool === "unlock-pdf")
    fd.append("password", $id("passwordInput").value);

  startProgress();

  try {
    const blob = await uploadFile(tool, fd);
    finishProgress(blob, tool);
  } catch {
    showError("Something went wrong.");
  }
}

/* UPLOAD with Progress */
function uploadFile(tool, fd) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/${tool}`);
    xhr.responseType = "blob";

    xhr.upload.onprogress = e => {
      if (!e.lengthComputable) return;
      let p = Math.round(e.loaded / e.total * 100);
      $id("progress-bar").style.width = p + "%";
      $id("progress-percent").innerText = p + "%";
    };

    xhr.onload = () => {
      if (xhr.status !== 200) return reject(xhr.response);
      resolve(xhr.response);
    };

    xhr.onerror = reject;
    xhr.send(fd);
  });
}

function startProgress() {
  $id("progress-wrapper").style.display = "block";
  $id("progress-bar").style.width = "0%";
  $id("progress-percent").innerText = "0%";
  $id("download-btn").style.display = "none";
  $id("status-msg").style.display = "none";
}

function finishProgress(blob, tool) {
  showSuccess("File ready!");

  const link = $id("download-btn");
  const url = URL.createObjectURL(blob);

  const fileNames = {
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

  link.href = url;
  link.download = fileNames[tool] || "output.pdf";
  link.style.display = "flex";
}

/* ============================================================
   MESSAGE HELPERS
============================================================ */
function showError(msg) {
  const box = $id("status-msg");
  box.className = "error-msg";
  box.innerText = msg;
  box.style.display = "block";
}

function showSuccess(msg) {
  const box = $id("status-msg");
  box.className = "success-msg";
  box.innerText = msg;
  box.style.display = "block";
}
