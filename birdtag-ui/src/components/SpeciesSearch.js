import React, { useState } from 'react';
import { useAuth } from "react-oidc-context"; //import useAuth to use the authentication context

function SpeciesSearch() {
  const [speciesInput, setSpeciesInput] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('');

  //extract the token from auth.user
  const auth = useAuth();
  const token = auth.user?.id_token;

  const API_URL = 'https://2qiti236gb.execute-api.ap-southeast-2.amazonaws.com/searching/speciessearching';
  

  const handleSearch = async () => {
    const speciesList = speciesInput
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(Boolean); // remove empty entries

    if (speciesList.length === 0) {
      setStatus('Please enter at least one species');
      return;
    }

    setStatus('Searching...');
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        // update fetch to use the token 
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
        body: JSON.stringify({ tags: speciesList })
      });

      const result = await response.json();
      const parsed = JSON.parse(result.body);
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
        value={speciesInput}
        onChange={e => setSpeciesInput(e.target.value)}
        placeholder='e.g. "crow" or "crow, pigeon"'
        style={{ width: '300px' }}
      />
      <button onClick={handleSearch} style={{ marginLeft: '10px' }}>Search</button>
      <p>{status}</p>

      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {results.map((item, index) => (
          <div key={index} style={{ margin: '10px', textAlign: 'center' }}>
            {item.type === 'image' ? (
              <a href={item.full} target="_blank" rel="noopener noreferrer">
                <img src={item.thumb} alt="thumbnail" width="150" />
              </a>
            ) : item.type === 'video' ? (
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                Download Video
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export default SpeciesSearch;