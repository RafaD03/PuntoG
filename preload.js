const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  open: () => ipcRenderer.invoke('file:open'),
  readPath: p => ipcRenderer.invoke('file:readPath', p),
  showInFolder: p => ipcRenderer.invoke('file:showInFolder', p),
  getFileToOpen: () => ipcRenderer.invoke('app:fileToOpen'),
  write: (d, p) => ipcRenderer.invoke('file:write', d, p),
  writeSync: (d, p) => ipcRenderer.sendSync('file:writeSync', d, p),
  saveAs: (d, n) => ipcRenderer.invoke('file:saveAs', d, n),
  pdf: (n, s) => ipcRenderer.invoke('pdf:export', n, s),
  onMenu: cb => ipcRenderer.on('menu', (e, c) => cb(c))
});
