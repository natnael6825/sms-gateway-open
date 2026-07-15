import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { NativeModules } from 'react-native';

const mockStartService = jest.fn().mockResolvedValue(undefined);
const mockStopService = jest.fn().mockResolvedValue(undefined);
let registeredBackgroundTask;

NativeModules.SmsServiceModule = {
  startService: mockStartService,
  stopService: mockStopService,
};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

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
  addToHistory: jest.fn().mockResolvedValue(undefined),
  loadPendingMessage: jest.fn().mockResolvedValue(null),
  loadLastSentMessage: jest.fn().mockResolvedValue(null),
  getSentTodayCount: jest.fn().mockResolvedValue(0),
  savePendingMessage: jest.fn().mockResolvedValue(undefined),
  clearPendingMessage: jest.fn().mockResolvedValue(undefined),
  recordSentMessage: jest.fn().mockResolvedValue(1),
}));

jest.mock('../storage/gatewayMode', () => ({
  loadGatewayOnline: jest.fn().mockResolvedValue(true),
  saveGatewayOnline: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-background-fetch', () => ({
  unregisterTaskAsync: jest.fn().mockResolvedValue(undefined),
  BackgroundFetchResult: { NewData: 'newData', NoData: 'noData', Failed: 'failed' },
}));

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn((_name, task) => {
    registeredBackgroundTask = task;
  }),
  isTaskRegisteredAsync: jest.fn().mockResolvedValue(false),
}));

const App = require('../App').default;
const { loadDeviceToken, clearDeviceToken } = require('../storage/deviceToken');

function successfulApiResponse(url) {
  if (String(url).endsWith('/api/device/activity')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ sent_today: 0, history: [], last_sent: null }),
    });
  }

  return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
}

beforeEach(() => {
  jest.clearAllMocks();
  loadDeviceToken.mockResolvedValue(null);
  global.fetch = jest.fn(successfulApiResponse);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('App', () => {
  test('shows the pairing form when no device token is stored', async () => {
    const { getByTestId } = render(<App />);

    await waitFor(() => {
      expect(getByTestId('pairing-code-input')).toBeTruthy();
      expect(getByTestId('connect-button')).toBeTruthy();
    });
  });

  test('starts the native foreground service for a paired online device', async () => {
    loadDeviceToken.mockResolvedValue('existing-device-token');

    const { getByText } = render(<App />);

    await waitFor(() => {
      expect(getByText('SMS Gateway')).toBeTruthy();
      expect(mockStartService).toHaveBeenCalledWith(
        'https://sms.example.com',
        'existing-device-token'
      );
    });

    await waitFor(() => {
      expect(getByText('Connected')).toBeTruthy();
    });
  });

  test('keeps the Expo background task passive so only the native service dispatches', async () => {
    expect(registeredBackgroundTask).toEqual(expect.any(Function));

    await expect(registeredBackgroundTask()).resolves.toBe('noData');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('clears the pairing and returns to the pairing form on a 401 heartbeat', async () => {
    loadDeviceToken.mockResolvedValue('expired-token');
    global.fetch.mockImplementation((url) => {
      if (String(url).endsWith('/api/device/heartbeat')) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({ error: 'Unauthorized' }),
        });
      }
      return successfulApiResponse(url);
    });

    const { getByTestId } = render(<App />);

    await waitFor(() => {
      expect(clearDeviceToken).toHaveBeenCalledTimes(1);
      expect(getByTestId('pairing-code-input')).toBeTruthy();
    });
  });
});
