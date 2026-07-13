import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import MessageTable from '../MessageTable';

/**
 * Unit tests for MessageTable status background colors.
 * Validates: Requirements 4.4
 */

const makeMessage = (status) => [
  {
    id: 1,
    phone_number: '+15551234567',
    message_text: 'Test message',
    status,
    created_at: new Date('2024-01-01T00:00:00.000Z'),
  },
];

describe('MessageTable - status background colors', () => {
  it('renders yellow background for pending status', () => {
    const { container } = render(<MessageTable messages={makeMessage('pending')} />);
    const statusCell = container.querySelector('td[data-testid="status-cell"]');
    expect(statusCell).not.toBeNull();
    expect(statusCell.style.backgroundColor).toBe('yellow');
  });

  it('renders green background for sent status', () => {
    const { container } = render(<MessageTable messages={makeMessage('sent')} />);
    const statusCell = container.querySelector('td[data-testid="status-cell"]');
    expect(statusCell).not.toBeNull();
    expect(statusCell.style.backgroundColor).toBe('green');
  });

  it('renders red background for failed status', () => {
    const { container } = render(<MessageTable messages={makeMessage('failed')} />);
    const statusCell = container.querySelector('td[data-testid="status-cell"]');
    expect(statusCell).not.toBeNull();
    expect(statusCell.style.backgroundColor).toBe('red');
  });
});
