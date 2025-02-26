// frontend/src/components/MainInterface.js
import React, { useState, useRef, useEffect } from 'react';
import { Clock, MessageSquare, Folder, ArrowLeftRight } from 'lucide-react';
import CameraFeed from './CameraFeed';
import InstructionPanel from './InstructionPanel';
import VisualizationPanel from './VisualizationPanel';
import VoiceInput from './VoiceInput';
import ProjectManager from './ProjectManager';
import NewUserOnboarding from './NewUserOnboarding';
import Logger from '../utils/logger';
import { processGeminiResponse } from '../utils/speechUtils';
import { getUserId, getProjectId } from '../utils/userIdentification';
import { useProject } from '../contexts/ProjectContext';
import GeneratedImagePanel from './GeneratedImagePanel';

const MainInterface = () => {
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState(null);
  const [showProjectManager, setShowProjectManager] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const cameraFeedRef = useRef();
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageGenerationError, setImageGenerationError] = useState(null);

  const { 
    currentProject, 
    isLoading: projectLoading,
    loadActiveProject, 
    setActiveProject,
    addComponents,
    addCompletedStep,
    components // Add this line to fix the error
  } = useProject();

  useEffect(() => {
    const projectId = getProjectId();
    if (!projectId) {
      setShowOnboarding(true);
    }
  }, []);

  const currentStep = currentProject?.current_step || 1;

  const isVisualizationRequest = (transcript) => {
    // Expanded list of triggers for image generation/visualization
    const visualizationTriggers = [
      /create.*image/i,
      /generate.*image/i,
      /show.*visual/i,
      /create.*visual/i,
      /visualize/i,
      /draw.*drone/i,
      /make.*picture/i,
      /create.*picture/i,
      /show.*what.*looks.*like/i,
      /picture.*of/i,
      /image.*of/i,
      /illustration.*of/i,
      /visualize.*the.*drone/i, 
      /show.*me.*what/i,
      /show.*me.*a.*picture/i,
      /show.*me.*an.*image/i,
      /can.*you.*draw/i,
      /can.*you.*show.*me/i,
      /generate.*a.*picture/i,
      /create.*a.*representation/i,
      /make.*an.*image/i
    ];
    
    const result = visualizationTriggers.some(trigger => trigger.test(transcript));
    console.log("[DEBUG] Visualization request check:", transcript, result);
    return result;
  };

  const handleAnalysisComplete = (result) => {
    if (!result) {
      setAnalysisResult(null);
      setProcessingStatus(null);
      return;
    }
    
    setAnalysisResult(result);
    
    console.log("[DEBUG] Analysis result:", result);
    console.log("[DEBUG] Current project:", currentProject);
    console.log("[DEBUG] Current components:", components);
  
    Logger.info('Analysis completed', {
      hasData: !!result,
      hasAnalysis: !!result?.analysis,
      identifiedComponents: !!result?.analysis?.identifiedComponents,
      identifiedParts: !!result?.analysis?.identifiedParts,
      timestamp: new Date().toISOString()
    });
    
    if (currentProject) {
      let componentsToStore = [];
      
      // Check in both locations the backend might put component data
      if (result?.analysis?.identifiedComponents && Array.isArray(result.analysis.identifiedComponents)) {
        componentsToStore = result.analysis.identifiedComponents;
        console.log("[DEBUG] Found identifiedComponents:", componentsToStore);
      } else if (result?.analysis?.identifiedParts && Array.isArray(result.analysis.identifiedParts)) {
        componentsToStore = result.analysis.identifiedParts;
        console.log("[DEBUG] Found identifiedParts:", componentsToStore);
      } else {
        // Debug the actual structure received to understand what's happening
        console.log("[DEBUG] No identifiedComponents or identifiedParts arrays found in:", result.analysis);
      }
      
      // Add special check for object structure
      if (componentsToStore.length === 0 && typeof result.analysis === 'object') {
        // Try to extract component data from other possible fields
        const possibleFields = Object.keys(result.analysis).filter(key => 
          Array.isArray(result.analysis[key]) && 
          key.toLowerCase().includes('component')
        );
        
        if (possibleFields.length > 0) {
          console.log("[DEBUG] Found alternative component fields:", possibleFields);
          componentsToStore = result.analysis[possibleFields[0]];
        }
      }
      
      // Enhanced validation of component data
      if (componentsToStore.length > 0) {
        // Filter out invalid components
        const validComponents = componentsToStore.filter(comp => 
          comp && (typeof comp === 'string' || (typeof comp === 'object' && comp.name))
        );
        
        if (validComponents.length > 0) {
          console.log("[DEBUG] Valid components to store:", validComponents);
          storeIdentifiedComponents(validComponents);
        } else {
          console.log("[DEBUG] No valid components after filtering:", componentsToStore);
        }
      } else {
        console.log("[DEBUG] No components to store found in result");
      }
    } else {
      console.log("[DEBUG] No current project available");
    }
    
    if (result?.analysis?.canProceed) {
      const stepInfo = {
        stepNumber: currentStep,
        title: `Step ${currentStep} completed`,
        timestamp: new Date().toISOString(),
        details: result.analysis.feedback || 'Step completed successfully',
      };
      
      addCompletedStep(stepInfo);
    }
  };
