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
        notes: existingLog.notes || '',
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
      toast.error('上傳失敗');
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    setFormData(prev => ({ ...prev, photos: prev.photos?.filter((_, i) => i !== index) }));
  };

  // --- 異常解除 (Resolve Issue) ---
  const handleResolveIssue = async () => {
    Alert.alert('解除列管', '確定要清除當前異常狀況並標記為已解除嗎？', [
      { text: '取消', style: 'cancel' },
      {
        text: '確定解除',
        style: 'destructive',
        onPress: async () => {
          try {
            await updateLog(id as string, { notes: '' });
            setFormData(prev => ({ ...prev, notes: '' }));
            Alert.alert('成功', '異常狀況已解除列管');
          } catch (e) {
            Alert.alert('錯誤', '解除失敗，請確認網路連線。');
          }
        }
      }
    ]);
  };

  // --- 管理員審核 (Admin Approve) ---
  const handleApprove = async () => {
    Alert.alert('審核日誌', '確定要核准此筆施工日誌嗎？', [
      { text: '取消', style: 'cancel' },
      {
        text: '核准',
        onPress: async () => {
          try {
            setIsSubmitting(true);
            await updateLog(id as string, { status: 'approved' });
            Alert.alert('✅ 已核准', '該筆日誌已正式歸檔。', [
              { text: '確定', onPress: () => router.back() }
            ]);
          } catch (e) {
            Alert.alert('錯誤', '核准失敗');
          } finally {
            setIsSubmitting(false);
          }
        }
      }
    ]);
  };

  // --- Submit Update ---
  const handleSubmit = async () => {
    if (isSubmitting) return;

    if (!formData.content?.trim()) {
      Alert.alert('資料缺漏', '請填寫「施工內容摘要」才能儲存。');
      return;
    }
    if (isUploading) {
      Alert.alert('請等待', '照片上傳中，請稍候。');
      return;
    }

    try {
      setIsSubmitting(true);
      await updateLog(id as string, {
        ...formData,
        status: (formData.status === 'rejected' ? 'pending_review' : formData.status) as any,
        plannedProgress: parseFloat(scheduledProgress) || 0,
        actualProgress: formData.actualProgress
      });

      Alert.alert('✅ 修改成功', '日誌資料已更新並提交。', [
        { text: '確定', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error(error);
      Alert.alert('❌ 儲存失敗', '無法連線至資料庫，請檢查網路。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{
        title: '編輯日誌',
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
              <Text style={styles.label}>📅 施工日期</Text>
              <View style={[styles.input, { backgroundColor: '#F3F4F6' }]}>
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

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.label}>📈 預定進度 (%)</Text>
              <View style={[styles.input, { backgroundColor: '#E0F2FE' }]}>
                <Text style={{ color: '#0369A1', fontWeight: 'bold', fontSize: 16 }}>{scheduledProgress}%</Text>
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

          <Text style={styles.label}>📝 施工內容摘要 <Text style={{ color: 'red' }}>*</Text></Text>
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
          {formData.personnelList?.map((item) => (
            <View key={item.id} style={styles.listCard}>
              <View style={styles.listRow}>
                <TextInput style={[styles.subInput, { flex: 2 }]} placeholder="工種" value={item.type} onChangeText={t => updatePersonnel(item.id, 'type', t)} />
                <TextInput style={[styles.subInput, { flex: 1, marginLeft: 10 }]} placeholder="人數" keyboardType="numeric" value={item.count?.toString()} onChangeText={t => updatePersonnel(item.id, 'count', parseInt(t) || 0)} />
                <TouchableOpacity style={{ marginLeft: 10 }} onPress={() => removePersonnel(item.id)}><Ionicons name="trash" size={22} color="#FF6B6B" /></TouchableOpacity>
              </View>
              <TextInput style={[styles.subInput, { marginTop: 8 }]} placeholder="備註" value={item.note || (item as any).work} onChangeText={t => updatePersonnel(item.id, 'note', t)} />
            </View>
          ))}

          <View style={styles.sectionHeader}>
            <Text style={styles.label}>🚜 機具 (名稱/數量)</Text>
            <TouchableOpacity onPress={addMachine}><Ionicons name="add-circle" size={28} color="#C69C6D" /></TouchableOpacity>
          </View>
          {formData.machineList?.map((item) => (
            <View key={item.id} style={styles.listCard}>
              <View style={styles.listRow}>
                <TextInput style={[styles.subInput, { flex: 2 }]} placeholder="名稱" value={item.name} onChangeText={t => updateMachine(item.id, 'name', t)} />
                <TextInput style={[styles.subInput, { flex: 1, marginLeft: 10 }]} placeholder="數量" keyboardType="numeric" value={item.quantity?.toString()} onChangeText={t => updateMachine(item.id, 'quantity', parseInt(t) || 0)} />
                <TouchableOpacity style={{ marginLeft: 10 }} onPress={() => removeMachine(item.id)}><Ionicons name="trash" size={22} color="#FF6B6B" /></TouchableOpacity>
              </View>
              <TextInput style={[styles.subInput, { marginTop: 8 }]} placeholder="備註" value={item.note} onChangeText={t => updateMachine(item.id, 'note', t)} />
            </View>
          ))}

          <Text style={styles.label}>📸 施工照片 (多選預覽)</Text>
          <View style={styles.photoGrid}>
            {formData.photos?.map((url, idx) => (
              <View key={idx} style={styles.photoItem}>
                <Image source={{ uri: url }} style={styles.photoImg} />
                <TouchableOpacity style={styles.photoDelete} onPress={() => removePhoto(idx)}><Ionicons name="close-circle" size={22} color="#F44336" /></TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.photoAdd} onPress={pickImages} disabled={isUploading}>
              {isUploading ? <ActivityIndicator color="#C69C6D" /> : <Ionicons name="camera" size={32} color="#AAA" />}
              <Text style={{ color: '#AAA', fontSize: 11, marginTop: 4 }}>{isUploading ? '處理中' : '新增照片'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.label}>⚠️ 異常狀況報告 / 備註</Text>
            {formData.notes ? (
              <TouchableOpacity style={styles.resolveBtn} onPress={handleResolveIssue}>
                <Text style={styles.resolveBtnText}>解除列管</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <TextInput
            style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
            multiline
            placeholder="若有缺失或異常狀況請說明..."
            value={formData.notes}
            onChangeText={t => setFormData(prev => ({ ...prev, notes: t }))}
          />

          {/* 管理員專屬：核准按鈕 */}
          {isAdmin && formData.status !== 'approved' && (
            <TouchableOpacity style={styles.approveBtn} onPress={handleApprove} disabled={isSubmitting}>
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
              <Text style={styles.approveBtnText}>核准本筆日誌</Text>
            </TouchableOpacity>
          )}

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
              <ActivityIndicator color="#FFF" style={{ marginRight: 10 }} />
              <Text style={styles.submitBtnText}>儲存處理中...</Text>
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
  container: { flex: 1, backgroundColor: '#FFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  weatherGroup: { flexDirection: 'row', gap: 6 },
  weatherBtn: { flex: 1, paddingVertical: 12, borderWidth: 1, borderColor: '#EEE', borderRadius: 10, alignItems: 'center' },
  weatherBtnActive: { backgroundColor: '#C69C6D', borderColor: '#C69C6D' },
  weatherText: { color: '#666', fontSize: 13 },
  weatherTextActive: { color: '#FFF', fontWeight: 'bold' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 10 },
  listCard: { backgroundColor: '#F8FAFC', padding: 14, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  listRow: { flexDirection: 'row', alignItems: 'center' },
  subInput: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 15, flex: 1 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  photoItem: { width: 90, height: 90, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  photoImg: { width: '100%', height: '100%' },
  photoDelete: { position: 'absolute', top: 3, right: 3, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 12 },
  photoAdd: { width: 90, height: 90, borderRadius: 12, borderWidth: 1, borderColor: '#CBD5E1', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  resolveBtn: { backgroundColor: '#10B981', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  resolveBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  approveBtn: { backgroundColor: '#059669', padding: 16, borderRadius: 12, marginTop: 30, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  approveBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#EEE', backgroundColor: '#FFF' },
  submitBtn: { backgroundColor: '#C69C6D', padding: 18, borderRadius: 14, alignItems: 'center', elevation: 3 },
  submitBtnText: { color: '#FFF', fontSize: 17, fontWeight: 'bold' }
});