#!/bin/bash

# Script to start the stable diffusion image generation service
# Make this script executable with: chmod +x start_service.sh

echo "Starting Janus Image Generation service..."

# Change to the service directory
cd "$(dirname "$0")"

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Python 3 is not installed. Please install Python 3 to run this service."
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Always ensure dependencies are installed
echo "Installing/updating dependencies..."
pip install -U pip
pip install flask flask-cors torch pillow transformers numpy

# Start the service
echo "Launching server on port 9999..."
python3 server.py

# Print message when the service stops
echo "Janus Image Generation service has stopped."