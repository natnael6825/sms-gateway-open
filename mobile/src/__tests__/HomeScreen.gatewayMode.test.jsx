import React from 'react';
import { render } from '@testing-library/react-native';
import HomeScreen from '../screens/HomeScreen';

describe('HomeScreen gateway mode', () => {
  test('explains that the persistent notification runs only while online', () => {
    const { getByText } = render(<HomeScreen gatewayOnline />);

    expect(getByText(/persistent notification keeps this phone active/i)).toBeTruthy();
  });

  test('confirms that the service and notification stop while offline', () => {
    const { getByText, queryByText } = render(
      <HomeScreen gatewayOnline={false} connectionStatus="offline" />
    );

    expect(getByText(/background service and its persistent notification are stopped/i)).toBeTruthy();
    expect(queryByText(/persistent notification keeps this phone active/i)).toBeNull();
  });
});
