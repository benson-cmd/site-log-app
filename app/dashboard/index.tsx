import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Modal, Alert, Platform, StatusBar, TextInput, KeyboardAvoidingView, Dimensions, ActivityIndicator } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';
import { useUser } from '../../context/UserContext';
import { useProjects } from '../../context/ProjectContext';
import { useLogs } from '../../context/LogContext';
import { toast } from 'sonner';
import { PieChart } from 'react-native-chart-kit';

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
  const isAdmin = user?.role === 'admin' || user?.email === 'wu@dwcc.com.tw';

  const [menuVisible, setMenuVisible] = useState(false);

  // Announcement States
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoadingNotices, setIsLoadingNotices] = useState(false);
  const [isAnnounceModalVisible, setAnnounceModalVisible] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [announceForm, setAnnounceForm] = useState({ title: '', content: '' });

  // 0. Firestore Notice Logic
  const fetchNotices = async () => {
    try {
      setIsLoadingNotices(true);
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
      setIsLoadingNotices(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  // --- CRITICAL: 防呆與 Loading 狀態 ---
  const logsData = logs || [];
  const projectsData = projects || [];

  // 如果資料還沒載入，顯示 Loading 畫面
  if (!logs || !projects) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#002147" />
        <Text style={styles.loadingText}>資料同步中...</Text>
      </View>
    );
  }

  // 1. 基礎統計
  const activeProjectsCount = projectsData.filter(p => p.executionStatus === 'construction').length;
  const pendingLogsCount = logsData.filter(l => l.status === 'pending_review').length;

  // 2. 異常數量計算 (修正版判定)
  const allPendingIssues = useMemo(() => {
    return logsData
      .filter(log => log.status === 'issue' || (log.issues && log.issues.trim().length > 0))
      .map(log => ({
        projectName: log.project,
        logDate: log.date,
        content: log.issues || log.content || '未註明異常'
      }));
  }, [logsData]);

  const totalPendingIssues = allPendingIssues.length;
  const topPendingIssues = allPendingIssues.slice(0, 3);

  // 3. 專案健康度分析
  const healthStats = useMemo(() => {
    let normal = 0;
    let delayed = 0;

    projectsData.forEach(project => {
      const pLogs = logsData.filter(l => l.projectId === project.id);
      let actual = 0;
      if (pLogs.length > 0) {
        const sorted = [...pLogs].sort((a, b) => {
          const sA = String(a.date).replace(/\//g, '-');
          const sB = String(b.date).replace(/\//g, '-');
          return new Date(sB).getTime() - new Date(sA).getTime();
        });
        actual = parseFloat(String(sorted[0].actualProgress || '0')) || 0;
      }

      let planned = 0;
      if (project.scheduleData && project.scheduleData.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const sortedShed = [...project.scheduleData].sort((a, b) => a.date.localeCompare(b.date));
        for (let p of sortedShed) {
          if (p.date <= today) planned = p.progress;
          else break;
        }
      }

      if (actual < planned) delayed++;
      else normal++;
    });

    return { normal, delayed };
  }, [projectsData, logsData]);

  const navTo = (path: string) => {
    setMenuVisible(false);
    if (path === '/') {
      logout();
      router.replace('/');
    } else {
      router.push(path as any);
    }
  };

  const handleSubmitAnnouncement = async () => {
    if (!isAdmin) {
      toast.error('⚠️ 權限不足');
      return;
    }
    if (!announceForm.title?.trim() || !announceForm.content?.trim()) {
      toast.error('請填寫完整內容');
      return;
    }

    try {
      if (editingAnnouncement) {
        await updateDoc(doc(db, 'notices', editingAnnouncement.id), {
          title: announceForm.title,
          content: announceForm.content,
          updatedAt: new Date().toISOString()
        });
        toast.success('公告已更新');
      } else {
        await addDoc(collection(db, 'notices'), {
          title: announceForm.title,
          content: announceForm.content,
          date: new Date().toISOString().split('T')[0].replace(/-/g, '/'),
          author: user?.name || '管理員',
          createdAt: new Date().toISOString()
        });
        toast.success('公告已發布');
      }
      setAnnounceModalVisible(false);
      fetchNotices();
    } catch (err: any) {
      toast.error('儲存失敗');
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#002147" />

      {/* Header */}
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.iconBtn}>
            <Ionicons name="menu" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>DW工程戰情室</Text>
          <View style={{ width: 28 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.welcomeText}>
          👋 你好, <Text style={styles.userName}>{user?.name} {user?.role ? `(${user.role})` : ''}</Text>
        </Text>

        {/* 公告欄 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>最新公告</Text>
          {isAdmin && (
            <TouchableOpacity style={styles.addBtn} onPress={() => { setEditingAnnouncement(null); setAnnounceForm({ title: '', content: '' }); setAnnounceModalVisible(true); }}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.addBtnText}>發布</Text>
            </TouchableOpacity>
          )}
        </View>

        {announcements.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{announcements[0].title}</Text>
            <Text style={styles.cardContent} numberOfLines={2}>{announcements[0].content}</Text>
            <Text style={styles.cardFooter}>{announcements[0].date} | {announcements[0].author}</Text>
          </View>
        ) : (
          <Text style={{ color: '#999', marginBottom: 20 }}>目前暫無公告</Text>
        )}

        {/* 進度圓餅圖 */}
        <Text style={styles.sectionTitle}>專案進度分析</Text>
        <View style={styles.dashboardCard}>
          <View style={{ alignItems: 'center' }}>
            <PieChart
              data={[
                { name: '進度正常', population: healthStats.normal, color: '#52c41a', legendFontColor: '#333', legendFontSize: 13 },
                { name: '落後中', population: healthStats.delayed, color: '#ff4d4f', legendFontColor: '#333', legendFontSize: 13 }
              ]}
              width={Dimensions.get('window').width - 60}
              height={180}
              chartConfig={{ color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})` }}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
              absolute
            />
          </View>

          {/* 異常警示卡片 (核心修復) */}
          {totalPendingIssues > 0 && (
            <TouchableOpacity
              style={styles.issueAlertCard}
              onPress={() => router.push('/logs')}
            >
              <View style={styles.issueHeader}>
                <Ionicons name="warning" size={24} color="#CF1322" />
                <Text style={styles.issueTitle}>待處理異常: {totalPendingIssues}</Text>
                <Ionicons name="chevron-forward" size={20} color="#CF1322" />
              </View>
              <View style={styles.issueList}>
                {topPendingIssues.map((issue, idx) => (
                  <Text key={idx} style={styles.issueItem} numberOfLines={1}>
                    • {issue.projectName}: {issue.content}
                  </Text>
                ))}
              </View>
            </TouchableOpacity>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{activeProjectsCount}</Text>
              <Text style={styles.statLabel}>施工中專案</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{pendingLogsCount}</Text>
              <Text style={styles.statLabel}>待審核紀錄</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Side Menu */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sideMenu}>
            <SafeAreaView style={styles.menuSafeArea}>
              <View style={styles.menuHeader}>
                <Text style={styles.menuTitle}>選單</Text>
                <TouchableOpacity onPress={() => setMenuVisible(false)}>
                  <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={styles.menuList}>
                {[
                  { title: '戰情首頁', icon: 'speedometer', path: '/dashboard' },
                  { title: '工程專案', icon: 'business', path: '/projects/' },
                  { title: '施工日誌', icon: 'document-text', path: '/logs' },
                  { title: '人員管理', icon: 'people', path: '/personnel' },
                  { title: '文件中心', icon: 'library', path: '/sop' },
                ].map((item, idx) => (
                  (item.path === '/personnel' && !isAdmin) ? null :
                    <TouchableOpacity key={idx} style={styles.menuItem} onPress={() => navTo(item.path)}>
                      <Ionicons name={item.icon as any} size={22} color="#C69C6D" />
                      <Text style={styles.menuText}>{item.title}</Text>
                    </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.logoutBtn} onPress={() => navTo('/')}>
                <Ionicons name="log-out-outline" size={22} color="#fff" />
                <Text style={styles.logoutText}>登出系統</Text>
              </TouchableOpacity>
            </SafeAreaView>
          </View>
          <TouchableOpacity style={styles.overlayTouch} onPress={() => setMenuVisible(false)} />
        </View>
      </Modal>

      {/* Announcement Modal Edit/Add */}
      <Modal visible={isAnnounceModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.announceModalOverlay}>
          <View style={styles.announceModalContent}>
            <View style={styles.announceModalHeader}>
              <Text style={styles.announceModalTitle}>{editingAnnouncement ? '編輯公告' : '發布公告'}</Text>
              <TouchableOpacity onPress={() => setAnnounceModalVisible(false)}><Ionicons name="close" size={26} /></TouchableOpacity>
            </View>
            <TextInput style={styles.input} placeholder="標題" value={announceForm.title} onChangeText={t => setAnnounceForm({ ...announceForm, title: t })} />
            <TextInput style={[styles.input, styles.textArea]} placeholder="內容..." multiline value={announceForm.content} onChangeText={t => setAnnounceForm({ ...announceForm, content: t })} />
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitAnnouncement}>
              <Text style={styles.submitBtnText}>確認發布</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  loadingText: { marginTop: 10, color: '#666', fontSize: 14 },
  safeArea: { backgroundColor: '#002147' },
  header: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  iconBtn: { padding: 5 },
  headerTitle: { color: '#fff', fontSize: 19, fontWeight: 'bold' },
  content: { padding: 20 },
  welcomeText: { fontSize: 17, color: '#444', marginBottom: 20 },
  userName: { fontWeight: 'bold', color: '#002147' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#002147' },
  addBtn: { flexDirection: 'row', backgroundColor: '#C69C6D', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, alignItems: 'center' },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 18, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3 },
  cardTitle: { fontSize: 17, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  cardContent: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 10 },
  cardFooter: { fontSize: 12, color: '#999', textAlign: 'right' },
  dashboardCard: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 20, elevation: 3 },
  issueAlertCard: { backgroundColor: '#FFF2F0', borderRadius: 8, padding: 12, borderLeftWidth: 4, borderLeftColor: '#FF4D4F', marginTop: 15 },
  issueHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  issueTitle: { flex: 1, fontSize: 15, fontWeight: 'bold', color: '#CF1322' },
  issueList: { paddingLeft: 32 },
  issueItem: { fontSize: 13, color: '#555', marginBottom: 4 },
  statsRow: { flexDirection: 'row', marginTop: 15, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 15 },
  statBox: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: 'bold', color: '#C69C6D' },
  statLabel: { fontSize: 12, color: '#666', marginTop: 2 },
  // Side Menu
  modalOverlay: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.5)' },
  sideMenu: { width: 280, backgroundColor: '#002147', height: '100%', padding: 20 },
  menuSafeArea: { flex: 1 },
  menuHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  menuTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  menuList: { flex: 1 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, gap: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  menuText: { color: '#fff', fontSize: 16 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 15, backgroundColor: '#FF6B6B', borderRadius: 8 },
  logoutText: { color: '#fff', fontWeight: 'bold' },
  overlayTouch: { flex: 1 },
  // Announcement Modal
  announceModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  announceModalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, minHeight: 400 },
  announceModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  announceModalTitle: { fontSize: 18, fontWeight: 'bold' },
  input: { backgroundColor: '#F5F7FA', borderRadius: 8, padding: 12, marginBottom: 15, fontSize: 15 },
  textArea: { height: 120, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: '#002147', padding: 15, borderRadius: 10, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});