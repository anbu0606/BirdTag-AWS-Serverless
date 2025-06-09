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

region = os.environ.get("AWS_REGION", "ap-southeast-2")
dynamodb = boto3.resource('dynamodb', region_name=region)
table = dynamodb.Table('birds_table')
s3 = boto3.client('s3', region_name=region)

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
    file_name = event.get('fileName')
    file_type = event.get('type')
    s3_url = event.get('originalUrl')
    s3_thumbnail_url = event.get('thumbnailUrl', None)

    # Parse bucket and key from URL
    parsed = urlparse(s3_url)
    bucket = parsed.netloc.split('.')[0]
    key = parsed.path.lstrip('/')

    # Download media file from S3
    with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
        tmp_path = tmp_file.name
        s3.download_file(bucket, key, tmp_path)

    # === Download model file from the different bucket ===
    model_bucket = "g116-models-s3"
    model_key = "model/image_video_model.pt"
    model_path = "/tmp/image_video_model.pt"

    try:
        s3.download_file(model_bucket, model_key, model_path)
        print(f"Downloaded model from s3://{model_bucket}/{model_key}")
    except Exception as e:
        print(f"Failed to download model from S3: {repr(e)}")  # Add repr() to print the full exception
        return {"message": "Failed to load model from external S3 bucket."}

    # Run detection
    if file_type == 'image':
        result = image_prediction(tmp_path, model_path=model_path)
    elif file_type == 'video':
        result = video_prediction(tmp_path, model_path=model_path)
    else:
        print("Unsupported file type for bird detection.")
        return {"message": "Unsupported file type"}

    # Prepare item to save in DynamoDB
    item = {
        'id': item_id,
        'file_type': file_type,
        'file_name': file_name,
        's3_url': s3_url,
        'tags': result["tags"],
        'counts': result["counts"],
        'timestamp': datetime.utcnow().isoformat()
    }

    if s3_thumbnail_url:
        item["s3_thumbnail_url"] = s3_thumbnail_url

    # Save to DynamoDB
    table.put_item(Item=item)
    print("Saved item to DynamoDB:", item)

    return item


