import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Modal, Alert, Platform, StatusBar, TextInput, KeyboardAvoidingView } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../../context/UserContext';
import { useProjects } from '../../context/ProjectContext';
import { useLogs } from '../../context/LogContext';
import { useState } from 'react';

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

  const [menuVisible, setMenuVisible] = useState(false);

  // Announcement States
  const [announcements, setAnnouncements] = useState<Announcement[]>([
    { id: '1', title: '系統上線通知', content: '歡迎使用全新版本，功能選單與頁面路徑已全數修復。', date: '2026/01/15', author: '管理員' }
  ]);
  const [isAnnounceModalVisible, setAnnounceModalVisible] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [announceForm, setAnnounceForm] = useState({ title: '', content: '' });

  // 1. 統計邏輯
  // 進行中專案：Status = 'construction'
  const activeProjectsCount = projects.filter(p => p.status === 'construction').length;
  // 待審核紀錄：Status = 'pending_review' (假設 LogContext 有此狀態)
  const pendingLogsCount = logs.filter(l => l.status === 'pending_review').length;

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

  const handleSubmitAnnouncement = () => {
    if (!announceForm.title || !announceForm.content) {
      Alert.alert('錯誤', '標題與內容不可為空');
      return;
    }

    if (editingAnnouncement) {
      // Update existing
      setAnnouncements(prev => prev.map(a => a.id === editingAnnouncement.id ? {
        ...a,
        title: announceForm.title,
        content: announceForm.content,
        // Optional: update date or keep original
      } : a));
      Alert.alert('成功', '公告已更新');
    } else {
      // Create new
      const newAnn: Announcement = {
        id: Math.random().toString(36).substr(2, 9),
        title: announceForm.title,
        content: announceForm.content,
        date: new Date().toISOString().split('T')[0].replace(/-/g, '/'),
        author: user?.name || '管理員'
      };
      setAnnouncements([newAnn, ...announcements]);
      Alert.alert('成功', '公告已發布');
    }
    setAnnounceModalVisible(false);
  };

  // Delete Announcement
  const handleDeleteAnnouncement = () => {
    if (!editingAnnouncement) return;
    Alert.alert('確認刪除', '確定要刪除此公告嗎？', [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除', style: 'destructive', onPress: () => {
          setAnnouncements(prev => prev.filter(a => a.id !== editingAnnouncement.id));
          setAnnounceModalVisible(false);
        }
      }
    ]);
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
          <TouchableOpacity
            style={styles.addBtn}
            onPress={handleOpenAdd}
          >
            <Ionicons name="add" size={18} color="#002147" />
            <Text style={styles.addBtnText}>新增公告</Text>
          </TouchableOpacity>
        </View>

        {announcements.length === 0 ? (
          <Text style={{ color: '#999', marginBottom: 20 }}>暫無公告</Text>
        ) : announcements.map((ann) => (
          <View key={ann.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{ann.title}</Text>
              <View style={styles.cardActions}>
                <TouchableOpacity onPress={() => handleOpenEdit(ann)}>
                  <Ionicons name="pencil" size={20} color="#C69C6D" />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.cardContent}>{ann.content}</Text>
            <Text style={styles.cardFooter}>{ann.date} | {ann.author}</Text>
          </View>
        ))}

        {/* Dashboard Widgets (Stats) */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{activeProjectsCount}</Text>
            <Text style={styles.statLabel}>進行中專案</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{pendingLogsCount}</Text>
            <Text style={styles.statLabel}>待審核紀錄</Text>
          </View>
        </View>

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
                {menuItems.map((item, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.menuItem}
                    onPress={() => navTo(item.path)}
                  >
                    <Ionicons name={item.icon as any} size={24} color="#C69C6D" />
                    <Text style={[styles.menuText, { color: '#fff' }]}>{item.title}</Text>
                  </TouchableOpacity>
                ))}
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
});