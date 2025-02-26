// backend/src/controllers/geminiController.js (Enhanced version)
const { GoogleGenerativeAI } = require("@google/generative-ai");
const projectService = require('../services/projectService');
const Logger = require('../utils/logger');

// Check for API key before initializing
if (!process.env.GEMINI_API_KEY) {
    console.error('FATAL: GEMINI_API_KEY is not set in environment variables');
    throw new Error('GEMINI_API_KEY must be set');
}

// Initialize the Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Cache for storing recent analyses to prevent duplicate processing
const analysisCache = new Map();
const CACHE_DURATION = 5000; 

const createCacheKey = (userId, projectId, imageHash) => {
  // Use a combination of user, project, and a hash of the image
  // Take only first 20 chars of image data to create a simple hash
  const imgHashPart = imageHash.slice(0, 20) + imageHash.slice(-20);
  return `${userId || 'anon'}-${projectId || 'noproj'}-${imgHashPart}`;
};

// Add function to clear cache entries for a specific user/project
const clearUserCache = (userId, projectId) => {
  // Remove all cache entries for this user/project combination
  const keyPrefix = `${userId || 'anon'}-${projectId || 'noproj'}`;
  
  for (const key of analysisCache.keys()) {
    if (key.startsWith(keyPrefix)) {
      analysisCache.delete(key);
    }
  }
  
  Logger.info('[Cache] Cleared cache entries for user/project', { userId, projectId });
};

// Add cache cleanup interval (add after the helper functions)
setInterval(() => {
  const now = Date.now();
  let expiredCount = 0;
  
  for (const [key, value] of analysisCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      analysisCache.delete(key);
      expiredCount++;
    }
  }
  
  if (expiredCount > 0) {
    Logger.debug(`[Cache] Removed ${expiredCount} expired cache entries`);
  }
}, 60000);

/**
 * Build context string from project data
 */
const buildContextFromProject = (projectContext) => {
  if (!projectContext) return '';
  
  let context = `This is a continuation of drone project "${projectContext.projectName}" (ID: ${projectContext.projectId}).\n`;
  
  // Add drone type if available
  if (projectContext.droneType) {
    context += `The user is building a ${projectContext.droneType} drone.\n`;
  }
  
  // Add component information
  if (projectContext.components && projectContext.components.length > 0) {
    context += 'Components that have been identified so far:\n';
    projectContext.components.forEach(component => {
      if (typeof component === 'string') {
        context += `- ${component}\n`;
      } else if (component.name) {
        context += `- ${component.name}${component.purpose ? ` (${component.purpose})` : ''}\n`;
      }
    });
  } else {
    context += 'No components have been identified yet.\n';
  }
  
  // Add completed steps
  if (projectContext.completedSteps && projectContext.completedSteps.length > 0) {
    context += 'Steps that have been completed:\n';
    projectContext.completedSteps.forEach(step => {
      if (typeof step === 'string') {
        context += `- ${step}\n`;
      } else if (step.title) {
        context += `- Step ${step.stepNumber}: ${step.title}\n`;
      }
    });
  }
  
  // Add current step information
  context += `User is currently at step ${projectContext.currentStep} of the assembly process.\n`;
  
  // Add last interaction timestamp
  if (projectContext.lastInteraction) {
    const lastInteraction = new Date(projectContext.lastInteraction);
    const now = new Date();
    const diffMs = now - lastInteraction;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0) {
      context += `Last interaction was ${diffDays} day(s) ago.\n`;
    } else {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours > 0) {
        context += `Last interaction was ${diffHours} hour(s) ago.\n`;
      } else {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        context += `Last interaction was ${diffMinutes} minute(s) ago.\n`;
      }
    }
  }
  
  return context;
};

// Test connection function
const testGeminiConnection = async (req, res) => {
    try {
      console.log('Testing Gemini connection...');
      
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set');
      }
  
      // Simple test with Gemini API
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent("Test connection");
      const response = await result.response.text();
      
      console.log('Gemini test successful:', response);
  
      res.json({
        success: true,
        response: "Gemini API connection successful",
        test_response: response
      });
    } catch (error) {
      console.error('Gemini API Test Error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to connect to Gemini API'
      });
    }
};

