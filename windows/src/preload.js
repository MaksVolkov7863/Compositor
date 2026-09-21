const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Window controls
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    maximizeWindow: () => ipcRenderer.send('window-maximize'),
    closeWindow: () => ipcRenderer.send('window-close'),
    
    // File dialogs
    openFileDialog: (options) => ipcRenderer.invoke('dialog-open-file', options),
    saveFileDialog: (options) => ipcRenderer.invoke('dialog-save-file', options),
    
    // File system
    readFile: (filePath) => ipcRenderer.invoke('fs-read-file', filePath),
    writeFile: (filePath, data) => ipcRenderer.invoke('fs-write-file', filePath, data),
    
    // Menu events
    onMenuAction: (callback) => {
        ipcRenderer.on('menu-action', (event, action, data) => callback(action, data));
    }
});
