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
    // Simple function to detect if transcript is requesting an image visualization
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
  if (!currentProject) {
    console.error("[DEBUG] Missing current project:", currentProject);
    return;
  }
  
  const projectId = currentProject.project_id || currentProject.id;
  if (!projectId) {
    console.error("[DEBUG] Missing project ID in currentProject:", currentProject);
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
  
  // const generateStableDiffusionImage = async (prompt) => {
  //   try {
  //     setIsGeneratingImage(true);
  //     setImageGenerationError(null);
  //     setProcessingStatus("Starting image generation...");
      
  //     Logger.info('Starting image generation', { prompt });
      
  //     // Notify user about the process starting
  //     if (cameraFeedRef.current?.setSpeechText) {
  //       cameraFeedRef.current.setSpeechText(
  //         "I'm generating a visualization based on your request. This may take a minute or two."
  //       );
  //     }
      
  //     setProcessingStatus("Generating image... (this may take 1-2 minutes)");
      
  //     const response = await fetch('http://localhost:5003/api/assembly/visualize', {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify({
  //         prompt: prompt,
  //         userId: getUserId(),
  //         projectId: getProjectId()
  //       }),
  //       // Use a longer timeout for model loading
  //       signal: AbortSignal.timeout(300000) // 5 minute timeout
  //     });
      
  //     // Handle response - check content type first
  //     const contentType = response.headers.get('content-type');
      
  //     // For image content type (successful image generation)
  //     if (contentType && contentType.includes('image/')) {
  //       if (generatedImage) {
  //         URL.revokeObjectURL(generatedImage);
  //       }
        
  //       const blob = await response.blob();
  //       const imageUrl = URL.createObjectURL(blob);
  //       setGeneratedImage(imageUrl);
        
  //       if (cameraFeedRef.current?.setSpeechText) {
  //         cameraFeedRef.current.setSpeechText(
  //           "I've completed generating the visualization based on your request."
  //         );
  //       }
  //     }
  //     // For JSON content type (likely an error)
  //     else if (contentType && contentType.includes('json')) {
  //       const responseData = await response.json();
        
  //       if (!responseData.success || responseData.error) {
  //         throw new Error(responseData.error || "Unknown error generating image");
  //       }
  //     } 
  //     // For non-ok responses
  //     else if (!response.ok) {
  //       throw new Error(`Failed to generate image: ${response.status} ${response.statusText}`);
  //     }
  //   } catch (error) {
  //     console.error("Image generation error:", error);
  //     setImageGenerationError(`Error: ${error.message}`);
  //     Logger.error('Error generating image:', error);
      
  //     if (cameraFeedRef.current?.setSpeechText) {
  //       cameraFeedRef.current.setSpeechText(
  //         "I encountered an error while trying to generate the visualization."
  //       );
  //     }
  //   } finally {
  //     setProcessingStatus(null);
  //     setIsGeneratingImage(false);
  //   }
  // };

  const generateStableDiffusionImage = async (prompt) => {
    try {
      setIsGeneratingImage(true);
      setImageGenerationError(null);
      setProcessingStatus("Starting image generation...");
      Logger.info('Starting image generation', { prompt });
  
      if (cameraFeedRef.current?.setSpeechText) {
        cameraFeedRef.current.setSpeechText(
          "I'm generating a visualization based on your request. This may take a few minutes."
        );
      }
  
      // Initial request to start generation
      const response = await fetch('http://localhost:5003/api/assembly/visualize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt,
          userId: getUserId(),
          projectId: getProjectId()
        }),
        signal: AbortSignal.timeout(30000) // 30-second timeout for initial request
      });
  
      const data = await response.json();
      if (!data.success || !data.taskId) {
        throw new Error(data.error || 'Failed to start image generation');
      }
  
      const { taskId } = data;
      setProcessingStatus("Generating image... (this may take a few minutes)");
  
      // Poll for progress
      const pollProgress = async () => {
        while (true) {
          try {
            const progressResponse = await fetch(`http://localhost:5003/api/assembly/visualize/progress/${taskId}`);
            const progressData = await progressResponse.json();
            const progress = progressData.progress || 0;
            setProcessingStatus(`Generating image... (${progress}%)`);
            
            console.log("Progress data:", progressData); // Add debug logging
            
            if (progressData.status === 'completed') {
              // Fetch the final image
              console.log("Generation completed, fetching image from:", 
                `http://localhost:5003/api/assembly/visualize/result/${taskId}`);
                
              const imageResponse = await fetch(`http://localhost:5003/api/assembly/visualize/result/${taskId}`);
              console.log("Image response status:", imageResponse.status);
              console.log("Image response content-type:", imageResponse.headers.get('content-type'));
              
              if (imageResponse.ok && imageResponse.headers.get('content-type')?.includes('image/')) {
                const blob = await imageResponse.blob();
                console.log("Image blob size:", blob.size);
                const imageUrl = URL.createObjectURL(blob);
                setGeneratedImage(imageUrl);
                
                if (cameraFeedRef.current?.setSpeechText) {
                  cameraFeedRef.current.setSpeechText(
                    "I've completed generating the visualization based on your request."
                  );
                }
                
                // Important: break out of the polling loop
                setIsGeneratingImage(false);
                setProcessingStatus(null);
                break;
              } else {
                // Log the error response
                let errorText;
                try {
                  errorText = await imageResponse.text();
                  console.error("Error response from image endpoint:", errorText);
                } catch (e) {
                  console.error("Could not read error response:", e);
                }
                throw new Error('Failed to fetch generated image: ' + errorText);
              }
            } else if (progressData.error) {
              throw new Error(progressData.error);
            }
            
            // Wait 5 seconds before polling again
            await new Promise(resolve => setTimeout(resolve, 5000));
          } catch (error) {
            console.error("Error in polling:", error);
            setImageGenerationError(`Error during polling: ${error.message}`);
            setIsGeneratingImage(false);
            setProcessingStatus(null);
            break;
          }
        }
      };
  
      pollProgress().catch(error => {
        console.error("Error polling for progress:", error);
        setImageGenerationError(`Error: ${error.message}`);
        setIsGeneratingImage(false); // Make sure to turn off the loading state
        setProcessingStatus(null);
      });
      
    } catch (error) {
      console.error("Image generation error:", error);
      setImageGenerationError(`Error: ${error.message}`);
      Logger.error('Error generating image:', error);
      if (cameraFeedRef.current?.setSpeechText) {
        cameraFeedRef.current.setSpeechText(
          "I encountered an error while trying to generate the visualization."
        );
      }
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
    // Prevent processing if another operation is already in progress
    if (isGeneratingImage) {
      console.log("[DEBUG] Ignoring voice input because image generation is in progress");
      statusCallback("Please wait for current image generation to complete");
      return;
    }
    
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