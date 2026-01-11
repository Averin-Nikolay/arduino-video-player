// utils/logger.js
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

/**
 * Уровни логирования
 */
const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

class Logger {
  constructor(options = {}) {
    this.level = options.level || LogLevel.INFO;
    this.enableFile = options.enableFile ?? true;
    this.enableConsole = options.enableConsole ?? true;
    this.logDir = options.logDir || path.join(app.getPath('userData'), 'logs');
    this.maxLogFiles = options.maxLogFiles || 5;
    this.maxLogSize = options.maxLogSize || 5 * 1024 * 1024; // 5MB
    
    this.currentLogFile = null;
    this.currentLogStream = null;
    
    if (this.enableFile) {
      this.initializeLogFile();
    }
  }

  /**
   * Инициализация файла логов
   */
  initializeLogFile() {
    try {
      // Создаём директорию для логов
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }

      // Очищаем старые логи
      this.cleanOldLogs();

      // Создаём новый лог файл
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      this.currentLogFile = path.join(this.logDir, `app-${timestamp}.log`);
      
      this.currentLogStream = fs.createWriteStream(this.currentLogFile, {
        flags: 'a',
        encoding: 'utf8',
      });

      this.info('Logger initialized');
    } catch (error) {
      console.error('Failed to initialize log file:', error);
      this.enableFile = false;
    }
  }

  /**
   * Очистка старых логов
   */
  cleanOldLogs() {
    try {
      const files = fs.readdirSync(this.logDir)
        .filter(f => f.startsWith('app-') && f.endsWith('.log'))
        .map(f => ({
          name: f,
          path: path.join(this.logDir, f),
          time: fs.statSync(path.join(this.logDir, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time);

      // Удаляем файлы свыше лимита
      if (files.length > this.maxLogFiles) {
        files.slice(this.maxLogFiles).forEach(file => {
          try {
            fs.unlinkSync(file.path);
          } catch (err) {
            console.error('Failed to delete old log:', err);
          }
        });
      }

      // Удаляем файлы больше максимального размера
      files.forEach(file => {
        try {
          const stats = fs.statSync(file.path);
          if (stats.size > this.maxLogSize) {
            fs.unlinkSync(file.path);
          }
        } catch (err) {
          console.error('Failed to check log size:', err);
        }
      });
    } catch (error) {
      console.error('Failed to clean old logs:', error);
    }
  }

  /**
   * Форматирование сообщения лога
   */
  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const levelStr = Object.keys(LogLevel).find(k => LogLevel[k] === level);
    
    let formatted = `[${timestamp}] [${levelStr}] ${message}`;
    
    if (Object.keys(meta).length > 0) {
      formatted += ` ${JSON.stringify(meta)}`;
    }
    
    return formatted;
  }

  /**
   * Запись в лог
   */
  log(level, message, meta = {}) {
    if (level > this.level) {
      return; // Пропускаем если уровень ниже установленного
    }

    const formatted = this.formatMessage(level, message, meta);

    // Консольный вывод
    if (this.enableConsole) {
      switch (level) {
        case LogLevel.ERROR:
          console.error(formatted);
          break;
        case LogLevel.WARN:
          console.warn(formatted);
          break;
        default:
          console.log(formatted);
      }
    }

    // Файловый вывод
    if (this.enableFile && this.currentLogStream) {
      this.currentLogStream.write(formatted + '\n');
    }
  }

  /**
   * Методы для разных уровней
   */
  error(message, meta) {
    this.log(LogLevel.ERROR, message, meta);
  }

  warn(message, meta) {
    this.log(LogLevel.WARN, message, meta);
  }

  info(message, meta) {
    this.log(LogLevel.INFO, message, meta);
  }

  debug(message, meta) {
    this.log(LogLevel.DEBUG, message, meta);
  }

  /**
   * Закрытие лог файла
   */
  close() {
    if (this.currentLogStream) {
      this.currentLogStream.end();
      this.currentLogStream = null;
    }
  }
}

// Singleton instance
let loggerInstance = null;

function getLogger(options) {
  if (!loggerInstance) {
    loggerInstance = new Logger(options);
  }
  return loggerInstance;
}

module.exports = {
  Logger,
  LogLevel,
  getLogger,
};