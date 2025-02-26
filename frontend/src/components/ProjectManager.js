// frontend/src/components/ProjectManager.js
import React, { useState, useEffect } from 'react';
import { FolderPlus, FolderOpen, Clock, AlertTriangle } from 'lucide-react';
import Logger from '../utils/logger';
import { getUserId, getProjectId, setActiveProject, generateProjectId } from '../utils/userIdentification';

const ProjectManager = ({ onProjectSelect, onNewProject }) => {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [droneType, setDroneType] = useState('');

  // Common drone types
  const droneTypes = [
    'Racing Drone', 
    'Camera Drone', 
    'FPV Drone', 
    'Mini Drone',
    'Photography Drone',
    'Delivery Drone',
    'Other'
  ];

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  // Load projects on component mount
  useEffect(() => {
    loadProjects();
  }, []);

  // Load projects from the API
  const loadProjects = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const userId = getUserId();
      Logger.info('Loading projects for user', { userId });
      
      const response = await fetch(`http://localhost:5003/api/assembly/projects/${userId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to load projects: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setProjects(data.projects || []);
        Logger.info('Projects loaded successfully', { count: data.projects?.length || 0 });
      } else {
        throw new Error(data.error || 'Failed to load projects');
      }
    } catch (error) {
      Logger.error('Error loading projects', error);
      setError('Failed to load your projects. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle project selection
  const handleSelectProject = (project) => {
    try {
      Logger.info('Project selected', { 
        projectId: project.project_id, 
        name: project.project_name 
      });
      
      // Set the active project
      setActiveProject(project.project_id);
      
      // Call the parent callback
      if (onProjectSelect) {
        onProjectSelect(project);
      }
    } catch (error) {
      Logger.error('Error selecting project', error);
      setError('Failed to select project. Please try again.');
    }
  };

  // Create a new project
  const handleCreateProject = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const userId = getUserId();
      const projectId = generateProjectId();
      const projectName = newProjectName || `Drone Project ${new Date().toLocaleDateString()}`;
      
      Logger.info('Creating new project', { userId, projectId, projectName, droneType });
      
      const response = await fetch(`http://localhost:5003/api/assembly/project`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          projectId,
          projectName
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create project: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        // If drone type is specified, update it
        if (droneType) {
          await fetch(`http://localhost:5003/api/assembly/project/drone-type`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userId,
              projectId,
              droneType
            })
          });
        }
        
        Logger.info('Project created successfully', { 
          projectId, 
          name: data.project.project_name 
        });
        
        // Set as active project
        setActiveProject(projectId);
        
        // Reset form
        setNewProjectName('');
        setDroneType('');
        setShowCreateProject(false);
        
        // Reload projects
        await loadProjects();
        
        // Call the parent callback
        if (onNewProject) {
          onNewProject(data.project);
        }
      } else {
        throw new Error(data.error || 'Failed to create project');
      }
    } catch (error) {
      Logger.error('Error creating project', error);
      setError('Failed to create project. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
      <h2 className="text-lg font-semibold text-white mb-4">Drone Projects</h2>
      
      {error && (
        <div className="bg-red-900/30 border border-red-800/50 rounded-lg p-3 mb-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
          <p className="text-red-200 text-sm">{error}</p>
        </div>
      )}
      
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <>
          {showCreateProject ? (
            <div className="bg-indigo-900/20 rounded-xl p-4 mb-4">
              <h3 className="text-indigo-300 font-medium mb-3">Create New Project</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Project Name</label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="My Drone Assembly"
                    className="w-full bg-black/40 border border-indigo-800/50 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Drone Type</label>
                  <select
                    value={droneType}
                    onChange={(e) => setDroneType(e.target.value)}
                    className="w-full bg-black/40 border border-indigo-800/50 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="">Select drone type...</option>
                    {droneTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowCreateProject(false)}
                    className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateProject}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Create Project
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCreateProject(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white w-full px-4 py-2 rounded-lg mb-4 flex items-center justify-center gap-2 transition-colors"
            >
              <FolderPlus className="w-4 h-4" />
              New Project
            </button>
          )}
          
          {projects.length > 0 ? (
            <div className="space-y-2">
              {projects.map(project => (
                <div
                  key={project.project_id}
                  onClick={() => handleSelectProject(project)}
                  className="bg-black/20 hover:bg-black/30 rounded-xl p-3 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <FolderOpen className="w-5 h-5 text-indigo-400 mt-1" />
                      <div>
                        <h3 className="text-white font-medium">{project.project_name || 'Unnamed Project'}</h3>
                        <p className="text-indigo-200 text-xs">
                          {project.drone_type ? `${project.drone_type} • ` : ''}
                          Step {project.current_step}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-gray-400 text-xs">
                      <Clock className="w-3 h-3" />
                      {formatDate(project.last_interaction)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-indigo-200">
              No projects yet. Create your first drone project!
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProjectManager;