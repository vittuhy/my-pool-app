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
    
    // Validate the data - must have actual content
    if (!noHeader.trim()) {
      console.warn('❌ Fetched CSV is empty after removing header. Not updating files.');
      console.log('📊 CSV data received:', csvData);
      return { success: false, error: 'No data received from Google Sheets' };
    }
    
    // Check if we have actual client data (not just empty lines)
    const dataLines = noHeader.trim().split('\n').filter(line => line.trim().length > 0);
    if (dataLines.length === 0) {
      console.warn('❌ No valid client data found. Not updating files.');
      return { success: false, error: 'No valid client data found' };
    }
    
    console.log(`✅ Valid data received: ${dataLines.length} clients`);
    
    // SUCCESS! Update both the main file AND the single backup file
    
    // 1. Update the main clients.csv file
    fs.writeFileSync(clientsPath, noHeader, 'utf8');
    console.log('✅ Successfully updated clients.csv');
    
    // 2. Update the single backup file with the new successful data
    fs.writeFileSync(backupPath, noHeader, 'utf8');
    console.log('✅ Successfully updated backup with new data');
    
    return { success: true, clientCount: dataLines.length };
    
  } catch (e) {
    console.error('❌ Refresh failed:', e.message);
    
    // On failure, restore from backup if exists
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, clientsPath);
      console.log('✅ Restored clients.csv from backup after failure');
    }
    
    return { success: false, error: e.message };
  }
});

// Add a new IPC handler to get backup information
ipcMain.handle('get-backup-info', async () => {
  const backupPath = path.join(__dirname, 'app', 'clients_backup.csv');
  const clientsPath = path.join(__dirname, 'app', 'clients.csv');
  
  try {
    const backups = [];
    
    // Check main backup
    if (fs.existsSync(backupPath)) {
      const stats = fs.statSync(backupPath);
      const content = fs.readFileSync(backupPath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      backups.push({
        name: 'clients_backup.csv',
        size: stats.size,
        modified: stats.mtime,
        clientCount: lines.length,
        type: 'main'
      });
    }
    
    // Check for timestamped backups
    const appDir = path.join(__dirname, 'app');
    const files = fs.readdirSync(appDir);
    const timestampedBackups = files.filter(file => 
      file.startsWith('clients_backup_') && file.endsWith('.csv')
    );
    
    timestampedBackups.forEach(file => {
      const filePath = path.join(appDir, file);
      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      backups.push({
        name: file,
        size: stats.size,
        modified: stats.mtime,
        clientCount: lines.length,
        type: 'timestamped'
      });
    });
    
    // Check current clients.csv
    let currentClients = null;
    if (fs.existsSync(clientsPath)) {
      const stats = fs.statSync(clientsPath);
      const content = fs.readFileSync(clientsPath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      currentClients = {
        size: stats.size,
        modified: stats.mtime,
        clientCount: lines.length
      };
    }
    
    return {
      success: true,
      backups: backups.sort((a, b) => b.modified - a.modified),
      currentClients: currentClients
    };
    
  } catch (error) {
    console.error('Failed to get backup info:', error);
    return { success: false, error: error.message };
  }
});