// Fixed storeIdentifiedComponents function for MainInterface.js
  const storeIdentifiedComponents = async (components) => {
    if (!components || !Array.isArray(components) || components.length === 0) {
      console.log("[DEBUG] Invalid components to store:", components);
      return;
    }
    
    console.log("[DEBUG] Calling addComponents with:", components);
    try {
      Logger.info('Storing identified components', { count: components.length });
      const result = await addComponents(components); // Capture the return value
      console.log("[DEBUG] addComponents returned:", result);
    } catch (error) {
      Logger.error('Error storing components', error);
      console.error("[DEBUG] Error in storeIdentifiedComponents:", error);
    }
  };
  
// Updated image generation function with reduced polling and better waiting
const generateStableDiffusionImage = async (prompt) => {
  try {
    setIsGeneratingImage(true);
    setImageGenerationError(null);
    
    Logger.info('Starting image generation', { prompt });
    console.log("[DEBUG] Image generation prompt:", prompt);
    
    // First check if the service is running
    try {
      const healthCheck = await fetch('http://localhost:9999', { 
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      
      if (healthCheck.ok) {
        console.log("[DEBUG] Image service is running");
      }
    } catch (e) {
      console.log("[DEBUG] Service health check failed, attempting to generate anyway");
    }
    
    // Start the async image generation
    const response = await fetch('http://localhost:9999/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: prompt,
        userId: getUserId(),
        projectId: getProjectId(),
        async: true  // Enable async processing
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to start image generation: ${response.status} ${response.statusText}`);
    }

    // Get the task info from the response
    const taskInfo = await response.json();
    console.log("[DEBUG] Image generation task started:", taskInfo);
    
    if (!taskInfo.task_id) {
      throw new Error("No task ID returned from image generation service");
    }
    
    // Add success message to speech about generation starting
    if (cameraFeedRef.current?.setSpeechText) {
      cameraFeedRef.current.setSpeechText(
        "I'm generating a visualization based on your request. This may take several minutes. Please wait for it to complete."
      );
    }
    
    // Add a delay before starting to poll to give the server time to initiate the task
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Start polling for progress but with a much lower frequency
    const taskId = taskInfo.task_id;
    let isComplete = false;
    let lastProgressUpdate = 0;
    
    // Set up longer polling intervals - now we poll every 10 seconds instead of every second
    const POLLING_INTERVAL = 10000; // 10 seconds between polls
    const MAX_WAIT_TIME = 30 * 60 * 1000; // 30 minutes maximum wait time
    const startTime = Date.now();
    
    while (!isComplete && (Date.now() - startTime < MAX_WAIT_TIME)) {
      try {
        console.log(`[DEBUG] Polling for progress: ${taskId}`);
        setProcessingStatus("Waiting for image generation to complete...");
        
        const progressResponse = await fetch(`http://localhost:9999/progress/${taskId}`, {
          signal: AbortSignal.timeout(8000), // Longer timeout for progress checks
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (progressResponse.ok) {
          const progress = await progressResponse.json();
          const currentProgress = progress.progress || 0;
          
          // Only update UI if progress has changed significantly (5% or more)
          if (currentProgress >= lastProgressUpdate + 5) {
            lastProgressUpdate = currentProgress;
            setProcessingStatus(`Generating image: ${currentProgress}% - ${progress.message}`);
            console.log("[DEBUG] Image generation progress:", progress);
          }
          
          // Check if complete
          if (progress.status === "completed") {
            isComplete = true;
            console.log("[DEBUG] Image generation completed, fetching result");
            
            try {
              // Fetch the final image
              const resultResponse = await fetch(`http://localhost:9999/result/${taskId}`, {
                headers: {
                  'Cache-Control': 'no-cache',
                  'Pragma': 'no-cache'
                },
                signal: AbortSignal.timeout(15000) // Longer timeout for final result
              });
              
              if (resultResponse.ok) {
                // Clean up any existing object URL
                if (generatedImage) {
                  URL.revokeObjectURL(generatedImage);
                }
                
                const blob = await resultResponse.blob();
                const imageUrl = URL.createObjectURL(blob);
                setGeneratedImage(imageUrl);
                console.log("[DEBUG] Image generation successful, URL created:", imageUrl);
                
                // Add success message to speech
                if (cameraFeedRef.current?.setSpeechText) {
                  cameraFeedRef.current.setSpeechText(
                    "I've completed generating the visualization based on your request."
                  );
                }
                
                return; // Exit the function once image is successfully retrieved
              } else {
                console.error(`[DEBUG] Failed to fetch result: ${resultResponse.status}`);
                throw new Error(`Failed to fetch completed image: ${resultResponse.status}`);
              }
            } catch (resultError) {
              console.error("[DEBUG] Error fetching result:", resultError);
              // Don't give up immediately - we'll try again in the next iteration
              isComplete = false;
            }
          }
        } else {
          console.log(`[DEBUG] Progress check failed (${progressResponse.status})`);
        }
      } catch (pollError) {
        console.log("[DEBUG] Polling error:", pollError);
        // Errors during polling are not fatal - we'll continue waiting
      }
      
      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
    }
    
    // If we get here, we've either timed out or exhausted all attempts
    if (!generatedImage) {
      // One final attempt to get the result directly
      try {
        console.log("[DEBUG] Final attempt to get result after waiting");
        
        const finalResponse = await fetch(`http://localhost:9999/result/${taskId}`, {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          signal: AbortSignal.timeout(15000)
        });
        
        if (finalResponse.ok) {
          const blob = await finalResponse.blob();
          const imageUrl = URL.createObjectURL(blob);
          setGeneratedImage(imageUrl);
          console.log("[DEBUG] Final attempt was successful");
          
          if (cameraFeedRef.current?.setSpeechText) {
            cameraFeedRef.current.setSpeechText(
              "I've completed generating the visualization based on your request."
            );
          }
          
          return;
        } else {
          throw new Error("Image generation timed out or failed");
        }
      } catch (finalError) {
        console.error("[DEBUG] Final attempt failed:", finalError);
        throw new Error("Failed to retrieve the generated image after multiple attempts");
      }
    }
  } catch (error) {
    console.error("[DEBUG] Image generation error:", error);
    if (error.name === 'AbortError') {
      setImageGenerationError('Image generation timed out. Please try again.');
    } else {
      setImageGenerationError(`Error: ${error.message}`);
    }
    Logger.error('Error generating image:', error);
    
    if (cameraFeedRef.current?.setSpeechText) {
      cameraFeedRef.current.setSpeechText(
        "I encountered an error while trying to generate the visualization."
      );
    }
  } finally {
    setProcessingStatus(null);
    setIsGeneratingImage(false);
  }
};

useEffect(() => {
  return () => {
    // Clean up any object URLs when component unmounts
    if (generatedImage) {
      URL.revokeObjectURL(generatedImage);
    }
  };
}, []);

  const handleVoiceInput = async (transcript, statusCallback) => {
    if (!cameraFeedRef.current) {
      Logger.error('Camera feed not initialized');
      statusCallback('Error: Camera not ready');
      return;
    }
  
    setAnalysisResult(null);
    setIsProcessing(true);
    Logger.info('Processing voice input:', transcript);
    console.log("[DEBUG] Processing voice input:", transcript);
    setProcessingStatus('Capturing image...');
    
    try {
      const imageData = cameraFeedRef.current.captureFrame();
      
      if (!imageData) {
        throw new Error('Failed to capture camera frame');
      }
      
      // Check if this is a visualization/image generation request
      const shouldGenerateImage = isVisualizationRequest(transcript);
      console.log("[DEBUG] Should generate image:", shouldGenerateImage);
      
      Logger.info('Image captured successfully');
      setProcessingStatus('Image captured ✅ Sending to API...');
      statusCallback('Image captured ✅ Sending to API...');
  
      const userId = getUserId();
      const projectId = getProjectId();
      
      // If it's an image generation request, proceed with it directly
      if (shouldGenerateImage) {
        statusCallback('Image request detected ✅ Generating visualization...');
        console.log("[DEBUG] Image generation request detected, processing directly");
        
        // Still send to Gemini for component analysis
        const geminiResponse = await fetch('http://localhost:5003/api/assembly/gemini/voice-query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: imageData,
            query: transcript,
            currentStep,
            userId,
            projectId,
            requestId: Date.now().toString()
          })
        });
        
        let components = [];
        
        // Try to extract components if Gemini response is successful
        let data = null;
        try {
          if (geminiResponse.ok) {
            data = await geminiResponse.json();
            setAnalysisResult(data);
            
            if (data.success && data.analysis) {
              // Extract components from the analysis
              if (data.analysis.identifiedComponents && Array.isArray(data.analysis.identifiedComponents)) {
                components = data.analysis.identifiedComponents;
              } else if (data.analysis.identifiedParts && Array.isArray(data.analysis.identifiedParts)) {
                components = data.analysis.identifiedParts;
              }
              
              // Process Gemini response for speech
              const processedResponse = processGeminiResponse(data);
              if (cameraFeedRef.current?.setSpeechText) {
                cameraFeedRef.current.setSpeechText('');
                setTimeout(() => {
                  cameraFeedRef.current.setSpeechText(
                    `${processedResponse} I'll generate a visualization of that for you.`
                  );
                }, 100);
              }
            }
          } else {
            // Even if the response isn't successful, continue with the image generation
            console.log(`[DEBUG] Gemini voice query error: ${geminiResponse.status}. Continuing with image generation anyway.`);
            
            // Set a basic speech message
            if (cameraFeedRef.current?.setSpeechText) {
              cameraFeedRef.current.setSpeechText("I'll generate a visualization based on your request.");
            }
          }
        } catch (respError) {
          // Don't let response parsing errors stop the image generation
          console.error("[DEBUG] Error parsing Gemini voice query response:", respError);
          
          // Set a basic speech message
          if (cameraFeedRef.current?.setSpeechText) {
            cameraFeedRef.current.setSpeechText("I'll generate a visualization based on your request.");
          }
        }
        
        // Clean transcript to form a better prompt for image generation
        let imagePrompt = transcript.replace(/can you /i, '')
                                    .replace(/please /i, '')
                                    .replace(/I want /i, '')
                                    .replace(/I'd like /i, '')
                                    .replace(/show me /i, '')
                                    .replace(/create /i, '')
                                    .replace(/generate /i, '')
                                    .replace(/make /i, '');
        
        // Add components to prompt if available
        if (components.length > 0) {
          const componentNames = components
            .map(c => typeof c === 'string' ? c : c.name)
            .filter(Boolean)
            .join(', ');
          
          imagePrompt = `${imagePrompt}. Include these drone components: ${componentNames}`;
        }
        
        // Always add "drone" to the prompt if it's not already there
        if (!imagePrompt.toLowerCase().includes('drone')) {
          imagePrompt = `${imagePrompt} of a drone`;
        }
        
        console.log("[DEBUG] Image prompt:", imagePrompt);
        // Generate the image
        generateStableDiffusionImage(imagePrompt);
        
        return; // Early return to skip the regular flow
      }
      
      // Continue with regular voice query flow if not an image request
      const response = await fetch('http://localhost:5003/api/assembly/gemini/voice-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageData,
          query: transcript,
          currentStep,
          userId,
          projectId,
          requestId: Date.now().toString()
        })
      });
  
      // Handle response errors more gracefully
      let data;
      try {
        if (!response.ok) {
          console.error(`[DEBUG] HTTP error in regular voice query: ${response.status}`);
          // Don't throw here, try to continue with basic info
          data = {
            success: true,
            analysis: {
              answer: "I processed your request, but encountered an issue with the server.",
              status: "warning"
            }
          };
        } else {
          data = await response.json();
        }
        
        setProcessingStatus('Response received ✅');
        statusCallback('Response received ✅');
    
        if (data && data.success) {
          setAnalysisResult(data);
          
          const processedResponse = processGeminiResponse(data);
          if (cameraFeedRef.current?.setSpeechText) {
            cameraFeedRef.current.setSpeechText('');
            setTimeout(() => {
              cameraFeedRef.current.setSpeechText(processedResponse);
            }, 100);
          }
        } else {
          console.warn("[DEBUG] Voice query returned unsuccessful response:", data);
          // Create a basic response instead of throwing
          const fallbackData = {
            success: true,
            analysis: {
              answer: "I couldn't fully understand your request, but I'll try to help.",
              status: "warning"
            }
          };
          setAnalysisResult(fallbackData);
          
          if (cameraFeedRef.current?.setSpeechText) {
            cameraFeedRef.current.setSpeechText("I couldn't fully understand your request, but I'll try to help.");
          }
        }
      } catch (parseError) {
        console.error("[DEBUG] Error parsing regular voice query response:", parseError);
        // Handle parsing errors gracefully
        const fallbackData = {
          success: true,
          analysis: {
            answer: "I had trouble processing the response from the server.",
            status: "warning"
          }
        };
        setAnalysisResult(fallbackData);
        
        if (cameraFeedRef.current?.setSpeechText) {
          cameraFeedRef.current.setSpeechText("I had trouble processing the response from the server.");
        }
      }
  
    } catch (error) {
      Logger.error('Voice query error:', error);
      console.error("[DEBUG] Voice query error:", error);
      setProcessingStatus('Error processing request ❌');
      statusCallback('Error processing request ❌');
      setAnalysisResult(null);
      
      if (cameraFeedRef.current?.setSpeechText) {
        cameraFeedRef.current.setSpeechText('I encountered an error processing your request. Please try again.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProjectSelect = (project) => {
    setActiveProject(project);
    setShowProjectManager(false);
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    loadActiveProject();
  };

  const toggleProjectManager = () => {
    setShowProjectManager(!showProjectManager);
  };

  const renderContent = () => {
    if (showOnboarding) {
      return (
        <div className="container mx-auto px-4 py-8">
          <NewUserOnboarding 
            onComplete={handleOnboardingComplete}
            onGenerateImage={generateStableDiffusionImage} 
          />
        </div>
      );
    }
    
    if (projectLoading) {
      return (
        <div className="container mx-auto px-4 py-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      );
    }
    
    return (
      <main className="container mx-auto px-4 py-6">
        {showProjectManager ? (
          <ProjectManager 
            onProjectSelect={handleProjectSelect}
            onNewProject={handleProjectSelect}
          />
        ) : (
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-8">
              <CameraFeed 
                ref={cameraFeedRef}
                currentStep={currentStep}
                onAnalysisComplete={handleAnalysisComplete}
              />
              
              {processingStatus && (
                <div className="mt-4 bg-black/50 text-white p-4 rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <span>{processingStatus}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="col-span-12 lg:col-span-4 space-y-6">
              <InstructionPanel 
                currentStep={currentStep}
                analysis={analysisResult?.analysis}
                project={currentProject}
              />
              <VisualizationPanel 
                components={components || []} // Now 'components' is properly defined
              />
              <GeneratedImagePanel
                image={generatedImage}
                isLoading={isGeneratingImage}
                error={imageGenerationError}
                title="Drone Visualization"
                progressStatus={processingStatus}
              />
            </div>
          </div>
        )}
      </main>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800">
      <header className="border-b border-white/10 backdrop-blur-md bg-black/20">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">
              {currentProject?.project_name || 'Drone Assembly'}
            </h1>
            <div className="flex items-center gap-4">
              <button 
                onClick={toggleProjectManager}
                className="text-indigo-200 hover:text-white transition-colors"
                title="Projects"
              >
                <Folder className="w-6 h-6" />
              </button>
              <button className="text-indigo-200 hover:text-white transition-colors" title="History">
                <Clock className="w-6 h-6" />
              </button>
              <button className="text-indigo-200 hover:text-white transition-colors" title="Chat">
                <MessageSquare className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </header>
      
      {renderContent()}

      <div className="fixed bottom-6 right-6 flex flex-col gap-4">
        <VoiceInput 
          onVoiceInput={handleVoiceInput}
          disabled={isProcessing || showProjectManager || showOnboarding}
        />
        <button 
          className="w-14 h-14 bg-indigo-600 hover:bg-indigo-700 rounded-full flex items-center justify-center text-white shadow-lg transition-colors"
          onClick={toggleProjectManager}
          title={showProjectManager ? "Back to Assembly" : "Switch Project"}
        >
          <ArrowLeftRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

export default MainInterface;