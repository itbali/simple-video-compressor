// renderer.js
const statusSpan = document.getElementById("status");
const filePicker = document.getElementById("filePicker");
const bitrateSelector = document.getElementById("bitrate");
const detailsSpan = document.getElementById("details");
const estimatedSizeSpan = document.getElementById("estimatedSize");
const videoPreview = document.getElementById("videoPreview");
const chooseSavePathButton = document.getElementById("saveBtn");
const compressBtn = document.getElementById("compressBtn");
const selectedPathSpan = document.getElementById("selectedPath");
const themeToggle = document.getElementById("themeToggle");
const selectedFilePathSpan = document.getElementById("fileName");
const endTimeInput = document.getElementById("endTime");
const startTimeInput = document.getElementById("startTime");
const toggleDetailsBtn = document.getElementById("toggleDetailsBtn");
const detailsContainer = document.getElementById("detailsContainer");
const outputFormatSelect = document.getElementById("outputFormat");

let outputPath = undefined;
let isCompressing = false; // Флаг состояния сжатия

async function checkFileExists(outputPath) {
    const exists = await window.api.checkFileExists(outputPath);
    if (exists) {
        return await window.api.showOverwriteDialog(); // Вернет true, если пользователь выбрал "Перезаписать"
    }
    return true; // Если файл не существует, продолжить без запроса
}

function formatFFmpegDetails(details) {
    // Заменяем "frame=" и подобные термины на сами себя с переводом строки перед ними
    return details
        .replace(/frame=/g, "<br>frame=")
        .replace(/fps=/g, "<br>fps=")
        .replace(/size=/g, "<br>size=")
        .replace(/time=/g, "<br>time=")
        .replace(/bitrate=/g, "<br>bitrate=")
        .replace(/speed=/g, "<br>speed=")
        .replace(/video:/g, "<br>video:")
        .replace(/audio:/g, "<br>audio:")
        .replace(/subtitle:/g, "<br>subtitle:")
        .replace(/muxing overhead:/g, "<br>muxing overhead:");
}

function updateCompressButtonState() {
    if (filePicker.files.length > 0 && outputPath) {
        compressBtn.disabled = false;
        compressBtn.innerHTML = isCompressing ? "Cancel" : "Compress";
        compressBtn.classList.toggle("button-error", isCompressing);
        compressBtn.classList.toggle("button-success", !isCompressing);
    } else {
        compressBtn.disabled = true;
        compressBtn.textContent = "Select file and output path";
        compressBtn.classList.remove("button-error");
        compressBtn.classList.remove("button-success");
    }
}

function updateEstimatedSize() {
    const file = filePicker.files[0];
    if (!file) {
        estimatedSizeSpan.textContent = "Estimated size: N/A";
        return;
    }

    // Получаем значения времени начала и конца из полей ввода
    const startTime = parseFloat(document.getElementById("startTime").value) || 0;
    const endTime = parseFloat(document.getElementById("endTime").value) || 0;
    const duration = (endTime > startTime) ? endTime - startTime : 0;

    const bitrate = parseInt(bitrateSelector.value) * 1000; // Преобразование битрейта в биты в секунду
    const estimatedSize = (bitrate * duration) / 8 / 1024 / 1024; // Размер в мегабайтах
    estimatedSizeSpan.textContent = `Estimated size: ${estimatedSize.toFixed(2)} MB`;
}

function compressVideo() {
    if (!filePicker.files[0]) {
        alert("Select file");
        statusSpan.textContent = "Select file";
        return;
    }
    if (!outputPath) {
        alert("Select output path");
        statusSpan.textContent = "Select output path";
        return;
    }
    const startTime = startTimeInput.value;
    const endTime = endTimeInput.value;
    let sourcePath = filePicker.files[0].path;
    const format = outputFormatSelect.value;
    let outputFileName = outputPath;
    if (!outputFileName.endsWith(`.${format}`)) {
        outputFileName += `.${format}`; // Добавляем расширение файла к пути
    }
    isCompressing = true;

    updateCompressButtonState();

    statusSpan.textContent = "Compressing...";
    window.api.getVideoInfo(sourcePath, (duration) => {
        if (duration) {
            window.api.compressVideo(sourcePath, outputFileName, bitrateSelector.value, startTime, endTime, (stderr, exitCode) => {

                const match = /time=(\d+:\d+:\d+\.\d+)/.exec(stderr);
                if (match && match[1]) {
                    const currentTime = match[1].split(":").reduce((acc, time) => (60 * acc) + +time);
                    const progress = (currentTime / duration * 100).toFixed(2);
                    statusSpan.innerHTML = `Progress: ${progress}%`;

                    console.log(stderr)
                    if (stderr) {
                        detailsSpan.innerHTML = formatFFmpegDetails(stderr);
                    } else {
                        detailsSpan.innerHTML = "No additional details available";
                    }
                }

                if (typeof exitCode === "number") {
                    // Завершение процесса сжатия
                    switch (exitCode) {
                        case 0:
                            statusSpan.textContent = `Compress is done. File saved: ${outputFileName}`;
                            detailsSpan.innerHTML = "No additional details available";
                            break;
                        case 255:
                            statusSpan.textContent = "Compression is cancelled";
                            detailsSpan.innerHTML = "No additional details available";
                            break;
                        default:
                            statusSpan.textContent = `Error while compress: ${exitCode}`;
                            detailsSpan.innerHTML = "No additional details available";
                            break;
                    }
                    isCompressing = false;
                    updateCompressButtonState();
                }
            });
        }
    });
    setTimeout(() => {
        if (isCompressing) {
            compressBtn.disabled = false;
        }
    }, 500);
}

function cancelCompression() {
    window.api.stopCompressing();
    statusSpan.textContent = "Compression is cancelled";
    isCompressing = false;
    updateCompressButtonState();
}

bitrateSelector.addEventListener("change", updateEstimatedSize);
filePicker.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
        selectedFilePathSpan.textContent = `Selected file: ${file.path}`;
        videoPreview.src = URL.createObjectURL(file);
        videoPreview.load(); // Загружаем и отображаем выбранный файл в плеере

        window.api.getVideoDuration(file.path, (err, duration) => {
            if (!err) {
                endTimeInput.value = duration.toFixed(2);
                updateEstimatedSize(); // Обновляем оценочный размер
                updateCompressButtonState();
            }
        });
    }
});
chooseSavePathButton.addEventListener("click", async () => {
    const defaultPath = await window.api.getDefaultVideoPath();
    outputPath = await window.api.showSaveDialog(defaultPath);
    selectedPathSpan.textContent = `Selected path: ${outputPath}`;
    updateCompressButtonState();
});
compressBtn.addEventListener("click", async () => {
    if (isCompressing) {
        cancelCompression(); // Функция для остановки сжатия
    } else {
        const shouldOverwrite = await checkFileExists(outputPath);
        if (shouldOverwrite) {
            compressBtn.disabled = true;
            compressVideo(); // Начало сжатия
        } else {
            statusSpan.textContent = "Compression is cancelled";
        }
    }
});
themeToggle.addEventListener("change", () => {
    document.body.classList.toggle("light-theme", themeToggle.checked);
});
startTimeInput.addEventListener("change", updateEstimatedSize);
endTimeInput.addEventListener("change", updateEstimatedSize);
toggleDetailsBtn.addEventListener("click", () => {
    detailsContainer.classList.toggle("show-details");
    toggleDetailsBtn.textContent = detailsContainer.classList.contains("show-details") ? "Hide Details" : "Show Details";
});

document.addEventListener("DOMContentLoaded", () => {
    statusSpan.innerHTML = "Ready to compress!";
});
