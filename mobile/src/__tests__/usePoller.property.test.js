import React from 'react';
import { act, render } from '@testing-library/react-native';
import * as fc from 'fast-check';
import { usePoller } from '../hooks/usePoller';

jest.mock('../storage/messageState', () => ({
  savePendingMessage: jest.fn().mockResolvedValue(undefined),
}));

function PollerHarness({ stateRef }) {
  const hookResult = usePoller();
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

describe('usePoller property tests', () => {
  test('continues polling after any network error', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant(new Error('Network Error')),
          fc.constant({ status: 500 })
        ),
        async (errorScenario) => {
          global.fetch.mockReset();

          if (errorScenario instanceof Error) {
            global.fetch.mockRejectedValue(errorScenario);
          } else {
            global.fetch.mockResolvedValue({
              ok: false,
              status: errorScenario.status,
            });
          }

          const stateRef = { current: null };
          const { unmount } = render(<PollerHarness stateRef={stateRef} />);

          expect(stateRef.current.pollingError).toBe(false);

          await act(async () => {
            jest.advanceTimersByTime(5000);
          });

          expect(stateRef.current.pollingError).toBe(true);

          await act(async () => {
            jest.advanceTimersByTime(5000);
          });

          // Both pending and analytics polls fire — at least 2 pending calls after 10s
          const pendingCalls = global.fetch.mock.calls.filter(([url]) =>
            url.includes('/api/messages/pending')
          );
          expect(pendingCalls.length).toBeGreaterThanOrEqual(2);
          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});
