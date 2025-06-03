import React, { useState } from 'react';
import { useAuth } from "react-oidc-context"; //import useAuth to use the authentication context

function ThumbnailSearch() {
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  //extract the token from auth.user
  const auth = useAuth();
  const token = auth.user?.id_token;

  const API_URL = 'https://9vfmj4vy11.execute-api.ap-southeast-2.amazonaws.com/thumbnailSearch/thumbnailBasedSearchAPI';

  const handleSearch = async () => {
    if (!thumbnailUrl.trim()) {
      setStatus('Please enter a thumbnail URL');
      return;
    }

    setStatus('');
    setLoading(true);
    setResult(null);
    
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
        body: JSON.stringify({ thumbnailUrl: thumbnailUrl.trim() })
      });

      const data = await response.json();
      
      if (!response.ok) {
        setStatus(`Error: ${data.error || 'Failed to search'}`);
        return;
      }

      if (data.success) {
        setResult(data);
        setStatus('Full-size image found successfully!');
      } else {
        setStatus(`Error: ${data.error || 'No results found'}`);
      }
      
    } catch (err) {
      setStatus('Error fetching data. Please try again.');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const clearSearch = () => {
    setThumbnailUrl('');
    setResult(null);
    setStatus('');
  };

  // Sample URLs for testing
  const sampleUrls = [
    'https://g116-thumbnails-s3.s3.ap-southeast-2.amazonaws.com/thumbnail_images/crows_1_thumb.jpg',
    'https://g116-thumbnails-s3.s3.ap-southeast-2.amazonaws.com/thumbnail_images/sparrow_1_thumb.jpg',
    's3://g116-thumbnails-s3/thumbnail_images/crows_2_thumb.jpg'
  ];

  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <h3>Find Full-Size Image from Thumbnail URL</h3>
      <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
        Enter a thumbnail S3 URL to get the corresponding full-size image URL
      </p>
      
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={thumbnailUrl}
          onChange={e => setThumbnailUrl(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Enter thumbnail URL (e.g. https://bucket.s3.amazonaws.com/thumb.jpg)"
          style={{ 
            padding: '8px', 
            marginRight: '10px', 
            width: '500px',
            border: '1px solid #ccc',
            borderRadius: '4px'
          }}
        />
        
        <button 
          onClick={handleSearch}
          disabled={loading}
          style={{
            padding: '8px 15px',
            backgroundColor: loading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            marginRight: '10px'
          }}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>

        <button 
          onClick={clearSearch}
          style={{
            padding: '8px 15px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Clear
        </button>
      </div>

      {/* Status Message */}
      {status && (
        <p style={{ 
          color: status.includes('Error') ? 'red' : 'green',
          fontWeight: 'bold',
          marginBottom: '20px'
        }}>
          {status}
        </p>
      )}

      {/* Results Display */}
      {result && result.success && (
        <div style={{ 
          maxWidth: '800px', 
          margin: '0 auto',
          border: '1px solid #ddd',
          borderRadius: '8px',
          padding: '20px',
          backgroundColor: '#f9f9f9'
        }}>
          <h4 style={{ marginBottom: '15px', color: '#333' }}>Found Full-Size Image!</h4>
          
          {/* Image Preview */}
          <div style={{ marginBottom: '20px' }}>
            <img 
              src={result.fullSizeUrl} 
              alt={result.fileInfo.fileName}
              style={{ 
                maxWidth: '400px', 
                maxHeight: '300px',
                width: 'auto',
                height: 'auto',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}
              onClick={() => window.open(result.fullSizeUrl, '_blank')}
              onError={e => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'block';
              }}
            />
            
            {/* Fallback for broken images */}
            <div style={{ 
              display: 'none',
              width: '400px',
              height: '200px',
              backgroundColor: '#f0f0f0',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              fontSize: '24px',
              margin: '0 auto'
            }}>
              
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              onClick={() => window.open(result.fullSizeUrl, '_blank')}
              style={{
                padding: '10px 20px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
           
            </button>

          </div>
        </div>
      )}
    </div>
  );
}

export default ThumbnailSearch;