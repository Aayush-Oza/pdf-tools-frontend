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
    }

    // SINGLE FILE TOOLS
    else {
        const file = document.getElementById("fileInput").files[0];
        if (!file) return alert("Select a file");
        fd.append("file", file);
    }

    // SPLIT TOOL
    if (tool === "split-pdf") {
        const ranges = document.getElementById("rangeInput").value;
        if (!ranges) return alert("Enter page ranges");
        fd.append("ranges", ranges);
    }

    // ROTATE TOOL
    if (tool === "rotate-pdf") {
        const angle = document.getElementById("angleInput").value;
        fd.append("angle", angle);
    }

    // PASSWORD TOOLS
    if (tool === "protect-pdf" || tool === "unlock-pdf") {
        const pwd = document.getElementById("passwordInput").value;
        if (!pwd) return alert("Enter password");
        fd.append("password", pwd);
    }

    // PROGRESS BAR UI
    const wrapper = document.getElementById("progress-wrapper");
    const bar = document.getElementById("progress-bar");
    const percentText = document.getElementById("progress-percent");

    wrapper.style.display = "block";
    document.getElementById("download-btn").style.display = "none";
    bar.style.width = "0%";
    percentText.innerText = "0%";

    let progress = 0;
    let fakeLoading = setInterval(() => {
        progress += 6;
        if (progress >= 90) progress = 90;
        bar.style.width = progress + "%";
        percentText.innerText = progress + "%";
    }, 180);

    // SEND REQUEST
    const res = await fetch(`${API_BASE}/${tool}`, {
        method: "POST",
        body: fd
    });

    if (!res.ok) {
        clearInterval(fakeLoading);
        bar.style.width = "0%";
        percentText.innerText = "0%";
        alert(`Error: ${res.status}`);
        return;
    }

    // EXTRACT TEXT (special)
    if (tool === "extract-text") {
        const data = await res.json();
        clearInterval(fakeLoading);
        bar.style.width = "100%";
        percentText.innerText = "100%";
        alert(data.text);
        return;
    }

    // DOWNLOAD FILE
    const blob = await res.blob();
    clearInterval(fakeLoading);
    bar.style.width = "100%";
    percentText.innerText = "100%";

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

    const dn = document.getElementById("download-btn");
    dn.href = url;
    dn.download = fileNames[tool] || "output.pdf";
    dn.innerText = "Download File";
    dn.style.display = "block";
}
