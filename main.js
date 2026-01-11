// main.js - Добавляем поддержку выбора устройств
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const config = require('./config');
const ArduinoManager = require('./utils/arduino');
const DeviceManager = require('./utils/deviceManager');

let mainWindow = null;
let arduino = null;
let deviceManager = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    fullscreen: config.window.fullscreen,
    frame: config.window.frame,
    backgroundColor: '#000000',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('Window shown');
  });

  mainWindow.on('closed', () => {
    console.log('Window closed');
    mainWindow = null;
    if (arduino) {
      arduino.close();
      arduino = null;
    }
  });

  if (config.debug.enableConsole && !app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
}

function setupIPC() {
  // Получение конфигурации
  ipcMain.handle('get-config', async () => {
    try {
      return {
        video: {
          background: config.video.background,
          videos: config.video.videos,
        },
        debug: config.debug,
      };
    } catch (error) {
      console.error('Error in get-config handler:', error);
      throw error;
    }
  });

  // Сканирование устройств
  ipcMain.handle('scan-devices', async () => {
    try {
      if (!deviceManager) {
        deviceManager = new DeviceManager();
      }
      return await deviceManager.scanDevices();
    } catch (error) {
      console.error('Error scanning devices:', error);
      return [];
    }
  });

  // Подключение к выбранному устройству
  ipcMain.handle('connect-device', async (_event, devicePath) => {
    try {
      if (!arduino) {
        arduino = new ArduinoManager(mainWindow.webContents);
      }
      
      const success = await arduino.connectToPort(devicePath);
      
      if (success && deviceManager) {
        deviceManager.selectDevice(devicePath);
      }
      
      return success;
    } catch (error) {
      console.error('Error connecting to device:', error);
      return false;
    }
  });

  // Получение статистики Arduino
  ipcMain.handle('get-arduino-stats', async () => {
    try {
      if (arduino) {
        return arduino.getStats();
      }
      return null;
    } catch (error) {
      console.error('Error getting stats:', error);
      return null;
    }
  });

  // Сброс статистики
  ipcMain.on('reset-arduino-stats', () => {
    if (arduino) {
      arduino.resetStats();
    }
  });

  ipcMain.on('key-pressed', (event, key) => {
    console.log('Key pressed:', key);
  });

  ipcMain.on('close-app', () => {
    console.log('Close app requested');
    
    if (arduino) {
      arduino.close();
      arduino = null;
    }
    
    app.quit();
  });

  console.log('IPC handlers registered');
}

async function initializeArduino() {
  try {
    await new Promise(resolve => setTimeout(resolve, config.arduino.connectionTimeout));
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      // Инициализируем менеджер устройств
      deviceManager = new DeviceManager();
      await deviceManager.scanDevices();
      
      // Автоматически выбираем устройство
      const autoDevice = deviceManager.autoSelectDevice();
      
      if (autoDevice) {
        arduino = new ArduinoManager(mainWindow.webContents);
        await arduino.connectToPort(autoDevice.path);
        console.log('Arduino initialized with auto-selected device');
      } else {
        console.log('No devices found for auto-connection');
        // Отправляем сообщение в рендерер о необходимости выбрать устройство
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('arduino-status', 'Не найдена - выберите устройство');
        }
      }
    }
  } catch (error) {
    console.error('Arduino initialization error:', error);
  }
}

async function initialize() {
  try {
    await app.whenReady();
    setupIPC();
    createWindow();
    initializeArduino();
    console.log('Application initialized');
  } catch (error) {
    console.error('Initialization failed:', error);
    app.quit();
  }
}

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  console.log('Application quitting...');
  if (arduino) {
    arduino.close();
  }
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

initialize();