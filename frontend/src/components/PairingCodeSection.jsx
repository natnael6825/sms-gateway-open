import React, { useState, useEffect } from 'react';
import { generatePairingCode, resetDeviceKey } from '../api/client';

function PairingCodeSection() {
  const [code, setCode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState(null);
  const [resetWarning, setResetWarning] = useState(false);

  async function fetchKey() {
    setLoading(true);
    setError(null);
    try {
      const data = await generatePairingCode();
      setCode(data.code);
    } catch (err) {
      setError('Failed to load device key.');
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    setResetting(true);
    setError(null);
    setResetWarning(false);
    try {
      const data = await resetDeviceKey();
      setCode(data.code);
      setResetWarning(true);
    } catch (err) {
      setError('Failed to reset device key.');
    } finally {
      setResetting(false);
    }
  }

  useEffect(() => {
    fetchKey();
  }, []);

  if (loading) {
    return <div className="card"><p>Loading device key…</p></div>;
  }

  return (
    <div className="card">
      <h2>Device Pairing</h2>
      <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>
        Enter this key in the mobile app to pair any phone as a message sender for your account.
      </p>

      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}

      {resetWarning && (
        <p className="alert alert-success" role="alert" style={{ background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e' }}>
          Key reset. Any previously paired phones will need to re-pair with the new key.
        </p>
      )}

      {code && (
        <div style={{ marginBottom: '1rem' }}>
          <code
            data-testid="device-key"
            style={{
              fontFamily: 'monospace',
              fontSize: '2.5rem',
              letterSpacing: '0.4rem',
              display: 'block',
              marginBottom: '0.5rem',
            }}
          >
            {code}
          </code>
          <p style={{ color: '#6b7280', fontSize: '0.8rem' }}>
            This key is permanent — it works on any number of phones until you reset it.
          </p>
        </div>
      )}

      <button
        className="btn btn-danger"
        onClick={handleReset}
        disabled={resetting}
      >
        {resetting ? 'Resetting…' : 'Reset Key'}
      </button>
    </div>
  );
}

export default PairingCodeSection;
