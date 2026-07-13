import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ApiKeySection from '../ApiKeySection';

vi.mock('../../api/client', () => ({
  default: {},
  getApiKey: vi.fn(),
  regenerateApiKey: vi.fn(),
  generatePairingCode: vi.fn(),
  resetDeviceKey: vi.fn(),
}));

import { getApiKey, regenerateApiKey } from '../../api/client';

describe('ApiKeySection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders masked key after loading', async () => {
    getApiKey.mockResolvedValue({ masked_key: 'sms_a1b2c3d4...' });

    render(<ApiKeySection />);

    await waitFor(() => {
      expect(screen.getByText('sms_a1b2c3d4...')).toBeInTheDocument();
    });

    const codeEl = screen.getByText('sms_a1b2c3d4...');
    expect(codeEl.tagName.toLowerCase()).toBe('code');
  });

  it('copy button is present after loading', async () => {
    getApiKey.mockResolvedValue({ masked_key: 'sms_a1b2c3d4...' });

    render(<ApiKeySection />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
    });
  });

  it('regenerate button calls regenerateApiKey', async () => {
    getApiKey.mockResolvedValue({ masked_key: 'sms_a1b2c3d4...' });
    regenerateApiKey.mockResolvedValue({
      key: 'sms_newkey1234567890abcdef12345678',
      masked_key: 'sms_newkey12...',
    });

    render(<ApiKeySection />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /regenerate/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /regenerate/i }));

    await waitFor(() => {
      expect(regenerateApiKey).toHaveBeenCalledTimes(1);
    });
  });

  it('shows new plaintext key after regeneration with warning', async () => {
    getApiKey.mockResolvedValue({ masked_key: 'sms_a1b2c3d4...' });
    regenerateApiKey.mockResolvedValue({
      key: 'sms_newkey1234567890abcdef12345678',
      masked_key: 'sms_newkey12...',
    });

    render(<ApiKeySection />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /regenerate/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /regenerate/i }));

    await waitFor(() => {
      expect(screen.getByText('sms_newkey1234567890abcdef12345678')).toBeInTheDocument();
      expect(screen.getByText(/this key will not be shown again/i)).toBeInTheDocument();
    });
  });

  it('shows error state when getApiKey fails', async () => {
    getApiKey.mockRejectedValue(new Error('Network error'));

    render(<ApiKeySection />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load api key/i)).toBeInTheDocument();
    });
  });
});
