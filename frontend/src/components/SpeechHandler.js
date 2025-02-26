// frontend/src/components/SpeechHandler.js
import React, { useEffect, useCallback, useRef } from 'react';
import Logger from '../utils/logger';

const SpeechHandler = ({ text, onSpeechEnd, autoSpeak = true }) => {
  // Use refs to track if component is mounted
  const isMounted = useRef(true);
  // Track if we're currently speaking
  const isSpeaking = useRef(false);
  // Store the current utterance
  const currentUtterance = useRef(null);
  // Store last spoken text to avoid repeating the same text
  const lastSpokenText = useRef('');
  // Use a queue for speech requests
  const speechQueue = useRef([]);
  // Debounce timer
  const debounceTimer = useRef(null);
  
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
    currentUtterance.current = null;
    // Clear the queue when canceling
    speechQueue.current = [];
  }, []);

  // Process the speech queue
  const processSpeechQueue = useCallback(() => {
    // If already speaking or queue is empty, do nothing
    if (isSpeaking.current || speechQueue.current.length === 0) {
      return;
    }

    // Get the next speech item
    const nextSpeech = speechQueue.current.shift();
    
    try {
      // Set speaking state
      isSpeaking.current = true;
      
      const utterance = new SpeechSynthesisUtterance(nextSpeech);
      currentUtterance.current = utterance;
      
      // Log the speech start
      Logger.info('Starting speech synthesis:', { 
        text: nextSpeech.slice(0, 100) + (nextSpeech.length > 100 ? '...' : '')
      });
      
      utterance.onend = () => {
        Logger.info('Speech synthesis completed');
        isSpeaking.current = false;
        currentUtterance.current = null;
        
        // Process next item in queue if any
        if (speechQueue.current.length > 0) {
          setTimeout(processSpeechQueue, 100);
        } else if (isMounted.current && onSpeechEnd) {
          onSpeechEnd();
        }
      };
      
      utterance.onerror = (error) => {
        Logger.error('Speech synthesis error:', error);
        isSpeaking.current = false;
        currentUtterance.current = null;
        
        // Process next item even if there's an error
        if (speechQueue.current.length > 0) {
          setTimeout(processSpeechQueue, 100);
        }
      };
      
      // Set rate slightly slower for better comprehension
      utterance.rate = 0.9;
      
      // Start speaking
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      Logger.error('Failed to start speech synthesis:', error);
      isSpeaking.current = false;
      currentUtterance.current = null;
      
      // Process next item even if there's an error
      if (speechQueue.current.length > 0) {
        setTimeout(processSpeechQueue, 100);
      }
    }
  }, [onSpeechEnd]);

  // Add text to speech queue with debouncing
  const queueSpeech = useCallback((rawText) => {
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
    
    // Update last spoken text
    lastSpokenText.current = processedText;
    
    // Clear any existing debounce timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    // Set a new debounce timer
    debounceTimer.current = setTimeout(() => {
      // Cancel any ongoing speech
      cancelSpeech();
      
      // Add to queue and process
      speechQueue.current.push(processedText);
      processSpeechQueue();
    }, 300); // 300ms debounce
  }, [initSpeechSynthesis, cancelSpeech, processSpeechQueue]);

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
      // Clear any pending timers
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [initSpeechSynthesis, cancelSpeech]);

  // Effect to handle text changes with proper cleanup
  useEffect(() => {
    if (autoSpeak && text) {
      queueSpeech(text);
    }
    
    // If text is cleared, cancel any ongoing speech
    if (!text) {
      cancelSpeech();
    }
  }, [text, autoSpeak, queueSpeech, cancelSpeech]);

  return null; // This is a non-visual component
};

export default SpeechHandler;