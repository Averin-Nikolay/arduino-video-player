// config.js - Добавляем настройки защиты от фантомных нажатий
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

function getResourcesPath() {
  if (app.isPackaged) {
    return path.dirname(process.execPath);
  } else {
    return __dirname;
  }
}

const basePath = getResourcesPath();
const assetsPath = path.join(basePath, 'assets');

function checkFile(fullPath) {
  const exists = fs.existsSync(fullPath);
  
  if (!exists) {
    console.warn(`⚠️  File not found: ${fullPath}`);
  } else {
    console.log(`✅ File exists: ${fullPath}`);
  }
  
  return exists;
}

const config = {
  arduino: {
    baudRate: 9600,
    reconnectDelay: 3000,
    connectionTimeout: 1000,
    maxReconnectAttempts: 5,
    vendorIds: ['2341', '1a86', '0403', '2a03', '10c4'],
    portKeywords: ['arduino', 'usbserial', 'usbmodem', 'ch340', 'cp210'],
    
    // Настройки защиты от фантомных нажатий
    buttonDebounceMs: 200,           // Минимальное время между нажатиями одной кнопки (мс)
    maxPressesPerSecond: 10,         // Максимум нажатий в секунду (защита от спама)
  },
  
  video: {
    background: path.join(assetsPath, 'background.mp4'),
    videos: {
      '1': path.join(assetsPath, 'video1.mp4'),
      '2': path.join(assetsPath, 'video2.mp4'),
      '3': path.join(assetsPath, 'video3.mp4'),
      '4': path.join(assetsPath, 'video4.mp4'),
      '5': path.join(assetsPath, 'video5.mp4'),
    },
  },
  
  window: {
    fullscreen: true,
    frame: false,
  },
  
  debug: {
    visible: false,
    enableConsole: true, // Включаем для отладки
  },
};

// Проверяем файлы при запуске
if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
  console.log('\n🔍 Checking video files...');
  console.log(`📁 Assets path: ${assetsPath}\n`);
  
  checkFile(config.video.background);
  
  for (const [key, videoPath] of Object.entries(config.video.videos)) {
    checkFile(videoPath);
  }
  
  console.log('');
}

module.exports = config;