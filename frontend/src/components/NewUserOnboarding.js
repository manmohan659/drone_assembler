// frontend/src/components/NewUserOnboarding.js
import React, { useState } from 'react';
import { Rocket, Check, ArrowRight, Loader } from 'lucide-react';
import Logger from '../utils/logger';
import { getUserId, setActiveProject } from '../utils/userIdentification';

const NewUserOnboarding = ({ onComplete, onGenerateImage }) => {
  const [step, setStep] = useState(1);
  const [droneType, setDroneType] = useState('');
  const [hasComponents, setHasComponents] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [welcomeMessage, setWelcomeMessage] = useState('');

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

  // Progress to next step
  const nextStep = () => {
    setStep(step + 1);
  };

  // Handle drone type selection
  const handleDroneTypeSelect = (type) => {
    setDroneType(type);
    nextStep();
  };

  // Handle components question
  const handleComponentsQuestion = (hasComps) => {
    setHasComponents(hasComps);
    nextStep();
  };

  // Complete onboarding
  // const completeOnboarding = async () => {
  //   try {
  //     setIsLoading(true);
  //     setError(null);
      
  //     const userId = getUserId();
      
  //     Logger.info('Completing onboarding', { userId, droneType, hasComponents });
      
  //     // Initialize the user with Gemini
  //     const response = await fetch(`http://localhost:5003/api/assembly/gemini/initialize-user`, {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json'
  //       },
  //       body: JSON.stringify({
  //         userId,
  //         droneType
  //       })
  //     });
      
  //     if (!response.ok) {
  //       throw new Error(`Failed to initialize user: ${response.statusText}`);
  //     }
      
  //     const data = await response.json();
      
  //     if (data.success) {
  //       // Set the active project
  //       setActiveProject(data.project.project_id);
        
  //       // Set welcome message
  //       setWelcomeMessage(data.welcomeMessage || 'Welcome to your drone assembly project!');
        
  //       // Move to final step
  //       setStep(4);
        
  //       Logger.info('Onboarding completed successfully', { 
  //         projectId: data.project.project_id
  //       });
  //     } else {
  //       throw new Error(data.error || 'Failed to initialize user');
  //     }
  //   } catch (error) {
  //     Logger.error('Error completing onboarding', error);
  //     setError('Failed to initialize your project. Please try again.');
  //   } finally {
  //     setIsLoading(false);
  //   }
  // };

  const completeOnboarding = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const userId = getUserId();
      
      Logger.info('Completing onboarding', { userId, droneType, hasComponents });
      
      // Initialize the user with Gemini
      const response = await fetch('http://localhost:5003/api/assembly/project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          projectId: `proj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          projectName: droneType ? `${droneType} Assembly` : 'New Drone Assembly'
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to initialize user: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Set the active project
        setActiveProject(data.project.project_id);
        
        // Update drone type if specified
        if (droneType) {
          await fetch('http://localhost:5003/api/assembly/project/drone-type', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userId,
              projectId: data.project.project_id,
              droneType
            })
          });
        }
        
        // Set welcome message
        setWelcomeMessage('Welcome to your drone assembly project! I\'ll help guide you through the process step by step.');
        
        // Move to final step
        setStep(4);
        
        Logger.info('Onboarding completed successfully', { 
          projectId: data.project.project_id
        });
      } else {
        throw new Error(data.error || 'Failed to initialize user');
      }
    } catch (error) {
      Logger.error('Error completing onboarding', error);
      setError('Failed to initialize your project. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  // Start the assembly after onboarding
  const startAssembly = () => {
    if (onComplete) {
      onComplete();
    }
  };

  // Render the current step
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="text-center p-4">
            <Rocket className="w-16 h-16 text-indigo-400 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-white mb-4">Welcome to Drone Assembly AI</h2>
            <p className="text-indigo-200 mb-8">
              I'm your personal assistant for drone assembly. Let's get started by setting up your project.
            </p>
            <button
              onClick={nextStep}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mx-auto"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        );
      
      case 2:
        return (
          <div className="p-4">
            <h2 className="text-xl font-bold text-white mb-4">What type of drone are you building?</h2>
            <div className="grid grid-cols-2 gap-3 mb-8">
              {droneTypes.map(type => (
                <button
                  key={type}
                  onClick={() => handleDroneTypeSelect(type)}
                  className="bg-indigo-900/40 hover:bg-indigo-800/60 text-white p-4 rounded-xl transition-colors text-center"
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        );
      
      case 3:
        return (
          <div className="p-4">
            <h2 className="text-xl font-bold text-white mb-4">Do you already have drone components?</h2>
            <p className="text-indigo-200 mb-6">
              This helps me provide better assistance for your specific setup.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => handleComponentsQuestion(true)}
                className="flex-1 bg-green-900/40 hover:bg-green-800/60 text-white p-4 rounded-xl transition-colors"
              >
                Yes, I have components
              </button>
              <button
                onClick={() => handleComponentsQuestion(false)}
                className="flex-1 bg-indigo-900/40 hover:bg-indigo-800/60 text-white p-4 rounded-xl transition-colors"
              >
                No, starting from scratch
              </button>
            </div>
          </div>
        );
      
      case 4:
        return (
          <div className="text-center p-4">
            {isLoading ? (
              <div className="flex flex-col items-center">
                <Loader className="w-12 h-12 text-indigo-400 animate-spin mb-4" />
                <p className="text-indigo-200">Setting up your project...</p>
              </div>
            ) : error ? (
              <div className="bg-red-900/30 border border-red-800/50 rounded-lg p-4 mb-4">
                <p className="text-red-200 text-sm">{error}</p>
                <button
                  onClick={completeOnboarding}
                  className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : welcomeMessage ? (
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                  <Check className="w-8 h-8 text-green-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-4">You're all set!</h2>
                <div className="bg-indigo-900/30 rounded-lg p-4 mb-6 text-left">
                  <p className="text-indigo-200">{welcomeMessage}</p>
                </div>
                <button
                  onClick={startAssembly}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl transition-colors"
                >
                  Start Assembly
                </button>
              </div>
            ) : (
              <button
                onClick={completeOnboarding}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                Create My Project
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-80 bg-black/30 backdrop-blur-sm rounded-2xl border border-white/10">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">New Drone Project</h2>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${
                  i === step
                    ? 'bg-indigo-500'
                    : i < step
                    ? 'bg-indigo-800'
                    : 'bg-gray-700'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
      
      {renderStep()}
    </div>
  );
};

export default NewUserOnboarding;