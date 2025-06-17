const { app, BrowserWindow, shell } = require('electron');
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

  // ✅ Open external links in default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

}

app.whenReady().then(createWindow);