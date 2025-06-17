const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 300,
    height: 800,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1c1c1e',
    resizable: false,
    fullscreenable: false,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js') // optional
    },
    icon: path.join(__dirname, 'app/images/icon128.icns')
  });

  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'app/popup.html'));
}

app.whenReady().then(createWindow);