/**
 * Enhanced voice query handler with project context
 */
// const handleVoiceQuery = async (req, res) => {
//   try {

//     const { image, query, currentStep, userId, projectId } = req.body;
//     if (userId && projectId) {
//       clearUserCache(userId, projectId);
//     }
//     // Enhanced logging
//     Logger.info(`[VoiceQuery] Processing request for step ${currentStep}`, {
//       hasImage: !!image,
//       queryLength: query?.length || 0,
//       userId,
//       projectId,
//       timestamp: new Date().toISOString()
//     });
    
//     if (!image) {
//       throw new Error('No image data provided');
//     }
    
//     if (!query || query.trim() === '') {
//       throw new Error('No voice query provided');
//     }
    
//     // Get project context if userId and projectId are provided
//     let projectContext = null;
//     let contextPrompt = '';
    
//     if (userId && projectId) {
//       try {
//         projectContext = await projectService.getProjectContext(userId, projectId);
//         contextPrompt = buildContextFromProject(projectContext);
//         Logger.info('[VoiceQuery] Retrieved project context', { projectId });
//       } catch (contextError) {
//         Logger.warn('[VoiceQuery] Could not retrieve project context', contextError);
//         // Continue without context if there's an error
//       }
//     }
    
//     // Remove data URL prefix if present
//     const base64Image = image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
    
//     // Create the image part for the model
//     const imagePart = {
//       inlineData: {
//         data: base64Image,
//         mimeType: "image/jpeg"
//       }
//     };

//     Logger.info('[VoiceQuery] Preparing Gemini model request');
//     const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

//     const prompt = `You are an friendly but an expert in drone assembly like a GOD level expert. The user has asked: "${query}"
//     Analyze the image of the drone assembly at step ${currentStep} and answer their question. Mention user as you for instance if you cannot see any drone component and see an users image just mention "I see you" and be friendly and funny and do not be this robotic make your response such that humans would love to talk to you. But keep them short and concise.
    
//     ${contextPrompt}
    
//     Respond in the following JSON format without any markdown formatting or code blocks:
//     {
//       "status": "success|warning|error",
//       "answer": "Direct answer to the user's question",
//       "details": "Additional context or explanation",
//       "recommendations": ["Any relevant recommendations"],
//       "warnings": ["Any safety or procedure warnings if applicable"]
//     }

//     Focus on providing clear, actionable information that directly addresses the user's question. Keep it conversational and short replies make the replies more voice like such that if someone hears our output he or she feels the human touch. Do not include markdown formatting like \`\`\`json or code blocks in your response.`;
    
//     Logger.info('[VoiceQuery] Sending request to Gemini API with prompt and image');
//     Logger.info('[VoiceQuery] User query:', query);

//     const result = await model.generateContent([
//       { text: prompt },
//       imagePart
//     ]);

//     const responseText = await result.response.text();
//     Logger.info('[VoiceQuery] Received response from Gemini API:', responseText.slice(0, 100) + '...');
    
//     let analysis;
    
//     try {
//       // Clean up response text by removing any markdown formatting
//       const cleanedResponse = responseText
//         .replace(/```json/g, '')
//         .replace(/```/g, '')
//         .trim();
        
//       Logger.info('[VoiceQuery] Cleaned response:', cleanedResponse.slice(0, 100) + '...');
//       analysis = JSON.parse(cleanedResponse);
//       Logger.info('[VoiceQuery] Successfully parsed JSON response');
//     } catch (error) {
//       Logger.error('[VoiceQuery] Failed to parse JSON response:', error);
//       analysis = {
//         status: "warning",
//         answer: responseText,
//         details: "",
//         recommendations: [],
//         warnings: []
//       };
//     }

//     // 1. Fix in geminiController.js - validateDroneAssembly function
// // This ensures components are properly extracted and saved

