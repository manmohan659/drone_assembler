// frontend/src/components/SpeechHandler.js
import React, { useEffect, useCallback, useRef } from 'react';
import Logger from '../utils/logger';

const SpeechHandler = ({ text, onSpeechEnd, autoSpeak = true }) => {
  // Use a ref to track if component is mounted
  const isMounted = useRef(true);
  // Track if we're currently speaking
  const isSpeaking = useRef(false);
  // Track the current utterance's request ID to avoid duplicates
  const currentRequestId = useRef(null);
  // Store last spoken text to avoid repeating the same text
  const lastSpokenText = useRef('');
  
  // Process text to make it more suitable for speech
  const processTextForSpeech = (text) => {
    if (!text) return '';
    
    // If the text looks like JSON, try to extract useful parts
    if (text && (text.includes('{') || text.includes('```'))) {
      try {
        // Clean any markdown formatting
        const cleanedText = text
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .trim();
          
        // Try to parse as JSON
        const jsonData = JSON.parse(cleanedText);
        
        // Extract human-readable content based on available fields
        let speechText = '';
        
        if (jsonData.answer) {
          speechText += jsonData.answer + ' ';
        }
        
        if (jsonData.details) {
          speechText += jsonData.details + ' ';
        }
        
        if (jsonData.feedback) {
          speechText += jsonData.feedback + ' ';
        }
        
        if (jsonData.warnings && jsonData.warnings.length > 0) {
          speechText += 'Warnings: ' + jsonData.warnings.join('. ') + ' ';
        }
        
        if (jsonData.recommendations && jsonData.recommendations.length > 0) {
          speechText += 'Recommendations: ' + jsonData.recommendations.join('. ') + ' ';
        }
        
        if (jsonData.nextSteps && jsonData.nextSteps.length > 0) {
          speechText += 'Next steps: ' + jsonData.nextSteps.join('. ') + ' ';
        }
        
        return speechText.trim() || text;
      } catch (error) {
        Logger.error('Failed to parse JSON for speech:', error);
        return text;
      }
    }
    
    return text;
  };

  // Initialize speech synthesis
  const initSpeechSynthesis = useCallback(() => {
    // Check if speech synthesis is already initialized
    if (!window.speechSynthesis) {
      Logger.error('Speech synthesis not supported in this browser');
      return false;
    }
    
    return true;
  }, []);

  // Cancel any ongoing speech
  const cancelSpeech = useCallback(() => {
    try {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        Logger.info('Speech synthesis canceled');
      }
    } catch (e) {
      Logger.error('Error canceling speech:', e);
    }
    isSpeaking.current = false;
  }, []);

  // The speak function now uses a more reliable approach with duplicate prevention
  const speak = useCallback((rawText) => {
    if (!rawText) return;
    
    if (!initSpeechSynthesis()) return;
    
    // Process the text to make it suitable for speech
    const processedText = processTextForSpeech(rawText);
    if (!processedText) return;
    
    // Check if this is the same as the last spoken text - prevent duplicates
    if (processedText === lastSpokenText.current) {
      Logger.info('Skipping duplicate speech text');
      return;
    }
    
    // Generate a unique request ID for this speech request
    const requestId = Date.now().toString();
    
    // Always cancel any ongoing speech first 
    cancelSpeech();
    
    // Short timeout to ensure cancel completes
    setTimeout(() => {
      try {
        // Set speaking state and update tracking variables
        isSpeaking.current = true;
        currentRequestId.current = requestId;
        lastSpokenText.current = processedText;
        
        const utterance = new SpeechSynthesisUtterance(processedText);
        
        // Add unique identifier 
        utterance.requestId = requestId;
        
        // Log the speech start
        Logger.info('Starting speech synthesis:', { 
          processedText: processedText.slice(0, 100) + (processedText.length > 100 ? '...' : ''),
          requestId
        });
        
        utterance.onend = () => {
          // Only process end event for the current request
          if (utterance.requestId === currentRequestId.current) {
            Logger.info('Speech synthesis completed', { requestId: utterance.requestId });
            isSpeaking.current = false;
            currentRequestId.current = null;
            if (isMounted.current && onSpeechEnd) onSpeechEnd();
          } else {
            Logger.info('Ignoring completed event for outdated speech request', { 
              requestId: utterance.requestId,
              currentRequestId: currentRequestId.current
            });
          }
        };
        
        utterance.onerror = (error) => {
          Logger.error('Speech synthesis error:', error);
          isSpeaking.current = false;
          currentRequestId.current = null;
        };
        
        // Set rate slightly slower for better comprehension
        utterance.rate = 0.9;
        
        // Start speaking
        window.speechSynthesis.speak(utterance);
      } catch (error) {
        Logger.error('Failed to start speech synthesis:', error);
        isSpeaking.current = false;
        currentRequestId.current = null;
      }
    }, 100);
  }, [initSpeechSynthesis, cancelSpeech, onSpeechEnd]);

  // Effect for initial speech and cleanup
  useEffect(() => {
    // Set mounted flag
    isMounted.current = true;
    
    // Initialize speech synthesis
    initSpeechSynthesis();
    
    // Cleanup function
    return () => {
      isMounted.current = false;
      // Cancel any ongoing speech when component unmounts
      cancelSpeech();
    };
  }, [initSpeechSynthesis, cancelSpeech]);

  // Effect to handle text changes with proper cleanup
  useEffect(() => {
    if (autoSpeak && text) {
      // If text changed, cancel any current speech and speak the new text
      cancelSpeech();
      
      // Small delay to ensure cancellation is complete
      setTimeout(() => {
        speak(text);
      }, 150);
    }
    
    // If text is cleared, cancel any ongoing speech
    if (!text) {
      cancelSpeech();
    }
  }, [text, autoSpeak, speak, cancelSpeech]);

  return null; // This is a non-visual component
};

export default SpeechHandler;