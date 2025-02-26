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
    
    // Generate a unique request ID for tracking
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    Logger.info(`[${requestId}] Generating visualization`, { userId, projectId, prompt });

    // Make the initial request to start generation with async:true
    const response = await axios.post('http://localhost:9999/generate', { 
      prompt,
      userId,
      projectId,
      async: true  // Use async mode to get a task ID
    }, {
      timeout: 30000, // 30 second timeout for initial request
      headers: {
        'X-Request-ID': requestId,
        'Content-Type': 'application/json'
      }
    });
    
    // Parse the response data
    const data = response.data;
    
    // Check if we got a task ID
    if (data && data.task_id) {
      // Return the task ID to the frontend
      return res.json({
        success: true,
        taskId: data.task_id,
        status: 'processing',
        message: 'Image generation started'
      });
    } else {
      throw new Error('No task ID returned from image service');
    }
  } catch (error) {
    Logger.error('Error generating visualization:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate visualization: ' + error.message
    });
  }
};
const checkImageProgress = async (req, res) => {
  try {
    const { taskId } = req.params;
    
    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: 'Missing task ID'
      });
    }
    
    // Forward the request to the Janus service
    const response = await axios.get(`http://localhost:9999/progress/${taskId}`, {
      timeout: 10000
    });
    
    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to check progress: ' + error.message
    });
  }
};

const getGeneratedImage = async (req, res) => {
  try {
    const { taskId } = req.params;
    
    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: 'Missing task ID'
      });
    }
    
    console.log(`Getting generated image for task: ${taskId}`);
    
    // Forward the request to the Janus service
    const response = await axios.get(`http://localhost:9999/result/${taskId}`, {
      responseType: 'arraybuffer',
      timeout: 30000 // Longer timeout for image retrieval
    });
    
    // Check if we got an image response
    if (response.headers['content-type'] && response.headers['content-type'].includes('image/')) {
      console.log(`Successful image retrieval: ${response.headers['content-type']}, length: ${response.data.length}`);
      
      // Return the image directly
      res.set('Content-Type', response.headers['content-type']);
      return res.send(response.data);
    } else {
      // Try to parse the response as text/JSON if it's not an image
      let errorText = '';
      try {
        errorText = Buffer.from(response.data).toString('utf8');
      } catch (e) {
        errorText = 'Could not parse response';
      }
      
      console.error(`Invalid response from image service: ${errorText}`);
      throw new Error('Invalid response from image service: ' + errorText);
    }
  } catch (error) {
    console.error(`Error in getGeneratedImage: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get generated image: ' + error.message
    });
  }
};

module.exports = { 
  startAssembly, 
  getProgress, 
  identifyComponents, 
  generateVisualization,
  checkImageProgress,   // Add this line
  getGeneratedImage     // Add this line
};