// // Replace the component handling section in validateDroneAssembly
// if (userId && projectId && analysis.identifiedComponents) {
//   try {
//     // Get existing components
//     const context = await projectService.getProjectContext(userId, projectId);
//     const existingComponents = context.components || [];
    
//     // Log the existing and new components for debugging
//     Logger.info('[ValidateAssembly] Processing components', { 
//       existingCount: existingComponents.length, 
//       newComponentsAvailable: !!analysis.identifiedComponents,
//       newComponentsArray: Array.isArray(analysis.identifiedComponents)
//     });
    
//     // Extract components from analysis - with better error handling
//     let newComponents = [];
//     if (Array.isArray(analysis.identifiedComponents)) {
//       newComponents = analysis.identifiedComponents;
//     } else if (analysis.identifiedParts && Array.isArray(analysis.identifiedParts)) {
//       // Some responses use identifiedParts instead
//       newComponents = analysis.identifiedParts;
//     }
    
//     // Normalize component format for consistent comparison
//     const normalizedExisting = existingComponents.map(comp => {
//       if (typeof comp === 'string') return { name: comp };
//       return comp;
//     });
    
//     // Merge components (avoiding duplicates with better logic)
//     const allComponents = [...normalizedExisting];
//     let newComponentsAdded = 0;
    
//     newComponents.forEach(newComp => {
//       // Handle both string and object formats
//       const newCompObj = typeof newComp === 'string' ? { name: newComp } : newComp;
      
//       // Skip if no name property
//       if (!newCompObj.name) return;
      
//       // Check if component already exists
//       const exists = normalizedExisting.some(existing => 
//         (existing.name && newCompObj.name && 
//          existing.name.toLowerCase() === newCompObj.name.toLowerCase())
//       );
      
//       if (!exists) {
//         allComponents.push(newCompObj);
//         newComponentsAdded++;
//       }
//     });
    
//     if (newComponentsAdded > 0) {
//       // Update components in database
//       Logger.info('[ValidateAssembly] Adding new components to database', { 
//         newComponentsAdded,
//         totalComponents: allComponents.length 
//       });
      
//       await projectService.updateComponents(userId, projectId, allComponents);
//       Logger.info('[ValidateAssembly] Components updated successfully');
//     } else {
//       Logger.info('[ValidateAssembly] No new components to add');
//     }
//   } catch (updateError) {
//     Logger.error('[ValidateAssembly] Failed to update components', updateError);
//     // Continue without failing the main request
//   }
// }

