import React, { useState } from 'react';
import PermissionRequest from '../components/PermissionRequest';
import MainInterface from '../components/MainInterface';

const DroneAssemblyUI = () => {
  const [permissionsGranted, setPermissionsGranted] = useState(false);

  return !permissionsGranted ? (
    <PermissionRequest onPermissionsGranted={() => setPermissionsGranted(true)} />
  ) : (
    <MainInterface />
  );
};

export default DroneAssemblyUI;