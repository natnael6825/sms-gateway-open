import React from 'react';

const CARD_STYLES = {
  pending: {
    backgroundColor: '#6b7280', // grey
    color: '#fff',
  },
  dispatched: {
    backgroundColor: '#3b82f6', // blue
    color: '#fff',
  },
  sent: {
    backgroundColor: '#22c55e', // green
    color: '#fff',
  },
  failed: {
    backgroundColor: '#ef4444', // red
    color: '#fff',
  },
};

const CARD_LABELS = {
  pending: 'Pending',
  dispatched: 'Dispatched',
  sent: 'Sent',
  failed: 'Failed',
};

function AnalyticsCards({ summary }) {
  const { pending, dispatched, sent, failed } = summary;

  const cards = [
    { key: 'pending', count: pending },
    { key: 'dispatched', count: dispatched },
    { key: 'sent', count: sent },
    { key: 'failed', count: failed },
  ];

  return (
    <div
      style={{
        display: 'flex',
        gap: '1rem',
        flexWrap: 'wrap',
        marginBottom: '1.5rem',
      }}
    >
      {cards.map(({ key, count }) => (
        <div
          key={key}
          data-testid={`card-${key}`}
          style={{
            ...CARD_STYLES[key],
            borderRadius: '0.5rem',
            padding: '1rem 1.5rem',
            minWidth: '120px',
            flex: '1',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '2rem', fontWeight: 'bold', lineHeight: 1 }}>
            {count}
          </div>
          <div style={{ fontSize: '0.875rem', marginTop: '0.25rem', opacity: 0.9 }}>
            {CARD_LABELS[key]}
          </div>
        </div>
      ))}
    </div>
  );
}

export default AnalyticsCards;
