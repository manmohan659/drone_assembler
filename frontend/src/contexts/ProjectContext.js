// frontend/src/contexts/ProjectContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import { getUserId, getProjectId } from '../utils/userIdentification';
import Logger from '../utils/logger';

// Create the context
const ProjectContext = createContext();

// Create a custom hook to use the project context
export const useProject = () => useContext(ProjectContext);

// Provider component
export const ProjectProvider = ({ children }) => {
  const [currentProject, setCurrentProject] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [components, setComponents] = useState([]);
  const [completedSteps, setCompletedSteps] = useState([]);

  // Load project on component mount
  useEffect(() => {
    loadActiveProject();
  }, []);

  
  // Load the active project
  const loadActiveProject = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const userId = getUserId();
      const projectId = getProjectId();
      
      if (!projectId) {
        // No active project, so we're done loading
        setIsLoading(false);
        return;
      }
      
      Logger.info('Loading active project', { userId, projectId });
      
      const response = await fetch(`http://localhost:5003/api/assembly/project/${userId}/${projectId}/context`);
      
      if (!response.ok) {
        throw new Error(`Failed to load project: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Set current project
        const { context } = data;
        
        // Get or fetch the complete project details
        const projectDetail = await getFullProjectDetails(userId, projectId, context);
        
        setCurrentProject(projectDetail);
        setComponents(context.components || []);
        setCompletedSteps(context.completedSteps || []);
        
        Logger.info('Project loaded successfully', { 
          projectId, 
          name: context.projectName,
          componentCount: (context.components || []).length
        });
      } else {
        throw new Error(data.error || 'Failed to load project');
      }
    } catch (error) {
      Logger.error('Error loading project', error);
      setError('Failed to load your project. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Get full project details
  const getFullProjectDetails = async (userId, projectId, context = null) => {
    if (context && context.projectId === projectId) {
      // We already have the context, construct project object
      return {
        id: context.projectId,
        name: context.projectName,
        drone_type: context.droneType,
        current_step: context.currentStep,
        components: context.components,
        completed_steps: context.completedSteps,
        last_interaction: context.lastInteraction
      };
    }
    
    // Need to fetch the full project details
    try {
      const response = await fetch(`http://localhost:5003/api/assembly/project`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          projectId
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load project details: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        return data.project;
      } else {
        throw new Error(data.error || 'Failed to load project details');
      }
    } catch (error) {
      Logger.error('Error loading project details', error);
      throw error;
    }
  };

  // Set the active project
  const setActiveProject = async (projectObj) => {
    try {
      setIsLoading(true);
      
      // Clear current project data first
      setCurrentProject(null);
      setComponents([]);
      setCompletedSteps([]);
      
      const userId = getUserId();

      const projectId = typeof projectObj === 'object' ? 
      (projectObj.project_id || projectObj.projectId) : projectObj;
    
      if (!projectId || typeof projectId !== 'string') {
      console.error("[ERROR] Invalid project ID:", projectId);
      return;
    }
    
      
      Logger.info('Setting active project', { userId, projectId });
      
      // Load fresh project data
      const response = await fetch(`http://localhost:5003/api/assembly/project/${userId}/${projectId}/context`);
      
      if (!response.ok) {
        throw new Error(`Failed to load project: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Set current project with fresh data
        const { context } = data;
        
        setCurrentProject({
          project_id: context.projectId,
          project_name: context.projectName,
          drone_type: context.droneType,
          current_step: context.currentStep,
          components: context.components || [],
          completed_steps: context.completedSteps || [],
          last_interaction: context.lastInteraction
        });
        
        setComponents(context.components || []);
        setCompletedSteps(context.completedSteps || []);
        
        Logger.info('Project switched successfully', { 
          projectId, 
          name: context.projectName,
          componentCount: (context.components || []).length
        });
      } else {
        throw new Error(data.error || 'Failed to load project');
      }
    } catch (error) {
      Logger.error('Error setting active project', error);
      setError('Failed to set active project. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const addComponents = async (newComponents) => {
    console.log("[ProjectContext] addComponents called with:", newComponents);
    
    try {
      if (!currentProject || !newComponents || !newComponents.length) {
        console.log("[ProjectContext] Invalid inputs", {
          hasCurrentProject: !!currentProject,
          newComponentsLength: newComponents?.length
        });
        return [];
      }
      
      const userId = getUserId();
      const projectId = currentProject.project_id || currentProject.projectId;
      
      if (!projectId || typeof projectId !== 'string') {
        console.error("[ProjectContext] Invalid project ID:", projectId);
        return [];
      }
      
      // Safely clone existing components
      const existingComponents = Array.isArray(components) ? [...components] : [];
      console.log("[ProjectContext] Existing components:", existingComponents);
      
      // Create all components array - crucial to define this variable!
      const allComponents = [...existingComponents];
      let newComponentsAdded = false;
      
      // Validate and merge components
      newComponents.forEach(newComp => {
        // Handle string vs object components
        const newCompName = typeof newComp === 'string' ? newComp : newComp?.name;
        
        if (!newCompName) return; // Skip invalid components
        
        // Check for duplicates
        const exists = existingComponents.some(existing => {
          const existingName = typeof existing === 'string' ? existing : existing?.name;
          return existingName && 
                 newCompName && 
                 existingName.toLowerCase() === newCompName.toLowerCase();
        });
        
        if (!exists) {
          allComponents.push(newComp);
          newComponentsAdded = true;
          console.log("[ProjectContext] Added new component:", newComp);
        }
      });
      
      if (!newComponentsAdded) {
        console.log("[ProjectContext] No new components to add");
        return existingComponents;
      }
      
      console.log("[ProjectContext] Updating state with new components:", allComponents);
      
      // IMPORTANT: Update local state first!
      setComponents(allComponents);
      
      // Update project object
      setCurrentProject(prev => ({
        ...prev,
        components: allComponents
      }));
      
      // Send to backend
      const response = await fetch(`http://localhost:5003/api/assembly/project/components`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          projectId,
          components: allComponents
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      console.log("[ProjectContext] Components updated successfully");
      return allComponents;
    } catch (error) {
      console.error("[ProjectContext] Error updating components:", error);
      return components;
    }
  };
  // Add a completed step
  const addCompletedStep = async (step) => {
    try {
      if (!currentProject || !step) {
        return;
      }
      
      const userId = getUserId();
      const projectId = currentProject.project_id;
      
      // Update local state first for UI responsiveness
      const updatedSteps = [...completedSteps, step];
      setCompletedSteps(updatedSteps);
      
      // Also update the currentProject immediately for UI refresh
      setCurrentProject(prevProject => ({
        ...prevProject,
        current_step: step.stepNumber + 1,
        completed_steps: updatedSteps
      }));
      
      // Send to server
      Logger.info('Adding completed step', { 
        projectId,
        stepNumber: step.stepNumber
      });
      
      const response = await fetch(`http://localhost:5003/api/assembly/project/step`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          projectId,
          step
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to add completed step: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to add completed step');
      }
      
      Logger.info('Completed step added successfully', {
        projectId,
        stepNumber: step.stepNumber
      });

      console.log("[DEBUG] Sending to API:", {
        userId,
        projectId,
        components: components
      });

      return updatedSteps;
    } catch (error) {
      Logger.error('Error adding completed step', error);
      setError('Failed to add completed step. Please try again.');
      // Revert to the original state
      setCompletedSteps(completedSteps);
      // Also revert the currentProject
      setCurrentProject(prevProject => ({
        ...prevProject,
        current_step: prevProject.current_step, // Keep original step
        completed_steps: completedSteps
      }));
      return null;
    }
  };

  // Value to be provided by the context
  const value = {
    currentProject,
    isLoading,
    error,
    components,
    completedSteps,
    loadActiveProject,
    setActiveProject,
    addComponents,
    addCompletedStep
  };
  


  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};