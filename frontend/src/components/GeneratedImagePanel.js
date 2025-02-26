import React from 'react';
import { Image, AlertTriangle, Loader, Clock } from 'lucide-react';

const GeneratedImagePanel = ({ 
  image, 
  isLoading = false,
  error = null,
  title = "Generated Image",
  description = null,
  progressStatus = null 
}) => {
  // Extract progress percentage from status message if available
  const extractProgress = () => {
    if (!progressStatus) return null;
    
    const match = progressStatus.match(/(\d+)%/);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
    return null;
  };
  
  const progress = extractProgress();
  const [waitTime, setWaitTime] = React.useState(0);
  
  // Update wait time counter when in loading state
  React.useEffect(() => {
    let interval;
    if (isLoading) {
      const startTime = Date.now();
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setWaitTime(elapsed);
      }, 1000);
    } else {
      setWaitTime(0);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading]);
  
  // Format wait time as mm:ss
  const formatWaitTime = () => {
    const minutes = Math.floor(waitTime / 60);
    const seconds = waitTime % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        
        {isLoading && (
          <div className="flex items-center gap-2 text-xs bg-indigo-900/40 rounded-full px-3 py-1">
            <Clock className="w-3 h-3 text-indigo-300" />
            <span className="text-indigo-200">{formatWaitTime()}</span>
          </div>
        )}
      </div>
      
      {isLoading ? (
        <div className="aspect-square bg-gradient-to-br from-purple-500/20 to-indigo-600/20 rounded-xl flex flex-col items-center justify-center p-4">
          <div className="bg-indigo-700/30 rounded-full p-3 mb-3">
            <Loader className="w-6 h-6 text-indigo-300 animate-spin" />
          </div>
          
          {progress ? (
            <div className="w-3/4 mb-3">
              <div className="h-2 bg-indigo-900/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-300" 
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-indigo-200 text-xs mt-1 text-center">
                {progress}%
              </p>
            </div>
          ) : null}
          
          <p className="text-indigo-200 text-sm text-center">
            {progressStatus || "Generating image..."}
          </p>
          
          {waitTime > 60 && (
            <div className="mt-4 bg-indigo-900/20 rounded-lg p-2 max-w-xs">
              <p className="text-indigo-200 text-xs text-center">
                Image generation may take several minutes. Please be patient.
              </p>
            </div>
          )}
        </div>
      ) : error ? (
        <div className="aspect-square bg-red-900/20 rounded-xl flex flex-col items-center justify-center p-4">
          <div className="bg-red-900/30 rounded-full p-3 mb-3">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <p className="text-red-200 text-sm text-center">
            {error}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : !image ? (
        <div className="aspect-square bg-gradient-to-br from-purple-500/20 to-indigo-600/20 rounded-xl flex flex-col items-center justify-center p-4">
          <div className="bg-indigo-700/30 rounded-full p-3 mb-3">
            <Image className="w-6 h-6 text-indigo-300" />
          </div>
          <p className="text-indigo-200 text-sm text-center">
            No image generated yet.
            <br />
            <span className="text-xs">
              Ask me to visualize or create an image of the drone or components.
            </span>
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-black/20 rounded-xl overflow-hidden">
            <img 
              src={image} 
              alt="Generated visualization"
              className="w-full h-auto object-cover"
            />
          </div>
          {description && (
            <p className="text-indigo-200 text-sm">
              {description}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default GeneratedImagePanel;