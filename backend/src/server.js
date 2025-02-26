// backend/src/server.js
require('dotenv').config();

// Add immediate environment check
console.log('Environment Check:');
console.log('Current working directory:', process.cwd());
console.log('ENV variables loaded:', {
  BACKEND_PORT: process.env.BACKEND_PORT || 'Not set',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'Present (length: ' + process.env.GEMINI_API_KEY.length + ')' : 'Not set'
});

const express = require('express');
const assemblyRoutes = require('./routes/assemblyRoutes');

const cors = require('cors');
const app = express();

// CORS configuration
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }));

app.use(express.json({ limit: '50mb' }));

// Add a test route directly in server.js to verify basic connectivity
app.get('/test', (req, res) => {
  res.json({ message: 'Basic server test successful' });
});

app.use('/api/assembly', assemblyRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

const PORT = process.env.BACKEND_PORT || 5003;
app.listen(PORT, () => {
  console.log(`\nServer running on port ${PORT}`);
  console.log('Full server configuration:', {
    port: PORT,
    nodeEnv: process.env.NODE_ENV,
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    corsOrigins: ['http://localhost:3000', 'http://localhost:3001']
  });
});