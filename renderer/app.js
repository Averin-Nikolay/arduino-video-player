// renderer/app.js - С поддержкой выбора устройств и статистики

class VideoPlayer {
  constructor() {
    this.config = null;
    this.mediaEl = document.getElementById('media');
    this.overlayGroupEl = document.getElementById('overlay-group');
    this.statusEl = document.getElementById('status');
    this.debugEl = document.getElementById('debug');
    this.lastKeyEl = null;
    this.playingNowEl = null;
    this.statsEl = null;
    this.deviceSelectorEl = null;
    this.debugVisible = false;
    this.currentVideo = null;
    this.unsubscribeStatus = null;
    this.unsubscribeData = null;
    this.hasPlayedOnce = false;
    this.statsInterval = null;
  }

  async initialize() {
    try {
      console.log('Initializing video player...');

      if (!window.electronApi) {
        throw new Error('Electron API is not available');
      }

      await this.loadConfig();
      this.initDebugPanel();
      this.setupEventListeners();
      this.updateDebugVisibility();
      await this.showBackground();

      // Запускаем обновление статистики
      this.startStatsUpdate();

      console.log('Video player initialized');
    } catch (error) {
      console.error('Initialization failed:', error);
      this.showError('Ошибка инициализации: ' + error.message);
    }
  }

  async loadConfig() {
    this.config = await window.electronApi.getConfig();
    this.debugVisible = this.config.debug?.visible ?? false;
  }

  initDebugPanel() {
    this.debugEl.innerHTML = `
      <div style="margin-bottom: 10px;">
        <strong>Устройства:</strong>
        <button id="scanDevices" style="margin-left: 10px; padding: 5px 10px;">🔍 Сканировать</button>
        <button id="showStats" style="margin-left: 5px; padding: 5px 10px;">📊 Статистика</button>
      </div>
      <div id="deviceSelector" style="margin-bottom: 10px; max-height: 150px; overflow-y: auto;"></div>
      <div id="statsPanel" style="display: none; margin-bottom: 10px; font-size: 12px;"></div>
      <div style="border-top: 1px solid rgba(255,255,255,0.2); padding-top: 10px;">
        <div>Нажмите клавиши 1–5 для теста</div>
        <div id="lastKey">Последняя кнопка: -</div>
        <div id="playingNow">Играет: загрузка...</div>
      </div>
    `;

    this.lastKeyEl = document.getElementById('lastKey');
    this.playingNowEl = document.getElementById('playingNow');
    this.statsEl = document.getElementById('statsPanel');
    this.deviceSelectorEl = document.getElementById('deviceSelector');

    // Кнопка сканирования устройств
    document.getElementById('scanDevices').addEventListener('click', () => {
      this.scanDevices();
    });

    // Кнопка показа статистики
    document.getElementById('showStats').addEventListener('click', () => {
      this.toggleStats();
    });

    // Автоматически сканируем устройства при запуске
    this.scanDevices();
  }

  async scanDevices() {
    try {
      this.deviceSelectorEl.innerHTML = '<div style="color: #ffaa00;">Сканирование...</div>';
      
      const devices = await window.electronApi.scanDevices();
      
      if (devices.length === 0) {
        this.deviceSelectorEl.innerHTML = '<div style="color: #ff5555;">Устройства не найдены</div>';
        return;
      }

      this.deviceSelectorEl.innerHTML = '';
      
      devices.forEach(device => {
        const deviceEl = document.createElement('div');
        deviceEl.style.cssText = `
          padding: 8px;
          margin: 5px 0;
          background: rgba(255,255,255,0.1);
          border-radius: 4px;
          cursor: pointer;
          border: 2px solid ${device.isArduino ? '#00ff00' : 'transparent'};
        `;
        
        deviceEl.innerHTML = `
          <div style="font-weight: bold;">${device.path} ${device.isArduino ? '✓' : ''}</div>
          <div style="font-size: 11px; opacity: 0.8;">${device.description}</div>
        `;
        
        deviceEl.addEventListener('click', async () => {
          await this.connectToDevice(device.path, deviceEl);
        });
        
        this.deviceSelectorEl.appendChild(deviceEl);
      });
    } catch (error) {
      console.error('Failed to scan devices:', error);
      this.deviceSelectorEl.innerHTML = '<div style="color: #ff5555;">Ошибка сканирования</div>';
    }
  }

