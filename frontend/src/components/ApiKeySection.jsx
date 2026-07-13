import React, { useState, useEffect } from 'react';
import { getApiKey, regenerateApiKey } from '../api/client';

function ApiKeySection() {
  const [maskedKey, setMaskedKey] = useState(null);
  const [newKey, setNewKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    async function fetchApiKey() {
      try {
        const data = await getApiKey();
        setMaskedKey(data.masked_key);
      } catch (err) {
        setError('Failed to load API key.');
      } finally {
        setLoading(false);
      }
    }
    fetchApiKey();
  }, []);

  async function handleRegenerate() {
    setRegenerating(true);
    setError(null);
    setNewKey(null);
    try {
      const data = await regenerateApiKey();
      setNewKey(data.key);
      setMaskedKey(data.masked_key);
    } catch (err) {
      setError('Failed to regenerate API key.');
    } finally {
      setRegenerating(false);
    }
  }

  function handleCopy() {
    if (maskedKey) {
      navigator.clipboard.writeText(maskedKey);
    }
  }

  if (loading) {
    return <div className="card"><p>Loading API key…</p></div>;
  }

  return (
    <div className="card">
      <h2>API Key</h2>

      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}

      {maskedKey && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <code style={{ fontFamily: 'monospace', fontSize: '1rem' }}>{maskedKey}</code>
          <button className="btn" onClick={handleCopy} aria-label="Copy API key">
            Copy
          </button>
        </div>
      )}

      {newKey && (
        <div
          className="alert alert-success"
          role="alert"
          style={{ background: '#fffbcc', border: '1px solid #e6c200', padding: '0.75rem', marginBottom: '1rem' }}
        >
          <strong>New API Key:</strong>{' '}
          <code style={{ fontFamily: 'monospace' }}>{newKey}</code>
          <p style={{ margin: '0.25rem 0 0', color: '#b45309', fontWeight: 'bold' }}>
            This key will not be shown again
          </p>
        </div>
      )}

      <button
        className="btn btn-danger"
        onClick={handleRegenerate}
        disabled={regenerating}
      >
        {regenerating ? 'Regenerating…' : 'Regenerate'}
      </button>
    </div>
  );
}

export default ApiKeySection;
