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
    notes: '',
    actualProgress: '',
    reporter: ''
  });

  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  // --- Load Data ---
  useEffect(() => {
    const existingLog = logs.find(l => l.id === id);
    if (existingLog) {
      setFormData({
        ...existingLog,
        personnelList: existingLog.personnelList || (existingLog as any).labor || [],
        machineList: existingLog.machineList || (existingLog as any).machines || [],
        photos: existingLog.photos || [],
        notes: existingLog.notes || '',
        actualProgress: existingLog.actualProgress?.toString() || ''
      });
      setLoading(false);
    }
  }, [id, logs]);

  // --- 預定進度邏輯 (Scheduled Progress) ---
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
        <Text style={{ marginTop: 10, color: '#666' }}>載入日誌資料中...</Text>
      </View>
    );
  }

  // --- Personnel Actions ---
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

  // --- Machinery Actions ---
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

  // --- Photo Actions ---
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
        toast.success('上傳完成');
      }
    } catch (error) {
      toast.error('照片上傳失敗');
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    setFormData(prev => ({ ...prev, photos: prev.photos?.filter((_, i) => i !== index) }));
  };

  // --- Resolve Status ---
  const handleResolveIssues = () => {
    Alert.alert('解除列管', '確定要清除異常狀況報告並解除列管嗎？', [
      { text: '取消', style: 'cancel' },
      {
        text: '確定解除',
        style: 'destructive',
        onPress: async () => {
          try {
            await updateLog(id as string, { notes: '' });
            setFormData(prev => ({ ...prev, notes: '' }));
            toast.success('已解除列管');
          } catch (e) {
            toast.error('更新失敗');
          }
        }
      }
    ]);
  };

  // --- Submit ---
  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!formData.projectId) return Alert.alert('提示', '請選擇專案');
    if (!formData.content?.trim()) return Alert.alert('提示', '請輸入施工內容');
    if (isUploading) return Alert.alert('請稍候', '照片還在上傳中');

    try {
      setIsSubmitting(true);
      await updateLog(id as string, {
        ...formData,
        status: (formData.status === 'rejected' ? 'pending_review' : formData.status) as any,
        plannedProgress: parseFloat(scheduledProgress) || 0,
        actualProgress: formData.actualProgress
      });

      Alert.alert('✅ 修改成功', '日誌資料已更新。', [
        { text: '確定', onPress: () => router.replace('/logs') }
      ]);
    } catch (error) {
      console.error(error);
      toast.error('儲存失敗');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{
        title: '編輯施工日誌',
        headerStyle: { backgroundColor: '#002147' },
        headerTintColor: '#fff',
        headerLeft: () => null,
        headerRight: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 5 }}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        )
      }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 40 }}>

          <Text style={styles.label}>🏗️ 專案名稱</Text>
          <TouchableOpacity style={styles.input} onPress={() => setShowProjectPicker(!showProjectPicker)}>
            <Text style={{ fontSize: 16 }}>{formData.project || '請選擇專案...'}</Text>
            <Ionicons name="chevron-down" size={20} color="#666" />
          </TouchableOpacity>
          {showProjectPicker && (
            <View style={styles.pickerBox}>
              {projects.map(p => (
                <TouchableOpacity key={p.id} style={styles.pickerItem} onPress={() => {
                  setFormData(prev => ({ ...prev, project: p.name, projectId: p.id }));
                  setShowProjectPicker(false);
                }}>
                  <Text style={{ fontSize: 16 }}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.label}>📅 日期</Text>
              <View style={[styles.input, { backgroundColor: '#f0f0f0' }]}>
                <Text style={{ fontSize: 16 }}>{formData.date}</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>☀️ 天氣</Text>
              <View style={styles.weatherGroup}>
                {['晴', '陰', '雨'].map(w => (
                  <TouchableOpacity key={w} style={[styles.weatherBtn, formData.weather === w && styles.weatherBtnActive]} onPress={() => setFormData(prev => ({ ...prev, weather: w }))}>
                    <Text style={[styles.weatherText, formData.weather === w && styles.weatherTextActive]}>{w}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* 進度欄位 */}
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.label}>📈 預定進度 (%)</Text>
              <View style={[styles.input, { backgroundColor: '#E3F2FD' }]}>
                <Text style={{ color: '#002147', fontWeight: 'bold' }}>{scheduledProgress}%</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>📉 實際進度 (%)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="例如: 25.5"
                value={formData.actualProgress}
                onChangeText={t => setFormData(prev => ({ ...prev, actualProgress: t }))}
              />
            </View>
          </View>

          {/* 施工內容摘要 */}
          <Text style={styles.label}>📝 施工內容摘要</Text>
          <TextInput
            style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
            multiline
            placeholder="請詳細描述施工進度與項目..."
            value={formData.content}
            onChangeText={t => setFormData(prev => ({ ...prev, content: t }))}
          />

          {/* 出工區塊 */}
          <View style={styles.sectionHeader}>
            <Text style={styles.label}>👷 出工 (工種/人數)</Text>
            <TouchableOpacity onPress={addPersonnel}><Ionicons name="add-circle" size={26} color="#C69C6D" /></TouchableOpacity>
          </View>
          {formData.personnelList?.map((item) => (
            <View key={item.id} style={styles.listCard}>
              <View style={styles.listRow}>
                <TextInput style={[styles.subInput, { flex: 2 }]} placeholder="工種名稱" value={item.type} onChangeText={t => updatePersonnel(item.id, 'type', t)} />
                <TextInput style={[styles.subInput, { flex: 1, marginLeft: 10 }]} placeholder="人數" keyboardType="numeric" value={item.count?.toString()} onChangeText={t => updatePersonnel(item.id, 'count', parseInt(t) || 0)} />
                <TouchableOpacity style={{ marginLeft: 10 }} onPress={() => removePersonnel(item.id)}><Ionicons name="trash" size={22} color="#FF6B6B" /></TouchableOpacity>
              </View>
              <TextInput style={[styles.subInput, { marginTop: 8 }]} placeholder="備註" value={item.note || (item as any).work} onChangeText={t => updatePersonnel(item.id, 'note', t)} />
            </View>
          ))}

          {/* 機具區塊 */}
          <View style={styles.sectionHeader}>
            <Text style={styles.label}>🚜 機具 (名稱/數量)</Text>
            <TouchableOpacity onPress={addMachine}><Ionicons name="add-circle" size={26} color="#C69C6D" /></TouchableOpacity>
          </View>
          {formData.machineList?.map((item) => (
            <View key={item.id} style={styles.listCard}>
              <View style={styles.listRow}>
                <TextInput style={[styles.subInput, { flex: 2 }]} placeholder="機具名稱" value={item.name} onChangeText={t => updateMachine(item.id, 'name', t)} />
                <TextInput style={[styles.subInput, { flex: 1, marginLeft: 10 }]} placeholder="數量" keyboardType="numeric" value={item.quantity?.toString()} onChangeText={t => updateMachine(item.id, 'quantity', parseInt(t) || 0)} />
                <TouchableOpacity style={{ marginLeft: 10 }} onPress={() => removeMachine(item.id)}><Ionicons name="trash" size={22} color="#FF6B6B" /></TouchableOpacity>
              </View>
              <TextInput style={[styles.subInput, { marginTop: 8 }]} placeholder="備註" value={item.note} onChangeText={t => updateMachine(item.id, 'note', t)} />
            </View>
          ))}

          <Text style={styles.label}>📸 施工照片 (多選)</Text>
          <View style={styles.photoGrid}>
            {formData.photos?.map((url, idx) => (
              <View key={idx} style={styles.photoItem}>
                <Image source={{ uri: url }} style={styles.photoImg} />
                <TouchableOpacity style={styles.photoDelete} onPress={() => removePhoto(idx)}><Ionicons name="close-circle" size={22} color="#F44336" /></TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.photoAdd} onPress={pickImages} disabled={isUploading}>
              {isUploading ? <ActivityIndicator color="#C69C6D" /> : <Ionicons name="camera" size={32} color="#999" />}
              <Text style={{ color: '#999', fontSize: 11, marginTop: 4 }}>{isUploading ? '正在上傳' : `新增照片`}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.label}>⚠️ 異常狀況報告 / 備註</Text>
            {formData.notes ? (
              <TouchableOpacity style={styles.resolveBtn} onPress={handleResolveIssues}>
                <Text style={styles.resolveBtnText}>解除列管</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <TextInput
            style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
            multiline
            placeholder="若有停工、缺失或特殊狀況請在此說明..."
            value={formData.notes}
            onChangeText={t => setFormData(prev => ({ ...prev, notes: t }))}
          />

        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitBtn, (isUploading || isSubmitting) && { backgroundColor: '#ccc' }]}
          onPress={handleSubmit}
          disabled={isUploading || isSubmitting}
        >
          {isSubmitting ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator color="#fff" style={{ marginRight: 10 }} />
              <Text style={styles.submitBtnText}>正在處理中...</Text>
            </View>
          ) : (
            <Text style={styles.submitBtnText}>儲存修改內容</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  body: { padding: 20 },
  label: { fontSize: 13, fontWeight: 'bold', color: '#002147', marginTop: 18, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#E0E4E8',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#F9FBFC',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  pickerBox: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, marginTop: 5, backgroundColor: '#fff', elevation: 3 },
  pickerItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  row: { flexDirection: 'row' },
  weatherGroup: { flexDirection: 'row', gap: 6 },
  weatherBtn: { flex: 1, paddingVertical: 10, borderWidth: 1, borderColor: '#eee', borderRadius: 8, alignItems: 'center' },
  weatherBtnActive: { backgroundColor: '#C69C6D', borderColor: '#C69C6D' },
  weatherText: { color: '#666', fontSize: 13 },
  weatherTextActive: { color: '#fff', fontWeight: 'bold' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 8 },
  listCard: { backgroundColor: '#F5F7FA', padding: 12, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#E8ECEF' },
  listRow: { flexDirection: 'row', alignItems: 'center' },
  subInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 8, fontSize: 14, flex: 1 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  photoItem: { width: 85, height: 85, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  photoImg: { width: '100%', height: '100%' },
  photoDelete: { position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 11 },
  photoAdd: { width: 85, height: 85, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fafafa' },
  resolveBtn: { backgroundColor: '#4CAF50', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 5 },
  resolveBtnText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#eee', backgroundColor: '#fff' },
  submitBtn: { backgroundColor: '#C69C6D', padding: 16, borderRadius: 12, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  submitBtnText: { color: '#fff', fontSize: 17, fontWeight: 'bold' }
});