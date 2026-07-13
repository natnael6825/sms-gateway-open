import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Upgrade from '../Upgrade';

describe('Upgrade page', () => {
  it('renders without crashing', () => {
    render(<Upgrade />);
  });

  it('displays "Coming Soon" text', () => {
    render(<Upgrade />);
    // Multiple "Coming Soon" occurrences are expected (heading, cards, button)
    const elements = screen.getAllByText(/coming soon/i);
    expect(elements.length).toBeGreaterThan(0);
  });

  it('displays the free-tier limit of 100 messages/day', () => {
    render(<Upgrade />);
    expect(screen.getByText(/100/)).toBeTruthy();
  });
});
