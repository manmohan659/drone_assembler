// frontend/src/components/VisualizationPanel.js
import React from 'react';
import { Cpu, Battery, Tablet, PlusCircle, Cog, Info } from 'lucide-react';

const VisualizationPanel = ({ components = [] }) => {

  const safeComponents = Array.isArray(components) ? components : [];

  React.useEffect(() => {
    console.log("[DEBUG] VisualizationPanel components:", safeComponents);
  }, [safeComponents]);

  // Get component icon based on name
  const getComponentIcon = (name) => {
    const lcName = name ? name.toLowerCase() : '';
    
    if (lcName.includes('battery') || lcName.includes('power')) {
      return <Battery className="w-5 h-5" />;
    } else if (lcName.includes('controller') || lcName.includes('board') || lcName.includes('pi') || lcName.includes('arduino')) {
      return <Tablet className="w-5 h-5" />;
    } else if (lcName.includes('motor') || lcName.includes('propeller') || lcName.includes('gear')) {
      return <Cog className="w-5 h-5" />;
    } else {
      return <Cpu className="w-5 h-5" />;
    }
  };

  return (
    <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
      <h2 className="text-lg font-semibold text-white mb-4">Identified Components</h2>
      
      {components && components.length > 0 ? (
        <div className="space-y-3">
          {console.log("[DEBUG] Rendering components:", components)}
          {components.map((component, index) => {
            // Handle both string components and object components
            const name = typeof component === 'string' ? component : component.name || 'Unknown Component';
            const purpose = typeof component === 'object' && component.purpose ? component.purpose : null;
            console.log("[DEBUG] Rendering component:", name);

            return (
              <div key={index} className="bg-black/20 rounded-xl p-3">
                <div className="flex items-start gap-3">
                  {getComponentIcon(name)}
                  <div>
                    <h3 className="text-white font-medium">{name}</h3>
                    {purpose && (
                      <p className="text-indigo-200 text-xs mt-1">{purpose}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="aspect-square bg-gradient-to-br from-purple-500/20 to-indigo-600/20 rounded-xl flex flex-col items-center justify-center p-4 text-center">
          {console.log("[DEBUG] No components to render")}
          <div className="bg-indigo-700/30 rounded-full p-3 mb-3">
            <PlusCircle className="w-6 h-6 text-indigo-300" />
          </div>
          <p className="text-indigo-200 text-sm">
            No components identified yet. 
            <br />Show your drone parts to the camera.
          </p>
        </div>
      )}
      
      {components && components.length > 0 && (
        <div className="mt-4 flex items-start gap-2 bg-indigo-900/20 rounded-lg p-3">
          <Info className="w-4 h-4 text-indigo-400 mt-0.5" />
          <p className="text-indigo-200 text-xs">
            Components are automatically identified during assembly. Ask questions about any component for more details.
          </p>
        </div>
      )}
    </div>
  );
};

export default VisualizationPanel;