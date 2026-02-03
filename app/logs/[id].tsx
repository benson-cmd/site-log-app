import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator, Platform, KeyboardAvoidingView, SafeAreaView } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useMemo } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useLogs, LaborItem, MachineItem, LogEntry } from '../../context/LogContext';
import { useProjects } from '../../context/ProjectContext';
import { useUser } from '../../context/UserContext';
import { toast } from 'sonner';

export default function EditLogScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { logs, updateLog, uploadPhoto } = useLogs();
  const { projects } = useProjects();
  const { user } = useUser();

  const [formData, setFormData] = useState<Partial<LogEntry>>({
    project: '',
    projectId: '',
    date: '',
    weather: '晴',
    content: '',
    personnelList: [],
    machineList: [],
    photos: [],
    issues: '',
    actualProgress: '',
    reporter: ''
  });

  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.email === 'wu@dwcc.com.tw';

  // --- Load Data ---
  useEffect(() => {
    const existingLog = logs.find(l => l.id === id);
    if (existingLog) {
      setFormData({
        ...existingLog,
        personnelList: existingLog.personnelList || (existingLog as any).labor || [],
        machineList: existingLog.machineList || (existingLog as any).machines || [],
        photos: existingLog.photos || [],
        issues: existingLog.issues || (existingLog as any).notes || '',
        actualProgress: existingLog.actualProgress?.toString() || ''
      });
      setLoading(false);
    }
  }, [id, logs]);

  // --- 預定進度邏輯 ---
  const scheduledProgress = useMemo(() => {
    if (!formData.projectId || !formData.date) return '0';
    const project = projects.find(p => p.id === formData.projectId);
    if (!project || !project.scheduleData) return '0';

    const point = project.scheduleData.find(d => d.date === formData.date);
    if (point) return point.progress.toString();

    const sorted = [...project.scheduleData].sort((a, b) => a.date.localeCompare(b.date));
    let closest = 0;
    for (const d of sorted) {
      if (d.date <= formData.date) closest = d.progress;
      else break;
    }
    return closest.toString();
  }, [formData.projectId, formData.date, projects]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#002147" />
        <Text style={{ marginTop: 12, color: '#666' }}>日誌讀取中...</Text>
      </View>
    );
  }

  // --- Actions ---
  const addPersonnel = () => {
    const newItem: LaborItem = { id: Date.now().toString(), type: '', count: 1, note: '' };
    setFormData(prev => ({ ...prev, personnelList: [...(prev.personnelList || []), newItem] }));
  };

  const updatePersonnel = (pId: string, field: keyof LaborItem, value: any) => {
    setFormData(prev => ({
      ...prev,
      personnelList: prev.personnelList?.map(item => item.id === pId ? { ...item, [field]: value } : item)
    }));
  };

  const removePersonnel = (pId: string) => {
    setFormData(prev => ({ ...prev, personnelList: prev.personnelList?.filter(item => item.id !== pId) }));
  };

  const addMachine = () => {
    const newItem: MachineItem = { id: Date.now().toString(), name: '', quantity: 1, note: '' };
    setFormData(prev => ({ ...prev, machineList: [...(prev.machineList || []), newItem] }));
  };

  const updateMachine = (mId: string, field: keyof MachineItem, value: any) => {
    setFormData(prev => ({
      ...prev,
      machineList: prev.machineList?.map(item => item.id === mId ? { ...item, [field]: value } : item)
    }));
  };

  const removeMachine = (mId: string) => {
    setFormData(prev => ({ ...prev, machineList: prev.machineList?.filter(item => item.id !== mId) }));
  };

  const pickImages = async () => {
    if (isUploading) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.6,
      });

      if (!result.canceled) {
        setIsUploading(true);
        const uploadPromises = result.assets.map(asset => uploadPhoto(asset.uri));
        const urls = await Promise.all(uploadPromises);
        setFormData(prev => ({ ...prev, photos: [...(prev.photos || []), ...urls] }));
      }
    } catch (error) {
      toast.error('上傳失敗');
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    setFormData(prev => ({ ...prev, photos: prev.photos?.filter((_, i) => i !== index) }));
  };

  // --- 管理員操作 ---
  const handleResolveIssue = async () => {
    try {
      await updateLog(id as string, { issues: '', status: 'pending_review' });
      setFormData(prev => ({ ...prev, issues: '', status: 'pending_review' }));
      Alert.alert('成功', '異常狀況已解除列管');
    } catch (e) {
      Alert.alert('錯誤', '解除失敗');
    }
  };

  const handleApprove = async () => {
    try {
      setIsSubmitting(true);
      await updateLog(id as string, { status: 'approved' });
      Alert.alert('✅ 已核准', '該筆日誌已正式歸檔。', [
        { text: '確定', onPress: () => router.back() }
      ]);
    } catch (e) {
      Alert.alert('核准失敗', '連線異常');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    try {
      setIsSubmitting(true);
      await updateLog(id as string, { status: 'rejected' });
      Alert.alert('⛔ 已退回修正', '日誌已退回給填寫人。', [
        { text: '確定', onPress: () => router.back() }
      ]);
    } catch (e) {
      Alert.alert('操作失敗', '連線異常');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Submit Update ---
  const handleSubmit = async () => {
    if (isSubmitting) return;

    // A. 必填驗證
    if (!formData.content || formData.content.trim() === '') {
      Alert.alert('資料缺漏', '請填寫「施工內容摘要」才能儲存。');
      return;
    }
    if (isUploading) return Alert.alert('請等待', '照片上傳中');

    try {
      setIsSubmitting(true);

      // B. 處理狀態與異常邏輯
      const hasIssue = formData.issues && formData.issues.trim().length > 0;
      // 若原狀態是 issue 且已清空，則回歸為 pending_review；若目前有值，則設為 issue
      const finalStatus = hasIssue ? 'issue' : (formData.status === 'issue' ? 'pending_review' : formData.status);

      await updateLog(id as string, {
        ...formData,
        issues: formData.issues ? formData.issues.trim() : '',
        status: finalStatus as any,
        plannedProgress: parseFloat(scheduledProgress) || 0,
      });

      // C. 成功提示與跳轉
      Alert.alert('成功', '修改已儲存', [
        { text: '確定', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      Alert.alert('儲存失敗', error.message || '請檢查網路連線');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{
        title: '編輯日誌',
        presentation: 'modal',
        headerLeft: () => null,
        headerRight: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15, padding: 8 }}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
        ),
        headerStyle: { backgroundColor: '#002147' },
        headerTintColor: '#fff'
      }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 100 }}>

          <Text style={styles.label}>🏗️ 專案名稱</Text>
          <TouchableOpacity style={styles.input} onPress={() => setShowProjectPicker(!showProjectPicker)}>
            <Text>{formData.project || '點擊選擇...'}</Text>
            <Ionicons name="chevron-down" size={20} color="#666" />
          </TouchableOpacity>
          {showProjectPicker && (
            <View style={styles.pickerBox}>
              {projects.map(p => (
                <TouchableOpacity key={p.id} style={styles.pickerItem} onPress={() => {
                  setFormData(prev => ({ ...prev, project: p.name, projectId: p.id }));
                  setShowProjectPicker(false);
                }}>
                  <Text>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.label}>📅 施工日期</Text>
              <View style={[styles.input, { backgroundColor: '#eee' }]}><Text>{formData.date}</Text></View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>☀️ 天氣</Text>
              <View style={styles.weatherGroup}>
                {['晴', '陰', '雨'].map(w => (
                  <TouchableOpacity key={w} style={[styles.weatherBtn, formData.weather === w && { backgroundColor: '#C69C6D' }]} onPress={() => setFormData(prev => ({ ...prev, weather: w }))}>
                    <Text style={{ color: formData.weather === w ? '#fff' : '#666' }}>{w}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.label}>📈 預定進度 (%)</Text>
              <View style={[styles.input, { backgroundColor: '#f0f4f8' }]}><Text style={{ fontWeight: 'bold' }}>{scheduledProgress}%</Text></View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>📉 累積實際進度 (%)</Text>
              <TextInput style={styles.input} keyboardType="numeric" placeholder="例如: 12.5" value={formData.actualProgress?.toString() || ''} onChangeText={t => setFormData(prev => ({ ...prev, actualProgress: t }))} />
            </View>
          </View>

          <Text style={styles.label}>📝 施工內容摘要 *</Text>
          <TextInput
            style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
            multiline
            placeholder="請詳細描述施工內容..."
            value={formData.content}
            onChangeText={t => setFormData(prev => ({ ...prev, content: t }))}
          />

          <View style={styles.sectionHeader}>
            <Text style={styles.label}>👷 出工 (工種/人數)</Text>
            <TouchableOpacity onPress={addPersonnel}><Ionicons name="add-circle" size={28} color="#C69C6D" /></TouchableOpacity>
          </View>
          {formData.personnelList?.map(item => (
            <View key={item.id} style={styles.cardItem}>
              <View style={styles.row}>
                <TextInput style={[styles.subInput, { flex: 2 }]} placeholder="工種" value={item.type} onChangeText={v => updatePersonnel(item.id, 'type', v)} />
                <TextInput style={[styles.subInput, { flex: 1, marginLeft: 10 }]} placeholder="人數" keyboardType="numeric" value={item.count?.toString()} onChangeText={v => updatePersonnel(item.id, 'count', parseInt(v) || 0)} />
                <TouchableOpacity onPress={() => removePersonnel(item.id)} style={{ marginLeft: 10 }}><Ionicons name="trash" size={22} color="#FF6B6B" /></TouchableOpacity>
              </View>
              <TextInput style={[styles.subInput, { marginTop: 8 }]} placeholder="備註" value={item.note || (item as any).work} onChangeText={v => updatePersonnel(item.id, 'note', v)} />
            </View>
          ))}

          <View style={styles.sectionHeader}>
            <Text style={styles.label}>🚜 機具 (名稱/數量)</Text>
            <TouchableOpacity onPress={addMachine}><Ionicons name="add-circle" size={28} color="#C69C6D" /></TouchableOpacity>
          </View>
          {formData.machineList?.map(item => (
            <View key={item.id} style={styles.cardItem}>
              <View style={styles.row}>
                <TextInput style={[styles.subInput, { flex: 2 }]} placeholder="名稱" value={item.name} onChangeText={v => updateMachine(item.id, 'name', v)} />
                <TextInput style={[styles.subInput, { flex: 1, marginLeft: 10 }]} placeholder="數量" keyboardType="numeric" value={item.quantity?.toString()} onChangeText={v => updateMachine(item.id, 'quantity', parseInt(v) || 0)} />
                <TouchableOpacity onPress={() => removeMachine(item.id)} style={{ marginLeft: 10 }}><Ionicons name="trash" size={22} color="#FF6B6B" /></TouchableOpacity>
              </View>
              <TextInput style={[styles.subInput, { marginTop: 8 }]} placeholder="備註" value={item.note} onChangeText={v => updateMachine(item.id, 'note', v)} />
            </View>
          ))}

          <Text style={styles.label}>📸 施工照片</Text>
          <View style={styles.photoGrid}>
            {formData.photos?.map((p, i) => (
              <View key={i} style={styles.photoBox}>
                <Image source={{ uri: p }} style={styles.photo} />
                <TouchableOpacity style={styles.photoDel} onPress={() => removePhoto(i)}><Ionicons name="close-circle" size={20} color="#F44336" /></TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.photoAdd} onPress={pickImages} disabled={isUploading}>
              {isUploading ? <ActivityIndicator color="#C69C6D" /> : <Ionicons name="camera" size={32} color="#ccc" />}
            </TouchableOpacity>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.label}>⚠️ 異常狀況報告</Text>
            {formData.issues ? (
              <TouchableOpacity onPress={handleResolveIssue} style={styles.resolveBtn}>
                <Text style={styles.resolveBtnText}>解除列管</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <TextInput
            style={[styles.input, { height: 100, textAlignVertical: 'top' }, formData.issues ? { borderColor: '#FF9800', borderWidth: 2 } : null]}
            multiline
            placeholder="請填列異常狀況..."
            value={formData.issues}
            onChangeText={t => setFormData(prev => ({ ...prev, issues: t }))}
          />

          {isAdmin && formData.status !== 'approved' && (
            <View style={[styles.row, { marginTop: 30, gap: 10 }]}>
              <TouchableOpacity style={[styles.adminBtn, { backgroundColor: '#4CAF50' }]} onPress={handleApprove} disabled={isSubmitting}>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.adminBtnText}>核准日誌</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.adminBtn, { backgroundColor: '#F44336' }]} onPress={handleReject} disabled={isSubmitting}>
                <Ionicons name="close-circle" size={20} color="#fff" />
                <Text style={styles.adminBtnText}>退回修正</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      <TouchableOpacity style={[styles.submitBtn, (isSubmitting || isUploading) && { backgroundColor: '#ccc' }]} onPress={handleSubmit} disabled={isSubmitting || isUploading}>
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>儲存修改內容</Text>}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  body: { padding: 20 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#002147', marginTop: 15, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 12, backgroundColor: '#fafafa', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row' },
  weatherGroup: { flexDirection: 'row', gap: 5 },
  weatherBtn: { flex: 1, padding: 10, borderWidth: 1, borderColor: '#eee', borderRadius: 8, alignItems: 'center' },
  pickerBox: { borderWidth: 1, borderColor: '#eee', marginTop: 5, borderRadius: 8, backgroundColor: '#fff' },
  pickerItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
  cardItem: { backgroundColor: '#f8f9fa', padding: 15, borderRadius: 10, marginTop: 10, borderWidth: 1, borderColor: '#eee' },
  subInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 8 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  photoBox: { width: 90, height: 90, borderRadius: 8, overflow: 'hidden', position: 'relative' },
  photo: { width: '100%', height: '100%' },
  photoDel: { position: 'absolute', top: 2, right: 2, backgroundColor: '#fff', borderRadius: 10 },
  photoAdd: { width: 90, height: 90, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  resolveBtn: { backgroundColor: '#10B981', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6 },
  resolveBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  adminBtn: { flex: 1, padding: 15, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 },
  adminBtnText: { color: '#fff', fontWeight: 'bold' },
  submitBtn: { margin: 20, backgroundColor: '#C69C6D', padding: 18, borderRadius: 12, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});