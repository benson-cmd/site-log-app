import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, Image, StatusBar, ScrollView, TextInput, Platform, KeyboardAvoidingView, ActivityIndicator, SafeAreaView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';
import { useProjects } from '../../context/ProjectContext';
import { useUser } from '../../context/UserContext';
import { useLogs, LogEntry, MachineItem, LaborItem, LogIssue } from '../../context/LogContext';
import { toast } from 'sonner';

import DateTimePicker from '@react-native-community/datetimepicker';

export default function LogsScreen() {
  const router = useRouter();
  const { projects, updateProject } = useProjects();
  const { user, logout } = useUser();
  const { logs, addLog, updateLog, uploadPhoto } = useLogs();

  // Side Menu State
  const [menuVisible, setMenuVisible] = useState(false);

  // Modal States
  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Date Picker Logic (Copied from projects)
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());

  const openNativeDatePicker = () => {
    let initialDate = new Date();
    if (newLog.date) {
      // Handle "YYYY-MM-DD" parsing safely
      const parts = newLog.date.split('-');
      if (parts.length === 3) {
        initialDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      }
    }
    setTempDate(initialDate);
    setShowDatePicker(true);
  };

  const onNativeDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selectedDate) {
      setTempDate(selectedDate);
      if (Platform.OS === 'android') confirmNativeDate(selectedDate);
    }
  };

  const confirmNativeDate = (date: Date) => {
    // Manually format to YYYY-MM-DD to use local time, avoiding UTC shifts
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    setNewLog(prev => ({ ...prev, date: dateStr }));
    if (Platform.OS === 'ios') setShowDatePicker(false);
  };

  const [newLog, setNewLog] = useState<Partial<LogEntry> & { todayProgress?: string }>({
    project: '', date: '', weather: '晴', content: '', machines: [], labor: [], reporter: '', photos: [], todayProgress: '', issues: []
  });
  const [currentIssueText, setCurrentIssueText] = useState('');
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Project Selection
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  // 日期排序 (新 -> 舊)
  const sortedLogs = [...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Check Admin
  const isAdmin = user?.role === 'admin' || user?.email === 'wu@dwcc.com.tw'; // Simple check

  // [手術級優化] 列表可視範圍過濾
  // 1. 管理員可看所有
  // 2. 作者可看自己的所有 (包含待審核、被退回)
  // 3. 一般人只能看到「已核准」的公開日誌
  const visibleLogs = sortedLogs.filter(log =>
    isAdmin ||
    log.reporterId === user?.uid ||
    log.status === 'approved'
  );

  // Init Form
  const resetForm = () => {
    setNewLog({
      project: '',
      date: new Date().toISOString().split('T')[0],
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

  // 當點擊列表的「筆」圖示時
  const handleEditLog = (logItem: LogEntry) => {
    setEditingId(logItem.id);

    // 日期與進度處理 (保留原本修復好的邏輯)
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

      // ⚠️ 關鍵修復：讀取資料庫的 issues，若無則給空陣列
      issues: logItem.issues || []
    });

    setIsEditMode(true);
    setAddModalVisible(true);
  };

  // 異常與問題管理功能
  const addIssue = () => {
    if (!currentIssueText.trim()) return;
    const newIssue: LogIssue = {
      id: Date.now().toString(),
      content: currentIssueText.trim(),
      status: 'pending'
    };
    setNewLog(prev => ({
      ...prev,
      issues: [...(prev.issues || []), newIssue]
    }));
    setCurrentIssueText('');
  };

  const removeIssue = (id: string) => {
    setNewLog(prev => ({
      ...prev,
      issues: prev.issues?.filter(i => i.id !== id)
    }));
  };

  const toggleIssueStatus = (id: string) => {
    setNewLog(prev => ({
      ...prev,
      issues: prev.issues?.map(i =>
        i.id === id ? { ...i, status: i.status === 'pending' ? 'resolved' : 'pending' } : i
      )
    }));
  };

  // Auto-calculate Planned Progress from CSV when date or project changes
  useEffect(() => {
    if (newLog.date && newLog.project) {
      const targetProject = projects.find(p => p.name === newLog.project);
      if (targetProject?.scheduleData && targetProject.scheduleData.length > 0) {
        const matchingPoint = targetProject.scheduleData.find(point => point.date === newLog.date);
        if (matchingPoint) {
          setNewLog(prev => ({ ...prev, plannedProgress: matchingPoint.progress }));
        } else {
          const sortedData = [...targetProject.scheduleData].sort((a, b) => a.date.localeCompare(b.date));
          let closestProgress: number | undefined;
          for (const point of sortedData) {
            if (point.date <= newLog.date!) {
              closestProgress = point.progress;
            } else {
              break;
            }
          }
          setNewLog(prev => ({ ...prev, plannedProgress: closestProgress }));
        }
      } else {
        setNewLog(prev => ({ ...prev, plannedProgress: undefined }));
      }
    }
  }, [newLog.date, newLog.project, projects]);

  const onSubmit = async () => {
    // 驗證邏輯
    if (!newLog.project) {
      toast.error('⚠️ 錯誤：請務必選擇「專案名稱」！');
      return;
    }
    if (!newLog.content || newLog.content.trim().length === 0) {
      toast.error('⚠️ 錯誤：請填寫「今日施工項目」！');
      return;
    }
    if (!newLog.date || !newLog.weather) {
      toast.error('⚠️ 錯誤：請填寫完整日期與天氣！');
      return;
    }

    try {
      setIsSubmitting(true);

      // 1. 照片上傳處理 (保留原本機制)
      const currentPhotos = newLog.photos || [];
      const totalPhotos = currentPhotos.length;
      setUploadProgress({ current: 0, total: totalPhotos });

      const uploadPromises = currentPhotos.map(async (photoUri, index) => {
        const uriString = typeof photoUri === 'string' ? photoUri : (photoUri as any).uri;
        if (uriString && uriString.startsWith('http')) {
          setUploadProgress(prev => ({ ...prev, current: prev.current + 1 }));
          return uriString;
        }
        try {
          const remoteUrl = await uploadPhoto(typeof photoUri === 'object' ? (photoUri as any).uri : photoUri);
          setUploadProgress(prev => ({ ...prev, current: prev.current + 1 }));
          return remoteUrl;
        } catch (err: any) {
          throw new Error(`照片 [${index + 1}] 上傳失敗: ${err.message}`);
        }
      });

      let uploadedUrls: string[] = [];
      try {
        const results = await Promise.all(uploadPromises);
        uploadedUrls = results.filter(url => typeof url === 'string' && url.startsWith('http'));
      } catch (uploadError: any) {
        toast.error(uploadError.message);
        setIsSubmitting(false);
        return;
      }

      // 2. 準備要寫入 Firestore 的資料物件
      const targetProject = projects.find(p => p.name === newLog.project);
      if (!targetProject) throw new Error('找不到指定的專案資料');

      const submissionDate = String(newLog.date);

      // 資料清洗
      const sanitizedMachines = (newLog.machines || []).map(m => ({
        id: m.id,
        name: m.name || '',
        quantity: Number(m.quantity) || 0,
        note: m.note || ''
      }));

      const sanitizedLabor = (newLog.labor || []).map(m => ({
        id: m.id,
        type: m.type || '',
        count: Number(m.count) || 0,
        work: m.work || ''
      }));

      // ⚠️ 核心修復：確保 issues 被寫入
      const sanitizedIssues = (newLog.issues || []).map(i => ({
        id: i.id,
        content: i.content || '',
        status: i.status || 'pending'
      }));

      const logDataToSave = {
        projectId: targetProject.id,
        date: submissionDate,
        actualProgress: newLog.todayProgress ? String(newLog.todayProgress) : '0',
        weather: newLog.weather || '晴',
        content: newLog.content || '',
        labor: sanitizedLabor,
        machines: sanitizedMachines,
        photos: uploadedUrls,
        issues: sanitizedIssues // ⚠️ 關鍵：存檔 issues
      };

      if (isEditMode && editingId) {
        // 更新模式
        const updateData: Partial<LogEntry> = {
          ...logDataToSave,
          reporterId: newLog.reporterId || user?.uid,
          status: (newLog.status === 'rejected' || newLog.status === 'pending_review') ? 'pending_review' : newLog.status
        };
        const cleanUpdateData = JSON.parse(JSON.stringify(updateData));
        await updateLog(editingId, cleanUpdateData);
      } else {
        // 新增模式
        const entry: Omit<LogEntry, 'id'> = {
          ...logDataToSave,
          project: newLog.project!,
          plannedProgress: newLog.plannedProgress,
          reporter: newLog.reporter || user?.name || '使用者',
          reporterId: user?.uid,
          status: 'pending_review'
        };
        const cleanEntry = JSON.parse(JSON.stringify(entry));
        await addLog(cleanEntry);
      }

      // 3. 進度同步
      if (newLog.todayProgress) {
        const progressVal = parseFloat(newLog.todayProgress);
        if (!isNaN(progressVal)) {
          await updateProject(targetProject.id, { currentActualProgress: progressVal });
        }
      }

      toast.success('✅ 儲存成功：異常回報與進度已同步。');
      setAddModalVisible(false);
      resetForm();

    } catch (error: any) {
      console.error('[DEBUG] 存檔過程崩潰:', error);
      toast.error('❌ 儲存失敗：' + (error.message || '發生未知錯誤'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 狀態更新處理器
  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      await updateLog(id, { status: newStatus as any });
      toast.success(`✅ 儲存成功：日誌已改為 ${newStatus === 'approved' ? '已核准' : '已退回'}`);
    } catch (e: any) {
      toast.error('❌ 更新失敗: ' + e.message);
    }
  };

  // Approval Handlers
  const handleApprove = (id: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm('確定要核准此施工日誌嗎？')) {
        handleStatusUpdate(id, 'approved');
      }
      return;
    }

    Alert.alert('核准確認', '確定要核准此施工日誌嗎？', [
      { text: '取消', style: 'cancel' },
      { text: '確認核准', onPress: () => handleStatusUpdate(id, 'approved') }
    ]);
  };

  const handleReturn = (id: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm('確定要退回此日誌？')) {
        handleStatusUpdate(id, 'rejected');
      }
      return;
    }

    Alert.alert('退回確認', '確定要退回此施工日誌嗎？', [
      { text: '取消', style: 'cancel' },
      { text: '確認退回', style: 'destructive', onPress: () => handleStatusUpdate(id, 'rejected') }
    ]);
  };

  const handleDelete = (id: string) => {
    const performDelete = async () => {
      try {
        await deleteDoc(doc(db, 'logs', id));
        toast.success('🗑️ 公告已永久刪除');
        // 不需要手動刷新，由於 LogContext 使用 onSnapshot，列表會自動更新
      } catch (err: any) {
        toast.error('❌ 刪除失敗: ' + err.message);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('確定要永久刪除此筆施工日誌嗎？（刪除後無法復原）')) {
        performDelete();
      }
      return;
    }

    Alert.alert('刪除確認', '確定要永久刪除此筆施工日誌嗎？', [
      { text: '取消', style: 'cancel' },
      { text: '永久刪除', style: 'destructive', onPress: performDelete }
    ]);
  };

  // Photo Picker
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setNewLog(prev => ({
        ...prev,
        photos: [...(prev.photos || []), uri]
      }));
    }
  };

  const removePhoto = (index: number) => {
    setNewLog(prev => ({
      ...prev,
      photos: prev.photos?.filter((_, i) => i !== index)
    }));
  };

  const LogCard = ({ item }: { item: LogEntry }) => {
    const isPending = item.status === 'pending_review';
    const isRejected = item.status === 'rejected';
    const statusColor = item.status === 'approved' ? '#4CAF50' : (isRejected ? '#F44336' : '#FF9800');
    const statusText = item.status === 'approved' ? '已核准' : (isRejected ? '已退回（請修正）' : (item.status === 'draft' ? '草稿' : '待審核'));

    return (
      <View style={styles.card}>
        {/* Status Badge - 僅管理員或作者本人顯示 */}
        {(isAdmin || item.reporterId === user?.uid) && (
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
        )}

        <View style={styles.cardHeader}>
          <View style={styles.dateBadge}>
            <Ionicons name="calendar-outline" size={16} color="#fff" />
            <Text style={styles.dateText}>{item.date}</Text>
          </View>
          <View style={styles.weatherContainer}>
            <Text style={styles.weatherText}>{item.weather}</Text>
          </View>
        </View>
        <Text style={styles.projectTitle}>{item.project}</Text>

        {/* 退回引導文字 */}
        {isRejected && (
          <View style={(extraStyles as any).guidanceContainer}>
            <Ionicons name="alert-circle" size={18} color="#F44336" />
            <Text style={(extraStyles as any).guidanceText}>
              此日誌已被管理員退回，請點擊編輯圖示修正後重新提交
            </Text>
          </View>
        )}

        <View style={styles.contentBox}>
          <Text style={styles.contentLabel}>施工內容：</Text>
          <Text style={styles.contentText}>{item.content}</Text>
        </View>

        {/* 機具列表顯示 */}
        {item.machines && item.machines.length > 0 && (
          <View style={styles.contentBox}>
            <Text style={styles.contentLabel}>機具：</Text>
            {item.machines.map((m, idx) => (
              <View key={m.id} style={{ flexDirection: 'row', marginTop: 5, paddingVertical: 4, borderBottomWidth: idx < item.machines!.length - 1 ? 1 : 0, borderBottomColor: '#eee' }}>
                <Text style={{ flex: 2, fontSize: 14, color: '#333' }}>{m.name}</Text>
                <Text style={{ flex: 1, fontSize: 14, color: '#666', textAlign: 'center' }}>x{m.quantity}</Text>
                <Text style={{ flex: 2, fontSize: 12, color: '#999', textAlign: 'right' }}>{m.note || '-'}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 人力列表顯示 */}
        {item.labor && item.labor.length > 0 && (
          <View style={styles.contentBox}>
            <Text style={styles.contentLabel}>人力：</Text>
            {item.labor.map((m, idx) => (
              <View key={m.id} style={{ flexDirection: 'row', marginTop: 5, paddingVertical: 4, borderBottomWidth: idx < item.labor!.length - 1 ? 1 : 0, borderBottomColor: '#eee' }}>
                <Text style={{ flex: 2, fontSize: 14, color: '#333' }}>{m.type}</Text>
                <Text style={{ flex: 1, fontSize: 14, color: '#666', textAlign: 'center' }}>{m.count}人</Text>
                <Text style={{ flex: 2, fontSize: 12, color: '#999', textAlign: 'right' }}>{m.work || '-'}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Photos Preview in Card */}
        {item.photos && item.photos.length > 0 && (
          <ScrollView horizontal style={styles.photoScroll} showsHorizontalScrollIndicator={false}>
            {item.photos.map((url, idx) => (
              <TouchableOpacity key={idx} onPress={() => setPreviewImage(url)}>
                <Image source={{ uri: url }} style={styles.cardPhoto} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.reporterText}>填寫人：{item.reporter}</Text>
          {/* [手術級優化] 編輯/刪除按鈕顯示條件 */}
          {/* 1. 管理員(isAdmin) */}
          {/* 2. 作者本人(reporterId === uid) 且 狀態不為 'approved' (已核准不可再改，除非管理員) */}
          {(isAdmin || (item.reporterId === user?.uid && item.status !== 'approved')) && (
            <View style={{ flexDirection: 'row', gap: 15 }}>
              <TouchableOpacity onPress={() => handleEditLog(item)}>
                <Ionicons name="create-outline" size={24} color="#C69C6D" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id)}>
                <Ionicons name="trash-outline" size={24} color="#FF6B6B" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Admin Actions */}
        {isAdmin && isPending && (
          <View style={styles.adminActions}>
            <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => handleReturn(item.id)}>
              <Text style={styles.actionText}>退回</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={() => handleApprove(item.id)}>
              <Text style={styles.actionText}>核准</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F7FA' }}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#002147" />

      <SafeAreaView style={styles.headerSafeArea}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.menuBtn}>
            <Ionicons name="menu" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>施工紀錄</Text>
          <View style={{ width: 28 }} />
        </View>
      </SafeAreaView>

      <FlatList
        data={visibleLogs}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <LogCard item={item} />}
        contentContainerStyle={{ padding: 15, paddingBottom: 100 }}
        ListEmptyComponent={<View style={{ alignItems: 'center', marginTop: 50 }}><Text style={{ color: '#999' }}>尚無施工紀錄</Text></View>}
      />

      <TouchableOpacity style={styles.fab} onPress={handleOpenAdd}>
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      <Modal visible={isAddModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle} accessibilityRole="header">
                  {isEditMode ? '編輯施工日誌' : '新增施工日誌'}
                </Text>
                {/* 增加隱藏的 Title 用於無障礙輔助環境 */}
                <Text style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} aria-label="Dialog Title">
                  {isEditMode ? '編輯施工日誌表單' : '新增施工日誌表單'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => !isSubmitting && setAddModalVisible(false)}
                accessibilityLabel="關閉彈窗"
                disabled={isSubmitting}
                style={isSubmitting && { opacity: 0.5 }}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>專案名稱 (下拉選擇)</Text>

              {!showProjectPicker ? (
                <TouchableOpacity style={styles.selectBtn} onPress={() => setShowProjectPicker(true)}>
                  <Text style={{ color: newLog.project ? '#333' : '#999', fontSize: 16 }}>
                    {newLog.project || '請選擇專案...'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#666" />
                </TouchableOpacity>
              ) : (
                <View style={[styles.pickerContainer, { height: 150 }]}>
                  <ScrollView nestedScrollEnabled>
                    {projects.map(p => (
                      <TouchableOpacity
                        key={p.id}
                        style={styles.pickerItem}
                        onPress={() => { setNewLog({ ...newLog, project: p.name }); setShowProjectPicker(false); }}
                      >
                        <Text style={styles.pickerText}>{p.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <TouchableOpacity style={[styles.pickerItem, { borderBottomWidth: 0, borderTopWidth: 1 }]} onPress={() => setShowProjectPicker(false)}>
                    <Text style={{ color: '#FF6B6B' }}>關閉選單</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.progressRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>今日實際累計進度 (%)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="例如：35.5"
                    value={newLog.todayProgress?.toString()}
                    onChangeText={t => setNewLog({ ...newLog, todayProgress: t })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>預定進度 (%)</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: '#E3F2FD', color: '#002147' }]}
                    value={newLog.plannedProgress?.toString() || '無資料'}
                    editable={false}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>日期</Text>
              <View style={[styles.input, { padding: 0, justifyContent: 'center', overflow: 'hidden', height: 50 }]}>
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    value={newLog.date ? newLog.date.replace(/\//g, '-') : ''}
                    onChange={(e: any) => setNewLog({ ...newLog, date: e.target.value })}
                    style={{
                      border: 'none',
                      width: '100%',
                      height: '100%',
                      fontSize: '16px',
                      padding: '0 10px',
                      backgroundColor: 'transparent',
                      outline: 'none',
                      color: '#333',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box'
                    }}
                  />
                ) : (
                  <TouchableOpacity
                    onPress={openNativeDatePicker}
                    style={{ width: '100%', height: '100%', padding: 10, justifyContent: 'center' }}
                  >
                    <Text style={{ color: newLog.date ? '#000' : '#888', fontSize: 16 }}>
                      {newLog.date || '請選擇日期'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              {Platform.OS !== 'web' && showDatePicker && (
                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  display="default"
                  onChange={onNativeDateChange}
                />
              )}

              <Text style={styles.inputLabel}>天氣</Text>
              <View style={styles.weatherPicker}>
                {['晴', '陰', '雨'].map(w => (
                  <TouchableOpacity
                    key={w}
                    style={[styles.weatherOption, newLog.weather === w && styles.weatherOptionActive]}
                    onPress={() => setNewLog({ ...newLog, date: newLog.date || new Date().toISOString().split('T')[0], weather: w })}
                  >
                    <Text style={[styles.weatherOptionText, newLog.weather === w && styles.weatherOptionTextActive]}>{w}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>施工項目</Text>
              <TextInput style={[styles.contentInput, { height: 100, textAlignVertical: 'top' }]} placeholder="今日施工項目..." multiline value={newLog.content} onChangeText={t => setNewLog({ ...newLog, content: t })} />

              <Text style={styles.inputLabel}>機具</Text>
              <View style={styles.machineryListContainer}>
                {newLog.machines && newLog.machines.length > 0 && newLog.machines.map((item, index) => (
                  <View key={item.id} style={styles.machineryRow}>
                    <View style={styles.machineryInputsRow}>
                      <TextInput
                        style={[styles.machineryInput, { flex: 2 }]}
                        placeholder="機具名稱"
                        value={item.name}
                        onChangeText={t => {
                          const updatedList = [...(newLog.machines || [])];
                          updatedList[index] = { ...updatedList[index], name: t };
                          setNewLog({ ...newLog, machines: updatedList });
                        }}
                      />
                      <TextInput
                        style={[styles.machineryInput, { flex: 1, marginLeft: 5 }]}
                        placeholder="數量"
                        keyboardType="number-pad"
                        value={item.quantity?.toString()}
                        onChangeText={t => {
                          const updatedList = [...(newLog.machines || [])];
                          updatedList[index] = { ...updatedList[index], quantity: parseInt(t) || 0 };
                          setNewLog({ ...newLog, machines: updatedList });
                        }}
                      />
                    </View>
                    <View style={styles.machineryInputsRow}>
                      <TextInput
                        style={[styles.machineryInput, { flex: 1 }]}
                        placeholder="備註 (例如：進場時間)"
                        value={item.note || ''}
                        onChangeText={t => {
                          const updatedList = [...(newLog.machines || [])];
                          updatedList[index] = { ...updatedList[index], note: t };
                          setNewLog({ ...newLog, machines: updatedList });
                        }}
                      />
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => {
                          const updatedList = newLog.machines?.filter((_, i) => i !== index);
                          setNewLog({ ...newLog, machines: updatedList });
                        }}
                      >
                        <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.addMachineryBtn}
                  onPress={() => {
                    const newItem: MachineItem = {
                      id: Math.random().toString(36).substr(2, 9),
                      name: '',
                      quantity: 1,
                      note: ''
                    };
                    setNewLog({ ...newLog, machines: [...(newLog.machines || []), newItem] });
                  }}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#C69C6D" />
                  <Text style={styles.addMachineryText}>新增機具</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>人力</Text>
              <View style={styles.manpowerListContainer}>
                {newLog.labor && newLog.labor.length > 0 && newLog.labor.map((item, index) => (
                  <View key={item.id} style={styles.manpowerRow}>
                    <View style={styles.manpowerInputsRow}>
                      <TextInput
                        style={[styles.manpowerInput, { flex: 2 }]}
                        placeholder="工種/公司"
                        value={item.type}
                        onChangeText={t => {
                          const updatedList = [...(newLog.labor || [])];
                          updatedList[index] = { ...updatedList[index], type: t };
                          setNewLog({ ...newLog, labor: updatedList });
                        }}
                      />
                      <TextInput
                        style={[styles.manpowerInput, { flex: 1, marginLeft: 5 }]}
                        placeholder="人數"
                        keyboardType="number-pad"
                        value={item.count?.toString()}
                        onChangeText={t => {
                          const updatedList = [...(newLog.labor || [])];
                          updatedList[index] = { ...updatedList[index], count: parseInt(t) || 0 };
                          setNewLog({ ...newLog, labor: updatedList });
                        }}
                      />
                    </View>
                    <View style={styles.manpowerInputsRow}>
                      <TextInput
                        style={[styles.manpowerInput, { flex: 1 }]}
                        placeholder="工作內容 (選填)"
                        value={item.work || ''}
                        onChangeText={t => {
                          const updatedList = [...(newLog.labor || [])];
                          updatedList[index] = { ...updatedList[index], work: t };
                          setNewLog({ ...newLog, labor: updatedList });
                        }}
                      />
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => {
                          const updatedList = newLog.labor?.filter((_, i) => i !== index);
                          setNewLog({ ...newLog, labor: updatedList });
                        }}
                      >
                        <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.addManpowerBtn}
                  onPress={() => {
                    const newItem: LaborItem = {
                      id: Math.random().toString(36).substr(2, 9),
                      type: '',
                      count: 1,
                      work: ''
                    };
                    setNewLog({ ...newLog, labor: [...(newLog.labor || []), newItem] });
                  }}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#C69C6D" />
                  <Text style={styles.addManpowerText}>新增人力</Text>
                </TouchableOpacity>
              </View>

              {/* Photo Upload */}
              <Text style={styles.inputLabel}>施工照片</Text>
              <View style={styles.photoContainer}>
                {newLog.photos?.map((uri, idx) => (
                  <View key={idx} style={styles.photoThumbContainer}>
                    <Image source={{ uri }} style={styles.photoThumb} />
                    <TouchableOpacity style={styles.removePhoto} onPress={() => removePhoto(idx)}>
                      <Ionicons name="close-circle" size={20} color="#FF6B6B" />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addPhotoBtn} onPress={pickImage}>
                  <Ionicons name="camera" size={30} color="#999" />
                  <Text style={{ color: '#999', fontSize: 12, marginTop: 5 }}>新增照片 (0/20)</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>⚠️ 異常與問題回報</Text>
              <View style={styles.issuesContainer}>
                {newLog.issues && newLog.issues.length > 0 && newLog.issues.map((issue) => (
                  <View key={issue.id} style={styles.issueRow}>
                    <Text style={[styles.issueText, issue.status === 'resolved' && { textDecorationLine: 'line-through', color: '#999' }]}>
                      {issue.content}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <TouchableOpacity
                        onPress={() => toggleIssueStatus(issue.id)}
                        style={[styles.statusToggleBtn, { backgroundColor: issue.status === 'resolved' ? '#4CAF50' : '#FF5252' }]}
                      >
                        <Text style={styles.statusToggleText}>{issue.status === 'resolved' ? '已排除' : '待處理'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => removeIssue(issue.id)} style={styles.issueDeleteBtn}>
                        <Ionicons name="trash-outline" size={18} color="#999" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                <View style={styles.addIssueRow}>
                  <TextInput
                    style={styles.addIssueInput}
                    placeholder="輸入問題描述..."
                    value={currentIssueText}
                    onChangeText={setCurrentIssueText}
                  />
                  <TouchableOpacity style={styles.addIssueBtn} onPress={addIssue}>
                    <Text style={styles.addIssueBtnText}>加入</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.inputLabel}>填寫人 (自動帶入)</Text>
              <TextInput style={[styles.input, { backgroundColor: '#eee' }]} value={newLog.reporter} editable={false} />

              <View style={{ height: 30 }} />
            </ScrollView>

            <TouchableOpacity
              style={[styles.submitBtn, isSubmitting && { backgroundColor: '#ccc' }]}
              onPress={onSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator color="#fff" style={{ marginRight: 10 }} />
                  <Text style={styles.submitBtnText}>
                    {uploadProgress.total > 0 && uploadProgress.current < uploadProgress.total
                      ? `照片傳送中 (${uploadProgress.current}/${uploadProgress.total})...`
                      : '傳送中，請稍候...'}
                  </Text>
                </View>
              ) : (
                <Text style={styles.submitBtnText}>
                  {isEditMode
                    ? (newLog.status === 'rejected' ? '重新提交審核' : '儲存變更 & 同步')
                    : '提交日報表 & 同步'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 放大預覽 Modal */}
      <Modal visible={!!previewImage} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
        <TouchableOpacity
          style={(extraStyles as any).previewOverlay}
          activeOpacity={1}
          onPress={() => setPreviewImage(null)}
        >
          <TouchableOpacity activeOpacity={1} style={(extraStyles as any).previewContent}>
            <Image source={{ uri: previewImage || '' }} style={(extraStyles as any).fullImage} resizeMode="contain" />
            <TouchableOpacity style={(extraStyles as any).closePreviewBtn} onPress={() => setPreviewImage(null)}>
              <Ionicons name="close-circle" size={40} color="#fff" />
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Side Menu */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <View style={styles.menuOverlay}>
          <View style={styles.sideMenu}>
            <SafeAreaView style={{ flex: 1, padding: 20 }}>
              <View style={styles.menuHeader}>
                <Text style={styles.menuTitle}>功能選單</Text>
                <TouchableOpacity onPress={() => setMenuVisible(false)}><Ionicons name="close" size={28} color="#fff" /></TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <MenuItem icon="home" label="首頁" onPress={() => { setMenuVisible(false); router.push('/dashboard'); }} />
                <MenuItem icon="folder-open" label="專案列表" onPress={() => { setMenuVisible(false); router.push('/projects/'); }} />
                <MenuItem icon="clipboard" label="施工紀錄" isActive={true} onPress={() => setMenuVisible(false)} />
                {(user?.role === 'admin' || user?.email === 'wu@dwcc.com.tw') && (
                  <MenuItem icon="people" label="人員管理" onPress={() => { setMenuVisible(false); router.push('/personnel'); }} />
                )}
                <MenuItem icon="library" label="SOP資料庫" onPress={() => { setMenuVisible(false); router.push('/sop'); }} />
                <MenuItem icon="person-circle" label="我的檔案" onPress={() => { setMenuVisible(false); router.push('/profile'); }} />
              </View>
              <View style={{ paddingBottom: 20 }}>
                <MenuItem icon="log-out-outline" label="登出系統" isLogout onPress={() => { setMenuVisible(false); logout(); router.replace('/'); }} />
              </View>
            </SafeAreaView>
          </View>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setMenuVisible(false)} />
        </View>
      </Modal>

    </View>
  );
}

const MenuItem = ({ icon, label, onPress, isLogout = false, isActive = false }: any) => (
  <TouchableOpacity style={[styles.menuItem, isActive && styles.menuItemActive]} onPress={onPress}>
    <Ionicons name={icon} size={24} color={isLogout ? '#FF6B6B' : (isActive ? '#C69C6D' : '#fff')} />
    <Text style={[styles.menuItemText, isLogout && { color: '#FF6B6B' }, isActive && { color: '#C69C6D' }]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 15, padding: 15, elevation: 3, borderWidth: 1, borderColor: '#eee', position: 'relative', overflow: 'hidden' },
  statusBadge: { position: 'absolute', top: 0, right: 0, paddingHorizontal: 12, paddingVertical: 4, borderBottomLeftRadius: 10 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 10 },
  dateBadge: { flexDirection: 'row', backgroundColor: '#002147', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 20, alignItems: 'center' },
  dateText: { color: '#fff', fontSize: 12, fontWeight: 'bold', marginLeft: 5 },
  weatherContainer: { backgroundColor: '#FFF8E1', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8 },
  weatherText: { color: '#F9A825', fontSize: 12, fontWeight: 'bold' },

  projectTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 10 },

  contentBox: { backgroundColor: '#F5F7FA', padding: 10, borderRadius: 8, marginBottom: 10 },
  contentLabel: { fontSize: 12, color: '#999', marginBottom: 5 },
  contentText: { fontSize: 15, color: '#444', lineHeight: 22 },
  contentInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#F9F9F9' },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10, marginTop: 5 },
  reporterText: { fontSize: 12, color: '#999' },

  // Photos
  photoScroll: { flexDirection: 'row', marginBottom: 10 },
  cardPhoto: { width: 80, height: 80, borderRadius: 6, marginRight: 8, backgroundColor: '#eee' },

  photoContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  photoThumbContainer: { width: 80, height: 80, marginRight: 10, marginBottom: 10, position: 'relative' },
  photoThumb: { width: '100%', height: '100%', borderRadius: 8 },
  removePhoto: { position: 'absolute', top: -5, right: -5, backgroundColor: '#fff', borderRadius: 10 },
  addPhotoBtn: { width: 80, height: 80, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },

  // Admin Actions
  adminActions: { flexDirection: 'row', marginTop: 15, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#eee' },
  actionBtn: { flex: 1, padding: 10, borderRadius: 8, alignItems: 'center', marginHorizontal: 5 },
  rejectBtn: { backgroundColor: '#FFEBEE' },
  approveBtn: { backgroundColor: '#E8F5E9' },
  actionText: { fontWeight: 'bold', fontSize: 14, color: '#333' },

  fab: { position: 'absolute', bottom: 30, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#C69C6D', justifyContent: 'center', alignItems: 'center', elevation: 5 },

  // Header
  headerSafeArea: { backgroundColor: '#002147', paddingTop: Platform.OS === 'android' ? 25 : 0 },
  headerContent: { height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, justifyContent: 'space-between' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  menuBtn: { padding: 5 },

  // Side Menu
  menuOverlay: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.5)' },
  sideMenu: { width: '80%', maxWidth: 300, backgroundColor: '#002147', height: '100%' },
  menuHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40, marginTop: 10 },
  menuTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  menuItemActive: { borderBottomColor: '#C69C6D' },
  menuItemText: { color: '#fff', fontSize: 18, marginLeft: 15, fontWeight: '500' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '90%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#002147' },
  modalBody: { flex: 1 },
  inputLabel: { fontSize: 14, color: '#666', marginTop: 15, marginBottom: 5, fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#F9F9F9' },
  progressRow: { flexDirection: 'row', gap: 16, marginBottom: 5 },
  submitBtn: { backgroundColor: '#C69C6D', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 20, marginBottom: 20, minHeight: 55, justifyContent: 'center' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // Picker
  selectBtn: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, backgroundColor: '#F9F9F9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerContainer: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginTop: 5, overflow: 'hidden' },
  pickerItem: { padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  pickerText: { fontSize: 16, color: '#333' },

  weatherPicker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15
  },
  weatherOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginHorizontal: 3,
    alignItems: 'center'
  },
  weatherOptionActive: {
    backgroundColor: '#C69C6D',
    borderColor: '#C69C6D'
  },
  weatherOptionText: {
    fontSize: 16,
    color: '#666'
  },
  weatherOptionTextActive: {
    color: '#fff',
    fontWeight: 'bold'
  },

  // 機具列表樣式
  machineryListContainer: {
    marginBottom: 15,
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    padding: 10
  },
  machineryRow: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0'
  },
  machineryInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5
  },
  machineryInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    backgroundColor: '#fff'
  },
  deleteBtn: {
    marginLeft: 8,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  addMachineryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#C69C6D',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 12,
    marginTop: 5
  },
  addMachineryText: {
    color: '#C69C6D',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 5
  },

  // 人力列表樣式
  manpowerListContainer: {
    marginBottom: 15,
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    padding: 10
  },
  manpowerRow: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0'
  },
  manpowerInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5
  },
  manpowerInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    backgroundColor: '#fff'
  },
  addManpowerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#C69C6D',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 12,
    marginTop: 5
  },
  addManpowerText: {
    color: '#C69C6D',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 5
  },

  // 異常與問題回報樣式
  issuesContainer: {
    marginBottom: 15,
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    padding: 10
  },
  issueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0'
  },
  issueText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    marginRight: 10
  },
  statusToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8
  },
  statusToggleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  issueDeleteBtn: {
    padding: 4
  },
  addIssueRow: {
    flexDirection: 'row',
    marginTop: 5,
    gap: 8
  },
  addIssueInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    backgroundColor: '#fff'
  },
  addIssueBtn: {
    backgroundColor: '#C69C6D',
    paddingHorizontal: 15,
    justifyContent: 'center',
    borderRadius: 6
  },
  addIssueBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold'
  }
});
// 圖片預覽樣式 (由 Antigravity 手術級補丁加入)
const extraStyles = StyleSheet.create({
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  previewContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center'
  },
  fullImage: {
    width: '95%',
    height: '80%'
  },
  closePreviewBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    zIndex: 10
  },
  // 退回引導樣式
  guidanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FFCDD2'
  },
  guidanceText: {
    color: '#F44336',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1
  }
});

// 為了不破壞原本的 styles 物件，我們在 Modal 中直接使用 extraStyles
