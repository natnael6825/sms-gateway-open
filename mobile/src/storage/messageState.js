import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_MESSAGE_KEY = 'sms-gateway.pending-message';
const LAST_SENT_MESSAGE_KEY = 'sms-gateway.last-sent-message';
const SENT_LOG_KEY = 'sms-gateway.sent-log';
const HISTORY_KEY = 'sms-gateway.history';
const MAX_HISTORY = 100;

function parseJson(value, fallback) {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function startOfToday(now = Date.now()) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

async function readSentLog() {
  const raw = await AsyncStorage.getItem(SENT_LOG_KEY);
  const values = parseJson(raw, []);
  if (!Array.isArray(values)) return [];
  return values.filter(v => Number.isFinite(v));
}

async function writeSentLog(values) {
  await AsyncStorage.setItem(SENT_LOG_KEY, JSON.stringify(values));
}

export async function savePendingMessage(message) {
  await AsyncStorage.setItem(PENDING_MESSAGE_KEY, JSON.stringify(message));
}

export async function loadPendingMessage() {
  const raw = await AsyncStorage.getItem(PENDING_MESSAGE_KEY);
  return parseJson(raw, null);
}

export async function clearPendingMessage() {
  await AsyncStorage.removeItem(PENDING_MESSAGE_KEY);
}

export async function saveLastSentMessage(message) {
  await AsyncStorage.setItem(LAST_SENT_MESSAGE_KEY, JSON.stringify(message));
}

export async function loadLastSentMessage() {
  const raw = await AsyncStorage.getItem(LAST_SENT_MESSAGE_KEY);
  return parseJson(raw, null);
}

export async function getSentTodayCount(now = Date.now()) {
  const threshold = startOfToday(now);
  const log = await readSentLog();
  const recentLog = log.filter(t => t >= threshold);
  if (recentLog.length !== log.length) await writeSentLog(recentLog);
  return recentLog.length;
}

export async function recordSentMessage(message, now = Date.now()) {
  const threshold = startOfToday(now);
  const log = await readSentLog();
  const recentLog = log.filter(t => t >= threshold);
  recentLog.push(now);

  const record = { ...message, status: 'sent', sent_at: new Date(now).toISOString() };
  await Promise.all([
    writeSentLog(recentLog),
    saveLastSentMessage(record),
    addToHistory(record),
  ]);
  return recentLog.length;
}

export async function addToHistory(entry) {
  const raw = await AsyncStorage.getItem(HISTORY_KEY);
  const history = parseJson(raw, []);
  history.unshift(entry);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}

export async function loadHistory() {
  const raw = await AsyncStorage.getItem(HISTORY_KEY);
  return parseJson(raw, []);
}
