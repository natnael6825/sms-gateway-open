// Feature: sms-gateway-v2, Property 14: Failed messages list shows at most 10
import React from 'react';
import { render } from '@testing-library/react-native';
import * as fc from 'fast-check';
import FailedMessagesList from '../components/FailedMessagesList';

/**
 * Validates: Requirements 6.2
 *
 * Property 14: For any array of failed messages (including arrays with more than
 * 10 elements), the FailedMessagesList component SHALL render at most 10 items.
 */

function makeMessage(id) {
  return {
    id,
    phone_number: `+1555000${String(id).padStart(4, '0')}`,
    message_text: `Message ${id}`,
  };
}

describe('FailedMessagesList property tests', () => {
  test('Property 14: renders at most 10 items for any array length', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50 }),
        (count) => {
          const messages = Array.from({ length: count }, (_, i) => makeMessage(i + 1));

          const { queryAllByTestId } = render(
            <FailedMessagesList messages={messages} onRetry={jest.fn()} />
          );

          // Count rendered retry buttons as a proxy for rendered items
          const retryButtons = queryAllByTestId(/^retry-button-/);
          const expectedCount = Math.min(count, 10);
          expect(retryButtons).toHaveLength(expectedCount);
        }
      ),
      { numRuns: 100 }
    );
  });
});
