import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, Modal, TextInput, KeyboardAvoidingView, SafeAreaView } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useProjects, Project, Extension } from '../../context/ProjectContext'; // Corrected Import
import { useUser } from '../../context/UserContext';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';

const THEME = {
  primary: '#C69C6D',
  background: '#F5F7FA',
  card: '#ffffff',
  headerBg: '#002147',
  text: '#333333',
  danger: '#FF6B6B'
};

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams();
  const { projects, deleteProject, updateProject } = useProjects(); // Fixed Hook
  const { user } = useUser(); // Using simple user check for now
  const router = useRouter();

  const project = projects.find(p => p.id === id);

  // State for Edit
  const [isEditVisible, setIsEditVisible] = useState(false);
  const [editData, setEditData] = useState<Partial<Project>>({});

  // State for adding extension inside Edit Mode
  const [newExt, setNewExt] = useState<Partial<Extension>>({ date: '', docNumber: '', reason: '', days: 0 });
  const [showExtForm, setShowExtForm] = useState(false);

  if (!project) return (
    <View style={styles.container}>
      <SafeAreaView><Text style={{ textAlign: 'center', marginTop: 100 }}>找不到專案資訊</Text></SafeAreaView>
    </View>
  );

  // Calc Logic
  const calculateTotalExtension = (exts: Extension[] = []) => {
    return exts.reduce((sum, e) => sum + (Number(e.days) || 0), 0);
  };

  const calculateEndDate = (start: string | undefined, duration: number | undefined, extDays: number) => {
    if (!start || !duration) return '-';
    try {
      const startDate = new Date(start);
      if (isNaN(startDate.getTime())) return '-';

      // Formula: Start + Duration + Ext - 1
      const totalDays = duration + extDays - 1;
      startDate.setDate(startDate.getDate() + totalDays);
      return startDate.toISOString().split('T')[0];
    } catch (e) {
      return '計算錯誤';
    }
  };

  const displayExtDays = calculateTotalExtension(project.extensions);
  const displayEndDate = calculateEndDate(project.startDate, project.contractDuration, displayExtDays);

  const editExtDays = calculateTotalExtension(editData.extensions || []);
  const editEndDate = calculateEndDate(editData.startDate, editData.contractDuration, editExtDays);

  // Handlers
  const handleDelete = () => {
    Alert.alert('刪除確認', `確定要刪除 ${project.name} 嗎？此動作無法復原。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除', style: 'destructive', onPress: () => {
          deleteProject(project.id);
          router.back();
        }
      }
    ]);
  };

  const openEdit = () => {
    setEditData(JSON.parse(JSON.stringify(project)));
    setIsEditVisible(true);
  };

  const handleSaveEdit = () => {
    if (!editData.name) { Alert.alert('錯誤', '專案名稱不可為空'); return; }
    updateProject(project.id, editData);
    setIsEditVisible(false);
    Alert.alert('成功', '專案資料已更新');
  };

  // Extension Mgmt inside Edit
  const addExtension = () => {
    if (!newExt.days || !newExt.reason) {
      Alert.alert('錯誤', '請填寫天數與理由');
      return;
    }
    const extension: Extension = {
      id: Math.random().toString(36).substr(2, 9),
      date: newExt.date || new Date().toISOString().split('T')[0],
      days: Number(newExt.days),
      reason: newExt.reason || '',
      docNumber: newExt.docNumber || ''
    };
    setEditData(prev => ({ ...prev, extensions: [...(prev.extensions || []), extension] }));
    setNewExt({ date: '', docNumber: '', reason: '', days: 0 });
    setShowExtForm(false);
  };

  const removeExtension = (extId: string) => {
    setEditData(prev => ({ ...prev, extensions: prev.extensions?.filter(e => e.id !== extId) }));
  };

  const InfoRow = ({ label, value, highlight }: any) => (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, highlight && { color: THEME.primary, fontWeight: 'bold' }]}>{value || '-'}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.headerArea}>
        <View style={styles.navHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>專案詳情</Text>
          <View style={{ width: 24 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleSection}>
          <Text style={styles.projectTitle}>{project.name}</Text>
          <View style={[styles.statusTag, { backgroundColor: project.status === 'construction' ? '#E3F2FD' : '#eee' }]}>
            <Text style={{ color: '#002147', fontWeight: 'bold', fontSize: 12 }}>
              {project.status === 'construction' ? '施工中' : project.status === 'planning' ? '規劃中' : '已完工'}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>基本資訊</Text>
          <InfoRow label="工程地點" value={project.address} />
          <InfoRow label="工地主任" value={project.manager} />
          <InfoRow label="決標日期" value={project.awardDate} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>工期管理</Text>
          <InfoRow label="開工日期" value={project.startDate} />
          <InfoRow label="契約工期" value={project.contractDuration ? `${project.contractDuration} 天` : '-'} />
          <InfoRow label="展延天數" value={`${displayExtDays} 天`} />
          <View style={styles.divider} />
          <InfoRow label="預定竣工" value={displayEndDate} highlight />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>驗收結案</Text>
          <InfoRow label="實際竣工" value={project.actualCompletionDate} />
          <InfoRow label="驗收日期" value={project.inspectionDate} />
          <InfoRow label="複驗日期" value={project.reinspectionDate} />
          <InfoRow label="驗收合格" value={project.inspectionPassedDate} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>展延明細 ({project.extensions?.length || 0})</Text>
          {project.extensions?.map((ext, idx) => (
            <View key={idx} style={styles.extRow}>
              <View>
                <Text style={styles.extReason}>{idx + 1}. {ext.reason}</Text>
                <Text style={styles.extMeta}>{ext.date} | 文號: {ext.docNumber}</Text>
              </View>
              <Text style={styles.extDays}>+{ext.days}天</Text>
            </View>
          ))}
          {(!project.extensions || project.extensions.length === 0) && <Text style={{ color: '#999', fontStyle: 'italic' }}>無展延紀錄</Text>}
        </View>

        {/* Edit Button */}
        <TouchableOpacity style={styles.editBtn} onPress={openEdit}>
          <Text style={styles.editBtnText}>編輯專案</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={isEditVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>編輯專案</Text>
              <TouchableOpacity onPress={() => setIsEditVisible(false)}><Ionicons name="close" size={28} color="#333" /></TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.groupHeader}>基本資料</Text>
              <Text style={styles.label}>專案名稱</Text>
              <TextInput style={styles.input} value={editData.name} onChangeText={t => setEditData({ ...editData, name: t })} />
              <Text style={styles.label}>地址</Text>
              <TextInput style={styles.input} value={editData.address} onChangeText={t => setEditData({ ...editData, address: t })} />
              <Text style={styles.label}>工地主任</Text>
              <TextInput style={styles.input} value={editData.manager} onChangeText={t => setEditData({ ...editData, manager: t })} />

              <Text style={styles.groupHeader}>關鍵日期</Text>
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 5 }}>
                  <Text style={styles.label}>決標日期</Text>
                  <TextInput style={styles.input} value={editData.awardDate} onChangeText={t => setEditData({ ...editData, awardDate: t })} />
                </View>
                <View style={{ flex: 1, marginLeft: 5 }}>
                  <Text style={styles.label}>開工日期</Text>
                  <TextInput style={styles.input} value={editData.startDate} onChangeText={t => setEditData({ ...editData, startDate: t })} />
                </View>
              </View>
              <Text style={styles.label}>契約工期 (天)</Text>
              <TextInput style={styles.input} value={editData.contractDuration?.toString()} onChangeText={t => setEditData({ ...editData, contractDuration: parseInt(t) || 0 })} keyboardType="number-pad" />

              <View style={styles.calcBox}>
                <Text style={styles.calcLabel}>即時計算：預定竣工日</Text>
                <Text style={styles.calcValue}>{editEndDate}</Text>
              </View>

              <Text style={styles.groupHeader}>展延紀錄</Text>
              {editData.extensions?.map(ext => (
                <View key={ext.id} style={styles.extEditItem}>
                  <Text style={{ flex: 1 }}>{ext.reason} ({ext.days}天)</Text>
                  <TouchableOpacity onPress={() => removeExtension(ext.id)}><Ionicons name="trash" size={20} color={THEME.danger} /></TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity style={styles.addExtTrigger} onPress={() => setShowExtForm(!showExtForm)}>
                <Text style={{ color: THEME.primary, fontWeight: 'bold' }}>{showExtForm ? '取消新增' : '+ 新增展延紀錄'}</Text>
              </TouchableOpacity>

              {showExtForm && (
                <View style={styles.addExtBox}>
                  <View style={styles.row}>
                    <TextInput style={[styles.smInput, { flex: 1 }]} placeholder="天數" value={newExt.days?.toString()} onChangeText={t => setNewExt({ ...newExt, days: t })} keyboardType="number-pad" />
                    <TextInput style={[styles.smInput, { flex: 2, marginLeft: 5 }]} placeholder="理由" value={newExt.reason} onChangeText={t => setNewExt({ ...newExt, reason: t })} />
                  </View>
                  <View style={[styles.row, { marginTop: 5 }]}>
                    <TextInput style={[styles.smInput, { flex: 1 }]} placeholder="日期" value={newExt.date} onChangeText={t => setNewExt({ ...newExt, date: t })} />
                    <TextInput style={[styles.smInput, { flex: 1, marginLeft: 5 }]} placeholder="文號" value={newExt.docNumber} onChangeText={t => setNewExt({ ...newExt, docNumber: t })} />
                  </View>
                  <TouchableOpacity style={styles.miniBtn} onPress={addExtension}><Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>加入</Text></TouchableOpacity>
                </View>
              )}

              <Text style={styles.groupHeader}>驗收日期</Text>
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 5 }}>
                  <Text style={styles.label}>實際竣工</Text>
                  <TextInput style={styles.input} value={editData.actualCompletionDate} onChangeText={t => setEditData({ ...editData, actualCompletionDate: t })} />
                </View>
                <View style={{ flex: 1, marginLeft: 5 }}>
                  <Text style={styles.label}>驗收日期</Text>
                  <TextInput style={styles.input} value={editData.inspectionDate} onChangeText={t => setEditData({ ...editData, inspectionDate: t })} />
                </View>
              </View>
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 5 }}>
                  <Text style={styles.label}>複驗日期</Text>
                  <TextInput style={styles.input} value={editData.reinspectionDate} onChangeText={t => setEditData({ ...editData, reinspectionDate: t })} />
                </View>
                <View style={{ flex: 1, marginLeft: 5 }}>
                  <Text style={styles.label}>驗收合格</Text>
                  <TextInput style={styles.input} value={editData.inspectionPassedDate} onChangeText={t => setEditData({ ...editData, inspectionPassedDate: t })} />
                </View>
              </View>

              <TouchableOpacity style={styles.deleteLink} onPress={handleDelete}>
                <Text style={{ color: THEME.danger }}>刪除此專案</Text>
              </TouchableOpacity>

              <View style={{ height: 50 }} />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdit}>
                <Text style={styles.saveBtnText}>儲存變更</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  headerArea: { backgroundColor: THEME.headerBg, paddingTop: Platform.OS === 'android' ? 25 : 0 },
  navHeader: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  backBtn: { padding: 5 },
  content: { padding: 20 },

  titleSection: { marginBottom: 20 },
  projectTitle: { fontSize: 24, fontWeight: 'bold', color: '#002147', marginBottom: 5 },
  statusTag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15 },

  card: { backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 15, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: THEME.primary, marginBottom: 15, borderLeftWidth: 3, borderLeftColor: THEME.primary, paddingLeft: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  infoLabel: { color: '#666' },
  infoValue: { color: '#333', fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 10 },

  extRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f9f9f9' },
  extReason: { fontWeight: 'bold', color: '#333' },
  extMeta: { fontSize: 12, color: '#999', marginTop: 2 },
  extDays: { color: THEME.primary, fontWeight: 'bold' },

  editBtn: { backgroundColor: '#002147', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  editBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', height: '90%', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalHeader: { padding: 20, borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  modalBody: { flex: 1, padding: 20 },
  modalFooter: { padding: 20, borderTopWidth: 1, borderColor: '#eee' },

  groupHeader: { fontSize: 14, fontWeight: 'bold', color: '#999', marginTop: 20, marginBottom: 10, backgroundColor: '#f0f0f0', padding: 5 },
  label: { fontSize: 14, color: '#333', marginBottom: 5, marginTop: 10, fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 16, backgroundColor: '#F9F9F9' },
  row: { flexDirection: 'row' },

  calcBox: { backgroundColor: '#E3F2FD', padding: 15, borderRadius: 8, marginTop: 15, alignItems: 'center' },
  calcLabel: { fontSize: 12, color: '#666' },
  calcValue: { fontSize: 20, fontWeight: 'bold', color: '#002147', marginTop: 5 },

  saveBtn: { backgroundColor: THEME.primary, padding: 15, borderRadius: 10, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  deleteLink: { alignItems: 'center', marginTop: 20 },

  // Ext Edit
  extEditItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee' },
  addExtTrigger: { padding: 10, alignItems: 'center', marginTop: 5 },
  addExtBox: { backgroundColor: '#f9f9f9', padding: 10, borderRadius: 8, marginTop: 5 },
  smInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 5, padding: 8, fontSize: 14 },
  miniBtn: { backgroundColor: '#555', padding: 8, borderRadius: 5, alignItems: 'center', marginTop: 8, alignSelf: 'flex-end' }
});