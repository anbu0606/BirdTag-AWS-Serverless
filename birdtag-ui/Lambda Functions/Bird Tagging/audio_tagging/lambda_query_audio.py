import os
import numpy as np
import boto3
import soundfile as sf
import tempfile
import random
import json
from datetime import datetime
from scipy.signal import resample 
from tensorflow import lite as tflite
from urllib.parse import urlparse
import base64

region = os.environ.get("AWS_REGION", "ap-southeast-2")
lambda_client = boto3.client('lambda')
s3 = boto3.client('s3', region_name=region)

# === Define model and label location in another bucket ===
model_bucket = "g116-models-s3"
model_key = "model/BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite"
label_key = "model/BirdNET_GLOBAL_6K_V2.4_Labels_Birds_Only.txt"
model_path = "/tmp/model.tflite"
label_path = "/tmp/labels.txt"

def load_labels(label_path):
    with open(label_path, 'r') as f:
        return [line.strip() for line in f.readlines()]

def load_model(model_path):
    interpreter = tflite.Interpreter(model_path=model_path)
    interpreter.allocate_tensors()
    return interpreter

def preprocess_audio(audio_path, target_sr=48000, duration_sec=3):
    audio, sr = sf.read(audio_path)
    if len(audio.shape) > 1:
        audio = np.mean(audio, axis=1)
    if sr != target_sr:
        num_samples = int(len(audio) * target_sr / sr)
        audio = resample(audio, num_samples)
    audio = audio.astype(np.float32)
    required_len = target_sr * duration_sec
    if len(audio) < required_len:
        audio = np.pad(audio, (0, required_len - len(audio)))
    else:
        audio = audio[:required_len]
    return np.expand_dims(audio, axis=0)

def predict_species(interpreter, labels, audio_path):
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    audio = preprocess_audio(audio_path)
    interpreter.set_tensor(input_details[0]['index'], audio)
    interpreter.invoke()
    prediction = interpreter.get_tensor(output_details[0]['index'])[0]
    top_idx = np.argmax(prediction)
    species = labels[top_idx]
    confidence = float(prediction[top_idx])
    return species, confidence



def lambda_handler(event, context=None):
    # If the entire event is passed as string or bytes, decode it
    if isinstance(event, (bytes, str)):
        event = json.loads(event if isinstance(event, str) else event.decode("utf-8"))

    # Extract audio payload from previous Lambda
    file_name = event.get('file_name')
    file_type = event.get('file_type')
    file_content_b64 = event.get('file_content')

    if not all([file_name, file_type, file_content_b64]):
        return {"message": "Missing required parameters: file_name, file_type, file_content"}

    if file_type != 'audio':
        return {"message": "Unsupported file type. Only 'audio' is supported."}

    # Decode and save the base64 audio
    try:
        audio_bytes = base64.b64decode(file_content_b64)
        _, ext = os.path.splitext(file_name)
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp_file:
            tmp_path = tmp_file.name
            tmp_file.write(audio_bytes)
    except Exception as e:
        return {"message": f"Failed to decode and write audio file: {repr(e)}"}


    # Download model and label file from S3 only if not already present
    try:
        if not os.path.exists(model_path):
            s3.download_file(model_bucket, model_key, model_path)
            print(f"Downloaded model to {model_path}")
        else:
            print(f"Model already exists at {model_path}, skipping download.")

        if not os.path.exists(label_path):
            s3.download_file(model_bucket, label_key, label_path)
            print(f"Downloaded labels to {label_path}")
        else:
            print(f"Labels already exist at {label_path}, skipping download.")

    except Exception as e:
        return {"message": f"Failed to download model or labels: {repr(e)}"}


    # Load model and labels
    try:
        interpreter = load_model(model_path)
        labels = load_labels(label_path)
    except Exception as e:
        return {"message": f"Model or label loading failed: {repr(e)}"}

    # Predict species
    try:
        species, confidence = predict_species(interpreter, labels, tmp_path)
    except ValueError as e:
        return {"error": str(e)}

    parts = species.split('_')
    common_name = parts[1].split()[-1].lower() if len(parts) > 1 else species.lower()

    item = {
        'tags': [common_name],
        'counts': [1]
    }
    
    
    # Invoke return_file_query_handler Lambda
    try:
        response = lambda_client.invoke(
            FunctionName='return_file_query_handler',
            InvocationType='RequestResponse',
            Payload=json.dumps(item).encode('utf-8')
        )
        print("reach here")
        response_payload = response['Payload'].read().decode('utf-8')
        print("Invoked return_file_query_handler:", response_payload)
        return json.loads(response_payload)

    except Exception as e:
        print(f"Failed to invoke return_file_query_handler: {repr(e)}")
        return {"message": "Failed to invoke downstream Lambda."}

    finally:
        # Cleanup temp file
        if os.path.exists(tmp_path):
            os.remove(tmp_path)