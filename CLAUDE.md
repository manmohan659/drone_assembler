# Drone Assembler Development Guide

## Commands
- **Frontend**:
  - Start: `cd frontend && npm start`
  - Build: `cd frontend && npm run build`
- **Backend**:
  - Start: `cd backend && npm start`
- **Image Service**:
  - Run: `cd services && ./start_service.sh`

## Code Style
- **Naming**:
  - camelCase for variables/functions
  - PascalCase for React components
  - snake_case for database fields
- **Imports**:
  - Backend: CommonJS (`require()`)
  - Frontend: ES6 imports
- **Error Handling**:
  - Use Winston logger with appropriate levels
  - Always wrap async operations in try/catch
  - Return structured error responses

## Structure
- Services should be in separate files from controllers
- React components should be focused on UI, with business logic in hooks
- Use API abstraction layers to isolate backend calls

## Technologies
- React 18 (frontend)
- Express.js (backend)
- Flask (image service)
- Supabase (database)
- Gemini AI & Janus model