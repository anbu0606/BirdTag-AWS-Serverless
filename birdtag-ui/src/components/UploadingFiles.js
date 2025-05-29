import React, { useState } from 'react';

function UploadForm() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewURL, setPreviewURL] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');

  // Replace with your real deployed API Gateway REST endpoint:
  const API_ENDPOINT = 'https://fqy43odnm8.execute-api.us-east-1.amazonaws.com/A3/uploads';

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);

    // Preview image
    if (file && file.type.startsWith('image')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewURL(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewURL('');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadStatus('No file selected.');
      return;
    }

    try {
      setUploadStatus('Uploading...');

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result.split(',')[1]; // remove data prefix

        const response = await fetch(API_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fileName: selectedFile.name,
            contentType: selectedFile.type,
            fileContent: base64String
          })
        });

        const result = await response.json();
        if (response.ok) {
          setUploadStatus('Upload successful!');
        } else {
          setUploadStatus(`Upload failed: ${result.error}`);
        }
      };

      reader.readAsDataURL(selectedFile);
    } catch (err) {
      console.error(err);
      setUploadStatus('Upload failed.');
    }
  };

  return (
    <div>
      <h2>Upload Bird Media</h2>
      <input
        type="file"
        onChange={handleFileChange}
        accept="image/*,audio/*,video/*"
      />
      {previewURL && (
        <div>
          <h4>Image Preview:</h4>
          <img src={previewURL} alt="Preview" width="200" />
        </div>
      )}
      <button onClick={handleUpload}>Upload</button>
      <p>{uploadStatus}</p>
    </div>
  );
}

export default UploadForm;
