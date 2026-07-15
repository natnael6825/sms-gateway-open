import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import HomeScreen from '../screens/HomeScreen';

describe('HomeScreen', () => {
  test.each([
    ['connected', 'Connected', 'Polling every 5 seconds. Messages send automatically.'],
    ['connecting', 'Connecting…', 'Establishing connection to server…'],
    ['disconnected', 'Disconnected', 'Retrying every 10 seconds…'],
    ['offline', 'Offline', 'Gateway paused. This phone will not claim or send messages.'],
  ])('renders the current %s connection state', (status, label, explanation) => {
    const { getByText } = render(
      <HomeScreen
        connectionStatus={status}
        gatewayOnline={status !== 'offline'}
      />
    );

    expect(getByText(label)).toBeTruthy();
    expect(getByText(explanation)).toBeTruthy();
  });

  test('displays the most recently sent message', () => {
    const lastMessage = {
      phone_number: '+15551234567',
      message_text: 'Hello world',
      sent_at: '2026-07-15T08:00:00.000Z',
    };

    const { getByText } = render(<HomeScreen lastMessage={lastMessage} />);

    expect(getByText('+15551234567')).toBeTruthy();
    expect(getByText('Hello world')).toBeTruthy();
  });

  test('displays an empty state before any message has been sent', () => {
    const { getByText } = render(<HomeScreen lastMessage={null} />);

    expect(getByText('No messages sent yet')).toBeTruthy();
  });

  test.each([0, 7, 1234])('displays a sent-today count of %s', (count) => {
    const { getByText } = render(<HomeScreen sentTodayCount={count} />);

    expect(getByText(String(count))).toBeTruthy();
    expect(getByText('Sent Today')).toBeTruthy();
  });

  test('calls the gateway mode handler from the visible action', () => {
    const onToggleGateway = jest.fn();
    const { getByText } = render(
      <HomeScreen gatewayOnline onToggleGateway={onToggleGateway} />
    );

    fireEvent.press(getByText('Go offline'));

    expect(onToggleGateway).toHaveBeenCalledTimes(1);
  });
});
