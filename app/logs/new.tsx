import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator, SafeAreaView, Platform, KeyboardAvoidingView, StatusBar } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useMemo } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { uploadToCloudinary, uploadMultipleToCloudinary } from '../../src/utils/cloudinary';
import { useLogs, LaborItem, MachineItem } from '../../context/LogContext';
import { useProjects } from '../../context/ProjectContext';
import { useUser } from '../../context/UserContext';

export default function NewLogScreen() {
  const router = useRouter();
  const { date: initialDate } = useLocalSearchParams<{ date?: string }>();
  const { addLog, uploadPhoto } = useLogs();
  const { projects } = useProjects();
  const { user } = useUser();

  const [formData, setFormData] = useState({
    projectId: '', project: '',
    date: initialDate || new Date().toISOString().split('T')[0],
    weather: '晴', content: '',
    personnelList: [] as LaborItem[],
    machineList: [] as MachineItem[],
    photos: [] as string[],
    issues: '',
    actualProgress: ''
  });
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  // 預定進度計算
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

  const addPersonnel = () => {
    const newItem: LaborItem = { id: Date.now().toString(), type: '', count: 1, note: '' };
    setFormData(prev => ({ ...prev, personnelList: [...prev.personnelList, newItem] }));
  };
  const updatePersonnel = (id: string, field: keyof LaborItem, value: any) => {
    setFormData(prev => ({ ...prev, personnelList: prev.personnelList.map(item => item.id === id ? { ...item, [field]: value } : item) }));
  };
  const removePersonnel = (id: string) => {
    setFormData(prev => ({ ...prev, personnelList: prev.personnelList.filter(item => item.id !== id) }));
  };

  const addMachine = () => {
    const newItem: MachineItem = { id: Date.now().toString(), name: '', quantity: 1, note: '' };
    setFormData(prev => ({ ...prev, machineList: [...prev.machineList, newItem] }));
  };
  const updateMachine = (id: string, field: keyof MachineItem, value: any) => {
    setFormData(prev => ({ ...prev, machineList: prev.machineList.map(item => item.id === id ? { ...item, [field]: value } : item) }));
  };
  const removeMachine = (id: string) => {
    setFormData(prev => ({ ...prev, machineList: prev.machineList.filter(item => item.id !== id) }));
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
        // Use the new utility for consistency and to ensure cloud name df8uaeazt
        const uploadNeeded = result.assets.map(asset => ({ uri: asset.uri, name: asset.fileName || `photo_${Date.now()}.jpg` }));
        const uploadedDocs = await uploadMultipleToCloudinary(uploadNeeded);
        const urls = uploadedDocs.map(d => d.url);
        setFormData(prev => ({ ...prev, photos: [...prev.photos, ...urls] }));
      }
    } catch (error) {
      Alert.alert('上傳失敗', '請檢查網路。');
    } finally {
      setIsUploading(false);
    }
  };
  const removePhoto = (index: number) => {
    setFormData(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!formData.projectId) return Alert.alert('資料缺漏', '請選擇專案');
    if (!formData.content || String(formData.content).trim() === '') return Alert.alert('資料缺漏', '請填寫內容');

    try {
      setIsSubmitting(true);
      const issueStr = formData.issues ? String(formData.issues).trim() : '';
      const hasIssue = issueStr.length > 0;
      const status: any = hasIssue ? 'issue' : 'pending_review';

      await addLog({
        ...formData,
        status,
        reporterId: user?.uid || '',
        plannedProgress: parseFloat(scheduledProgress) || 0,
        actualProgress: formData.actualProgress
      } as any);

      Alert.alert('成功', '已新增', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e: any) {
      Alert.alert('失敗', e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#002147" />

      {/* 自定義 Header */}
      <SafeAreaView style={styles.headerSafeArea}>
        <View style={styles.customHeader}>
          <View style={{ width: 40 }} />
          <Text style={styles.headerTitle}>新增施工日誌</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView style={{ padding: 20 }} contentContainerStyle={{ paddingBottom: 50 }}>

          {/* 專案選擇 */}
          <Text style={styles.label}>專案名稱 (下拉選擇)</Text>
          <TouchableOpacity style={styles.input} onPress={() => setShowProjectPicker(!showProjectPicker)}>
            <Text style={{ color: formData.project ? '#000' : '#999' }}>{formData.project || '請選擇專案...'}</Text>
            <Ionicons name="chevron-down" size={20} color="#666" />
          </TouchableOpacity>
          {showProjectPicker && (
            <View style={styles.pickerBox}>
              {projects.map(p => (
                <TouchableOpacity key={p.id} onPress={() => { setFormData({ ...formData, projectId: p.id, project: p.name }); setShowProjectPicker(false); }} style={styles.pickerItem}>
                  <Text>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* 進度行 */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>今日實際累計進度 (%)</Text>
              <TextInput style={styles.input} keyboardType='numeric' placeholder="例如 : 35.5" value={formData.actualProgress} onChangeText={t => setFormData({ ...formData, actualProgress: t })} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>預定進度 (%)</Text>
              <View style={[styles.input, { backgroundColor: '#EFF6FF' }]}>
                <Text style={{ fontWeight: 'bold', color: '#1D4ED8' }}>{scheduledProgress}</Text>
              </View>
            </View>
          </View>

          {/* 日期與天氣 (加回來了！) */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>日期</Text>
              <View style={styles.dateInputWrapper}>
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    style={{ border: 'none', width: '100%', height: '100%', outline: 'none', background: 'transparent', fontSize: 15 }}
                  />
                ) : (
                  <TextInput style={{ flex: 1 }} value={formData.date} editable={false} /> // 手機版暫時唯讀，或接 DateTimePicker
                )}
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>天氣</Text>
              <View style={{ flexDirection: 'row', height: 48, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#ddd' }}>
                {['晴', '陰', '雨'].map(w => (
                  <TouchableOpacity
                    key={w}
                    style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: formData.weather === w ? '#C69C6D' : '#f9f9f9' }}
                    onPress={() => setFormData(prev => ({ ...prev, weather: w }))}
                  >
                    <Text style={{ color: formData.weather === w ? '#fff' : '#666', fontWeight: 'bold' }}>{w}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* 施工內容 */}
          <Text style={styles.label}>施工項目</Text>
          <TextInput
            style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
            multiline
            placeholder="今日施工項目..."
            value={formData.content}
            onChangeText={t => setFormData({ ...formData, content: t })}
          />

          {/* 出工 (回復完整版面) */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>👷 出工 (工種/人數)</Text>
            <TouchableOpacity onPress={addPersonnel}><Ionicons name="add-circle" size={26} color="#C69C6D" /></TouchableOpacity>
          </View>
          {formData.personnelList.map(p => (
            <View key={p.id} style={styles.itemCard}>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                <TextInput style={[styles.subInput, { flex: 2 }]} placeholder="工種" value={p.type} onChangeText={v => updatePersonnel(p.id, 'type', v)} />
                <TextInput style={[styles.subInput, { flex: 1 }]} placeholder="人數" keyboardType="numeric" value={String(p.count)} onChangeText={v => updatePersonnel(p.id, 'count', v)} />
                <TouchableOpacity onPress={() => removePersonnel(p.id)} style={{ justifyContent: 'center' }}><Ionicons name="trash" size={20} color="#FF6B6B" /></TouchableOpacity>
              </View>
              <TextInput style={styles.subInput} placeholder="備註" value={p.note} onChangeText={v => updatePersonnel(p.id, 'note', v)} />
            </View>
          ))}

          {/* 機具 (回復完整版面) */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🚜 機具 (名稱/數量)</Text>
            <TouchableOpacity onPress={addMachine}><Ionicons name="add-circle" size={26} color="#C69C6D" /></TouchableOpacity>
          </View>
          {formData.machineList.map(m => (
            <View key={m.id} style={styles.itemCard}>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                <TextInput style={[styles.subInput, { flex: 2 }]} placeholder="機具名稱" value={m.name} onChangeText={v => updateMachine(m.id, 'name', v)} />
                <TextInput style={[styles.subInput, { flex: 1 }]} placeholder="數量" keyboardType="numeric" value={String(m.quantity)} onChangeText={v => updateMachine(m.id, 'quantity', v)} />
                <TouchableOpacity onPress={() => removeMachine(m.id)} style={{ justifyContent: 'center' }}><Ionicons name="trash" size={20} color="#FF6B6B" /></TouchableOpacity>
              </View>
              <TextInput style={styles.subInput} placeholder="備註" value={m.note} onChangeText={v => updateMachine(m.id, 'note', v)} />
            </View>
          ))}

          <Text style={styles.label}>📸 施工照片</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {formData.photos.map((p, i) => (
              <View key={i} style={styles.photoBox}>
                <Image source={{ uri: p }} style={styles.photo} />
                <TouchableOpacity style={styles.photoDel} onPress={() => removePhoto(i)}>
                  <Ionicons name="close-circle" size={20} color="#F44336" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity onPress={pickImages} style={styles.addPhoto} disabled={isUploading}>
              {isUploading ? <ActivityIndicator color="#C69C6D" /> : <Ionicons name="camera" size={32} color="#ccc" />}
              <Text style={{ fontSize: 10, color: '#999', marginTop: 4 }}>新增照片</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>⚠️ 異常狀況報告</Text>
          <TextInput
            style={[styles.input, { height: 80, borderColor: formData.issues ? '#F59E0B' : '#ddd', borderWidth: formData.issues ? 2 : 1 }]}
            multiline
            placeholder="請填列異常狀況..."
            value={formData.issues}
            onChangeText={t => setFormData({ ...formData, issues: t })}
          />

        </ScrollView>
      </KeyboardAvoidingView>

      <TouchableOpacity style={styles.btn} onPress={handleSubmit} disabled={isSubmitting}>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>{isSubmitting ? '處理中...' : '儲存並送審'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  headerSafeArea: { backgroundColor: '#002147' },
  customHeader: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  headerBtn: { padding: 5 },
  label: { marginTop: 15, fontWeight: 'bold', marginBottom: 5, color: '#333' },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, backgroundColor: '#fff', fontSize: 15 },
  dateInputWrapper: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, height: 48, justifyContent: 'center', paddingHorizontal: 10, backgroundColor: '#fff' },
  pickerBox: { borderWidth: 1, borderColor: '#eee', marginTop: 5, borderRadius: 8, backgroundColor: '#fff', elevation: 2 },
  pickerItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 25, marginBottom: 5 },
  sectionTitle: { fontWeight: 'bold', color: '#002147' },
  itemCard: { backgroundColor: '#F9FAFB', padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#eee' },
  subInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 8, fontSize: 14 },
  photoBox: { width: 80, height: 80, borderRadius: 8, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  photoDel: { position: 'absolute', top: 2, right: 2, backgroundColor: '#fff', borderRadius: 10 },
  addPhoto: { width: 80, height: 80, borderWidth: 1, borderColor: '#ddd', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  btn: { margin: 20, backgroundColor: '#C69C6D', padding: 15, alignItems: 'center', borderRadius: 10, elevation: 3 },
});