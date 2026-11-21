const WebSocket = require('ws');
const EventEmitter = require('events');

class OpenDartboardClient extends EventEmitter {
  constructor({ url = 'ws://localhost:13520', reconnectIntervalMs = 3000 } = {}) {
    super();
    this.url = url;
    this.reconnectIntervalMs = reconnectIntervalMs;
    this.ws = null;
    this.reconnectTimer = null;
    this.status = 'reconnecting'; // 'connected' | 'reconnecting' | 'disconnected'
    this.lastConnectedAt = null;
    this.lastAttemptAt = null;
    this.lastError = null;
    this.retryCount = 0;
    this.isShuttingDown = false;
  }

  start() {
    this.isShuttingDown = false;
    this.connect();
  }

  stop() {
    this.isShuttingDown = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.removeAllListeners();
        this.ws.terminate();
      } catch {
        // ignore close errors
      }
      this.ws = null;
    }
    this.updateStatus('disconnected');
  }

  getStatus() {
    return {
      status: this.status,
      connected: this.status === 'connected',
      url: this.url,
      reconnectIntervalMs: this.reconnectIntervalMs,
      lastConnectedAt: this.lastConnectedAt,
      lastAttemptAt: this.lastAttemptAt,
      lastError: this.lastError,
      retryCount: this.retryCount
    };
  }

  updateStatus(newStatus, errorMsg = null) {
    this.status = newStatus;
    if (errorMsg !== null) {
      this.lastError = errorMsg;
    }
    this.emit('status', this.getStatus());
  }

  connect() {
    if (this.isShuttingDown) return;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      try {
        this.ws.removeAllListeners();
        this.ws.terminate();
      } catch {
        // ignore
      }
      this.ws = null;
    }

    this.lastAttemptAt = new Date().toISOString();
    this.retryCount += 1;

    try {
      this.ws = new WebSocket(this.url, {
        handshakeTimeout: 2500
      });
    } catch (err) {
      this.updateStatus('reconnecting', err.message);
      this.scheduleReconnect();
      return;
    }

    this.ws.on('open', () => {
      this.retryCount = 0;
      this.lastConnectedAt = new Date().toISOString();
      this.lastError = null;
      this.updateStatus('connected');
    });

    this.ws.on('message', (data) => {
      const rawString = data.toString();
      this.emit('message', rawString);
    });

    this.ws.on('error', (err) => {
      const msg = err && err.code ? `${err.code} (${this.url})` : (err && err.message) || 'Connection failed';
      this.lastError = msg;
    });

    this.ws.on('close', () => {
      if (this.isShuttingDown) return;
      this.updateStatus('reconnecting', this.lastError || `OpenDartboard daemon unreachable at ${this.url}`);
      this.scheduleReconnect();
    });
  }

  scheduleReconnect() {
    if (this.isShuttingDown) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.reconnectIntervalMs);
  }

  reconnectNow(newUrl = null) {
    if (newUrl && typeof newUrl === 'string' && newUrl.trim().startsWith('ws')) {
      this.url = newUrl.trim();
    }
    this.connect();
    return this.getStatus();
  }

  sendCalibration(calibrationConfig) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const message = JSON.stringify({
          type: 'calibration_update',
          timestamp: new Date().toISOString(),
          calibration: calibrationConfig
        });
        this.ws.send(message);
        return { synced: true, message: 'Calibration synced to OpenDartboard over WebSocket' };
      } catch (err) {
        return { synced: false, message: `Saved locally; WebSocket send error: ${err.message}` };
      }
    }
    return {
      synced: false,
      message: 'Saved to config/calibration.json (will sync to OpenDartboard when daemon connects)'
    };
  }
}

module.exports = {
  OpenDartboardClient
};
