import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Platform, StatusBar, Modal, TextInput, ScrollView, Alert, KeyboardAvoidingView } from 'react-native';
import React, { useState, useMemo } from 'react';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import Papa from 'papaparse';
import { useUser } from '../../context/UserContext';
import { useProjects, Project, Extension, ChangeDesign, SubsequentExpansion, SchedulePoint } from '../../context/ProjectContext';
import { usePersonnel } from '../../context/PersonnelContext';

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
const COUNT_OPTIONS = ['1', '2', '3', '4', '5'];
const EXPANSION_COUNT_OPTIONS = ['1', '2'];

const formatCurrency = (val: number | string | undefined) => {
  if (!val) return '';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '';
  return num.toLocaleString();
};

const parseCurrency = (val: string) => {
  return parseFloat(val.replace(/,/g, '')) || 0;
};

export default function ProjectsScreen() {
  const router = useRouter();
  const { user, logout } = useUser();
  const { projects, addProject, deleteProject } = useProjects();
  const { personnelList } = usePersonnel();

  // States
  const [menuVisible, setMenuVisible] = useState(false);
  const [searchText, setSearchText] = useState('');

  // Add Project Modal States
  const [isAddModalVisible, setAddModalVisible] = useState(false);

  // Project Form State
  const [newProject, setNewProject] = useState<Partial<Project>>({
    name: '', address: '', manager: '',
    status: 'planning',
    executionStatus: 'not_started',
    startDate: '', contractDuration: 0, progress: 0, extensions: [],
    awardDate: '', actualCompletionDate: '', inspectionDate: '', reinspectionDate: '', inspectionPassedDate: '',
    contractAmount: 0, changeDesigns: [], subsequentExpansions: [], scheduleData: []
  });

  // Extension Inputs
  const [extForm, setExtForm] = useState({ days: '', date: '', docNumber: '', reason: '' });

  // Change Design Inputs
  const [cdForm, setCdForm] = useState({ count: '1', date: '', docNumber: '', reason: '', newTotalAmount: '' });

  // Subsequent Expansion Inputs
  const [seForm, setSeForm] = useState({ count: '1', date: '', docNumber: '', reason: '', amount: '' });

  // CSV Import State
  const [csvFileName, setCsvFileName] = useState('');
  const [csvPreview, setCsvPreview] = useState<SchedulePoint[]>([]);
  const [csvError, setCsvError] = useState('');
  const [csvSuccess, setCsvSuccess] = useState('');

  // Manager Dropdown
  const [showManagerPicker, setShowManagerPicker] = useState(false);
  const managers = useMemo(() => personnelList.map(p => p.name), [personnelList]);

  // Execution Status Dropdown
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  // Count Pickers
  const [showCdCountPicker, setShowCdCountPicker] = useState(false);
  const [showSeCountPicker, setShowSeCountPicker] = useState(false);

  // Date Picker Logic
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateFieldTarget, setDateFieldTarget] = useState<'award' | 'start' | 'actual' | 'inspection' | 'reinspection' | 'passed' | 'extension' | 'changeDesign' | 'subsequentExpansion'>('start');
  const [tempDate, setTempDate] = useState(new Date());

  // Helper for Native Picker
  const openNativeDatePicker = (field: typeof dateFieldTarget) => {
    setDateFieldTarget(field);
    let initialDate = new Date();
    try {
      if (field === 'award' && newProject.awardDate) initialDate = new Date(newProject.awardDate);
      else if (field === 'start' && newProject.startDate) initialDate = new Date(newProject.startDate);
      else if (field === 'actual' && newProject.actualCompletionDate) initialDate = new Date(newProject.actualCompletionDate);
      else if (field === 'inspection' && newProject.inspectionDate) initialDate = new Date(newProject.inspectionDate);
      else if (field === 'reinspection' && newProject.reinspectionDate) initialDate = new Date(newProject.reinspectionDate);
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

  // Unified Date Change Handler
  const handleDateChange = (field: string, value: string) => {
    if (field === 'extension') setExtForm(prev => ({ ...prev, date: value }));
    else if (field === 'changeDesign') setCdForm(prev => ({ ...prev, date: value }));
    else if (field === 'subsequentExpansion') setSeForm(prev => ({ ...prev, date: value }));
    else if (field === 'award') setNewProject(prev => ({ ...prev, awardDate: value }));
    else if (field === 'start') setNewProject(prev => ({ ...prev, startDate: value }));
    else if (field === 'actual') setNewProject(prev => ({ ...prev, actualCompletionDate: value }));
    else if (field === 'inspection') setNewProject(prev => ({ ...prev, inspectionDate: value }));
    else if (field === 'reinspection') setNewProject(prev => ({ ...prev, reinspectionDate: value }));
  };

  // Date Input Component
  const renderDateInput = (field: any, value: string, placeholder: string, customStyle?: any) => {
    if (Platform.OS === 'web') {
      return React.createElement('input', {
        type: 'date',
        value: value,
        onChange: (e: any) => handleDateChange(field, e.target.value),
        style: {
          padding: 12,
          backgroundColor: customStyle?.backgroundColor || '#F9F9F9',
          borderWidth: 1,
          borderColor: customStyle?.borderColor || '#ddd',
          borderStyle: 'solid',
          borderRadius: 8,
          fontSize: 16,
          color: '#333',
          width: '100%',
          height: customStyle?.height || 50,
          boxSizing: 'border-box',
          ...customStyle
        }
      });
    }
    return (
      <TouchableOpacity
        style={[styles.dateBtn, customStyle]}
        onPress={() => openNativeDatePicker(field)}
      >
        <Text style={[styles.dateBtnText, !value && { color: '#999' }]}>{value || placeholder}</Text>
        <Ionicons name="calendar-outline" size={18} color="#666" />
      </TouchableOpacity>
    );
  };

  // Calc Planned Progress
  const getPlannedProgress = (project: Project) => {
    if (!project.scheduleData || project.scheduleData.length === 0) return 0;
    const today = new Date().toISOString().split('T')[0];
    let planned = 0;
    for (let p of project.scheduleData) {
      if (p.date <= today) {
        planned = p.progress;
      } else {
        break;
      }
    }
    return planned;
  };

  // Handlers
  const handleLogout = () => {
    setMenuVisible(false);
    logout();
    router.replace('/');
  };

  const handleDeleteParams = (id: string, name: string) => {
    if (Platform.OS === 'web') {
      const confirm = window.confirm(`確定要刪除「${name}」嗎？此動作無法復原。`);
      if (confirm) {
        // alert('開始執行刪除...'); 
        console.log('正在刪除專案 ID:', id);
        deleteProject(id).then(() => {
          window.alert('專案已成功移除');
        }).catch(e => console.error(e));
      }
    } else {
      Alert.alert('刪除專案', `確定要刪除「${name}」嗎？此動作無法復原。`, [
        { text: '取消', style: 'cancel' },
        {
          text: '確認刪除', style: 'destructive', onPress: async () => {
            // alert('開始執行刪除...');
            console.log('正在刪除專案 ID:', id);
            await deleteProject(id);
            Alert.alert('已刪除', '專案已成功移除');
          }
        }
      ]);
    }
  };

  // Extension Handlers
  const handleAddExtension = () => {
    if (!extForm.days || !extForm.reason || !extForm.date) { Alert.alert('提示', '請填寫天數、公文日期與理由'); return; }
    const newExt: Extension = {
      id: Math.random().toString(36).substr(2, 9),
      days: parseInt(extForm.days) || 0,
      date: extForm.date,
      docNumber: extForm.docNumber,
      reason: extForm.reason
    };
    setNewProject(prev => ({ ...prev, extensions: [...(prev.extensions || []), newExt] }));
    setExtForm({ days: '', date: '', docNumber: '', reason: '' });
  };

  const handleRemoveExtension = (id: string) => {
    setNewProject(prev => ({ ...prev, extensions: prev.extensions?.filter(e => e.id !== id) }));
  };

  // Change Design Handlers
  const handleAddChangeDesign = () => {
    if (!cdForm.date || !cdForm.newTotalAmount || !cdForm.reason) { Alert.alert('提示', '請填寫日期、變更後金額與事由'); return; }
    const newCd: ChangeDesign = {
      id: Math.random().toString(36).substr(2, 9),
      count: parseInt(cdForm.count) || (newProject.changeDesigns?.length || 0) + 1,
      date: cdForm.date,
      docNumber: cdForm.docNumber,
      reason: cdForm.reason,
      newTotalAmount: parseCurrency(cdForm.newTotalAmount),
      type: 'set'
    };
    setNewProject(prev => ({ ...prev, changeDesigns: [...(prev.changeDesigns || []), newCd] }));
    setCdForm({ count: '1', date: '', docNumber: '', reason: '', newTotalAmount: '' });
  };

  const handleRemoveChangeDesign = (id: string) => {
    setNewProject(prev => ({ ...prev, changeDesigns: prev.changeDesigns?.filter(c => c.id !== id) }));
  };

  // Subsequent Expansion Handlers
  const handleAddSubsequent = () => {
    if (!seForm.date || !seForm.amount || !seForm.reason) { Alert.alert('提示', '請填寫日期、金額與事由'); return; }
    const newSe: SubsequentExpansion = {
      id: Math.random().toString(36).substr(2, 9),
      count: parseInt(seForm.count) || (newProject.subsequentExpansions?.length || 0) + 1,
      date: seForm.date,
      docNumber: seForm.docNumber,
      reason: seForm.reason,
      amount: parseCurrency(seForm.amount)
    };
    setNewProject(prev => ({ ...prev, subsequentExpansions: [...(prev.subsequentExpansions || []), newSe] }));
    setSeForm({ count: '1', date: '', docNumber: '', reason: '', amount: '' });
  };

  const handleRemoveSubsequent = (id: string) => {
    setNewProject(prev => ({ ...prev, subsequentExpansions: prev.subsequentExpansions?.filter(s => s.id !== id) }));
  };

  // Import
  const handleImportSchedule = async () => {
    setCsvError(''); setCsvSuccess(''); setCsvPreview([]); setCsvFileName('');
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'application/vnd.ms-excel', 'text/plain'], copyToCacheDirectory: true });
      if (!res.canceled && res.assets && res.assets[0]) {
        const file = res.assets[0];
        setCsvFileName(file.name);

        const response = await fetch(file.uri);
        const content = await response.text();
        Papa.parse(content, {
          header: true, skipEmptyLines: true,
          complete: (results) => {
            if (results.meta.fields) {
              const fields = results.meta.fields.map(f => f.toLowerCase());
              const hasDate = fields.some(f => f.includes('date') || f.includes('日期'));
              const hasProg = fields.some(f => f.includes('progress') || f.includes('進度'));
              if (!hasDate || !hasProg) {
                setCsvError('格式錯誤：CSV 標題需包含 "Date/日期" 與 "Progress/進度"');
                return;
              }
            }

            const parsedData: SchedulePoint[] = [];
            results.data.forEach((row: any) => {
              const keys = Object.keys(row);
              const dateKey = keys.find(k => k.toLowerCase().includes('date') || k.includes('日期'));
              const progKey = keys.find(k => k.toLowerCase().includes('progress') || k.includes('進度'));
              if (dateKey && progKey && row[dateKey] && row[progKey]) {
                parsedData.push({ date: row[dateKey], progress: parseFloat(row[progKey]) || 0 });
              }
            });
            parsedData.sort((a, b) => a.date.localeCompare(b.date));

            if (parsedData.length > 0) {
              setNewProject(prev => ({ ...prev, scheduleData: parsedData }));
              setCsvSuccess(`CSV 解析成功，共讀取 ${parsedData.length} 筆資料`);
              setCsvPreview(parsedData.slice(0, 3));
            } else {
              setCsvError('錯誤：無法解析出有效資料，請檢查 CSV 內容');
            }
          },
          error: (err: any) => setCsvError(`解析失敗: ${err.message}`)
        });
      }
    } catch (err: any) { setCsvError('匯入失敗'); }
  };

  // Calculations
  const completionDate = useMemo(() => {
    if (!newProject.startDate || !newProject.contractDuration) return '請輸入開工日與工期';
    const start = new Date(newProject.startDate);
    if (isNaN(start.getTime())) return '日期格式錯誤';
    const totalExtensions = newProject.extensions?.reduce((sum, ext) => sum + ext.days, 0) || 0;
    const totalDays = (parseInt(newProject.contractDuration.toString()) || 0) + totalExtensions - 1;
    const end = new Date(start);
    end.setDate(start.getDate() + totalDays);
    return end.toISOString().split('T')[0];
  }, [newProject.startDate, newProject.contractDuration, newProject.extensions]);

  const currentTotalAmount = useMemo(() => {
    let total = parseFloat(newProject.contractAmount?.toString() || '0');
    // Apply Change Designs (Last one sets the base)
    if (newProject.changeDesigns && newProject.changeDesigns.length > 0) {
      total = newProject.changeDesigns[newProject.changeDesigns.length - 1].newTotalAmount;
    }
    // Add Expansions
    if (newProject.subsequentExpansions) {
      total += newProject.subsequentExpansions.reduce((sum, s) => sum + (s.amount || 0), 0);
    }
    return total;
  }, [newProject.contractAmount, newProject.changeDesigns, newProject.subsequentExpansions]);

  // Submit
  const handleSubmitProject = () => {
    if (!newProject.name || !newProject.startDate) { Alert.alert('錯誤', '專案名稱與開工日為必填'); return; }
    addProject({
      ...newProject,
      contractAmount: parseFloat(newProject.contractAmount?.toString() || '0'),
      contractDuration: parseInt(newProject.contractDuration?.toString() || '0'),
      extensions: newProject.extensions || [],
      changeDesigns: newProject.changeDesigns || [],
      subsequentExpansions: newProject.subsequentExpansions || [],
      scheduleData: newProject.scheduleData || [],
      currentActualProgress: newProject.currentActualProgress || 0,
      currentContractAmount: currentTotalAmount
    } as any);
    setAddModalVisible(false);
    setNewProject({ name: '', address: '', manager: '', executionStatus: 'not_started', status: 'planning', startDate: '', contractDuration: 0, progress: 0, extensions: [], contractAmount: 0, changeDesigns: [], subsequentExpansions: [], scheduleData: [] });
    setExtForm({ days: '', date: '', docNumber: '', reason: '' });
    setCdForm({ count: '1', date: '', docNumber: '', reason: '', newTotalAmount: '' });
    setSeForm({ count: '1', date: '', docNumber: '', reason: '', amount: '' });
    Alert.alert('成功', '專案已新增');
  };

  // Filter
  const filteredProjects = useMemo(() => {
    if (!searchText) return projects;
    return projects.filter(p => p.name.includes(searchText) || p.address.includes(searchText));
  }, [projects, searchText]);

  const MenuItem = ({ icon, label, onPress, isLogout = false, isActive = false }: any) => (
    <TouchableOpacity style={[styles.menuItem, isActive && styles.menuItemActive]} onPress={onPress}>
      <Ionicons name={icon} size={24} color={isLogout ? '#FF6B6B' : (isActive ? THEME.primary : '#fff')} />
      <Text style={[styles.menuItemText, isLogout && { color: '#FF6B6B' }, isActive && { color: THEME.primary }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor={THEME.headerBg} />

      <SafeAreaView style={styles.headerSafeArea}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.menuBtn}><Ionicons name="menu" size={28} color="#fff" /></TouchableOpacity>
          <Text style={styles.headerTitle}>專案列表</Text>
          <View style={{ width: 28 }} />
        </View>
      </SafeAreaView>

      <View style={styles.contentContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput style={styles.searchInput} placeholder="搜尋專案名稱..." value={searchText} onChangeText={setSearchText} />
        </View>

        <FlatList
          data={filteredProjects}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 15 }}
          renderItem={({ item }) => {
            const actual = item.currentActualProgress || 0;
            const planned = getPlannedProgress(item);
            const diff = actual - planned;
            const isBehind = diff < 0;

            return (
              <View style={styles.card}>
                <TouchableOpacity onPress={() => router.push(`/projects/${item.id}`)}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.statusTag, { backgroundColor: '#E3F2FD' }]}>
                      <Text style={{ color: '#002147', fontSize: 12, fontWeight: 'bold' }}>{EXECUTION_STATUS_MAP[item.executionStatus || 'not_started']}</Text>
                    </View>
                    {user?.role === 'admin' && (
                      <TouchableOpacity onPress={() => handleDeleteParams(item.id, item.name)} style={{ padding: 5 }}>
                        <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.projectTitle}>{item.name}</Text>
                  <Text style={styles.projectInfo}>📍 {item.address}</Text>
                  <Text style={styles.projectInfo}>💰 總價：${formatCurrency(item.currentContractAmount || item.contractAmount)}</Text>

                  <View style={styles.progressSection}>
                    <View style={styles.progressLabels}>
                      <Text style={styles.progressLabelText}>實際: <Text style={{ fontWeight: 'bold' }}>{actual}%</Text></Text>
                      <Text style={styles.progressLabelText}>預定: <Text style={{ fontWeight: 'bold' }}>{planned}%</Text></Text>
                      <Text style={[styles.progressStatus, { color: isBehind ? THEME.danger : THEME.success }]}>{isBehind ? `🔴 落後 ${Math.abs(diff).toFixed(1)}%` : `🟢 正常 +${diff.toFixed(1)}%`}</Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressBar, { width: `${Math.min(actual, 100)}%` }]} />
                      <View style={[styles.plannedMarker, { left: `${Math.min(planned, 100)}%` }]} />
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            );
          }}
          ListEmptyComponent={<View style={styles.emptyState}><Ionicons name="folder-open-outline" size={64} color="#ccc" /><Text style={styles.emptyText}>沒有符合的專案</Text></View>}
        />

        {user?.role === 'admin' && (
          <TouchableOpacity style={styles.fab} onPress={() => setAddModalVisible(true)}>
            <Ionicons name="add" size={30} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Add Project Modal */}
      <Modal visible={isAddModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>新增專案</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}><Ionicons name="close" size={26} color="#333" /></TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.groupHeader}>基本資料</Text>
              <Text style={styles.label}>專案名稱 *</Text>
              <TextInput style={styles.input} value={newProject.name} onChangeText={t => setNewProject({ ...newProject, name: t })} placeholder="輸入專案名稱" />
              <Text style={styles.label}>地址</Text>
              <TextInput style={styles.input} value={newProject.address} onChangeText={t => setNewProject({ ...newProject, address: t })} placeholder="輸入專案地址" />

              <View style={[styles.row, { zIndex: 2000 }]}>
                <View style={{ flex: 1, marginRight: 10, zIndex: 2000 }}>
                  <Text style={styles.label}>工地主任</Text>
                  <TouchableOpacity style={styles.dropdownBtn} onPress={() => setShowManagerPicker(!showManagerPicker)}>
                    <Text style={styles.dropdownBtnText}>{newProject.manager || '請選擇'}</Text>
                    <Ionicons name="chevron-down" size={20} color="#666" />
                  </TouchableOpacity>
                  {showManagerPicker && (
                    <View style={styles.dropdownList}>
                      {managers.map((mgr, idx) => (
                        <TouchableOpacity key={idx} style={styles.dropdownItem} onPress={() => { setNewProject({ ...newProject, manager: mgr }); setShowManagerPicker(false); }}>
                          <Text style={styles.dropdownItemText}>{mgr}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, zIndex: 2000 }}>
                  <Text style={styles.label}>執行狀態</Text>
                  <TouchableOpacity style={styles.dropdownBtn} onPress={() => setShowStatusPicker(!showStatusPicker)}>
                    <Text style={styles.dropdownBtnText}>{EXECUTION_STATUS_MAP[newProject.executionStatus || 'not_started']}</Text>
                    <Ionicons name="chevron-down" size={20} color="#666" />
                  </TouchableOpacity>
                  {showStatusPicker && (
                    <View style={styles.dropdownList}>
                      {EXECUTION_STATUS_OPTIONS.map((status) => (
                        <TouchableOpacity key={status} style={styles.dropdownItem} onPress={() => { setNewProject({ ...newProject, executionStatus: status as any }); setShowStatusPicker(false); }}>
                          <Text style={styles.dropdownItemText}>{EXECUTION_STATUS_MAP[status]}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </View>

              <Text style={styles.groupHeader}>時程管理</Text>
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.label}>決標日期</Text>
                  {renderDateInput('award', newProject.awardDate || '', '選擇日期')}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>開工日期 *</Text>
                  {renderDateInput('start', newProject.startDate || '', '選擇日期')}
                </View>
              </View>
              <Text style={styles.label}>契約工期 (天) *</Text>
              <TextInput
                style={styles.input}
                value={newProject.contractDuration?.toString() || ''}
                onChangeText={t => setNewProject({ ...newProject, contractDuration: parseInt(t) || 0 })}
                keyboardType="numeric"
                placeholder="例如: 600"
                editable={true}
              />

              <View style={{ marginTop: 15 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontWeight: 'bold', color: '#333' }}>預定進度表 (CSV)</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {csvFileName ? <Text style={{ fontSize: 12, color: '#666', marginRight: 10 }}>{csvFileName}</Text> : null}
                    <TouchableOpacity style={styles.importBtn} onPress={handleImportSchedule}>
                      <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
                      <Text style={{ color: '#fff', marginLeft: 5 }}>匯入</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {/* Feedback Area */}
                {csvError ? <Text style={{ color: THEME.danger, fontSize: 12, marginTop: 5, backgroundColor: '#FFEBEE', padding: 5 }}>⚠️ {csvError}</Text> : null}
                {csvSuccess ? <Text style={{ color: THEME.success, fontSize: 12, marginTop: 5, backgroundColor: '#E8F5E9', padding: 5 }}>✅ {csvSuccess}</Text> : null}

                {/* Preview */}
                {csvPreview.length > 0 && (
                  <View style={{ marginTop: 10, backgroundColor: '#f9f9f9', padding: 10, borderRadius: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#666', marginBottom: 5 }}>資料預覽 (前3筆):</Text>
                    {csvPreview.map((p, i) => (
                      <Text key={i} style={{ fontSize: 12, color: '#333' }}>{p.date}: {p.progress}%</Text>
                    ))}
                  </View>
                )}
              </View>

              {/* Extensions */}
              <View style={styles.extensionSection}>
                <Text style={styles.sectionTitle}>展延工期明細</Text>
                {newProject.extensions?.map((ext, idx) => (
                  <View key={ext.id} style={styles.extItem}>
                    <Text style={styles.extText}>{idx + 1}. {ext.date} (文號：{ext.docNumber}) - {ext.days}天</Text>
                    <Text style={styles.extReason}>{ext.reason}</Text>
                    <TouchableOpacity onPress={() => handleRemoveExtension(ext.id)} style={styles.removeExt}>
                      <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={styles.addExtBox}>
                  <View style={styles.row}>
                    <TextInput style={[styles.smallInput, { flex: 1 }]} placeholder="天數" keyboardType="number-pad" value={extForm.days} onChangeText={t => setExtForm({ ...extForm, days: t })} />
                    <View style={{ flex: 2, marginLeft: 5 }}>
                      {renderDateInput('extension', extForm.date || '', '公文日期', { height: 35, padding: 8, fontSize: 13, backgroundColor: '#fff', borderRadius: 6 })}
                    </View>
                  </View>
                  <View style={[styles.row, { marginTop: 5 }]}>
                    <TextInput style={[styles.smallInput, { flex: 1 }]} placeholder="文號" value={extForm.docNumber} onChangeText={t => setExtForm({ ...extForm, docNumber: t })} />
                    <TextInput style={[styles.smallMultiline, { flex: 2, marginLeft: 5 }]} placeholder="展延理由" multiline value={extForm.reason} onChangeText={t => setExtForm({ ...extForm, reason: t })} />
                  </View>
                  <TouchableOpacity style={styles.addExtBtn} onPress={handleAddExtension}>
                    <Text style={{ color: '#fff', fontSize: 12 }}>加入展延</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.calcRow}>
                <View style={[styles.calcResultBox, { flex: 1, marginRight: 5 }]}>
                  <Text style={styles.calcLabel}>預定竣工日</Text>
                  <Text style={styles.calcValue}>{completionDate}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 5 }}>
                  <Text style={styles.label} numberOfLines={1}>實際竣工日</Text>
                  {renderDateInput('actual', newProject.actualCompletionDate || '', '選擇日期', { backgroundColor: '#E8F5E9', borderColor: '#81C784' })}
                </View>
              </View>

              <Text style={styles.groupHeader}>金額與變更設計</Text>
              <Text style={styles.label}>契約總金 (原始金額)</Text>
              <TextInput style={styles.input} value={formatCurrency(newProject.contractAmount)} onChangeText={t => setNewProject({ ...newProject, contractAmount: parseCurrency(t) })} keyboardType="number-pad" placeholder="1000000" />

              <Text style={styles.label}>變更後總價 (自動計算)</Text>
              <TextInput style={[styles.input, { backgroundColor: '#eee' }]} value={formatCurrency(currentTotalAmount)} editable={false} />

              <View style={styles.extensionSection}>
                <Text style={styles.sectionTitle}>變更設計明細</Text>
                {newProject.changeDesigns?.map((cd, idx) => (
                  <View key={cd.id} style={styles.extItem}>
                    <Text style={styles.extText}>第{cd.count}次變更 ({cd.date}) - 新總價 ${formatCurrency(cd.newTotalAmount)}</Text>
                    <Text style={styles.extReason}>{cd.docNumber} / {cd.reason}</Text>
                    <TouchableOpacity onPress={() => handleRemoveChangeDesign(cd.id)} style={styles.removeExt}>
                      <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={styles.addExtBox}>
                  <View style={{ flexDirection: 'row', marginBottom: 5 }}>
                    {/* Count Dropdown */}
                    <TouchableOpacity style={[styles.smallInput, { width: 60, marginRight: 5, justifyContent: 'center' }]} onPress={() => setShowCdCountPicker(!showCdCountPicker)}>
                      <Text>{cdForm.count} <Ionicons name="chevron-down" size={12} /></Text>
                    </TouchableOpacity>
                    {showCdCountPicker && (
                      <View style={styles.dropdownListMini}>
                        {COUNT_OPTIONS.map(c => (<TouchableOpacity key={c} style={{ padding: 8 }} onPress={() => { setCdForm({ ...cdForm, count: c }); setShowCdCountPicker(false); }}><Text>{c}</Text></TouchableOpacity>))}
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      {renderDateInput('changeDesign', cdForm.date || '', '日期', { height: 35, padding: 8, fontSize: 13, backgroundColor: '#fff', borderRadius: 6 })}
                    </View>
                  </View>
                  <TextInput style={[styles.smallInput, { marginBottom: 5 }]} placeholder="變更後金額" keyboardType="number-pad" value={formatCurrency(cdForm.newTotalAmount)} onChangeText={t => setCdForm({ ...cdForm, newTotalAmount: parseCurrency(t).toString() })} />
                  <TextInput style={[styles.smallInput, { marginBottom: 5 }]} placeholder="文號" value={cdForm.docNumber} onChangeText={t => setCdForm({ ...cdForm, docNumber: t })} />
                  <TextInput style={[styles.smallMultiline, { minHeight: 60 }]} placeholder="變更事由 (支援多行)" multiline value={cdForm.reason} onChangeText={t => setCdForm({ ...cdForm, reason: t })} />
                  <TouchableOpacity style={styles.addExtBtn} onPress={handleAddChangeDesign}>
                    <Text style={{ color: '#fff', fontSize: 12 }}>加入變更設計</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.extensionSection}>
                <Text style={styles.sectionTitle}>後續擴充明細</Text>
                {newProject.subsequentExpansions?.map((se, idx) => (
                  <View key={se.id} style={styles.extItem}>
                    <Text style={styles.extText}>擴充{se.count} ({se.date}) - 追加 ${formatCurrency(se.amount)}</Text>
                    <Text style={styles.extReason}>{se.docNumber} / {se.reason}</Text>
                    <TouchableOpacity onPress={() => handleRemoveSubsequent(se.id)} style={styles.removeExt}>
                      <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={styles.addExtBox}>
                  <View style={{ flexDirection: 'row', marginBottom: 5 }}>
                    {/* Count Dropdown */}
                    <TouchableOpacity style={[styles.smallInput, { width: 60, marginRight: 5, justifyContent: 'center' }]} onPress={() => setShowSeCountPicker(!showSeCountPicker)}>
                      <Text>{seForm.count} <Ionicons name="chevron-down" size={12} /></Text>
                    </TouchableOpacity>
                    {showSeCountPicker && (
                      <View style={styles.dropdownListMini}>
                        {EXPANSION_COUNT_OPTIONS.map(c => (<TouchableOpacity key={c} style={{ padding: 8 }} onPress={() => { setSeForm({ ...seForm, count: c }); setShowSeCountPicker(false); }}><Text>{c}</Text></TouchableOpacity>))}
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      {renderDateInput('subsequentExpansion', seForm.date || '', '核准日期', { height: 35, padding: 8, fontSize: 13, backgroundColor: '#fff', borderRadius: 6 })}
                    </View>
                  </View>
                  <TextInput style={[styles.smallInput, { marginBottom: 5 }]} placeholder="擴充金額 (追加)" keyboardType="number-pad" value={formatCurrency(seForm.amount)} onChangeText={t => setSeForm({ ...seForm, amount: parseCurrency(t).toString() })} />
                  <TextInput style={[styles.smallInput, { marginBottom: 5 }]} placeholder="核准文號" value={seForm.docNumber} onChangeText={t => setSeForm({ ...seForm, docNumber: t })} />
                  <TextInput style={[styles.smallMultiline, { minHeight: 60 }]} placeholder="擴充事由 (支援多行)" multiline value={seForm.reason} onChangeText={t => setSeForm({ ...seForm, reason: t })} />
                  <TouchableOpacity style={styles.addExtBtn} onPress={handleAddSubsequent}>
                    <Text style={{ color: '#fff', fontSize: 12 }}>加入後續擴充</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.groupHeader}>驗收日期</Text>
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.label}>驗收日期</Text>
                  {renderDateInput('inspection', newProject.inspectionDate || '', '選擇日期')}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>複驗日期</Text>
                  {renderDateInput('reinspection', newProject.reinspectionDate || '', '選擇日期')}
                </View>
              </View>

              <View style={{ height: 100 }} />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitProject}>
                <Text style={styles.submitBtnText}>確認新增專案</Text>
              </TouchableOpacity>
            </View>

            {/* Native Picker Modal */}
            {showDatePicker && Platform.OS !== 'web' && (
              Platform.OS === 'ios' ? (
                <Modal transparent animationType="fade">
                  <View style={styles.iosDatePickerContainer}>
                    <View style={styles.iosDatePickerContent}>
                      <DateTimePicker value={tempDate} mode="date" display="spinner" onChange={onNativeDateChange} style={{ height: 150 }} />
                      <TouchableOpacity style={styles.iosConfirmBtn} onPress={() => confirmNativeDate(tempDate)}><Text style={styles.iosConfirmText}>確認</Text></TouchableOpacity>
                    </View>
                  </View>
                </Modal>
              ) : (
                <DateTimePicker value={tempDate} mode="date" display="default" onChange={onNativeDateChange} />
              )
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Side Menu */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <View style={styles.menuOverlay}>
          <View style={styles.sideMenu}>
            <SafeAreaView style={{ flex: 1, padding: 20 }}>
              <View style={styles.menuHeader}>
                <Text style={styles.menuTitle}>功能選單</Text>
                <TouchableOpacity onPress={() => setMenuVisible(false)}><Ionicons name="close" size={28} color="#fff" /></TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <MenuItem icon="home" label="首頁" onPress={() => { setMenuVisible(false); router.push('/dashboard'); }} />
                <MenuItem icon="folder-open" label="專案列表" isActive={true} onPress={() => setMenuVisible(false)} />
                <MenuItem icon="clipboard" label="施工紀錄" onPress={() => { setMenuVisible(false); router.push('/logs'); }} />
                {user?.role === 'admin' && (
                  <MenuItem icon="people" label="人員管理" onPress={() => { setMenuVisible(false); router.push('/personnel'); }} />
                )}
                <MenuItem icon="library" label="SOP資料庫" onPress={() => { setMenuVisible(false); router.push('/sop'); }} />
                <MenuItem icon="person-circle" label="我的檔案" onPress={() => { setMenuVisible(false); router.push('/profile'); }} />
              </View>
              <View style={{ paddingBottom: 20 }}>
                <MenuItem icon="log-out-outline" label="登出系統" isLogout onPress={handleLogout} />
              </View>
            </SafeAreaView>
          </View>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setMenuVisible(false)} />
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  headerSafeArea: { backgroundColor: THEME.headerBg, paddingTop: Platform.OS === 'android' ? 25 : 0 },
  headerContent: { height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, justifyContent: 'space-between' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  menuBtn: { padding: 5 },
  contentContainer: { flex: 1 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 15, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 12, marginBottom: 15, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  projectTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  projectInfo: { color: '#666', marginTop: 5 },
  progressSection: { marginTop: 15 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5, alignItems: 'center' },
  progressLabelText: { fontSize: 12, color: '#666' },
  progressStatus: { fontSize: 12, fontWeight: 'bold' },
  progressTrack: { height: 12, backgroundColor: '#eee', borderRadius: 6, position: 'relative' },
  progressBar: { height: 12, backgroundColor: THEME.primary, borderRadius: 6 },
  plannedMarker: { position: 'absolute', top: -4, bottom: -4, width: 2, backgroundColor: '#333', opacity: 0.6, zIndex: 2 },
  fab: { position: 'absolute', right: 20, bottom: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: THEME.primary, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { marginTop: 10, color: '#999' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', height: '90%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#002147' },
  formScroll: { flex: 1 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#333', marginTop: 15, marginBottom: 5 },
  input: { backgroundColor: '#F9F9F9', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16 },
  row: { flexDirection: 'row' },
  smallInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 8, fontSize: 13 },
  smallMultiline: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 8, fontSize: 13, textAlignVertical: 'top' },
  dateBtn: { backgroundColor: '#F9F9F9', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 50 },
  dateBtnText: { color: '#333', fontSize: 16 },
  dropdownBtn: { backgroundColor: '#F9F9F9', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdownBtnText: { fontSize: 16, color: '#333' },
  dropdownList: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, marginTop: 5, backgroundColor: '#fff', elevation: 3, position: 'absolute', top: 50, left: 0, right: 0, zIndex: 9999 },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  dropdownItemText: { fontSize: 16, color: '#333' },
  extensionSection: { marginTop: 25, backgroundColor: '#F0F4F8', padding: 15, borderRadius: 10 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#002147', marginBottom: 10 },
  addExtBox: { marginTop: 10, borderTopWidth: 1, borderColor: '#ddd', paddingTop: 10 },
  addExtBtn: { backgroundColor: '#555', padding: 8, borderRadius: 6, alignItems: 'center', marginTop: 10, alignSelf: 'flex-start' },
  extItem: { backgroundColor: '#fff', padding: 10, borderRadius: 8, marginBottom: 8 },
  extText: { fontWeight: 'bold', color: '#333', fontSize: 14 },
  extReason: { color: '#666', fontSize: 12 },
  removeExt: { position: 'absolute', top: 10, right: 10 },
  importBtn: { backgroundColor: '#4CAF50', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4, flexDirection: 'row', alignItems: 'center' },
  calcRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  calcResultBox: { backgroundColor: '#002147', padding: 15, borderRadius: 10, alignItems: 'center' },
  calcLabel: { color: '#aaa', fontSize: 12 },
  calcValue: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginVertical: 5 },
  modalFooter: { marginTop: 10, borderTopWidth: 1, borderColor: '#eee', paddingTop: 10 },
  submitBtn: { backgroundColor: THEME.primary, padding: 15, borderRadius: 10, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  iosDatePickerContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  iosDatePickerContent: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  iosConfirmBtn: { backgroundColor: THEME.primary, padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  iosConfirmText: { color: '#fff', fontWeight: 'bold' },
  menuOverlay: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.5)' },
  sideMenu: { width: '80%', backgroundColor: '#002147', height: '100%' },
  menuHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  menuTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  menuItem: { flexDirection: 'row', paddingVertical: 15, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  menuItemActive: { backgroundColor: 'rgba(198,156,109,0.1)' },
  menuItemText: { color: '#fff', marginLeft: 15, fontSize: 16 },
  groupHeader: { fontSize: 13, fontWeight: 'bold', color: '#999', backgroundColor: '#f0f0f0', padding: 5, marginTop: 15 },
  dropdownListMini: { position: 'absolute', top: 40, left: 0, width: 60, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', zIndex: 9999 },
});