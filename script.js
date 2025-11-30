const API_BASE = "https://pdf-tools-backend-1.onrender.com";

// -----------------------------------------------------
// Load Tool Name
// -----------------------------------------------------
function openTool(tool) {
    window.location.href = `tool.html?tool=${tool}`;
}

const params = new URLSearchParams(window.location.search);
const tool = params.get("tool");

if (tool && document.getElementById("toolName")) {
    document.getElementById("toolName").innerText =
        tool.replace(/-/g, " ").toUpperCase();
}

// -----------------------------------------------------
// Show/Hide Inputs Based on Tool
// -----------------------------------------------------
if (tool === "merge-pdf" || tool === "jpg-to-pdf") {
    document.getElementById("fileInput").multiple = true;
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

// -----------------------------------------------------
// Process File (progress bar + backend API call)
// -----------------------------------------------------
async function processFile() {
    let fd = new FormData();

    // ============================
    // Handle multiple files
    // ============================
    if (tool === "merge-pdf" || tool === "jpg-to-pdf") {
        const files = document.getElementById("fileInput").files;

        if (!files.length) return alert("Select at least one file");
        if (tool === "merge-pdf" && files.length < 2)
            return alert("Select at least 2 PDFs");

        for (let f of files) fd.append("files", f);
    }

    // ============================
    // Single file tools
    // ============================
    else {
        const file = document.getElementById("fileInput").files[0];
        if (!file) return alert("Select a file");
        fd.append("file", file);
    }

    // ============================
    // Split
    // ============================
    if (tool === "split-pdf") {
        const ranges = document.getElementById("rangeInput").value;
        if (!ranges) return alert("Enter page ranges");
        fd.append("ranges", ranges);
    }

    // ============================
    // Rotate
    // ============================
    if (tool === "rotate-pdf") {
        const angle = document.getElementById("angleInput").value;
        fd.append("angle", angle);
    }

    // ============================
    // Protect / Unlock
    // ============================
    if (tool === "protect-pdf" || tool === "unlock-pdf") {
        const pwd = document.getElementById("passwordInput").value;
        if (!pwd) return alert("Enter password");
        fd.append("password", pwd);
    }

    // ============================
    // Show progress bar
    // ============================
    document.getElementById("progress-wrapper").style.display = "block";
    document.getElementById("download-btn").style.display = "none";

    let bar = document.getElementById("progress-bar");
    bar.style.width = "0%";

    // Fake progress animation
    let progress = 0;
    let fakeLoading = setInterval(() => {
        progress += 7;
        bar.style.width = progress + "%";
        if (progress >= 90) clearInterval(fakeLoading);
    }, 200);

    // ============================
    // Send request to backend
    // ============================
    const res = await fetch(`${API_BASE}/${tool}`, {
        method: "POST",
        body: fd
    });

    if (!res.ok) {
        bar.style.width = "0%";
        alert(`Error: ${res.status}`);
        return;
    }

    // ============================
    // Extract Text (JSON only)
    // ============================
    if (tool === "extract-text") {
        const data = await res.json();
        clearInterval(fakeLoading);
        bar.style.width = "100%";
        alert("Extracted Text:\n\n" + data.text);
        return;
    }

    // ============================
    // Download File
    // ============================
    const blob = await res.blob();
    clearInterval(fakeLoading);
    bar.style.width = "100%";

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
