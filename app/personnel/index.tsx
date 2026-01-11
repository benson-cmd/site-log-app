import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Platform, StatusBar, Modal, Image, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../../context/UserContext';
import { useState } from 'react';

// --- 1. 共用樣式設定 ---
const THEME = {
  primary: '#C69C6D',
  background: '#F5F7FA',
  card: '#ffffff',
  headerBg: '#002147',
  text: '#333333'
};

// --- 2. SOP 假資料 ---
const MOCK_SOP = [
  { id: '1', title: '模板支撐作業標準', category: '結構工程', date: '2023-10-01' },
  { id: '2', title: '鋼筋綁紮查驗規範', category: '結構工程', date: '2023-10-05' },
  { id: '3', title: '工地安全衛生守則', category: '勞工安全', date: '2023-11-12' },
  { id: '4', title: '混凝土澆置計畫', category: '結構工程', date: '2023-12-01' },
];

export default function SOPScreen() {
  const router = useRouter();
  const { logout } = useUser(); // 取得登出功能
  const [menuVisible, setMenuVisible] = useState(false); // 控制選單

  // 渲染 SOP 卡片
  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => Alert.alert('預覽文件', `正在開啟：${item.title}`)}
    >
      <View style={styles.cardContent}>
        {/* 左側圖示 */}
        <View style={styles.iconBox}>
          <Ionicons name="document-text" size={28} color={THEME.primary} />
        </View>
        
        {/* 中間文字 */}
        <View style={styles.textContainer}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardSubtitle}>{item.category} • {item.date}</Text>
        </View>

        {/* 右側箭頭 */}
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      </View>
    </TouchableOpacity>
  );

  // --- 3. 共用側邊選單組件 (Side Menu) ---
  // 選單單項組件
  const MenuItem = ({ icon, label, onPress, isLogout = false, isActive = false }: any) => (
    <TouchableOpacity style={[styles.menuItem, isActive && styles.menuItemActive]} onPress={onPress}>
      <Ionicons name={icon} size={24} color={isLogout ? '#FF6B6B' : (isActive ? THEME.primary : '#fff')} />
      <Text style={[styles.menuItemText, isLogout && { color: '#FF6B6B' }, isActive && { color: THEME.primary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const SideMenu = () => (
    <Modal visible={menuVisible} animationType="none" transparent={true} onRequestClose={() => setMenuVisible(false)}>
      <View style={styles.modalOverlay}>
        
        {/* 左側選單本體 */}
        <View style={styles.sideMenu}>
          <SafeAreaView style={{ flex: 1 }}>
            
            {/* 選單 Header */}
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>功能選單</Text>
              <TouchableOpacity onPress={() => setMenuVisible(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.menuDivider} />

            {/* 選單項目 */}
            <MenuItem 
              icon="folder-outline" 
              label="專案列表" 
              onPress={() => { setMenuVisible(false); router.push('/projects'); }} 
            />
            <MenuItem 
              icon="clipboard-outline" 
              label="施工紀錄" 
              onPress={() => { setMenuVisible(false); router.push('/logs'); }} 
            />
            <MenuItem 
              icon="people-outline" 
              label="人員管理" 
              onPress={() => { setMenuVisible(false); router.push('/personnel'); }} 
            />
            <MenuItem 
              icon="library" 
              label="SOP資料庫" 
              isActive={true} // 設定目前為 SOP 頁面
              onPress={() => setMenuVisible(false)} 
            />
            <MenuItem 
              icon="calendar-outline" 
              label="行事曆" 
              onPress={() => { setMenuVisible(false); router.push('/calendar'); }} 
            />
            <MenuItem 
              icon="person-circle-outline" 
              label="我的檔案" 
              onPress={() => { setMenuVisible(false); router.push('/profile'); }} 
            />

            <View style={{ flex: 1 }} />
            
            <View style={styles.menuDivider} />
            <MenuItem 
              icon="log-out-outline" 
              label="登出系統" 
              isLogout 
              onPress={() => { setMenuVisible(false); logout(); router.replace('/'); }} 
            />
            
          </SafeAreaView>
        </View>

        {/* 右側遮罩 */}
        <TouchableOpacity style={styles.modalBackdrop} onPress={() => setMenuVisible(false)} activeOpacity={1} />
      
      </View>
    </Modal>
  );

  return (
    <View style={styles.mainContainer}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* --- 頁面 Header (深藍色 + Logo) --- */}
      <SafeAreaView style={styles.customHeaderSafeArea}>
        <StatusBar barStyle="light-content" backgroundColor={THEME.headerBg} />
        <View style={styles.customHeaderContent}>
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
      </SafeAreaView>

      {/* --- 頁面內容 --- */}
      <View style={styles.contentContainer}>
        <Text style={styles.pageTitle}>SOP 資料庫</Text>
        
        {/* 搜尋框 */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" style={{ marginRight: 10 }} />
          <Text style={{ color: '#999' }}>搜尋規範或標準...</Text>
        </View>

        <FlatList 
          data={MOCK_SOP}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />

        {/* 上傳按鈕 */}
        <TouchableOpacity style={styles.fab} onPress={() => Alert.alert('提示', '上傳 PDF 功能開發中')}>
          <Ionicons name="cloud-upload" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* 掛載選單 */}
      <SideMenu />
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: THEME.background },
  
  // Header 樣式
  customHeaderSafeArea: { backgroundColor: THEME.headerBg, paddingTop: Platform.OS === 'android' ? 30 : 0 },
  customHeaderContent: { height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15 },
  menuButton: { marginRight: 15 },
  brandContainer: { flexDirection: 'row', alignItems: 'center' },
  headerLogo: { width: 35, height: 35, marginRight: 10 },
  brandText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },

  // 內容區樣式
  contentContainer: { flex: 1 },
  pageTitle: { fontSize: 24, fontWeight: 'bold', color: THEME.headerBg, margin: 20, marginBottom: 10 },
  searchContainer: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', 
    marginHorizontal: 20, marginBottom: 15, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#eee' 
  },
  listContent: { padding: 20, paddingTop: 0 },
  
  // 卡片樣式
  card: { 
    backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 12, 
    flexDirection: 'row', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 
  },
  cardContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconBox: { 
    width: 50, height: 50, borderRadius: 10, backgroundColor: '#FFF5E6', 
    justifyContent: 'center', alignItems: 'center', marginRight: 15 
  },
  textContainer: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: '#666' },

  fab: { 
    position: 'absolute', right: 20, bottom: 30, width: 60, height: 60, borderRadius: 30, 
    backgroundColor: THEME.primary, justifyContent: 'center', alignItems: 'center', elevation: 8 
  },

  // --- 選單樣式 (複製自 Projects) ---
  modalOverlay: { flex: 1, flexDirection: 'row' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sideMenu: { 
    width: 280, backgroundColor: '#002147', height: '100%', 
    padding: 20, paddingTop: Platform.OS === 'android' ? 50 : 60 
  },
  menuHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  menuTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginLeft: 10 },
  menuDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 15 },
  menuItem: { 
    flexDirection: 'row', alignItems: 'center', paddingVertical: 15, 
    borderRadius: 8, paddingHorizontal: 10 
  },
  menuItemActive: { backgroundColor: 'rgba(198, 156, 109, 0.2)' },
  menuItemText: { fontSize: 18, marginLeft: 15, color: '#fff', fontWeight: '500' }
});