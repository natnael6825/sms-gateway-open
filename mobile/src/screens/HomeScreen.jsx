import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const STATUS = {
  connected:    { color: '#22c55e', bg: '#f0fdf4', dot: '#22c55e', label: 'Connected' },
  connecting:   { color: '#f59e0b', bg: '#fffbeb', dot: '#f59e0b', label: 'Connecting…' },
  disconnected: { color: '#ef4444', bg: '#fef2f2', dot: '#ef4444', label: 'Disconnected' },
  offline:      { color: '#64748b', bg: '#f1f5f9', dot: '#94a3b8', label: 'Offline' },
};

export default function HomeScreen({
  connectionStatus = 'connecting',
  sentTodayCount: sentProp = 0,
  lastMessage: lastProp = null,
  onUnpair,
  onOpenDrawer,
  gatewayOnline = true,
  onToggleGateway,
}) {
  const sentTodayCount = sentProp;
  const lastMessage = lastProp;

  const st = STATUS[connectionStatus] ?? STATUS.connecting;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={onOpenDrawer} style={s.menuBtn}>
            <Text style={s.menuIcon}>☰</Text>
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerIcon}>📡</Text>
            <Text style={s.headerTitle}>SMS Gateway</Text>
          </View>
          {onUnpair && (
            <TouchableOpacity onPress={onUnpair} style={s.unpairBtn}>
              <Text style={s.unpairText}>Unpair</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Status card */}
        <View style={[s.card, { backgroundColor: st.bg }]}>
          <View style={s.statusRow}>
            <View style={[s.statusDot, { backgroundColor: st.dot }]} />
            <Text style={[s.statusLabel, { color: st.color }]}>{st.label}</Text>
          </View>
          <Text style={s.statusSub}>
            {connectionStatus === 'offline'
              ? 'Gateway paused. This phone will not claim or send messages.'
              : connectionStatus === 'connected'
              ? 'Polling every 5 seconds. Messages send automatically.'
              : connectionStatus === 'disconnected'
              ? 'Retrying every 10 seconds…'
              : 'Establishing connection to server…'}
          </Text>
          <TouchableOpacity
            onPress={onToggleGateway}
            style={[s.modeButton, gatewayOnline ? s.offlineButton : s.onlineButton]}
          >
            <Text style={[s.modeButtonText, gatewayOnline ? s.offlineButtonText : s.onlineButtonText]}>
              {gatewayOnline ? 'Go offline' : 'Go online'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={s.card}>
          <Text style={s.cardLabel}>TODAY'S ACTIVITY</Text>
          <View style={s.statRow}>
            <View style={s.statBox}>
              <Text style={[s.statNum, { color: '#22c55e' }]}>{sentTodayCount}</Text>
              <Text style={s.statDesc}>Sent Today</Text>
            </View>
          </View>
        </View>

        {/* Last message */}
        <View style={s.card}>
          <Text style={s.cardLabel}>LAST MESSAGE SENT</Text>
          {lastMessage ? (
            <View>
              <Text style={s.msgPhone}>{lastMessage.phone_number}</Text>
              <Text style={s.msgText} numberOfLines={2}>{lastMessage.message_text}</Text>
              {lastMessage.sent_at && (
                <Text style={s.msgTime}>{new Date(lastMessage.sent_at).toLocaleString()}</Text>
              )}
            </View>
          ) : (
            <Text style={s.empty}>No messages sent yet</Text>
          )}
        </View>

        {/* Info */}
        <View style={[s.card, s.infoCard, !gatewayOnline && s.offlineInfoCard]}>
          <Text style={[s.infoText, !gatewayOnline && s.offlineInfoText]}>
            {gatewayOnline
              ? '🔔 The persistent notification keeps this phone active while the gateway is online. You can lock the phone and messages will still send automatically.'
              : 'Gateway paused. The background service and its persistent notification are stopped until you go online again.'}
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { padding: 20, paddingBottom: 40 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  menuBtn: { padding: 4, marginRight: 8 },
  menuIcon: { fontSize: 22, color: '#475569' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIcon: { fontSize: 24 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
  unpairBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#fecaca' },
  unpairText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },

  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', letterSpacing: 1, marginBottom: 14 },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  statusLabel: { fontSize: 18, fontWeight: '700' },
  statusSub: { fontSize: 13, color: '#64748b', lineHeight: 20 },
  modeButton: { alignSelf: 'flex-start', marginTop: 14, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  offlineButton: { backgroundColor: '#fff', borderColor: '#ef4444' },
  offlineButtonText: { color: '#dc2626' },
  onlineButton: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  onlineButtonText: { color: '#fff' },
  modeButtonText: { fontSize: 14, fontWeight: '700' },

  statRow: { flexDirection: 'row', gap: 12 },
  statBox: { flex: 1, alignItems: 'center', padding: 14, backgroundColor: '#f8fafc', borderRadius: 12 },
  statNum: { fontSize: 36, fontWeight: '700' },
  statDesc: { fontSize: 12, color: '#94a3b8', marginTop: 4, fontWeight: '600' },

  msgPhone: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  msgText: { fontSize: 14, color: '#475569', marginBottom: 6 },
  msgTime: { fontSize: 12, color: '#94a3b8' },
  empty: { fontSize: 14, color: '#94a3b8' },

  infoCard: { backgroundColor: '#eef2ff' },
  infoText: { fontSize: 13, color: '#4338ca', lineHeight: 20 },
  offlineInfoCard: { backgroundColor: '#f1f5f9' },
  offlineInfoText: { color: '#475569' },
});
