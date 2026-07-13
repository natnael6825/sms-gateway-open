import React from 'react';
import { act, render } from '@testing-library/react-native';
import { usePoller } from '../hooks/usePoller';

jest.mock('../storage/messageState', () => ({
  savePendingMessage: jest.fn().mockResolvedValue(undefined),
}));

function PollerHarness({ stateRef, paused = false, deviceToken = null, onUnauthorized = null }) {
  const hookResult = usePoller({ paused, deviceToken, onUnauthorized });
  stateRef.current = hookResult;
  return null;
}

beforeEach(() => {
  jest.useFakeTimers();
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.useRealTimers();
  jest.resetAllMocks();
});

describe('usePoller', () => {
  test('starts polling on mount and calls the pending API at 5-second intervals', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => null,
    });

    const stateRef = { current: null };

    render(<PollerHarness stateRef={stateRef} />);

    expect(global.fetch).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    // Both pending and analytics polls fire at 5s
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/messages/pending'),
      expect.any(Object)
    );

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    // 2 pending + 2 analytics = 4 total calls after 10s
    const pendingCalls = global.fetch.mock.calls.filter(([url]) =>
      url.includes('/api/messages/pending')
    );
    expect(pendingCalls).toHaveLength(2);
  });

  test('sets pollingError to true on network failure', async () => {
    global.fetch.mockRejectedValue(new Error('Network Error'));

    const stateRef = { current: null };

    render(<PollerHarness stateRef={stateRef} />);

    expect(stateRef.current.pollingError).toBe(false);

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(stateRef.current.pollingError).toBe(true);
  });

  test('sets pollingError to true on non-ok HTTP response', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    const stateRef = { current: null };

    render(<PollerHarness stateRef={stateRef} />);

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(stateRef.current.pollingError).toBe(true);
  });

  test('sets currentMessage when a pending message is received', async () => {
    const pendingMessage = {
      id: 42,
      phone_number: '+15551234567',
      message_text: 'Hello!',
      status: 'pending',
    };

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => pendingMessage,
    });

    const stateRef = { current: null };

    render(<PollerHarness stateRef={stateRef} />);

    expect(stateRef.current.currentMessage).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(stateRef.current.currentMessage).toEqual(pendingMessage);
  });

  test('does not poll while paused', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => null,
    });

    const stateRef = { current: null };

    render(<PollerHarness stateRef={stateRef} paused={true} />);

    await act(async () => {
      jest.advanceTimersByTime(15000);
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('includes X-Device-Token header when deviceToken is provided', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => null,
    });

    const stateRef = { current: null };

    render(<PollerHarness stateRef={stateRef} deviceToken="my-device-token" />);

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    const pendingCall = global.fetch.mock.calls.find(([url]) =>
      url.includes('/api/messages/pending')
    );
    expect(pendingCall).toBeDefined();
    expect(pendingCall[1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Device-Token': 'my-device-token' }),
      })
    );
  });

  test('calls onUnauthorized on 401 response', async () => {
    const onUnauthorized = jest.fn();
    global.fetch.mockResolvedValue({
      ok: false,
      status: 401,
    });

    const stateRef = { current: null };

    render(<PollerHarness stateRef={stateRef} deviceToken="token" onUnauthorized={onUnauthorized} />);

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(onUnauthorized).toHaveBeenCalled();
  });

  test('returns null on 401 response', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 401,
    });

    const stateRef = { current: null };

    render(<PollerHarness stateRef={stateRef} deviceToken="token" />);

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    // currentMessage should remain null after a 401
    expect(stateRef.current.currentMessage).toBeNull();
  });
});
