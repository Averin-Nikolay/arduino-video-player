// utils/deviceManager.js - Менеджер устройств ввода
const { SerialPort } = require('serialport');
const EventEmitter = require('events');

class DeviceManager extends EventEmitter {
  constructor() {
    super();
    this.availableDevices = [];
    this.selectedDevice = null;
  }

  /**
   * Сканирование всех доступных устройств
   */
  async scanDevices() {
    try {
      const ports = await SerialPort.list();
      
      this.availableDevices = ports.map(port => ({
        path: port.path,
        manufacturer: port.manufacturer || 'Unknown',
        vendorId: port.vendorId || 'N/A',
        productId: port.productId || 'N/A',
        serialNumber: port.serialNumber || 'N/A',
        description: this.getDeviceDescription(port),
        isArduino: this.isLikelyArduino(port),
      }));

      console.log(`Found ${this.availableDevices.length} devices`);
      return this.availableDevices;
    } catch (error) {
      console.error('Error scanning devices:', error);
      return [];
    }
  }

  /**
   * Получение описания устройства
   */
  getDeviceDescription(port) {
    const parts = [];
    
    if (port.manufacturer) {
      parts.push(port.manufacturer);
    }
    
    if (port.vendorId && port.productId) {
      parts.push(`VID:${port.vendorId} PID:${port.productId}`);
    }
    
    if (port.serialNumber) {
      parts.push(`S/N:${port.serialNumber}`);
    }

    return parts.length > 0 ? parts.join(' | ') : port.path;
  }

  /**
   * Проверка, похоже ли устройство на Arduino
   */
  isLikelyArduino(port) {
    const arduinoVendorIds = ['2341', '1a86', '0403', '2a03', '10c4', '0403'];
    const arduinoKeywords = ['arduino', 'usbserial', 'usbmodem', 'ch340', 'cp210'];

    // Проверка по VendorID
    if (arduinoVendorIds.includes(port.vendorId)) {
      return true;
    }

    // Проверка по ключевым словам
    const manufLow = (port.manufacturer || '').toLowerCase();
    const pathLow = port.path.toLowerCase();
    
    return arduinoKeywords.some(
      keyword => manufLow.includes(keyword) || pathLow.includes(keyword)
    );
  }

  /**
   * Выбор устройства по пути
   */
  selectDevice(devicePath) {
    const device = this.availableDevices.find(d => d.path === devicePath);
    
    if (device) {
      this.selectedDevice = device;
      this.emit('device-selected', device);
      console.log(`Selected device: ${device.path}`);
      return true;
    }
    
    return false;
  }

  /**
   * Получение выбранного устройства
   */
  getSelectedDevice() {
    return this.selectedDevice;
  }

  /**
   * Автоматический выбор наиболее подходящего устройства
   */
  autoSelectDevice() {
    // Сначала ищем Arduino-подобные устройства
    const arduinoDevices = this.availableDevices.filter(d => d.isArduino);
    
    if (arduinoDevices.length > 0) {
      this.selectDevice(arduinoDevices[0].path);
      return arduinoDevices[0];
    }

    // Если не нашли Arduino, берём первое доступное
    if (this.availableDevices.length > 0) {
      this.selectDevice(this.availableDevices[0].path);
      return this.availableDevices[0];
    }

    return null;
  }

  /**
   * Сохранение выбранного устройства в настройки
   */
  saveDevicePreference(devicePath) {
    // Можно сохранить в файл настроек
    this.emit('save-preference', devicePath);
  }
}

module.exports = DeviceManager;