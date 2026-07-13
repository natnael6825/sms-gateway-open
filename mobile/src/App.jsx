import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, DrawerLayoutAndroid, NativeModules, PermissionsAndroid, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { DEFAULT_API_BASE_URL } from '../config';
import { usePoller } from './hooks/usePoller';
import HomeScreen from './screens/HomeScreen';
import HistoryScreen from './screens/HistoryScreen';
import PairingScreen from './screens/PairingScreen';
import PermissionGate from './components/PermissionGate';
import {
  addToHistory,
  clearPendingMessage,
  getSentTodayCount,
  loadLastSentMessage,
  loadPendingMessage,
  recordSentMessage,
  savePendingMessage,
} from './storage/messageState';
import {
  clearDeviceToken,
  loadDeviceToken,
} from './storage/deviceToken';
import { clearBackendUrl, loadBackendUrl } from './storage/backendUrl';
import { loadGatewayOnline, saveGatewayOnline } from './storage/gatewayMode';
import { getDeviceInfo } from './utils/deviceInfo';

const { SmsModule, SmsServiceModule } = NativeModules;
const BACKGROUND_FETCH_TASK = 'background-fetch-pending';

TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  // The native foreground service is the only SMS dispatcher. Keeping the
  // Expo task registered as a sender would allow duplicate delivery.
  return BackgroundFetch.BackgroundFetchResult.NoData;
  /* legacy implementation retained below for migration safety */
  try {
    const backendUrl = await loadBackendUrl();
    if (!backendUrl) return BackgroundFetch.BackgroundFetchResult.Failed;
    // Load device token for authenticated requests
    const token = await loadDeviceToken();

    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['X-Device-Token'] = token;
    }

    const response = await fetch(`${backendUrl}/api/messages/pending`, { headers });

    if (response.status === 401) {
      await clearDeviceToken();
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    if (!response.ok) {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    const message = await response.json();

    if (message === null) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    await savePendingMessage(message);
    console.log('[BG] got pending message', message.id);

    // Try to send SMS silently from background — no UI so use check() not request()
    let status = 'failed';
    try {
      const hasPermission = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.SEND_SMS
      );
      console.log('[BG] SEND_SMS permission:', hasPermission);

      if (hasPermission && SmsModule) {
        await SmsModule.sendSms(message.phone_number, message.message_text);
        status = 'sent';
        console.log('[BG] SMS sent successfully');
      } else {
        console.warn('[BG] no permission or SmsModule unavailable');
      }
    } catch (smsError) {
      console.error('[BG] SMS send failed:', smsError?.message ?? smsError);
    }

    // Report status back to backend via webhook
    try {
      const webhookHeaders = { 'Content-Type': 'application/json' };
      if (token) {
        webhookHeaders['X-Device-Token'] = token;
      }
      await fetch(`${backendUrl}/api/webhook/${message.id}`, {
        method: 'POST',
        headers: webhookHeaders,
        body: JSON.stringify({ status }),
      });
    } catch (webhookError) {
      console.error('[BG] webhook POST failed:', webhookError?.message ?? webhookError);
    }

    if (status === 'sent') {
      await recordSentMessage(message);
      await clearPendingMessage();
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (_error) {
    console.error('[BG] task error:', _error?.message ?? _error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

async function registerBackgroundFetch() {
  try {
    if (typeof TaskManager.isTaskRegisteredAsync !== 'function' ||
        typeof BackgroundFetch.unregisterTaskAsync !== 'function') return;
    const registered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
    if (registered) await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
  } catch (error) {
    console.warn('App: background fetch registration failed', error);
  }
}

export default function App() {
  const [backendUrl, setBackendUrl] = useState(DEFAULT_API_BASE_URL);
  const drawerRef = useRef(null);
  const [screen, setScreen] = useState('home');
  const [deviceToken, setDeviceToken] = useState(null);
  const [tokenLoaded, setTokenLoaded] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [sentTodayCount, setSentTodayCount] = useState(0);
  const [activityHistory, setActivityHistory] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [gatewayOnline, setGatewayOnline] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);
  const [appState, setAppState] = useState(
    typeof AppState.currentState === 'string' ? AppState.currentState : 'active'
  );
  const [pollingPaused, setPollingPaused] = useState(true);
  const dispatchingRef = useRef(false);

  const handleUnauthorized = useCallback(() => {
    clearDeviceToken().catch(() => {});
    setDeviceToken(null);
  }, []);

  const {
    currentMessage,
    setCurrentMessage,
    pollingError,
    setPollingError,
    pollNow,
    queuedCount,
    failedCount,
    failedMessages,
  } = usePoller({
    paused: true,
    deviceToken,
    backendUrl,
    onUnauthorized: handleUnauthorized,
  });

  useEffect(() => {
    setPollingPaused(true);
  }, [appState, currentMessage, isHydrated, deviceToken]);

  const refreshDeviceState = useCallback(async () => {
    if (!deviceToken || !backendUrl || !gatewayOnline) return false;
    const headers = { 'Content-Type': 'application/json', 'X-Device-Token': deviceToken };
    try {
      const heartbeat = await fetch(`${backendUrl}/api/device/heartbeat`, { method: 'POST', headers, body: '{}' });
      if (heartbeat.status === 401) { handleUnauthorized(); return false; }
      if (!heartbeat.ok) throw new Error(`Heartbeat HTTP ${heartbeat.status}`);
      setConnectionStatus('connected');
      const activityResponse = await fetch(`${backendUrl}/api/device/activity`, { headers });
      if (activityResponse.ok) {
        const activity = await activityResponse.json();
        setSentTodayCount(activity.sent_today || 0);
        setActivityHistory(activity.history || []);
        if (activity.last_sent) {
          setLastMessage({ ...activity.last_sent, sent_at: activity.last_sent.delivered_at });
        }
      }
      return true;
    } catch (error) {
      setConnectionStatus('disconnected');
      return false;
    }
  }, [backendUrl, deviceToken, gatewayOnline, handleUnauthorized]);

  useEffect(() => {
    if (!deviceToken || !backendUrl || !gatewayOnline) {
      if (!gatewayOnline) setConnectionStatus('offline');
      return;
    }
    setConnectionStatus('connecting');
    void refreshDeviceState();
    const timer = setInterval(() => void refreshDeviceState(), 5000);
    return () => clearInterval(timer);
  }, [backendUrl, deviceToken, gatewayOnline, refreshDeviceState]);

  useEffect(() => {
    if (!deviceToken || !backendUrl) return;
    const info = getDeviceInfo();
    fetch(`${backendUrl}/api/device/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device-Token': deviceToken },
      body: JSON.stringify(info),
    }).catch(() => {});
  }, [backendUrl, deviceToken]);

  useEffect(() => {
    void registerBackgroundFetch();
  }, []);

  // Start/restart foreground service whenever the device token changes
  useEffect(() => {
    if (!tokenLoaded) return; // wait until we know the token

    if (!SmsServiceModule) {
      console.warn('[Service] SmsServiceModule not available — native module not linked');
      return;
    }

    if (!deviceToken || !gatewayOnline) {
      // Not paired yet — stop service if running
      SmsServiceModule.stopService().catch(() => {});
      return;
    }

    if (!backendUrl) return;
    SmsServiceModule.startService(backendUrl, deviceToken)
      .then(() => console.log('[Service] foreground service started'))
      .catch((e) => console.error('[Service] failed to start:', e?.message ?? e));
  }, [deviceToken, tokenLoaded, backendUrl, gatewayOnline]);

  // Load device token and hydrate state on startup
  useEffect(() => {
    let isMounted = true;

    async function hydrateState() {
      const [token, storedBackendUrl, pendingMessage, storedLastMessage, todayCount, storedOnline] = await Promise.all([
        loadDeviceToken(),
        loadBackendUrl(),
        loadPendingMessage(),
        loadLastSentMessage(),
        getSentTodayCount(),
        loadGatewayOnline(),
      ]);

      if (!isMounted) {
        return;
      }

      setDeviceToken(token);
      setBackendUrl(storedBackendUrl || DEFAULT_API_BASE_URL);
      setTokenLoaded(true);
      setGatewayOnline(storedOnline);

      // Clear work persisted by older builds. The native service now owns all
      // claiming and sending, preventing foreground/background duplicates.
      if (pendingMessage) await clearPendingMessage();

      setLastMessage(storedLastMessage);
      setSentTodayCount(todayCount);
      setIsHydrated(true);
    }

    void hydrateState();

    const subscription = AppState.addEventListener('change', (nextState) => {
      setAppState(nextState);
    });

    return () => {
      isMounted = false;
      subscription?.remove?.();
    };
  }, [setCurrentMessage]);

  useEffect(() => {
    if (!isHydrated || appState !== 'active' || currentMessage !== null) {
      return;
    }

    let cancelled = false;

    async function syncPendingWork() {
      const pendingMessage = await loadPendingMessage();

      if (cancelled) {
        return;
      }

      if (pendingMessage) {
        setCurrentMessage((existing) => existing ?? pendingMessage);
        return;
      }

      await pollNow();

      if (cancelled) {
        return;
      }

      const updatedCount = await getSentTodayCount();

      if (!cancelled) {
        setSentTodayCount(updatedCount);
      }
    }

    void syncPendingWork();

    return () => {
      cancelled = true;
    };
  }, [appState, currentMessage, isHydrated, pollNow, setCurrentMessage]);

  // Silent auto-dispatch with 3-attempt retry
  useEffect(() => {
    if (!currentMessage || dispatchingRef.current) return;

    dispatchingRef.current = true;
    let cancelled = false;

    async function trySend(phone, text, maxAttempts = 3) {
      if (!SmsModule) {
        console.warn('[SMS] SmsModule not linked');
        return false;
      }
      const hasPerm = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.SEND_SMS);
      if (!hasPerm) { console.warn('[SMS] no permission'); return false; }

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await SmsModule.sendSms(phone, text);
          console.log(`[SMS] sent on attempt ${attempt}`);
          return true;
        } catch (err) {
          console.warn(`[SMS] attempt ${attempt}/${maxAttempts} failed:`, err?.message ?? err);
          if (attempt < maxAttempts) {
            await new Promise(r => setTimeout(r, 2000 * attempt));
          }
        }
      }
      return false;
    }

    async function dispatchSilently() {
      const message = currentMessage;
      console.log('[SMS] dispatching', message.id, '→', message.phone_number);

      const ok = await trySend(message.phone_number, message.message_text);
      const status = ok ? 'sent' : 'failed';

      if (cancelled) return;

      await updateMessageStatus(message.id, status, deviceToken, backendUrl);
      await clearPendingMessage();
      await addToHistory({ ...message, status, sent_at: new Date().toISOString() });

      if (status === 'sent') {
        const updatedCount = await recordSentMessage(message);
        setLastMessage({ ...message, sent_at: new Date().toISOString() });
        setSentTodayCount(updatedCount);
      }

      setCurrentMessage(null);
      setPollingError(false);
      dispatchingRef.current = false;
    }

    void dispatchSilently();
    return () => { cancelled = true; };
  }, [currentMessage, deviceToken, backendUrl, setCurrentMessage, setPollingError]);

  // Retry handler: reset a failed message to pending
  async function handleRetry(messageId) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (deviceToken) {
        headers['X-Device-Token'] = deviceToken;
      }
      const response = await fetch(`${backendUrl}/api/messages/${messageId}/retry`, {
        method: 'POST',
        headers,
      });
      if (response.ok) {
        // Trigger a re-poll to pick up the retried message
        await pollNow();
      }
    } catch (error) {
      console.error('[Retry] failed:', error?.message ?? error);
    }
  }

  // Don't render until we know whether a token exists
  if (!tokenLoaded) {
    return null;
  }

  if (!deviceToken) {
    return (
      <PermissionGate>
        <PairingScreen
          initialBackendUrl={backendUrl}
          onPaired={({ token, backendUrl: url }) => {
            setBackendUrl(url);
            setDeviceToken(token);
          }}
        />
      </PermissionGate>
    );
  }

  async function handleUnpair() {
    await clearDeviceToken();
    await clearBackendUrl();
    setBackendUrl(DEFAULT_API_BASE_URL);
    setDeviceToken(null);
  }

  async function handleToggleGateway() {
    const nextOnline = !gatewayOnline;

    const persistMode = saveGatewayOnline(nextOnline).catch((error) => {
      console.error('[Gateway] failed to save mode:', error?.message ?? error);
    });
    setGatewayOnline(nextOnline);

    if (!nextOnline) {
      setConnectionStatus('offline');

      // Stopping the local foreground service must not wait for the network.
      // This removes the persistent notification immediately and guarantees
      // that the phone cannot claim another message while going offline.
      const stopService = SmsServiceModule?.stopService
        ? SmsServiceModule.stopService().catch((error) => {
            console.error('[Service] failed to stop:', error?.message ?? error);
          })
        : Promise.resolve();

      await Promise.all([persistMode, stopService]);

      // The disconnect call only updates the dashboard sooner. If it fails,
      // the backend will still mark the phone offline when heartbeats stop.
      void fetch(`${backendUrl}/api/device/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Device-Token': deviceToken },
        body: '{}',
      }).catch(() => {});
    } else {
      setConnectionStatus('connecting');
      await persistMode;
    }
  }

  function openDrawer() { drawerRef.current?.openDrawer(); }
  function closeDrawer() { drawerRef.current?.closeDrawer(); }

  function navigate(s) { setScreen(s); closeDrawer(); }

  function renderDrawer() {
    return (
      <View style={ds.drawer}>
        <View style={ds.drawerHeader}>
          <Text style={ds.drawerIcon}>📡</Text>
          <Text style={ds.drawerTitle}>SMS Gateway</Text>
        </View>

        {[
          { key: 'home',    icon: '🏠', label: 'Home' },
          { key: 'history', icon: '📋', label: 'History' },
        ].map(({ key, icon, label }) => (
          <TouchableOpacity
            key={key}
            style={[ds.navItem, screen === key && ds.navItemActive]}
            onPress={() => navigate(key)}
          >
            <Text style={ds.navIcon}>{icon}</Text>
            <Text style={[ds.navLabel, screen === key && ds.navLabelActive]}>{label}</Text>
          </TouchableOpacity>
        ))}

        <View style={ds.drawerFooter}>
          <TouchableOpacity style={ds.unpairRow} onPress={handleUnpair}>
            <Text style={ds.unpairText}>⬡ Unpair Device</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <PermissionGate>
      <DrawerLayoutAndroid
        ref={drawerRef}
        drawerWidth={260}
        drawerPosition="left"
        renderNavigationView={renderDrawer}
      >
        {screen === 'home' ? (
          <HomeScreen
            connectionStatus={connectionStatus}
            pollingError={pollingError}
            lastMessage={lastMessage}
            sentTodayCount={sentTodayCount}
            gatewayOnline={gatewayOnline}
            onToggleGateway={handleToggleGateway}
            onOpenDrawer={openDrawer}
          />
        ) : (
          <HistoryScreen history={activityHistory} onRefresh={refreshDeviceState} onOpenDrawer={openDrawer} />
        )}
      </DrawerLayoutAndroid>
    </PermissionGate>
  );
}

const ds = StyleSheet.create({
  drawer: { flex: 1, backgroundColor: '#1e1b4b', paddingTop: 48 },
  drawerHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingBottom: 28, borderBottomWidth: 1, borderBottomColor: '#312e81' },
  drawerIcon: { fontSize: 28 },
  drawerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, marginTop: 4 },
  navItemActive: { backgroundColor: '#312e81', borderRadius: 10, marginHorizontal: 8, paddingHorizontal: 12 },
  navIcon: { fontSize: 20, width: 26 },
  navLabel: { fontSize: 15, color: '#a5b4fc', fontWeight: '500' },
  navLabelActive: { color: '#fff', fontWeight: '700' },
  drawerFooter: { position: 'absolute', bottom: 32, left: 0, right: 0, paddingHorizontal: 20 },
  unpairRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#4c1d95' },
  unpairText: { color: '#f87171', fontSize: 14, fontWeight: '600' },
});

async function updateMessageStatus(id, status, deviceToken, backendUrl) {
  const url = `${backendUrl}/api/webhook/${id}`;
  console.log('[API] POST', url, { status });
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (deviceToken) {
      headers['X-Device-Token'] = deviceToken;
    }
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ status }),
    });
    console.log('[API] response status:', response.status, response.ok ? 'ok' : 'error');
    return response.ok;
  } catch (error) {
    console.error('[API] status update threw:', error?.message ?? error);
    return false;
  }
}
