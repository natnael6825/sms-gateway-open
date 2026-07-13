import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Linking,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

function getRequiredPermissions() {
  if (Platform.OS !== 'android') return [];

  const permissions = [PermissionsAndroid.PERMISSIONS.SEND_SMS];

  // POST_NOTIFICATIONS only exists on Android 13+ (API 33+).
  if (
    Number(Platform.Version) >= 33 &&
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
  ) {
    permissions.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }

  return permissions;
}

async function getMissingPermissions() {
  const missingPermissions = [];

  for (const permission of getRequiredPermissions()) {
    if (!(await PermissionsAndroid.check(permission))) {
      missingPermissions.push(permission);
    }
  }

  return missingPermissions;
}

async function requestRequiredPermissions() {
  for (const permission of getRequiredPermissions()) {
    if (await PermissionsAndroid.check(permission)) continue;

    const isSmsPermission = permission === PermissionsAndroid.PERMISSIONS.SEND_SMS;
    const result = await PermissionsAndroid.request(permission, {
      title: isSmsPermission ? 'SMS Permission Required' : 'Notification Permission',
      message: isSmsPermission
        ? 'SMS Gateway needs to send SMS messages automatically in the background.'
        : 'SMS Gateway needs to show a notification while running in the background.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    });

    if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      return { status: 'blocked', blockedPermission: permission };
    }
    if (result !== PermissionsAndroid.RESULTS.GRANTED) {
      return { status: 'denied', blockedPermission: null };
    }
  }

  return { status: 'granted', blockedPermission: null };
}

export default function PermissionGate({ children }) {
  const [status, setStatusState] = useState('checking');
  const statusRef = useRef('checking');
  const mountedRef = useRef(false);
  const operationInProgressRef = useRef(false);
  const pendingRefreshRef = useRef(false);
  const blockedPermissionRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  const setStatus = useCallback((nextStatus) => {
    statusRef.current = nextStatus;
    if (mountedRef.current) setStatusState(nextStatus);
  }, []);

  const refreshPermissions = useCallback(async () => {
    if (operationInProgressRef.current) {
      pendingRefreshRef.current = true;
      return;
    }

    operationInProgressRef.current = true;
    try {
      const missingPermissions = await getMissingPermissions();
      const blockedPermission = blockedPermissionRef.current;

      if (missingPermissions.length === 0) {
        blockedPermissionRef.current = null;
        setStatus('granted');
      } else if (blockedPermission && missingPermissions.includes(blockedPermission)) {
        setStatus('blocked');
      } else {
        // A permission may have been revoked while the app was in the
        // background. If the specifically blocked permission was enabled in
        // Settings, move to denied so another missing permission can be
        // requested from the stable in-app screen.
        blockedPermissionRef.current = null;
        setStatus('denied');
      }
    } catch (error) {
      console.warn('PermissionGate: permission check failed', error);
      if (statusRef.current !== 'blocked') setStatus('denied');
    } finally {
      operationInProgressRef.current = false;
      if (mountedRef.current && pendingRefreshRef.current) {
        pendingRefreshRef.current = false;
        void refreshPermissions();
      }
    }
  }, [setStatus]);

  const requestPermissions = useCallback(async ({ showProgress = true } = {}) => {
    // A permission dialog itself can cause several AppState transitions. Only
    // one permission workflow may run at a time or Android can reopen it.
    if (operationInProgressRef.current) return;

    operationInProgressRef.current = true;
    if (showProgress) setStatus('checking');

    try {
      const result = await requestRequiredPermissions();
      blockedPermissionRef.current = result.blockedPermission;
      setStatus(result.status);
    } catch (error) {
      console.warn('PermissionGate: permission request failed', error);
      blockedPermissionRef.current = null;
      setStatus('denied');
    } finally {
      operationInProgressRef.current = false;
      if (mountedRef.current && pendingRefreshRef.current) {
        pendingRefreshRef.current = false;
        void refreshPermissions();
      }
    }
  }, [refreshPermissions, setStatus]);

  useEffect(() => {
    mountedRef.current = true;
    void requestPermissions({ showProgress: false });

    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === 'active' && previousState !== 'active') {
        // Returning from Settings must only inspect permission state. Calling
        // request() here causes the Settings/checking loop reported on Android.
        void refreshPermissions();
      }
    });

    return () => {
      mountedRef.current = false;
      pendingRefreshRef.current = false;
      subscription?.remove?.();
    };
  }, [refreshPermissions, requestPermissions]);

  if (status === 'granted') return children;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      <View style={s.container}>
        <View style={s.iconBox}>
          <Text style={s.emoji}>{status === 'checking' ? '\u23F3' : '\uD83D\uDD12'}</Text>
        </View>
        <Text style={s.title}>
          {status === 'checking' ? 'Checking permissions\u2026' : 'Permissions Required'}
        </Text>
        {status !== 'checking' && (
          <>
            <Text style={s.body}>
              SMS Gateway needs permission to <Text style={s.bold}>send SMS</Text> and{' '}
              <Text style={s.bold}>show notifications</Text> to work in the background.
            </Text>
            {status === 'blocked' ? (
              <>
                <Text style={s.hint}>
                  You selected &quot;Don&apos;t ask again&quot;. Open Settings {'\u2192'} SMS Gateway {'\u2192'} Permissions and enable the required permissions.
                </Text>
                <TouchableOpacity style={s.btn} onPress={() => Linking.openSettings()}>
                  <Text style={s.btnText}>Open App Settings</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={s.btn} onPress={() => requestPermissions()}>
                <Text style={s.btnText}>Grant Permissions</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1, padding: 36, alignItems: 'center', justifyContent: 'center' },
  iconBox: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emoji: { fontSize: 44 },
  title: { fontSize: 22, fontWeight: '700', color: '#1e293b', textAlign: 'center', marginBottom: 14 },
  body: { fontSize: 15, color: '#475569', textAlign: 'center', lineHeight: 23, marginBottom: 20 },
  bold: { fontWeight: '700', color: '#1e293b' },
  hint: { fontSize: 13, color: '#94a3b8', textAlign: 'center', lineHeight: 20, marginBottom: 24, paddingHorizontal: 8 },
  btn: { backgroundColor: '#6366f1', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 12, width: '100%', alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
