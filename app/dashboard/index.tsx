import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Modal, Alert, Platform, StatusBar, TextInput, KeyboardAvoidingView, Dimensions } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';
import { useUser } from '../../context/UserContext';
import { useProjects } from '../../context/ProjectContext';
import { useLogs } from '../../context/LogContext';
import { toast } from 'sonner';
import { PieChart } from 'react-native-chart-kit';
import { useMemo } from 'react';

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

  // 1. 基礎統計
  // 進行中專案：executionStatus = 'construction'
  const activeProjectsCount = projects.filter(p => p.executionStatus === 'construction').length;
  // 待審核紀錄：Status = 'pending_review'
  const pendingLogsCount = logs.filter(l => l.status === 'pending_review').length;

  // 2. 升級版統計：異常匯總
  const allPendingIssues = useMemo(() => {
    return logs.reduce((acc: any[], log) => {
      if (log.issues && Array.isArray(log.issues)) {
        const pending = log.issues
          .filter((i: any) => i.status === 'pending')
          .map(i => ({ ...i, projectName: log.project, logDate: log.date }));
        return [...acc, ...pending];
      }
      return acc;
    }, []);
  }, [logs]);

  const totalPendingIssues = allPendingIssues.length;
  const topPendingIssues = allPendingIssues.slice(0, 3);

  // 3. 專案健康度分析 (正常 vs 落後)
  const healthStats = useMemo(() => {
    let normal = 0;
    let delayed = 0;

    projects.forEach(project => {
      // (A) 計算實際進度：取該專案最新日誌的進度
      const pLogs = logs.filter(l => l.projectId === project.id);
      let actual = 0;
      if (pLogs.length > 0) {
        const sorted = [...pLogs].sort((a, b) => {
          const sA = String(a.date).replace(/\//g, '-');
          const sB = String(b.date).replace(/\//g, '-');
          return new Date(sB).getTime() - new Date(sA).getTime();
        });
        // ⚠️ 修正 TypeScript 類型錯誤：確保傳遞字串給 parseFloat
        actual = parseFloat(String(sorted[0].actualProgress || '0')) || 0;
      }

      // (B) 計算預定進度：比對當前日期
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
  }, [projects, logs]);

  const navTo = (path: string) => {
    setMenuVisible(false);
    if (path === '/') {
      logout();
      router.replace('/');
    } else {
      router.push(path as any);
    }
  };

  // Add Announcement
  const handleOpenAdd = () => {
    setEditingAnnouncement(null);
    setAnnounceForm({ title: '', content: '' });
    setAnnounceModalVisible(true);
  };

  // Edit Announcement
  const handleOpenEdit = (ann: Announcement) => {
    setEditingAnnouncement(ann);
    setAnnounceForm({ title: ann.title, content: ann.content });
    setAnnounceModalVisible(true);
  };

  const handleSubmitAnnouncement = async () => {
    if (!isAdmin) {
      toast.error('⚠️ 權限不足：僅管理員可發布公告');
      return;
    }

    // 1. 必填驗證
    if (!announceForm.title?.trim()) {
      toast.error('⚠️ 錯誤：請輸入公告標題！');
      return;
    }
    if (!announceForm.content?.trim()) {
      toast.error('⚠️ 錯誤：請輸入公告內容！');
      return;
    }

    try {
      if (editingAnnouncement) {
        // Update existing in Firestore
        const docRef = doc(db, 'notices', editingAnnouncement.id);
        await updateDoc(docRef, {
          title: announceForm.title,
          content: announceForm.content,
          updatedAt: new Date().toISOString()
        });
        toast.success('✅ 成功：公告已更新');
      } else {
        // Create new in Firestore
        await addDoc(collection(db, 'notices'), {
          title: announceForm.title,
          content: announceForm.content,
          date: new Date().toISOString().split('T')[0].replace(/-/g, '/'),
          author: user?.name || '管理員',
          createdAt: new Date().toISOString()
        });
        toast.success('✅ 成功：公告已發布');
      }
      setAnnounceModalVisible(false);
      fetchNotices(); // 重新讀取
    } catch (err: any) {
      toast.error('❌ 發生錯誤：' + err.message);
    }
  };

  // Delete Announcement
  const handleDeleteAnnouncement = async () => {
    if (!isAdmin) {
      toast.error('⚠️ 權限不足：僅管理員可刪除公告');
      return;
    }
    if (!editingAnnouncement) return;

    if (window.confirm('確定要永久刪除此公告嗎？（刪除後無法復原）')) {
      try {
        await deleteDoc(doc(db, 'notices', editingAnnouncement.id));
        toast.success('🗑️ 公告已刪除');
        setAnnounceModalVisible(false);
        fetchNotices(); // 重新讀取
      } catch (err: any) {
        toast.error('❌ 刪除失敗：' + err.message);
      }
    }
  };

  const menuItems = [
    { title: '首頁', icon: 'home', path: '/dashboard' },
    { title: '專案列表', icon: 'folder-open', path: '/projects/' },
    { title: '施工紀錄', icon: 'clipboard', path: '/logs' },
    { title: '人員管理', icon: 'people', path: '/personnel' },
    { title: 'SOP資料庫', icon: 'library', path: '/sop' },
    { title: '我的檔案', icon: 'person-circle', path: '/profile' },
  ];

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
          <Text style={styles.headerTitle}>DW工程日誌系統</Text>
          <View style={{ width: 28 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.welcomeText}>
          👋 您好, <Text style={styles.userName}>{user?.name || '使用者'} {user?.role ? `(${user.role})` : ''}</Text>!
        </Text>

        {/* Announcement Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>公告欄</Text>
          {isAdmin && (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={handleOpenAdd}
            >
              <Ionicons name="add" size={18} color="#002147" />
              <Text style={styles.addBtnText}>新增公告</Text>
            </TouchableOpacity>
          )}
        </View>

        {announcements.length === 0 ? (
          <Text style={{ color: '#999', marginBottom: 20 }}>暫無公告</Text>
        ) : announcements.map((ann) => (
          <View key={ann.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{ann.title}</Text>
              {isAdmin && (
                <View style={styles.cardActions}>
                  <TouchableOpacity onPress={() => handleOpenEdit(ann)}>
                    <Ionicons name="pencil" size={20} color="#C69C6D" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <Text style={styles.cardContent}>{ann.content}</Text>
            <Text style={styles.cardFooter}>{ann.date} | {ann.author}</Text>
          </View>
        ))}

        {/* --- 升級區塊：Dashboard Widgets --- */}

        {/* (A) 異常警示專區 (只有在有問題時才顯示) */}
        {totalPendingIssues > 0 && (
          <View style={styles.alertSection}>
            <View style={styles.alertHeader}>
              <Ionicons name="warning" size={24} color="#FF4D4F" />
              <Text style={styles.alertTitle}>待處理異常: {totalPendingIssues}</Text>
              <TouchableOpacity onPress={() => router.push('/logs')}>
                <Text style={styles.alertLink}>查看全部</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.alertList}>
              {topPendingIssues.map((issue, idx) => (
                <View key={idx} style={styles.alertItem}>
                  <Text style={styles.alertProject} numberOfLines={1}>{issue.projectName}</Text>
                  <Text style={styles.alertContent} numberOfLines={1}>- {issue.content}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* (B) 專案健康度圖表 */}
        {isAdmin && (
          <View style={styles.dashboardCard}>
            <Text style={styles.dashboardCardTitle}>專案健康度分佈</Text>
            <PieChart
              data={[
                { name: '進度正常', population: healthStats.normal, color: '#52c41a', legendFontColor: '#7F7F7F', legendFontSize: 13 },
                { name: '進度落後', population: healthStats.delayed, color: '#ff4d4f', legendFontColor: '#7F7F7F', legendFontSize: 13 }
              ]}
              width={Dimensions.get('window').width - 40}
              height={180}
              chartConfig={{
                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              }}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
              absolute
            />

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
        )}

      </ScrollView>

      {/* Side Menu Modal */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sideMenu}>
            <SafeAreaView style={styles.menuSafeArea}>
              <View style={styles.menuHeader}>
                <Text style={styles.menuTitle}>功能選單</Text>
                <TouchableOpacity onPress={() => setMenuVisible(false)}>
                  <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={styles.menuList}>
                {menuItems.map((item, index) => {
                  if (item.path === '/personnel' && !isAdmin) return null;
                  return (
                    <TouchableOpacity
                      key={index}
                      style={styles.menuItem}
                      onPress={() => navTo(item.path)}
                    >
                      <Ionicons name={item.icon as any} size={24} color="#C69C6D" />
                      <Text style={[styles.menuText, { color: '#fff' }]}>{item.title}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.menuFooter}>
                <TouchableOpacity
                  style={styles.logoutBtn}
                  onPress={() => navTo('/')}
                >
                  <Ionicons name="log-out" size={24} color="#fff" />
                  <Text style={styles.logoutText}>登出系統</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </View>
          <TouchableOpacity style={styles.overlayTouch} onPress={() => setMenuVisible(false)} />
        </View>
      </Modal>

      {/* Announcement Modal */}
      <Modal visible={isAnnounceModalVisible} animationType="slide" transparent onRequestClose={() => setAnnounceModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.announceModalOverlay}>
          <View style={styles.announceModalContent}>
            <View style={styles.announceModalHeader}>
              <Text style={styles.announceModalTitle}>{editingAnnouncement ? '編輯公告' : '新增公告'}</Text>
              <TouchableOpacity onPress={() => setAnnounceModalVisible(false)}>
                <Ionicons name="close" size={26} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.formContainer}>
              <Text style={styles.label}>公告標題</Text>
              <TextInput
                style={styles.input}
                placeholder="請輸入標題"
                value={announceForm.title}
                onChangeText={t => setAnnounceForm({ ...announceForm, title: t })}
              />

              <Text style={styles.label}>公告內容</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="請輸入詳細內容..."
                multiline
                textAlignVertical="top"
                value={announceForm.content}
                onChangeText={t => setAnnounceForm({ ...announceForm, content: t })}
              />
            </View>

            <View style={styles.modalFooter}>
              {editingAnnouncement && (
                <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAnnouncement}>
                  <Text style={styles.deleteBtnText}>刪除</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitAnnouncement}>
                <Text style={styles.submitBtnText}>{editingAnnouncement ? '儲存變更' : '立即發布'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  safeArea: {
    backgroundColor: '#002147',
    paddingTop: Platform.OS === 'android' ? 25 : 0,
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    backgroundColor: '#002147',
  },
  iconBtn: {
    padding: 5,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    padding: 20,
    paddingBottom: 50,
  },
  welcomeText: {
    fontSize: 18,
    color: '#333',
    marginBottom: 25,
  },
  userName: {
    fontWeight: 'bold',
    color: '#002147',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#002147',
  },
  addBtn: {
    flexDirection: 'row',
    backgroundColor: '#C69C6D',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  addBtnText: {
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 5,
    fontSize: 14,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  cardActions: {
    flexDirection: 'row',
  },
  cardContent: {
    fontSize: 15,
    color: '#555',
    lineHeight: 22,
    marginBottom: 15,
  },
  cardFooter: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 5,
    elevation: 2,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#C69C6D',
  },
  statLabel: {
    color: '#666',
    marginTop: 5,
  },
  // Side Menu
  modalOverlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sideMenu: {
    width: '80%',
    maxWidth: 300,
    backgroundColor: '#002147',
    height: '100%',
  },
  overlayTouch: {
    flex: 1,
  },
  menuSafeArea: {
    flex: 1,
    padding: 20,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 10,
  },
  menuTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  menuList: {
    flex: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  menuText: {
    fontSize: 18,
    marginLeft: 15,
    fontWeight: '500',
  },
  menuFooter: {
    paddingVertical: 20,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B6B',
    padding: 15,
    borderRadius: 8,
  },
  logoutText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 10,
    fontSize: 16,
  },
  // Announcement Modal
  announceModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  announceModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 25,
    minHeight: '60%',
  },
  announceModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  announceModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#002147',
  },
  formContainer: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  textArea: {
    height: 150,
    paddingTop: 15,
  },
  modalFooter: {
    flexDirection: 'row',
    marginTop: 20,
    justifyContent: 'flex-end',
  },
  submitBtn: {
    backgroundColor: '#C69C6D',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 10,
    alignItems: 'center',
    flex: 1,
    marginLeft: 10,
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  deleteBtn: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 10,
    alignItems: 'center',
    width: 100,
  },
  deleteBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  // --- 升級樣式 ---
  alertSection: {
    backgroundColor: '#FFF1F0',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFA39E',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF4D4F',
    marginLeft: 8,
    flex: 1,
  },
  alertLink: {
    color: '#1890FF',
    fontSize: 14,
  },
  alertList: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 8,
    padding: 10,
  },
  alertItem: {
    flexDirection: 'row',
    marginBottom: 5,
    alignItems: 'center',
  },
  alertProject: {
    fontWeight: 'bold',
    color: '#333',
    width: 100,
    fontSize: 13,
  },
  alertContent: {
    color: '#666',
    flex: 1,
    fontSize: 13,
  },
  dashboardCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  dashboardCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#002147',
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 15,
  },
});