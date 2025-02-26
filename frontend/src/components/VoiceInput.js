// frontend/src/components/VoiceInput.js
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Mic, MicOff, Send } from 'lucide-react';
import Logger from '../utils/logger';

const VoiceInput = ({ onVoiceInput, disabled = false }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognition, setRecognition] = useState(null);
  const [error, setError] = useState(null);
  const [processingStatus, setProcessingStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // References to track recognition state
  const recognitionRef = useRef(null);
  const transcriptRef = useRef('');
  const isListeningRef = useRef(false);
  
  // Update refs when state changes
  useEffect(() => {
    transcriptRef.current = transcript;
    isListeningRef.current = isListening;
    recognitionRef.current = recognition;
  }, [transcript, isListening, recognition]);

  // Function to submit the final transcript
  const submitTranscript = useCallback((text) => {
    if (isSubmitting || !text || text === 'Listening...') return;
    
    // Prevent multiple submissions
    setIsSubmitting(true);
    setProcessingStatus('Processing voice input...');
    Logger.voiceCapture(text);
    
    // Pass the transcript to parent component
    onVoiceInput(text, (status) => {
      setProcessingStatus(status);
      // Clear transcript and status after processing completes
      setTimeout(() => {
        setTranscript('');
        setProcessingStatus(null);
        setIsSubmitting(false);
      }, 2000);
    });
  }, [onVoiceInput, isSubmitting]);

  const startListening = useCallback(() => {
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        throw new Error('Speech recognition is not supported in this browser');
      }

      // Stop any existing recognition instance
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.log("Recognition already stopped");
        }
      }
      
      const recognitionInstance = new SpeechRecognition();
      
      // Important: Don't use continuous mode - this causes multiple rapid transcripts
      recognitionInstance.continuous = false;
      // Only return final results - prevents partial transcript processing
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'en-US';
      recognitionInstance.maxAlternatives = 1;

      recognitionInstance.onstart = () => {
        Logger.info('Voice recognition started');
        setIsListening(true);
        setError(null);
        setTranscript('Listening...');
        setProcessingStatus(null);
      };

      recognitionInstance.onresult = (event) => {
        const result = event.results[0][0].transcript;
        setTranscript(result);
        
        // Don't auto-submit - we'll wait for the user to click the submit button
        // or for onend to be called naturally
      };

      recognitionInstance.onerror = (event) => {
        // Don't treat "no-speech" as an error, just keep listening
        if (event.error === 'no-speech') {
          console.log("[DEBUG] No speech detected yet, continuing to listen");
          return;
        }
        
        Logger.error('Voice recognition error:', event.error);
        setError(`Error: ${event.error}`);
        setIsListening(false);
      };

      recognitionInstance.onend = () => {
        console.log("[DEBUG] Recognition ended naturally");
        
        // Submit transcript if we have one and we didn't manually stop
        if (transcriptRef.current && 
            transcriptRef.current !== 'Listening...' && 
            !isSubmitting && 
            isListeningRef.current) {
          submitTranscript(transcriptRef.current);
        }
        
        setIsListening(false);
        Logger.info('Voice recognition ended');
      };

      setRecognition(recognitionInstance);
      recognitionInstance.start();
    } catch (error) {
      Logger.error('Failed to initialize voice recognition:', error);
      setError(error.message);
    }
  }, [submitTranscript, isSubmitting]);

  const stopListening = useCallback(() => {
    if (recognition) {
      recognition.stop();
      Logger.info('Voice recognition manually stopped');
      setIsListening(false);
      
      // Submit any existing transcript if there is one
      if (transcript && transcript !== 'Listening...' && !isSubmitting) {
        submitTranscript(transcript);
      }
    }
  }, [recognition, transcript, isSubmitting, submitTranscript]);
  
  // Manual submit button handler
  const handleManualSubmit = useCallback(() => {
    if (transcript && transcript !== 'Listening...' && !isSubmitting) {
      // Stop listening first if needed
      if (isListening && recognition) {
        recognition.stop();
        setIsListening(false);
      }
      
      submitTranscript(transcript);
    }
  }, [transcript, isSubmitting, isListening, recognition, submitTranscript]);

  useEffect(() => {
    return () => {
      if (recognition) {
        recognition.stop();
        Logger.info('Voice recognition cleanup on unmount');
      }
    };
  }, [recognition]);

  return (
    <div className="flex flex-col items-end gap-2">
      {/* Status display with typewriter effect for transcript */}
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
              Speak clearly, then click Stop when finished
            </div>
          )}
          
          {/* Processing indicator */}
          {isSubmitting && (
            <div className="mt-2 w-full bg-gray-700 rounded-full h-1">
              <div className="bg-indigo-500 h-1 rounded-full animate-progress"></div>
            </div>
          )}
          
          {/* Manual submit button - only show when we have a transcript and are not processing */}
          {transcript && 
           transcript !== 'Listening...' && 
           !isSubmitting && 
           !isListening && (
            <div className="mt-2 flex justify-end">
              <button
                onClick={handleManualSubmit}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1"
              >
                <Send className="w-3 h-3" />
                Submit
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Error display */}
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
      
      {/* Voice input button */}
      <button
        onClick={isListening ? stopListening : startListening}
        disabled={disabled || isSubmitting}
        className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg transition-all relative ${
          isListening 
            ? 'bg-red-600 hover:bg-red-700 scale-110' 
            : 'bg-purple-600 hover:bg-purple-700'
        } ${disabled || isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={isListening ? 'Stop listening and process speech' : 'Start voice input'}
        aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
      >
        {isListening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
        
        {/* Listening animation */}
        {isListening && (
          <>
            <div className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping" />
            <div className="absolute -inset-2 rounded-full border-2 border-red-300/50 animate-ping" style={{animationDuration: '2s'}} />
          </>
        )}
        
        {/* Helper label */}
        <div className="absolute -bottom-7 text-xs font-medium text-white bg-black/50 rounded-full px-2 py-0.5 whitespace-nowrap">
          {isListening ? 'Stop' : 'Speak'}
        </div>
      </button>
    </div>
  );
};

export default VoiceInput;