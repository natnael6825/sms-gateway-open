import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_API_BASE_URL } from '../../config';
import { savePendingMessage } from '../storage/messageState';

/**
 * Polls GET /api/messages/pending every 5 seconds.
 * Only calls onUnauthorized when the pending endpoint returns 401
 * (device token revoked / expired). Analytics is not polled here —
 * that requires user JWT and is a web-dashboard concern.
 */
export function usePoller({ paused = false, deviceToken = null, backendUrl = DEFAULT_API_BASE_URL, onUnauthorized = null } = {}) {
  const [currentMessage, setCurrentMessage] = useState(null);
  const [pollingError, setPollingError] = useState(false);

  const pollNow = useCallback(async () => {
    if (paused) return null;

    const headers = {};
    if (deviceToken) headers['X-Device-Token'] = deviceToken;

    try {
      const response = await fetch(backendUrl + '/api/messages/pending', { headers });

      if (response.status === 401) {
        onUnauthorized?.();
        return null;
      }

      if (!response.ok) {
        setPollingError(true);
        return null;
      }

      const message = await response.json();

      if (message !== null) {
        await savePendingMessage(message);
        setCurrentMessage(message);
      }

      setPollingError(false);
      return message;
    } catch {
      setPollingError(true);
      return null;
    }
  }, [paused, deviceToken, backendUrl, onUnauthorized]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => void pollNow(), 5000);
    return () => clearInterval(id);
  }, [paused, pollNow]);

  return {
    currentMessage,
    setCurrentMessage,
    pollingError,
    setPollingError,
    pollNow,
    // kept for API compatibility
    queuedCount: 0,
    failedCount: 0,
    failedMessages: [],
  };
}
