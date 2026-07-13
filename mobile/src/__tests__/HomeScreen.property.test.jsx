// Feature: sms-gateway-v2, Property 17: HomeScreen renders all stats correctly
import React from 'react';
import { render } from '@testing-library/react-native';
import * as fc from 'fast-check';
import HomeScreen from '../screens/HomeScreen';

/**
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4
 *
 * Property 17: For any combination of queuedCount, failedCount, sentTodayCount,
 * and connectionStatus values, the HomeScreen component SHALL render each value
 * with its correct label and the connection indicator SHALL display the correct
 * label and colour for the given status.
 */

describe('HomeScreen property tests', () => {
  test('Property 17: renders all stats correctly for any combination of values', () => {
    fc.assert(
      fc.property(
        fc.nat(10000),           // queuedCount
        fc.nat(10000),           // failedCount
        fc.nat(10000),           // sentTodayCount
        fc.constantFrom('connected', 'connecting', 'disconnected'), // connectionStatus
        (queuedCount, failedCount, sentTodayCount, connectionStatus) => {
          const { getByTestId } = render(
            <HomeScreen
              connectionStatus={connectionStatus}
              queuedCount={queuedCount}
              failedCount={failedCount}
              sentTodayCount={sentTodayCount}
            />
          );

          // Queued count is rendered
          const queuedEl = getByTestId('queued-count');
          expect(queuedEl).toBeTruthy();
          const queuedText = queuedEl.props.children;
          expect(String(queuedText).replace(/,/g, '')).toContain(String(queuedCount));

          // Failed count is rendered
          const failedEl = getByTestId('failed-count');
          expect(failedEl).toBeTruthy();
          const failedText = failedEl.props.children;
          expect(String(failedText).replace(/,/g, '')).toContain(String(failedCount));

          // Sent today count is rendered
          const sentEl = getByTestId('sent-today-count');
          expect(sentEl).toBeTruthy();
          const sentText = sentEl.props.children;
          expect(String(sentText).replace(/,/g, '')).toContain(String(sentTodayCount));

          // Connection status indicator is rendered with correct label
          const statusEl = getByTestId('connection-status');
          expect(statusEl).toBeTruthy();
          const expectedLabel =
            connectionStatus === 'connected'
              ? 'Connected'
              : connectionStatus === 'connecting'
                ? 'Connecting'
                : 'Disconnected';
          expect(statusEl.props.children).toBe(expectedLabel);
        }
      ),
      { numRuns: 100 }
    );
  });
});
