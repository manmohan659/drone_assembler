const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create a Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'drone-assembly' },
  transports: [
    // Console logging
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
        })
      )
    }),
    // File logging for errors
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error' 
    }),
    // File logging for database operations
    new winston.transports.File({ 
      filename: path.join(logsDir, 'database.log'),
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    // File logging for component tracking - specific to our issue
    new winston.transports.File({ 
      filename: path.join(logsDir, 'components.log'),
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ],
});

// Add specialized logging for component tracking
const Logger = {
  info: (message, meta = {}) => {
    logger.info(message, meta);
  },
  
  error: (message, error = {}) => {
    const errorObj = error instanceof Error 
      ? { message: error.message, stack: error.stack }
      : error;
    logger.error(message, { error: errorObj });
  },
  
  warn: (message, meta = {}) => {
    logger.warn(message, meta);
  },
  
  // Component tracking specific logs
  componentUpdate: (userId, projectId, components, source) => {
    logger.info('Component tracking - update', { 
      userId, 
      projectId, 
      componentCount: components?.length || 0,
      source,
      sampleComponents: components?.slice(0, 2) || []
    });
  },
  
  projectSwitch: (userId, fromProjectId, toProjectId) => {
    logger.info('Project switching event', { 
      userId, 
      fromProjectId, 
      toProjectId,
      timestamp: new Date().toISOString()
    });
  },
  
  // Database query logging
  dbQuery: (operation, table, params) => {
    logger.info(`DB Operation: ${operation}`, {
      table,
      params: JSON.stringify(params)
    });
  },
  
  // API response logging
  apiResponse: (endpoint, response) => {
    logger.info(`API Response: ${endpoint}`, {
      success: response.success,
      hasComponents: response.analysis?.identifiedComponents || response.analysis?.identifiedParts ? true : false,
      timestamp: new Date().toISOString()
    });
  },
  
  debug: (message, meta = {}) => {
    logger.debug(message, meta);
  },
  
  // Voice input logging
  voiceCapture: (transcript) => {
    logger.info('Voice input captured', { 
      transcript, 
      length: transcript?.length || 0,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = Logger;