const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  refreshClients: () => ipcRenderer.invoke('refresh-clients')
}); 