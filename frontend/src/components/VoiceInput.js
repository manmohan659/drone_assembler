// frontend/src/components/VoiceInput.js
import React, { useState, useCallback, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';
import Logger from '../utils/logger';

const VoiceInput = ({ onVoiceInput, disabled = false }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognition, setRecognition] = useState(null);
  const [error, setError] = useState(null);
  const [processingStatus, setProcessingStatus] = useState(null);
  const [silenceTimer, setSilenceTimer] = useState(null);
  const [lastResultTime, setLastResultTime] = useState(null);
  const [finalTranscript, setFinalTranscript] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Function to restart listening if it stops unexpectedly
  const restartRecognition = useCallback(() => {
    if (recognition && isListening && !isSubmitting) {
      try {
        console.log("[DEBUG] Attempting to restart voice recognition");
        recognition.start();
      } catch (error) {
        console.error("[DEBUG] Error restarting recognition:", error);
        // If we can't restart, create a new instance
        startListening();
      }
    }
  }, [recognition, isListening, isSubmitting]);

  // Check for long silence and submit if needed
  const checkSilence = useCallback(() => {
    if (isListening && lastResultTime) {
      const silenceTime = Date.now() - lastResultTime;
      if (silenceTime > 2000 && transcript && transcript !== 'Listening...' && !isSubmitting) {
        console.log("[DEBUG] Detected silence, submitting transcript:", transcript);
        submitTranscript(transcript);
      }
    }
  }, [isListening, lastResultTime, transcript, isSubmitting]);

  // Function to submit the final transcript
  const submitTranscript = useCallback((text) => {
    if (isSubmitting || !text || text === 'Listening...') return;
    
    setIsSubmitting(true);
    setProcessingStatus('Processing voice input...');
    Logger.voiceCapture(text);
    
    // Store the final transcript
    setFinalTranscript(text);
    
    // Pass the transcript to parent component
    onVoiceInput(text, (status) => {
      setProcessingStatus(status);
      // Clear transcript and status after processing completes
      setTimeout(() => {
        setTranscript('');
        setProcessingStatus(null);
        setIsSubmitting(false);
      }, 5000);
    });
  }, [onVoiceInput, isSubmitting]);

  const startListening = useCallback(() => {
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        throw new Error('Speech recognition is not supported in this browser');
      }

      // Clear any previous state
      if (recognition) {
        try {
          recognition.stop();
        } catch (e) {
          console.log("Recognition already stopped");
        }
      }
      
      if (silenceTimer) {
        clearInterval(silenceTimer);
      }

      const recognitionInstance = new SpeechRecognition();
      
      // Enable continuous mode for smoother experience
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-US';
      recognitionInstance.maxAlternatives = 1;

      recognitionInstance.onstart = () => {
        Logger.info('Voice recognition started');
        setIsListening(true);
        setError(null);
        setTranscript('Listening...');
        setProcessingStatus(null);
        setLastResultTime(Date.now());
        
        // Start silence detection interval
        const timer = setInterval(checkSilence, 500);
        setSilenceTimer(timer);
      };

      recognitionInstance.onresult = (event) => {
        setLastResultTime(Date.now());
        
        // Build transcript from all results
        let currentTranscript = '';
        let isFinal = false;
        
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          currentTranscript += result[0].transcript;
          
          if (result.isFinal) {
            isFinal = true;
          }
        }
        
        // If we have a transcript, update it
        if (currentTranscript) {
          setTranscript(currentTranscript);
        }
        
        // If this is explicitly marked as final or we have a long enough transcript
        if (isFinal || (currentTranscript.length > 10 && !event.results[event.results.length-1].isFinal)) {
          submitTranscript(currentTranscript);
        }
      };

      recognitionInstance.onerror = (event) => {
        // Don't treat "no-speech" as an error, just keep listening
        if (event.error === 'no-speech') {
          console.log("[DEBUG] No speech detected yet, continuing to listen");
          return;
        }
        
        // For "aborted" errors, try to restart
        if (event.error === 'aborted' && isListening) {
          console.log("[DEBUG] Recognition aborted, attempting to restart");
          setTimeout(restartRecognition, 300);
          return;
        }
        
        Logger.error('Voice recognition error:', event.error);
        setError(`Error: ${event.error}`);
        setIsListening(false);
        
        // Try to restart for recoverable errors
        if (event.error === 'network' || event.error === 'service-not-allowed') {
          console.log("[DEBUG] Recoverable error, attempting to restart");
          setTimeout(startListening, 1000);
        }
      };

      recognitionInstance.onend = () => {
        console.log("[DEBUG] Recognition ended, isListening:", isListening);
        
        // If we're still supposed to be listening, try to restart
        if (isListening && !isSubmitting) {
          console.log("[DEBUG] Recognition ended while still listening, restarting");
          setTimeout(restartRecognition, 300);
        } else {
          // Normal end of recognition
          Logger.info('Voice recognition ended');
          setIsListening(false);
          
          // If we have a transcript but haven't submitted it yet, submit it now
          if (transcript && transcript !== 'Listening...' && !isSubmitting && !finalTranscript) {
            submitTranscript(transcript);
          } else if (!error && !processingStatus && !isSubmitting) {
            setProcessingStatus('Processing...');
          }
          
          // Clean up silence timer
          if (silenceTimer) {
            clearInterval(silenceTimer);
            setSilenceTimer(null);
          }
        }
      };

      setRecognition(recognitionInstance);
      recognitionInstance.start();
    } catch (error) {
      Logger.error('Failed to initialize voice recognition:', error);
      setError(error.message);
    }
  }, [onVoiceInput, recognition, isListening, transcript, silenceTimer, checkSilence, submitTranscript, finalTranscript, isSubmitting, restartRecognition]);

  const stopListening = useCallback(() => {
    if (recognition) {
      recognition.stop();
      Logger.info('Voice recognition manually stopped');
      setIsListening(false);
      
      // Submit any existing transcript if there is one
      if (transcript && transcript !== 'Listening...' && !isSubmitting) {
        submitTranscript(transcript);
      }
      
      // Clean up silence timer
      if (silenceTimer) {
        clearInterval(silenceTimer);
        setSilenceTimer(null);
      }
    }
  }, [recognition, transcript, isSubmitting, silenceTimer, submitTranscript]);

  useEffect(() => {
    return () => {
      if (recognition) {
        recognition.stop();
        Logger.info('Voice recognition cleanup on unmount');
      }
      
      // Clean up silence timer on unmount
      if (silenceTimer) {
        clearInterval(silenceTimer);
      }
    };
  }, [recognition, silenceTimer]);

  return (
    <div className="flex flex-col items-end gap-2">
      {/* Enhanced status display with typewriter effect for transcript */}
      {(transcript || processingStatus) && (
        <div className={`bg-black/70 backdrop-blur-sm rounded-lg px-4 py-3 text-white text-sm max-w-xs 
          ${transcript && transcript !== 'Listening...' ? 'border-l-4 border-indigo-500' : ''}
          ${isSubmitting ? 'animate-pulse' : ''}`}>
          {isListening && transcript !== 'Listening...' ? (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="font-medium">Recognized speech:</span>
            </div>
          ) : null}
          
          <div className={transcript && transcript !== 'Listening...' ? 'mt-1' : ''}>
            {transcript === 'Listening...' ? (
              <div className="flex items-center gap-2">
                <span>Listening</span>
                <span className="inline-flex">
                  <span className="animate-bounce delay-100">.</span>
                  <span className="animate-bounce delay-200">.</span>
                  <span className="animate-bounce delay-300">.</span>
                </span>
              </div>
            ) : transcript ? (
              <span className="whitespace-pre-wrap">{transcript}</span>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span>{processingStatus}</span>
              </div>
            )}
          </div>
          
          {/* Speech guidance */}
          {isListening && transcript === 'Listening...' && (
            <div className="mt-2 text-xs text-indigo-300 italic">
              Speak clearly into your microphone
            </div>
          )}
          
          {/* Processing indicator */}
          {isSubmitting && (
            <div className="mt-2 w-full bg-gray-700 rounded-full h-1">
              <div className="bg-indigo-500 h-1 rounded-full animate-progress"></div>
            </div>
          )}
        </div>
      )}
      
      {/* Improved error display */}
      {error && (
        <div className="bg-red-900/70 backdrop-blur-sm rounded-lg px-4 py-3 text-white text-sm max-w-xs border-l-4 border-red-600">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span className="font-medium">Error:</span>
          </div>
          <div className="mt-1">
            {error.replace(/^Error: /, '')}
          </div>
          <button 
            onClick={startListening}
            className="mt-2 text-xs text-red-300 hover:text-white underline"
          >
            Try again
          </button>
        </div>
      )}
      
      {/* Enhanced voice input button */}
      <button
        onClick={isListening ? stopListening : startListening}
        disabled={disabled}
        className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg transition-all relative ${
          isListening 
            ? 'bg-red-600 hover:bg-red-700 scale-110' 
            : 'bg-purple-600 hover:bg-purple-700'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={isListening ? 'Stop listening (your speech will be processed)' : 'Start voice input'}
        aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
      >
        {isListening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
        
        {/* Enhanced listening animation */}
        {isListening && (
          <>
            <div className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping" />
            <div className="absolute -inset-2 rounded-full border-2 border-red-300/50 animate-ping" style={{animationDuration: '2s'}} />
          </>
        )}
        
        {/* Helper label */}
        <div className="absolute -bottom-7 text-xs font-medium text-white bg-black/50 rounded-full px-2 py-0.5 whitespace-nowrap">
          {isListening ? 'Stop & Process' : 'Speak'}
        </div>
      </button>
    </div>
  );
};

export default VoiceInput;