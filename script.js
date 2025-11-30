const API_BASE = "https://pdf-tools-backend-1.onrender.com";

function openTool(tool){
    window.location.href = `tool.html?tool=${tool}`;
}

const params = new URLSearchParams(window.location.search);
const tool = params.get("tool");

if (tool && document.getElementById("toolName")) {
    document.getElementById("toolName").innerText = tool.replace(/-/g, " ").toUpperCase();
}

// Show inputs
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

async function processFile() {
    let fd = new FormData();

    // MULTIPLE
    if (tool === "merge-pdf" || tool === "jpg-to-pdf") {
        const files = document.getElementById("fileInput").files;

        if (!files.length) return alert("Select at least one file");
        if (tool === "merge-pdf" && files.length < 2)
            return alert("Select at least 2 PDFs");

        for (let f of files) fd.append("files", f);
    }

    // SINGLE
    else {
        const file = document.getElementById("fileInput").files[0];
        if (!file) return alert("Select a file");
        fd.append("file", file);
    }

    // RANGES
    if (tool === "split-pdf") {
        const ranges = document.getElementById("rangeInput").value;
        if (!ranges) return alert("Enter page ranges");
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

    // SEND TO BACKEND
    const res = await fetch(`${API_BASE}/${tool}`, { method: "POST", body: fd });

    if (!res.ok) return alert(`Error: ${res.status}`);

    // EXTRACT TEXT (JSON ONLY)
    if (tool === "extract-text") {
        const data = await res.json();
        alert("Extracted Text:\n\n" + data.text);
        return;
    }

    // DOWNLOAD
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const fileNames = {
        "pdf-to-word": "output.docx",
        "pdf-to-jpg": "output.jpg",      // FIXED
        "jpg-to-pdf": "output.pdf",
        "merge-pdf": "merged.pdf",
        "split-pdf": "split.zip",
        "rotate-pdf": "rotated.pdf",
        "compress-pdf": "compressed.pdf",
        "word-to-pdf": "output.pdf",
        "ppt-to-pdf": "output.pdf",
        "extract-text": "output.txt"
    };

    const download = document.getElementById("downloadLink");
    download.href = url;
    download.download = fileNames[tool] || "output.pdf";
    download.innerText = "Download File";
    download.style.display = "block";
}
function processFile() {

    const file = document.getElementById("fileInput").files[0];
    if (!file) return alert("Please upload a file.");

    // Show progress bar
    document.getElementById("progress-wrapper").style.display = "block";
    document.getElementById("download-btn").style.display = "none";

    let bar = document.getElementById("progress-bar");
    bar.style.width = "0%";

    // FAKE ANIMATION while backend processes
    let progress = 0;
    let fakeLoading = setInterval(() => {
        progress += 7;
        bar.style.width = progress + "%";
        if (progress >= 90) clearInterval(fakeLoading);
    }, 200);

    // ----------------- API CALL -----------------
    const formData = new FormData();
    formData.append("file", file);

    fetch("https://pdf-tools-backend-1.onrender.com/convert", {
        method: "POST",
        body: formData
    })
    .then(res => res.blob())
    .then(blob => {

        // Finish progress
        bar.style.width = "100%";

        const url = window.URL.createObjectURL(blob);

        // Show Download button
        const downloadBtn = document.getElementById("download-btn");
        downloadBtn.href = url;
        downloadBtn.download = "output_" + file.name;
        downloadBtn.innerText = "Download File";
        downloadBtn.style.display = "block";
    })
    .catch(err => {
        alert("Error: " + err);
        console.log(err);
    });

}