  async connectToDevice(devicePath, deviceEl) {
    try {
      // Визуально показываем попытку подключения
      const originalBg = deviceEl.style.background;
      deviceEl.style.background = 'rgba(255,200,0,0.3)';
      deviceEl.innerHTML += '<div style="font-size: 11px; color: #ffaa00;">Подключение...</div>';
      
      const success = await window.electronApi.connectDevice(devicePath);
      
      if (success) {
        // Убираем подсветку со всех устройств
        Array.from(this.deviceSelectorEl.children).forEach(el => {
          el.style.background = 'rgba(255,255,255,0.1)';
        });
        
        // Подсвечиваем выбранное
        deviceEl.style.background = 'rgba(0,255,0,0.2)';
        deviceEl.innerHTML = deviceEl.innerHTML.replace('Подключение...', '✓ Подключено');
      } else {
        deviceEl.style.background = originalBg;
        deviceEl.innerHTML = deviceEl.innerHTML.replace('Подключение...', '✗ Ошибка');
      }
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  }

  async toggleStats() {
    const isHidden = this.statsEl.style.display === 'none';
    this.statsEl.style.display = isHidden ? 'block' : 'none';
    
    if (isHidden) {
      await this.updateStats();
    }
  }

  async updateStats() {
    try {
      const stats = await window.electronApi.getArduinoStats();
      
      if (!stats) {
        this.statsEl.innerHTML = '<div style="color: #ff5555;">Статистика недоступна</div>';
        return;
      }

      this.statsEl.innerHTML = `
        <div style="color: #00ff00;"><strong>📊 Статистика</strong></div>
        <div>Время работы: ${stats.uptime}с</div>
        <div>Всего нажатий: ${stats.totalPresses}</div>
        <div>Заблокировано: ${stats.blockedPresses}</div>
        <div>Успешность: ${stats.successRate}%</div>
        <div style="margin-top: 5px;">Нажатий по кнопкам:</div>
        ${Object.entries(stats.pressesPerButton)
          .map(([key, count]) => `<div style="margin-left: 10px;">Кнопка ${key}: ${count}</div>`)
          .join('')}
        <button id="resetStats" style="margin-top: 5px; padding: 3px 8px;">🔄 Сбросить</button>
      `;

      // Кнопка сброса статистики
      const resetBtn = document.getElementById('resetStats');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          window.electronApi.resetArduinoStats();
          this.updateStats();
        });
      }
    } catch (error) {
      console.error('Failed to update stats:', error);
    }
  }

  startStatsUpdate() {
    // Обновляем статистику каждые 5 секунд, если панель открыта
    this.statsInterval = setInterval(() => {
      if (this.statsEl && this.statsEl.style.display !== 'none') {
        this.updateStats();
      }
    }, 5000);
  }

  updateDebugVisibility() {
    this.overlayGroupEl.classList.toggle('hidden', !this.debugVisible);
    console.log('Overlay group:', this.debugVisible ? 'visible' : 'hidden');
  }

  setupEventListeners() {
    this.unsubscribeStatus = window.electronApi.onArduinoStatus(
      (status) => this.updateStatus(status)
    );

    this.unsubscribeData = window.electronApi.onArduinoData(
      (data) => this.handleArduinoData(data)
    );

    window.addEventListener('keydown', (e) => this.handleKeyDown(e), true);

    this.mediaEl.addEventListener('playing', () => {
      this.hasPlayedOnce = true;
    });
  }

  updateStatus(status) {
    this.statusEl.textContent = `Arduino: ${status}`;

    if (status.includes('Подключена')) {
      this.statusEl.style.color = '#0f0';
    } else if (status.includes('Не найдена') || status.includes('выберите')) {
      this.statusEl.style.color = '#ff9800';
    } else {
      this.statusEl.style.color = '#f00';
    }
  }

  handleArduinoData(data) {
    const button = data.trim();
    this.lastKeyEl.textContent = `Последняя кнопка: ${button} (Arduino)`;

    if (/^[1-5]$/.test(button)) {
      this.playVideo(button);
    }
  }

  handleKeyDown(e) {
    if (e.code === 'Escape') {
      e.preventDefault();
      window.electronApi.closeApp();
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      this.debugVisible = !this.debugVisible;
      this.updateDebugVisibility();
      return;
    }

    if (/^[1-5]$/.test(e.key)) {
      e.preventDefault();
      this.lastKeyEl.textContent = `Последняя кнопка: ${e.key} (клавиатура)`;
      this.playVideo(e.key);
    }
  }

  async showBackground() {
    if (!this.config?.video?.background) return;

    this.mediaEl.loop = true;
    this.mediaEl.muted = false;
    this.mediaEl.volume = 1.0;
    this.mediaEl.src = this.config.video.background;
    this.currentVideo = 'background';

    await this.playMedia();
    this.playingNowEl.textContent = 'Играет: фон';
  }

  async playVideo(buttonNumber) {
    const src = this.config.video.videos[buttonNumber];
    if (!src) return;

    this.mediaEl.loop = false;
    this.mediaEl.src = src;
    this.currentVideo = buttonNumber;

    this.playingNowEl.textContent = `Играет: видео ${buttonNumber}`;

    await this.playMedia();

    this.mediaEl.onended = () => this.showBackground();
  }

  async playMedia() {
    this.mediaEl.pause();
    this.mediaEl.currentTime = 0;
    this.mediaEl.load();
    await this.mediaEl.play();
  }

  showError(message) {
    if (!this.playingNowEl) return;
    this.playingNowEl.textContent = `⚠️ ${message}`;
    this.playingNowEl.style.color = '#f00';
  }

  destroy() {
    if (this.unsubscribeStatus) this.unsubscribeStatus();
    if (this.unsubscribeData) this.unsubscribeData();
    if (this.statsInterval) clearInterval(this.statsInterval);
    this.mediaEl.pause();
    this.mediaEl.src = '';
  }
}

let player = null;

(async () => {
  player = new VideoPlayer();
  await player.initialize();
})();

window.addEventListener('beforeunload', () => {
  if (player) player.destroy();
});
