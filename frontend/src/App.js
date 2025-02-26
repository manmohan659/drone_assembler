// frontend/src/App.js
import React from 'react';
import DroneAssemblyUI from './pages/DroneAssemblyUI';
import { ProjectProvider } from './contexts/ProjectContext';

const App = () => {
  return (
    <ProjectProvider>
      <DroneAssemblyUI />
    </ProjectProvider>
  );
};

export default App;