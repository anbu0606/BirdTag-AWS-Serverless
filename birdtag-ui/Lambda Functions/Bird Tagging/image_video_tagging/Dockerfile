# Use an official Python image as base
FROM public.ecr.aws/lambda/python:3.10

# Set working directory
WORKDIR /var/task

# Install only essential system dependencies for opencv and performance
RUN yum -y install libGL libglib2 && yum clean all

RUN pip install torch==2.0.1 torchvision==0.15.2 torchaudio==2.0.2 --index-url https://download.pytorch.org/whl/cpu

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY lambda_bird_detection.py ./

# (Optional) Set environment variable to suppress OpenCV multithreaded errors in some environments
ENV OPENCV_VIDEOIO_PRIORITY_MSMF=0
ENV AWS_REGION=ap-southeast-2

# Lambda entry point (your script must have a lambda_handler function)
CMD ["lambda_bird_detection.lambda_handler"]

