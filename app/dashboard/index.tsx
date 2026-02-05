import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, StatusBar, Platform, TextInput, Modal, SafeAreaView, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useMemo } from 'react';
import { collection, query, getDocs, orderBy, addDoc } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';
import { useUser } from '../../context/UserContext';
import { useProjects } from '../../context/ProjectContext';
import { useLogs } from '../../context/LogContext';

// 內建選單 (已加入登出功能)
const MenuSidebar = ({ visible, onClose, router, onLogout }: any) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.menuContent} onStartShouldSetResponder={() => true}>
          <View>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>導覽選單</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.menuItem} onPress={() => { onClose(); router.push('/dashboard'); }}>
              <Ionicons name="home" size={22} color="#fff" style={{ marginRight: 15 }} />
              <Text style={styles.menuItemText}>首頁</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => { onClose(); router.push('/projects'); }}>
              <Ionicons name="briefcase" size={22} color="#fff" style={{ marginRight: 15 }} />
              <Text style={styles.menuItemText}>專案列表</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => { onClose(); router.push('/logs'); }}>
              <Ionicons name="calendar" size={22} color="#fff" style={{ marginRight: 15 }} />
              <Text style={styles.menuItemText}>施工紀錄</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => { onClose(); router.push('/sop'); }}>
              <Ionicons name="library" size={22} color="#fff" style={{ marginRight: 15 }} />
              <Text style={styles.menuItemText}>SOP資料庫</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => { onClose(); router.push('/personnel'); }}>
              <Ionicons name="people" size={22} color="#fff" style={{ marginRight: 15 }} />
              <Text style={styles.menuItemText}>人員管理</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => { onClose(); router.push('/profile'); }}>
              <Ionicons name="person" size={22} color="#fff" style={{ marginRight: 15 }} />
              <Text style={styles.menuItemText}>我的檔案</Text>
            </TouchableOpacity>
          </View>

          {/* 登出按鈕 (固定在底部) */}
          <TouchableOpacity style={styles.logoutBtn} onPress={() => { onClose(); onLogout(); }}>
            <Ionicons name="log-out-outline" size={22} color="#FF6B6B" style={{ marginRight: 15 }} />
            <Text style={[styles.menuItemText, { color: '#FF6B6B' }]}>登出系統</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

interface Announcement {
  id: string; title: string; content: string; date: string; author: string;
}

