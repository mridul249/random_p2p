// main.js

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,       // Enable Node.js integration
            contextIsolation: false,     // Disable context isolation
        }
    });

    win.loadFile('index.html');
    win.webContents.openDevTools(); // Opens DevTools for debugging
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// Handle IPC event to open dialog
ipcMain.handle('dialog:open', async (event, options) => {
    const result = await dialog.showOpenDialog(options);
    return result;
});
