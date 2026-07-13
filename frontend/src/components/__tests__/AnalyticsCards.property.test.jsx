// Feature: sms-gateway-v2, Property 11: Analytics cards render all four counts

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import fc from 'fast-check';
import AnalyticsCards from '../AnalyticsCards';

/**
 * Validates: Requirements 5.1
 *
 * Property 11: Analytics cards render all four counts
 *
 * For any analytics summary object { pending, dispatched, sent, failed },
 * the AnalyticsCards component SHALL render all four numeric values visibly in the DOM.
 */
describe('Property 11: Analytics cards render all four counts', () => {
  it('renders all four counts for any summary object', () => {
    fc.assert(
      fc.property(
        fc.record({
          pending: fc.integer({ min: 0, max: 10000 }),
          dispatched: fc.integer({ min: 0, max: 10000 }),
          sent: fc.integer({ min: 0, max: 10000 }),
          failed: fc.integer({ min: 0, max: 10000 }),
        }),
        (summary) => {
          const { unmount } = render(<AnalyticsCards summary={summary} />);
          // Check all four counts are visible
          expect(screen.getByTestId('card-pending')).toHaveTextContent(String(summary.pending));
          expect(screen.getByTestId('card-dispatched')).toHaveTextContent(String(summary.dispatched));
          expect(screen.getByTestId('card-sent')).toHaveTextContent(String(summary.sent));
          expect(screen.getByTestId('card-failed')).toHaveTextContent(String(summary.failed));
          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});
