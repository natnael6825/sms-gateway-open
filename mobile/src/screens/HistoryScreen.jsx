import React, { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const STATUS_STYLE = {
  sent:   { bg: '#f0fdf4', color: '#16a34a', label: '✓ Sent' },
  failed: { bg: '#fef2f2', color: '#dc2626', label: '✕ Failed' },
};

function HistoryItem({ item }) {
  const st = STATUS_STYLE[item.status] ?? STATUS_STYLE.sent;
  return (
    <View style={s.item}>
      <View style={s.itemLeft}>
        <Text style={s.phone}>{item.phone_number}</Text>
        <Text style={s.msg} numberOfLines={1}>{item.message_text}</Text>
        <Text style={s.time}>{new Date(item.delivered_at || item.sent_at).toLocaleString()}</Text>
      </View>
      <View style={[s.badge, { backgroundColor: st.bg }]}>
        <Text style={[s.badgeText, { color: st.color }]}>{st.label}</Text>
      </View>
    </View>
  );
}

export default function HistoryScreen({ onOpenDrawer, history: historyProp = [], onRefresh }) {
  const [history, setHistory] = useState(historyProp);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    await onRefresh?.();
    setLoading(false);
  }, [onRefresh]);

  useEffect(() => { setHistory(historyProp); setLoading(false); }, [historyProp]);

  useEffect(() => {
    void load();
    const sub = AppState.addEventListener('change', s => { if (s === 'active') void load(); });
    return () => sub.remove();
  }, [load]);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      <View style={s.header}>
        <TouchableOpacity onPress={onOpenDrawer} style={s.menuBtn}>
          <Text style={s.menuIcon}>☰</Text>
        </TouchableOpacity>
        <Text style={s.title}>History</Text>
        <TouchableOpacity onPress={load} style={s.refreshBtn}>
          <Text style={s.refreshIcon}>↻</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}><Text style={s.muted}>Loading…</Text></View>
      ) : history.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>📭</Text>
          <Text style={s.muted}>No messages sent yet</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => <HistoryItem item={item} />}
          contentContainerStyle={{ paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={s.sep} />}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#fff' },
  menuBtn: { padding: 8, marginRight: 8 },
  menuIcon: { fontSize: 22, color: '#475569' },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: '#1e293b' },
  refreshBtn: { padding: 8 },
  refreshIcon: { fontSize: 20, color: '#6366f1' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyIcon: { fontSize: 48 },
  muted: { color: '#94a3b8', fontSize: 15 },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff' },
  itemLeft: { flex: 1, marginRight: 12 },
  phone: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 2 },
  msg: { fontSize: 13, color: '#64748b', marginBottom: 3 },
  time: { fontSize: 11, color: '#94a3b8' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  sep: { height: 1, backgroundColor: '#f1f5f9', marginLeft: 16 },
});
