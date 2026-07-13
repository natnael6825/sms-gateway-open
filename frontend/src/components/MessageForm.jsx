import React, { useState } from 'react';
import client from '../api/client';

function MessageForm({ onSuccess }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [messageText, setMessageText] = useState('');
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setNotification(null);
    setLoading(true);

    try {
      await client.post('/api/messages', {
        phone_number: phoneNumber,
        message_text: messageText,
      });
      setNotification({ type: 'success', text: 'Message queued successfully!' });
      setPhoneNumber('');
      setMessageText('');
      if (onSuccess) onSuccess();
    } catch (err) {
      const reason =
        err.response?.data?.error || 'Failed to send message. Please try again.';
      setNotification({ type: 'error', text: reason });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2>Send a Message</h2>

      {notification && (
        <p
          className={`alert ${notification.type === 'success' ? 'alert-success' : 'alert-error'}`}
          role="alert"
          data-type={notification.type}
        >
          {notification.text}
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="phone-number">Phone Number</label>
            <input
              id="phone-number"
              type="text"
              placeholder="+1 555 000 0000"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="message-text">Message Text</label>
            <input
              id="message-text"
              type="text"
              placeholder="Type your message…"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              required
            />
          </div>

          <button
            className="btn btn-send"
            type="submit"
            disabled={loading}
            style={{ whiteSpace: 'nowrap' }}
          >
            {loading ? 'Sending…' : '➤ Send'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default MessageForm;
