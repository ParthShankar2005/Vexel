const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Settings API
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  loadSettings: () => ipcRenderer.invoke('load-settings'),

  // Disk Space API
  checkDiskSpace: (paths) => ipcRenderer.invoke('check-disk-space', paths),

  // File System Dialog
  selectFolder: (defaultPath) => ipcRenderer.invoke('select-folder', defaultPath),

  // Payments BrowserWindow Dialog
  openPaymentWindow: (paymentUrl) => ipcRenderer.invoke('open-payment-window', paymentUrl),

  // IPC Event Listener for payment success
  onPaymentSuccess: (callback) => ipcRenderer.on('payment-success', (_, data) => callback(data)),
  onPaymentFailed: (callback) => ipcRenderer.on('payment-failed', (_, data) => callback(data))
});
