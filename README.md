# Drone Assembler Agent🚁

An interactive web application for real-time drone assembly assistance using advanced AI technologies.

## 🔍 Overview

Drone Assembler helps users build drones by providing real-time component identification, step-by-step assembly instructions, and visual validation. The application leverages Google's Gemini AI for component recognition and the Janus-1.3B model for generating visual drone representations.

## ✨ Key Features

- **Real-time Component Identification**: Identifies drone parts using your device camera
- **Step-by-step Assembly Instructions**: Guided assembly process with visual references
- **Assembly Validation**: Real-time validation to ensure correct component placement
- **Voice Control**: Hands-free operation with voice command support
- **Project Management**: Save and manage multiple drone assembly projects
- **Drone Visualization**: Generate realistic drone images using the Janus-1.3B model

## 🧠 AI Models

### Gemini 2.0 Flash
Used for real-time component recognition, assembly validation, and instruction generation.

### Janus-1.3B
A specialized image generation model that creates realistic drone visualizations based on component selection and assembly configuration. The Janus model enables:

- Photorealistic drone renders
- Multiple angles and perspectives
- Component-accurate visualizations
- Custom color schemes and designs

## 🛠️ Technology Stack

### Frontend
- React.js
- TailwindCSS
- Supabase Client

### Backend
- Node.js with Express
- Google Generative AI (Gemini)
- Winston logger
- Supabase integration

### Image Generation Service
- Python with Flask
- Janus-1.3B model
- PyTorch & Transformers

## 🏗️ Architecture

The application consists of three main components:

1. **Frontend Application**: React-based UI with camera integration and real-time feedback
2. **Backend API Server**: Express server handling AI processing and database operations
3. **Image Generation Service**: Python service for Janus model integration

## 🚀 Getting Started

### Prerequisites
- Node.js (v16+)
- Python 3.9+
- Supabase account
- Google Gemini API key

### Installation

1. **Clone the repository**
   ```
   git clone https://github.com/yourusername/drone_assembler.git
   cd drone_assembler
   ```

2. **Set up the backend**
   ```
   cd backend
   npm install
   ```
   
   Create a `.env` file with:
   ```
   PORT=5003
   GEMINI_API_KEY=your_gemini_api_key
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_key
   ```

3. **Set up the frontend**
   ```
   cd ../frontend
   npm install
   ```
   
   Create a `.env` file with:
   ```
   REACT_APP_SUPABASE_URL=your_supabase_url
   REACT_APP_SUPABASE_ANON_KEY=your_supabase_key
   REACT_APP_API_URL=http://localhost:5003
   ```

4. **Set up the image generation service**
   ```
   cd ../services
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

### Running the Application

1. **Start the backend**
   ```
   cd backend
   npm start
   ```

2. **Start the frontend**
   ```
   cd frontend
   npm start
   ```

3. **Start the image generation service**
   ```
   cd services
   ./start_service.sh  # On Windows: start_service.bat
   ```

## 📝 API Endpoints

### Backend API (Express server on port 5003)
- `/api/assembly/gemini/validate` - Validate assembly progress
- `/api/assembly/gemini/instructions` - Get assembly instructions
- `/api/assembly/gemini/identify-parts` - Identify components
- `/api/assembly/project` - Project management
- `/api/assembly/visualize` - Generate visualizations

### Image Generation API (Flask server on port 9999)
- `/generate` - Generate drone images
- `/progress/:taskId` - Check generation progress
- `/result/:taskId` - Retrieve generated images

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgements

- [Google Gemini](https://ai.google.dev/)
- [Janus Model](https://github.com/deepseek-ai/Janus-1)
- [Supabase](https://supabase.io/)
- [React](https://reactjs.org/)
