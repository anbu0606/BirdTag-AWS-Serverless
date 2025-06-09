#!/usr/bin/env python
# coding: utf-8

import os
import tempfile
import boto3
from urllib.parse import urlparse
from ultralytics import YOLO
import supervision as sv
import cv2 as cv
import random
import json
from datetime import datetime
import base64

region = os.environ.get("AWS_REGION", "ap-southeast-2")
s3 = boto3.client('s3', region_name=region)
lambda_client = boto3.client('lambda')

model_bucket = "g116-models-s3"
model_key = "model/image_video_model.pt"
model_path = "/tmp/image_video_model.pt"

def image_prediction(image_path, confidence=0.5, model_path="./model.pt"):
    model = YOLO(model_path)
    img = cv.imread(image_path)
    if img is None:
        print("Couldn't load the image! Please check the image path.")
        return {"tags": [], "counts": []}

    result = model(img)[0]
    detections = sv.Detections.from_ultralytics(result)
    detections = detections[(detections.confidence > confidence)]

    species_count = {}
    if len(detections.class_id) > 0:
        species_names = detections.data['class_name']
        for species in species_names:
            species = species.lower()
            species_count[species] = species_count.get(species, 0) + 1

    tags = list(species_count.keys())
    counts = list(species_count.values())
    return {"tags": tags, "counts": counts}


def video_prediction(video_path, confidence=0.5, model_path="./model.pt"):
    try:
        video_info = sv.VideoInfo.from_video_path(video_path=video_path)
        fps = int(video_info.fps)

        model = YOLO(model_path)
        tracker = sv.ByteTrack(frame_rate=fps)

        cap = cv.VideoCapture(video_path)
        if not cap.isOpened():
            raise Exception("Error: couldn't open the video!")

        max_species_count = {}
        frame_idx = 0

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % fps == 0:
                result = model(frame)[0]
                detections = sv.Detections.from_ultralytics(result)
                detections = tracker.update_with_detections(detections=detections)
                detections = detections[(detections.confidence > confidence)]

                if len(detections.class_id) > 0:
                    species_names = detections.data['class_name']
                    current_count = {}
                    for species in species_names:
                        species = species.lower()
                        current_count[species] = current_count.get(species, 0) + 1
                    for species, count in current_count.items():
                        max_species_count[species] = max(max_species_count.get(species, 0), count)

            frame_idx += 1

        tags = list(max_species_count.keys())
        counts = list(max_species_count.values())
        return {"tags": tags, "counts": counts}

    except Exception as e:
        print(f"An error occurred: {e}")
        return {"tags": [], "counts": []}
    
    finally:
        cap.release()



def lambda_handler(event, context=None):
    item_id = random.randint(0, 9999999)
    file_name = event.get('file_name')  
    file_type = event.get('file_type')
    file_content_b64 = event.get('file_content')

    if not (file_name and file_type and file_content_b64):
        return {"message": "Missing required parameters: file_name, file_type, file_content"}

    # Decode base64 content and save to temp file
    try:
        decoded_bytes = base64.b64decode(file_content_b64)
    except Exception as e:
        return {"message": f"Failed to decode base64 content: {repr(e)}"}

    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file_name)[1]) as tmp_file:
        tmp_path = tmp_file.name
        tmp_file.write(decoded_bytes)


    # Download model and label file from S3 only if not already present
    try:
        if not os.path.exists(model_path):
            s3.download_file(model_bucket, model_key, model_path)
            print(f"Downloaded model to {model_path}")
        else:
            print(f"Model already exists at {model_path}, skipping download.")

    except Exception as e:
        return {"message": f"Failed to download model or labels: {repr(e)}"}

    # Run prediction
    if file_type == 'image':
        result = image_prediction(tmp_path, model_path=model_path)
    elif file_type == 'video':
        result = video_prediction(tmp_path, model_path=model_path)
    else:
        return {"message": "Unsupported file type"}
    
    item = {
        'tags': result["tags"],
        'counts': result["counts"]
    }
    
    # Invoke another Lambda function with the item as payload
    try:
        response = lambda_client.invoke(
            FunctionName='return_file_query_handler',
            InvocationType='RequestResponse',  
            Payload=json.dumps(item).encode('utf-8')
        )
        response_payload = response['Payload'].read().decode('utf-8')
        print("Invoked return_file_query_handler:", response_payload)
        return json.loads(response_payload)

    except Exception as e:
        print(f"Failed to invoke return_file_query_handler: {repr(e)}")
        return {"message": "Failed to invoke downstream lambda"}
        
    finally:
        # Cleanup temp file
        if os.path.exists(tmp_path):
            os.remove(tmp_path)