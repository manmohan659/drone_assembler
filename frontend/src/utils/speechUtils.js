// frontend/src/utils/speechUtils.js

export const processGeminiResponse = (response) => {
  // Extract the main feedback from the analysis
  if (!response || !response.analysis) {
    console.warn('Invalid Gemini response format:', response);
    return 'I could not analyze the image properly. Please try again.';
  }

  // Try to handle raw text that might contain JSON
  if (typeof response.analysis === 'string' && 
      (response.analysis.includes('{') || response.analysis.includes('```'))) {
    try {
      // Clean any markdown formatting
      const cleanedText = response.analysis
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
        
      // Try to parse as JSON
      const jsonData = JSON.parse(cleanedText);
      response.analysis = jsonData;
    } catch (error) {
      console.error('Failed to parse JSON in analysis:', error);
      // Continue with the original text
    }
  }
  
  // Safe extraction of properties with fallbacks
  const analysis = response.analysis || {};
  const feedback = analysis.feedback || '';
  const warnings = Array.isArray(analysis.warnings) ? analysis.warnings : [];
  const nextSteps = Array.isArray(analysis.nextSteps) ? analysis.nextSteps : [];
  const misalignments = Array.isArray(analysis.misalignments) ? analysis.misalignments : [];
  const answer = analysis.answer || '';
  const details = analysis.details || '';
  const recommendations = Array.isArray(analysis.recommendations) ? analysis.recommendations : [];
  
  // Construct a natural speech response
  let speechText = '';
  
  // Add primary content from either analysis or voice query
  if (answer) {
    speechText += answer + ' ';
  }
  
  if (details) {
    speechText += details + ' ';
  }
  
  if (feedback) {
    speechText += feedback + ' ';
  }
  
  // Add warnings if present
  if (warnings.length > 0) {
    speechText += 'Please note the following warnings: ' + warnings.join('. ') + ' ';
  }
  
  // Add recommendations if present
  if (recommendations.length > 0) {
    speechText += 'Recommendations: ' + recommendations.join('. ') + ' ';
  }
  
  // Add misalignments if present
  if (misalignments.length > 0) {
    speechText += 'The following components need adjustment: ' + misalignments.join(', ') + ' ';
  }
  
  // Add next steps if present
  if (nextSteps.length > 0) {
    speechText += 'Here are your next steps: ' + nextSteps.join('. ') + ' ';
  }
  
  // Fallback if we somehow got no text
  if (!speechText.trim()) {
    // Try to use any string in the analysis as a fallback
    if (typeof response.analysis === 'string') {
      return response.analysis;
    }
    
    // Last resort fallback
    return 'Analysis completed. Check the screen for details.';
  }
  
  return speechText.trim();
};