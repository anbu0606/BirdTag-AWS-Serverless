import React, { useState } from 'react';
import { useAuth } from 'react-oidc-context';

function Subscribe() {
  const auth = useAuth();
  const [speciesInput, setSpeciesInput] = useState('');
  const [status, setStatus] = useState('');

  const token = auth.user?.id_token;
  const userEmail = auth.user?.profile?.email;

  const API_ENDPOINT = 'https://hrkfkqtxn2.execute-api.ap-southeast-2.amazonaws.com/a3uploading/subscribe';

  const handleSubscribe = async () => {
    if (!speciesInput.trim()) {
      setStatus("Please enter at least one tag.");
      return;
    }
  
    if (/\d/.test(speciesInput)) {
      setStatus("Tags must not contain numbers.");
      return;
    }

    const cleanedTags = speciesInput
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(Boolean);

    if (cleanedTags.length === 0) {
      setStatus("Please enter valid tags.");
      return;
    }

    console.log("Authenticated user email:", userEmail);
    console.log("Subscribing with payload:", {
      email: userEmail,
      tags: cleanedTags
    });

    setStatus('Subscribing...');

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: userEmail,
          tags: cleanedTags
        })
      });

      if (response.ok) {
        setStatus('Successfully subscribed!');
      } else {
        const errorData = await response.json();
        setStatus(`Error: ${errorData.error || 'Subscription failed'}`);
      }
    } catch (error) {
      console.error('Subscription error:', error);
      setStatus('Network error.');
    }
  };

  return (
    <div>
      <h3>Subscribe to Bird Tag Notifications</h3>
      <p>Enter one or more bird species tags (comma-separated):</p>

      <input
        type="text"
        value={speciesInput}
        onChange={e => setSpeciesInput(e.target.value)}
        placeholder='e.g. "crow" or "crow, pigeon"'
        style={{ width: '300px', marginRight: '10px' }}
      />

      <button onClick={handleSubscribe}>Subscribe</button>

      <p>{status}</p>
    </div>
  );
}

export default Subscribe;
