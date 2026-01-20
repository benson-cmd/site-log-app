import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Platform, StatusBar, Modal, Image, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../../context/UserContext';
import { useState } from 'react';

const THEME = {
  primary: '#C69C6D',
  background: '#F5F7FA',
  card: '#ffffff',
  headerBg: '#002147',
  text: '#333333',
  menuBg: '#002147', // 深藍色選單背景
  menuText: '#ffffff'
};

type Project = {
  id: string;
  name: string;
  address: string;
  manager: string;
  progress: number;
};

// 模擬資料
const MOCK_PROJECTS: Project[] = [];

export default function ProjectsScreen() {
  const router = useRouter();
  const { user, logout } = useUser();
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);

  // 控制選單開關
  const [menuVisible, setMenuVisible] = useState(false);

  // 登出邏輯
  const handleLogout = () => {
    setMenuVisible(false);
    logout();
    router.replace('/');
  };

  // 選單項目組件 (依照您的截圖設計)
  const MenuItem = ({ icon, label, onPress, isLogout = false, isActive = false }: any) => (
    <TouchableOpacity
      style={[styles.menuItem, isActive && styles.menuItemActive]}
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={24}
        color={isLogout ? '#FF6B6B' : (isActive ? THEME.primary : '#fff')}
      />
      <Text style={[
        styles.menuItemText,
        isLogout && { color: '#FF6B6B' },
        isActive && { color: THEME.primary, fontWeight: 'bold' }
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderItem = ({ item }: { item: Project }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/projects/${item.id}`)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.projectTitle}>{item.name}</Text>
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </View>
      <Text style={styles.projectInfo}>📍 {item.address}</Text>
      <Text style={styles.projectInfo}>👷 主任：{item.manager}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.mainContainer}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <SafeAreaView style={styles.customHeaderSafeArea}>
        <StatusBar barStyle="light-content" backgroundColor={THEME.headerBg} />
        <View style={styles.customHeaderContent}>
          <View style={styles.headerLeftContainer}>
            <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.menuButton}>
              <Ionicons name="menu" size={32} color="#fff" />
            </TouchableOpacity>
            <View style={styles.brandContainer}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.headerLogo}
                resizeMode="contain"
              />
              <Text style={styles.brandText}>DW工程日誌系統</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      {/* 內容列表 */}
      <View style={styles.contentContainer}>
        <Text style={styles.pageTitle}>專案列表</Text>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <Text style={styles.searchPlaceholder}>搜尋專案...</Text>
        </View>
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="folder-open-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>目前沒有專案</Text>
            </View>
          }
        />
        {user && (
          <TouchableOpacity style={styles.fab} onPress={() => router.push('/projects/new')}>
            <Ionicons name="add" size={30} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* ⭐️ 修正後的左側深藍色選單 */}
      <Modal
        visible={menuVisible}
        animationType="none" // 改成 none 避免動畫造成視覺錯位，或改用 fade
        transparent={true}
        onRequestClose={() => setMenuVisible(false)}
      >
        <View style={styles.modalOverlay}>

          {/* 1. 左側選單 (Side Menu) - 放在第一個就是左邊 */}
          <View style={styles.sideMenu}>
            <SafeAreaView style={{ flex: 1 }}>

              {/* 選單頂部 */}
              <View style={styles.menuHeader}>
                <Ionicons name="home" size={28} color="#fff" />
                <Text style={styles.menuTitle}>首頁</Text>
                {/* 關閉按鈕 */}
                <TouchableOpacity onPress={() => setMenuVisible(false)} style={{ marginLeft: 'auto' }}>
                  <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={styles.menuDivider} />

              {/* 選單項目 (依照截圖順序) */}
              <MenuItem
                icon="folder-open"
                label="專案列表"
                isActive={true} // 目前在專案列表頁
                onPress={() => setMenuVisible(false)}
              />
              <MenuItem
                icon="clipboard"
                label="施工紀錄"
                onPress={() => { setMenuVisible(false); router.push('/logs'); }}
              />
              <MenuItem
                icon="people"
                label="人員管理"
                onPress={() => { setMenuVisible(false); router.push('/personnel'); }}
              />
              <MenuItem
                icon="library"
                label="SOP資料庫"
                onPress={() => { setMenuVisible(false); router.push('/sop'); }}
              />
              <MenuItem
                icon="calendar"
                label="行事曆"
                onPress={() => { setMenuVisible(false); router.push('/calendar'); }}
              />
              <MenuItem
                icon="person-circle"
                label="我的檔案"
                onPress={() => { setMenuVisible(false); router.push('/profile'); }}
              />

              <View style={{ flex: 1 }} />

              <View style={styles.menuDivider} />
              <MenuItem
                icon="log-out-outline"
                label="登出系統"
                isLogout
                onPress={handleLogout}
              />

            </SafeAreaView>
          </View>

          {/* 2. 右側遮罩 (Backdrop) - 放在第二個就會填滿右邊 */}
          <TouchableOpacity
            style={styles.modalBackdrop}
            onPress={() => setMenuVisible(false)}
            activeOpacity={1}
          />

        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: THEME.background },
  customHeaderSafeArea: { backgroundColor: THEME.headerBg, paddingTop: Platform.OS === 'android' ? 30 : 0 },
  customHeaderContent: { height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15 },
  headerLeftContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', flex: 1 },
  menuButton: { padding: 5, marginRight: 15 },
  brandContainer: { flexDirection: 'row', alignItems: 'center' },
  headerLogo: { width: 35, height: 35, marginRight: 10 },
  brandText: { color: '#fff', fontSize: 20, fontWeight: 'bold', letterSpacing: 1 },
  contentContainer: { flex: 1 },
  pageTitle: { fontSize: 24, fontWeight: 'bold', color: THEME.headerBg, marginHorizontal: 15, marginTop: 20, marginBottom: 10 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 15, marginBottom: 15, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
  searchIcon: { marginRight: 10 },
  searchPlaceholder: { color: '#999' },
  listContent: { padding: 15, paddingTop: 0 },
  card: { backgroundColor: THEME.card, padding: 20, borderRadius: 12, marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  projectTitle: { fontSize: 18, fontWeight: 'bold', color: THEME.headerBg },
  projectInfo: { color: '#666', marginBottom: 5 },
  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyText: { marginTop: 10, color: '#999', fontSize: 16 },
  fab: { position: 'absolute', right: 20, bottom: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: THEME.primary, justifyContent: 'center', alignItems: 'center', elevation: 8, zIndex: 999 },

  // --- 關鍵：側邊選單樣式 (Left Side Menu) ---
  modalOverlay: {
    flex: 1,
    flexDirection: 'row', // ⭐️ 讓選單(左)和遮罩(右)並排
  },
  sideMenu: {
    width: 280, // 選單寬度固定
    backgroundColor: '#002147', // ⭐️ 深藍色背景
    height: '100%',
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 50 : 60, // 避開狀態列
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalBackdrop: {
    flex: 1, // 填滿剩餘空間
    backgroundColor: 'rgba(0,0,0,0.5)' // 半透明黑底
  },

  // 選單內部樣式
  menuHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingHorizontal: 10 },
  menuTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginLeft: 15 },
  menuDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 10 },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 5
  },
  menuItemActive: {
    backgroundColor: 'rgba(198, 156, 109, 0.2)', // 選中時的淺金色背景
  },
  menuItemText: {
    fontSize: 18,
    marginLeft: 20,
    color: '#fff',
    fontWeight: '500'
  }
});