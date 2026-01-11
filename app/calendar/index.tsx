import { View, Text, StyleSheet, SafeAreaView, Platform, StatusBar, Modal, Image, TouchableOpacity } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../../context/UserContext';
import { useState } from 'react';

const THEME = { primary: '#C69C6D', background: '#F5F7FA', headerBg: '#002147' };

export default function CalendarScreen() {
  const router = useRouter();
  const { logout } = useUser();
  const [menuVisible, setMenuVisible] = useState(false);

  const MenuItem = ({ icon, label, onPress, isLogout = false, isActive = false }: any) => (
    <TouchableOpacity style={[styles.menuItem, isActive && styles.menuItemActive]} onPress={onPress}>
      <Ionicons name={icon} size={24} color={isLogout ? '#FF6B6B' : '#fff'} />
      <Text style={[styles.menuItemText, isLogout && { color: '#FF6B6B' }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.mainContainer}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* 補回 Header */}
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

      <View style={{flex:1, justifyContent:'center', alignItems:'center'}}>
        <Ionicons name="calendar" size={80} color={THEME.primary} />
        <Text style={{fontSize:20, marginTop:20, color:'#666'}}>行事曆功能串接中...</Text>
      </View>

      <Modal visible={menuVisible} animationType="fade" transparent={true} onRequestClose={() => setMenuVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sideMenu}>
            <SafeAreaView style={{ flex: 1 }}>
              <View style={styles.menuHeader}><Ionicons name="calendar" size={24} color="#fff" /><Text style={styles.menuTitle}>行事曆</Text><TouchableOpacity onPress={() => setMenuVisible(false)} style={{marginLeft:'auto'}}><Ionicons name="close" size={28} color="#fff" /></TouchableOpacity></View>
              <View style={styles.menuDivider} />
              <MenuItem icon="home-outline" label="首頁" onPress={() => { setMenuVisible(false); router.push('/dashboard'); }} />
              <MenuItem icon="folder-outline" label="專案列表" onPress={() => { setMenuVisible(false); router.push('/projects'); }} />
              <MenuItem icon="clipboard-outline" label="施工紀錄" onPress={() => { setMenuVisible(false); router.push('/logs'); }} />
              <MenuItem icon="people-outline" label="人員管理" onPress={() => { setMenuVisible(false); router.push('/personnel'); }} />
              <MenuItem icon="library-outline" label="SOP資料庫" onPress={() => { setMenuVisible(false); router.push('/sop'); }} />
              <MenuItem icon="calendar" label="行事曆" isActive={true} onPress={() => setMenuVisible(false)} />
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