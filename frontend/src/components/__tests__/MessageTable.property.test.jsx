// Feature: sms-gateway, Property 8: Message table renders all required fields for any message data

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import MessageTable from '../MessageTable';

/**
 * Validates: Requirements 4.3
 *
 * Property 8: Message table renders all required fields for any message data
 *
 * For any array of messages, the MessageTable component SHALL render each
 * message's phone number, message text, status, and creation date in the output.
 */
describe('MessageTable - Property 8', () => {
  it('renders all required fields for any message data', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.integer({ min: 1 }),
            // Normalize whitespace: trim and collapse internal spaces so DOM text matching works
            phone_number: fc.string({ minLength: 1 })
              .map((s) => s.trim().replace(/\s+/g, ' '))
              .filter((s) => s.length > 0),
            message_text: fc.string({ minLength: 1 })
              .map((s) => s.trim().replace(/\s+/g, ' '))
              .filter((s) => s.length > 0),
            status: fc.constantFrom('pending', 'sent', 'failed'),
            created_at: fc.date(),
          }),
          { minLength: 1 }
        ),
        (messages) => {
          const { unmount } = render(<MessageTable messages={messages} />);

          messages.forEach((message) => {
            // Phone number must be present (use getAllByText to handle duplicates)
            expect(screen.getAllByText(message.phone_number).length).toBeGreaterThan(0);

            // Message text must be present
            expect(screen.getAllByText(message.message_text).length).toBeGreaterThan(0);

            // Status must be present
            expect(screen.getAllByText(message.status).length).toBeGreaterThan(0);

            // Creation date must be present — MessageTable uses toLocaleString()
            const expectedDate = new Date(message.created_at).toLocaleString();
            expect(screen.getAllByText(expectedDate).length).toBeGreaterThan(0);
          });

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: sms-gateway-v2, Property 10: Status badge colour matches status value
describe('Property 10: Status badge colour matches status value', () => {
  it('dispatched status renders with blue background (#3b82f6)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1 }),
        (id) => {
          const messages = [{ id, phone_number: '+1', message_text: 'test', status: 'dispatched', created_at: new Date() }];
          const { unmount, container } = render(<MessageTable messages={messages} />);
          const statusCell = container.querySelector('td[data-testid="status-cell"]');
          // jsdom normalizes hex colours to rgb(); accept either form
          const bg = statusCell.style.backgroundColor;
          expect(bg === '#3b82f6' || bg === 'rgb(59, 130, 246)').toBe(true);
          unmount();
        }
      ),
      { numRuns: 50 }
    );
  });
});
