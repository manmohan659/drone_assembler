#!/usr/bin/env python3
"""
Test script for the Janus image generation service.
This script sends a test request to the service and saves the response.

Usage:
  python test_service.py "A detailed technical drawing of a drone with propellers"
"""

import sys
import requests
import json
import time
import os
from datetime import datetime

# Get the prompt from command line or use default
if len(sys.argv) > 1:
    prompt = sys.argv[1]
else:
    prompt = "A detailed technical drawing of a drone with propellers and a camera"

print(f"Testing image generation with prompt: '{prompt}'")

# Create test output directory
os.makedirs("test_output", exist_ok=True)

# First check if the service is running
try:
    health_response = requests.get("http://localhost:9999/", timeout=5)
    if health_response.status_code == 200:
        print("Service is running ✅")
    else:
        print(f"Service appears to be running but returned status code: {health_response.status_code}")
except requests.exceptions.ConnectionError:
    print("❌ Service is not running. Please start it with ./start_service.sh")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error checking service: {e}")
    sys.exit(1)

# Send the generation request
try:
    print("Sending image generation request...")
    start_time = time.time()
    
    response = requests.post(
        "http://localhost:9999/generate",
        json={"prompt": prompt, "userId": "test-user", "projectId": "test-project"},
        timeout=300  # 5 minute timeout
    )
    
    elapsed = time.time() - start_time
    
    if response.status_code == 200:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = f"test_output/generated_image_{timestamp}.jpg"
        
        with open(output_path, "wb") as f:
            f.write(response.content)
        
        print(f"✅ Image generated successfully in {elapsed:.1f} seconds!")
        print(f"Saved to: {os.path.abspath(output_path)}")
    else:
        print(f"❌ Error: Server returned status code {response.status_code}")
        try:
            error_data = response.json()
            print(f"Error message: {error_data.get('error', 'Unknown error')}")
        except:
            print(f"Error response: {response.text[:500]}")
            
except requests.exceptions.Timeout:
    print("❌ Request timed out after 5 minutes. The server might be still processing.")
    print("Check the server logs for progress.")
except Exception as e:
    print(f"❌ Error: {e}")