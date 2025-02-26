// backend/src/services/projectService.js
const { supabase } = require('../supabaseClient');
const Logger = require('../utils/logger');

/**
 * Get or create a user's project
 */
const getOrCreateProject = async (userId, projectId, projectName = null) => {
  try {
    Logger.info('Getting or creating project', { userId, projectId });
    
    // Check if project exists
    const { data, error } = await supabase
      .from('assembly_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      Logger.error('Error fetching project', error);
      throw error;
    }
    
    // If project exists, return it
    if (data) {
      Logger.info('Found existing project', { projectId: data.project_id });
      return data;
    }
    
    // Create new project if it doesn't exist
    const defaultName = projectName || `Drone Project ${new Date().toLocaleDateString()}`;
    const { data: newProject, error: insertError } = await supabase
      .from('assembly_progress')
      .insert({
        user_id: userId,
        project_id: projectId,
        project_name: defaultName,
        current_step: 1,
        components: [],
        completed_steps: [],
        last_interaction: new Date().toISOString()
      })
      .select()
      .single();
    
    if (insertError) {
      Logger.error('Error creating project', insertError);
      throw insertError;
    }
    
    Logger.info('Created new project', { projectId, name: defaultName });
    return newProject;
  } catch (error) {
    Logger.error('Error in getOrCreateProject', error);
    throw error;
  }
};

/**
 * Get all projects for a user
 */
const getUserProjects = async (userId) => {
  try {
    Logger.info('Getting projects for user', { userId });
    
    const { data, error } = await supabase
      .from('assembly_progress')
      .select('*')
      .eq('user_id', userId)
      .order('last_interaction', { ascending: false });
    
    if (error) {
      Logger.error('Error fetching user projects', error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    Logger.error('Error in getUserProjects', error);
    throw error;
  }
};

// 2. Fix in projectService.js - updateComponents function
// Ensure data is properly formatted for database storage
const updateComponents = async (userId, projectId, components) => {
    try {
      Logger.info('Updating project components', { userId, projectId, componentCount: components?.length || 0 });
      Logger.componentUpdate(userId, projectId, components, 'updateComponents');
      
      // Debug log component structure before saving
      const componentTypes = components.map(c => typeof c);
      const hasStringComponents = components.some(c => typeof c === 'string');
      const hasObjectComponents = components.some(c => typeof c === 'object' && c !== null);
      
      Logger.info('Component structure analysis', {
        types: componentTypes,
        hasStringComponents,
        hasObjectComponents,
        sample: components.slice(0, 3)
      });

      // Normalize components to ensure consistent format
      const normalizedComponents = Array.isArray(components) ? components.map(comp => {
        if (typeof comp === 'string') {
          return { name: comp };
        }
        return comp;
      }) : [];
      
      // Log SQL query about to be executed
      Logger.dbQuery('update', 'assembly_progress', {
        userId,
        projectId,
        componentCount: normalizedComponents.length
      });
      
      const { data, error } = await supabase
        .from('assembly_progress')
        .update({ 
          components: normalizedComponents,
          last_interaction: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('project_id', projectId)
        .select()
        .single();
      
      if (error) {
        Logger.error('Error updating components in database', error);
        throw error;
      }
      
      // Log success with returned data structure
      Logger.info('Components updated successfully', {
        projectId,
        storedComponentCount: data?.components?.length || 0,
        updateTimestamp: data?.last_interaction
      });
      
      return data;
    } catch (error) {
      Logger.error('Error in updateComponents service', error);
      throw error;
    }
};
/**
 * Add a completed step to the project
 */
const addCompletedStep = async (userId, projectId, step) => {
  try {
    Logger.info('Adding completed step', { userId, projectId, step });
    
    // First get current completed steps
    const { data: currentData, error: fetchError } = await supabase
      .from('assembly_progress')
      .select('completed_steps')
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .single();
    
    if (fetchError) {
      Logger.error('Error fetching current steps', fetchError);
      throw fetchError;
    }
    
    // Append new step to existing steps
    const completedSteps = [...(currentData.completed_steps || []), step];
    
    // Update the record
    const { data, error } = await supabase
      .from('assembly_progress')
      .update({ 
        completed_steps: completedSteps,
        current_step: step.stepNumber + 1, // Increment current step
        last_interaction: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .select()
      .single();
    
    if (error) {
      Logger.error('Error updating completed steps', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    Logger.error('Error in addCompletedStep', error);
    throw error;
  }
};

/**
 * Update drone type for the project
 */
const updateDroneType = async (userId, projectId, droneType) => {
  try {
    Logger.info('Updating drone type', { userId, projectId, droneType });
    
    const { data, error } = await supabase
      .from('assembly_progress')
      .update({ 
        drone_type: droneType,
        last_interaction: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .select()
      .single();
    
    if (error) {
      Logger.error('Error updating drone type', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    Logger.error('Error in updateDroneType', error);
    throw error;
  }
};

/**
 * Get project context for Gemini API
 * Collects all relevant information to provide context for AI
 */
const getProjectContext = async (userId, projectId) => {
  try {
    Logger.info('Getting project context', { userId, projectId });
    
    const { data, error } = await supabase
      .from('assembly_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .single();
    
    if (error) {
      Logger.error('Error fetching project context', error);
      throw error;
    }
    
    return {
      projectId: data.project_id,
      projectName: data.project_name,
      currentStep: data.current_step,
      components: data.components || [],
      completedSteps: data.completed_steps || [],
      droneType: data.drone_type,
      lastInteraction: data.last_interaction
    };
  } catch (error) {
    Logger.error('Error in getProjectContext', error);
    throw error;
  }
};

module.exports = {
  getOrCreateProject,
  getUserProjects,
  updateComponents,
  addCompletedStep,
  updateDroneType,
  getProjectContext
};