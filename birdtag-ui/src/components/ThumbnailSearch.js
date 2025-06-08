import React, { useState } from 'react';
import { useAuth } from "react-oidc-context";
import './ThumbnailSearch.css';

function ThumbnailSearch() {
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  
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

  return (
    <div className="thumbnail-search-container">
      <h3>Find Full-Size Image from Thumbnail URL</h3>
      <p className="description-text">
        Enter a thumbnail S3 URL to get the corresponding full-size image URL
      </p>
      
      <div className="search-input-section">
        <input
          type="text"
          value={thumbnailUrl}
          onChange={e => setThumbnailUrl(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Enter thumbnail URL (e.g. https://bucket.s3.amazonaws.com/thumb.jpg)"
          className="url-input"
        />
        
        <button 
          onClick={handleSearch}
          disabled={loading}
          className="search-button"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>

        <button 
          onClick={clearSearch}
          className="clear-button"
        >
          Clear
        </button>
      </div>

      {/* Status Message */}
      {status && (
        <p className={`status-message ${status.includes('Error') ? 'status-error' : 'status-success'}`}>
          {status}
        </p>
      )}

      {/* Results Display */}
      {result && result.success && (
        <div className="result-container">
          <h4 className="result-title">Found Full-Size Image!</h4>
          
          {/* Image Preview */}
          <div className="image-preview">
            <img 
              src={result.fullSizeUrl} 
              alt={result.fileInfo.fileName}
              className="preview-image"
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
              Image not available
            </div>
          </div>

          {/* Action Buttons */}
          <div className="action-buttons">
            <button
              onClick={() => window.open(result.fullSizeUrl, '_blank')}
              className="action-button"
            >
              Open Full Image
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ThumbnailSearch;