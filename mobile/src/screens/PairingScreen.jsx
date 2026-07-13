import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { DEFAULT_API_BASE_URL } from '../../config';
import { normalizeBackendUrl, saveBackendUrl } from '../storage/backendUrl';
import { saveDeviceToken } from '../storage/deviceToken';
import { getDeviceInfo } from '../utils/deviceInfo';

export default function PairingScreen({ onPaired, initialBackendUrl = DEFAULT_API_BASE_URL }) {
  const [backendUrl, setBackendUrl] = useState(initialBackendUrl);
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleConnect() {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 7) {
      setError('Code must be 7 characters.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const serverUrl = normalizeBackendUrl(backendUrl);
      const { name, model } = getDeviceInfo();
      const response = await fetch(`${serverUrl}/api/device/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed, name, model }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? 'Pairing failed. Please try again.');
        return;
      }

      await saveDeviceToken(data.token);
      await saveBackendUrl(serverUrl);
      onPaired?.({ token: data.token, backendUrl: backendUrl.trim().replace(/\/+$/, '') });
    } catch (err) {
      setError(err?.message || 'Cannot reach this server. Check the URL and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'android' ? 24 : 0}
      >
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      <View style={s.container}>
        <View style={s.icon}><Text style={s.iconText}>📡</Text></View>
        <Text style={s.title}>Connect Your Device</Text>
        <Text style={s.subtitle}>
          Enter the 7-character pairing code from your dashboard to make this phone a messaging node.
        </Text>

        <Text style={s.label}>Backend URL</Text>
        <TextInput
          testID="backend-url-input"
          style={s.urlInput}
          value={backendUrl}
          onChangeText={setBackendUrl}
          placeholder="https://sms.example.com"
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          keyboardType="url"
          autoCorrect={false}
          editable={!loading}
        />

        <Text style={s.label}>Pairing code</Text>
        <TextInput
          testID="pairing-code-input"
          style={s.input}
          value={code}
          onChangeText={t => setCode(t.toUpperCase())}
          placeholder="A1B2C3D"
          placeholderTextColor="#94a3b8"
          autoCapitalize="characters"
          maxLength={7}
          editable={!loading}
          autoCorrect={false}
        />

        {error && <Text testID="pairing-error" style={s.error}>{error}</Text>}

        <TouchableOpacity
          testID="connect-button"
          style={[s.btn, loading && s.btnDisabled]}
          onPress={handleConnect}
          disabled={loading}
        >
          <Text style={s.btnText}>{loading ? 'Connecting…' : 'Connect'}</Text>
        </TouchableOpacity>

        <Text style={s.footer}>
          Get your code from Dashboard → Devices in the web app.
        </Text>
      </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { flexGrow: 1 },
  container: { flex: 1, padding: 32, justifyContent: 'center', alignItems: 'center', minHeight: 500 },
  icon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  iconText: { fontSize: 36 },
  title: { fontSize: 26, fontWeight: '700', color: '#1e293b', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 15, color: '#64748b', textAlign: 'center', marginBottom: 36, lineHeight: 22 },
  label: { width: '100%', color: '#475569', fontSize: 13, fontWeight: '700', marginBottom: 7 },
  urlInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, width: '100%', marginBottom: 20, backgroundColor: '#fff', color: '#1e293b', fontSize: 15 },
  input: {
    borderWidth: 2, borderColor: '#6366f1', borderRadius: 12,
    padding: 16, fontSize: 32, letterSpacing: 10,
    textAlign: 'center', width: '100%', marginBottom: 16,
    backgroundColor: '#fff', color: '#1e293b', fontWeight: '700',
  },
  error: { color: '#ef4444', marginBottom: 16, textAlign: 'center', fontSize: 14 },
  btn: { backgroundColor: '#6366f1', paddingVertical: 16, paddingHorizontal: 48, borderRadius: 12, width: '100%', alignItems: 'center', marginBottom: 24 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  footer: { fontSize: 13, color: '#94a3b8', textAlign: 'center' },
});
