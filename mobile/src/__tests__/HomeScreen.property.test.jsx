import React from 'react';
import { render } from '@testing-library/react-native';
import * as fc from 'fast-check';
import HomeScreen from '../screens/HomeScreen';

const STATUS_LABEL = {
  connected: 'Connected',
  connecting: 'Connecting…',
  disconnected: 'Disconnected',
  offline: 'Offline',
};

describe('HomeScreen property tests', () => {
  test('renders every sent count and connection state supplied by the app', () => {
    fc.assert(
      fc.property(
        fc.nat(10000),
        fc.constantFrom('connected', 'connecting', 'disconnected', 'offline'),
        (sentTodayCount, connectionStatus) => {
          const gatewayOnline = connectionStatus !== 'offline';
          const view = render(
            <HomeScreen
              connectionStatus={connectionStatus}
              sentTodayCount={sentTodayCount}
              gatewayOnline={gatewayOnline}
            />
          );

          expect(view.getByText(String(sentTodayCount))).toBeTruthy();
          expect(view.getByText('Sent Today')).toBeTruthy();
          expect(view.getByText(STATUS_LABEL[connectionStatus])).toBeTruthy();
          expect(view.getByText(gatewayOnline ? 'Go offline' : 'Go online')).toBeTruthy();

          view.unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});
