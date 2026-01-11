// utils/arduino.js - Улучшенная версия с защитой от фантомных нажатий
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const config = require('../config');
const EventEmitter = require('events');

class ArduinoManager extends EventEmitter {
  constructor(webContents) {
    super();
    this.webContents = webContents;
    this.port = null;
    this.reconnectAttempts = 0;
    this.maxAttempts = config.arduino.maxReconnectAttempts;
    this.reconnectTimer = null;
    this.isConnecting = false;
    this.isClosing = false;
    
    // Защита от фантомных нажатий
    this.buttonDebounceMs = config.arduino.buttonDebounceMs || 200;
    this.lastButtonTime = {};
    this.buttonPressHistory = {}; // История нажатий для анализа
    this.maxPressesPerSecond = config.arduino.maxPressesPerSecond || 10;
    
    // Статистика для отладки
    this.stats = {
      totalPresses: 0,
      blockedPresses: 0,
      pressesPerButton: {},
      lastReset: Date.now(),
    };

    // Сброс статистики каждую минуту
    setInterval(() => this.resetStats(), 60000);
  }

  /**
   * Подключение к указанному порту
   */
  async connectToPort(portPath) {
    if (this.isConnecting || this.isClosing) {
      console.log('Connection already in progress or closing');
      return false;
    }

    this.isConnecting = true;

    try {
      // Закрываем предыдущее соединение, если оно есть
      if (this.port?.isOpen) {
        await this.closePort();
      }

      this.port = new SerialPort({
        path: portPath,
        baudRate: config.arduino.baudRate,
        autoOpen: false,
      });

      // Открываем порт
      await this.openPort();

      const parser = this.port.pipe(
        new ReadlineParser({ delimiter: '\n' })
      );

      this.setupPortHandlers(parser, portPath);
      
      return true;
    } catch (error) {
      console.error('Failed to connect to port:', error);
      this.sendStatus(`Ошибка: ${error.message}`);
      this.isConnecting = false;
      return false;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Поиск подходящего порта Arduino (старый метод для совместимости)
   */
  async findPort() {
    try {
      const ports = await SerialPort.list();
      
      for (const info of ports) {
        const { path, manufacturer = '', vendorId, productId } = info;
        
        if (config.debug.enableConsole) {
          console.log('Found port:', { path, manufacturer, vendorId, productId });
        }

        // Проверка по Vendor ID
        if (config.arduino.vendorIds.includes(vendorId)) {
          return path;
        }

        // Проверка по ключевым словам
        const manufLow = manufacturer.toLowerCase();
        const pathLow = path.toLowerCase();
        
        const hasKeyword = config.arduino.portKeywords.some(
          keyword => manufLow.includes(keyword) || pathLow.includes(keyword)
        );
        
        if (hasKeyword) {
          return path;
        }

        // Проверка паттерна COM-порта (Windows)
        if (/^COM\d+$/i.test(path)) {
          return path;
        }
      }

      return null;
    } catch (error) {
      console.error('Error finding Arduino port:', error);
      return null;
    }
  }

  /**
   * Подключение (старый метод для совместимости)
   */
  async connect() {
    const portPath = await this.findPort();
    
    if (!portPath) {
      this.sendStatus('Не найдена');
      this.scheduleReconnect();
      return;
    }

    await this.connectToPort(portPath);
  }

  /**
   * Открытие порта с промисом
   */
  openPort() {
    return new Promise((resolve, reject) => {
      this.port.open((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Настройка обработчиков событий порта
   */
  setupPortHandlers(parser, portPath) {
    this.port.on('open', () => {
      this.reconnectAttempts = 0;
      this.sendStatus(`Подключена: ${portPath}`);
      this.emit('connected', portPath);
      console.log('Arduino connected successfully');
    });

    parser.on('data', (data) => {
      this.handleIncomingData(data);
    });

    this.port.on('error', (err) => {
      console.error('Serial port error:', err.message);
      this.sendStatus(`Ошибка: ${err.message}`);
      this.handleDisconnect();
    });

    this.port.on('close', () => {
      console.log('Serial port closed');
      this.handleDisconnect();
    });
  }

  /**
   * Обработка входящих данных с защитой от фантомных нажатий
   */
  handleIncomingData(data) {
    const button = data.toString().trim();
    
    // Валидация входных данных
    if (!this.validateButton(button)) {
      console.warn('Invalid button data received:', button);
      this.stats.blockedPresses++;
      return;
    }

    const now = Date.now();
    
    // 1. Простой debounce (защита от дребезга)
    const lastTime = this.lastButtonTime[button] || 0;
    if (now - lastTime < this.buttonDebounceMs) {
      this.stats.blockedPresses++;
      if (config.debug.enableConsole) {
        console.log(`Debounced: ${button} (too fast)`);
      }
      return;
    }

    // 2. Защита от множественных нажатий (спам-фильтр)
    if (this.isSpamming(button, now)) {
      this.stats.blockedPresses++;
      console.warn(`⚠️ Possible spam detected for button ${button}`);
      this.sendStatus(`⚠️ Спам кнопки ${button} - проверьте контакты`);
      return;
    }

    // Обновляем время последнего нажатия
    this.lastButtonTime[button] = now;
    
    // Добавляем в историю
    this.addToHistory(button, now);
    
    // Обновляем статистику
    this.stats.totalPresses++;
    this.stats.pressesPerButton[button] = (this.stats.pressesPerButton[button] || 0) + 1;
    
    // Отправляем данные в рендерер
    this.sendData(button);
    this.emit('button-pressed', button);

    // Логируем успешное нажатие
    if (config.debug.enableConsole) {
      console.log(`✓ Button pressed: ${button}`);
    }
  }

  /**
   * Проверка на спам (множественные нажатия за короткое время)
   */
  isSpamming(button, now) {
    if (!this.buttonPressHistory[button]) {
      this.buttonPressHistory[button] = [];
    }

    const history = this.buttonPressHistory[button];
    
    // Удаляем старые записи (старше 1 секунды)
    while (history.length > 0 && now - history[0] > 1000) {
      history.shift();
    }

    // Проверяем количество нажатий за последнюю секунду
    if (history.length >= this.maxPressesPerSecond) {
      return true; // Это спам
    }

    return false;
  }

  /**
   * Добавление нажатия в историю
   */
  addToHistory(button, timestamp) {
    if (!this.buttonPressHistory[button]) {
      this.buttonPressHistory[button] = [];
    }

    this.buttonPressHistory[button].push(timestamp);

    // Ограничиваем размер истории
    if (this.buttonPressHistory[button].length > 100) {
      this.buttonPressHistory[button].shift();
    }
  }

  /**
   * Валидация данных кнопки
   */
  validateButton(button) {
    return typeof button === 'string' && /^[1-5]$/.test(button);
  }

  /**
   * Получение статистики
   */
  getStats() {
    const uptime = Math.floor((Date.now() - this.stats.lastReset) / 1000);
    
    return {
      ...this.stats,
      uptime,
      successRate: this.stats.totalPresses > 0 
        ? ((this.stats.totalPresses - this.stats.blockedPresses) / this.stats.totalPresses * 100).toFixed(1)
        : 100,
    };
  }

  /**
   * Сброс статистики
   */
  resetStats() {
    const stats = this.getStats();
    
    if (config.debug.enableConsole) {
      console.log('📊 Stats:', stats);
    }

    this.stats = {
      totalPresses: 0,
      blockedPresses: 0,
      pressesPerButton: {},
      lastReset: Date.now(),
    };
  }

  /**
   * Обработка отключения
   */
  handleDisconnect() {
    if (this.isClosing) {
      return;
    }

    this.emit('disconnected');
    
    if (this.reconnectAttempts < this.maxAttempts) {
      this.reconnectAttempts++;
      this.sendStatus(
        `Переподключение (${this.reconnectAttempts}/${this.maxAttempts})...`
      );
      this.scheduleReconnect();
    } else {
      this.sendStatus('Отключена (достигнуто макс. попыток)');
      this.emit('max-reconnect-reached');
    }
  }

  /**
   * Планирование переподключения
   */
  scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, config.arduino.reconnectDelay);
  }

  /**
   * Отправка статуса в рендерер
   */
  sendStatus(status) {
    if (this.webContents && !this.webContents.isDestroyed()) {
      this.webContents.send('arduino-status', status);
    }
  }

  /**
   * Отправка данных в рендерер
   */
  sendData(data) {
    if (this.webContents && !this.webContents.isDestroyed()) {
      this.webContents.send('arduino-data', data);
    }
  }

  /**
   * Закрытие порта с промисом
   */
  closePort() {
    return new Promise((resolve) => {
      if (!this.port || !this.port.isOpen) {
        resolve();
        return;
      }

      this.port.close((err) => {
        if (err) {
          console.error('Error closing port:', err);
        }
        resolve();
      });
    });
  }

  /**
   * Graceful shutdown
   */
  async close() {
    this.isClosing = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    await this.closePort();
    this.removeAllListeners();

    console.log('Arduino manager closed');
  }

  /**
   * Получение статуса подключения
   */
  isConnected() {
    return this.port?.isOpen === true;
  }

  /**
   * Ручное переподключение
   */
  async reconnect() {
    this.reconnectAttempts = 0;
    await this.connect();
  }
}

module.exports = ArduinoManager;