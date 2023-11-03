// main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const {existsSync} = require("fs");

ipcMain.handle('dialog:openFile', async () => {
	const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'] });
	if (canceled) {
		return null;
	} else {
		return filePaths[0];
	}
});
ipcMain.handle('open-dialog', async (event, ...args) => {
	return await dialog.showOpenDialog(...args);
});
ipcMain.handle('show-save-dialog', async (event, defaultPath) => {
	const result = await dialog.showSaveDialog({
		defaultPath,
		buttonLabel: 'Сохранить видео',
		filters: [
			{ name: 'MP4', extensions: ['mp4'] }
		]
	});
	return result.filePath;
});
ipcMain.handle('get-default-video-path', async () => {
	return app.getPath('videos');
});
ipcMain.handle('check-file-exists', async (event, path) => {
	return existsSync(path);
});
ipcMain.handle('show-overwrite-dialog', async () => {
	const result = await dialog.showMessageBox({
		type: 'question',
		buttons: ['Overwrite', 'Cancel'],
		defaultId: 1,
		title: 'Confirm Overwrite',
		message: 'You are going to overwrite the existing file. Are you sure?'
	});
	return result.response;
});
function createWindow() {
	const win = new BrowserWindow({
		width: 800,
		height: 800,
		webPreferences: {
			enableRemoteModule: true,
			nodeIntegration: true,
			preload: path.join(__dirname, 'preload.js')
		}
	});

	win.loadFile('index.html');
}

app.whenReady().then(createWindow);
