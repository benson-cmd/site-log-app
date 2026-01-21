import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, Image, StatusBar, ScrollView, TextInput, Platform, KeyboardAvoidingView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useProjects } from '../../context/ProjectContext';
import { useUser } from '../../context/UserContext';
import { useLogs, LogEntry } from '../../context/LogContext';

export default function LogsScreen() {
  const router = useRouter();
  const { projects } = useProjects();
  const { user } = useUser();
  const { logs, addLog, updateLog } = useLogs();

  // Modal States
  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newLog, setNewLog] = useState<Partial<LogEntry>>({
    project: '', date: '', weather: '', temperature: '', content: '', reporter: '', photos: []
  });

  // Project Selection
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  // 日期排序 (新 -> 舊)
  const sortedLogs = [...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Check Admin
  const isAdmin = user?.role === 'admin' || user?.email === 'wu@dwcc.com.tw'; // Simple check

  // Init Form
  const resetForm = () => {
    setNewLog({
      project: '',
      date: new Date().toISOString().split('T')[0],
      weather: '',
      temperature: '',
      content: '',
      reporter: user?.name || '使用者',
      photos: []
    });
    setEditingId(null);
    setIsEditMode(false);
  };

  const handleOpenAdd = () => {
    resetForm();
    setAddModalVisible(true);
  };

  const handleOpenEdit = (item: LogEntry) => {
    setNewLog({ ...item });
    setEditingId(item.id);
    setIsEditMode(true);
    setAddModalVisible(true);
  };

  const handleSubmitLog = () => {
    if (!newLog.project || !newLog.content || !newLog.date) {
      Alert.alert('錯誤', '請填寫完整資訊 (專案、日期、內容)');
      return;
    }

    if (isEditMode && editingId) {
      updateLog(editingId, newLog);
      Alert.alert('成功', '日誌已更新');
    } else {
      const entry: Omit<LogEntry, 'id'> = {
        date: newLog.date!,
        project: newLog.project!,
        weather: newLog.weather || '晴',
        temperature: newLog.temperature || '25°C',
        content: newLog.content!,
        reporter: newLog.reporter || user?.name || '使用者',
        status: 'pending_review', // Default new logs to pending
        photos: newLog.photos || []
      };
      addLog(entry);
      Alert.alert('成功', '施工日誌已新增，等待審核');
    }
    setAddModalVisible(false);
  };

  // Approval Handlers
  const handleApprove = (id: string) => {
    Alert.alert('核准確認', '確定核准此施工日誌？', [
      { text: '取消', style: 'cancel' },
      { text: '確認核准', onPress: () => updateLog(id, { status: 'approved' }) }
    ]);
  };

  const handleReject = (id: string) => {
    Alert.alert('退回確認', '確定退回此日誌？', [
      { text: '取消', style: 'cancel' },
      { text: '確認退回', style: 'destructive', onPress: () => updateLog(id, { status: 'rejected' }) }
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
    const statusColor = item.status === 'approved' ? '#4CAF50' : (item.status === 'rejected' ? '#F44336' : '#FF9800');
    const statusText = item.status === 'approved' ? '已核准' : (item.status === 'rejected' ? '已退回' : (item.status === 'draft' ? '草稿' : '待審核'));

    return (
      <View style={styles.card}>
        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{statusText}</Text>
        </View>

        <View style={styles.cardHeader}>
          <View style={styles.dateBadge}>
            <Ionicons name="calendar-outline" size={16} color="#fff" />
            <Text style={styles.dateText}>{item.date}</Text>
          </View>
          <View style={styles.weatherContainer}>
            <Text style={styles.weatherText}>{item.weather} {item.temperature}</Text>
          </View>
        </View>
        <Text style={styles.projectTitle}>{item.project}</Text>

        <View style={styles.contentBox}>
          <Text style={styles.contentLabel}>施工內容：</Text>
          <Text style={styles.contentText}>{item.content}</Text>
        </View>

        {/* Photos Preview in Card */}
        {item.photos && item.photos.length > 0 && (
          <ScrollView horizontal style={styles.photoScroll} showsHorizontalScrollIndicator={false}>
            {item.photos.map((uri, idx) => (
              <Image key={idx} source={{ uri }} style={styles.cardPhoto} />
            ))}
          </ScrollView>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.reporterText}>填寫人：{item.reporter}</Text>
          <TouchableOpacity onPress={() => handleOpenEdit(item)}>
            <Ionicons name="create-outline" size={24} color="#C69C6D" />
          </TouchableOpacity>
        </View>

        {/* Admin Actions */}
        {isAdmin && isPending && (
          <View style={styles.adminActions}>
            <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => handleReject(item.id)}>
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
      <Stack.Screen options={{ title: '施工紀錄', headerShown: true, headerStyle: { backgroundColor: '#002147' }, headerTintColor: '#fff' }} />
      <StatusBar barStyle="light-content" />

      <FlatList
        data={sortedLogs}
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
              <Text style={styles.modalTitle}>{isEditMode ? '編輯日誌' : '新增施工日誌'}</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
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
                <View style={styles.pickerContainer}>
                  {projects.map(p => (
                    <TouchableOpacity
                      key={p.id}
                      style={styles.pickerItem}
                      onPress={() => { setNewLog({ ...newLog, project: p.name }); setShowProjectPicker(false); }}
                    >
                      <Text style={styles.pickerText}>{p.name}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={[styles.pickerItem, { borderBottomWidth: 0 }]} onPress={() => setShowProjectPicker(false)}>
                    <Text style={{ color: '#FF6B6B' }}>取消選擇</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.inputLabel}>日期</Text>
              <TextInput style={styles.input} placeholder="YYYY-MM-DD" value={newLog.date} onChangeText={t => setNewLog({ ...newLog, date: t })} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.inputLabel}>天氣</Text>
                  <TextInput style={styles.input} placeholder="晴/雨" value={newLog.weather} onChangeText={t => setNewLog({ ...newLog, weather: t })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>氣溫</Text>
                  <TextInput style={styles.input} placeholder="25°C" value={newLog.temperature} onChangeText={t => setNewLog({ ...newLog, temperature: t })} />
                </View>
              </View>

              <Text style={styles.inputLabel}>施工內容重點</Text>
              <TextInput style={[styles.contentInput, { height: 100, textAlignVertical: 'top' }]} placeholder="1. ..." multiline value={newLog.content} onChangeText={t => setNewLog({ ...newLog, content: t })} />

              {/* Photo Upload */}
              <Text style={styles.inputLabel}>現場照片</Text>
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

              <Text style={styles.inputLabel}>填寫人 (自動帶入)</Text>
              <TextInput style={[styles.input, { backgroundColor: '#eee' }]} value={newLog.reporter} editable={false} />

              <View style={{ height: 30 }} />
            </ScrollView>

            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitLog}>
              <Text style={styles.submitBtnText}>{isEditMode ? '儲存變更' : '提交日報表'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

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

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '90%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#002147' },
  modalBody: { flex: 1 },
  inputLabel: { fontSize: 14, color: '#666', marginTop: 15, marginBottom: 5, fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#F9F9F9' },
  submitBtn: { backgroundColor: '#C69C6D', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 20, marginBottom: 20 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // Picker
  selectBtn: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, backgroundColor: '#F9F9F9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerContainer: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginTop: 5, overflow: 'hidden' },
  pickerItem: { padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  pickerText: { fontSize: 16, color: '#333' },
});