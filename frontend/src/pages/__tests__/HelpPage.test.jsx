import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import HelpPage from '../HelpPage';

describe('HelpPage ADB connection guide', () => {
  test('stays focused on connecting ADB, increasing the SMS limit, and connection problems', () => {
    const { container } = render(<HelpPage />);

    expect(screen.getByRole('heading', { name: 'Increase Android’s SMS limit with ADB' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Connect the phone with ADB' })).toBeInTheDocument();
    expect(screen.getByText('Build number').closest('li')).toHaveTextContent(/seven times/i);
    expect(screen.getByRole('heading', { name: 'Increase and verify the SMS limit' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fix common connection problems' })).toBeInTheDocument();
    expect(container.querySelectorAll('.adb-runbook-step')).toHaveLength(3);
    expect(screen.getByText(/The important word is/i)).toHaveTextContent('device');
    expect(screen.getByText(/\$ADB_VENDOR_KEYS/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Auto Blocker/i })).toHaveAttribute('href', expect.stringContaining('samsung.com'));
    expect(screen.getByText(/Still unauthorized\? Reset this computer’s ADB key/i)).toBeInTheDocument();
    expect(screen.getByText(/del "%USERPROFILE%\\\.android\\adbkey"/i)).toBeInTheDocument();

    const authorizationNote = screen.getByRole('note', { name: 'USB debugging authorization' });
    expect(within(authorizationNote).getByText(/Always allow from this computer/i)).toBeInTheDocument();
    expect(within(authorizationNote).getByText(/Tap “Allow”/i)).toBeInTheDocument();
    expect(screen.getByText(/sms_outgoing_check_max_count 1000/i)).toBeInTheDocument();
    expect(screen.getByText('adb reboot')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Test the connection' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Wireless debugging/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/SignalDesk_ADB_OK/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/android.permission.SEND_SMS/i)).not.toBeInTheDocument();
  });
});
