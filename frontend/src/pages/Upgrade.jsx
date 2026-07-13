import React from 'react';

function Upgrade() {
  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '2rem' }}>
      <h1>Upgrade Your Plan</h1>

      <p>
        You are currently on the <strong>Free</strong> tier:{' '}
        <strong>100 messages/day</strong>.
      </p>

      <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
        Paid plans are <strong>Coming Soon</strong>. Enter your email below to be
        notified when they launch.
      </p>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        {/* Pro tier card */}
        <div
          style={{
            flex: '1 1 200px',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '1.5rem',
            opacity: 0.6,
          }}
        >
          <h2 style={{ marginTop: 0 }}>Pro — Coming Soon</h2>
          <p>Higher daily limits and priority support.</p>
        </div>

        {/* Business tier card */}
        <div
          style={{
            flex: '1 1 200px',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '1.5rem',
            opacity: 0.6,
          }}
        >
          <h2 style={{ marginTop: 0 }}>Business — Coming Soon</h2>
          <p>Unlimited messages, SLA, and dedicated support.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="email"
          placeholder="you@example.com"
          disabled
          style={{
            flex: 1,
            padding: '0.5rem 0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            background: '#f9fafb',
            cursor: 'not-allowed',
          }}
        />
        <button
          disabled
          style={{
            padding: '0.5rem 1rem',
            background: '#d1d5db',
            border: 'none',
            borderRadius: '6px',
            cursor: 'not-allowed',
            color: '#6b7280',
          }}
        >
          Coming Soon
        </button>
      </div>
    </div>
  );
}

export default Upgrade;
