import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Modal, Alert, Platform, StatusBar, TextInput, KeyboardAvoidingView, Dimensions, ActivityIndicator, FlatList } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useMemo } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';
import { useUser } from '../../context/UserContext';
import { useProjects } from '../../context/ProjectContext';
import { useLogs } from '../../context/LogContext';

// Announcement Interface
interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
  author: string;
}

export default function DashboardScreen() {
  const router = useRouter();
  const { logout, user } = useUser();
  const { projects } = useProjects();
  const { logs } = useLogs();

  // --- 1. 頂層防呆 Guard ---
  // 如果 Context 資料尚未準備好，顯示全螢幕 Loading UI
  if (!user || !projects || !logs) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#002147" />
        <Text style={styles.loadingText}>系統初始化中...</Text>
      </View>
    );
  }

  const isAdmin = user?.role === 'admin' || user?.email === 'wu@dwcc.com.tw';
  const [menuVisible, setMenuVisible] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingNotices, setLoadingNotices] = useState(false);

  // --- 2. 數據計算 ---
  const stats = useMemo(() => {
    const activeProjects = projects.filter(p => p.executionStatus === 'construction').length;

    // 異常數量判定：Status 為 'issue' 或 issues 欄位有值
    const issueLogs = logs.filter(log =>
      log.status === 'issue' || (log.issues && log.issues.trim().length > 0)
    );

    return {
      activeProjects,
      issueCount: issueLogs.length,
      recentIssues: issueLogs.slice(0, 3).map(l => ({
        id: l.id,
        project: l.project,
        content: l.issues || l.content
      }))
    };
  }, [projects, logs]);

  // --- 3. 公告載入 ---
  useEffect(() => {
    const fetchNotices = async () => {
      try {
        setLoadingNotices(true);
        const q = query(collection(db, 'notices'), orderBy('date', 'desc'));
        const querySnapshot = await getDocs(q);
        const list: Announcement[] = [];
        querySnapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Announcement);
        });
        setAnnouncements(list);
      } catch (err) {
        console.error('Fetch notices error:', err);
      } finally {
        setLoadingNotices(false);
      }
    };
    fetchNotices();
  }, []);

  const navTo = (path: string) => {
    setMenuVisible(false);
    if (path === '/') {
      logout();
      router.replace('/');
    } else {
      router.push(path as any);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#002147" />

      {/* Header */}
      <SafeAreaView style={styles.safeHeader}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.iconBtn}>
            <Ionicons name="menu" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>DW 工程戰情室</Text>
          <View style={{ width: 28 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content}>
        {/* 歡迎語 */}
        <Text style={styles.welcomeText}>
          👋 你好, <Text style={styles.userName}>{user.name}</Text> ({user.role})
        </Text>

        {/* 公告欄摘要 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>系統公告</Text>
        </View>
        <View style={styles.noticeCard}>
          {loadingNotices ? (
            <ActivityIndicator color="#C69C6D" />
          ) : announcements.length > 0 ? (
            <View>
              <Text style={styles.noticeTitle}>{announcements[0].title}</Text>
              <Text style={styles.noticeContent} numberOfLines={2}>{announcements[0].content}</Text>
            </View>
          ) : (
            <Text style={{ color: '#999' }}>暫無公告</Text>
          )}
        </View>

        {/* 數據概覽卡片 */}
        <View style={styles.statsGrid}>
          <View style={styles.statSquare}>
            <Ionicons name="construct" size={24} color="#C69C6D" />
            <Text style={styles.statValue}>{stats.activeProjects}</Text>
            <Text style={styles.statLabel}>施工中專案</Text>
          </View>
          <View style={[styles.statSquare, stats.issueCount > 0 && { backgroundColor: '#FFF2F0' }]}>
            <Ionicons name="warning" size={24} color={stats.issueCount > 0 ? '#FF4D4F' : '#999'} />
            <Text style={[styles.statValue, stats.issueCount > 0 && { color: '#FF4D4F' }]}>{stats.issueCount}</Text>
            <Text style={styles.statLabel}>待處理異常</Text>
          </View>
        </View>

        {/* 異常警報區域 */}
        {stats.issueCount > 0 && (
          <TouchableOpacity style={styles.alertBar} onPress={() => router.push('/logs')}>
            <View style={styles.alertRow}>
              <Ionicons name="alert-circle" size={22} color="#fff" />
              <Text style={styles.alertText}>發現 {stats.issueCount} 筆待處理施工異常，點擊查看</Text>
              <Ionicons name="chevron-forward" size={18} color="#fff" />
            </View>
          </TouchableOpacity>
        )}

        {/* 功能導航九宮格 */}
        <Text style={[styles.sectionTitle, { marginTop: 30, marginBottom: 15 }]}>功能捷徑</Text>
        <View style={styles.navGrid}>
          {[
            { title: '專案管理', icon: 'folder', path: '/projects/', color: '#4A90E2' },
            { title: '施工日誌', icon: 'document-text', path: '/logs', color: '#50E3C2' },
            { title: '文件中心', icon: 'library', path: '/sop', color: '#F5A623' },
            { title: '人員管理', icon: 'people', path: '/personnel', color: '#9013FE', admin: true },
          ].map((item, idx) => {
            if (item.admin && !isAdmin) return null;
            return (
              <TouchableOpacity key={idx} style={styles.navItem} onPress={() => navTo(item.path)}>
                <View style={[styles.iconCircle, { backgroundColor: item.color }]}>
                  <Ionicons name={item.icon as any} size={28} color="#fff" />
                </View>
                <Text style={styles.navLabel}>{item.title}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </ScrollView>

      {/* 側邊選單 Modal */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sideMenu}>
            <SafeAreaView style={{ flex: 1 }}>
              <View style={styles.menuHeader}>
                <Text style={styles.menuTitle}>導航選單</Text>
                <TouchableOpacity onPress={() => setMenuVisible(false)}>
                  <Ionicons name="close" size={30} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={styles.menuList}>
                <TouchableOpacity style={styles.menuItem} onPress={() => navTo('/profile')}>
                  <Ionicons name="person-circle" size={22} color="#fff" />
                  <Text style={styles.menuText}>個人資料</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.menuItem, { marginTop: 'auto', backgroundColor: '#FF6B6B', borderRadius: 8 }]} onPress={() => navTo('/')}>
                  <Ionicons name="log-out" size={22} color="#fff" />
                  <Text style={[styles.menuText, { fontWeight: 'bold' }]}>登出系統</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </View>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setMenuVisible(false)} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  loadingText: { marginTop: 12, color: '#64748b', fontSize: 16 },
  safeHeader: { backgroundColor: '#002147' },
  header: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  iconBtn: { padding: 5 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', letterSpacing: 1 },
  content: { padding: 24 },
  welcomeText: { fontSize: 18, color: '#1e293b', marginBottom: 25 },
  userName: { fontWeight: 'bold', color: '#002147' },
  sectionHeader: { marginBottom: 12 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  noticeCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 25, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, borderWidth: 1, borderColor: '#f1f5f9' },
  noticeTitle: { fontSize: 16, fontWeight: 'bold', color: '#334155', marginBottom: 6 },
  noticeContent: { fontSize: 14, color: '#64748b', lineHeight: 20 },
  statsGrid: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  statSquare: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center', elevation: 2, shadowOpacity: 0.05, shadowRadius: 8, borderWidth: 1, borderColor: '#f1f5f9' },
  statValue: { fontSize: 28, fontWeight: 'bold', color: '#1e293b', marginVertical: 4 },
  statLabel: { fontSize: 13, color: '#64748b' },
  alertBar: { backgroundColor: '#FF4D4F', borderRadius: 12, padding: 15, elevation: 4 },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  alertText: { flex: 1, color: '#fff', fontWeight: 'bold', fontSize: 14 },
  navGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  navItem: { width: (Dimensions.get('window').width - 64) / 2, backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center', elevation: 2, shadowOpacity: 0.05, shadowRadius: 8, borderWidth: 1, borderColor: '#f1f5f9' },
  iconCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  navLabel: { fontSize: 15, fontWeight: '600', color: '#334155' },
  modalOverlay: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.6)' },
  sideMenu: { width: 280, backgroundColor: '#002147', height: '100%', padding: 24 },
  menuHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 },
  menuTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  menuList: { flex: 1 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 15, marginBottom: 10 },
  menuText: { color: '#fff', fontSize: 17 }
});