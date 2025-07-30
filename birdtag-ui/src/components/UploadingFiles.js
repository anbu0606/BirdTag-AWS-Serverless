import React, { useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { ClipLoader } from 'react-spinners';
import './UploadFiles.css';

function UploadForm() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewURL, setPreviewURL] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const auth = useAuth();
  const token = auth.user?.id_token;

  const API_ENDPOINT = 'https://hrkfkqtxn2.execute-api.ap-southeast-2.amazonaws.com/a3uploading/uploads';

  // Corruption check for image files
  const checkImageFile = (file) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = URL.createObjectURL(file);
    });
  };

  // Corruption check for video files
  const checkVideoFile = (file) => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => resolve(true);
      video.onerror = () => resolve(false);
      video.src = URL.createObjectURL(file);
    });
  };

  // Corruption check for audio files
  const checkAudioFile = (file) => {
    return new Promise((resolve) => {
      const audio = document.createElement('audio');
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => resolve(true);
      audio.onerror = () => resolve(false);
      audio.src = URL.createObjectURL(file);
    });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    setSelectedFile(null); // Reset first in case previous file was valid
    setPreviewURL('');
    setUploadStatus('');

    if (!file) return;

    let isValid = true;

    if (file.type.startsWith('image')) {
      isValid = await checkImageFile(file);
      if (isValid) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviewURL(reader.result);
        };
        reader.readAsDataURL(file);
      }
    } else if (file.type.startsWith('video')) {
      isValid = await checkVideoFile(file);
    } else if (file.type.startsWith('audio')) {
      isValid = await checkAudioFile(file);
    } else {
      isValid = false;
    }

    if (isValid) {
      setSelectedFile(file);
      setUploadStatus('File loaded successfully. Ready to upload.');
    } else {
      setUploadStatus('Selected file appears to be corrupted or unsupported.');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadStatus('No valid file selected.');
      return;
    }

    setLoading(true);
    setUploadStatus('Requesting upload URL...');

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileName: selectedFile.name,
          contentType: selectedFile.type,
        }),
      });

      const result = await response.json();

      if (response.status === 400 || response.status === 409) {
        setUploadStatus(result.error || 'Upload error.');
        setLoading(false);
        return;
      }

      const presignedUrl = result.url;
      if (!presignedUrl) throw new Error('No presigned URL returned.');

      setUploadStatus('Uploading to S3...');

      const uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': selectedFile.type },
        body: selectedFile,
      });

      if (uploadResponse.ok) {
        setUploadStatus('File uploaded successfully!');
      } else {
        setUploadStatus(`Upload failed. S3 status ${uploadResponse.status}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('Network or server error during upload.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-container">
      <h2>Upload Bird Media</h2>

      <label>Select a File (Image, Audio or Video):</label>
      <input
        type="file"
        onChange={handleFileChange}
        accept="image/*,audio/*,video/*"
      />

      {previewURL && (
        <div className="preview-section">
          <h4>Image Preview:</h4>
          <img src={previewURL} alt="Preview" width="200" />
        </div>
      )}

      <button className="submit-btn" onClick={handleUpload} disabled={loading || !selectedFile}>
        {loading ? <ClipLoader size={18} color="#fff" /> : 'Upload'}
      </button>

      {uploadStatus && <p className="status-text">{uploadStatus}</p>}
    </div>
  );
}

export default UploadForm;
