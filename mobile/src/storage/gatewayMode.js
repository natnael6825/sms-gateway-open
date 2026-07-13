import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@sms_gateway_online';

export async function loadGatewayOnline() {
  return (await AsyncStorage.getItem(KEY)) !== 'false';
}

export async function saveGatewayOnline(online) {
  await AsyncStorage.setItem(KEY, online ? 'true' : 'false');
}
