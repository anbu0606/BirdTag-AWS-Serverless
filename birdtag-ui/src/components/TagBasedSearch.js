import React, { useState } from 'react';
import { useAuth } from "react-oidc-context";
import './TagBasedSearch.css';

function BirdTagSearch() {
  const [species, setSpecies] = useState('');
  const [count, setCount] = useState(1);
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('');

  const auth = useAuth();
  const token = auth.user?.id_token;
  
  const API_URL = 'https://9fm7obam2b.execute-api.ap-southeast-2.amazonaws.com/tagbasedsearch/tagbasedsearchAPI';

  const handleSearch = async () => {
    if (!species) {
      setStatus('Please enter a species name');
      return;
    }

    setStatus('Searching...');
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
        body: JSON.stringify({ [species.toLowerCase()]: parseInt(count) })
      });

      const result = await response.json();
      
      if (result.error) {
        setStatus(`Error: ${result.error}`);
        return;
      }

      setResults(result.results || []);
      setStatus(result.message || `Found ${result.totalCount} files`);
      
    } catch (err) {
      setStatus('Error fetching data');
      console.error('Fetch error:', err);
    }
  };

  return (
    <div className="tag-search-container">
      <h3>Bird Search</h3>
      
      <div className="input-row">
        <input
          type="text"
          value={species}
          onChange={e => setSpecies(e.target.value)}
          placeholder="Enter bird species (e.g. crow)"
          className="species-input"
        />
        
        <input
          type="number"
          value={count}
          onChange={e => setCount(e.target.value)}
          min="1"
          placeholder="Min count"
          className="count-input"
        />
        
        <button onClick={handleSearch} className="search-button">
          Search
        </button>
      </div>

      <p className="status-text">{status}</p>

      <div className="results-container">
        <div className="results-grid">
          {results.map((item, index) => (
            <div key={index} className="result-card">
              {/* Image or Media */}
              {item.fileType === 'image' ? (
                <img 
                  src={item.url} 
                  alt={item.fileName}
                  className="result-image"
                  onClick={() => window.open(item.fullUrl, '_blank')}
                />
              ) : (
                <div className="media-placeholder">
                  <a href={item.fullUrl} target="_blank" rel="noopener noreferrer">
                    {item.fileType === 'video' ? 'Video' : 'Audio'}
                  </a>
                </div>
              )}
              
              {/* Basic Info */}
              <div className="file-info">
                <div className="file-name">{item.fileName}</div>
                <div className="file-type">Type: {item.fileType}</div>
              </div>
              
              {/* THUMBNAIL URL */}
              <div className="thumbnail-url-section">
                THUMBNAIL URL:
                <div className="url-display">
                  {item.url || 'NO URL'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default BirdTagSearch;