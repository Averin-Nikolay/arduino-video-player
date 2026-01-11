// preload.js - Добавляем методы для работы с устройствами
const { contextBridge, ipcRenderer } = require('electron');

function makeFileUrl(absolutePath) {
  try {
    const normalizedPath = absolutePath.replace(/\\/g, '/');
    return `file://${normalizedPath}`;
  } catch (error) {
    console.error('Error creating file URL:', error);
    return null;
  }
}

const electronApi = {
  getConfig: async () => {
    try {
      const config = await ipcRenderer.invoke('get-config');
      
      if (!config) {
        throw new Error('Config is null');
      }
      
      const processedConfig = {
        video: {
          background: makeFileUrl(config.video.background),
          videos: {},
        },
        debug: config.debug || { visible: true },
      };

      for (const [key, videoPath] of Object.entries(config.video.videos)) {
        processedConfig.video.videos[key] = makeFileUrl(videoPath);
      }
      
      console.log('Config processed successfully');
      return processedConfig;
    } catch (error) {
      console.error('Failed to get config:', error);
      throw error;
    }
  },

  // Новые методы для работы с устройствами
  scanDevices: async () => {
    try {
      return await ipcRenderer.invoke('scan-devices');
    } catch (error) {
      console.error('Failed to scan devices:', error);
      return [];
    }
  },

  connectDevice: async (devicePath) => {
    try {
      return await ipcRenderer.invoke('connect-device', devicePath);
    } catch (error) {
      console.error('Failed to connect device:', error);
      return false;
    }
  },

  getArduinoStats: async () => {
    try {
      return await ipcRenderer.invoke('get-arduino-stats');
    } catch (error) {
      console.error('Failed to get stats:', error);
      return null;
    }
  },

  resetArduinoStats: () => {
    ipcRenderer.send('reset-arduino-stats');
  },

  onArduinoStatus: (callback) => {
    if (typeof callback !== 'function') {
      console.error('Callback must be a function');
      return () => {};
    }

    const handler = (_event, status) => {
      callback(status);
    };

    ipcRenderer.on('arduino-status', handler);

    return () => {
      ipcRenderer.removeListener('arduino-status', handler);
    };
  },

  onArduinoData: (callback) => {
    if (typeof callback !== 'function') {
      console.error('Callback must be a function');
      return () => {};
    }

    const handler = (_event, data) => {
      callback(data);
    };

    ipcRenderer.on('arduino-data', handler);

    return () => {
      ipcRenderer.removeListener('arduino-data', handler);
    };
  },

  sendKey: (key) => {
    ipcRenderer.send('key-pressed', key);
  },

  closeApp: () => {
    ipcRenderer.send('close-app');
  },
};

try {
  contextBridge.exposeInMainWorld('electronApi', electronApi);
  console.log('Electron API exposed successfully');
} catch (error) {
  console.error('Failed to expose Electron API:', error);
}