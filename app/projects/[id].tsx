import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Platform, StatusBar, Modal, TextInput, Alert, KeyboardAvoidingView } from 'react-native';
import React, { useState, useEffect, useMemo } from 'react';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import Papa from 'papaparse';
import { useProjects, Project, Extension, ChangeDesign, SubsequentExpansion, SchedulePoint } from '../../context/ProjectContext';
import { usePersonnel } from '../../context/PersonnelContext';
import { useLogs } from '../../context/LogContext';

const THEME = {
  primary: '#C69C6D',
  background: '#F5F7FA',
  card: '#ffffff',
  headerBg: '#002147',
  text: '#333333',
  danger: '#FF6B6B',
  success: '#4CAF50',
  warning: '#FF9800'
};

const EXECUTION_STATUS_MAP: Record<string, string> = {
  not_started: '尚未開工',
  started_prep: '開工尚未進場',
  construction: '施工中',
  completed: '完工',
  inspection: '驗收中',
  settlement: '結案'
};
const EXECUTION_STATUS_OPTIONS = Object.keys(EXECUTION_STATUS_MAP);

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { projects, updateProject, deleteProject } = useProjects();
  const { personnelList } = usePersonnel();
  const { logs } = useLogs();

  const project = projects.find(p => p.id === id);
  const projectLogs = logs.filter(l => l.project === project?.name).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Edit Modal State
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [editProject, setEditProject] = useState<Partial<Project>>({});

  // Extension Form
  const [extForm, setExtForm] = useState({ days: '', date: '', docNumber: '', reason: '' });
  // Change Design Form
  const [cdForm, setCdForm] = useState({ count: '', date: '', docNumber: '', reason: '', newTotalAmount: '' });
  // Subsequent Expansion Form
  const [seForm, setSeForm] = useState({ count: '', date: '', docNumber: '', reason: '', amount: '' });

  // Dropdowns
  const [showManagerPicker, setShowManagerPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const managers = useMemo(() => personnelList.map(p => p.name), [personnelList]);

  // Date Picker
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateFieldTarget, setDateFieldTarget] = useState<string>('');
  const [tempDate, setTempDate] = useState(new Date());

  useEffect(() => {
    if (project) {
      setEditProject(JSON.parse(JSON.stringify(project))); // Deep copy
    }
  }, [project, isEditModalVisible]);

  if (!project) {
    return (
      <View style={styles.container}>
        <SafeAreaView />
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 20 }}><Ionicons name="arrow-back" size={24} color="#333" /></TouchableOpacity>
        <Text style={{ textAlign: 'center', marginTop: 20 }}>找不到專案</Text>
      </View>
    );
  }

  // Helper Functions
  const openNativeDatePicker = (field: string) => {
    setDateFieldTarget(field);
    let initialDate = new Date();
    try {
      if (field === 'award' && editProject.awardDate) initialDate = new Date(editProject.awardDate);
      else if (field === 'start' && editProject.startDate) initialDate = new Date(editProject.startDate);
      else if (field === 'actual' && editProject.actualCompletionDate) initialDate = new Date(editProject.actualCompletionDate);
      else if (field === 'inspection' && editProject.inspectionDate) initialDate = new Date(editProject.inspectionDate);
      else if (field === 'reinspection' && editProject.reinspectionDate) initialDate = new Date(editProject.reinspectionDate);
      else if (field === 'extension' && extForm.date) initialDate = new Date(extForm.date);
      else if (field === 'changeDesign' && cdForm.date) initialDate = new Date(cdForm.date);
      else if (field === 'subsequentExpansion' && seForm.date) initialDate = new Date(seForm.date);
    } catch (e: any) { }
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
    const dateStr = date.toISOString().split('T')[0];
    handleDateChange(dateFieldTarget, dateStr);
    if (Platform.OS === 'ios') setShowDatePicker(false);
  };

  const handleDateChange = (field: string, value: string) => {
    if (field === 'extension') setExtForm(prev => ({ ...prev, date: value }));
    else if (field === 'changeDesign') setCdForm(prev => ({ ...prev, date: value }));
    else if (field === 'subsequentExpansion') setSeForm(prev => ({ ...prev, date: value }));
    else if (field === 'award') setEditProject(prev => ({ ...prev, awardDate: value }));
    else if (field === 'start') setEditProject(prev => ({ ...prev, startDate: value }));
    else if (field === 'actual') setEditProject(prev => ({ ...prev, actualCompletionDate: value }));
    else if (field === 'inspection') setEditProject(prev => ({ ...prev, inspectionDate: value }));
    else if (field === 'reinspection') setEditProject(prev => ({ ...prev, reinspectionDate: value }));
  };

  const renderDateInput = (field: any, value: string, placeholder: string, customStyle?: any) => {
    if (Platform.OS === 'web') {
      return React.createElement('input', {
        type: 'date',
        value: value,
        onChange: (e: any) => handleDateChange(field, e.target.value),
        style: {
          padding: 8,
          backgroundColor: customStyle?.backgroundColor || '#fff',
          borderWidth: 1, borderColor: customStyle?.borderColor || '#ddd',
          borderRadius: 6, fontSize: 13, color: '#333', width: '100%',
          height: customStyle?.height || 40,
          boxSizing: 'border-box',
          ...customStyle
        }
      });
    }
    return (
      <TouchableOpacity style={[styles.dateBtn, customStyle]} onPress={() => openNativeDatePicker(field)}>
        <Text style={[styles.dateBtnText, !value && { color: '#999' }]}>{value || placeholder}</Text>
      </TouchableOpacity>
    );
  };

  // Add Item Handlers
  const handleAddExtension = () => {
    if (!extForm.days || !extForm.reason) return;
    const newExt: Extension = {
      id: Math.random().toString(36).substr(2, 9),
      days: parseInt(extForm.days) || 0, date: extForm.date, docNumber: extForm.docNumber, reason: extForm.reason
    };
    setEditProject(prev => ({ ...prev, extensions: [...(prev.extensions || []), newExt] }));
    setExtForm({ days: '', date: '', docNumber: '', reason: '' });
  };
  const handleRemoveExtension = (eid: string) => {
    setEditProject(prev => ({ ...prev, extensions: prev.extensions?.filter(e => e.id !== eid) }));
  };

  const handleAddChangeDesign = () => {
    if (!cdForm.newTotalAmount) return;
    const newCd: ChangeDesign = {
      id: Math.random().toString(36).substr(2, 9),
      count: parseInt(cdForm.count) || (editProject.changeDesigns?.length || 0) + 1,
      date: cdForm.date, docNumber: cdForm.docNumber, reason: cdForm.reason,
      newTotalAmount: parseFloat(cdForm.newTotalAmount) || 0
    };
    setEditProject(prev => ({ ...prev, changeDesigns: [...(prev.changeDesigns || []), newCd] }));
    setCdForm({ count: '', date: '', docNumber: '', reason: '', newTotalAmount: '' });
  };
  const handleRemoveChangeDesign = (cid: string) => {
    setEditProject(prev => ({ ...prev, changeDesigns: prev.changeDesigns?.filter(c => c.id !== cid) }));
  };

  const handleAddSubsequent = () => {
    if (!seForm.amount) return;
    const newSe: SubsequentExpansion = {
      id: Math.random().toString(36).substr(2, 9),
      count: parseInt(seForm.count) || (editProject.subsequentExpansions?.length || 0) + 1,
      date: seForm.date, docNumber: seForm.docNumber, reason: seForm.reason,
      amount: parseFloat(seForm.amount) || 0
    };
    setEditProject(prev => ({ ...prev, subsequentExpansions: [...(prev.subsequentExpansions || []), newSe] }));
    setSeForm({ count: '', date: '', docNumber: '', reason: '', amount: '' });
  };
  const handleRemoveSubsequent = (sid: string) => {
    setEditProject(prev => ({ ...prev, subsequentExpansions: prev.subsequentExpansions?.filter(s => s.id !== sid) }));
  };

  const handleImportSchedule = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'application/vnd.ms-excel', 'text/plain'], copyToCacheDirectory: true });
      if (!res.canceled && res.assets && res.assets[0]) {
        const file = res.assets[0];
        const response = await fetch(file.uri);
        const content = await response.text();
        Papa.parse(content, {
          header: true, skipEmptyLines: true,
          complete: (results) => {
            const parsedData: SchedulePoint[] = [];
            results.data.forEach((row: any) => {
              const keys = Object.keys(row);
              const dateKey = keys.find(k => k.toLowerCase().includes('date'));
              const progKey = keys.find(k => k.toLowerCase().includes('progress'));
              if (dateKey && progKey) parsedData.push({ date: row[dateKey], progress: parseFloat(row[progKey]) || 0 });
            });
            parsedData.sort((a, b) => a.date.localeCompare(b.date));
            if (parsedData.length > 0) {
              setEditProject(prev => ({ ...prev, scheduleData: parsedData }));
              Alert.alert('成功', `已匯入 ${parsedData.length} 筆進度資料`);
            }
          },
          error: (err: any) => Alert.alert('匯入失敗', err.message)
        });
      }
    } catch (err: any) { Alert.alert('錯誤', '匯入失敗'); }
  };

  // Logic
  const currentTotalAmount = useMemo(() => {
    let total = parseFloat(editProject.contractAmount?.toString() || '0');
    if (editProject.changeDesigns && editProject.changeDesigns.length > 0) {
      total = editProject.changeDesigns[editProject.changeDesigns.length - 1].newTotalAmount;
    }
    if (editProject.subsequentExpansions) {
      total += editProject.subsequentExpansions.reduce((sum, s) => sum + (s.amount || 0), 0);
    }
    return total;
  }, [editProject.contractAmount, editProject.changeDesigns, editProject.subsequentExpansions]);

  const completionDate = useMemo(() => {
    if (!editProject.startDate || !editProject.contractDuration) return '請輸入';
    const start = new Date(editProject.startDate);
    if (isNaN(start.getTime())) return '';
    const extDays = editProject.extensions?.reduce((s, e) => s + e.days, 0) || 0;
    const total = parseInt(editProject.contractDuration.toString()) + extDays - 1;
    const end = new Date(start);
    end.setDate(start.getDate() + total);
    return end.toISOString().split('T')[0];
  }, [editProject.startDate, editProject.contractDuration, editProject.extensions]);

  const handleSave = async () => {
    if (!id) return;
    await updateProject(id as string, {
      ...editProject,
      currentContractAmount: currentTotalAmount
    });
    setEditModalVisible(false);
    Alert.alert('已儲存', '專案資料已更新');
  };

  const handleDelete = () => {
    Alert.alert('刪除專案', '確定要刪除此專案嗎？此動作無法復原。', [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除', style: 'destructive', onPress: async () => {
          if (id) {
            await deleteProject(id as string);
            router.replace('/projects');
          }
        }
      }
    ]);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: '專案詳情', headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor={THEME.headerBg} />

      {/* Header */}
      <SafeAreaView style={styles.headerSafeArea}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{project.name}</Text>
          <TouchableOpacity onPress={() => setEditModalVisible(true)}>
            <Ionicons name="create-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView style={styles.content}>
        {/* Info Cards */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>基本資訊</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{EXECUTION_STATUS_MAP[project.executionStatus || 'not_started']}</Text>
            </View>
          </View>
          <View style={styles.infoRow}><Ionicons name="location-outline" size={16} color="#666" /><Text style={styles.infoText}>{project.address}</Text></View>
          <View style={styles.infoRow}><Ionicons name="person-outline" size={16} color="#666" /><Text style={styles.infoText}>主任: {project.manager}</Text></View>
          <View style={styles.infoRow}><Ionicons name="calendar-outline" size={16} color="#666" /><Text style={styles.infoText}>開工: {project.startDate}</Text></View>
          <View style={styles.infoRow}><Ionicons name="time-outline" size={16} color="#666" /><Text style={styles.infoText}>工期: {project.contractDuration} 天</Text></View>
          <View style={styles.infoRow}><Ionicons name="cash-outline" size={16} color="#666" /><Text style={styles.infoText}>總價: ${project.currentContractAmount?.toLocaleString()}</Text></View>
        </View>

        {/* Extensions List */}
        {project.extensions && project.extensions.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>展延記錄</Text>
            {project.extensions.map((ext, i) => (
              <View key={i} style={styles.logItem}>
                <Text>{ext.date} / {ext.docNumber}</Text>
                <Text>理由: {ext.reason}</Text>
                <Text style={{ fontWeight: 'bold' }}>+ {ext.days} 天</Text>
              </View>
            ))}
          </View>
        )}

        {/* Changes & Expansions */}
        {(project.changeDesigns?.length || 0) > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>變更設計</Text>
            {project.changeDesigns?.map((cd, i) => (
              <View key={i} style={styles.logItem}>
                <Text>第{cd.count}次 / {cd.date}</Text>
                <Text>金額: ${cd.newTotalAmount.toLocaleString()}</Text>
                <Text style={{ color: '#666' }}>{cd.reason}</Text>
              </View>
            ))}
          </View>
        )}

        {(project.subsequentExpansions?.length || 0) > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>後續擴充</Text>
            {project.subsequentExpansions?.map((se, i) => (
              <View key={i} style={styles.logItem}>
                <Text>擴充{se.count} / {se.date}</Text>
                <Text>追加: ${se.amount.toLocaleString()}</Text>
                <Text style={{ color: '#666' }}>{se.reason}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={[styles.cardTitle, { margin: 15 }]}>施工日誌 ({projectLogs.length})</Text>
        {projectLogs.map(log => (
          <TouchableOpacity key={log.id} style={styles.logCard} onPress={() => router.push('/logs')}>
            <Text style={{ fontWeight: 'bold' }}>{log.date}</Text>
            <Text numberOfLines={2} style={{ color: '#444' }}>{log.content}</Text>
            <Text style={{ fontSize: 12, color: '#999', marginTop: 5 }}>進度: {log.todayProgress || '-'}%</Text>
          </TouchableOpacity>
        ))}

        <View style={{ height: 50 }} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={isEditModalVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditModalVisible(false)}><Ionicons name="close" size={28} color="#333" /></TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>編輯專案</Text>
            <TouchableOpacity onPress={handleSave}><Text style={{ color: THEME.primary, fontWeight: 'bold', fontSize: 16 }}>儲存</Text></TouchableOpacity>
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView style={{ flex: 1, padding: 20 }}>

              <Text style={styles.label}>專案名稱</Text>
              <TextInput style={styles.input} value={editProject.name} onChangeText={t => setEditProject({ ...editProject, name: t })} />

              <View style={[styles.row, { zIndex: 2000 }]}>
                <View style={{ flex: 1, marginRight: 10, zIndex: 2000 }}>
                  <Text style={styles.label}>工地主任</Text>
                  <TouchableOpacity style={styles.dropdownBtn} onPress={() => setShowManagerPicker(!showManagerPicker)}>
                    <Text>{editProject.manager}</Text>
                  </TouchableOpacity>
                  {showManagerPicker && (
                    <View style={styles.dropdownList}>
                      {managers.map(m => (
                        <TouchableOpacity key={m} style={styles.dropdownItem} onPress={() => { setEditProject({ ...editProject, manager: m }); setShowManagerPicker(false); }}>
                          <Text>{m}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, zIndex: 2000 }}>
                  <Text style={styles.label}>狀態</Text>
                  <TouchableOpacity style={styles.dropdownBtn} onPress={() => setShowStatusPicker(!showStatusPicker)}>
                    <Text>{EXECUTION_STATUS_MAP[editProject.executionStatus || 'not_started']}</Text>
                  </TouchableOpacity>
                  {showStatusPicker && (
                    <View style={styles.dropdownList}>
                      {EXECUTION_STATUS_OPTIONS.map(s => (
                        <TouchableOpacity key={s} style={styles.dropdownItem} onPress={() => { setEditProject({ ...editProject, executionStatus: s as any }); setShowStatusPicker(false); }}>
                          <Text>{EXECUTION_STATUS_MAP[s]}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </View>

              <Text style={styles.groupHeader}>時程</Text>
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 5 }}><Text style={styles.label}>開工</Text>{renderDateInput('start', editProject.startDate || '', '日期')}</View>
                <View style={{ flex: 1 }}><Text style={styles.label}>預定竣工: {completionDate}</Text></View>
              </View>

              <View style={styles.rowCenter}>
                <Text style={styles.label}>進度表 (CSV)</Text>
                <TouchableOpacity onPress={handleImportSchedule} style={{ marginLeft: 10 }}><Text style={{ color: THEME.primary }}>重新匯入</Text></TouchableOpacity>
              </View>

              {/* Financials */}
              <Text style={styles.groupHeader}>金額管理</Text>
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 5 }}>
                  <Text style={styles.label}>契約原金</Text>
                  <TextInput style={styles.input} keyboardType="numeric" value={editProject.contractAmount?.toString()} onChangeText={t => setEditProject({ ...editProject, contractAmount: parseFloat(t) || 0 })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>目前總價: ${currentTotalAmount.toLocaleString()}</Text>
                </View>
              </View>

              {/* Change Designs */}
              <Text style={styles.sectionTitle}>變更設計</Text>
              {editProject.changeDesigns?.map(cd => (
                <View key={cd.id} style={styles.editItem}>
                  <Text>#{cd.count} {cd.date} ${cd.newTotalAmount}</Text>
                  <Text style={{ color: '#666' }}>{cd.reason}</Text>
                  <TouchableOpacity onPress={() => handleRemoveChangeDesign(cd.id)} style={styles.delItem}><Ionicons name="trash" size={16} color="red" /></TouchableOpacity>
                </View>
              ))}
              <View style={styles.addBox}>
                <View style={styles.row}>
                  <TextInput style={[styles.miniInput, { width: 50 }]} placeholder="#" value={cdForm.count} onChangeText={t => setCdForm({ ...cdForm, count: t })} />
                  <View style={{ flex: 1, marginLeft: 5 }}>{renderDateInput('changeDesign', cdForm.date, '日期')}</View>
                </View>
                <TextInput style={styles.miniInput} placeholder="新總價" keyboardType="numeric" value={cdForm.newTotalAmount} onChangeText={t => setCdForm({ ...cdForm, newTotalAmount: t })} />
                <TextInput style={[styles.miniInput, { minHeight: 50 }]} multiline placeholder="變更事由" value={cdForm.reason} onChangeText={t => setCdForm({ ...cdForm, reason: t })} />
                <TouchableOpacity onPress={handleAddChangeDesign} style={styles.addBtn}><Text style={{ color: '#fff' }}>加入變更</Text></TouchableOpacity>
              </View>

              {/* Subsequent Expansions */}
              <Text style={styles.sectionTitle}>後續擴充</Text>
              {editProject.subsequentExpansions?.map(se => (
                <View key={se.id} style={styles.editItem}>
                  <Text>#{se.count} {se.date} +${se.amount}</Text>
                  <Text style={{ color: '#666' }}>{se.reason}</Text>
                  <TouchableOpacity onPress={() => handleRemoveSubsequent(se.id)} style={styles.delItem}><Ionicons name="trash" size={16} color="red" /></TouchableOpacity>
                </View>
              ))}
              <View style={styles.addBox}>
                <View style={styles.row}>
                  <TextInput style={[styles.miniInput, { width: 50 }]} placeholder="#" value={seForm.count} onChangeText={t => setSeForm({ ...seForm, count: t })} />
                  <View style={{ flex: 1, marginLeft: 5 }}>{renderDateInput('subsequentExpansion', seForm.date, '核准日期')}</View>
                </View>
                <TextInput style={styles.miniInput} placeholder="擴充金額 (追加)" keyboardType="numeric" value={seForm.amount} onChangeText={t => setSeForm({ ...seForm, amount: t })} />
                <TextInput style={[styles.miniInput, { minHeight: 50 }]} multiline placeholder="擴充事由" value={seForm.reason} onChangeText={t => setSeForm({ ...seForm, reason: t })} />
                <TouchableOpacity onPress={handleAddSubsequent} style={styles.addBtn}><Text style={{ color: '#fff' }}>加入擴充</Text></TouchableOpacity>
              </View>

              <View style={{ height: 50 }} />
              <TouchableOpacity onPress={handleDelete} style={{ padding: 15, alignItems: 'center', borderTopWidth: 1, borderColor: '#eee' }}>
                <Text style={{ color: 'red', fontWeight: 'bold' }}>刪除此專案</Text>
              </TouchableOpacity>
              <View style={{ height: 50 }} />
            </ScrollView>
          </KeyboardAvoidingView>

          {/* Date Picker Modal IOS */}
          {showDatePicker && Platform.OS === 'ios' && (
            <Modal transparent animationType="fade">
              <View style={styles.iosDatePickerContainer}>
                <View style={styles.iosDatePickerContent}>
                  <DateTimePicker value={tempDate} mode="date" display="spinner" onChange={onNativeDateChange} style={{ height: 150 }} />
                  <TouchableOpacity style={styles.iosConfirmBtn} onPress={() => confirmNativeDate(tempDate)}><Text style={{ color: '#fff' }}>確認</Text></TouchableOpacity>
                </View>
              </View>
            </Modal>
          )}
          {showDatePicker && Platform.OS === 'android' && (
            <DateTimePicker value={tempDate} mode="date" display="default" onChange={onNativeDateChange} />
          )}

        </SafeAreaView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  headerSafeArea: { backgroundColor: THEME.headerBg, paddingTop: Platform.OS === 'android' ? 25 : 0 },
  headerContent: { height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, justifyContent: 'space-between' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  backBtn: { padding: 5 },
  content: { flex: 1 },
  card: { backgroundColor: '#fff', margin: 15, padding: 15, borderRadius: 12, marginBottom: 5 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, color: '#002147' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  statusBadge: { backgroundColor: '#E3F2FD', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  statusText: { color: '#002147', fontSize: 12, fontWeight: 'bold' },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  infoText: { marginLeft: 8, color: '#333' },
  logItem: { borderLeftWidth: 3, borderLeftColor: '#eee', paddingLeft: 10, marginBottom: 10 },
  logCard: { backgroundColor: '#fff', marginHorizontal: 15, marginBottom: 10, padding: 15, borderRadius: 8, elevation: 1 },
  // Modal
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center' },
  label: { fontWeight: 'bold', color: '#666', marginTop: 15, marginBottom: 5 },
  input: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 },
  row: { flexDirection: 'row' },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  dropdownBtn: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 },
  dropdownList: { position: 'absolute', top: 45, left: 0, right: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, elevation: 5 },
  dropdownItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  groupHeader: { fontSize: 13, color: '#999', backgroundColor: '#f0f0f0', padding: 5, marginTop: 20, fontWeight: 'bold' },
  sectionTitle: { marginTop: 20, fontSize: 14, fontWeight: 'bold', color: '#002147' },
  editItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9f9f9', padding: 8, borderRadius: 6, marginBottom: 5 },
  delItem: { padding: 5 },
  addBox: { backgroundColor: '#f5f5f5', padding: 10, borderRadius: 8, marginTop: 5 },
  miniInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 4, padding: 6, marginBottom: 5, fontSize: 13, textAlignVertical: 'top' },
  addBtn: { backgroundColor: '#555', padding: 8, borderRadius: 4, alignItems: 'center' },
  dateBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 10 },
  dateBtnText: { color: '#333' },
  iosDatePickerContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  iosDatePickerContent: { backgroundColor: '#fff', padding: 20 },
  iosConfirmBtn: { backgroundColor: THEME.primary, padding: 10, alignItems: 'center', borderRadius: 8, marginTop: 10 }
});