import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, Image, StatusBar, Platform, SafeAreaView, ScrollView } from 'react-native';
import { Stack, useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useLogs, LogEntry } from '../../context/LogContext';
import { useProjects } from '../../context/ProjectContext';
import { useUser } from '../../context/UserContext';
import { format } from 'date-fns';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';

LocaleConfig.locales['zh-tw'] = {
  monthNames: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
  monthNamesShort: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  dayNames: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
  dayNamesShort: ['日', '一', '二', '三', '四', '五', '六'],
  today: '今天'
};
LocaleConfig.defaultLocale = 'zh-tw';

// 內建選單 (與首頁一致)
const MenuSidebar = ({ visible, onClose, router }: any) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.menuContent} onStartShouldSetResponder={() => true}>
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
      </TouchableOpacity>
    </Modal>
  );
};

export default function LogsScreen() {
  const router = useRouter();
  const { logs } = useLogs();
  const { projects } = useProjects();
  const { user } = useUser();

  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [menuVisible, setMenuVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin' || user?.email === 'wu@dwcc.com.tw';

  // 1. 統一的異常判定
  const markedDates = useMemo(() => {
    const marks: any = {};
    (logs || []).forEach(log => {
      if (log.date) {
        const issueStr = log.issues ? String(log.issues).trim() : '';
        const isIssue = log.status === 'issue' || issueStr.length > 0;

        // 紅色優先
        if (marks[log.date]?.dotColor === '#EF4444') return;

        marks[log.date] = {
          marked: true,
          dotColor: isIssue ? '#EF4444' : '#002147'
        };
      }
    });
    marks[selectedDate] = { ...(marks[selectedDate] || {}), selected: true, selectedColor: '#C69C6D' };
    return marks;
  }, [logs, selectedDate]);

  const dailyLogs = useMemo(() => {
    return (logs || []).filter(log => log.date === selectedDate);
  }, [logs, selectedDate]);

  const getProjectName = (pid?: string, fallbackName?: string) => {
    if (!pid) return fallbackName || '未知專案';
    const p = projects.find(item => item.id === pid);
    if (p) return p.name;
    return fallbackName || '未知專案';
  };

  const handleDelete = async (id: string) => {
    if (Platform.OS === 'web') {
      if (confirm('確定刪除?')) await deleteDoc(doc(db, 'logs', id));
    } else {
      Alert.alert('刪除確認', '確定要永久刪除此日誌嗎？', [
        { text: '取消', style: 'cancel' },
        { text: '刪除', style: 'destructive', onPress: async () => await deleteDoc(doc(db, 'logs', id)) }
      ]);
    }
  };

  const LogCard = ({ item }: { item: LogEntry }) => {
    // 統一異常判斷：只要 issues 有字就算異常
    const issueText = item.issues ? String(item.issues).trim() : '';
    const showIssue = item.status === 'issue' || issueText.length > 0;

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          {showIssue && <View style={styles.tagIssue}><Text style={{ color: '#fff', fontSize: 10 }}>⚠️ 異常列管</Text></View>}
          <View style={[styles.tagStatus, { backgroundColor: item.status === 'approved' ? '#4CAF50' : '#FF9800' }]}>
            <Text style={{ color: '#fff', fontSize: 10 }}>{item.status === 'approved' ? '已核准' : '審核中'}</Text>
          </View>
        </View>
        <Text style={styles.projName}>{getProjectName(item.projectId, item.project)}</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoText}>🌤 {item.weather}</Text>
          <Text style={styles.infoText}>👤 {item.reporter || '未知'}</Text>
        </View>

        <Text style={styles.content}>{item.content}</Text>

        {item.photos && item.photos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
            {item.photos.map((url, i) => (
              <TouchableOpacity key={i} onPress={() => setPreviewImage(url)}>
                <Image source={{ uri: url }} style={styles.thumb} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={styles.actions}>
          <TouchableOpacity onPress={() => router.push(`/logs/${item.id}`)}><Ionicons name="create-outline" size={20} color="#666" /></TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item.id)}><Ionicons name="trash-outline" size={20} color="red" /></TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#002147" />

      <MenuSidebar visible={menuVisible} onClose={() => setMenuVisible(false)} router={router} />

      <SafeAreaView style={styles.headerSafeArea}>
        <View style={styles.customHeader}>
          <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.iconBtn}>
            <Ionicons name="menu" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>施工日誌</Text>
          <TouchableOpacity onPress={() => router.push({ pathname: '/logs/new', params: { date: selectedDate } })} style={styles.iconBtn}>
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View style={{ backgroundColor: '#fff', paddingBottom: 10 }}>
        <Calendar
          current={selectedDate}
          onDayPress={(day: any) => setSelectedDate(day.dateString)}
          markedDates={markedDates}
          theme={{ selectedDayBackgroundColor: '#C69C6D', todayTextColor: '#C69C6D', arrowColor: '#002147' }}
        />
      </View>

      <FlatList
        data={dailyLogs}
        keyExtractor={i => i.id}
        renderItem={({ item }) => <LogCard item={item} />}
        contentContainerStyle={{ padding: 15 }}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 30, color: '#999' }}>本日無紀錄</Text>}
      />

      <Modal visible={!!previewImage} transparent onRequestClose={() => setPreviewImage(null)}>
        <TouchableOpacity style={styles.previewOverlay} activeOpacity={1} onPress={() => setPreviewImage(null)}>
          <Image source={{ uri: previewImage || '' }} style={styles.fullImage} resizeMode="contain" />
          <TouchableOpacity style={styles.closePreview} onPress={() => setPreviewImage(null)}>
            <Ionicons name="close-circle" size={40} color="#fff" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  headerSafeArea: { backgroundColor: '#002147' },
  customHeader: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  iconBtn: { padding: 5 },
  card: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 15 },
  cardTop: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 5, gap: 5 },
  tagIssue: { backgroundColor: '#FF8F00', padding: 4, borderRadius: 4 },
  tagStatus: { padding: 4, borderRadius: 4 },
  projName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  infoRow: { flexDirection: 'row', gap: 10, marginTop: 5 },
  infoText: { fontSize: 12, color: '#666' },
  content: { marginTop: 8, color: '#444', lineHeight: 20 },
  thumb: { width: 60, height: 60, borderRadius: 5, marginRight: 8, backgroundColor: '#eee' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 15, marginTop: 10, borderTopWidth: 1, borderColor: '#eee', paddingTop: 10 },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row' },
  menuContent: { width: '75%', backgroundColor: '#002147', height: '100%', padding: 20, paddingTop: 50 },
  menuHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30, alignItems: 'center' },
  menuTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  menuItemText: { color: '#fff', fontSize: 17 },
  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: '100%', height: '80%' },
  closePreview: { position: 'absolute', top: 40, right: 20 }
});