import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_TOKEN_KEY = 'sms-gateway.device-token';

export async function saveDeviceToken(token) {
  await AsyncStorage.setItem(DEVICE_TOKEN_KEY, token);
}

export async function loadDeviceToken() {
  const value = await AsyncStorage.getItem(DEVICE_TOKEN_KEY);
  return value ?? null;
}

export async function clearDeviceToken() {
  await AsyncStorage.removeItem(DEVICE_TOKEN_KEY);
}
