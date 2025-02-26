// frontend/src/utils/logger.js - Enhanced with voice and image tracking

const Logger = {
  info: (message, data = {}) => {
    console.log(`[${new Date().toISOString()}] INFO:`, message, data);
    Logger.storeLog('INFO', message, data);
  },
  
  error: (message, error = null) => {
    console.error(`[${new Date().toISOString()}] ERROR:`, message, error);
    Logger.storeLog('ERROR', message, error);
  },
  
  warn: (message, data = {}) => {
    console.warn(`[${new Date().toISOString()}] WARN:`, message, data);
    Logger.storeLog('WARN', message, data);
  },
  
  debug: (message, data = {}) => {
    console.debug(`[${new Date().toISOString()}] DEBUG:`, message, data);
    Logger.storeLog('DEBUG', message, data);
  },
  
  // Specialized logging methods for voice and image capture flow
  voiceCapture: (transcript) => {
    const logMessage = 'Voice input captured';
    console.log(`[${new Date().toISOString()}] VOICE:`, logMessage, { transcript });
    Logger.storeLog('VOICE', logMessage, { transcript });
  },
  
  imageCapture: (imageSize) => {
    const logMessage = 'Image captured';
    console.log(`[${new Date().toISOString()}] IMAGE:`, logMessage, { size: imageSize });
    Logger.storeLog('IMAGE', logMessage, { size: imageSize });
  },
  
  apiRequest: (endpoint, payload) => {
    const logMessage = `API request to ${endpoint}`;
    // Don't log the full image data to console
    const safePayload = { ...payload };
    if (safePayload.image) {
      safePayload.image = `[Image data: ${safePayload.image.length} chars]`;
    }
    
    console.log(`[${new Date().toISOString()}] API:`, logMessage, safePayload);
    Logger.storeLog('API', logMessage, safePayload);
  },
  
  apiResponse: (endpoint, status, data) => {
    const logMessage = `API response from ${endpoint}: ${status}`;
    console.log(`[${new Date().toISOString()}] API:`, logMessage, data);
    Logger.storeLog('API', logMessage, data);
  },
  
  // Store logs in localStorage for debugging
  storeLog: (level, message, data) => {
    try {
      const MAX_LOGS = 100;
      const logs = JSON.parse(localStorage.getItem('droneAssemblyLogs') || '[]');
      
      // Create a safe copy of data to store
      let safeData = data;
      if (data && typeof data === 'object') {
        safeData = { ...data };
        // Don't store entire image data
        if (safeData.image && typeof safeData.image === 'string' && safeData.image.length > 100) {
          safeData.image = `[Image data: ${safeData.image.length} chars]`;
        }
      }
      
      logs.push({
        timestamp: new Date().toISOString(),
        level,
        message,
        data: safeData
      });
      
      // Keep only recent logs
      if (logs.length > MAX_LOGS) {
        logs.splice(0, logs.length - MAX_LOGS);
      }
      
      localStorage.setItem('droneAssemblyLogs', JSON.stringify(logs));
    } catch (error) {
      console.error('Failed to store log:', error);
    }
  },
  
  // Get all stored logs
  getLogs: () => {
    try {
      return JSON.parse(localStorage.getItem('droneAssemblyLogs') || '[]');
    } catch (error) {
      console.error('Failed to retrieve logs:', error);
      return [];
    }
  },
  
  // Clear all stored logs
  clearLogs: () => {
    localStorage.removeItem('droneAssemblyLogs');
    console.info('Logs cleared');
  }
};

export default Logger;