export default function DashboardScreen() {
  const router = useRouter();
  const { user, logout } = useUser(); // 取得 logout 函式
  const { projects } = useProjects();
  const { logs } = useLogs();

  const [menuVisible, setMenuVisible] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[] | undefined>(undefined);
  const [isAnnounceModalVisible, setAnnounceModalVisible] = useState(false);
  const [announceForm, setAnnounceForm] = useState({ title: '', content: '' });

  const isAdmin = user?.role === 'admin' || user?.email === 'wu@dwcc.com.tw';

  useEffect(() => {
    const fetchNotices = async () => {
      try {
        const q = query(collection(db, 'notices'), orderBy('date', 'desc'));
        const querySnapshot = await getDocs(q);
        const list: Announcement[] = [];
        querySnapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as Announcement));
        setAnnouncements(list);
      } catch (err) {
        setAnnouncements([]);
      }
    };
    fetchNotices();
  }, []);

  const stats = useMemo(() => {
    const safeProjects = projects || [];
    const safeLogs = logs || [];
    let normalCount = 0;
    let behindCount = 0;

    safeProjects.forEach(p => {
      if ((p.status as string) === 'behind') behindCount++;
      else normalCount++;
    });

    const issueCount = safeLogs.filter(log => {
      const txt = log.issues ? String(log.issues).trim() : '';
      return log.status === 'issue' || txt.length > 0;
    }).length;

    return { normalCount, behindCount, issueCount };
  }, [projects, logs]);

  const handleAddAnnouncement = async () => {
    if (!announceForm.title.trim()) return;
    try {
      await addDoc(collection(db, 'notices'), {
        title: announceForm.title,
        content: announceForm.content,
        date: new Date().toISOString().split('T')[0],
        author: user?.name || '管理員',
      });
      setAnnounceModalVisible(false);
      setAnnounceForm({ title: '', content: '' });
    } catch (e) { }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (confirm('確定要登出嗎？')) {
        logout();
        router.replace('/');
      }
    } else {
      Alert.alert('登出', '確定要登出系統嗎？', [
        { text: '取消', style: 'cancel' },
        { text: '登出', style: 'destructive', onPress: () => { logout(); router.replace('/'); } }
      ]);
    }
  };

  if (!user) return <View style={styles.center}><ActivityIndicator size="large" color="#002147" /></View>;

  const renderHealthChart = () => (
    <View style={styles.chartSection}>
      <View style={styles.chartPlaceholder}>
        <View style={[styles.pieSegment, { backgroundColor: '#52C41A', transform: [{ scale: 1 }] }]} />
        {stats.behindCount > 0 && (
          <View style={[styles.pieSegment, { backgroundColor: '#FF4D4F', position: 'absolute', width: '100%', height: '100%', borderRadius: 100, opacity: 0.6 }]} />
        )}
        <View style={styles.chartInner}>
          <Text style={styles.chartTotal}>{stats.normalCount + stats.behindCount}</Text>
          <Text style={styles.chartLabel}>總專案</Text>
        </View>
      </View>
      <View style={styles.chartLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: '#52C41A' }]} />
          <Text style={styles.legendText}>進度正常 ({stats.normalCount})</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: '#FF4D4F' }]} />
          <Text style={styles.legendText}>需注意 ({stats.behindCount})</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#002147" />

      <MenuSidebar visible={menuVisible} onClose={() => setMenuVisible(false)} router={router} onLogout={handleLogout} />

      <SafeAreaView style={styles.headerSafeArea}>
        <View style={styles.customHeader}>
          <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.iconBtn}>
            <Ionicons name="menu" size={30} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>DW 工程管理系統</Text>
          <View style={{ width: 30 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.welcomeText}>👋 你好, <Text style={styles.userName}>{user.name}</Text>!</Text>

        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>公告欄</Text>
          {isAdmin && (
            <TouchableOpacity style={styles.addBtn} onPress={() => setAnnounceModalVisible(true)}>
              <Text style={styles.addBtnText}>+ 新增公告</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.card}>
          {(!announcements || announcements.length === 0) ? (
            <Text style={{ color: '#999' }}>目前無公告</Text>
          ) : (
            <View>
              <Text style={styles.noticeTitle}>{announcements[0].title}</Text>
              <Text style={styles.noticeDate}>{announcements[0].date} | {announcements[0].author}</Text>
              <Text numberOfLines={2} style={{ color: '#666' }}>{announcements[0].content}</Text>
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>專案進度總覽</Text>
        <View style={styles.card}>
          {renderHealthChart()}

          {stats.issueCount > 0 && (
            <TouchableOpacity style={styles.issueBox} onPress={() => router.push('/logs')}>
              <Text style={styles.issueText}>⚠️ 待處理異常: {stats.issueCount}</Text>
              <Text style={styles.issueSub}>點擊前往施工日誌查看詳情</Text>
            </TouchableOpacity>
          )}
        </View>

      </ScrollView>

      <Modal visible={isAnnounceModalVisible} transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>發布公告</Text>
            <TextInput style={styles.input} placeholder="標題" value={announceForm.title} onChangeText={t => setAnnounceForm(f => ({ ...f, title: t }))} />
            <TextInput style={[styles.input, { height: 100 }]} placeholder="內容" multiline value={announceForm.content} onChangeText={t => setAnnounceForm(f => ({ ...f, content: t }))} />
            <View style={styles.modalBtns}>
              <TouchableOpacity onPress={() => setAnnounceModalVisible(false)} style={styles.cancelBtn}><Text>取消</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleAddAnnouncement} style={styles.confirmBtn}><Text style={{ color: '#fff' }}>發布</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerSafeArea: { backgroundColor: '#002147' },
  customHeader: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  iconBtn: { padding: 5 },
  content: { padding: 20 },
  welcomeText: { fontSize: 18, marginBottom: 20 },
  userName: { fontWeight: 'bold', fontSize: 20, color: '#002147' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#002147' },
  addBtn: { backgroundColor: '#C69C6D', padding: 5, borderRadius: 5 },
  addBtnText: { color: '#fff', fontSize: 12 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 15, marginBottom: 20 },
  noticeTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  noticeDate: { fontSize: 12, color: '#999', marginBottom: 5 },
  chartSection: { alignItems: 'center' },
  chartPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: 15 },
  pieSegment: { width: '100%', height: '100%', borderRadius: 50 },
  chartInner: { position: 'absolute', width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  chartTotal: { fontSize: 20, fontWeight: 'bold', color: '#002147' },
  chartLabel: { fontSize: 9, color: '#999' },
  chartLegend: { flexDirection: 'row', gap: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  legendText: { fontSize: 14, color: '#444' },
  circle: { width: 12, height: 12, borderRadius: 6 },
  issueBox: { marginTop: 15, backgroundColor: '#FFF1F0', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#FFA39E', width: '100%', alignItems: 'center' },
  issueText: { color: '#CF1322', fontWeight: 'bold' },
  issueSub: { color: '#CF1322', fontSize: 12, marginTop: 2, textDecorationLine: 'underline' },
  // Menu Styles
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row' },
  menuContent: { width: '75%', backgroundColor: '#002147', height: '100%', padding: 20, paddingTop: 50, justifyContent: 'space-between' },
  menuHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30, alignItems: 'center' },
  menuTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  menuItemText: { color: '#fff', fontSize: 17 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', marginBottom: 20 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', padding: 20, borderRadius: 10 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  input: { backgroundColor: '#f5f5f5', padding: 10, borderRadius: 5, marginBottom: 10 },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { padding: 10 },
  confirmBtn: { backgroundColor: '#002147', padding: 10, borderRadius: 5 }
});