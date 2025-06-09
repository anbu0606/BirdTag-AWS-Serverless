import os
import numpy as np
import boto3
import soundfile as sf
import tempfile
import random
from datetime import datetime
from scipy.signal import resample 
from tensorflow import lite as tflite
from urllib.parse import urlparse

region = os.environ.get("AWS_REGION", "ap-southeast-2")
dynamodb = boto3.resource('dynamodb', region_name=region)
table = dynamodb.Table('birds_table')
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
    # === Download model and label file from different S3 bucket ===
    try:
        s3.download_file(model_bucket, model_key, model_path)
        print(f"Downloaded model from s3://{model_bucket}/{model_key}")
        s3.download_file(model_bucket, label_key, label_path)
        print(f"Downloaded labels from s3://{model_bucket}/{label_key}")
    except Exception as e:
        print(f"Failed to download model or label file from S3: {e}")
        return {"message": "Failed to load model from external S3 bucket."}

    # Load model and labels
    interpreter = load_model(model_path)
    labels = load_labels(label_path)

    item_id = random.randint(0, 9999999)
    file_name = event.get('fileName')
    file_type = event.get('type')
    s3_url = event.get('originalUrl')

    # Parse bucket/key from audio URL
    parsed = urlparse(s3_url)
    bucket = parsed.netloc.split('.')[0]
    key = parsed.path.lstrip('/')

    with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
        tmp_path = tmp_file.name
        s3.download_file(bucket, key, tmp_path)

        try:
            species, confidence = predict_species(interpreter, labels, tmp_path)
        except ValueError as e:
            return {"error": str(e)}

    # Extract common name from label
    parts = species.split('_')
    common_name = parts[1].split()[-1].lower() if len(parts) > 1 else species.lower()

    item = {
        'id': item_id,
        'file_type': file_type,
        'file_name': file_name,
        's3_url': s3_url,
        'tags': [common_name],
        'counts': [1],
        'timestamp': datetime.utcnow().isoformat()
    }

    table.put_item(Item=item)
    print("Saved item to DynamoDB:", item)

    return item