const handleVoiceQuery = async (req, res) => {
  try {
    const { image, query, currentStep, userId, projectId } = req.body;

    // Clear user cache if we have user+project
    if (userId && projectId) {
      clearUserCache(userId, projectId);
    }

    // Log voice request
    Logger.info(`[VoiceQuery] Processing request for step ${currentStep}`, {
      hasImage: !!image,
      userId,
      projectId
    });

    // Basic validation
    if (!image) {
      throw new Error('No image data provided');
    }
    if (!query || query.trim() === '') {
      throw new Error('No voice query provided');
    }

    // Optional: build context
    let projectContext = null;
    let contextPrompt = '';
    if (userId && projectId) {
      try {
        projectContext = await projectService.getProjectContext(userId, projectId);
        contextPrompt = buildContextFromProject(projectContext);
      } catch (err) {
        Logger.warn('[VoiceQuery] Could not retrieve project context', err);
      }
    }

    // Strip data URL prefix
    const base64Image = image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: 'image/jpeg'
      }
    };

    // Prompt requiring "identifiedComponents"
    const prompt = `You are a drone assembly AI assistant. The user asked: "${query}".
They have provided an image for context (step ${currentStep}). Please:
1) Directly answer the user's question
2) If you see any new drone components in the image, identify them in "identifiedComponents"
3) Keep the tone friendly, short, somewhat humorous but factual
4) If user asks "can you identify/list down components so far," mention them from identifiedComponents
5) Return JSON with NO markdown:
6) If you see user asking for a drone image than reply him that feature is under development/beta will try to generate one be slighty funny about it

{
  "status": "success|warning|error",
  "answer": "short direct answer",
  "details": "extra context",
  "recommendations": ["optional recs"],
  "warnings": ["optional disclaimers"],
  "identifiedComponents": [
    { "name": "component name", "purpose": "what it's for", "condition": "any visible" }
  ]
}

${contextPrompt}
`;

    // Send to Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent([{ text: prompt }, imagePart]);
    const responseText = await result.response.text();
    Logger.info('[VoiceQuery] Gemini raw response:', responseText);

    // Attempt JSON parse
    let analysis;
    try {
      const cleanedResponse = responseText
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      analysis = JSON.parse(cleanedResponse);
    } catch (parseErr) {
      // fallback
      analysis = {
        status: 'warning',
        answer: responseText,
        details: '',
        recommendations: [],
        warnings: [],
        identifiedComponents: []
      };
    }

    // Store identifiedComponents if present
    if (userId && projectId && Array.isArray(analysis.identifiedComponents)) {
      try {
        const context = await projectService.getProjectContext(userId, projectId);
        const existingComponents = context.components || [];

        const normalizedExisting = existingComponents.map((c) =>
          typeof c === 'string' ? { name: c } : c
        );

        let newAdded = 0;
        let allComponents = [...normalizedExisting];

        analysis.identifiedComponents.forEach((comp) => {
          if (!comp.name) return;
          const exists = normalizedExisting.some(
            (ec) =>
              ec.name &&
              comp.name &&
              ec.name.toLowerCase() === comp.name.toLowerCase()
          );
          if (!exists) {
            allComponents.push(comp);
            newAdded++;
          }
        });

        if (newAdded > 0) {
          await projectService.updateComponents(userId, projectId, allComponents);
          Logger.info(`[VoiceQuery] Stored ${newAdded} new component(s)`);
        }
      } catch (dbErr) {
        Logger.error('[VoiceQuery] Failed updating components', dbErr);
      }
    }

    // Return success JSON
    Logger.info('[VoiceQuery] Sending successful response to client');
    return res.json({
      success: true,
      analysis,
      hasContext: !!projectContext,
      meta: {
        timestamp: new Date().toISOString(),
        step: currentStep,
        query
      }
    });
  } catch (error) {
    console.error('[VoiceQuery] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Enhanced validateDroneAssembly with project context
 */
const validateDroneAssembly = async (req, res) => {
  try {
    const { image, currentStep, userId, projectId } = req.body;
    
    Logger.info(`[ValidateAssembly] Processing request for step ${currentStep}`, {
      hasImage: !!image,
      userId,
      projectId,
      timestamp: new Date().toISOString()
    });
    
    // With this improved code:
    const cacheKey = createCacheKey(userId, projectId, image);
        
    // Cache lookup with better logging
    const cachedResult = analysisCache.get(cacheKey);
    if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_DURATION) {
      Logger.info('[ValidateAssembly] Returning cached result', {
        cacheAge: Date.now() - cachedResult.timestamp,
        userId,
        projectId
      });
      return res.json(cachedResult.data);
    }

    // Get project context if userId and projectId are provided
    let projectContext = null;
    let contextPrompt = '';

    if (userId && projectId) {
      clearUserCache(userId, projectId);
    }
    
    if (userId && projectId) {
      try {
        projectContext = await projectService.getProjectContext(userId, projectId);
        contextPrompt = buildContextFromProject(projectContext);
        Logger.info('[ValidateAssembly] Retrieved project context', { 
          projectId,
          hasComponents: projectContext.components?.length > 0,
          componentCount: projectContext.components?.length || 0
        });
      } catch (contextError) {
        Logger.warn('[ValidateAssembly] Could not retrieve project context', contextError);
        // Continue without context if there's an error
      }
    }

    // Remove data URL prefix if present
    const base64Image = image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
    
    // Create the image part for the model
    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: "image/jpeg"
      }
    };

    // Get the pro-vision model for image analysis
    Logger.info('[ValidateAssembly] Preparing Gemini model request');
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const handleIdentifiedComponents = async (userId, projectId, analysis) => {
      if (!userId || !projectId) {
        Logger.warn('[HandleComponents] Missing userId or projectId');
        return;
      }
    
      try {
        // Extract components from either identifiedComponents or identifiedParts
        let newComponents = [];
        if (analysis.identifiedComponents && Array.isArray(analysis.identifiedComponents)) {
          newComponents = analysis.identifiedComponents;
        } else if (analysis.identifiedParts && Array.isArray(analysis.identifiedParts)) {
          newComponents = analysis.identifiedParts;
        }
    
        if (newComponents.length === 0) {
          Logger.info('[HandleComponents] No new components to process');
          return;
        }
    
        // Get existing components
        const context = await projectService.getProjectContext(userId, projectId);
        const existingComponents = context.components || [];
    
        // Normalize existing components
        const normalizedExisting = existingComponents.map(comp => {
          if (typeof comp === 'string') {
            return { name: comp };
          }
          return comp;
        });
    
        // Normalize and merge new components
        const allComponents = [...normalizedExisting];
        let newComponentsAdded = 0;
    
        newComponents.forEach(newComp => {
          const normalizedComp = typeof newComp === 'string' ? { name: newComp } : newComp;
          
          // Skip if no name property
          if (!normalizedComp.name) return;
    
          // Check for duplicates (case-insensitive)
          const exists = normalizedExisting.some(existing => 
            existing.name && 
            normalizedComp.name && 
            existing.name.toLowerCase() === normalizedComp.name.toLowerCase()
          );
    
          if (!exists) {
            allComponents.push(normalizedComp);
            newComponentsAdded++;
          }
        });
    
        if (newComponentsAdded > 0) {
          Logger.info('[HandleComponents] Updating components in database', {
            userId,
            projectId,
            totalComponents: allComponents.length,
            newComponentsAdded
          });
    
          await projectService.updateComponents(userId, projectId, allComponents);
          Logger.info('[HandleComponents] Components successfully updated');
        }
    
        return newComponentsAdded;
      } catch (error) {
        Logger.error('[HandleComponents] Error processing components:', error);
        throw error;
      }
    };

    // Enhanced prompt to emphasize component identification
    const prompt = `You are a drone assembly AI assistant. Analyze this image of a drone assembly at step ${currentStep}.
      
      ${contextPrompt}
      
      Respond in the following JSON format without any markdown formatting or code blocks:
      {
        "status": "success|warning|error",
        "feedback": "Main feedback about the current state",
        "warnings": ["List of specific warnings or issues"],
        "nextSteps": ["Ordered list of next actions to take"],
        "misalignments": ["Any components that need adjustment"],
        "progress": "percentage of step completed",
        "canProceed": boolean,
        "identifiedComponents": [{"name": "Component name", "purpose": "Component purpose"}]
      }

      IMPORTANT: Always include an "identifiedComponents" array with ALL components you can see in the image, even if they were mentioned in previous context.
      
      DO NOT omit the "identifiedComponents" field - it is required for tracking assembly progress.
      If you can identify any components in the image, list them with detailed names and purposes.
      If no components are visible, return an empty array for "identifiedComponents".

      Focus on:
      1. Component alignment and placement
      2. Connection security and proper fitting
      3. Wire routing and management
      4. Safety concerns
      5. Common assembly mistakes
      
      Make your feedback specific, actionable, and safety-focused. Do not include markdown formatting like \`\`\`json or code blocks in your response.`;
    
    Logger.info('[ValidateAssembly] Sending request to Gemini API');
    const result = await model.generateContent([
      { text: prompt },
      imagePart
    ]);

    const responseText = await result.response.text();
    Logger.info('[ValidateAssembly] Received response from Gemini API');
    
    let analysis;
    
    try {
      // Clean up response text by removing any markdown formatting
      const cleanedResponse = responseText
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
        
      Logger.info('[ValidateAssembly] Cleaned response:', cleanedResponse.slice(0, 100) + '...');
      
      // Parse the JSON response
      analysis = JSON.parse(cleanedResponse);
      
      // Ensure identifiedComponents exists
      if (!analysis.identifiedComponents) {
        Logger.warn('[ValidateAssembly] Missing identifiedComponents in response, adding empty array');
        analysis.identifiedComponents = [];
      }
      
      Logger.info('[ValidateAssembly] Successfully parsed JSON response', {
        status: analysis.status,
        componentCount: analysis.identifiedComponents?.length || 0
      });
    } catch (error) {
      Logger.error('[ValidateAssembly] Failed to parse JSON response:', error);
      // If JSON parsing fails, structure the raw response
      analysis = {
        status: "warning",
        feedback: responseText,
        warnings: [],
        nextSteps: [],
        misalignments: [],
        progress: "0",
        canProceed: false,
        identifiedComponents: [] // Ensure the field exists
      };
    }

    // Store identified components if userId and projectId are provided
    if (userId && projectId && Array.isArray(analysis.identifiedComponents)) {
      try {
        Logger.info('[ValidateAssembly] Processing identified components', {
          count: analysis.identifiedComponents.length
        });
        
        // Get existing components
        const context = await projectService.getProjectContext(userId, projectId);
        const existingComponents = context.components || [];
        
        // Log detailed component information
        Logger.info('[ValidateAssembly] Component comparison', {
          existingCount: existingComponents.length,
          newCount: analysis.identifiedComponents.length,
          existingSample: existingComponents.slice(0, 2),
          newSample: analysis.identifiedComponents.slice(0, 2)
        });
        
        // Normalize existing components
        const normalizedExisting = existingComponents.map(comp => {
          if (typeof comp === 'string') {
            return { name: comp };
          }
          return comp;
        });
        
        // Normalize new components
        const normalizedNew = analysis.identifiedComponents.map(comp => {
          if (typeof comp === 'string') {
            return { name: comp };
          }
          return comp;
        });
        
        // Merge components (avoiding duplicates with better matching)
        const allComponents = [...normalizedExisting];
        let newComponentsAdded = 0;
        
        normalizedNew.forEach(newComp => {
          // Skip if no name property
          if (!newComp.name) return;
          
          // Check for duplicates (case-insensitive)
          const exists = normalizedExisting.some(existing => 
            existing.name && 
            newComp.name && 
            existing.name.toLowerCase() === newComp.name.toLowerCase()
          );
          
          if (!exists) {
            allComponents.push(newComp);
            newComponentsAdded++;
          }
        });
        
        if (newComponentsAdded > 0) {
          // Update components in database
          Logger.info('[ValidateAssembly] Updating components in database', { 
            projectId, 
            totalComponents: allComponents.length,
            newComponentsAdded
          });
          
          await projectService.updateComponents(userId, projectId, allComponents);
          Logger.info('[ValidateAssembly] Components successfully updated in database');
        } else {
          Logger.info('[ValidateAssembly] No new components to add to database');
        }
      } catch (updateError) {
        Logger.error('[ValidateAssembly] Failed to update components', updateError);
      }
    }

    // Update completed step if canProceed is true
    if (userId && projectId && analysis.canProceed === true) {
      try {
        const stepInfo = {
          stepNumber: currentStep,
          title: `Step ${currentStep} completed`,
          timestamp: new Date().toISOString(),
          details: analysis.feedback || 'Step completed successfully',
        };
        
        Logger.info('[ValidateAssembly] Adding completed step', { 
          projectId,
          stepNumber: currentStep
        });
        
        await projectService.addCompletedStep(userId, projectId, stepInfo);
        Logger.info('[ValidateAssembly] Successfully added completed step');
      } catch (stepError) {
        Logger.error('[ValidateAssembly] Failed to add completed step', stepError);
      }
    }

  // With this improved code:
  const responseData = { 
    success: true, 
    analysis,
    hasContext: !!projectContext,
    meta: {
      timestamp: Date.now(), // Add timestamp to response meta
      cacheSource: 'fresh'   // Mark as fresh response
    }
  };

  // Cache the new result
  analysisCache.set(cacheKey, {
    timestamp: Date.now(),
    data: responseData
  });

  Logger.info('[ValidateAssembly] Cached fresh response', { cacheKey });
    res.json(responseData);

  } catch (error) {
    Logger.error('[ValidateAssembly] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
/**
 * Enhanced getDroneInstructions with project context
 */
const getDroneInstructions = async (req, res) => {
  try {
    const { step, userId, projectId } = req.body;
    
    Logger.info(`[GetInstructions] Processing request for step ${step}`, {
      userId,
      projectId
    });
    
    // Get project context if userId and projectId are provided
    let projectContext = null;
    let contextPrompt = '';
    
    if (userId && projectId) {
      try {
        projectContext = await projectService.getProjectContext(userId, projectId);
        contextPrompt = buildContextFromProject(projectContext);
        Logger.info('[GetInstructions] Retrieved project context', { projectId });
      } catch (contextError) {
        Logger.warn('[GetInstructions] Could not retrieve project context', contextError);
        // Continue without context if there's an error
      }
    }
    
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    const prompt = `Create detailed drone assembly instructions for step ${step}.
    
    ${contextPrompt}
    
    Respond in the following JSON format:
    {
      "stepTitle": "Brief title for this step",
      "overview": "Brief overview of what will be accomplished",
      "tools": ["Required tools list"],
      "components": ["Required components list"],
      "steps": ["Detailed step-by-step instructions"],
      "safetyNotes": ["Important safety considerations"],
      "tips": ["Helpful tips and common mistakes to avoid"]
    }

    Make instructions clear, detailed, and beginner-friendly.`;

    Logger.info('[GetInstructions] Sending request to Gemini API');
    const result = await model.generateContent(prompt);
    const responseText = await result.response.text();
    Logger.info('[GetInstructions] Received response from Gemini API');
    
    let instructions;
    try {
      instructions = JSON.parse(responseText);
      Logger.info('[GetInstructions] Successfully parsed JSON response');
    } catch (error) {
      Logger.error('[GetInstructions] Failed to parse JSON response:', error);
      instructions = {
        stepTitle: `Step ${step}`,
        overview: responseText,
        tools: [],
        components: [],
        steps: [],
        safetyNotes: [],
        tips: []
      };
    }

    Logger.info('[GetInstructions] Sending successful response to client');
    res.json({
      success: true,
      instructions,
      hasContext: !!projectContext
    });

  } catch (error) {
    Logger.error('[GetInstructions] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Enhanced identifyDroneParts with project context and component tracking
 */
const identifyDroneParts = async (req, res) => {
  try {
    const { image, userId, projectId } = req.body;
    
    Logger.info('[IdentifyParts] Processing request', {
      hasImage: !!image,
      userId,
      projectId,
      timestamp: new Date().toISOString()
    });
    
    // Get project context if userId and projectId are provided
    let projectContext = null;
    let contextPrompt = '';
    
    if (userId && projectId) {
      try {
        projectContext = await projectService.getProjectContext(userId, projectId);
        contextPrompt = buildContextFromProject(projectContext);
        Logger.info('[IdentifyParts] Retrieved project context', { projectId });
      } catch (contextError) {
        Logger.warn('[IdentifyParts] Could not retrieve project context', contextError);
        // Continue without context if there's an error
      }
    }
    
    const base64Image = image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: "image/jpeg"
      }
    };

    Logger.info('[IdentifyParts] Preparing Gemini model request');
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const prompt = `Identify drone components in this image.
    
    ${contextPrompt}
    
    Respond in the following JSON format:
    {
      "identifiedParts": [
        {
          "name": "Component name",
          "purpose": "Component's function",
          "condition": "Visible condition/status",
          "notes": "Any special observations"
        }
      ],
      "missingComponents": ["List of expected but missing parts"],
      "recommendations": ["Assembly recommendations"],
      "concerns": ["Any quality or compatibility concerns"]
    }
    
    Be specific and technical but explain in beginner-friendly terms.`;

    Logger.info('[IdentifyParts] Sending request to Gemini API');
    const result = await model.generateContent([prompt, imagePart]);
    const responseText = await result.response.text();
    Logger.info('[IdentifyParts] Received response from Gemini API');
    
    let analysis;
    try {
      analysis = JSON.parse(responseText);
      Logger.info('[IdentifyParts] Successfully parsed JSON response');
    } catch (error) {
      Logger.error('[IdentifyParts] Failed to parse JSON response:', error);
      analysis = {
        identifiedParts: [],
        missingComponents: [],
        recommendations: [responseText],
        concerns: []
      };
    }

    // Update components in the database if userId and projectId are provided
    if (userId && projectId && analysis.identifiedParts && Array.isArray(analysis.identifiedParts)) {
      try {
        // Get existing components
        const context = await projectService.getProjectContext(userId, projectId);
        const existingComponents = context.components || [];
        
        // Extract identified parts
        const newComponents = analysis.identifiedParts;
        
        // Merge components (avoiding duplicates)
        const allComponents = [...existingComponents];
        newComponents.forEach(newComp => {
          const exists = existingComponents.some(existing => 
            (typeof existing === 'string' && existing === newComp.name) ||
            (existing.name && newComp.name && existing.name === newComp.name)
          );
          
          if (!exists) {
            allComponents.push(newComp);
          }
        });
        
        // Update components in database
        await projectService.updateComponents(userId, projectId, allComponents);
        Logger.info('[IdentifyParts] Updated project components', { componentCount: allComponents.length });
      } catch (updateError) {
        Logger.error('[IdentifyParts] Failed to update components', updateError);
        // Continue without failing the main request
      }
    }

    Logger.info('[IdentifyParts] Sending successful response to client');
    res.json({
      success: true,
      analysis,
      hasContext: !!projectContext
    });

  } catch (error) {
    Logger.error('[IdentifyParts] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * New method: initializeUser for first-time setup
 */
const initializeUser = async (req, res) => {
  try {
    const { userId, droneType } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: userId'
      });
    }
    
    Logger.info('[InitializeUser] Processing request', { userId, droneType });
    
    // Generate projectId for the new user
    const projectId = `proj-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
    const projectName = droneType ? `${droneType} Drone Assembly` : 'Drone Assembly Project';
    
    // Create new project
    const project = await projectService.getOrCreateProject(userId, projectId, projectName);
    
    // If drone type is provided, update it
    if (droneType) {
      await projectService.updateDroneType(userId, projectId, droneType);
    }
    
    Logger.info('[InitializeUser] User initialized successfully', { userId, projectId });
    
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    // Get personalized welcome message
    const welcomePrompt = `You are a friendly drone assembly assistant. 
    Create a personalized welcome message for a new user who wants to build a ${droneType || 'drone'}.
    Introduce yourself, explain how you can help with drone assembly, and suggest a good first step.
    Keep it conversational, friendly, and under 100 words.`;
    
    const welcomeResult = await model.generateContent(welcomePrompt);
    const welcomeMessage = await welcomeResult.response.text();
    
    res.json({
      success: true,
      project,
      welcomeMessage,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    Logger.error('[InitializeUser] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Rate limiting middleware
const apiLimiter = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: new Map(),
  
  checkLimit: (req, res, next) => {
    const ip = req.ip;
    const current = apiLimiter.maxRequests.get(ip) || { count: 0, timestamp: Date.now() };
    
    if (Date.now() - current.timestamp > apiLimiter.windowMs) {
      current.count = 0;
      current.timestamp = Date.now();
    }
    
    if (current.count >= 20) { // 20 requests per minute
      return res.status(429).json({
        success: false,
        error: 'Too many requests, please try again later.'
      });
    }
    
    current.count++;
    apiLimiter.maxRequests.set(ip, current);
    next();
  }
};

module.exports = {
  validateDroneAssembly,
  getDroneInstructions,
  identifyDroneParts,
  testGeminiConnection,
  handleVoiceQuery,
  initializeUser,
  apiLimiter
};