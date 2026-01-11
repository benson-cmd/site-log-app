import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Platform, StatusBar, Modal, Image, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../../context/UserContext';
import { useState } from 'react';

const THEME = { primary: '#C69C6D', background: '#F5F7FA', card: '#ffffff', headerBg: '#002147', text: '#333333' };

const MOCK_SOP = [
  { id: '1', title: '模板支撐作業標準', category: '結構工程', date: '2023-10-01' },
  { id: '2', title: '鋼筋綁紮查驗規範', category: '結構工程', date: '2023-10-05' },
];

export default function SOPScreen() {
  const router = useRouter();
  const { logout } = useUser();
  const [menuVisible, setMenuVisible] = useState(false);

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} onPress={() => Alert.alert('預覽', `正在下載：${item.title}.pdf`)}>
      <View style={{width:40, height:40, backgroundColor:'#FFF5E6', borderRadius:8, justifyContent:'center', alignItems:'center', marginRight:15}}>
        <Ionicons name="document-text" size={24} color={THEME.primary} />
      </View>
      <View style={{flex:1}}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={{color:'#666', fontSize:13}}>{item.category} • {item.date}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#ccc" />
    </TouchableOpacity>
  );

  const MenuItem = ({ icon, label, onPress, isLogout = false, isActive = false }: any) => (
    <TouchableOpacity style={[styles.menuItem, isActive && styles.menuItemActive]} onPress={onPress}>
      <Ionicons name={icon} size={24} color={isLogout ? '#FF6B6B' : '#fff'} />
      <Text style={[styles.menuItemText, isLogout && { color: '#FF6B6B' }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.mainContainer}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.customHeaderSafeArea}>
        <StatusBar barStyle="light-content" backgroundColor={THEME.headerBg} />
        <View style={styles.customHeaderContent}>
          <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.menuButton}><Ionicons name="menu" size={32} color="#fff" /></TouchableOpacity>
          <View style={styles.brandContainer}>
            <Image source={require('../../assets/logo.png')} style={styles.headerLogo} resizeMode="contain" />
            <Text style={styles.brandText}>DW工程日誌系統</Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.contentContainer}>
        <Text style={styles.pageTitle}>SOP 資料庫</Text>
        <FlatList data={MOCK_SOP} keyExtractor={item => item.id} renderItem={renderItem} contentContainerStyle={styles.listContent} />
        <TouchableOpacity style={styles.fab} onPress={() => Alert.alert('提示', '上傳檔案功能開發中')}>
          <Ionicons name="cloud-upload" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      <Modal visible={menuVisible} animationType="fade" transparent={true} onRequestClose={() => setMenuVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sideMenu}>
            <SafeAreaView style={{ flex: 1 }}>
              <View style={styles.menuHeader}><Ionicons name="library" size={24} color="#fff" /><Text style={styles.menuTitle}>SOP資料庫</Text><TouchableOpacity onPress={() => setMenuVisible(false)} style={{marginLeft:'auto'}}><Ionicons name="close" size={28} color="#fff" /></TouchableOpacity></View>
              <View style={styles.menuDivider} />
              <MenuItem icon="home-outline" label="首頁" onPress={() => { setMenuVisible(false); router.push('/dashboard'); }} />
              <MenuItem icon="folder-outline" label="專案列表" onPress={() => { setMenuVisible(false); router.push('/projects'); }} />
              <MenuItem icon="clipboard-outline" label="施工紀錄" onPress={() => { setMenuVisible(false); router.push('/logs'); }} />
              <MenuItem icon="people-outline" label="人員管理" onPress={() => { setMenuVisible(false); router.push('/personnel'); }} />
              <MenuItem icon="library" label="SOP資料庫" isActive={true} onPress={() => setMenuVisible(false)} />
              <MenuItem icon="calendar-outline" label="行事曆" onPress={() => { setMenuVisible(false); router.push('/calendar'); }} />
              <MenuItem icon="person-circle-outline" label="我的檔案" onPress={() => { setMenuVisible(false); router.push('/profile'); }} />
              <View style={{ flex: 1 }} /><View style={styles.menuDivider} />
              <MenuItem icon="log-out-outline" label="登出系統" isLogout onPress={() => { setMenuVisible(false); logout(); router.replace('/'); }} />
            </SafeAreaView>
          </View>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setMenuVisible(false)} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: THEME.background },
  customHeaderSafeArea: { backgroundColor: THEME.headerBg, paddingTop: Platform.OS === 'android' ? 30 : 0 },
  customHeaderContent: { height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15 },
  menuButton: { marginRight: 15 },
  brandContainer: { flexDirection: 'row', alignItems: 'center' },
  headerLogo: { width: 35, height: 35, marginRight: 10 },
  brandText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  contentContainer: { flex: 1 },
  pageTitle: { fontSize: 24, fontWeight: 'bold', color: THEME.headerBg, margin: 20 },
  listContent: { padding: 20 },
  card: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  fab: { position: 'absolute', right: 20, bottom: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: THEME.primary, justifyContent: 'center', alignItems: 'center', elevation: 8 },
  modalOverlay: { flex: 1, flexDirection: 'row' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sideMenu: { width: 280, backgroundColor: '#002147', height: '100%', padding: 20, paddingTop: 60 },
  menuHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  menuTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginLeft: 15 },
  menuDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 15 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderRadius: 8, paddingHorizontal: 10 },
  menuItemActive: { backgroundColor: 'rgba(198, 156, 109, 0.2)' },
  menuItemText: { fontSize: 18, marginLeft: 15, color: '#fff', fontWeight: '500' }
});