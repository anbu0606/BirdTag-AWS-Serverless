import React, { useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { ClipLoader } from 'react-spinners';
import './ManualTagging.css';

function BulkTagUpdater() {
  const [urls, setUrls] = useState('');
  const [tags, setTags] = useState('');
  const [operation, setOperation] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const auth = useAuth();
  const token = auth.user?.id_token;
  const API_URL = 'https://opjoc8qoq6.execute-api.ap-southeast-2.amazonaws.com/bulktag/manualtagging';

  const handleSubmit = async () => {
    if (!auth?.user?.id_token) {
      setStatus('You must be logged in.');
      return;
    }

    const urlArray = urls
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean);

    const tagArray = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (!urlArray.length || tagArray.length < 2 || tagArray.length % 2 !== 0) {
      setStatus('Please enter valid URLs and comma-separated tags with counts. Format: tag,count,tag,count');
      return;
    }

    for (let i = 1; i < tagArray.length; i += 2) {
      if (isNaN(tagArray[i])) {
        setStatus(`Count value for tag "${tagArray[i - 1]}" must be a number.`);
        return;
      }
    }

    setLoading(true);
    setStatus('');

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          url: urlArray,
          tags: tagArray,
          operation,
        }),
      });

      const rawResult = await response.json();
      const result = typeof rawResult.body === 'string' ? JSON.parse(rawResult.body) : rawResult;

        if (!response.ok) {
          setStatus('Error: ' + (result.error || 'Unknown error'));
        } else {
          const updated = result.updated || [];
          const skipped = result.skipped || [];
          const notFound = result.notFound || [];

          let message = '';

          if (updated.length > 0) {
            message += `Tags updated for:\n${updated.join('\n')}\n\n`;
          }

          if (skipped.length > 0) {
            message += `Skipped due to recent edits:\n${skipped.join('\n')}\nPlease retry these after 30 seconds.\n\n`;
          }

          if (notFound.length > 0) {
            message += `The following URLs were not found in the database:\n${notFound.join('\n')}\nPlease ensure the URLs are correct.\n`;
          }

          if (!updated.length && !skipped.length && !notFound.length) {
            message = 'No actions performed.';
          }

          setStatus(message.trim());
        }
      } catch (err) {
        console.error(err);
        setStatus('Network error.');
      } finally {
        setLoading(false);
      }
    };
      

  return (
    <div className="bulk-tag-container">
      <h2>Bulk Tag Updater</h2>

      <label>S3 URLs (one per line):</label>
      <textarea
        value={urls}
        onChange={(e) => setUrls(e.target.value)}
        rows={6}
        placeholder="https://s3-url-1...\nhttps://s3-url-2..."
      />

      <label>Tags with Counts (comma-separated):</label>
      <input
        type="text"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        placeholder="e.g. crow,2,pigeon,1"
      />

      <div className="radio-options">
        <label>
          <input
            type="radio"
            value={1}
            checked={operation === 1}
            onChange={() => setOperation(1)}
          />{' '}
          Add Tags
        </label>
        <label>
          <input
            type="radio"
            value={0}
            checked={operation === 0}
            onChange={() => setOperation(0)}
          />{' '}
          Remove Tags
        </label>
      </div>

      <button onClick={handleSubmit} className="submit-btn" disabled={loading}>
        {loading ? <ClipLoader size={18} color="#fff" /> : 'Submit'}
      </button>

      {status && (
        <pre className="status-text" style={{ whiteSpace: 'pre-wrap', marginTop: '1rem' }}>
          {status}
        </pre>
      )}
    </div>
  );
}

export default BulkTagUpdater;