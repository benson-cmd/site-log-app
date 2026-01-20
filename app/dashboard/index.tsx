import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Modal, Alert, Platform, StatusBar } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../../context/UserContext';
import { useState } from 'react';

export default function DashboardScreen() {
  const router = useRouter();
  const { logout, user } = useUser();
  const [menuVisible, setMenuVisible] = useState(false);

  const navTo = (path: string) => {
    setMenuVisible(false);
    // 檢查路徑是否有效，若是根目錄則 replace，否則 push
    if (path === '/') {
      logout();
      router.replace('/');
    } else {
      router.push(path as any);
    }
  };

  const menuItems = [
    { title: '首頁', icon: 'home', path: '/dashboard' },
    { title: '專案列表', icon: 'folder-open', path: '/projects' },
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
          {/* Placeholder for balance */}
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.welcomeText}>
          👋 您好, <Text style={styles.userName}>{user?.name || '使用者'}</Text>!
        </Text>

        {/* Announcement Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>公告欄</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => Alert.alert('管理權限', '開啟新增公告頁面')}
          >
            <Ionicons name="add" size={18} color="#002147" />
            <Text style={styles.addBtnText}>新增公告</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>系統上線通知</Text>
            <View style={styles.cardActions}>
              <TouchableOpacity onPress={() => Alert.alert('管理', '編輯公告')}>
                <Ionicons name="pencil" size={20} color="#C69C6D" />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.cardContent}>歡迎使用全新版本，功能選單與頁面路徑已全數修復。</Text>
          <Text style={styles.cardFooter}>2026/01/15 | 管理員</Text>
        </View>

        {/* Quick Actions / Dashboard Widgets can go here */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>3</Text>
            <Text style={styles.statLabel}>進行中專案</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>12</Text>
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
    // Fix: replaced 'border' shorthand with explicit properties
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
  // Modal / Side Menu
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
});