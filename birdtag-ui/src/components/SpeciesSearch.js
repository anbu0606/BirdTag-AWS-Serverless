import React, { useState } from 'react';
import { useAuth } from "react-oidc-context";
import { ClipLoader } from 'react-spinners';
import './SpeciesSearch.css';

function SpeciesSearch() {
  const [speciesInput, setSpeciesInput] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const auth = useAuth();
  const token = auth.user?.id_token;

  const API_URL = 'https://2qiti236gb.execute-api.ap-southeast-2.amazonaws.com/searching/speciessearching';

  const handleSearch = async () => {
    const speciesList = speciesInput
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(Boolean);

    if (speciesList.length === 0) {
      setStatus('Please enter at least one species');
      return;
    }

    setLoading(true);
    setStatus('Searching...');

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ tags: speciesList })
      });

      const result = await response.json();
      const parsed = JSON.parse(result.body);

      setResults(parsed.links || []);
      setStatus(parsed.links.length === 0 ? 'No results found.' : '');
    } catch (err) {
      setStatus('Error fetching data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="species-search-container">
      <h3>Search Files by Bird Species</h3>

      <input
        type="text"
        value={speciesInput}
        onChange={e => setSpeciesInput(e.target.value)}
        placeholder='e.g. "crow" or "crow, pigeon"'
        className="input-box"
      />
      <button className="search-button" onClick={handleSearch} disabled={loading}>
        {loading ? <ClipLoader size={16} color="#fff" /> : 'Search'}
      </button>

      <p className="status-text">{status}</p>

      <div className="results-grid">
        {results.map((item, index) => (
          <div key={index} className="result-card">
            {item.type === 'image' ? (
              <a href={item.full} target="_blank" rel="noopener noreferrer">
                <img src={item.thumb} alt="thumbnail" className="thumbnail" />
              </a>
            ) : item.type === 'video' ? (
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                🎥 Download Video
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export default SpeciesSearch;