import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator, Platform, KeyboardAvoidingView, SafeAreaView } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useMemo } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useLogs, LaborItem, MachineItem } from '../../context/LogContext';
import { useProjects } from '../../context/ProjectContext';
import { useUser } from '../../context/UserContext';
import { toast } from 'sonner';

export default function NewLogScreen() {
  const router = useRouter();
  const { date: initialDate } = useLocalSearchParams<{ date?: string }>();
  const { addLog, uploadPhoto } = useLogs();
  const { projects } = useProjects();
  const { user } = useUser();

  // --- Form State ---
  const [formData, setFormData] = useState({
    project: '',
    projectId: '',
    date: initialDate || new Date().toISOString().split('T')[0],
    weather: '晴',
    content: '',
    personnelList: [] as LaborItem[],
    machineList: [] as MachineItem[],
    photos: [] as string[],
    notes: '',
    actualProgress: '',
    reporter: user?.name || '使用者'
  });

  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  // --- 預定進度邏輯 (Scheduled Progress) ---
  const scheduledProgress = useMemo(() => {
    if (!formData.projectId || !formData.date) return '0';
    const project = projects.find(p => p.id === formData.projectId);
    if (!project || !project.scheduleData) return '0';

    // 尋找對應日期的進度
    const point = project.scheduleData.find(d => d.date === formData.date);
    if (point) return point.progress.toString();

    // 如果沒精確日期，找最接近的一個
    const sorted = [...project.scheduleData].sort((a, b) => a.date.localeCompare(b.date));
    let closest = 0;
    for (const d of sorted) {
      if (d.date <= formData.date) closest = d.progress;
      else break;
    }
    return closest.toString();
  }, [formData.projectId, formData.date, projects]);

  // --- Personnel Actions ---
  const addPersonnel = () => {
    const newItem: LaborItem = { id: Date.now().toString(), type: '', count: 1, note: '' };
    setFormData(prev => ({ ...prev, personnelList: [...prev.personnelList, newItem] }));
  };

  const updatePersonnel = (id: string, field: keyof LaborItem, value: any) => {
    setFormData(prev => ({
      ...prev,
      personnelList: prev.personnelList.map(item => item.id === id ? { ...item, [field]: value } : item)
    }));
  };

  const removePersonnel = (id: string) => {
    setFormData(prev => ({ ...prev, personnelList: prev.personnelList.filter(item => item.id !== id) }));
  };

  // --- Machinery Actions ---
  const addMachine = () => {
    const newItem: MachineItem = { id: Date.now().toString(), name: '', quantity: 1, note: '' };
    setFormData(prev => ({ ...prev, machineList: [...prev.machineList, newItem] }));
  };

  const updateMachine = (id: string, field: keyof MachineItem, value: any) => {
    setFormData(prev => ({
      ...prev,
      machineList: prev.machineList.map(item => item.id === id ? { ...item, [field]: value } : item)
    }));
  };

  const removeMachine = (id: string) => {
    setFormData(prev => ({ ...prev, machineList: prev.machineList.filter(item => item.id !== id) }));
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
        const uploadPromises = result.assets.map(async (asset) => {
          const url = await uploadPhoto(asset.uri);
          return url;
        });
        const urls = await Promise.all(uploadPromises);
        setFormData(prev => ({ ...prev, photos: [...prev.photos, ...urls] }));
        toast.success('照片上傳成功');
      }
    } catch (error) {
      console.error(error);
      toast.error('照片上傳失敗');
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    setFormData(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== index) }));
  };

  // --- Submit ---
  const handleSubmit = async () => {
    if (isSubmitting) return;

    // 必填欄位驗證
    if (!formData.projectId) {
      Alert.alert('資料缺漏', '請先選擇專案。');
      return;
    }
    if (!formData.content || formData.content.trim() === '') {
      Alert.alert('資料缺漏', '請填寫「施工內容摘要」才能儲存。');
      return;
    }
    if (isUploading) {
      Alert.alert('請耐心等候', '照片正在上傳中，請等候處理完畢再儲存。');
      return;
    }

    try {
      setIsSubmitting(true);

      await addLog({
        ...formData,
        status: 'pending_review',
        reporterId: user?.uid,
        plannedProgress: parseFloat(scheduledProgress) || 0,
        actualProgress: formData.actualProgress
      });

      // 成功回饋與跳轉
      Alert.alert('✅ 儲存成功', '施工日誌已儲存並提交審核', [
        { text: '確定', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      console.error("Submit Error:", error);
      Alert.alert('❌ 儲存失敗', error.message || '連線錯誤或權限不足，請稍後再試。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{
        title: '新增施工日誌',
        headerStyle: { backgroundColor: '#002147' },
        headerTintColor: '#fff',
        headerLeft: () => null,
        headerRight: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 10 }}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        )
      }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 60 }}>

          <Text style={styles.label}>🏗️ 所屬專案 <Text style={{ color: 'red' }}>*</Text></Text>
          <TouchableOpacity style={styles.input} onPress={() => setShowProjectPicker(!showProjectPicker)}>
            <Text style={{ color: formData.project ? '#333' : '#999', fontSize: 16 }}>{formData.project || '點擊選擇專案...'}</Text>
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
              <Text style={styles.label}>📅 施工日期</Text>
              <View style={[styles.input, { backgroundColor: '#f0f0f0' }]}>
                <Text style={{ fontSize: 16 }}>{formData.date}</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>☀️ 天氣狀況</Text>
              <View style={styles.weatherGroup}>
                {['晴', '陰', '雨'].map(w => (
                  <TouchableOpacity key={w} style={[styles.weatherBtn, formData.weather === w && styles.weatherBtnActive]} onPress={() => setFormData(prev => ({ ...prev, weather: w }))}>
                    <Text style={[styles.weatherText, formData.weather === w && styles.weatherTextActive]}>{w}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* 進度資訊 */}
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.label}>📈 預定進度 (%)</Text>
              <View style={[styles.input, { backgroundColor: '#E3F2FD' }]}>
                <Text style={{ color: '#002147', fontWeight: 'bold', fontSize: 16 }}>{scheduledProgress}%</Text>
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
          <Text style={styles.label}>📝 施工內容摘要 <Text style={{ color: 'red' }}>*</Text></Text>
          <TextInput
            style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
            multiline
            placeholder="請詳細填寫今日主要施工項目與進度..."
            value={formData.content}
            onChangeText={t => setFormData(prev => ({ ...prev, content: t }))}
          />

          {/* 出工區塊 */}
          <View style={styles.sectionHeader}>
            <Text style={styles.label}>👷 出工情形 (工種/人數)</Text>
            <TouchableOpacity onPress={addPersonnel}><Ionicons name="add-circle" size={28} color="#C69C6D" /></TouchableOpacity>
          </View>
          {formData.personnelList.map((item) => (
            <View key={item.id} style={styles.listCard}>
              <View style={styles.listRow}>
                <TextInput style={[styles.subInput, { flex: 2 }]} placeholder="例如：水電工" value={item.type} onChangeText={t => updatePersonnel(item.id, 'type', t)} />
                <TextInput style={[styles.subInput, { flex: 1, marginLeft: 10 }]} placeholder="人數" keyboardType="numeric" value={item.count.toString()} onChangeText={t => updatePersonnel(item.id, 'count', parseInt(t) || 0)} />
                <TouchableOpacity style={{ marginLeft: 10 }} onPress={() => removePersonnel(item.id)}><Ionicons name="trash" size={22} color="#FF6B6B" /></TouchableOpacity>
              </View>
              <TextInput style={[styles.subInput, { marginTop: 8 }]} placeholder="備註 (例如：加班 2 小時)" value={item.note} onChangeText={t => updatePersonnel(item.id, 'note', t)} />
            </View>
          ))}

          {/* 機具區塊 */}
          <View style={styles.sectionHeader}>
            <Text style={styles.label}>🚜 機具使用 (名稱/數量)</Text>
            <TouchableOpacity onPress={addMachine}><Ionicons name="add-circle" size={28} color="#C69C6D" /></TouchableOpacity>
          </View>
          {formData.machineList.map((item) => (
            <View key={item.id} style={styles.listCard}>
              <View style={styles.listRow}>
                <TextInput style={[styles.subInput, { flex: 2 }]} placeholder="例如：挖掘機" value={item.name} onChangeText={t => updateMachine(item.id, 'name', t)} />
                <TextInput style={[styles.subInput, { flex: 1, marginLeft: 10 }]} placeholder="數量" keyboardType="numeric" value={item.quantity.toString()} onChangeText={t => updateMachine(item.id, 'quantity', parseInt(t) || 0)} />
                <TouchableOpacity style={{ marginLeft: 10 }} onPress={() => removeMachine(item.id)}><Ionicons name="trash" size={22} color="#FF6B6B" /></TouchableOpacity>
              </View>
              <TextInput style={[styles.subInput, { marginTop: 8 }]} placeholder="備註 (例如：維修中)" value={item.note} onChangeText={t => updateMachine(item.id, 'note', t)} />
            </View>
          ))}

          <Text style={styles.label}>📸 施工照片 (多張上傳)</Text>
          <View style={styles.photoGrid}>
            {formData.photos.map((url, idx) => (
              <View key={idx} style={styles.photoItem}>
                <Image source={{ uri: url }} style={styles.photoImg} />
                <TouchableOpacity style={styles.photoDelete} onPress={() => removePhoto(idx)}><Ionicons name="close-circle" size={22} color="#F44336" /></TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.photoAdd} onPress={pickImages} disabled={isUploading}>
              {isUploading ? <ActivityIndicator color="#C69C6D" /> : <Ionicons name="camera" size={32} color="#AAA" />}
              <Text style={{ color: '#AAA', fontSize: 11, marginTop: 4 }}>{isUploading ? '上傳中...' : '選取照片'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>⚠️ 異常狀況 / 備忘錄</Text>
          <TextInput
            style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
            multiline
            placeholder="若有缺失、停工或特殊狀況說明..."
            value={formData.notes}
            onChangeText={t => setFormData(prev => ({ ...prev, notes: t }))}
          />

        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitBtn, (isUploading || isSubmitting) && { backgroundColor: '#AAA' }]}
          onPress={handleSubmit}
          disabled={isUploading || isSubmitting}
        >
          {isSubmitting ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator color="#fff" style={{ marginRight: 10 }} />
              <Text style={styles.submitBtnText}>日誌處理中...</Text>
            </View>
          ) : (
            <Text style={styles.submitBtnText}>儲存施工日誌</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  body: { padding: 20 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#002147', marginTop: 18, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#E0E4E8',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#F9FAFB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  pickerBox: { borderWidth: 1, borderColor: '#EEE', borderRadius: 12, marginTop: 5, backgroundColor: '#FFF', elevation: 4 },
  pickerItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  row: { flexDirection: 'row' },
  weatherGroup: { flexDirection: 'row', gap: 8 },
  weatherBtn: { flex: 1, paddingVertical: 12, borderWidth: 1, borderColor: '#EEE', borderRadius: 10, alignItems: 'center' },
  weatherBtnActive: { backgroundColor: '#C69C6D', borderColor: '#C69C6D' },
  weatherText: { color: '#666', fontSize: 14 },
  weatherTextActive: { color: '#FFF', fontWeight: 'bold' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 10 },
  listCard: { backgroundColor: '#F3F5F7', padding: 14, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  listRow: { flexDirection: 'row', alignItems: 'center' },
  subInput: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 15 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  photoItem: { width: 90, height: 90, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  photoImg: { width: '100%', height: '100%' },
  photoDelete: { position: 'absolute', top: 3, right: 3, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 12 },
  photoAdd: { width: 90, height: 90, borderRadius: 12, borderWidth: 1, borderColor: '#CBD5E1', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#EEE', backgroundColor: '#FFF' },
  submitBtn: { backgroundColor: '#C69C6D', padding: 18, borderRadius: 14, alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 5 },
  submitBtnText: { color: '#FFF', fontSize: 17, fontWeight: 'bold' }
});