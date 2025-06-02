import React, { useState } from 'react';

function BirdTagSearch() {
  const [species, setSpecies] = useState('');
  const [count, setCount] = useState(1);
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('');

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
        headers: { 'Content-Type': 'application/json' },
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
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2>🐦 Bird Search</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={species}
          onChange={e => setSpecies(e.target.value)}
          placeholder="Enter bird species (e.g. crow)"
          style={{ padding: '8px', marginRight: '10px', width: '200px' }}
        />
        
        <input
          type="number"
          value={count}
          onChange={e => setCount(e.target.value)}
          min="1"
          placeholder="Min count"
          style={{ padding: '8px', marginRight: '10px', width: '100px' }}
        />
        
        <button onClick={handleSearch} style={{ padding: '8px 15px' }}>
          Search
        </button>
      </div>

      <p>{status}</p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
        {results.map((item, index) => (
          <div key={index} style={{  
            padding: '15px', 
            borderRadius: '10px',
            width: '350px',
            backgroundColor: 'white'
          }}>
            {/* Image or Media */}
            {item.fileType === 'image' ? (
              <img 
                src={item.url} 
                alt={item.fileName}
                width="300" 
                style={{ cursor: 'pointer', marginBottom: '15px' }}
                onClick={() => window.open(item.fullUrl, '_blank')}
              />
            ) : (
              <div style={{ 
                width: '300px', 
                height: '150px', 
                backgroundColor: '#ddd',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '15px'
              }}>
                <a href={item.fullUrl} target="_blank" rel="noreferrer">
                  {item.fileType === 'video' ? '📹 Video' : '🎵 Audio'}
                </a>
              </div>
            )}
            
            {/* Basic Info */}
            <div style={{ marginBottom: '15px', fontSize: '16px' }}>
              <div style={{ fontWeight: 'bold' }}>{item.fileName}</div>
              <div>Type: {item.fileType}</div>
            </div>
            
            {/* THUMBNAIL URL */}
            <div style={{ 
              backgroundColor: '#d1ecf1', 
              color: 'white',
              padding: '15px', 
              marginBottom: '15px',
              fontSize: '14px',
              fontWeight: 'bold'
            }}>
              THUMBNAIL URL:
              <div style={{ 
                backgroundColor: 'white', 
                color: 'black', 
                padding: '10px', 
                marginTop: '5px',
                wordBreak: 'break-all'
              }}>
                {item.url || 'NO URL'}
              </div>
            </div>
            
          </div>
        ))}
      </div>
    </div>
  );
}

export default BirdTagSearch;