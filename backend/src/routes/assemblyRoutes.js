// backend/src/routes/assemblyRoutes.js
const express = require('express');
const assemblyController = require('../controllers/assemblyController');
const geminiController = require('../controllers/geminiController');
const projectController = require('../controllers/projectController');

const router = express.Router();

// Original routes
router.post('/start', assemblyController.startAssembly);
router.get('/progress', assemblyController.getProgress);
router.post('/identify', assemblyController.identifyComponents);
router.post('/visualize', assemblyController.generateVisualization);

// Gemini API routes
router.post('/gemini/validate', geminiController.apiLimiter.checkLimit, geminiController.validateDroneAssembly);
router.post('/gemini/instructions', geminiController.apiLimiter.checkLimit, geminiController.getDroneInstructions);
router.post('/gemini/identify-parts', geminiController.apiLimiter.checkLimit, geminiController.identifyDroneParts);
router.get('/gemini/test', geminiController.testGeminiConnection);
router.post('/gemini/voice-query', geminiController.apiLimiter.checkLimit, geminiController.handleVoiceQuery);

// New project management routes
router.post('/project', projectController.getOrCreateProject);
router.get('/projects/:userId', projectController.getUserProjects);
router.post('/project/components', projectController.updateComponents);
router.post('/project/step', projectController.addCompletedStep);
router.post('/project/drone-type', projectController.updateDroneType);
router.get('/project/:userId/:projectId/context', projectController.getProjectContext);
router.post('/project/identify-components', projectController.identifyAndStoreComponents);
// Update the visualize route to expect prompt
router.post('/visualize', assemblyController.generateVisualization);
router.get('/visualize/progress/:taskId', assemblyController.checkImageProgress);
router.get('/visualize/result/:taskId', assemblyController.getGeneratedImage);
module.exports = router;