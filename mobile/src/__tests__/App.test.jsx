import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import App from '../App';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock storage modules
jest.mock('../storage/deviceToken', () => ({
  loadDeviceToken: jest.fn(),
  saveDeviceToken: jest.fn().mockResolvedValue(undefined),
  clearDeviceToken: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../storage/backendUrl', () => ({
  loadBackendUrl: jest.fn().mockResolvedValue('https://sms.example.com'),
  clearBackendUrl: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../storage/messageState', () => ({
  loadPendingMessage: jest.fn().mockResolvedValue(null),
  loadLastSentMessage: jest.fn().mockResolvedValue(null),
  getSentTodayCount: jest.fn().mockResolvedValue(0),
  savePendingMessage: jest.fn().mockResolvedValue(undefined),
  clearPendingMessage: jest.fn().mockResolvedValue(undefined),
  recordSentMessage: jest.fn().mockResolvedValue(1),
}));

// Mock expo modules
jest.mock('expo-background-fetch', () => ({
  registerTaskAsync: jest.fn().mockResolvedValue(undefined),
  BackgroundFetchResult: { NewData: 'newData', NoData: 'noData', Failed: 'failed' },
}));

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
}));

const { loadDeviceToken, clearDeviceToken } = require('../storage/deviceToken');
const { loadPendingMessage } = require('../storage/messageState');

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => null,
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.resetAllMocks();
});

describe('App', () => {
  test('shows PairingScreen when no device token is stored', async () => {
    loadDeviceToken.mockResolvedValue(null);

    const { getByTestId } = render(<App />);

    await waitFor(() => {
      expect(getByTestId('pairing-code-input')).toBeTruthy();
      expect(getByTestId('connect-button')).toBeTruthy();
    });
  });

  test('shows HomeScreen when device token exists', async () => {
    loadDeviceToken.mockResolvedValue('existing-device-token');

    const { getByTestId } = render(<App />);

    await waitFor(() => {
      expect(getByTestId('connection-status')).toBeTruthy();
    });
  });

  test('calls webhook after dispatch with X-Device-Token header', async () => {
    loadDeviceToken.mockResolvedValue('my-device-token');

    // Simulate a pending message already in storage (bypasses polling interval)
    loadPendingMessage.mockResolvedValue({
      id: 99,
      phone_number: '+15551234567',
      message_text: 'Test SMS',
      status: 'pending',
    });

    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => null,
    });

    render(<App />);

    // Wait for the webhook call to happen (dispatch runs after hydration)
    await waitFor(() => {
      const webhookCall = global.fetch.mock.calls.find(
        ([url]) => url && url.includes('/api/webhook/')
      );
      expect(webhookCall).toBeDefined();
      expect(webhookCall[1]).toEqual(
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'X-Device-Token': 'my-device-token' }),
        })
      );
    }, { timeout: 5000 });
  });

  test('clears token and shows PairingScreen on 401 response', async () => {
    // Use real timers for this test so polling intervals fire naturally
    jest.useRealTimers();

    loadDeviceToken.mockResolvedValue('expired-token');

    // Return 401 on all fetch calls
    global.fetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    });

    render(<App />);

    await waitFor(() => {
      expect(clearDeviceToken).toHaveBeenCalled();
    }, { timeout: 10000 });
  });
});
