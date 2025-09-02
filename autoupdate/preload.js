const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  refreshClients: () => ipcRenderer.invoke('refresh-clients'),
  getBackupInfo: () => ipcRenderer.invoke('get-backup-info')
}); 