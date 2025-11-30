const API_BASE = "https://pdf-tools-backend-1.onrender.com";

// -----------------------------------------------------
// Open Tool Page
// -----------------------------------------------------
function openTool(tool) {
    window.location.href = `tool.html?tool=${tool}`;
}

// -----------------------------------------------------
// Get Tool Name From URL
// -----------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {

    const params = new URLSearchParams(window.location.search);
    const tool = params.get("tool");

    // Set tool title
    if (tool && document.getElementById("toolName")) {
        document.getElementById("toolName").innerText =
            tool.replace(/-/g, " ").toUpperCase();
    }

    // File input exists only on tool.html
    const fileInput = document.getElementById("fileInput");
    if (fileInput) {

        // Show file list on change
        fileInput.addEventListener("change", updateFileList);

        // Configure special inputs based on tool
        if (tool === "merge-pdf" || tool === "jpg-to-pdf") {
            fileInput.multiple = true;
        }

        if (tool === "protect-pdf" || tool === "unlock-pdf") {
            document.getElementById("passwordInput").style.display = "block";
        }

        if (tool === "split-pdf") {
            document.getElementById("rangeInput").style.display = "block";
        }

        if (tool === "rotate-pdf") {
            document.getElementById("angleInput").style.display = "block";
        }
    }
});

// -----------------------------------------------------
// File List UI
// -----------------------------------------------------
function updateFileList() {
    const input = document.getElementById("fileInput");
    const list = document.getElementById("fileList");

    if (!input || !list) return;

    list.innerHTML = "";

    if (!input.files.length) {
        list.innerHTML = "<p style='color:#777;'>No files selected</p>";
        return;
    }

    [...input.files].forEach((file, index) => {
        const item = document.createElement("div");
        item.className = "file-item";

        item.innerHTML = `
            <svg viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 
              2 0 0 0 2 2h12a2 2 0 0 
              0 2-2V8l-6-6zm1 7h5.5L15 
              3.5V9z"/>
            </svg>

            <span class="file-name">${file.name}</span>

            <button class="remove-btn" onclick="removeFile(${index})">×</button>
        `;

        list.appendChild(item);
    });
}

function removeFile(index) {
    const input = document.getElementById("fileInput");
    if (!input) return;

    const dt = new DataTransfer();
    let files = [...input.files];

    files.splice(index, 1);

    files.forEach(f => dt.items.add(f));
    input.files = dt.files;

    updateFileList();
}

// -----------------------------------------------------
// Process File — with Progress Loader
// -----------------------------------------------------
async function processFile() {
    const params = new URLSearchParams(window.location.search);
    const tool = params.get("tool");

    let fd = new FormData();

    // MULTIPLE FILE TOOLS
    if (tool === "merge-pdf" || tool === "jpg-to-pdf") {
        const files = document.getElementById("fileInput").files;
        if (!files.length) return alert("Select at least one file");
        if (tool === "merge-pdf" && files.length < 2)
            return alert("Select at least 2 PDFs");
        for (let f of files) fd.append("files", f);
    } else {
        const file = document.getElementById("fileInput").files[0];
        if (!file) return alert("Select a file");
        fd.append("file", file);
    }

    // OTHER TOOL FIELDS
    if (tool === "split-pdf") fd.append("ranges", document.getElementById("rangeInput").value);
    if (tool === "rotate-pdf") fd.append("angle", document.getElementById("angleInput").value);
    if (tool === "protect-pdf" || tool === "unlock-pdf")
        fd.append("password", document.getElementById("passwordInput").value);

    // PROGRESS BAR UI
    const wrapper = document.getElementById("progress-wrapper");
    const bar = document.getElementById("progress-bar");
    const percent = document.getElementById("progress-percent");
    const downloadBtn = document.getElementById("download-btn");

    wrapper.style.display = "block";
    bar.style.width = "0%";
    percent.innerText = "0%";
    downloadBtn.style.display = "none";

    return new Promise((resolve, reject) => {
        let xhr = new XMLHttpRequest();

        xhr.open("POST", `${API_BASE}/${tool}`);
        xhr.responseType = "blob";

        // Fast REAL upload progress
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                let p = Math.round((e.loaded / e.total) * 100);
                bar.style.width = p + "%";
                percent.innerText = p + "%";
            }
        };

        xhr.onload = function () {
            if (xhr.status !== 200) {
                alert("Error: " + xhr.status);
                return reject(xhr.status);
            }

            // Complete progress
            bar.style.width = "100%";
            percent.innerText = "100%";

            let blob = xhr.response;
            let url = URL.createObjectURL(blob);

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

            downloadBtn.href = url;
            downloadBtn.download = fileNames[tool] || "output.pdf";
            downloadBtn.style.display = "block";

            resolve();
        };

        xhr.onerror = () => {
            alert("Network error");
            reject();
        };

        xhr.send(fd);
    });
}
