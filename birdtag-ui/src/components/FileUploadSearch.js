import React, { useState } from 'react';
import { useAuth } from "react-oidc-context";

function FileTagSearch() {
  const [file, setFile] = useState(null);
  const [fileType, setFileType] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('');

  const auth = useAuth();
  const token = auth.user?.id_token;

  // Your deployed endpoints
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
    
    // Clean up extracted tags
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
          
          setStatus('🔍 Analyzing file to detect bird species...');

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
            setStatus(`❌ Error analyzing file (${response.status})`);
            return;
          }

          const data = await response.json();
          
          // Step 2: Extract bird species tags
          const extractionResult = extractTagsFromMLResponse(data);
          
          if (!extractionResult.success || extractionResult.tags.length === 0) {
            setStatus('❌ No bird species detected in your file.');
            return;
          }

          const detectedSpecies = extractionResult.tags;
          setStatus(`🐦 Detected: ${detectedSpecies.join(', ')} - Searching for similar files...`);

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
            setStatus(`❌ Error searching database (${searchResponse.status})`);
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
            setStatus(`✅ Found ${finalResults.length} files containing: ${detectedSpecies.join(', ')}`);
          } else {
            setStatus(`No matching files found for: ${detectedSpecies.join(', ')}`);
          }

        } catch (error) {
          console.error('Processing error:', error);
          setStatus(`❌ Error processing file: ${error.message}`);
        }
      };

      reader.onerror = () => {
        setStatus('❌ Error reading file.');
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('File processing failed:', error);
      setStatus(`❌ Failed to process file: ${error.message}`);
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
    <div style={{ padding: '20px', maxWidth: '800px', margin: 'auto' }}>
      <h3>🔍 Search by File Tags</h3>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Upload an image, video, or audio file to find similar bird content in our database.
      </p>

      <div style={{ marginBottom: '20px' }}>
        <input 
          type="file" 
          accept="image/*,video/*,audio/*" 
          onChange={handleFileChange}
          style={{ padding: '10px', border: '2px dashed #ccc', borderRadius: '5px', width: '100%' }}
        />
      </div>

      <button 
        className="button-73" 
        onClick={handleSubmit}
        disabled={!file || !fileType}
        style={{ 
          padding: '12px 24px', 
          backgroundColor: file && fileType ? '#007bff' : '#ccc',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: file && fileType ? 'pointer' : 'not-allowed'
        }}
      >
        🚀 Analyze & Search
      </button>

      <div style={{ margin: '20px 0', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
        <strong>Status:</strong> {status || 'Ready to analyze your file...'}
      </div>

      {file && (
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '20px', padding: '10px', backgroundColor: '#fff3cd', borderRadius: '5px' }}>
          <strong>📁 File Info:</strong><br/>
          Name: {file.name} ({fileType})<br/>
          Size: {formatFileSize(file.size)} {file.size > 5 * 1024 * 1024 && '⚠️ Too large!'}
        </div>
      )}

      <div style={{ marginTop: '30px' }}>
        <h4>🎯 Matching Files ({results.length})</h4>
        {results.length === 0 ? (
          <p style={{ color: '#666', fontStyle: 'italic' }}>No results yet. Upload a file to get started!</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
            {results.map((item, idx) => (
              <div key={idx} style={{ 
                border: '1px solid #ddd', 
                padding: '15px', 
                borderRadius: '8px',
                backgroundColor: '#fff',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                {item.type === 'image' && (
                  <div>
                    <img 
                      src={item.thumb} 
                      alt="thumbnail" 
                      style={{ 
                        width: '100%', 
                        height: '180px', 
                        objectFit: 'cover', 
                        borderRadius: '5px',
                        cursor: 'pointer'
                      }}
                      onClick={() => window.open(item.url, '_blank')}
                      onError={(e) => {
                        console.error('Image load error for:', item.thumb);
                        e.target.style.display = 'none';
                      }}
                    />
                    <div style={{ marginTop: '10px' }}>
                      <h5 style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: 'bold' }}>
                        🖼️ {item.fileName || `Image ${idx + 1}`}
                      </h5>
                      {item.detectedBirds && (
                        <p style={{ fontSize: '11px', color: '#28a745', margin: '3px 0', fontWeight: '500' }}>
                          🐦 Birds: {Object.entries(item.detectedBirds).map(([bird, count]) => `${bird}(${count})`).join(', ')}
                        </p>
                      )}
                      <div style={{ fontSize: '9px', color: '#6c757d', marginTop: '8px' }}>
                        <strong>📎 S3 URL:</strong><br/>
                        <a href={item.thumb} target="_blank" rel="noopener noreferrer" 
                           style={{ wordBreak: 'break-all', color: '#007bff' }}>
                          {item.thumb}
                        </a>
                      </div>
                    </div>
                  </div>
                )}
                
                {item.type === 'video' && (
                  <div>
                    <div 
                      style={{ 
                        position: 'relative',
                        cursor: 'pointer',
                        borderRadius: '5px',
                        overflow: 'hidden'
                      }}
                      onClick={() => window.open(item.url, '_blank')}
                    >
                      <video 
                        width="100%" 
                        height="180" 
                        style={{ borderRadius: '5px' }}
                        poster={item.thumb}
                      >
                        <source src={item.url} />
                        Your browser does not support video.
                      </video>
                      <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        color: 'white',
                        padding: '10px',
                        borderRadius: '50%',
                        fontSize: '20px'
                      }}>
                        ▶️
                      </div>
                    </div>
                    <div style={{ marginTop: '10px' }}>
                      <h5 style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: 'bold' }}>
                        🎥 {item.fileName || `Video ${idx + 1}`}
                      </h5>
                      {item.detectedBirds && (
                        <p style={{ fontSize: '11px', color: '#28a745', margin: '3px 0', fontWeight: '500' }}>
                          🐦 Birds: {Object.entries(item.detectedBirds).map(([bird, count]) => `${bird}(${count})`).join(', ')}
                        </p>
                      )}
                      <div style={{ fontSize: '9px', color: '#6c757d', marginTop: '8px' }}>
                        <strong>📎 S3 URL:</strong><br/>
                        <a href={item.url} target="_blank" rel="noopener noreferrer" 
                           style={{ wordBreak: 'break-all', color: '#007bff' }}>
                          {item.url}
                        </a>
                      </div>
                    </div>
                  </div>
                )}
                
                {item.type === 'audio' && (
                  <div>
                    <div style={{ 
                      height: '180px', 
                      backgroundColor: '#f8f9fa', 
                      borderRadius: '5px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '10px'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '48px', marginBottom: '10px' }}>🎵</div>
                        <audio controls style={{ width: '100%' }}>
                          <source src={item.url} />
                          Your browser does not support audio.
                        </audio>
                      </div>
                    </div>
                    <div>
                      <h5 style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: 'bold' }}>
                        🎵 {item.fileName || `Audio ${idx + 1}`}
                      </h5>
                      {item.detectedBirds && (
                        <p style={{ fontSize: '11px', color: '#28a745', margin: '3px 0', fontWeight: '500' }}>
                          🐦 Birds: {Object.entries(item.detectedBirds).map(([bird, count]) => `${bird}(${count})`).join(', ')}
                        </p>
                      )}
                      <div style={{ fontSize: '9px', color: '#6c757d', marginTop: '8px' }}>
                        <strong>🔗 Audio URL:</strong><br/>
                        <a href={item.url} target="_blank" rel="noopener noreferrer" 
                           style={{ wordBreak: 'break-all', color: '#007bff' }}>
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