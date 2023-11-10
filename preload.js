const {contextBridge, ipcRenderer} = require('electron');
const fs = require('fs');
const {spawn} = require('child_process');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;

let ffmpeg = null;

contextBridge.exposeInMainWorld('api', {
    join: (...args) => path.join(...args),
    readFile: (filePath, callback) => {
        fs.readFile(filePath, 'utf-8', callback);
    },
    getDefaultVideoPath: async () => ipcRenderer.invoke('get-default-video-path'),
    checkFileExists: async (path) => {
        return fs.existsSync(path);
    },
    showSaveDialog: async (defaultPath) => {
        return await ipcRenderer.invoke('show-save-dialog', defaultPath);
    },
    showOverwriteDialog: async () => {
        const result = await ipcRenderer.invoke('show-overwrite-dialog');
        return result === 0;  // Возвращает 'overwrite', если пользователь нажал кнопку "Перезаписать"
    },
    compressVideo: (sourcePath, outputPath, bitrate, startTime, endTime, callback) => {
        let args = ['-y', '-i', sourcePath, '-b:v', bitrate];

        if (startTime > 0) {
            args.push('-ss');
            args.push(startTime.toString());
        }

        if (endTime > 0) {
            args.push('-to');
            args.push(endTime.toString());
        }

        args.push(outputPath);

        ffmpeg = spawn(ffmpegPath, args);

        ffmpeg.stdout.on('data', (data) => {
            console.debug(`stdout: ${data}`);
        });

        ffmpeg.stderr.on('data', (data) => {
            const message = data.toString();
            if (message) {
                callback(message);
            }
        });

        ffmpeg.on('close', (code) => {
            console.debug(`child process exited with code ${code}`);
            window.ffmpegProcess = null; // Очищаем глобальную переменную
            if (code !== 0) {
                // Если процесс не завершился успешно, пытаемся удалить незавершенный файл
                fs.unlink(outputPath, (err) => {
                    if (err) {
                        console.error(`Failed to delete unfinished file: ${outputPath}, error: ${err}`);
                    } else {
                        console.log(`Unfinished file deleted: ${outputPath}`);
                    }
                });
            }
            callback(null, code);
        });
    },
    stopCompressing: () => {
        if (ffmpeg) {
            ffmpeg.kill('SIGINT');
            ffmpeg = null;
        }
    },
    getVideoInfo: (sourcePath, callback) => {
        const ffprobe = spawn(ffprobePath, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', sourcePath]);
        let duration = 0;

        ffprobe.stdout.on('data', (data) => {
            duration = parseFloat(data);
        });

        ffprobe.on('close', () => {
            callback(duration);
        });
    },
    getVideoDuration: (sourcePath, callback) => {
        const ffprobe = spawn(ffprobePath, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', sourcePath]);
        ffprobe.stdout.on('data', (data) => {
            callback(null, parseFloat(data.toString()));
        });
        ffprobe.stderr.on('data', (data) => {
            callback(data.toString());
        });
    },
});
