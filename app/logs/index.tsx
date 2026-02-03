import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, Image, StatusBar, ScrollView, TextInput, Platform, KeyboardAvoidingView, ActivityIndicator, SafeAreaView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useMemo } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';
import { useProjects } from '../../context/ProjectContext';
import { useUser } from '../../context/UserContext';
import { useLogs, LogEntry, MachineItem, LaborItem, LogIssue } from '../../context/LogContext';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import DateTimePicker from '@react-native-community/datetimepicker';

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
  const { projects, updateProject } = useProjects();
  const { user } = useUser();
  const { logs, addLog, updateLog, uploadPhoto } = useLogs();

  // --- State ---
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const [newLog, setNewLog] = useState<Partial<LogEntry> & { todayProgress?: string }>({
    project: '', date: '', weather: '晴', content: '', machines: [], labor: [], reporter: '', photos: [], todayProgress: '', issues: []
  });
  const [currentIssueText, setCurrentIssueText] = useState('');
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showProjectPicker, setShowProjectPicker] = useState(false);

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

  // 日曆標記點
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

  // --- CRUD 重用邏輯 ---
  const resetForm = () => {
    setNewLog({
      project: '',
      date: selectedDate, // 預設使用目前選中的日期
      weather: '晴',
      content: '',
      machines: [],
      labor: [],
      reporter: user?.name || '使用者',
      photos: [],
      todayProgress: '',
      issues: []
    });
    setCurrentIssueText('');
    setEditingId(null);
    setIsEditMode(false);
  };

  const handleOpenAdd = () => {
    resetForm();
    setAddModalVisible(true);
  };

  const handleEditLog = (logItem: LogEntry) => {
    setEditingId(logItem.id);
    const safeDate = logItem.date ? String(logItem.date).replace(/\//g, '-') : '';
    const progressVal = (logItem.actualProgress !== undefined && logItem.actualProgress !== null)
      ? String(logItem.actualProgress)
      : '';

    setNewLog({
      ...logItem,
      projectId: logItem.projectId || '',
      date: safeDate,
      todayProgress: progressVal,
      weather: logItem.weather || '晴',
      content: logItem.content || '',
      labor: logItem.labor || [],
      machines: logItem.machines || [],
      photos: logItem.photos || [],
      issues: logItem.issues || []
    });

    setIsEditMode(true);
    setAddModalVisible(true);
  };

  const onSubmit = async () => {
    if (!newLog.project) { toast.error('⚠️ 請選擇專案'); return; }
    if (!newLog.content?.trim()) { toast.error('⚠️ 請填寫施工項目'); return; }
    if (!newLog.date) { toast.error('⚠️ 請選擇日期'); return; }

    try {
      setIsSubmitting(true);
      const currentPhotos = newLog.photos || [];
      const uploadPromises = currentPhotos.map(async (photoUri) => {
        const uriString = typeof photoUri === 'string' ? photoUri : (photoUri as any).uri;
        if (uriString && uriString.startsWith('http')) return uriString;
        return await uploadPhoto(uriString);
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      const targetProject = projects.find(p => p.name === newLog.project);
      if (!targetProject) throw new Error('找不到專案');

      const logDataToSave = {
        projectId: targetProject.id,
        date: String(newLog.date),
        actualProgress: newLog.todayProgress || '0',
        weather: newLog.weather || '晴',
        content: newLog.content || '',
        labor: newLog.labor || [],
        machines: newLog.machines || [],
        photos: uploadedUrls,
        issues: newLog.issues || []
      };

      if (isEditMode && editingId) {
        await updateLog(editingId, { ...logDataToSave, status: 'pending_review' });
      } else {
        await addLog({
          ...logDataToSave,
          project: newLog.project!,
          reporter: user?.name || '使用者',
          reporterId: user?.uid,
          status: 'pending_review'
        });
      }

      toast.success('✅ 儲存成功');
      setAddModalVisible(false);
      resetForm();
    } catch (error: any) {
      toast.error('❌ 儲存失敗');
    } finally {
      setIsSubmitting(false);
    }
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
      if (window.confirm('確定要刪除嗎？')) performDelete();
    } else {
      Alert.alert('確認', '確定要刪除嗎？', [{ text: '取消' }, { text: '刪除', onPress: performDelete }]);
    }
  };

  const addIssue = () => {
    if (!currentIssueText.trim()) return;
    setNewLog(prev => ({
      ...prev,
      issues: [...(prev.issues || []), { id: Date.now().toString(), content: currentIssueText.trim(), status: 'pending' }]
    }));
    setCurrentIssueText('');
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.5 });
    if (!result.canceled) {
      setNewLog(prev => ({ ...prev, photos: [...(prev.photos || []), result.assets[0].uri] }));
    }
  };

  const removePhoto = (index: number) => {
    setNewLog(prev => ({ ...prev, photos: prev.photos?.filter((_, i) => i !== index) }));
  };

  // --- UI Components ---
  const LogCard = ({ item }: { item: LogEntry }) => {
    const statusColor = item.status === 'approved' ? '#4CAF50' : (item.status === 'rejected' ? '#F44336' : '#FF9800');
    return (
      <View style={styles.card}>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{item.status === 'approved' ? '已核准' : (item.status === 'rejected' ? '已退回' : '審核中')}</Text>
        </View>
        <Text style={styles.projectTitle}>{getProjectName(item.projectId || '', item.project)}</Text>
        <View style={styles.cardInfoRow}>
          <Text style={styles.infoText}><Ionicons name="sunny" size={12} /> {item.weather}</Text>
          <Text style={styles.infoText}><Ionicons name="people" size={12} /> {item.labor?.reduce((acc, curr) => acc + (curr.count || 0), 0)} 人</Text>
        </View>
        <Text style={styles.cardContent} numberOfLines={2}>{item.content}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.reporterText}>填寫: {item.reporter}</Text>
          <View style={styles.cardActions}>
            <TouchableOpacity onPress={() => handleEditLog(item)}><Ionicons name="create-outline" size={20} color="#C69C6D" /></TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item.id)}><Ionicons name="trash-outline" size={20} color="#FF6B6B" /></TouchableOpacity>
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
          <TouchableOpacity onPress={() => router.push('/dashboard')}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
          <Text style={styles.headerTitle}>施工日誌 (日曆檢視)</Text>
          <TouchableOpacity onPress={handleOpenAdd}><Ionicons name="add" size={28} color="#fff" /></TouchableOpacity>
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
        ListHeaderComponent={<Text style={styles.selectedDateHeader}>{selectedDate} 施工紀錄</Text>}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={60} color="#ccc" />
            <Text style={styles.emptyText}>本日尚無施工紀錄</Text>
            <TouchableOpacity style={styles.emptyAddBtn} onPress={handleOpenAdd}>
              <Text style={styles.emptyAddBtnText}>立即新增日誌</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* --- Modals (保留原有複雜邏輯) --- */}
      <Modal visible={isAddModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{isEditMode ? '編輯日誌' : '新增日誌'}</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}><Ionicons name="close" size={24} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {/* 專案選擇 */}
              <Text style={styles.label}>專案名稱</Text>
              <TouchableOpacity style={styles.input} onPress={() => setShowProjectPicker(!showProjectPicker)}>
                <Text>{newLog.project || '點擊選擇專案'}</Text>
              </TouchableOpacity>
              {showProjectPicker && (
                <View style={styles.pickerDropdown}>
                  {projects.map(p => (
                    <TouchableOpacity key={p.id} style={styles.pickerOption} onPress={() => { setNewLog({ ...newLog, project: p.name }); setShowProjectPicker(false); }}>
                      <Text>{p.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.label}>日期</Text>
              <TextInput style={[styles.input, { backgroundColor: '#f0f0f0' }]} value={newLog.date} editable={false} />

              <Text style={styles.label}>天氣</Text>
              <View style={styles.weatherRow}>
                {['晴', '陰', '雨'].map(w => (
                  <TouchableOpacity key={w} style={[styles.weatherBtn, newLog.weather === w && styles.weatherBtnActive]} onPress={() => setNewLog({ ...newLog, weather: w })}>
                    <Text style={[styles.weatherBtnText, newLog.weather === w && styles.weatherBtnTextActive]}>{w}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>施工內容</Text>
              <TextInput style={[styles.input, { height: 80 }]} multiline value={newLog.content} onChangeText={t => setNewLog({ ...newLog, content: t })} />

              <Text style={styles.label}>施工照片</Text>
              <View style={styles.photoRow}>
                {newLog.photos?.map((p, i) => (
                  <View key={i}><Image source={{ uri: p }} style={styles.photoThumb} /><TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(i)}><Ionicons name="close-circle" color="red" /></TouchableOpacity></View>
                ))}
                <TouchableOpacity style={styles.photoAdd} onPress={pickImage}><Ionicons name="camera" size={24} color="#999" /></TouchableOpacity>
              </View>

              <Text style={styles.label}>異常問題</Text>
              <View style={styles.issueInputRow}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="新增問題" value={currentIssueText} onChangeText={setCurrentIssueText} />
                <TouchableOpacity onPress={addIssue} style={styles.issueAddBtn}><Text style={{ color: '#fff' }}>加入</Text></TouchableOpacity>
              </View>
              {newLog.issues?.map((issue) => (
                <View key={issue.id} style={styles.issueItem}><Text>• {issue.content}</Text></View>
              ))}
              <View style={{ height: 50 }} />
            </ScrollView>
            <TouchableOpacity style={styles.submitBtn} onPress={onSubmit} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>儲存並送審</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 圖片預覽 */}
      <Modal visible={!!previewImage} transparent><TouchableOpacity style={styles.previewOverlay} onPress={() => setPreviewImage(null)}><Image source={{ uri: previewImage || '' }} style={styles.fullImage} resizeMode="contain" /></TouchableOpacity></Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { backgroundColor: '#002147' },
  headerContent: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  calendarContainer: { backgroundColor: '#fff', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  listContainer: { padding: 15, paddingBottom: 50 },
  selectedDateHeader: { fontSize: 16, fontWeight: 'bold', color: '#002147', marginBottom: 15 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 15, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  statusBadge: { position: 'absolute', top: 10, right: 10, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  projectTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  cardInfoRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  infoText: { fontSize: 12, color: '#666' },
  cardContent: { fontSize: 14, color: '#444', lineHeight: 20, marginBottom: 10 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 10 },
  reporterText: { fontSize: 12, color: '#999' },
  cardActions: { flexDirection: 'row', gap: 15 },
  emptyContainer: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#999', fontSize: 16, marginTop: 10 },
  emptyAddBtn: { marginTop: 20, backgroundColor: '#C69C6D', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  emptyAddBtnText: { color: '#fff', fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', height: '90%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  modalBody: { flex: 1 },
  label: { fontSize: 14, fontWeight: 'bold', marginBottom: 8, marginTop: 15 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, backgroundColor: '#f9f9f9', justifyContent: 'center' },
  weatherRow: { flexDirection: 'row', gap: 10 },
  weatherBtn: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  weatherBtnActive: { backgroundColor: '#C69C6D', borderColor: '#C69C6D' },
  weatherBtnText: { color: '#666' },
  weatherBtnTextActive: { color: '#fff', fontWeight: 'bold' },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  photoThumb: { width: 60, height: 60, borderRadius: 8 },
  photoAdd: { width: 60, height: 60, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  photoRemove: { position: 'absolute', top: -5, right: -5, backgroundColor: '#fff', borderRadius: 10 },
  issueInputRow: { flexDirection: 'row', gap: 10 },
  issueAddBtn: { backgroundColor: '#002147', paddingHorizontal: 15, borderRadius: 8, justifyContent: 'center' },
  issueItem: { marginTop: 5, padding: 8, backgroundColor: '#f0f0f0', borderRadius: 4 },
  submitBtn: { backgroundColor: '#C69C6D', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 20 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  pickerDropdown: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginTop: 5, backgroundColor: '#fff' },
  pickerOption: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  previewOverlay: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: '100%', height: '100%' }
});
