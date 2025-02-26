import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Camera, Play, Pause, Timer, Bug as BugIcon } from 'lucide-react';
import SpeechHandler from './SpeechHandler';
import { processGeminiResponse } from '../utils/speechUtils';
import Logger from '../utils/logger';
import { getUserId, getProjectId } from '../utils/userIdentification';

const CameraFeed = forwardRef(({ currentStep, onAnalysisComplete }, ref) => {
  const videoRef = useRef(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [autoCounter, setAutoCounter] = useState(5);
  const [debugInfo, setDebugInfo] = useState(null);
  const [isTestingAPI, setIsTestingAPI] = useState(false);
  const [speechText, setSpeechText] = useState('');
  const [cameraError, setCameraError] = useState(null);
  const analyzeIntervalRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    captureFrame: () => captureFrame(),
    handleVoiceInput: (transcript) => handleVoiceInput(transcript),
    setSpeechText: (text) => {
      Logger.info('Setting speech text from external component:', {
        text: text ? text.slice(0, 100) + (text.length > 100 ? '...' : '') : 'empty'
      });
      setSpeechText('');
      setTimeout(() => {
        setSpeechText(text);
      }, 50);
    }
  }));

  useEffect(() => {
    let mounted = true;
    
    const initCamera = async () => {
      try {
        if (!videoRef.current) {
          throw new Error('Video element not initialized');
        }
        
        Logger.info('Initializing camera');
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
        
        if (mounted && videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraError(null);
          Logger.info('Camera initialized successfully');
        }
      } catch (error) {
        Logger.error('Error accessing camera:', error);
        setCameraError(error.message);
        setDebugInfo({
          status: 'error',
          message: 'Camera access denied: ' + error.message,
          timestamp: new Date().toISOString()
        });
      }
    };

    initCamera();

    return () => {
      mounted = false;
      stopCamera();
      if (analyzeIntervalRef.current) clearInterval(analyzeIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  const stopCamera = () => {
    Logger.info('Stopping camera');
    const stream = videoRef.current?.srcObject;
    stream?.getTracks().forEach(track => track.stop());
  };

// Update just the testGeminiConnection function in CameraFeed.js

const testGeminiConnection = async () => {
    setIsTestingAPI(true);
    try {
      Logger.info('Testing Gemini API connection');
      
      const response = await fetch('http://localhost:5003/api/assembly/gemini/test');
      
      // Log the raw response first
      const responseText = await response.text();
      Logger.debug('Raw Gemini test response:', responseText);

      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Failed to parse response as JSON: ${responseText}`);
      }

      Logger.info('Gemini API test response:', data);
      
      const testMessage = data.success ? 'API connection successful' : 'API connection failed';
      setSpeechText(testMessage);
      
      setDebugInfo({
        status: data.success ? 'success' : 'error',
        message: data.success ? data.response : data.error,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      Logger.error('Gemini API test failed:', error);
      setSpeechText('API test failed. Please check the console for details.');
      setDebugInfo({
        status: 'error',
        message: `API Test Failed: ${error.message}`,
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsTestingAPI(false);
    }
  };
  
  const captureFrame = () => {
    Logger.debug('Capturing video frame');
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  };
// frontend/src/components/CameraFeed.js - Updated handleVoiceInput function
// const handleVoiceInput = async (transcript) => {
//   if (isAnalyzing) {
//     Logger.warn('Analysis already in progress, skipping voice input');
//     return;
//   }
  
//   setIsAnalyzing(true);
//   try {
//     Logger.info('Processing voice input:', transcript);
//     const imageData = captureFrame();
    
//     Logger.info('Captured image for voice query, size:', imageData.length);
    
//     const response = await fetch('http://localhost:5003/api/assembly/gemini/voice-query', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({
//         image: imageData,
//         query: transcript,
//         currentStep
//       })
//     });

//     if (!response.ok) {
//       throw new Error(`HTTP error! status: ${response.status}`);
//     }

//     const data = await response.json();
//     Logger.info('Voice query response:', data);
    
//     if (data.success) {
//       // Extract the text response for speech synthesis
//       let voiceResponse;
      
//       if (data.analysis.answer) {
//         voiceResponse = `${data.analysis.answer}`;
//         if (data.analysis.details) {
//           voiceResponse += ` ${data.analysis.details}`;
//         }
//       } else if (typeof data.analysis === 'string') {
//         // Handle case where response is a string
//         voiceResponse = data.analysis;
//       } else {
//         // Fallback
//         voiceResponse = 'Analysis completed successfully.';
//       }
      
//       // Add warnings if present
//       if (data.analysis.warnings && data.analysis.warnings.length > 0) {
//         voiceResponse += ' Warning: ' + data.analysis.warnings.join('. ');
//       }
      
//       Logger.info('Setting speech text for TTS:', voiceResponse.slice(0, 100) + '...');
//       setSpeechText(voiceResponse);
      
//       onAnalysisComplete(data);
//     } else {
//       throw new Error(data.error || 'Voice query failed');
//     }

//   } catch (error) {
//     Logger.error('Voice query error:', error);
//     setSpeechText('I encountered an error processing your question. Please try again.');
//     setDebugInfo({
//       status: 'error',
//       message: error.message,
//       timestamp: new Date().toISOString()
//     });
//   } finally {
//     setIsAnalyzing(false);
//   }
// };
const handleVoiceInput = async (transcript) => {
  if (isAnalyzing) {
    Logger.warn('Analysis already in progress, skipping voice input');
    return;
  }
  
  setIsAnalyzing(true);
  // Clear previous speech text before starting
  setSpeechText('');
  
  try {
    Logger.info('Processing voice input:', transcript);
    const imageData = captureFrame();
    
    // Get user and project IDs
    const userId = getUserId();
    const projectId = getProjectId();
    
    Logger.info('Captured image for voice query, size:', imageData.length);
    
    const response = await fetch('http://localhost:5003/api/assembly/gemini/voice-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: imageData,
        query: transcript,
        currentStep,
        userId,
        projectId,
        requestId: Date.now().toString() // Add unique request ID
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    Logger.info('Voice query response:', data);
    
    if (data.success) {
      // Clear any previous analysis
      onAnalysisComplete(null);
      
      // Process new response
      const speechText = processGeminiResponse(data);
      setSpeechText(speechText);
      
      // Small timeout to ensure state updates don't conflict
      setTimeout(() => {
        onAnalysisComplete(data);
      }, 50);
    } else {
      throw new Error(data.error || 'Voice query failed');
    }

  } catch (error) {
    Logger.error('Voice query error:', error);
    setSpeechText('I encountered an error processing your question. Please try again.');
    onAnalysisComplete(null); // Clear on error
  } finally {
    setIsAnalyzing(false);
  }
};
  const startAutoMode = () => {
    Logger.info('Starting auto analysis mode');
    setAutoMode(true);
    analyzeIntervalRef.current = setInterval(captureAndAnalyze, 5000);
    countdownIntervalRef.current = setInterval(() => {
      setAutoCounter((prev) => (prev === 1 ? 5 : prev - 1));
    }, 1000);
    captureAndAnalyze();
  };

  const stopAutoMode = () => {
    Logger.info('Stopping auto analysis mode');
    setAutoMode(false);
    if (analyzeIntervalRef.current) clearInterval(analyzeIntervalRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setAutoCounter(5);
  };

// 5. Fix in CameraFeed.js - captureAndAnalyze function
// Ensure user and project IDs are passed to backend

// Enhanced captureAndAnalyze function for CameraFeed.js

const captureAndAnalyze = async () => {
  if (isAnalyzing) {
    Logger.warn('Analysis already in progress, skipping');
    return;
  }
  
  setIsAnalyzing(true);
  // Clear previous speech text and analysis results before starting new analysis
  setSpeechText('');
  
  try {
    Logger.info('Starting image analysis', { currentStep });
    const imageData = captureFrame();
    
    // Get current user and project IDs
    const userId = getUserId();
    const projectId = getProjectId();
    
    Logger.info('Sending analysis request', { 
      userId, 
      projectId,
      currentStep,
      hasImage: !!imageData,
      timestamp: new Date().toISOString()
    });
    
    const response = await fetch(`http://localhost:5003/api/assembly/gemini/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: imageData,
        currentStep,
        userId,
        projectId,
        requestId: Date.now().toString() // Add unique request ID
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Read response once as text to debug
    const responseText = await response.clone().text();
    console.log("[DEBUG] Raw API response:", responseText.substring(0, 500) + '...');
    
    const data = await response.json();
    
    console.log("[DEBUG] Full analysis response:", data);
    console.log("[DEBUG] Components in response:", 
      data.analysis?.identifiedComponents || data.analysis?.identifiedParts || []);
    
    Logger.info('Received analysis response:', { 
      success: data.success,
      hasComponents: !!data.analysis?.identifiedComponents || !!data.analysis?.identifiedParts,
      timestamp: new Date().toISOString(),
      meta: data.meta
    });
    
    if (data.success) {
      // Process the response into a human-readable format
      const speechText = processGeminiResponse(data);
      setSpeechText(speechText);
      
      // Clear any old analysis before setting the new one
      onAnalysisComplete(null); // Clear first
      
      // Set the new analysis with a small delay to ensure state updates don't conflict
      setTimeout(() => {
        onAnalysisComplete(data);
      }, 50);
    } else {
      throw new Error(data.error || 'Analysis failed');
    }

  } catch (error) {
    Logger.error('Analysis error:', error);
    setSpeechText('I encountered an error while analyzing the image. Please try again.');
    onAnalysisComplete(null); // Clear on error
  } finally {
    setIsAnalyzing(false);
  }
};
return (
  <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
    <div className="aspect-video bg-black/40 rounded-xl overflow-hidden relative">
      {cameraError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900/20">
          <div className="text-center p-4">
            <p className="text-red-400 mb-2">Camera Error</p>
            <p className="text-white text-sm">{cameraError}</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Retry Camera Access
            </button>
          </div>
        </div>
      ) : (
        <video 
          ref={videoRef} 
          className="w-full h-full object-cover" 
          autoPlay 
          playsInline 
          muted 
        />
      )}
      
      {isAnalyzing && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <div className="text-white">Analyzing...</div>
        </div>
      )}
      
      {autoMode && (
        <div className="absolute top-4 right-4 bg-black/70 rounded-lg px-3 py-1.5 flex items-center gap-2">
          <Timer className="w-4 h-4 text-purple-400" />
          <span className="text-white">Next scan in: {autoCounter}s</span>
        </div>
      )}
    </div>
    
    <div className="mt-4 flex justify-between items-center">
      <h2 className="text-lg font-semibold text-white">Live Assembly View</h2>
      <div className="flex gap-2">
        <button
          onClick={testGeminiConnection}
          disabled={isTestingAPI}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
        >
          <BugIcon className="w-4 h-4" />
          {isTestingAPI ? 'Testing...' : 'Test API'}
        </button>

        <button
          onClick={autoMode ? stopAutoMode : startAutoMode}
          className={`${
            autoMode ? 'bg-red-600' : 'bg-green-600'
          } hover:opacity-90 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2`}
        >
          {autoMode ? (
            <>
              <Pause className="w-4 h-4" />
              Stop Auto
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Start Auto
            </>
          )}
        </button>
        
        <button
          onClick={captureAndAnalyze}
          disabled={isAnalyzing || autoMode}
          className={`bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
            (isAnalyzing || autoMode) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <Camera className="w-4 h-4" />
          Analyze
        </button>
      </div>
    </div>

    {debugInfo && (
      <div className={`mt-4 p-4 rounded-lg ${
        debugInfo.status === 'success' ? 'bg-green-900/20' : 'bg-red-900/20'
      }`}>
        <div className="flex justify-between items-start">
          <h3 className="text-white font-medium">Debug Info</h3>
          <span className="text-xs text-gray-400">{debugInfo.timestamp}</span>
        </div>
        <pre className="mt-2 text-sm font-mono whitespace-pre-wrap text-gray-200">
          {debugInfo.message}
        </pre>
      </div>
    )}

<SpeechHandler 
  text={speechText}
  onSpeechEnd={() => {
    Logger.info('Speech synthesis completed');
    
    // Force refresh components after speech ends
    const userId = getUserId();
    const projectId = getProjectId();
    
    if (userId && projectId) {
      console.log("[CameraFeed] Speech ended, refreshing components");
      
      fetch(`http://localhost:5003/api/assembly/project/${userId}/${projectId}/context`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.context?.components?.length > 0) {
            console.log("[CameraFeed] Found components in backend:", data.context.components);
            onAnalysisComplete({
              success: true,
              analysis: {
                identifiedComponents: data.context.components
              }
            });
          }
        })
        .catch(err => console.error("[CameraFeed] Refresh error:", err));
    }
  }}
/>
  </div>
);
});

CameraFeed.displayName = 'CameraFeed';

export default CameraFeed;