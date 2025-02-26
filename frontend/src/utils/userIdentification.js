// frontend/src/utils/userIdentification.js
import Logger from './logger';

// Constants for localStorage keys
const USER_ID_KEY = 'drone_assembly_user_id';
const PROJECT_ID_KEY = 'drone_assembly_project_id';
const PROJECT_CACHE_PREFIX = 'drone_project_';

// Generate a unique user ID if none exists
export const getUserId = () => {
  let userId = localStorage.getItem(USER_ID_KEY);
  
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(USER_ID_KEY, userId);
  }
  
  return userId;
};

// Get current project ID
export const getProjectId = () => {
  return localStorage.getItem(PROJECT_ID_KEY);
};

// Set active project with proper cache clearing
export const setActiveProject = (projectId) => {
  const previousProjectId = getProjectId();
  
  // If switching projects, clear previous project's cache
  if (previousProjectId && previousProjectId !== projectId) {
    clearProjectCache(previousProjectId);
  }
  
  // Set new project ID
  localStorage.setItem(PROJECT_ID_KEY, projectId);
  
  // Log project switch for debugging
  console.log(`Switched projects: ${previousProjectId || 'none'} -> ${projectId}`);
  
  return projectId;
};

// Generate a new project ID
export const generateProjectId = () => {
  return `proj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

// Clear project-specific cache (components, steps, etc.)
export const clearProjectCache = (projectId) => {
  if (!projectId) return;
  
  // Clear any in-memory cache for this project
  const cacheKey = `${PROJECT_CACHE_PREFIX}${projectId}`;
  localStorage.removeItem(cacheKey);
  
  // Could add more specific cache clearing as needed
  console.log(`Cleared cache for project: ${projectId}`);
};

// Cache project data (for offline or quick access)
export const cacheProjectData = (projectId, data) => {
  if (!projectId || !data) return;
  
  const cacheKey = `${PROJECT_CACHE_PREFIX}${projectId}`;
  localStorage.setItem(cacheKey, JSON.stringify(data));
};

// Get cached project data
export const getCachedProjectData = (projectId) => {
  if (!projectId) return null;
  
  const cacheKey = `${PROJECT_CACHE_PREFIX}${projectId}`;
  const cached = localStorage.getItem(cacheKey);
  
  return cached ? JSON.parse(cached) : null;
};

// Export the PROJECT_ID_KEY constant so it can be used in other files
export { PROJECT_ID_KEY };