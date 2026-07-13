import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import PairingScreen from '../screens/PairingScreen';

jest.mock('../storage/deviceToken', () => ({
  saveDeviceToken: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../storage/backendUrl', () => ({
  normalizeBackendUrl: (value) => value,
  saveBackendUrl: jest.fn().mockResolvedValue(undefined),
}));

const { saveDeviceToken } = require('../storage/deviceToken');

beforeEach(() => {
  global.fetch = jest.fn();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('PairingScreen', () => {
  test('renders input and connect button', () => {
    const { getByTestId } = render(<PairingScreen />);

    expect(getByTestId('pairing-code-input')).toBeTruthy();
    expect(getByTestId('connect-button')).toBeTruthy();
  });

  test('calls POST /api/device/pair with code on submit', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'test-token-123' }),
    });

    const { getByTestId } = render(<PairingScreen initialBackendUrl="https://sms.example.com" onPaired={jest.fn()} />);

    fireEvent.changeText(getByTestId('pairing-code-input'), 'ABC1234');

    await act(async () => {
      fireEvent.press(getByTestId('connect-button'));
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/device/pair'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: expect.stringContaining('ABC1234'),
      })
    );
  });

  test('calls onPaired with token on success', async () => {
    const onPaired = jest.fn();
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'device-token-xyz' }),
    });

    const { getByTestId } = render(<PairingScreen initialBackendUrl="https://sms.example.com" onPaired={onPaired} />);

    fireEvent.changeText(getByTestId('pairing-code-input'), 'XYZ7890');

    await act(async () => {
      fireEvent.press(getByTestId('connect-button'));
    });

    await waitFor(() => {
      expect(saveDeviceToken).toHaveBeenCalledWith('device-token-xyz');
      expect(onPaired).toHaveBeenCalledWith({ token: 'device-token-xyz', backendUrl: 'https://sms.example.com' });
    });
  });

  test('shows error message on failure', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Invalid device key' }),
    });

    const { getByTestId } = render(<PairingScreen initialBackendUrl="https://sms.example.com" />);

    fireEvent.changeText(getByTestId('pairing-code-input'), 'BADCODE');

    await act(async () => {
      fireEvent.press(getByTestId('connect-button'));
    });

    await waitFor(() => {
      expect(getByTestId('pairing-error').props.children).toBe(
        'Invalid device key'
      );
    });
  });
});
