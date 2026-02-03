import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Dimensions, StatusBar, Platform, TextInput, KeyboardAvoidingView, Alert } from 'react-native';
import { useRouter, Stack, useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useMemo } from 'react';
import { collection, query, getDocs, orderBy, addDoc } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';
import { useUser } from '../../context/UserContext';
import { useProjects } from '../../context/ProjectContext';
import { useLogs } from '../../context/LogContext';
import { toast } from 'sonner';

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
  const navigation = useNavigation();
  const { user } = useUser();
  const { projects } = useProjects();
  const { logs } = useLogs();

  // 1. 頂層防呆 Guard (Top-level Protection)
  if (!user || !projects || !logs) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#002147" />
        <Text style={styles.loadingText}>資料同步中...</Text>
      </View>
    );
  }

  const isAdmin = user?.role === 'admin' || user?.email === 'wu@dwcc.com.tw';
  const [announcements, setAnnouncements] = useState<Announcement[] | undefined>(undefined);

  // 公告發布 Modal
  const [isAnnounceModalVisible, setAnnounceModalVisible] = useState(false);
  const [announceForm, setAnnounceForm] = useState({ title: '', content: '' });

  // 2. 獲取公告 (Load Announcements)
  const fetchNotices = async () => {
    try {
      const q = query(collection(db, 'notices'), orderBy('date', 'desc'));
      const querySnapshot = await getDocs(q);
      const list: Announcement[] = [];
      querySnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Announcement);
      });
      setAnnouncements(list);
    } catch (err) {
      console.error('Fetch notices error:', err);
      setAnnouncements([]); // 發生錯誤時設為空陣列以停止轉圈
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  // 3. 數據統計邏輯 (Data Stats)
  const stats = useMemo(() => {
    const safeProjects = projects || [];
    const safeLogs = logs || [];

    let normalCount = 0;
    let behindCount = 0;

    safeProjects.forEach(p => {
      if (p.status === 'behind') behindCount++;
      else normalCount++;
    });

    const activeProjects = safeProjects.filter(p => p.executionStatus === 'construction').length;

    const issueCount = safeLogs.filter(log =>
      log.status === 'issue' || (log.issues && String(log.issues).trim().length > 0)
    ).length;

    return { normalCount, behindCount, activeProjects, issueCount };
  }, [projects, logs]);

  // 4. 操作邏輯 (Actions)
  const handleAddAnnouncement = async () => {
    if (!announceForm.title.trim() || !announceForm.content.trim()) {
      return Alert.alert('提示', '請填寫標題與內容');
    }
    try {
      await addDoc(collection(db, 'notices'), {
        title: announceForm.title,
        content: announceForm.content,
        date: new Date().toISOString().split('T')[0].replace(/-/g, '/'),
        author: user.name || '管理員',
        createdAt: new Date().toISOString()
      });
      setAnnounceModalVisible(false);
      setAnnounceForm({ title: '', content: '' });
      fetchNotices();
      toast.success('公告已發布');
    } catch (err) {
      Alert.alert('錯誤', '發布失敗');
    }
  };

  // 5. 渲染圓餅圖 UI (Manual CSS Pie Chart)
  const renderHealthChart = () => {
    const total = stats.normalCount + stats.behindCount || 1;
    const normalRatio = stats.normalCount / total;

    return (
      <View style={styles.chartSection}>
        <View style={styles.chartPlaceholder}>
          <View style={[styles.pieSegment, { backgroundColor: '#52C41A', transform: [{ scale: 1 }] }]} />
          {stats.behindCount > 0 && (
            <View style={[styles.pieSegment, { backgroundColor: '#FF4D4F', position: 'absolute', width: '100%', height: '100%', borderRadius: 100, clipPath: `polygon(50% 50%, 50% 0%, 100% 0%, 100% ${normalRatio * 100}%)` } as any]} />
          )}
          <View style={styles.chartInner}>
            <Text style={styles.chartTotal}>{total}</Text>
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
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{
        headerShown: true,
        title: 'DW 工程管理系統',
        headerStyle: { backgroundColor: '#002147' },
        headerTintColor: '#fff',
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
            style={{ marginLeft: 16 }}
          >
            <Ionicons name="menu" size={28} color="#fff" />
          </TouchableOpacity>
        )
      }} />
      <StatusBar barStyle="light-content" />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.welcomeText}>
          👋 你好, <Text style={styles.userName}>{user.name}</Text>
        </Text>

        {/* 公告欄 (Fix Blocking Loading) */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>系統公告</Text>
          {isAdmin && (
            <TouchableOpacity style={styles.addNoticeBtn} onPress={() => setAnnounceModalVisible(true)}>
              <Ionicons name="add" size={16} color="#002147" />
              <Text style={styles.addNoticeText}>新增公告</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.noticeCard}>
          {announcements === undefined ? (
            <ActivityIndicator size="small" color="#C69C6D" style={{ marginTop: 10 }} />
          ) : announcements.length === 0 ? (
            <Text style={styles.emptyText}>暫無最新公告</Text>
          ) : (
            <View>
              <View style={styles.noticeTop}>
                <Text style={styles.noticeLabel}>最新</Text>
                <Text style={styles.noticeDate}>{announcements[0].date}</Text>
              </View>
              <Text style={styles.noticeTitle}>{announcements[0].title}</Text>
              <Text style={styles.noticeContent} numberOfLines={2}>{announcements[0].content}</Text>
            </View>
          )}
        </View>

        {/* 專案進度總覽 */}
        <Text style={styles.sectionTitle}>專案狀態</Text>
        <View style={styles.chartCard}>
          {renderHealthChart()}
        </View>

        {/* 異常警報卡片 */}
        {stats.issueCount > 0 && (
          <TouchableOpacity style={styles.alertCard} onPress={() => router.push('/logs')}>
            <Ionicons name="alert-circle" size={28} color="#fff" />
            <View style={styles.alertInfo}>
              <Text style={styles.alertTitle}>待處理施工異常 ({stats.issueCount})</Text>
              <Text style={styles.alertSub}>點擊進入施工日誌查看</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#fff" />
          </TouchableOpacity>
        )}

      </ScrollView>

      {/* 公告發布 Modal */}
      <Modal visible={isAnnounceModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.noticeModalOverlay}>
          <View style={styles.noticeModalContent}>
            <View style={styles.noticeModalHeader}>
              <Text style={styles.noticeModalTitle}>發布新公告</Text>
              <TouchableOpacity onPress={() => setAnnounceModalVisible(false)}>
                <Ionicons name="close" size={26} color="#333" />
              </TouchableOpacity>
            </View>
            <Text style={styles.inputLabel}>標題</Text>
            <TextInput
              style={styles.input}
              placeholder="請輸入公告標題"
              value={announceForm.title}
              onChangeText={t => setAnnounceForm(f => ({ ...f, title: t }))}
            />
            <Text style={styles.inputLabel}>內容</Text>
            <TextInput
              style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
              placeholder="請輸入詳細公告內容..."
              multiline
              value={announceForm.content}
              onChangeText={t => setAnnounceForm(f => ({ ...f, content: t }))}
            />
            <TouchableOpacity style={styles.submitBtn} onPress={handleAddAnnouncement}>
              <Text style={styles.submitBtnText}>確認發布</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  loadingText: { marginTop: 12, color: '#666', fontSize: 14 },
  content: { padding: 20 },
  welcomeText: { fontSize: 16, color: '#666', marginBottom: 15 },
  userName: { fontWeight: 'bold', color: '#002147', fontSize: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#002147', marginTop: 15, marginBottom: 12 },
  addNoticeBtn: { backgroundColor: '#C69C6D', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 5, flexDirection: 'row', alignItems: 'center' },
  addNoticeText: { color: '#002147', fontSize: 12, fontWeight: 'bold', marginLeft: 3 },
  noticeCard: { backgroundColor: '#fff', borderRadius: 12, padding: 18, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  noticeTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  noticeLabel: { backgroundColor: '#002147', color: '#fff', fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  noticeDate: { color: '#999', fontSize: 12 },
  noticeTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  noticeContent: { fontSize: 14, color: '#666', lineHeight: 20 },
  emptyText: { color: '#9CA3AF', textAlign: 'center', marginVertical: 10, marginTop: 8 },
  chartCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20, elevation: 2 },
  chartSection: { flexDirection: 'row', alignItems: 'center' },
  chartPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  pieSegment: { width: '100%', height: '100%', borderRadius: 50 },
  chartInner: { position: 'absolute', width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  chartTotal: { fontSize: 20, fontWeight: 'bold', color: '#002147' },
  chartLabel: { fontSize: 9, color: '#999' },
  chartLegend: { marginLeft: 25, flex: 1 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  legendText: { fontSize: 14, color: '#444' },
  alertCard: { backgroundColor: '#FF4D4F', borderRadius: 12, padding: 18, flexDirection: 'row', alignItems: 'center', marginTop: 20, elevation: 4, shadowColor: '#FF4D4F', shadowOpacity: 0.3, shadowRadius: 5 },
  alertInfo: { flex: 1, marginLeft: 15 },
  alertTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  alertSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  noticeModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  noticeModalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 25, minHeight: 450 },
  noticeModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  noticeModalTitle: { fontSize: 18, fontWeight: 'bold', color: '#002147' },
  inputLabel: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 8, marginTop: 10 },
  input: { backgroundColor: '#F3F4F6', borderRadius: 8, padding: 15, fontSize: 15 },
  submitBtn: { backgroundColor: '#C69C6D', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 25 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});