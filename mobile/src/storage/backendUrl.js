import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@sms_gateway_backend_url';

export function normalizeBackendUrl(value) {
  const trimmed = String(value || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('Enter a complete URL beginning with http:// or https://');
  }
  return trimmed;
}

export async function loadBackendUrl() {
  return AsyncStorage.getItem(KEY);
}

export async function saveBackendUrl(value) {
  const normalized = normalizeBackendUrl(value);
  await AsyncStorage.setItem(KEY, normalized);
  return normalized;
}

export async function clearBackendUrl() {
  await AsyncStorage.removeItem(KEY);
}
