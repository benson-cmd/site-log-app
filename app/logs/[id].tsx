import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator, SafeAreaView, Platform, KeyboardAvoidingView, StatusBar } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useMemo, useRef } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useLogs, LaborItem, MachineItem, LogEntry } from '../../context/LogContext';
import { useProjects } from '../../context/ProjectContext';
import { useUser } from '../../context/UserContext';

export default function EditLogScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { logs, updateLog, uploadPhoto } = useLogs();
  const { projects } = useProjects();
  const { user } = useUser();
  const initialized = useRef(false);

  const [formData, setFormData] = useState<Partial<LogEntry>>({
    project: '', projectId: '', date: '', weather: '晴', content: '',
    personnelList: [], machineList: [], photos: [], issues: '', actualProgress: ''
  });
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.email === 'wu@dwcc.com.tw';

  // 跨平台 Alert
  const showAlert = (title: string, msg?: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${msg || ''}`);
      if (onOk) onOk();
    } else {
      Alert.alert(title, msg, [{ text: '確定', onPress: onOk }]);
    }
  };

  useEffect(() => {
    if (initialized.current) return;

    const existingLog = logs.find(l => l.id === id);
    if (existingLog) {
      setFormData({
        ...existingLog,
        personnelList: existingLog.personnelList || [],
        machineList: existingLog.machineList || [],
        photos: existingLog.photos || [],
        issues: existingLog.issues ? String(existingLog.issues) : '',
        actualProgress: existingLog.actualProgress ? String(existingLog.actualProgress) : ''
      });
      setLoading(false);
      initialized.current = true;
    } else if (logs.length > 0) {
      setLoading(false);
    }
  }, [id, logs]);

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
    setFormData(prev => ({ ...prev, personnelList: [...(prev.personnelList || []), { id: Date.now().toString(), type: '', count: 1, note: '' }] }));
  };
  const updatePersonnel = (id: string, field: string, value: any) => {
    setFormData(prev => ({ ...prev, personnelList: prev.personnelList?.map(i => i.id === id ? { ...i, [field]: value } : i) }));
  };
  const removePersonnel = (id: string) => {
    setFormData(prev => ({ ...prev, personnelList: prev.personnelList?.filter(i => i.id !== id) }));
  };

  const addMachine = () => {
    setFormData(prev => ({ ...prev, machineList: [...(prev.machineList || []), { id: Date.now().toString(), name: '', quantity: 1, note: '' }] }));
  };
  const updateMachine = (id: string, field: string, value: any) => {
    setFormData(prev => ({ ...prev, machineList: prev.machineList?.map(i => i.id === id ? { ...i, [field]: value } : i) }));
  };
  const removeMachine = (id: string) => {
    setFormData(prev => ({ ...prev, machineList: prev.machineList?.filter(i => i.id !== id) }));
  };

  const pickImages = async () => {
    if (isUploading) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, quality: 0.6,
    });
    if (!result.canceled) {
      setIsUploading(true);
      try {
        const uploadPromises = result.assets.map(asset => uploadPhoto(asset.uri));
        const urls = await Promise.all(uploadPromises);
        setFormData(prev => ({ ...prev, photos: [...(prev.photos || []), ...urls] }));
      } catch (e) { showAlert('上傳失敗'); }
      finally { setIsUploading(false); }
    }
  };
  const removePhoto = (index: number) => {
    setFormData(prev => ({ ...prev, photos: prev.photos?.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!formData.content || String(formData.content).trim() === '') return showAlert('請填寫內容');

    try {
      setIsSubmitting(true);
      const rawIssues = formData.issues ? String(formData.issues).trim() : '';
      const hasIssue = rawIssues.length > 0;

      let finalStatus = formData.status;
      if (hasIssue) finalStatus = 'issue';
      else if (formData.status === 'issue') finalStatus = 'pending_review';

      await updateLog(id as string, {
        ...formData,
        issues: rawIssues,
        status: finalStatus,
        plannedProgress: parseFloat(scheduledProgress) || 0,
        actualProgress: formData.actualProgress
      });
      showAlert('成功', '修改已儲存', () => router.back());
    } catch (e: any) {
      showAlert('失敗', e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolve = async () => {
    setFormData(prev => ({ ...prev, issues: '', status: 'pending_review' }));
    try {
      await updateLog(id as string, { issues: '', status: 'pending_review' });
      showAlert('已解除列管');
    } catch (e) {
      showAlert('解除失敗');
    }
  };

  const handleApprove = async () => {
    try {
      setIsSubmitting(true);
      await updateLog(id as string, { status: 'approved' });
      showAlert('✅ 已核准', '日誌已歸檔', () => router.back());
    } catch (e) { showAlert('核准失敗'); } finally { setIsSubmitting(false); }
  };

  const handleReject = async () => {
    try {
      setIsSubmitting(true);
      await updateLog(id as string, { status: 'rejected' });
      showAlert('⛔ 已退回', '日誌已退回', () => router.back());
    } catch (e) { showAlert('操作失敗'); } finally { setIsSubmitting(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#002147" /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#002147" />

      {/* 自定義 Header */}
      <SafeAreaView style={styles.headerSafeArea}>
        <View style={styles.customHeader}>
          <View style={{ width: 40 }} />
          <Text style={styles.headerTitle}>編輯日誌</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView style={{ padding: 20 }} contentContainerStyle={{ paddingBottom: 50 }}>

          <Text style={styles.label}>專案：{formData.project}</Text>

          {/* 日期與天氣 (UI 修復) */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>日期</Text>
              <View style={styles.roInput}><Text>{formData.date}</Text></View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>天氣</Text>
              <View style={{ flexDirection: 'row', height: 48, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#ddd' }}>
                {['晴', '陰', '雨'].map(w => (
                  <TouchableOpacity key={w} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: formData.weather === w ? '#C69C6D' : '#f9f9f9' }} onPress={() => setFormData(prev => ({ ...prev, weather: w }))}>
                    <Text style={{ color: formData.weather === w ? '#fff' : '#666', fontWeight: 'bold' }}>{w}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* 進度行 */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <View style={{ flex: 1 }}><Text style={styles.label}>預定 %</Text><View style={[styles.roInput, { backgroundColor: '#EFF6FF' }]}><Text style={{ color: '#1D4ED8', fontWeight: 'bold' }}>{scheduledProgress}</Text></View></View>
            <View style={{ flex: 1 }}><Text style={styles.label}>實際 %</Text><TextInput style={styles.input} keyboardType='numeric' value={String(formData.actualProgress)} onChangeText={t => setFormData({ ...formData, actualProgress: t })} /></View>
          </View>

          <Text style={styles.label}>施工項目 *</Text>
          <TextInput style={[styles.input, { height: 100, textAlignVertical: 'top' }]} multiline value={formData.content} onChangeText={t => setFormData({ ...formData, content: t })} />

          {/* 出工 (UI 修復) */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>👷 出工 (工種/人數)</Text>
            <TouchableOpacity onPress={addPersonnel}><Ionicons name="add-circle" size={26} color="#C69C6D" /></TouchableOpacity>
          </View>
          {formData.personnelList?.map(p => (
            <View key={p.id} style={styles.itemCard}>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                <TextInput style={[styles.subInput, { flex: 2 }]} value={p.type} onChangeText={v => updatePersonnel(p.id, 'type', v)} placeholder="工種" />
                <TextInput style={[styles.subInput, { flex: 1 }]} value={String(p.count)} onChangeText={v => updatePersonnel(p.id, 'count', v)} placeholder="人" />
                <TouchableOpacity onPress={() => removePersonnel(p.id)} style={{ justifyContent: 'center' }}><Ionicons name="trash" color="#FF6B6B" size={20} /></TouchableOpacity>
              </View>
              <TextInput style={styles.subInput} placeholder="備註" value={p.note} onChangeText={v => updatePersonnel(p.id, 'note', v)} />
            </View>
          ))}

          {/* 機具 (UI 修復) */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🚜 機具 (名稱/數量)</Text>
            <TouchableOpacity onPress={addMachine}><Ionicons name="add-circle" size={26} color="#C69C6D" /></TouchableOpacity>
          </View>
          {formData.machineList?.map(m => (
            <View key={m.id} style={styles.itemCard}>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                <TextInput style={[styles.subInput, { flex: 2 }]} value={m.name} onChangeText={v => updateMachine(m.id, 'name', v)} placeholder="機具" />
                <TextInput style={[styles.subInput, { flex: 1 }]} value={String(m.quantity)} onChangeText={v => updateMachine(m.id, 'quantity', v)} placeholder="數量" />
                <TouchableOpacity onPress={() => removeMachine(m.id)} style={{ justifyContent: 'center' }}><Ionicons name="trash" color="#FF6B6B" size={20} /></TouchableOpacity>
              </View>
              <TextInput style={styles.subInput} placeholder="備註" value={m.note} onChangeText={v => updateMachine(m.id, 'note', v)} />
            </View>
          ))}

          <Text style={styles.label}>📸 施工照片</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {formData.photos?.map((p, i) => (
              <View key={i} style={styles.photoBox}>
                <Image source={{ uri: p }} style={styles.photo} />
                <TouchableOpacity style={styles.photoDel} onPress={() => removePhoto(i)}>
                  <Ionicons name="close-circle" size={20} color="#F44336" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity onPress={pickImages} style={styles.addPhoto} disabled={isUploading}>
              {isUploading ? <ActivityIndicator /> : <Ionicons name="camera" size={24} color="#aaa" />}
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
            <Text style={styles.label}>⚠️ 異常狀況報告</Text>
            {formData.issues ? <TouchableOpacity onPress={handleResolve} style={{ backgroundColor: '#10B981', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 }}><Text style={{ color: '#fff', fontSize: 12 }}>解除列管</Text></TouchableOpacity> : null}
          </View>
          <TextInput style={[styles.input, { borderColor: formData.issues ? '#F59E0B' : '#ddd', borderWidth: formData.issues ? 2 : 1 }]} placeholder="無異常" value={formData.issues} onChangeText={t => setFormData({ ...formData, issues: t })} />

          {isAdmin && formData.status !== 'approved' && (
            <View style={{ flexDirection: 'row', marginTop: 30, gap: 10 }}>
              <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: '#4CAF50', margin: 0 }]} onPress={handleApprove} disabled={isSubmitting}>
                <Text style={{ color: '#fff' }}>核准</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: '#F44336', margin: 0 }]} onPress={handleReject} disabled={isSubmitting}>
                <Text style={{ color: '#fff' }}>退回</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      <TouchableOpacity style={styles.btn} onPress={handleSubmit} disabled={isSubmitting}>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>{isSubmitting ? '處理中...' : '儲存修改'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerSafeArea: { backgroundColor: '#002147' },
  customHeader: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  headerBtn: { padding: 5 },
  label: { marginTop: 15, fontWeight: 'bold', marginBottom: 5, color: '#333' },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, backgroundColor: '#fff', fontSize: 15 },
  roInput: { borderWidth: 1, borderColor: '#eee', padding: 12, borderRadius: 8, backgroundColor: '#f9f9f9', justifyContent: 'center', height: 48 },
  btn: { margin: 20, backgroundColor: '#C69C6D', padding: 15, alignItems: 'center', borderRadius: 10, elevation: 3 },
  addPhoto: { width: 80, height: 80, borderWidth: 1, borderColor: '#ddd', justifyContent: 'center', alignItems: 'center', borderRadius: 8, borderStyle: 'dashed' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 25, marginBottom: 5 },
  sectionTitle: { fontWeight: 'bold', color: '#002147' },
  itemCard: { backgroundColor: '#F9FAFB', padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#eee' },
  subInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 8, fontSize: 14 },
  photoBox: { width: 80, height: 80, borderRadius: 8, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  photoDel: { position: 'absolute', top: 2, right: 2, backgroundColor: '#fff', borderRadius: 10 },
});