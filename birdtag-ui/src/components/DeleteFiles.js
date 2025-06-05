import React, { useState } from 'react';
import { useAuth } from "react-oidc-context"; //import useAuth to use the authentication context

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

  // Sample URLs for testing
  const sampleUrls = [
    'https://g116-media-s3.s3.ap-southeast-2.amazonaws.com/image/example.jpg',
    'https://g116-thumbnails-s3.s3.ap-southeast-2.amazonaws.com/thumbnail_images/example_thumb.jpg'
  ];

  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <h3>🗑️ Delete Bird Media Files</h3>
      <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
        Enter full S3 URLs to permanently delete files and their thumbnails
      </p>

      {/* Warning Notice */}
      <div style={{
        backgroundColor: '#fff3cd',
        color: '#856404',
        padding: '12px',
        border: '1px solid #ffeaa7',
        borderRadius: '5px',
        marginBottom: '20px',
        fontSize: '14px'
      }}>
        ⚠️ <strong>Warning:</strong> This action cannot be undone. Files will be permanently deleted from both S3 and the database.
      </div>

      {/* URL Input Fields */}
      <div style={{ marginBottom: '20px' }}>
        {urls.map((url, index) => (
          <div key={index} style={{ 
            display: 'flex', 
            alignItems: 'center', 
            marginBottom: '10px',
            justifyContent: 'center'
          }}>
            <input
              type="text"
              value={url}
              onChange={e => updateUrl(index, e.target.value)}
              onKeyPress={e => handleKeyPress(e, index)}
              placeholder="Enter full S3 URL (e.g. https://g116-media-s3.s3.ap-southeast-2.amazonaws.com/image/file.jpg)"
              style={{ 
                padding: '8px', 
                width: '500px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                marginRight: '10px'
              }}
            />
            
            {urls.length > 1 && (
              <button 
                onClick={() => removeUrlField(index)}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginRight: '5px'
                }}
                title="Remove this URL"
              >
                ✕
              </button>
            )}
            
            {index === urls.length - 1 && (
              <button 
                onClick={addUrlField}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                title="Add another URL"
              >
                +
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={handleDelete}
          disabled={loading}
          style={{
            padding: '10px 25px',
            backgroundColor: loading ? '#ccc' : '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            marginRight: '10px',
            fontWeight: 'bold'
          }}
        >
          {loading ? 'Deleting...' : '🗑️ Delete Files'}
        </button>

        <button 
          onClick={clearAll}
          style={{
            padding: '10px 25px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          Clear All
        </button>
      </div>

      
      {/* Status Message */}
      {status && (
        <div style={{ 
          padding: '12px', 
          backgroundColor: status.includes('Error') || status.includes('Failed') ? '#f8d7da' : 
                           status.includes('Successfully') ? '#d4edda' : '#fff3cd',
          color: status.includes('Error') || status.includes('Failed') ? '#721c24' :
                 status.includes('Successfully') ? '#155724' : '#856404',
          borderRadius: '5px',
          marginBottom: '20px',
          border: `1px solid ${status.includes('Error') || status.includes('Failed') ? '#f5c6cb' : 
                                status.includes('Successfully') ? '#c3e6cb' : '#ffeaa7'}`
        }}>
          {status}
        </div>
      )}

      {/* Results Display */}
      {results && (
        <div style={{ 
          maxWidth: '800px', 
          margin: '0 auto',
          textAlign: 'left'
        }}>
          {/* Summary */}
          <div style={{
            backgroundColor: '#f8f9fa',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid #dee2e6'
          }}>
            <h4 style={{ marginBottom: '10px' }}>📊 Deletion Summary</h4>
            <div style={{ fontSize: '14px' }}>
              <div><strong>Total Requested:</strong> {results.summary.totalRequested}</div>
              <div style={{ color: '#28a745' }}><strong>Successfully Deleted:</strong> {results.summary.successfulDeletions}</div>
              <div style={{ color: '#dc3545' }}><strong>Failed:</strong> {results.summary.failedDeletions}</div>
            </div>
          </div>

          {/* Successful Deletions */}
          {results.deleted && results.deleted.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ color: '#28a745', marginBottom: '10px' }}>✅ Successfully Deleted</h4>
              {results.deleted.map((file, index) => (
                <div key={index} style={{
                  backgroundColor: '#d4edda',
                  padding: '12px',
                  borderRadius: '5px',
                  marginBottom: '10px',
                  border: '1px solid #c3e6cb'
                }}>
                  <div style={{ fontWeight: 'bold' }}>{file.fileName} ({file.fileType})</div>
                  <div style={{ fontSize: '12px', color: '#155724', marginTop: '5px' }}>
                    <strong>Deleted from:</strong>
                    <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
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
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ color: '#dc3545', marginBottom: '10px' }}>❌ Failed Deletions</h4>
              {results.failed.map((file, index) => (
                <div key={index} style={{
                  backgroundColor: '#f8d7da',
                  padding: '12px',
                  borderRadius: '5px',
                  marginBottom: '10px',
                  border: '1px solid #f5c6cb'
                }}>
                  <div style={{ fontWeight: 'bold' }}>{file.fileName}</div>
                  <div style={{ fontSize: '12px', color: '#721c24', marginTop: '5px' }}>
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