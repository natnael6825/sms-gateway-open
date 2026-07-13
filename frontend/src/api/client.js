import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// Messages
export async function getMessages() {
  const res = await client.get('/api/messages');
  return res.data;
}

export async function sendMessage(phone_number, message_text) {
  const res = await client.post('/api/messages', { phone_number, message_text });
  return res.data;
}

// Analytics
export async function getAnalyticsSummary() {
  const res = await client.get('/api/analytics/summary');
  return res.data;
}

// API Keys
export async function getApiKeys() {
  const res = await client.get('/api/user/api-keys');
  return res.data;
}

export async function getApiKeyDetails(id) {
  const res = await client.get(`/api/user/api-keys/${id}`);
  return res.data;
}

export async function createApiKey(name) {
  const res = await client.post('/api/user/api-keys', { name });
  return res.data;
}

// Backward-compatible exports for legacy components; new screens use the
// multi-key functions above.
export async function getApiKey() {
  const keys = await getApiKeys();
  return { masked: keys[0]?.key_hint || 'No API key' };
}

export async function regenerateApiKey() {
  return createApiKey('API key');
}

// Device key (pairing code)
export async function getPairingCode() {
  const res = await client.get('/api/user/pairing-code');
  return res.data;
}

export async function resetDeviceKey(confirmation, acknowledged) {
  const res = await client.post('/api/user/device-key/reset', { confirmation, acknowledged });
  return res.data;
}

// Devices
export async function getDevices() {
  const res = await client.get('/api/device/list');
  return res.data;
}

export async function getDeviceDetails(id) {
  const res = await client.get(`/api/device/${id}`);
  return res.data;
}

export async function removeDevice(id) {
  const res = await client.delete(`/api/device/${id}`);
  return res.data;
}

// Profile
export async function getProfile() {
  const res = await client.get('/api/user/profile');
  return res.data;
}

export async function updatePassword(currentPassword, newPassword) {
  const res = await client.post('/api/user/change-password', { currentPassword, newPassword });
  return res.data;
}

export default client;
