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
      console.error(err);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
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

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
        {results.map((item, index) => (
          <div key={index} style={{ 
            border: '1px solid #ddd', 
            padding: '10px', 
            borderRadius: '5px',
            width: '200px'
          }}>
            {item.fileType === 'image' ? (
              <img 
                src={item.url} 
                alt={item.fileName}
                width="180" 
                style={{ cursor: 'pointer' }}
                onClick={() => window.open(item.fullUrl, '_blank')}
              />
            ) : (
              <div style={{ 
                width: '180px', 
                height: '120px', 
                backgroundColor: '#f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <a href={item.fullUrl} target="_blank" rel="noreferrer">
                  📹 Download Video
                </a>
              </div>
            )}
            
            <div style={{ marginTop: '5px', fontSize: '12px' }}>
              <div><strong>{item.fileName}</strong></div>
              <div>Birds: {Object.entries(item.detectedBirds).map(([bird, cnt]) => 
                `${bird}(${cnt})`
              ).join(', ')}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default BirdTagSearch;