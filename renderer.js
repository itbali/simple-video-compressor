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

let outputPath = undefined;
let isCompressing = false; // Флаг состояния сжатия

async function checkFileExists(outputPath) {
	const exists = await window.api.checkFileExists(outputPath);
	if (exists) {
		return await window.api.showOverwriteDialog(); // Вернет true, если пользователь выбрал "Перезаписать"
	}
	return true; // Если файл не существует, продолжить без запроса
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

	window.api.getVideoDuration(file.path, (err, duration) => {
		if (err) {
			estimatedSizeSpan.textContent = "Error while getting video duration: " + err;
			return;
		}

		const bitrate = parseInt(bitrateSelector.value) * 1000; // Преобразование битрейта в биты в секунду
		const estimatedSize = (bitrate * duration) / 8 / 1024 / 1024; // Размер в мегабайтах
		estimatedSizeSpan.textContent = `Предполагаемый размер: ${estimatedSize.toFixed(2)} МБ`;
	});
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
	const sourcePath = filePicker.files[0].path;
	isCompressing = true;
	updateCompressButtonState();

	statusSpan.textContent = "Compressing...";
	window.api.getVideoInfo(sourcePath, (duration) => {
		if (duration) {
			window.api.compressVideo(sourcePath, outputPath, bitrateSelector.value, (stderr, exitCode) => {

				const match = /time=(\d+:\d+:\d+\.\d+)/.exec(stderr);
				if (match && match[1]) {
					const currentTime = match[1].split(":").reduce((acc, time) => (60 * acc) + +time);
					const progress = (currentTime / duration * 100).toFixed(2);
					statusSpan.innerHTML = `Progress: ${progress}%`;
				} else {
					detailsSpan.innerHTML = stderr; // Показываем подробную информацию
				}

				if (typeof exitCode === "number") {
					// Завершение процесса сжатия
					switch (exitCode) {
						case 0:
							statusSpan.textContent = `Compress is done. File saved: ${outputPath}`;
							break;
						case 255:
							statusSpan.textContent = "Compression is cancelled";
							break;
						default:
							statusSpan.textContent = `Error while compress: ${exitCode}`;
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
	updateEstimatedSize();
	updateCompressButtonState();
	selectedFilePathSpan.textContent = `Selected file: ${event.target.files[0].path}`;
	const file = event.target.files[0];
	if (file) {
		videoPreview.src = URL.createObjectURL(file);
		videoPreview.load(); // Загружаем и отображаем выбранный файл в плеере
		updateEstimatedSize(); // Обновляем оценочный размер
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

document.addEventListener("DOMContentLoaded", () => {
	statusSpan.innerHTML = "Ready to compress!";
});
