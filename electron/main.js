const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const checkDiskSpace = require('check-disk-space').default;

// Global error logging to capture backend/server crashes in packaged environment
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  try {
    const logPath = path.join(app.getPath('userData'), 'uncaught_exception.log');
    fs.writeFileSync(logPath, `Timestamp: ${new Date().toISOString()}\nError: ${error.message}\nStack: ${error.stack}\n`);
  } catch (e) {}
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
  try {
    const logPath = path.join(app.getPath('userData'), 'unhandled_rejection.log');
    fs.writeFileSync(logPath, `Timestamp: ${new Date().toISOString()}\nReason: ${reason?.stack || reason}\n`);
  } catch (e) {}
});

// Start Express Backend directly in the main process only when packaged for production
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
if (!isDev) {
  try {
    // Load env variables
    const dotenv = require('dotenv');
    const possibleEnvPaths = [
      path.join(__dirname, '../.env'),
      path.join(__dirname, '../../../../.env'),
      path.join(path.dirname(app.getPath('exe')), '.env'),
      path.join(process.cwd(), '.env')
    ];

    for (const envPath of possibleEnvPaths) {
      if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
        console.log('Loaded env configuration from:', envPath);
        break;
      }
    }

    // Determine database provider from schema
    let dbProvider = 'sqlite';
    try {
      const schemaPath = path.join(__dirname, '../backend/prisma/schema.prisma');
      if (fs.existsSync(schemaPath)) {
        const schemaContent = fs.readFileSync(schemaPath, 'utf8');
        if (schemaContent.includes('provider = "postgresql"')) {
          dbProvider = 'postgresql';
        }
      }
    } catch (e) {
      console.warn('Could not parse schema provider:', e);
    }

    if (dbProvider === 'sqlite') {
      const userDataPath = app.getPath('userData');
      const writableDbPath = path.join(userDataPath, 'dev.db');

      if (!fs.existsSync(writableDbPath)) {
        const templateDbPath = path.join(__dirname, '../backend/prisma/dev.db');
        if (fs.existsSync(templateDbPath)) {
          fs.copyFileSync(templateDbPath, writableDbPath);
          console.log('Database template successfully copied to AppData:', writableDbPath);
        }
      }

      const { pathToFileURL } = require('url');
      process.env.DATABASE_URL = pathToFileURL(writableDbPath).toString();
      console.log('Database URL configured to SQLite:', process.env.DATABASE_URL);
    } else {
      console.log('PostgreSQL mode active. Using database URL:', process.env.DATABASE_URL);
    }

    require('../backend/server.js');
    console.log('Express API backend started within Electron main process.');
  } catch (error) {
    console.error('Failed to start Express backend:', error);
    try {
      const logPath = path.join(app.getPath('userData'), 'backend_error.log');
      fs.writeFileSync(logPath, `Timestamp: ${new Date().toISOString()}\nError: ${error.message}\nStack: ${error.stack}\n`);
    } catch (e) {}
  }
} else {
  console.log('Running in development mode: Express backend expected to run in a separate terminal process.');
}

let mainWindow;
let paymentWindow;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    title: 'VEXEL AI - Image Generator',
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    // Open devtools in development
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../frontend/out/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (paymentWindow) paymentWindow.close();
  });
}

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Settings file path
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

// IPC HANDLERS

// 1. SAVE SETTINGS
ipcMain.handle('save-settings', async (event, settings) => {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Save settings error:', error);
    return { error: error.message };
  }
});

// 2. LOAD SETTINGS
ipcMain.handle('load-settings', async () => {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      return JSON.parse(data);
    }
    // Return defaults if no settings exist
    const defaultZip = fs.existsSync('D:') ? 'D:\\VEXEL ZIPs' : path.join(app.getPath('home'), 'VEXEL ZIPs');
    return {
      zipStoragePath: defaultZip,
      softwarePath: app.getAppPath(),
      isInstalled: false
    };
  } catch (error) {
    console.error('Load settings error:', error);
    return {};
  }
});

// 3. SELECT FOLDER NATIVE DIALOG
ipcMain.handle('select-folder', async (event, defaultPath) => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: defaultPath || app.getPath('home')
  });
  if (result.canceled) {
    return null;
  }
  return result.filePaths[0];
});

// 4. CHECK DISK SPACE
ipcMain.handle('check-disk-space', async (event, paths) => {
  const { softwarePath, zipPath } = paths;
  const resolvedSoftware = softwarePath || app.getAppPath();
  const resolvedZip = zipPath || (fs.existsSync('D:') ? 'D:\\VEXEL ZIPs' : path.join(app.getPath('home'), 'VEXEL ZIPs'));

  try {
    const swDrive = path.parse(resolvedSoftware).root;
    const zipDrive = path.parse(resolvedZip).root;

    const swSpace = await checkDiskSpace(swDrive);
    let zipSpace = null;

    try {
      let targetZip = resolvedZip;
      if (!fs.existsSync(targetZip)) {
        targetZip = zipDrive;
      }
      zipSpace = await checkDiskSpace(targetZip);
    } catch (err) {
      console.warn('Zip path disk check error:', err);
    }

    return {
      software: {
        drive: swDrive,
        freeBytes: swSpace.free,
        isSufficient: swSpace.free >= 10 * 1024 * 1024 * 1024 // 10 GB
      },
      zip: zipSpace ? {
        drive: zipDrive,
        freeBytes: zipSpace.free,
        isSufficient: zipSpace.free >= 5 * 1024 * 1024 * 1024 // 5 GB
      } : {
        drive: zipDrive,
        freeBytes: 0,
        isSufficient: false
      }
    };
  } catch (error) {
    console.error('IPC check disk space error:', error);
    throw error;
  }
});

// 5. OPEN PAYMENT WINDOW (Razorpay checkout)
ipcMain.handle('open-payment-window', async (event, paymentUrl) => {
  if (paymentWindow) {
    paymentWindow.focus();
    return;
  }

  paymentWindow = new BrowserWindow({
    width: 600,
    height: 700,
    parent: mainWindow,
    modal: true,
    title: 'Razorpay Secure Checkout',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  paymentWindow.loadURL(paymentUrl);

  // Monitor redirects or page titles to detect success/failure
  paymentWindow.webContents.on('did-navigate', (event, url) => {
    console.log('Payment window navigated to:', url);
    if (url.includes('/payments/success') || url.includes('success=true')) {
      mainWindow.webContents.send('payment-success', { url });
      setTimeout(() => {
        if (paymentWindow) paymentWindow.close();
      }, 2000);
    } else if (url.includes('/payments/failed') || url.includes('success=false')) {
      mainWindow.webContents.send('payment-failed', { url });
      setTimeout(() => {
        if (paymentWindow) paymentWindow.close();
      }, 2000);
    }
  });

  paymentWindow.on('closed', () => {
    paymentWindow = null;
  });
});
