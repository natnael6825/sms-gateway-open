import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState, PermissionsAndroid, Platform } from 'react-native';
import PermissionGate from '../components/PermissionGate';

describe('PermissionGate', () => {
  let appStateHandler;
  let removeListener;
  let originalOs;
  let originalVersion;

  beforeEach(() => {
    originalOs = Platform.OS;
    originalVersion = Platform.Version;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    Object.defineProperty(Platform, 'Version', { configurable: true, value: 34 });

    removeListener = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
      appStateHandler = handler;
      return { remove: removeListener };
    });
    jest.spyOn(PermissionsAndroid, 'check');
    jest.spyOn(PermissionsAndroid, 'request');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOs });
    Object.defineProperty(Platform, 'Version', { configurable: true, value: originalVersion });
  });

  test('stays on Open App Settings without requesting again when permission is still blocked', async () => {
    PermissionsAndroid.check.mockResolvedValue(false);
    PermissionsAndroid.request.mockResolvedValue(PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN);

    const { getByText, queryByText } = render(
      <PermissionGate><TextContent /></PermissionGate>
    );

    await waitFor(() => expect(getByText('Open App Settings')).toBeTruthy());

    await act(async () => {
      appStateHandler('background');
      appStateHandler('active');
    });

    await waitFor(() => expect(getByText('Open App Settings')).toBeTruthy());
    expect(queryByText('Checking permissions\u2026')).toBeNull();
    expect(PermissionsAndroid.request).toHaveBeenCalledTimes(1);
  });

  test('shows the app after required permissions are enabled in Settings', async () => {
    PermissionsAndroid.check.mockResolvedValue(false);
    PermissionsAndroid.request.mockResolvedValue(PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN);

    const { getByText } = render(
      <PermissionGate><TextContent /></PermissionGate>
    );

    await waitFor(() => expect(getByText('Open App Settings')).toBeTruthy());
    PermissionsAndroid.check.mockResolvedValue(true);

    await act(async () => {
      appStateHandler('background');
      appStateHandler('active');
    });

    await waitFor(() => expect(getByText('Gateway content')).toBeTruthy());
    expect(PermissionsAndroid.request).toHaveBeenCalledTimes(1);
  });

  test('can request notification permission after SMS is enabled in Settings', async () => {
    let afterSettings = false;
    PermissionsAndroid.check.mockImplementation(async (permission) => {
      if (!afterSettings) return false;
      return permission === PermissionsAndroid.PERMISSIONS.SEND_SMS;
    });
    PermissionsAndroid.request
      .mockResolvedValueOnce(PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN)
      .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);

    const view = render(
      <PermissionGate><TextContent /></PermissionGate>
    );

    await waitFor(() => expect(view.getByText('Open App Settings')).toBeTruthy());
    afterSettings = true;

    await act(async () => {
      appStateHandler('background');
      appStateHandler('active');
    });

    await waitFor(() => expect(view.getByText('Grant Permissions')).toBeTruthy());

    await act(async () => {
      fireEvent.press(view.getByText('Grant Permissions'));
    });

    await waitFor(() => expect(view.getByText('Gateway content')).toBeTruthy());
    expect(PermissionsAndroid.request).toHaveBeenCalledTimes(2);
    expect(PermissionsAndroid.request).toHaveBeenLastCalledWith(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      expect.any(Object)
    );
  });

  test('replays an app-active refresh that occurs during another permission check', async () => {
    PermissionsAndroid.check.mockResolvedValue(false);
    PermissionsAndroid.request.mockResolvedValue(PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN);

    const view = render(
      <PermissionGate><TextContent /></PermissionGate>
    );

    await waitFor(() => expect(view.getByText('Open App Settings')).toBeTruthy());

    let resolveFirstRefresh;
    PermissionsAndroid.check
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveFirstRefresh = resolve;
      }))
      .mockResolvedValue(true);

    await act(async () => {
      appStateHandler('background');
      appStateHandler('active');
    });
    await waitFor(() => expect(resolveFirstRefresh).toBeDefined());

    await act(async () => {
      appStateHandler('background');
      appStateHandler('active');
      resolveFirstRefresh(false);
    });

    await waitFor(() => expect(view.getByText('Gateway content')).toBeTruthy());
    expect(PermissionsAndroid.request).toHaveBeenCalledTimes(1);
  });

  test('removes the AppState listener when it unmounts', async () => {
    PermissionsAndroid.check.mockResolvedValue(true);

    const view = render(
      <PermissionGate><TextContent /></PermissionGate>
    );

    await waitFor(() => expect(view.getByText('Gateway content')).toBeTruthy());
    view.unmount();

    expect(removeListener).toHaveBeenCalledTimes(1);
  });
});

function TextContent() {
  const { Text } = require('react-native');
  return <Text>Gateway content</Text>;
}
