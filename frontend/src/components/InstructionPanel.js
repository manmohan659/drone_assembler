// frontend/src/components/InstructionPanel.js
import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, Activity, ArrowRight } from 'lucide-react';

const InstructionPanel = ({ analysis, currentStep, project }) => {
  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-6 h-6 text-red-500" />;
      default:
        return null;
    }
  };

  // Format the project info
  const formatProjectInfo = () => {
    if (!project) return null;
    
    return (
      <div className="bg-indigo-900/20 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-5 h-5 text-indigo-400" />
          <h3 className="text-indigo-300 font-medium">Project Status</h3>
        </div>
        
        <div className="space-y-2 text-sm">
          {project.drone_type && (
            <div className="flex justify-between">
              <span className="text-indigo-200">Drone Type:</span>
              <span className="text-white">{project.drone_type}</span>
            </div>
          )}
          
          <div className="flex justify-between">
            <span className="text-indigo-200">Current Step:</span>
            <span className="text-white">{currentStep}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-indigo-200">Components:</span>
            <span className="text-white">
              {project.components?.length || 0} identified
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-indigo-200">Steps Completed:</span>
            <span className="text-white">
              {project.completed_steps?.length || 0}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
      <h2 className="text-lg font-semibold text-white mb-4">Assembly Guide</h2>
      
      {formatProjectInfo()}
      
      {analysis ? (
        <div className="space-y-4">
          <div className="bg-black/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              {getStatusIcon(analysis.status)}
              <div>
                <h3 className="text-white font-medium mb-2">Current Step {currentStep}</h3>
                <p className="text-indigo-200 text-sm">{analysis.feedback}</p>
              </div>
            </div>
          </div>

          {analysis.warnings && analysis.warnings.length > 0 && (
            <div className="bg-yellow-900/20 rounded-xl p-4">
              <h4 className="text-yellow-400 font-medium mb-2">Attention Needed</h4>
              <ul className="list-disc list-inside text-yellow-200 text-sm space-y-1">
                {analysis.warnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {analysis.nextSteps && (
            <div className="bg-indigo-900/20 rounded-xl p-4">
              <h4 className="text-indigo-400 font-medium mb-2">Next Steps</h4>
              <ul className="text-indigo-200 text-sm space-y-2">
                {analysis.nextSteps.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="font-mono bg-indigo-400/20 px-2 py-0.5 rounded text-xs">
                      {idx + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {analysis.canProceed && (
            <div className="bg-green-900/20 rounded-xl p-3 text-center">
              <p className="text-green-300 flex items-center justify-center gap-2">
                Ready to move to next step
                <ArrowRight className="w-4 h-4" />
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-indigo-200">
          {project ? 'Analyze your assembly to receive real-time guidance' : 'Start assembly to receive real-time guidance'}
        </div>
      )}
    </div>
  );
};

export default InstructionPanel;