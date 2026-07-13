import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PairingCodeSection from '../PairingCodeSection';

vi.mock('../../api/client', () => ({
  default: {},
  getApiKey: vi.fn(),
  regenerateApiKey: vi.fn(),
  generatePairingCode: vi.fn(),
  resetDeviceKey: vi.fn(),
}));

import { generatePairingCode, resetDeviceKey } from '../../api/client';

describe('PairingCodeSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the permanent device key after loading', async () => {
    generatePairingCode.mockResolvedValue({ code: 'ABC1234' });

    render(<PairingCodeSection />);

    await waitFor(() => {
      expect(screen.getByTestId('device-key')).toBeInTheDocument();
      expect(screen.getByTestId('device-key')).toHaveTextContent('ABC1234');
    });
  });

  it('shows the same key on subsequent loads (permanent key)', async () => {
    generatePairingCode.mockResolvedValue({ code: 'XYZ7890' });

    render(<PairingCodeSection />);

    await waitFor(() => {
      expect(screen.getByTestId('device-key')).toHaveTextContent('XYZ7890');
    });

    // No countdown or expiry indicator
    expect(screen.queryByTestId('countdown')).not.toBeInTheDocument();
    expect(screen.queryByText(/expired/i)).not.toBeInTheDocument();
  });

  it('reset key button calls resetDeviceKey and shows new key', async () => {
    generatePairingCode.mockResolvedValue({ code: 'OLD1234' });
    resetDeviceKey.mockResolvedValue({ code: 'NEW5678' });

    render(<PairingCodeSection />);

    await waitFor(() => {
      expect(screen.getByTestId('device-key')).toHaveTextContent('OLD1234');
    });

    fireEvent.click(screen.getByRole('button', { name: /reset key/i }));

    await waitFor(() => {
      expect(resetDeviceKey).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('device-key')).toHaveTextContent('NEW5678');
    });
  });

  it('shows warning after reset that previously paired phones need to re-pair', async () => {
    generatePairingCode.mockResolvedValue({ code: 'OLD1234' });
    resetDeviceKey.mockResolvedValue({ code: 'NEW5678' });

    render(<PairingCodeSection />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reset key/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /reset key/i }));

    await waitFor(() => {
      expect(screen.getByText(/previously paired phones will need to re-pair/i)).toBeInTheDocument();
    });
  });

  it('shows error state when loading fails', async () => {
    generatePairingCode.mockRejectedValue(new Error('Network error'));

    render(<PairingCodeSection />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load device key/i)).toBeInTheDocument();
    });
  });
});
