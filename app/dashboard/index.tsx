import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Dimensions, StatusBar, FlatList } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useUser } from '../../context/UserContext';
import { useProjects } from '../../context/ProjectContext';
import { useLogs } from '../../context/LogContext';

export default function DashboardScreen() {
  const router = useRouter();

  // 1. Context Hooks
  const { user, logout } = useUser();
  const { projects } = useProjects();
  const { logs } = useLogs();

  // 2. 加載守衛 (Loading Guard)
  // 確保 Context 已初始化，若還沒就回傳轉圈，不進行下方邏輯
  if (!user) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#002147" />
        <Text style={styles.loadingText}>身份驗證中...</Text>
      </View>
    );
  }

  // 3. 防禦性資料層 (Defensive Data Layer)
  // 使用安全變數，確保不論如何都不會是 undefined
  const safeUser = user || { name: '使用者', role: 'guest' };
  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeLogs = Array.isArray(logs) ? logs : [];

  // 4. 安全統計邏輯
  const stats = useMemo(() => {
    const activeProjects = safeProjects.filter(p => p?.executionStatus === 'construction').length;

    // 異常數量判定：使用 Optional Chaining & 安全字串檢查
    const issueLogs = safeLogs.filter(log =>
      log?.status === 'issue' || (log?.issues && String(log.issues).trim().length > 0)
    );

    return {
      activeProjects,
      totalProjects: safeProjects.length,
      issueCount: issueLogs.length
    };
  }, [safeProjects, safeLogs]);

  // 5. 導航捷徑定義 (Icon 使用固定字串)
  const navItems = [
    { title: '專案管理', icon: 'briefcase', path: '/projects/', color: '#C69C6D' },
    { title: '施工日誌', icon: 'calendar', path: '/logs', color: '#002147' },
    { title: '文件中心', icon: 'document-text', path: '/sop', color: '#555' },
    { title: '人員管理', icon: 'people', path: '/personnel', color: '#10B981', adminOnly: true },
  ];

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Top Section / Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>你好,</Text>
            <Text style={styles.userName}>{safeUser.name}</Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        {/* 異常警報卡片 (僅當有異常時顯示) */}
        {stats.issueCount > 0 && (
          <TouchableOpacity
            style={styles.alertCard}
            activeOpacity={0.8}
            onPress={() => router.push('/logs')}
          >
            <View style={styles.alertContent}>
              <Ionicons name="warning" size={28} color="#fff" />
              <View style={styles.alertTextWrapper}>
                <Text style={styles.alertTitle}>待處理施工異常</Text>
                <Text style={styles.alertSub}>目前發現 {stats.issueCount} 筆列管事項</Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </View>
          </TouchableOpacity>
        )}

        {/* 數據統計欄位 */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{stats.activeProjects}</Text>
            <Text style={styles.statLab}>施工中</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{stats.totalProjects}</Text>
            <Text style={styles.statLab}>專案總數</Text>
          </View>
        </View>

        {/* 快速捷徑 Grid */}
        <Text style={styles.sectionTitle}>快速導覽</Text>
        <View style={styles.grid}>
          {navItems.map((item, index) => {
            // 人員管理僅 Admin 可見
            if (item.adminOnly && safeUser.role !== 'admin' && safeUser.role !== 'owner') return null;

            return (
              <TouchableOpacity
                key={index}
                style={styles.gridItem}
                onPress={() => router.push(item.path as any)}
              >
                <View style={[styles.iconBox, { backgroundColor: item.color }]}>
                  <Ionicons name={item.icon as any} size={28} color="#fff" />
                </View>
                <Text style={styles.gridLabel}>{item.title}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 最近動態 (公告佔位或靜態提示) */}
        <View style={styles.footerInfo}>
          <Text style={styles.version}>DW Construction v1.0.4 - 生產力工具</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#666' },
  scrollContent: { padding: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 25
  },
  greeting: { fontSize: 16, color: '#666' },
  userName: { fontSize: 24, fontWeight: 'bold', color: '#002147' },
  logoutBtn: { padding: 8, backgroundColor: '#fff', borderRadius: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3 },

  alertCard: {
    backgroundColor: '#FF4D4F',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#FF4D4F',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 4 }
  },
  alertContent: { flexDirection: 'row', alignItems: 'center' },
  alertTextWrapper: { flex: 1, marginLeft: 15 },
  alertTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  alertSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: 15, marginBottom: 30 },
  statBox: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowOpacity: 0.05,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: '#F0F0F0'
  },
  statVal: { fontSize: 22, fontWeight: 'bold', color: '#002147' },
  statLab: { fontSize: 12, color: '#999', marginTop: 4 },

  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15 },
  gridItem: {
    width: (Dimensions.get('window').width - 55) / 2,
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    elevation: 2,
    shadowOpacity: 0.05,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: '#F0F0F0'
  },
  iconBox: { width: 50, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  gridLabel: { fontSize: 15, color: '#333', fontWeight: '500' },

  footerInfo: { marginTop: 40, alignItems: 'center' },
  version: { color: '#CCC', fontSize: 11 }
});