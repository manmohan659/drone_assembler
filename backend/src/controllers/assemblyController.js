const { supabase } = require('../supabaseClient');
const axios = require('axios');
const Logger = require('../utils/logger');

const startAssembly = async (req, res) => {
  const { userId } = req.body;
  const { error } = await supabase
    .from('assembly_progress')
    .insert({ user_id: userId, current_step: 1 });
  if (error) return res.status(500).json({ error });
  res.status(200).json({ message: 'Assembly started' });
};

const getProgress = async (req, res) => {
  const { userId } = req.query;
  const { data, error } = await supabase
    .from('assembly_progress')
    .select('current_step')
    .eq('user_id', userId)
    .single();
  if (error) return res.status(500).json({ error });
  res.status(200).json(data);
};

const identifyComponents = async (req, res) => {
  const { image } = req.body; // Base64 encoded image
  const response = await axios.post('http://vision:5002/identify', { image });
  res.status(200).json(response.data);
};

const generateVisualization = async (req, res) => {
  try {
    const { prompt, userId, projectId } = req.body;
    
    Logger.info('Generating visualization', { userId, projectId, prompt });

    try {
      // Attempt to call the stable diffusion service
      const response = await axios.post('http://localhost:9999/generate', { 
        prompt,
        userId,
        projectId
      }, {
        timeout: 120000, // 2 minute timeout
        responseType: 'arraybuffer' // Important: we're expecting a binary image
      });
      
      Logger.info('Stable diffusion service responded successfully');
      
      // Return the image directly
      res.set('Content-Type', 'image/jpeg');
      return res.send(response.data);
      
    } catch (serviceError) {
      Logger.error('Failed to call stable diffusion service:', serviceError);
      
      // If service call failed, return a placeholder
      res.json({
        success: false,
        error: 'Image generation service unavailable',
        image: '/api/placeholder/800/600',
        description: prompt
      });
    }

  } catch (error) {
    Logger.error('Error generating visualization:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate visualization: ' + error.message
    });
  }
};

module.exports = { startAssembly, getProgress, identifyComponents, generateVisualization };