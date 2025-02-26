  // backend/src/controllers/projectController.js
  const projectService = require('../services/projectService');
  const Logger = require('../utils/logger');

  /**
   * Get or create a project
   */
  const getOrCreateProject = async (req, res) => {
    try {
      const { userId, projectId, projectName } = req.body;
      
      if (!userId || !projectId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: userId and projectId'
        });
      }
      
      Logger.info('Getting or creating project', { userId, projectId, projectName });
      
      const project = await projectService.getOrCreateProject(userId, projectId, projectName);
      
      res.json({
        success: true,
        project
      });
    } catch (error) {
      Logger.error('Error in getOrCreateProject controller', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Get all projects for a user
   */
  const getUserProjects = async (req, res) => {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameter: userId'
        });
      }
      
      Logger.info('Getting user projects', { userId });
      
      const projects = await projectService.getUserProjects(userId);
      
      res.json({
        success: true,
        projects
      });
    } catch (error) {
      Logger.error('Error in getUserProjects controller', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Update project components
   */
  const updateComponents = async (req, res) => {
    try {
      const { userId, projectId, components } = req.body;
      
      if (!userId || !projectId || !components) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: userId, projectId, and components'
        });
      }
      
      Logger.info('Updating components', { userId, projectId, componentCount: components.length });
      
      const project = await projectService.updateComponents(userId, projectId, components);
      
      res.json({
        success: true,
        project
      });
    } catch (error) {
      Logger.error('Error in updateComponents controller', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Add a completed step
   */
  const addCompletedStep = async (req, res) => {
    try {
      const { userId, projectId, step } = req.body;
      
      if (!userId || !projectId || !step) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: userId, projectId, and step'
        });
      }
      
      Logger.info('Adding completed step', { userId, projectId, step });
      
      const project = await projectService.addCompletedStep(userId, projectId, step);
      
      res.json({
        success: true,
        project
      });
    } catch (error) {
      Logger.error('Error in addCompletedStep controller', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Update drone type
   */
  const updateDroneType = async (req, res) => {
    try {
      const { userId, projectId, droneType } = req.body;
      
      if (!userId || !projectId || !droneType) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: userId, projectId, and droneType'
        });
      }
      
      Logger.info('Updating drone type', { userId, projectId, droneType });
      
      const project = await projectService.updateDroneType(userId, projectId, droneType);
      
      res.json({
        success: true,
        project
      });
    } catch (error) {
      Logger.error('Error in updateDroneType controller', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

  /**
   * Get project context
   */
  const getProjectContext = async (req, res) => {
    try {
      const { userId, projectId } = req.params;
      
      if (!userId || !projectId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: userId and projectId'
        });
      }
      
      Logger.info('Getting project context', { userId, projectId });
      
      const context = await projectService.getProjectContext(userId, projectId);
      
      res.json({
        success: true,
        context
      });
    } catch (error) {
      Logger.error('Error in getProjectContext controller', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };
  const identifyAndStoreComponents = async (req, res) => {
    try {
      const { userId, projectId, image } = req.body;
      
      if (!userId || !projectId || !image) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: userId, projectId, and image'
        });
      }
      
      Logger.info('Identifying components in image', { userId, projectId });
      
      // Call the Gemini component identification endpoint
      const response = await fetch(`http://localhost:5003/api/assembly/gemini/identify-parts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image,
          userId,
          projectId
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to identify components: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to identify components');
      }
      
      // The components should already be stored by the Gemini endpoint
      // Let's get the current project to confirm
      const currentProject = await projectService.getProjectContext(userId, projectId);
      
      res.json({
        success: true,
        identifiedComponents: data.analysis.identifiedParts || [],
        storedComponents: currentProject.components || [],
        message: 'Components identified and stored successfully'
      });
    } catch (error) {
      Logger.error('Error in identifyAndStoreComponents', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

  module.exports = {
    getOrCreateProject,
    getUserProjects,
    updateComponents,
    addCompletedStep,
    updateDroneType,
    getProjectContext,
    identifyAndStoreComponents
  };