# 🐦 BirdTag: AWS-Powered Serverless Media Storage & Tagging System

BirdTag is a serverless cloud-based application built to help researchers and enthusiasts manage and retrieve bird-related media files (images, audio, and video) efficiently. It supports automatic and manual tagging of media files, advanced search functionalities, and real-time tag-based notifications. The application is secured using AWS Cognito and is optimized for global performance and fault tolerance.

## 🚀 Key Features

- Upload media (image, audio, video) directly from a web interface to Amazon S3
- Automatic bird species tagging using a machine learning model triggered via AWS Lambda
- Search files by:
  - Species name
  - Tags with minimum counts
  - Similar tags from an uploaded file
  - Thumbnail URL
- Manual bulk tagging with idempotent logic to prevent duplicate updates
- Email notifications when subscribed species are uploaded or updated
- Responsive and user-friendly React-based web UI
- Built entirely using serverless architecture and AWS best practices

---

## 🧠 System Architecture

The system follows a fully serverless architecture using:

- **Frontend:** React (JavaScript), deployed on AWS S3 + CloudFront
- **Backend:** AWS Lambda (Python), API Gateway
- **Authentication:** AWS Cognito
- **Storage:** Amazon S3
- **Database:** Amazon DynamoDB
- **Notifications:** AWS Simple Email Service (SES)
- **Monitoring & Resilience:** AWS CloudWatch, EventBridge, Auto Scaling
---

## 🛠️ Technologies Used

- React (with hooks and functional components)
- AWS S3, Lambda, DynamoDB, SES, CloudFront, EventBridge
- AWS Cognito (authentication & authorization)
- Python (backend logic)
- OpenCV (for image thumbnail generation)
- RESTful APIs via AWS API Gateway

---

## 🌐 Live Application Access

> _This project is deployed privately. To test locally, follow the instructions below._

---

## 🧪 How to Use the Application

### 1. User Registration & Login
- Register using the “Sign Up” page.
- Verify email through a code sent via AWS Cognito.
- Once verified, log in to access all features.

### 2. Upload Media
- Navigate to `Upload Media`.
- Choose a file and click `Upload`.
- File is sent to S3 and tagged using the bird detection model.

### 3. Subscribe to Species
- Enter species of interest (e.g., `crow, robin`).
- You’ll receive email notifications when new files with these tags are uploaded or updated.

### 4. Search Options
- **Search by Tags:** Find files based on tags with count conditions (`{ "crow": 2, "pigeon": 1 }`)
- **Search by Species:** Retrieve all files containing a specific bird species.
- **Search by Uploaded File:** Upload a file to discover and retrieve similar-tagged media.
- **Search by Thumbnail URL:** Enter the S3 URL of a thumbnail to fetch the full-size image.

### 5. Manual Tag Management
- Add or remove tags from multiple files via their URLs.
- Built-in idempotency logic prevents repeated updates within 30 seconds.

### 6. Delete Files
- Permanently delete files and metadata by providing their S3 URLs.

---

## 📈 Performance & Reliability Enhancements

- **Fault Tolerance:** Integrated VPC with NAT Gateway to isolate services like DynamoDB
- **Monitoring:** Centralized logging and anomaly detection using AWS CloudWatch
- **Validation:** EventBridge for catching invalid or failed backend requests
- **Performance:** Enabled DynamoDB Global Secondary Indexes (GSIs) and CloudFront CDN
- **Scalability:** Auto Scaling configured for Lambda and API Gateway
- **Global Access:** S3 and DynamoDB configured across multiple regions using ELB and AWS Global Accelerator

---

## 💡 Future Improvements

- Integrate ML model versioning for dynamic updates
- Add AI-based tag recommendations in the UI
- Implement real-time WebSocket-based notification dashboard
- Support multi-user dashboards with role-based access

---