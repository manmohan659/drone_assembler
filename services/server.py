import os
import time
import PIL.Image
import torch
import numpy as np
import uuid
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from transformers import AutoModelForCausalLM, AutoConfig
from janus.models import MultiModalityCausalLM, VLChatProcessor

# Dictionary to store generation progress
generation_tasks = {}

# Lock for thread safety when accessing the tasks dictionary
import threading
tasks_lock = threading.Lock()

# Create needed directories
os.makedirs('generated_samples', exist_ok=True)

# Set up Flask app and enable CORS
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Configure static file serving for generated images
app.config['GENERATED_FOLDER'] = os.path.join(os.getcwd(), 'generated_samples')

# Global variables to hold model and processor
vl_gpt = None
vl_chat_processor = None

def load_model():
    """
    Load and initialize the Janus model and processor.
    This is done lazily on first request to save memory when not in use.
    """
    global vl_gpt, vl_chat_processor
    
    if vl_gpt is not None and vl_chat_processor is not None:
        return  # Already loaded
    
    model_path = "deepseek-ai/Janus-1.3B"
    device = torch.device("cpu")
    dtype = torch.float32
    
    print("Loading processor...")
    vl_chat_processor = VLChatProcessor.from_pretrained(
        model_path,
        use_fast=True  # Use fast tokenizer
    )
    print("Processor loaded successfully")
    
    print("Loading model configuration...")
    config = AutoConfig.from_pretrained(model_path, trust_remote_code=True)
    if hasattr(config, 'use_flash_attn'):
        config.use_flash_attn = False
    if hasattr(config, 'language_config') and hasattr(config.language_config, '_attn_implementation'):
        config.language_config._attn_implementation = "eager"
    print("Configuration loaded and modified for CPU")
    
    print(f"Loading model to {device} with {dtype}...")
    vl_gpt = AutoModelForCausalLM.from_pretrained(
        model_path,
        trust_remote_code=True,
        config=config,
        torch_dtype=dtype,
        low_cpu_mem_usage=True
    )
    vl_gpt = vl_gpt.to(device).eval()
    print("Model loaded successfully")


