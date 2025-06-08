import React, { useState } from 'react';
import { useAuth } from "react-oidc-context";
import './DeleteFiles.css';

function DeleteFiles() {
  const [urls, setUrls] = useState(['']);
  const [results, setResults] = useState(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  //extract the token from auth.user
  const auth = useAuth();
  const token = auth.user?.id_token;

  const API_URL = 'https://exlpu8qlo5.execute-api.ap-southeast-2.amazonaws.com/deletefilesquery/deletefilesAPI';

  const addUrlField = () => {
    setUrls([...urls, '']);
  };

  const removeUrlField = (index) => {
    if (urls.length > 1) {
      const newUrls = urls.filter((_, i) => i !== index);
      setUrls(newUrls);
    }
  };

  const updateUrl = (index, value) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
  };

  const clearAll = () => {
    setUrls(['']);
    setResults(null);
    setStatus('');
  };

  const handleDelete = async () => {
    // Filter out empty URLs
    const validUrls = urls.filter(url => url.trim().length > 0);
    
    if (validUrls.length === 0) {
      setStatus('Please enter at least one URL');
      return;
    }

    // Validate URLs
    const invalidUrls = validUrls.filter(url => {
      try {
        new URL(url);
        return !url.includes('g116-media-s3') && !url.includes('g116-thumbnails-s3');
      } catch {
        return true;
      }
    });

    if (invalidUrls.length > 0) {
      setStatus('Please enter valid S3 URLs from your bird storage buckets');
      return;
    }

    setStatus('');
    setLoading(true);
    setResults(null);
    
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
        body: JSON.stringify({ urls: validUrls })
      });

      const data = await response.json();
      
      if (response.ok) {
        setResults(data);
        if (data.success) {
          setStatus(`Successfully deleted ${data.summary.successfulDeletions} out of ${data.summary.totalRequested} files`);
        } else {
          setStatus(`Failed to delete files. Check results below.`);
        }
      } else {
        setStatus(`Error: ${data.error || 'Failed to delete files'}`);
      }
      
    } catch (err) {
      setStatus('Error connecting to server. Please try again.');
      console.error('Delete error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.key === 'Enter') {
      if (index === urls.length - 1) {
        handleDelete();
      }
    }
  };

  return (
    <div className="delete-files-container">
      <h3>Delete Bird Media Files</h3>
      <p className="description-text">
        Enter full S3 URLs to permanently delete files and their thumbnails
      </p>

      {/* Warning Notice */}
      <div className="warning-notice">
         <strong>Warning:</strong> This action cannot be undone. Files will be permanently deleted from both S3 and the database.
      </div>

      {/* URL Input Fields */}
      <div className="url-inputs-section">
        {urls.map((url, index) => (
          <div key={index} className="url-input-row">
            <input
              type="text"
              value={url}
              onChange={e => updateUrl(index, e.target.value)}
              onKeyPress={e => handleKeyPress(e, index)}
              placeholder="Enter full S3 URL (e.g. https://g116-media-s3.s3.ap-southeast-2.amazonaws.com/image/file.jpg)"
              className="url-input"
            />
            
            {urls.length > 1 && (
              <button 
                onClick={() => removeUrlField(index)}
                className="remove-button"
                title="Remove this URL"
              >
                ×
              </button>
            )}
            
            {index === urls.length - 1 && (
              <button 
                onClick={addUrlField}
                className="add-button"
                title="Add another URL"
              >
                +
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="action-buttons">
        <button 
          onClick={handleDelete}
          disabled={loading}
          className="delete-button"
        >
          {loading ? 'Deleting...' : 'Delete Files'}
        </button>

        <button 
          onClick={clearAll}
          className="clear-button"
        >
          Clear All
        </button>
      </div>

      {/* Status Message */}
      {status && (
        <div className={`status-message ${
          status.includes('Error') || status.includes('Failed') ? 'status-error' : 
          status.includes('Successfully') ? 'status-success' : 'status-warning'
        }`}>
          {status}
        </div>
      )}

      {/* Results Display */}
      {results && (
        <div className="results-container">
          {/* Summary */}
          <div className="summary-section">
            <h4 className="summary-title">Deletion Summary</h4>
            <div className="summary-stats">
              <div><strong>Total Requested:</strong> {results.summary.totalRequested}</div>
              <div style={{ color: '#28a745' }}><strong>Successfully Deleted:</strong> {results.summary.successfulDeletions}</div>
              <div style={{ color: '#dc3545' }}><strong>Failed:</strong> {results.summary.failedDeletions}</div>
            </div>
          </div>

          {/* Successful Deletions */}
          {results.deleted && results.deleted.length > 0 && (
            <div className="successful-deletions">
              <h4 className="section-title success">Successfully Deleted</h4>
              {results.deleted.map((file, index) => (
                <div key={index} className="deletion-item deletion-success">
                  <div className="item-filename">{file.fileName} ({file.fileType})</div>
                  <div className="item-details success">
                    <strong>Deleted from:</strong>
                    <ul className="deleted-locations">
                      {file.deletedFrom.map((location, i) => (
                        <li key={i}>{location}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Failed Deletions */}
          {results.failed && results.failed.length > 0 && (
            <div>
              <h4 className="section-title error">Failed Deletions</h4>
              {results.failed.map((file, index) => (
                <div key={index} className="deletion-item deletion-failed">
                  <div className="item-filename">{file.fileName}</div>
                  <div className="item-details error">
                    <strong>Error:</strong> {file.error}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DeleteFiles;