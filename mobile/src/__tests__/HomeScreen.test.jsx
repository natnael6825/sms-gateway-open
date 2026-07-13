import React from 'react';
import { render } from '@testing-library/react-native';
import HomeScreen from '../screens/HomeScreen';

describe('HomeScreen', () => {
  describe('polling status', () => {
    test('displays active when polling is healthy', () => {
      const { getByTestId } = render(
        <HomeScreen pollingActive={true} pollingError={false} />
      );

      expect(getByTestId('polling-status').props.children).toBe('Polling: Active');
    });

    test('displays error and warning when polling fails', () => {
      const { getByTestId } = render(
        <HomeScreen pollingActive={false} pollingError={true} />
      );

      expect(getByTestId('polling-status').props.children).toBe('Polling: Error');
      expect(getByTestId('polling-warning').props.children).toBe(
        'Backend unreachable. Retrying automatically.'
      );
    });
  });

  describe('last message sent', () => {
    test('displays phone number and message text when lastMessage is provided', () => {
      const lastMessage = {
        phone_number: '+15551234567',
        message_text: 'Hello world',
      };

      const { getByTestId } = render(<HomeScreen lastMessage={lastMessage} />);

      expect(getByTestId('last-message-phone').props.children).toBe(
        '+15551234567'
      );
      expect(getByTestId('last-message-text').props.children).toBe('Hello world');
    });

    test('displays empty state when no message has been sent', () => {
      const { getByTestId } = render(<HomeScreen lastMessage={null} />);

      expect(getByTestId('no-messages').props.children).toBe(
        'No messages sent yet'
      );
    });
  });

  describe('sent today count', () => {
    test('displays the count of messages sent today', () => {
      const { getByTestId } = render(<HomeScreen sentTodayCount={7} />);

      expect(getByTestId('sent-today-count').props.children).toEqual([
        'Sent today: ',
        7,
      ]);
    });

    test('displays zero when no messages have been sent today', () => {
      const { getByTestId } = render(<HomeScreen sentTodayCount={0} />);

      expect(getByTestId('sent-today-count').props.children).toEqual([
        'Sent today: ',
        0,
      ]);
    });
  });
});
