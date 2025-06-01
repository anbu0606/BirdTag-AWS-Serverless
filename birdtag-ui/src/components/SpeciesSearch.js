import React, { useState } from 'react';

function SpeciesSearch() {
  const [species, setSpecies] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('');

  const API_URL = 'https://2qiti236gb.execute-api.ap-southeast-2.amazonaws.com/searching/speciessearching';

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
        body: JSON.stringify({ tags: [species.toLowerCase()] })
      });

      const result = await response.json();
      const parsed = JSON.parse(result.body); // handle double-encoded JSON
      setResults(parsed.links);
      setStatus('');
    } catch (err) {
      setStatus('Error fetching data');
      console.error(err);
    }
  };

  return (
    <div>
      <h3>Search Files by Bird Species</h3>
      <input
        type="text"
        value={species}
        onChange={e => setSpecies(e.target.value)}
        placeholder="e.g. crow"
      />
      <button onClick={handleSearch}>Search</button>
      <p>{status}</p>

      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {results.map((url, index) => (
          <div key={index} style={{ margin: '10px' }}>
            {url.includes('thumbnail') ? (
              <img src={url} alt="thumbnail" width="150" />
            ) : (
              <a href={url} target="_blank" rel="noreferrer">Download File</a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default SpeciesSearch;