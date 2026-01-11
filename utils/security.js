// utils/security.js
const { app, session } = require('electron');

/**
 * Настройка безопасности приложения
 */
function setupSecurity() {
  // Отключаем предупреждения безопасности в production
  if (app.isPackaged) {
    process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
  }

  // Настройки безопасности для всех сессий
  app.on('web-contents-created', (event, contents) => {
    // Запрет навигации на внешние ресурсы
    contents.on('will-navigate', (event, navigationUrl) => {
      const parsedUrl = new URL(navigationUrl);
      
      // Разрешаем только file:// протокол
      if (parsedUrl.protocol !== 'file:') {
        console.warn('Blocked navigation to:', navigationUrl);
        event.preventDefault();
      }
    });

    // Запрет открытия новых окон
    contents.setWindowOpenHandler(({ url }) => {
      console.warn('Blocked window.open to:', url);
      return { action: 'deny' };
    });

    // Отключаем remote модуль
    contents.on('remote-require', (event) => {
      event.preventDefault();
    });

    contents.on('remote-get-builtin', (event) => {
      event.preventDefault();
    });

    contents.on('remote-get-global', (event) => {
      event.preventDefault();
    });

    contents.on('remote-get-current-window', (event) => {
      event.preventDefault();
    });

    contents.on('remote-get-current-web-contents', (event) => {
      event.preventDefault();
    });
  });

  // Устанавливаем разрешения
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      // Запрещаем все разрешения по умолчанию
      const allowedPermissions = [];
      
      if (allowedPermissions.includes(permission)) {
        callback(true);
      } else {
        console.warn('Blocked permission request:', permission);
        callback(false);
      }
    }
  );

  // Очищаем кэш при старте
  session.defaultSession.clearCache();

  console.log('Security measures applied');
}

/**
 * Валидация путей к файлам
 */
function isValidFilePath(filePath, allowedDir) {
  const path = require('path');
  const resolvedPath = path.resolve(filePath);
  const resolvedAllowedDir = path.resolve(allowedDir);
  
  return resolvedPath.startsWith(resolvedAllowedDir);
}

/**
 * Санитизация пользовательского ввода
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Удаляем потенциально опасные символы
  return input.replace(/[<>\"'`]/g, '');
}

module.exports = {
  setupSecurity,
  isValidFilePath,
  sanitizeInput,
};