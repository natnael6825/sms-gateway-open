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
export function normalizeMessagesResponse(data, { page = 1, pageSize = 10, status = 'all' } = {}) {
  const requestedPage = Number.isInteger(Number(page)) && Number(page) > 0 ? Number(page) : 1;
  const requestedPageSize = Number.isInteger(Number(pageSize)) && Number(pageSize) > 0 ? Number(pageSize) : 10;

  // Older SignalDesk backends return the complete message array even when
  // pagination query parameters are present. Slice it locally so the current
  // dashboard remains usable during a rolling upgrade.
  if (Array.isArray(data)) {
    const filtered = status && status !== 'all'
      ? data.filter(message => message.status === status)
      : data;
    const total = filtered.length;
    const totalPages = Math.ceil(total / requestedPageSize);
    const start = (requestedPage - 1) * requestedPageSize;

    return {
      messages: filtered.slice(start, start + requestedPageSize),
      pagination: {
        page: requestedPage,
        page_size: requestedPageSize,
        total,
        total_pages: totalPages,
        has_previous: requestedPage > 1,
        has_next: requestedPage < totalPages,
      },
    };
  }

  const pagination = data?.pagination ?? {};
  const normalizedPage = Number(pagination.page) || requestedPage;
  const normalizedPageSize = Number(pagination.page_size ?? pagination.pageSize) || requestedPageSize;
  const total = Number(pagination.total) || 0;
  const totalPages = Number(pagination.total_pages ?? pagination.totalPages)
    || Math.ceil(total / normalizedPageSize);

  return {
    messages: Array.isArray(data?.messages) ? data.messages : [],
    pagination: {
      page: normalizedPage,
      page_size: normalizedPageSize,
      total,
      total_pages: totalPages,
      has_previous: pagination.has_previous ?? pagination.hasPrevious ?? normalizedPage > 1,
      has_next: pagination.has_next ?? pagination.hasNext ?? normalizedPage < totalPages,
    },
  };
}

export async function getMessages({ page = 1, pageSize = 10, status = 'all' } = {}) {
  const res = await client.get('/api/messages', {
    params: { page, page_size: pageSize, status },
  });
  return normalizeMessagesResponse(res.data, { page, pageSize, status });
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

export async function getOverviewAnalytics({ from, to, timezone_offset } = {}) {
  const params = {
    timezone_offset: timezone_offset ?? -new Date().getTimezoneOffset(),
  };
  if (from) params.from = from;
  if (to) params.to = to;

  const res = await client.get('/api/analytics/overview', { params });
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