# Generation function that wraps the image creation process
def generate_picture(user_prompt: str, task_id=None):
    """
    Generate an image based on the user prompt using the Janus model.
    Returns the path to the generated image.
    
    If task_id is provided, progress is tracked and can be queried.
    """
    global generation_tasks, vl_gpt, vl_chat_processor
    
    # Get a reference to the device and processor first to avoid race conditions
    # This is critical for thread safety
    try:
        # Ensure model is loaded BEFORE we do anything else
        if vl_gpt is None or vl_chat_processor is None:
            print("Model not loaded yet, loading now...")
            load_model()
            if vl_gpt is None or vl_chat_processor is None:
                raise Exception("Failed to load model")
        
        # Make thread-local references to the model
        current_model = vl_gpt
        current_processor = vl_chat_processor
        
        # Add some info about which request we're processing
        print(f"Processing generation request for: '{user_prompt[:50]}...' (task_id: {task_id})")
    except Exception as e:
        print(f"Error preparing model: {e}")
        raise
    
    # Update task status if task_id provided
    if task_id:
        with tasks_lock:
            # We expect the task entry to already exist, but update it here to be safe
            if task_id not in generation_tasks:
                generation_tasks[task_id] = {}
                
            generation_tasks[task_id].update({
                "status": "starting",
                "progress": 0,
                "message": "Starting image generation",
                "timestamp": time.time(),
                "prompt": user_prompt[:50] + "..." if len(user_prompt) > 50 else user_prompt
            })
    
    # Build the conversation with user-provided prompt content
    conversation = [
        {
            "role": "User",
            "content": user_prompt,
        },
        {"role": "Assistant", "content": ""},
    ]
    
    # Update task status
    if task_id:
        with tasks_lock:
            generation_tasks[task_id].update({
                "status": "preparing",
                "progress": 5,
                "message": "Preparing prompt",
                "timestamp": time.time()
            })
        
    sft_format = current_processor.apply_sft_template_for_multi_turn_prompts(
        conversations=conversation,
        sft_format=current_processor.sft_format,
        system_prompt="",
    )
    prompt = sft_format + current_processor.image_start_tag

    @torch.inference_mode()
    def generate_cpu(
            mmgpt: MultiModalityCausalLM,
            vl_chat_processor: VLChatProcessor,
            prompt: str,
            task_id=None,
            temperature: float = 1.0,
            parallel_size: int = 1,  # Reduced for CPU
            cfg_weight: float = 5.0,
            image_token_num_per_image: int = 576,
            img_size: int = 384,
            patch_size: int = 16,
    ):
        # Create a unique ID for this generation process to track in logs
        generation_id = f"gen-{task_id if task_id else 'sync'}-{int(time.time())}"
        print(f"[{generation_id}] Tokenizing input...")
        
        if task_id:
            with tasks_lock:
                generation_tasks[task_id].update({
                    "status": "tokenizing",
                    "progress": 10,
                    "message": "Tokenizing input",
                    "timestamp": time.time()
                })
            
        input_ids = vl_chat_processor.tokenizer.encode(prompt)
        input_ids = torch.LongTensor(input_ids).to(device)

        tokens = torch.zeros((2, len(input_ids)), dtype=torch.int).to(device)
        tokens[0, :] = input_ids  # Conditional
        tokens[1, :] = input_ids.clone()
        tokens[1, 1:-1] = vl_chat_processor.pad_id  # Unconditional

        print(f"[{generation_id}] Generating image tokens...")
        if task_id:
            with tasks_lock:
                generation_tasks[task_id].update({
                    "status": "generating",
                    "progress": 15,
                    "message": "Starting token generation",
                    "timestamp": time.time()
                })
            
        inputs_embeds = mmgpt.language_model.get_input_embeddings()(tokens)
        generated_tokens = torch.zeros((1, image_token_num_per_image), dtype=torch.int).to(device)

        outputs = None
        last_progress_update = 0
        
        for i in range(image_token_num_per_image):
            # Only update progress when the percentage has changed significantly
            # This reduces the number of log messages and potential for confusion
            current_percentage = int(100 * (i / image_token_num_per_image))
            
            if current_percentage > last_progress_update + 4:  # Update every 5% progress
                last_progress_update = current_percentage
                print(f"[{generation_id}] Generating token {i}/{image_token_num_per_image}... ({current_percentage}%)")
                
                if task_id:
                    # Scale progress from 15% to 85% based on token generation
                    progress = 15 + int(70 * (i / image_token_num_per_image))
                    with tasks_lock:
                        generation_tasks[task_id].update({
                            "status": "generating",
                            "progress": progress,
                            "message": f"Generating token {i}/{image_token_num_per_image}",
                            "timestamp": time.time()
                        })

            outputs = mmgpt.language_model.model(
                inputs_embeds=inputs_embeds,
                use_cache=True,
                past_key_values=outputs.past_key_values if i != 0 else None
            )
            hidden_states = outputs.last_hidden_state

            logits = mmgpt.gen_head(hidden_states[:, -1, :])
            logit_cond = logits[0:1, :]
            logit_uncond = logits[1:2, :]

            logits = logit_uncond + cfg_weight * (logit_cond - logit_uncond)
            probs = torch.softmax(logits / temperature, dim=-1)

            next_token = torch.multinomial(probs, num_samples=1)
            generated_tokens[:, i] = next_token.squeeze(dim=-1)

            next_token = torch.cat([next_token.unsqueeze(dim=1), next_token.unsqueeze(dim=1)], dim=1).view(-1)
            img_embeds = mmgpt.prepare_gen_img_embeds(next_token)
            inputs_embeds = img_embeds.unsqueeze(dim=1)

        print("Decoding image...")
        if task_id:
            with tasks_lock:
                generation_tasks[task_id].update({
                    "status": "decoding",
                    "progress": 85,
                    "message": "Decoding image",
                    "timestamp": time.time()
                })
            
        dec = mmgpt.gen_vision_model.decode_code(
            generated_tokens.to(dtype=torch.int),
            shape=[1, 8, img_size // patch_size, img_size // patch_size]
        )
        dec = dec.to(torch.float32).cpu().numpy().transpose(0, 2, 3, 1)
        dec = np.clip((dec + 1) / 2 * 255, 0, 255)
        visual_img = np.zeros((1, img_size, img_size, 3), dtype=np.uint8)
        visual_img[:, :, :] = dec

        # Generate a unique filename based on timestamp
        filename = f"generated_image_{int(time.time())}.jpg"
        save_path = os.path.join('generated_samples', filename)
        
        if task_id:
            with tasks_lock:
                generation_tasks[task_id].update({
                    "status": "saving",
                    "progress": 95,
                    "message": "Saving image",
                    "timestamp": time.time()
                })
            
        PIL.Image.fromarray(visual_img[0]).save(save_path)
        print(f"Image saved to {os.path.abspath(save_path)}")
        
        if task_id:
            with tasks_lock:
                generation_tasks[task_id].update({
                    "status": "completed",
                    "progress": 100,
                    "message": "Image generation complete",
                    "timestamp": time.time(),
                    "filename": filename,
                    "path": save_path
                })
            
        return save_path

    # Use local references to the model that are thread-safe
    device = next(current_model.parameters()).device
    
    # Add a lock to prevent multiple concurrent token generations
    # This is a critical section that can't be parallelized effectively on CPU
    with generation_lock:
        print(f"Starting image generation process for task {task_id if task_id else 'synchronous'}")
        image_path = generate_cpu(current_model, current_processor, prompt, task_id=task_id, parallel_size=1)
        print(f"Completed image generation for task {task_id if task_id else 'synchronous'}")
    
    return image_path
    
# Global lock for token generation process
# This ensures only one image is being generated at a time
generation_lock = threading.Lock()


# Add a root route for health checks
@app.route('/', methods=['GET'])
def health_check():
    return jsonify({"status": "Image generation service running"}), 200

# Add a route to serve generated images directly
@app.route('/generated_samples/<path:filename>')
def serve_generated_image(filename):
    file_path = os.path.join(app.config['GENERATED_FOLDER'], filename)
    if os.path.exists(file_path):
        return send_file(file_path, mimetype='image/jpeg')
    else:
        return jsonify({"error": "Image not found"}), 404

@app.route('/latest_image', methods=['GET'])
def get_latest_image():
    """Returns the most recently generated image"""
    try:
        # Get all jpg files in the generated folder
        files = [f for f in os.listdir(app.config['GENERATED_FOLDER']) 
                if f.endswith('.jpg') and f.startswith('generated_image_')]
        
        if not files:
            return jsonify({"error": "No images found"}), 404
            
        # Sort by timestamp (newest first)
        files.sort(reverse=True)
        latest_file = files[0]
        
        return send_file(
            os.path.join(app.config['GENERATED_FOLDER'], latest_file),
            mimetype='image/jpeg'
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Add endpoint to check progress of a generation task
@app.route('/progress/<task_id>', methods=['GET'])
def check_progress(task_id):
    with tasks_lock:
        if task_id not in generation_tasks:
            return jsonify({
                "error": "Task not found",
                "task_id": task_id
            }), 404
            
        # Make a copy of the task data to avoid race conditions
        task_data = dict(generation_tasks[task_id])
        
    return jsonify({
        "task_id": task_id,
        **task_data
    })

@app.route('/status/<task_id>', methods=['GET'])
def get_status_and_result(task_id):
    """
    Returns both progress info and the image if it's ready.
    This reduces the number of requests needed.
    """
    with tasks_lock:
        if task_id not in generation_tasks:
            return jsonify({
                "error": "Task not found",
                "task_id": task_id
            }), 404
            
        # Make a copy of the task data to avoid race conditions
        task_data = dict(generation_tasks[task_id])
    
    # Check if the task is completed and return the image
    if task_data.get("status") == "completed" and "path" in task_data:
        if os.path.exists(task_data["path"]):
            # In a normal implementation, we'd return both the image and status
            # But Flask can't return both data and a file easily, so we'll add
            # the status info to response headers

            response = send_file(task_data["path"], mimetype='image/jpeg')
            response.headers['X-Task-Status'] = 'completed'
            response.headers['X-Task-Progress'] = '100'
            return response
        else:
            return jsonify({
                "status": task_data.get("status"),
                "progress": task_data.get("progress", 0),
                "message": "Image file was not found on disk",
                "error": "File not found"
            })
    
    # For non-completed tasks, just return the status
    return jsonify({
        "task_id": task_id,
        "status": task_data.get("status"),
        "progress": task_data.get("progress", 0),
        "message": task_data.get("message"),
        "timestamp": task_data.get("timestamp")
    })

@app.route('/result/<task_id>', methods=['GET'])
def get_result(task_id):
    with tasks_lock:
        if task_id not in generation_tasks:
            return jsonify({"error": "Task not found"}), 404
            
        task_data = dict(generation_tasks[task_id])
    
    # Check task status
    if task_data.get("status") != "completed":
        return jsonify({"error": "Task not completed yet", "status": task_data.get("status", "unknown")}), 400
        
    # Check if path exists in task data
    if "path" not in task_data:
        return jsonify({"error": "Image path not found in task data"}), 500
        
    # Check if file exists
    if not os.path.exists(task_data["path"]):
        return jsonify({"error": "Image file does not exist on disk"}), 500
        
    return send_file(task_data["path"], mimetype='image/jpeg')

@app.route('/generate', methods=['POST', 'OPTIONS'])
def generate():
    if request.method == 'OPTIONS':
        # Handle preflight request
        response = app.make_default_options_response()
        return response
    
    # Check if we're already generating an image (for synchronous mode)
    if not generation_lock.acquire(blocking=False):
        print("⚠️ Generation already in progress, returning busy status")
        return jsonify({
            "error": "Image generation already in progress. Please try again after current generation completes.",
            "status": "busy"
        }), 429
    
    # Release the lock - we'll acquire it again in generate_picture if needed
    generation_lock.release()
    
    try:
        data = request.get_json()
        if not data or 'prompt' not in data:
            return jsonify({"error": "Missing 'prompt' in request data."}), 400

        user_prompt = data['prompt']
        request_id = request.headers.get('X-Request-ID', 'none')
        print(f"Received image generation request: '{user_prompt[:50]}...' (Request ID: {request_id})")
        
        # Log additional data if provided (but don't require it)
        if 'userId' in data:
            print(f"User ID: {data['userId']}")
        if 'projectId' in data:
            print(f"Project ID: {data['projectId']}")
        
        # Check if direct synchronous response is requested
        use_async = data.get('async', True)
        
        if use_async:
            # Create a task ID for tracking progress
            task_id = str(uuid.uuid4())
            
            # Create the task entry first to avoid race conditions
            with tasks_lock:
                generation_tasks[task_id] = {
                    "status": "pending",
                    "progress": 0,
                    "message": "Task created, waiting to start",
                    "timestamp": time.time(),
                    "prompt": user_prompt[:50] + "..." if len(user_prompt) > 50 else user_prompt,
                    "request_id": request_id
                }
            
            # Start generation in a separate thread - ONLY ONE thread per request
            thread = threading.Thread(
                target=generate_picture,
                args=(user_prompt, task_id),
                daemon=True
            )
            thread.start()
            
            # Return only one task ID
            return jsonify({
                "task_id": task_id,
                "status": "processing",
                "message": "Image generation started",
                "progress_url": f"/progress/{task_id}",
                "result_url": f"/result/{task_id}",
                "status_url": f"/status/{task_id}"
            })
        else:
            # Run synchronously (the way test_service.py uses it)
            # This is faster because it doesn't create multiple images
            if generation_lock.acquire(blocking=False):
                try:
                    print(f"Starting synchronous image generation for request: {request_id}")
                    image_path = generate_picture(user_prompt)
                    print(f"Completed synchronous image generation for request: {request_id}")
                    return send_file(image_path, mimetype='image/jpeg')
                finally:
                    generation_lock.release()
            else:
                print(f"⚠️ Could not acquire generation lock for synchronous request: {request_id}")
                return jsonify({
                    "error": "Image generation already in progress. Please try again after current generation completes.",
                    "status": "busy"
                }), 429
    except Exception as e:
        import traceback
        print(f"Error during generation: {e}")
        print(traceback.format_exc())
        return jsonify({
            "error": str(e),
            "request_id": request.headers.get('X-Request-ID', 'none')
        }), 500



def preload_model_in_background():
    """
    Preload the model in a background thread to make first image generation faster.
    This is especially helpful if the frontend makes a request before the model is loaded.
    """
    def _preload():
        print("Preloading model in background...")
        try:
            load_model()
            print("✅ Model preloaded successfully!")
        except Exception as e:
            print(f"❌ Error preloading model: {e}")
    
    import threading
    thread = threading.Thread(target=_preload, daemon=True)
    thread.start()
    return thread

if __name__ == '__main__':
    print("Janus Image Generation service starting on port 9999...")
    # Start preloading model as soon as the server starts
    preload_thread = preload_model_in_background()
    app.run(host='0.0.0.0', port=9999, debug=False, threaded=True)