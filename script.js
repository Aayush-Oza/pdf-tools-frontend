const API_BASE = "https://pdf-tools-backend-1.onrender.com";

function openTool(tool){
    window.location.href = `tool.html?tool=${tool}`;
}

const params = new URLSearchParams(window.location.search);
const tool = params.get("tool");

// Set Title
if (tool && document.getElementById("toolName")) {
    document.getElementById("toolName").innerText = tool.replace(/-/g, " ").toUpperCase();
}

// Show fields based on selected tool
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

async function processFile() {
    let fd = new FormData();

    // MULTIPLE FILE TOOLS
    if (tool === "merge-pdf" || tool === "jpg-to-pdf") {
        const files = document.getElementById("fileInput").files;

        if (!files.length) return alert("Select at least one file");

        if (tool === "merge-pdf" && files.length < 2)
            return alert("Select at least 2 PDFs to merge");

        for (let f of files) fd.append("files", f);
    }

    // SINGLE FILE TOOLS
    else {
        const file = document.getElementById("fileInput").files[0];
        if (!file) return alert("Please choose a file");
        fd.append("file", file);
    }

    // SPLIT
    if (tool === "split-pdf") {
        const ranges = document.getElementById("rangeInput").value;
        if (!ranges) return alert("Enter ranges like 1-3,5");
        fd.append("ranges", ranges);
    }

    // ROTATE
    if (tool === "rotate-pdf") {
        const angle = document.getElementById("angleInput").value;
        fd.append("angle", angle);
    }

    // PASSWORD
    if (tool === "protect-pdf" || tool === "unlock-pdf") {
        const pwd = document.getElementById("passwordInput").value;
        if (!pwd) return alert("Enter password");
        fd.append("password", pwd);
    }

    // SEND REQUEST
    const res = await fetch(`${API_BASE}/${tool}`, { method: "POST", body: fd });

    if (!res.ok) {
        alert(`Error: ${res.status}`);
        return;
    }

    // SPECIAL CASE → EXTRACT TEXT
    if (tool === "extract-text") {
        const data = await res.json();
        alert("Extracted Text:\n\n" + data.text);
        return;
    }

    // Otherwise → download file
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const download = document.getElementById("downloadLink");
    download.href = url;

    // Correct file extensions
    const fileNames = {
        "pdf-to-word": "output.docx",
        "pdf-to-jpg": "output.zip",
        "jpg-to-pdf": "output.pdf",
        "merge-pdf": "merged.pdf",
        "split-pdf": "split.zip",
        "rotate-pdf": "rotated.pdf",
        "compress-pdf": "compressed.pdf",
        "word-to-pdf": "output.pdf",
        "ppt-to-pdf": "output.pdf",
        "extract-text": "output.txt"
    };

    download.download = fileNames[tool] || "output.pdf";
    download.innerText = "Download File";
    download.style.display = "block";
}
