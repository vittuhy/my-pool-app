const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { https } = require('follow-redirects');

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
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
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

ipcMain.handle('refresh-clients', async () => {
  const csvUrl = 'https://docs.google.com/spreadsheets/d/1Dc54xteyXFVQOKbbaqDTJkHhV1fEKGTLCxX-2hgI_gI/export?format=csv';
  const clientsPath = path.join(__dirname, 'app', 'clients.csv');
  const backupPath = path.join(__dirname, 'app', 'clients_backup.csv');
  try {
    // Backup current clients.csv
    if (fs.existsSync(clientsPath)) {
      fs.copyFileSync(clientsPath, backupPath);
    }
    // Download new CSV
    const csvData = await new Promise((resolve, reject) => {
      https.get(csvUrl, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
        res.on('error', reject);
      }).on('error', reject);
    });
    // Remove header (first line)
    const lines = csvData.split('\n');
    const noHeader = lines.slice(1).join('\n');
    // If no data after header, treat as failure
    if (!noHeader.trim()) {
      console.warn('Fetched CSV is empty after removing header. Not updating files.');
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, clientsPath);
      }
      return { success: false };
    }
    // Write new clients.csv
    fs.writeFileSync(clientsPath, noHeader, 'utf8');
    // Also update backup to latest version
    fs.writeFileSync(backupPath, noHeader, 'utf8');
    // Debug: log contents of both files
    try {
      const clientsData = fs.readFileSync(clientsPath, 'utf8');
      const backupData = fs.readFileSync(backupPath, 'utf8');
      console.log('DEBUG: clients.csv content after fetch:', clientsData.slice(0, 200));
      console.log('DEBUG: clients_backup.csv content after fetch:', backupData.slice(0, 200));
    } catch (logErr) {
      console.error('DEBUG: Error reading files after write:', logErr);
    }
    return { success: true };
  } catch (e) {
    // On failure, restore backup if exists
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, clientsPath);
    }
    return { success: false };
  }
});