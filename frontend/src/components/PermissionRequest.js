import React from 'react';
import { Camera, Mic } from 'lucide-react';

const PermissionRequest = ({ onPermissionsGranted }) => {
  const requestPermissions = async () => {
    try {
      await Promise.all([
        navigator.mediaDevices.getUserMedia({ video: true }),
        navigator.mediaDevices.getUserMedia({ audio: true })
      ]);
      onPermissionsGranted();
    } catch (error) {
      console.error('Permission denied:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#2D1573] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-4xl font-bold text-white mb-2">Drone AI Assistant</h1>
        <p className="text-gray-300 mb-12">Your intelligent companion for drone assembly</p>
        
        <div className="bg-[#3B1D8F]/50 backdrop-blur-sm rounded-3xl p-8 shadow-xl">
          <div className="flex justify-center gap-16 mb-10">
            <div className="text-center">
              <div className="w-20 h-20 bg-[#6949FF] rounded-2xl flex items-center justify-center mb-3">
                <Camera className="w-10 h-10 text-w8hite" />
              </div>
              <p className="text-gray-300">Camera Access</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-[#6949FF] rounded-2xl flex items-center justify-center mb-3">
                <Mic className="w-10 h-10 text-white" />
              </div>
              <p className="text-gray-300">Voice Control</p>
            </div>
          </div>
          
          <button
            onClick={requestPermissions}
            className="w-full py-4 bg-[#6949FF] rounded-xl text-white font-semibold text-lg hover:bg-[#5A3FE8] transition-colors"
          >
            Begin Assembly
          </button>
        </div>
      </div>
    </div>
  );
};

export default PermissionRequest;