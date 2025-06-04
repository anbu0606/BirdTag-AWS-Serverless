import React, { useState } from 'react';

function FileTagSearch() {
  const [file, setFile] = useState(null);
  const [fileType, setFileType] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('');

  // Your deployed endpoints
  const API_IMAGE_VIDEO = 'https://87ia3a0c0c.execute-api.ap-southeast-2.amazonaws.com/ImageVideoUpload/query4';
  const API_AUDIO = 'https://nyxjesq0l9.execute-api.ap-southeast-2.amazonaws.com/Query4Audio/UploadAudio';

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    const mime = selectedFile.type;

    if (mime.startsWith('image/')) {
      setFileType('image');
    } else if (mime.startsWith('video/')) {
      setFileType('video');
    } else if (mime.startsWith('audio/')) {
      setFileType('audio');
    } else {
      setFileType('');
      setStatus('Unsupported file type.');
    }
  };

  const handleSubmit = async () => {
    if (!file || !fileType) {
      setStatus('Please select a valid file.');
      return;
    }

    setStatus('Reading file and sending request...');

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Content = reader.result.split(',')[1]; 

        const payload = {
          file_name: file.name,
          file_type: fileType,
          file_content: base64Content
        };

        const apiUrl = (fileType === 'audio') ? API_AUDIO : API_IMAGE_VIDEO;

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) {
          setStatus(`Error: ${data.error || 'Unknown error'}`);
        } else {
          setStatus('Results fetched successfully!');
          setResults(data.links || []);
        }
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('File processing failed:', error);
      setStatus('File processing failed.');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: 'auto' }}>
      <h3>Search by File Tags</h3>

      <input type="file" accept="image/*,video/*,audio/*" onChange={handleFileChange} />
      <br /><br />

      <button className="button-73" onClick={handleSubmit}>Submit File</button>

      <p><strong>Status:</strong> {status}</p>

      <div style={{ marginTop: '20px' }}>
        <h4>Matching Files</h4>
        {results.length === 0 ? <p>No results.</p> : (
          <ul>
            {results.map((item, idx) => (
              <li key={idx}>
                {item.type === 'image' && <img src={item.thumb} alt="thumb" width="100" />}
                {item.type === 'video' && <video width="200" controls><source src={item.url} /></video>}
                {item.type === 'audio' && <audio controls src={item.url}></audio>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default FileTagSearch;