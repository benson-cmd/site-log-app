import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Platform, StatusBar, TextInput, Alert } from 'react-native';
import React, { useState, useMemo } from 'react';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../../context/UserContext';
import { useProjects, Project } from '../../context/ProjectContext';
import { useLogs } from '../../context/LogContext';

const THEME = {
  primary: '#C69C6D',
  background: '#F5F7FA',
  card: '#ffffff',
  headerBg: '#002147',
  text: '#333333',
  danger: '#FF6B6B',
  success: '#4CAF50',
  warning: '#FF9800'
};

const EXECUTION_STATUS_MAP: Record<string, string> = {
  not_started: '尚未開工',
  started_prep: '開工尚未進場',
  construction: '施工中',
  completed: '完工',
  inspection: '驗收中',
  settlement: '結案'
};

const formatCurrency = (val: number | string | undefined) => {
  if (!val) return '$0';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return isNaN(num) ? '$0' : num.toLocaleString();
};

export default function ProjectsScreen() {
  const router = useRouter();
  const { user } = useUser();
  const { projects, deleteProject } = useProjects();
  const { logs } = useLogs();

  const [searchText, setSearchText] = useState('');

  // 1. 取得今日日期字串 (YYYY-MM-DD)
  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const todayStr = getTodayStr();

  // 2. 嚴格進度計算
  const getTodayProgress = (projectLogs: any[]) => {
    const todayLog = projectLogs.find(log => log.date === todayStr);
    return todayLog ? parseFloat(todayLog.actualProgress) : null;
  };

  const getPlannedProgress = (project: Project) => {
    if (!project.startDate || !project.contractDuration) return 0;
    // 簡易插值計算 (若需精確 S-Curve 邏輯可引入 helper)
    const schedule = project.scheduleData || [];
    // ...這裡簡化顯示，詳情頁有完整計算
    return 0; // 列表頁暫時顯示 0 或從 scheduleData 查找今日
  };

  const getPendingIssuesCount = (projectLogs: any[]) => {
    return projectLogs.filter(log => {
      const txt = log.issues ? String(log.issues).trim() : '';
      return log.status === 'issue' || txt.length > 0;
    }).length;
  };

  const handleDeleteParams = (id: string, name: string) => {
    if (Platform.OS === 'web') {
      if (confirm(`確定刪除「${name}」？`)) deleteProject(id);
    } else {
      Alert.alert('刪除', `確定刪除「${name}」？`, [
        { text: '取消', style: 'cancel' },
        { text: '刪除', style: 'destructive', onPress: () => deleteProject(id) }
      ]);
    }
  };

  const filteredProjects = useMemo(() => {
    if (!searchText) return projects;
    return projects.filter(p => p.name.includes(searchText) || p.address.includes(searchText));
  }, [projects, searchText]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor={THEME.headerBg} />

      <SafeAreaView style={styles.headerSafeArea}>
        <View style={styles.headerContent}>
          {/* 返回 Dashboard */}
          <TouchableOpacity onPress={() => router.push('/dashboard')} style={styles.menuBtn}>
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>專案列表</Text>
          <View style={{ width: 28 }} />
        </View>
      </SafeAreaView>

      <View style={styles.contentContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput style={styles.searchInput} placeholder="搜尋專案..." value={searchText} onChangeText={setSearchText} />
        </View>

        <FlatList
          data={filteredProjects}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 15, paddingBottom: 80 }}
          renderItem={({ item }) => {
            const projectLogs = logs.filter(l => l.projectId === item.id);
            const actual = getTodayProgress(projectLogs);
            const pendingCount = getPendingIssuesCount(projectLogs);

            return (
              <TouchableOpacity style={styles.card} onPress={() => router.push(`/projects/${item.id}`)}>
                <View style={styles.cardHeader}>
                  <View style={[styles.statusTag, { backgroundColor: '#E3F2FD' }]}>
                    <Text style={{ color: '#002147', fontSize: 12, fontWeight: 'bold' }}>{EXECUTION_STATUS_MAP[item.executionStatus || 'not_started'] || item.executionStatus}</Text>
                  </View>
                  {user?.role === 'admin' && (
                    <TouchableOpacity onPress={() => handleDeleteParams(item.id, item.name)} style={{ padding: 5 }}>
                      <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.projectTitle}>{item.name}</Text>
                  {pendingCount > 0 && (
                    <View style={styles.alertBadge}>
                      <Text style={styles.alertText}>⚠️ 異常: {pendingCount}</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.projectInfo}>📍 {item.address}</Text>
                <Text style={styles.projectInfo}>💰 總價：${formatCurrency(item.currentContractAmount || item.contractAmount)}</Text>

                <View style={styles.progressSection}>
                  <Text style={{ fontSize: 12, color: '#666' }}>
                    實際: <Text style={{ fontWeight: 'bold', color: actual !== null ? '#333' : '#FF4D4F' }}>{actual !== null ? `${actual}%` : '尚未更新'}</Text>
                  </Text>
                  {/* 進度條僅示意 */}
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressBar, { width: `${Math.min(actual || 0, 100)}%` }]} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<View style={styles.emptyState}><Ionicons name="folder-open-outline" size={64} color="#ccc" /><Text style={styles.emptyText}>無專案資料</Text></View>}
        />

        {/* ★ 關鍵修正：點擊「+」時，跳轉到 new.tsx 頁面，而不是打開 Modal */}
        {user?.role === 'admin' && (
          <TouchableOpacity style={styles.fab} onPress={() => router.push('/projects/new')}>
            <Ionicons name="add" size={30} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  headerSafeArea: { backgroundColor: THEME.headerBg, paddingTop: Platform.OS === 'android' ? 25 : 0 },
  headerContent: { height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, justifyContent: 'space-between' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  menuBtn: { padding: 5 },
  contentContainer: { flex: 1 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 15, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 12, marginBottom: 15, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  projectTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  projectInfo: { color: '#666', marginTop: 5 },
  alertBadge: { backgroundColor: '#FFE5E5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: '#FF4D4F' },
  alertText: { color: '#FF4D4F', fontSize: 12, fontWeight: 'bold' },
  progressSection: { marginTop: 15 },
  progressTrack: { height: 6, backgroundColor: '#eee', borderRadius: 3, marginTop: 5, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: THEME.primary },
  fab: { position: 'absolute', right: 20, bottom: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: THEME.primary, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { marginTop: 10, color: '#999' },
});