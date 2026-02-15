const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    loadData: () => ipcRenderer.invoke('load-data'),
    saveData: (data) => ipcRenderer.invoke('save-data', data),
    saveImage: (path, type, metadata) => ipcRenderer.invoke('save-image', path, type, metadata),
    deleteImage: (path) => ipcRenderer.invoke('delete-image', path),
    selectImage: () => ipcRenderer.invoke('dialog:openFile'),
    getImagesBaseUrl: () => ipcRenderer.invoke('images:base-url'),
    backupStatus: () => ipcRenderer.invoke('backup:status'),
    exportBackup: () => ipcRenderer.invoke('backup:export'),
    importBackup: () => ipcRenderer.invoke('backup:import'),
    exportShowcase: () => ipcRenderer.invoke('showcase:export'),
    confirmDialog: (options) => ipcRenderer.invoke('dialog:confirm', options),
    focusWindow: () => ipcRenderer.invoke('focus-window'),
    // New methods
    fetchInkSwatch: (query) => ipcRenderer.invoke('fetch-inkswatch', query),
    saveImageUrl: (url, type, metadata) => ipcRenderer.invoke('save-image-url', url, type, metadata),
    detectPenColors: (path) => ipcRenderer.invoke('detect-pen-colors', path)
});
