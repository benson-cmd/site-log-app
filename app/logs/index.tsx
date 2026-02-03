import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, Image, StatusBar, ScrollView, ActivityIndicator, SafeAreaView, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useMemo } from 'react';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';
import { useProjects } from '../../context/ProjectContext';
import { useUser } from '../../context/UserContext';
import { useLogs, LogEntry } from '../../context/LogContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Calendar, LocaleConfig } from 'react-native-calendars';

// 設定日曆中文化
LocaleConfig.locales['zh-tw'] = {
  monthNames: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
  monthNamesShort: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  dayNames: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
  dayNamesShort: ['週日', '週一', '週二', '週三', '週四', '週五', '週六'],
  today: '今天'
};
LocaleConfig.defaultLocale = 'zh-tw';

export default function LogsScreen() {
  const router = useRouter();
  const { projects } = useProjects();
  const { user } = useUser();
  const { logs } = useLogs();

  // --- State ---
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // --- 邏輯處理 ---
  const isAdmin = user?.role === 'admin' || user?.email === 'wu@dwcc.com.tw';

  // 過濾當天日誌並依權限過濾
  const dailyLogs = useMemo(() => {
    return logs
      .filter(log => log.date === selectedDate)
      .filter(log =>
        isAdmin ||
        log.reporterId === user?.uid ||
        log.status === 'approved'
      );
  }, [logs, selectedDate, isAdmin, user]);

  // 日曆標註點
  const markedDates = useMemo(() => {
    const marks: any = {};
    logs.forEach(log => {
      if (log.date) {
        marks[log.date] = { marked: true, dotColor: '#002147' };
      }
    });
    marks[selectedDate] = {
      ...(marks[selectedDate] || {}),
      selected: true,
      selectedColor: '#C69C6D'
    };
    return marks;
  }, [logs, selectedDate]);

  // 取得專案名稱
  const getProjectName = (projectId: string, fallbackName: string) => {
    const p = projects.find(item => item.id === projectId);
    return p ? p.name : fallbackName;
  };

  const handleDelete = (id: string) => {
    const performDelete = async () => {
      try {
        await deleteDoc(doc(db, 'logs', id));
        toast.success('🗑️ 已刪除');
      } catch (err: any) {
        toast.error('❌ 刪除失敗');
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('確定要永久刪除此日誌嗎？')) performDelete();
    } else {
      Alert.alert('刪除確認', '確定要永久刪除此日誌嗎？', [{ text: '取消' }, { text: '刪除', style: 'destructive', onPress: performDelete }]);
    }
  };

  const handleEdit = (id: string) => {
    router.push(`/logs/${id}`);
  };

  const handleAdd = () => {
    router.push({
      pathname: '/logs/new',
      params: { date: selectedDate }
    });
  };

  // --- UI Components ---
  const LogCard = ({ item }: { item: LogEntry }) => {
    const statusColor = item.status === 'approved' ? '#4CAF50' : (item.status === 'rejected' ? '#F44336' : '#FF9800');

    // 計算出工總人數
    const totalLabor = item.personnelList?.reduce((acc: number, curr: any) => acc + (Number(curr.count) || 0), 0) || 0;
    // 計算機具總數
    const totalMachines = item.machineList?.reduce((acc: number, curr: any) => acc + (Number(curr.quantity) || 0), 0) || 0;

    // 檢查是否有異常狀況 (issues 欄位)
    const hasIssues = !!item.issues;

    return (
      <View style={styles.card}>
        <View style={styles.cardTopStrip}>
          {hasIssues && (
            <View style={styles.issueBadge}>
              <Ionicons name="warning" size={14} color="#fff" />
              <Text style={styles.issueBadgeText}>⚠️ 異常列管</Text>
            </View>
          )}
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>
              {item.status === 'approved' ? '已核准' : (item.status === 'rejected' ? '已退回' : '審核中')}
            </Text>
          </View>
        </View>

        <Text style={styles.projectTitle}>{getProjectName(item.projectId || '', item.project)}</Text>

        <View style={styles.cardInfoRow}>
          <View style={styles.infoBadge}>
            <Ionicons name="sunny" size={12} color="#F9A825" />
            <Text style={styles.infoText}>{item.weather}</Text>
          </View>
          <View style={styles.infoBadge}>
            <Ionicons name="people" size={12} color="#002147" />
            <Text style={styles.infoText}>{totalLabor} 人</Text>
          </View>
          {totalMachines > 0 && (
            <View style={styles.infoBadge}>
              <Ionicons name="construct" size={12} color="#795548" />
              <Text style={styles.infoText}>{totalMachines} 台</Text>
            </View>
          )}
        </View>

        <Text style={styles.cardContent} numberOfLines={3}>{item.content}</Text>

        {item.photos && item.photos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoPreviewRow}>
            {item.photos.map((url, idx) => (
              <TouchableOpacity key={idx} onPress={() => setPreviewImage(url)}>
                <Image source={{ uri: url }} style={styles.cardPhoto} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.reporterText}>填寫: {item.reporter}</Text>
          <View style={styles.cardActions}>
            <TouchableOpacity onPress={() => handleEdit(item.id)}>
              <Ionicons name="create-outline" size={24} color="#C69C6D" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item.id)}>
              <Ionicons name="trash-outline" size={24} color="#FF6B6B" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#002147" />

      <SafeAreaView style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.push('/dashboard')}>
            <Ionicons name="home" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>施工日誌</Text>
          <TouchableOpacity onPress={handleAdd}>
            <Ionicons name="add" size={30} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View style={styles.calendarContainer}>
        <Calendar
          onDayPress={(day: any) => setSelectedDate(day.dateString)}
          markedDates={markedDates}
          theme={{
            selectedDayBackgroundColor: '#C69C6D',
            todayTextColor: '#C69C6D',
            arrowColor: '#002147',
            dotColor: '#002147',
            monthTextColor: '#002147',
            textMonthFontWeight: 'bold',
          }}
        />
      </View>

      <FlatList
        data={dailyLogs}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <LogCard item={item} />}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={
          <View style={styles.dateHeader}>
            <View style={styles.headerDot} />
            <Text style={styles.selectedDateHeader}>{selectedDate} 施工紀錄</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={60} color="#ccc" />
            <Text style={styles.emptyText}>本日尚無施工紀錄</Text>
            <TouchableOpacity style={styles.emptyAddBtn} onPress={handleAdd}>
              <Text style={styles.emptyAddBtnText}>立即填寫日誌</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={handleAdd}>
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      {/* 圖片預覽 Modal */}
      <Modal visible={!!previewImage} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
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
  header: { backgroundColor: '#002147' },
  headerContent: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  calendarContainer: { backgroundColor: '#fff', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee', elevation: 2 },
  listContainer: { padding: 16, paddingBottom: 100 },
  dateHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  headerDot: { width: 6, height: 18, backgroundColor: '#C69C6D', borderRadius: 3, marginRight: 8 },
  selectedDateHeader: { fontSize: 18, fontWeight: 'bold', color: '#002147' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, position: 'relative', overflow: 'hidden' },
  cardTopStrip: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 5, gap: 8 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6 },
  statusText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  issueBadge: { backgroundColor: '#FF8F00', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 },
  issueBadgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  projectTitle: { fontSize: 19, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  cardInfoRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  infoBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F4F8', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 },
  infoText: { fontSize: 12, color: '#444', fontWeight: '500' },
  cardContent: { fontSize: 15, color: '#444', lineHeight: 22, marginBottom: 12 },
  photoPreviewRow: { flexDirection: 'row', marginBottom: 12 },
  cardPhoto: { width: 75, height: 75, borderRadius: 10, marginRight: 10, backgroundColor: '#eee' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12 },
  reporterText: { fontSize: 13, color: '#999' },
  cardActions: { flexDirection: 'row', gap: 18 },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#999', fontSize: 16, marginTop: 12 },
  emptyAddBtn: { marginTop: 24, backgroundColor: '#002147', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 25 },
  emptyAddBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  fab: { position: 'absolute', bottom: 30, right: 20, width: 64, height: 64, borderRadius: 32, backgroundColor: '#C69C6D', justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6 },
  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: '95%', height: '80%' },
  closePreview: { position: 'absolute', top: 40, right: 20 }
});
