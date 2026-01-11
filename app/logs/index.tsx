import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Platform, StatusBar, Modal, Image, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../../context/UserContext';
import { useState } from 'react';

const THEME = { primary: '#C69C6D', background: '#F5F7FA', card: '#ffffff', headerBg: '#002147', text: '#333' };

export default function LogsScreen() {
  const router = useRouter();
  const { logout } = useUser();
  const [menuVisible, setMenuVisible] = useState(false);

  const [logs] = useState([
    { id: '1', date: '2026/01/10', project: '台中七期商辦', weather: '晴', content: '1. 基礎開挖\n2. 鋼筋綁紮' },
    { id: '2', date: '2026/01/09', project: '台中七期商辦', weather: '多雲', content: '1. 安全圍籬架設\n2. 測量放樣' },
  ]);

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} onPress={() => router.push(`/logs/${item.id}`)}>
      <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:10}}>
        <Text style={{fontWeight:'bold', color:'#666'}}>{item.date}</Text>
        <View style={{backgroundColor:'#F4A261', paddingHorizontal:8, borderRadius:4}}><Text style={{color:'#fff', fontSize:12}}>{item.weather}</Text></View>
      </View>
      <Text style={{fontSize:18, fontWeight:'bold', color:THEME.headerBg}}>{item.project}</Text>
      <View style={{height:1, backgroundColor:'#eee', marginVertical:10}} />
      <Text style={{color:'#444', lineHeight:22}} numberOfLines={2}>{item.content}</Text>
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
        <Text style={styles.pageTitle}>施工紀錄</Text>
        <FlatList data={logs} keyExtractor={item => item.id} renderItem={renderItem} contentContainerStyle={styles.listContent} />
        <TouchableOpacity style={styles.fab} onPress={() => Alert.alert('新增日誌', '功能開發中')}><Ionicons name="add" size={30} color="#fff" /></TouchableOpacity>
      </View>

      <Modal visible={menuVisible} animationType="fade" transparent={true} onRequestClose={() => setMenuVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sideMenu}>
            <SafeAreaView style={{ flex: 1 }}>
              <View style={styles.menuHeader}><Ionicons name="clipboard" size={24} color="#fff" /><Text style={styles.menuTitle}>施工紀錄</Text><TouchableOpacity onPress={() => setMenuVisible(false)} style={{marginLeft:'auto'}}><Ionicons name="close" size={28} color="#fff" /></TouchableOpacity></View>
              <View style={styles.menuDivider} />
              <MenuItem icon="home-outline" label="首頁" onPress={() => { setMenuVisible(false); router.push('/dashboard'); }} />
              <MenuItem icon="folder-outline" label="專案列表" onPress={() => { setMenuVisible(false); router.push('/projects'); }} />
              <MenuItem icon="clipboard" label="施工紀錄" isActive={true} onPress={() => setMenuVisible(false)} />
              <MenuItem icon="people-outline" label="人員管理" onPress={() => { setMenuVisible(false); router.push('/personnel'); }} />
              <MenuItem icon="library-outline" label="SOP資料庫" onPress={() => { setMenuVisible(false); router.push('/sop'); }} />
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
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 12, marginBottom: 15, elevation: 2 },
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