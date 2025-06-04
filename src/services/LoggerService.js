/**
 * Logger service for Chrome extension
 * Follows Single Responsibility Principle - handles only logging functionality
 * 
 * @class LoggerService
 */
if (typeof LoggerService === 'undefined') {
  // Define LoggerService class
  class LoggerService {
    /**
     * Creates an instance of LoggerService
     * 
     * @param {string} component - Component name for logging context
     */
    constructor(component) {
      this.component = component;
      this.isDevelopment = !chrome.runtime.getManifest().update_url;
    }

    /**
     * Logs info level messages
     * 
     * @param {string} message - Log message
     * @param {Object} data - Additional data to log
     */
    info(message, data = null) {
      this._log('INFO', message, data);
    }

    /**
     * Logs error level messages
     * 
     * @param {string} message - Error message
     * @param {Error|Object} error - Error object or additional data
     */
    error(message, error = null) {
      this._log('ERROR', message, error);
    }

    /**
     * Logs warning level messages
     * 
     * @param {string} message - Warning message
     * @param {Object} data - Additional data to log
     */
    warn(message, data = null) {
      this._log('WARN', message, data);
    }

    /**
     * Logs debug level messages (only in development)
     * 
     * @param {string} message - Debug message
     * @param {Object} data - Additional data to log
     */
    debug(message, data = null) {
      if (this.isDevelopment) {
        this._log('DEBUG', message, data);
      }
    }

    /**
     * Internal logging method
     * 
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {Object} data - Additional data
     * @private
     */
    _log(level, message, data) {
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] [${level}] [${this.component}] ${message}`;
      
      console.log(logEntry, data || '');
      
      // Store logs in chrome storage for debugging
      if (this.isDevelopment) {
        this._storeLog({ timestamp, level, component: this.component, message, data });
      }
    }

    /**
     * Stores log entry in Chrome storage
     * 
     * @param {Object} logEntry - Log entry object
     * @private
     */
    async _storeLog(logEntry) {
      try {
        const result = await chrome.storage.local.get(['logs']);
        const logs = result.logs || [];
        logs.push(logEntry);
        
        // Keep only last 100 logs
        if (logs.length > 100) {
          logs.splice(0, logs.length - 100);
        }
        
        await chrome.storage.local.set({ logs });
      } catch (error) {
        console.error('Failed to store log:', error);
      }
    }
  }

  // Make LoggerService available globally in both environments
  if (typeof window !== 'undefined') {
    window.LoggerService = LoggerService;
  }
  
  // Make it available for importScripts in service worker
  if (typeof self !== 'undefined' && typeof importScripts !== 'undefined') {
    self.LoggerService = LoggerService;
  }
  
  // Make it the global LoggerService
  globalThis.LoggerService = LoggerService;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LoggerService;
} 