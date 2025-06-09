import React, { useState } from 'react';
import { useAuth } from "react-oidc-context";
import './FileUploadSearch.css';

function FileTagSearch() {
  const [file, setFile] = useState(null);
  const [fileType, setFileType] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('');

  const auth = useAuth();
  const token = auth.user?.id_token;

  // endpoints
  const API_IMAGE_VIDEO = 'https://j3iw3py8vb.execute-api.ap-southeast-2.amazonaws.com/fileBasedTagImgVid/FileBasedTagImgVidAPI';
  const API_AUDIO = 'https://ns03wx51yk.execute-api.ap-southeast-2.amazonaws.com/fileBasedTagAudio/FileBasedTagAudioAPI';
  const API_LAMBDA_QUERY = 'https://l1fqf07eb1.execute-api.ap-southeast-2.amazonaws.com/returnfilebasedquery/returnfilebasedqueryAPI';

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResults([]);
    setStatus('');

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

  // Extract tags from ML API response
  const extractTagsFromMLResponse = (mlResponse) => {
    console.log('=== EXTRACTING TAGS FROM ML RESPONSE ===');
    console.log('Raw ML response:', mlResponse);
    
    let extractedTags = [];
    let extractionMethod = 'none';
    
    // Handle API Gateway wrapped response
    let actualData = mlResponse;
    if (mlResponse.body) {
      actualData = typeof mlResponse.body === 'string' 
        ? JSON.parse(mlResponse.body) 
        : mlResponse.body;
    }
    
    // Method 1: searchTags array (your ML API format)
    if (actualData.searchTags && Array.isArray(actualData.searchTags)) {
      extractedTags = actualData.searchTags.filter(tag => tag && tag.trim());
      extractionMethod = 'searchTags array';
    }
    // Method 2: Direct tags array
    else if (actualData.tags && Array.isArray(actualData.tags)) {
      extractedTags = actualData.tags.filter(tag => tag && tag.trim());
      extractionMethod = 'tags array';
    }
    // Method 3: detected_labels array
    else if (actualData.detected_labels && Array.isArray(actualData.detected_labels)) {
      extractedTags = actualData.detected_labels
        .map(label => label.Name || label.name || label.label)
        .filter(tag => tag && tag.trim());
      extractionMethod = 'detected_labels array';
    }
    // Method 4: species field
    else if (actualData.species) {
      extractedTags = Array.isArray(actualData.species) 
        ? actualData.species.filter(tag => tag && tag.trim())
        : [actualData.species].filter(tag => tag && tag.trim());
      extractionMethod = 'species field';
    }
    
  
    const cleanTags = extractedTags
      .map(tag => tag.toString().toLowerCase().trim())
      .filter(tag => tag.length > 0 && tag !== 'unknown' && tag !== 'null')
      .filter((tag, index, arr) => arr.indexOf(tag) === index); // Remove duplicates
    
    console.log('=== EXTRACTION RESULTS ===');
    console.log('Method used:', extractionMethod);
    console.log('Clean tags:', cleanTags);
    
    return {
      tags: cleanTags,
      method: extractionMethod,
      success: cleanTags.length > 0
    };
  };

  const handleSubmit = async () => {
    if (!file || !fileType) {
      setStatus('Please select a valid file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setStatus('File too large. Please select a file smaller than 5MB.');
      return;
    }

    if (!token) {
      setStatus('Authentication token not available. Please log in again.');
      return;
    }

    setStatus('Processing your file...');

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64Content = reader.result.split(',')[1]; 

          if (base64Content.length > 7000000) {
            setStatus('File content too large after encoding. Please select a smaller file.');
            return;
          }

          const payload = {
            file_name: file.name,
            file_type: fileType,
            file_content: base64Content
          };

          const apiUrl = (fileType === 'audio') ? API_AUDIO : API_IMAGE_VIDEO;
          
          setStatus('Analyzing file to detect bird species...');

          // Step 1: Get bird species from ML API
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json', 
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            setStatus(`Error analyzing file (${response.status})`);
            return;
          }

          const data = await response.json();
          
          // Step 2: Extract bird species tags
          const extractionResult = extractTagsFromMLResponse(data);
          
          if (!extractionResult.success || extractionResult.tags.length === 0) {
            setStatus('No bird species detected in your file.');
            return;
          }

          const detectedSpecies = extractionResult.tags;
          setStatus(`Detected: ${detectedSpecies.join(', ')} - Searching for similar files...`);

          // Step 3: Search for similar files using detected species
          const searchPayload = {
            tags: detectedSpecies,
            counts: detectedSpecies.map(() => 1)
          };

          const searchResponse = await fetch(API_LAMBDA_QUERY, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(searchPayload)
          });

          if (!searchResponse.ok) {
            setStatus(`Error searching database (${searchResponse.status})`);
            return;
          }

          const searchData = await searchResponse.json();
          
          // Step 4: Process and display results
          let responseBody = searchData;
          if (searchData.body) {
            responseBody = typeof searchData.body === 'string' 
              ? JSON.parse(searchData.body) 
              : searchData.body;
          }

          if (responseBody.results && Array.isArray(responseBody.results) && responseBody.results.length > 0) {
            const finalResults = responseBody.results.map(item => ({
              type: item.fileType || 'image',
              url: item.fullUrl || item.url,
              thumb: item.url,
              fileName: item.fileName,
              detectedBirds: item.detectedBirds,
              uploadDate: item.uploadDate,
              fileId: item.fileId
            }));
            
            setResults(finalResults);
            setStatus(`Found ${finalResults.length} files containing: ${detectedSpecies.join(', ')}`);
          } else {
            setStatus(`No matching files found for: ${detectedSpecies.join(', ')}`);
          }

        } catch (error) {
          console.error('Processing error:', error);
          setStatus(`Error processing file: ${error.message}`);
        }
      };

      reader.onerror = () => {
        setStatus('Error reading file.');
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('File processing failed:', error);
      setStatus(`Failed to process file: ${error.message}`);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="file-search-container">
      <h3>Search by File Tags</h3>
      <p className="description-text">
        Upload an image, video, or audio file to find similar bird content in our database.
      </p>

      <div className="file-upload-section">
        <input 
          type="file" 
          accept="image/*,video/*,audio/*" 
          onChange={handleFileChange}
          className="file-input"
        />
      </div>

      <button 
        className="analyze-button" 
        onClick={handleSubmit}
        disabled={!file || !fileType}
      >
        Analyze & Search
      </button>

      <div className="status-container">
        <strong>Status:</strong> {status || 'Ready to analyze your file...'}
      </div>

      {file && (
        <div className="file-info-container">
          <strong>File Info:</strong><br/>
          Name: {file.name} ({fileType})<br/>
          Size: {formatFileSize(file.size)} {file.size > 5 * 1024 * 1024 && 'Too large!'}
        </div>
      )}

      <div className="results-section">
        <h4 className="results-title">Matching Files ({results.length})</h4>
        {results.length === 0 ? (
          <p className="no-results-text">No results yet. Upload a file to get started!</p>
        ) : (
          <div className="results-grid">
            {results.map((item, idx) => (
              <div key={idx} className="result-card">
                {item.type === 'image' && (
                  <div>
                    <img 
                      src={item.thumb} 
                      alt="thumbnail" 
                      className="result-image"
                      onClick={() => window.open(item.url, '_blank')}
                      onError={(e) => {
                        console.error('Image load error for:', item.thumb);
                        e.target.style.display = 'none';
                      }}
                    />
                    <div className="file-details">
                      <h5 className="file-title">
                        {item.fileName || `Image ${idx + 1}`}
                      </h5>
                      {item.detectedBirds && (
                        <p className="bird-info">
                          Birds: {Object.entries(item.detectedBirds).map(([bird, count]) => `${bird}(${count})`).join(', ')}
                        </p>
                      )}
                      <div className="url-section">
                        <span className="url-label">S3 URL:</span>
                        <a href={item.thumb} target="_blank" rel="noopener noreferrer" className="url-link">
                          {item.thumb}
                        </a>
                      </div>
                    </div>
                  </div>
                )}
                
                {item.type === 'video' && (
                  <div>
                    <div 
                      className="video-container"
                      onClick={() => window.open(item.url, '_blank')}
                    >
                      <video 
                        className="video-element"
                        poster={item.thumb}
                      >
                        <source src={item.url} />
                        Your browser does not support video.
                      </video>
                      <div className="play-button">
                        
                      </div>
                    </div>
                    <div className="file-details">
                      <h5 className="file-title">
                        {item.fileName || `Video ${idx + 1}`}
                      </h5>
                      {item.detectedBirds && (
                        <p className="bird-info">
                          Birds: {Object.entries(item.detectedBirds).map(([bird, count]) => `${bird}(${count})`).join(', ')}
                        </p>
                      )}
                      <div className="url-section">
                        <span className="url-label">S3 URL:</span>
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="url-link">
                          {item.url}
                        </a>
                      </div>
                    </div>
                  </div>
                )}
                
                {item.type === 'audio' && (
                  <div>
                    <div className="audio-container">
                      <div className="audio-content">
                        <div className="audio-icon"></div>
                        <audio controls className="audio-controls">
                          <source src={item.url} />
                          Your browser does not support audio.
                        </audio>
                      </div>
                    </div>
                    <div className="file-details">
                      <h5 className="file-title">
                        {item.fileName || `Audio ${idx + 1}`}
                      </h5>
                      {item.detectedBirds && (
                        <p className="bird-info">
                          Birds: {Object.entries(item.detectedBirds).map(([bird, count]) => `${bird}(${count})`).join(', ')}
                        </p>
                      )}
                      <div className="url-section">
                        <span className="url-label">Audio URL:</span>
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="url-link">
                          {item.url}
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default FileTagSearch;