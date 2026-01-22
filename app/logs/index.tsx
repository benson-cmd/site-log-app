import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, Image, StatusBar, ScrollView, TextInput, Platform, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useProjects } from '../../context/ProjectContext';
import { useUser } from '../../context/UserContext';
import { useLogs, LogEntry, MachineryItem, ManpowerItem } from '../../context/LogContext';

export default function LogsScreen() {
  const router = useRouter();
  const { projects, updateProject } = useProjects();
  const { user } = useUser();
  const { logs, addLog, updateLog } = useLogs();

  // Modal States
  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newLog, setNewLog] = useState<Partial<LogEntry> & { todayProgress?: string }>({
    project: '', date: '', weather: '晴', content: '', machinery: [], manpower: [], reporter: '', photos: [], todayProgress: ''
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
      weather: '晴',
      content: '',
      machinery: [],
      manpower: [],
      reporter: user?.name || '使用者',
      photos: [],
      todayProgress: ''
    });
    setEditingId(null);
    setIsEditMode(false);
  };

  const handleOpenAdd = () => {
    resetForm();
    setAddModalVisible(true);
  };

  const handleOpenEdit = (item: LogEntry) => {
    setNewLog({ ...item, todayProgress: '' }); // Edit mode usually doesn't need to re-set progress unless specified, or we could fetch current project progress? unique handling needed.
    // For now, allow editing fields but maybe not progress sync on edit unless explicitly changed?
    // Let's keep it simple: progress is an 'input' to update project state at that moment.
    setEditingId(item.id);
    setIsEditMode(true);
    setAddModalVisible(true);
  };

  // Auto-calculate Planned Progress from CSV when date or project changes
  useEffect(() => {
    if (newLog.date && newLog.project) {
      const targetProject = projects.find(p => p.name === newLog.project);
      if (targetProject?.scheduleData && targetProject.scheduleData.length > 0) {
        // Find exact match or closest date
        const matchingPoint = targetProject.scheduleData.find(point => point.date === newLog.date);
        if (matchingPoint) {
          setNewLog(prev => ({ ...prev, plannedProgress: matchingPoint.progress }));
        } else {
          // Find closest previous date
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
    if (!newLog.project || !newLog.content || !newLog.date || !newLog.weather) {
      Alert.alert('錯誤', '請填寫完整資訊 (專案、日期、天氣、內容)');
      return;
    }

    try {
      setIsSubmitting(true);

      // 1. Sync Progress if provided
      if (newLog.todayProgress) {
        const progressVal = parseFloat(newLog.todayProgress);
        if (!isNaN(progressVal)) {
          const targetProp = projects.find(p => p.name === newLog.project);
          if (targetProp) {
            await updateProject(targetProp.id, { currentActualProgress: progressVal });
          }
        }
      }

      // 2. Database Write (Firebase & Cloudinary handled in LogContext)
      if (isEditMode && editingId) {
        const { todayProgress, ...logData } = newLog;
        await updateLog(editingId, logData);
        Alert.alert('施工日誌更新成功！' + (newLog.todayProgress ? ' (進度已同步)' : ''));
      } else {
        const entry: Omit<LogEntry, 'id'> = {
          date: newLog.date!,
          project: newLog.project!,
          weather: newLog.weather || '晴',
          content: newLog.content!,
          machinery: newLog.machinery,
          manpower: newLog.manpower,
          plannedProgress: newLog.plannedProgress,
          reporter: newLog.reporter || user?.name || '使用者',
          status: 'pending_review',
          photos: newLog.photos || []
        };
        await addLog(entry);
        Alert.alert('施工日誌提交成功！' + (newLog.todayProgress ? ' (進度已同步)' : ''));
      }

      // 3. Success Feedback
      setAddModalVisible(false);
      resetForm();
    } catch (error: any) {
      console.error('提交失敗:', error);
      Alert.alert('提交失敗，請稍後再試。', '錯誤原因：' + (error.message || '未知錯誤'));
    } finally {
      setIsSubmitting(false);
    }
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
            <Text style={styles.weatherText}>{item.weather}</Text>
          </View>
        </View>
        <Text style={styles.projectTitle}>{item.project}</Text>

        <View style={styles.contentBox}>
          <Text style={styles.contentLabel}>施工內容：</Text>
          <Text style={styles.contentText}>{item.content}</Text>
        </View>

        {/* 機具列表顯示 */}
        {item.machinery && item.machinery.length > 0 && (
          <View style={styles.contentBox}>
            <Text style={styles.contentLabel}>機具：</Text>
            {item.machinery.map((m, idx) => (
              <View key={m.id} style={{ flexDirection: 'row', marginTop: 5, paddingVertical: 4, borderBottomWidth: idx < item.machinery!.length - 1 ? 1 : 0, borderBottomColor: '#eee' }}>
                <Text style={{ flex: 2, fontSize: 14, color: '#333' }}>{m.name}</Text>
                <Text style={{ flex: 1, fontSize: 14, color: '#666', textAlign: 'center' }}>x{m.quantity}</Text>
                <Text style={{ flex: 2, fontSize: 12, color: '#999', textAlign: 'right' }}>{m.note || '-'}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 人力列表顯示 */}
        {item.manpower && item.manpower.length > 0 && (
          <View style={styles.contentBox}>
            <Text style={styles.contentLabel}>人力：</Text>
            {item.manpower.map((m, idx) => (
              <View key={m.id} style={{ flexDirection: 'row', marginTop: 5, paddingVertical: 4, borderBottomWidth: idx < item.manpower!.length - 1 ? 1 : 0, borderBottomColor: '#eee' }}>
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
            {item.photos.map((uri, idx) => (
              <Image key={idx} source={{ uri }} style={styles.cardPhoto} />
            ))}
          </ScrollView>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.reporterText}>填寫人：{item.reporter}</Text>
          {item.reporter === user?.name && (
            <TouchableOpacity onPress={() => handleOpenEdit(item)}>
              <Ionicons name="create-outline" size={24} color="#C69C6D" />
            </TouchableOpacity>
          )}
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
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={newLog.date}
                  onChange={(e) => setNewLog({ ...newLog, date: e.target.value })}
                  style={{
                    padding: 12,
                    backgroundColor: '#F9F9F9',
                    borderWidth: 1,
                    borderColor: '#ddd',
                    borderRadius: 8,
                    fontSize: 16,
                    marginBottom: 15
                  }}
                />
              ) : (
                <TextInput style={styles.input} placeholder="YYYY-MM-DD" value={newLog.date} onChangeText={t => setNewLog({ ...newLog, date: t })} />
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
                {newLog.machinery && newLog.machinery.length > 0 && newLog.machinery.map((item, index) => (
                  <View key={item.id} style={styles.machineryRow}>
                    <View style={styles.machineryInputsRow}>
                      <TextInput
                        style={[styles.machineryInput, { flex: 2 }]}
                        placeholder="機具名稱"
                        value={item.name}
                        onChangeText={t => {
                          const updatedList = [...(newLog.machinery || [])];
                          updatedList[index] = { ...updatedList[index], name: t };
                          setNewLog({ ...newLog, machinery: updatedList });
                        }}
                      />
                      <TextInput
                        style={[styles.machineryInput, { flex: 1, marginLeft: 5 }]}
                        placeholder="數量"
                        keyboardType="number-pad"
                        value={item.quantity?.toString()}
                        onChangeText={t => {
                          const updatedList = [...(newLog.machinery || [])];
                          updatedList[index] = { ...updatedList[index], quantity: parseInt(t) || 0 };
                          setNewLog({ ...newLog, machinery: updatedList });
                        }}
                      />
                    </View>
                    <View style={styles.machineryInputsRow}>
                      <TextInput
                        style={[styles.machineryInput, { flex: 1 }]}
                        placeholder="備註 (例如：進場時間)"
                        value={item.note || ''}
                        onChangeText={t => {
                          const updatedList = [...(newLog.machinery || [])];
                          updatedList[index] = { ...updatedList[index], note: t };
                          setNewLog({ ...newLog, machinery: updatedList });
                        }}
                      />
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => {
                          const updatedList = newLog.machinery?.filter((_, i) => i !== index);
                          setNewLog({ ...newLog, machinery: updatedList });
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
                    const newItem: MachineryItem = {
                      id: Math.random().toString(36).substr(2, 9),
                      name: '',
                      quantity: 1,
                      note: ''
                    };
                    setNewLog({ ...newLog, machinery: [...(newLog.machinery || []), newItem] });
                  }}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#C69C6D" />
                  <Text style={styles.addMachineryText}>新增機具</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>人力</Text>
              <View style={styles.manpowerListContainer}>
                {newLog.manpower && newLog.manpower.length > 0 && newLog.manpower.map((item, index) => (
                  <View key={item.id} style={styles.manpowerRow}>
                    <View style={styles.manpowerInputsRow}>
                      <TextInput
                        style={[styles.manpowerInput, { flex: 2 }]}
                        placeholder="工種/公司"
                        value={item.type}
                        onChangeText={t => {
                          const updatedList = [...(newLog.manpower || [])];
                          updatedList[index] = { ...updatedList[index], type: t };
                          setNewLog({ ...newLog, manpower: updatedList });
                        }}
                      />
                      <TextInput
                        style={[styles.manpowerInput, { flex: 1, marginLeft: 5 }]}
                        placeholder="人數"
                        keyboardType="number-pad"
                        value={item.count?.toString()}
                        onChangeText={t => {
                          const updatedList = [...(newLog.manpower || [])];
                          updatedList[index] = { ...updatedList[index], count: parseInt(t) || 0 };
                          setNewLog({ ...newLog, manpower: updatedList });
                        }}
                      />
                    </View>
                    <View style={styles.manpowerInputsRow}>
                      <TextInput
                        style={[styles.manpowerInput, { flex: 1 }]}
                        placeholder="工作內容 (選填)"
                        value={item.work || ''}
                        onChangeText={t => {
                          const updatedList = [...(newLog.manpower || [])];
                          updatedList[index] = { ...updatedList[index], work: t };
                          setNewLog({ ...newLog, manpower: updatedList });
                        }}
                      />
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => {
                          const updatedList = newLog.manpower?.filter((_, i) => i !== index);
                          setNewLog({ ...newLog, manpower: updatedList });
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
                    const newItem: ManpowerItem = {
                      id: Math.random().toString(36).substr(2, 9),
                      type: '',
                      count: 1,
                      work: ''
                    };
                    setNewLog({ ...newLog, manpower: [...(newLog.manpower || []), newItem] });
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
                  <Text style={styles.submitBtnText}>傳送中...</Text>
                </View>
              ) : (
                <Text style={styles.submitBtnText}>{isEditMode ? '儲存變更 & 同步' : '提交日報表 & 同步'}</Text>
              )}
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
  }
});