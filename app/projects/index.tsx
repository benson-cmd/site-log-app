import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Platform, StatusBar, Modal, TextInput, ScrollView, Alert, KeyboardAvoidingView } from 'react-native';
import React, { useState, useMemo } from 'react';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import Papa from 'papaparse';
import { useUser } from '../../context/UserContext';
import { useProjects, Project, Extension, ChangeDesign, SchedulePoint } from '../../context/ProjectContext';
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
  settlement: '結算'
};

const EXECUTION_STATUS_OPTIONS = Object.keys(EXECUTION_STATUS_MAP);

export default function ProjectsScreen() {
  const router = useRouter();
  const { user, logout } = useUser();
  const { projects, addProject } = useProjects();
  const { personnelList } = usePersonnel();

  // States
  const [menuVisible, setMenuVisible] = useState(false);
  const [searchText, setSearchText] = useState('');

  // Add Project Modal States
  const [isAddModalVisible, setAddModalVisible] = useState(false);

  // Project Form State
  const [newProject, setNewProject] = useState<Partial<Project>>({
    name: '', address: '', manager: '',
    status: 'planning', // Keeping generic status for now or replacing usage? Let's keep it but focus on executionStatus
    executionStatus: 'not_started',
    startDate: '', contractDuration: 0, progress: 0, extensions: [],
    awardDate: '', actualCompletionDate: '', inspectionDate: '', reinspectionDate: '', inspectionPassedDate: '',
    contractAmount: 0, changeDesigns: [], scheduleData: []
  });

  // Extension Inputs
  const [extForm, setExtForm] = useState({ days: '', date: '', docNumber: '', reason: '' });

  // Change Design Inputs
  const [cdForm, setCdForm] = useState({ date: '', docNumber: '', reason: '', newTotalAmount: '' });

  // Manager Dropdown
  const [showManagerPicker, setShowManagerPicker] = useState(false);
  const managers = useMemo(() => personnelList.map(p => p.name), [personnelList]);

  // Execution Status Dropdown
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  // Date Picker Logic (Native)
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateFieldTarget, setDateFieldTarget] = useState<'award' | 'start' | 'actual' | 'inspection' | 'reinspection' | 'passed' | 'extension' | 'changeDesign'>('start');
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
    } catch (e) { }

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
    if (field === 'extension') {
      setExtForm(prev => ({ ...prev, date: value }));
    } else if (field === 'changeDesign') {
      setCdForm(prev => ({ ...prev, date: value }));
    } else if (field === 'award') {
      setNewProject(prev => ({ ...prev, awardDate: value }));
    } else if (field === 'start') {
      setNewProject(prev => ({ ...prev, startDate: value }));
    } else if (field === 'actual') {
      setNewProject(prev => ({ ...prev, actualCompletionDate: value }));
    } else if (field === 'inspection') {
      setNewProject(prev => ({ ...prev, inspectionDate: value }));
    } else if (field === 'reinspection') {
      setNewProject(prev => ({ ...prev, reinspectionDate: value }));
    }
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
          height: 50,
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

  // Filter Logic
  const filteredProjects = useMemo(() => {
    if (!searchText) return projects;
    return projects.filter(p => p.name.includes(searchText) || p.address.includes(searchText));
  }, [projects, searchText]);

  // Calc Planned Progress
  const getPlannedProgress = (project: Project) => {
    if (!project.scheduleData || project.scheduleData.length === 0) return 0;
    const today = new Date().toISOString().split('T')[0];
    // Find closest date <= today (assuming sorted)
    let planned = 0;
    // scheduleData should be sorted by date ideally
    // Simple loop
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

  // Extension Handlers
  const handleAddExtension = () => {
    if (!extForm.days || !extForm.reason || !extForm.date) {
      Alert.alert('提示', '請填寫天數、公文日期與理由');
      return;
    }
    const newExt: Extension = {
      id: Math.random().toString(36).substr(2, 9),
      days: parseInt(extForm.days) || 0,
      date: extForm.date,
      docNumber: extForm.docNumber,
      reason: extForm.reason
    };
    setNewProject(prev => ({
      ...prev,
      extensions: [...(prev.extensions || []), newExt]
    }));
    setExtForm({ days: '', date: '', docNumber: '', reason: '' });
  };

  const handleRemoveExtension = (id: string) => {
    setNewProject(prev => ({
      ...prev,
      extensions: prev.extensions?.filter(e => e.id !== id)
    }));
  };

  // Change Design Handlers
  const handleAddChangeDesign = () => {
    if (!cdForm.date || !cdForm.newTotalAmount || !cdForm.reason) {
      Alert.alert('提示', '請填寫日期、變更後金額與事由');
      return;
    }
    const count = (newProject.changeDesigns?.length || 0) + 1;
    const newCd: ChangeDesign = {
      id: Math.random().toString(36).substr(2, 9),
      count,
      date: cdForm.date,
      docNumber: cdForm.docNumber,
      reason: cdForm.reason,
      newTotalAmount: parseFloat(cdForm.newTotalAmount) || 0
    };
    setNewProject(prev => ({
      ...prev,
      changeDesigns: [...(prev.changeDesigns || []), newCd]
    }));
    setCdForm({ date: '', docNumber: '', reason: '', newTotalAmount: '' });
  };

  const handleRemoveChangeDesign = (id: string) => {
    setNewProject(prev => ({
      ...prev,
      changeDesigns: prev.changeDesigns?.filter(c => c.id !== id)
    }));
  };

  // Schedule Import
  const handleImportSchedule = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'application/vnd.ms-excel', 'text/comma-separated-values', 'text/plain'],
        copyToCacheDirectory: true
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const file = res.assets[0];

        // In Web, we might have file object directly or uri to fetch
        let content = '';
        if (Platform.OS === 'web') {
          // Fetch blob
          const response = await fetch(file.uri);
          content = await response.text();
        } else {
          // Native: Read likely needed via FileSystem, but papaparse might handle URI? 
          // Simple approach: DocumentPicker gives URI. On native might need expo-file-system.
          // For now, assuming web focus as requested. If Native, this might fail without FileSystem.readAsStringAsync
          // Let's implement fetch workaround for native too (often works for local uri)
          const response = await fetch(file.uri);
          content = await response.text();
        }

        Papa.parse(content, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            // Expect columns: Date, Progress (or similar)
            // Adapter to find likely columns
            const parsedData: SchedulePoint[] = [];
            results.data.forEach((row: any) => {
              // Try to find Date and Progress keys case-insensitive
              const keys = Object.keys(row);
              const dateKey = keys.find(k => k.toLowerCase().includes('date') || k.includes('日期'));
              const progKey = keys.find(k => k.toLowerCase().includes('progress') || k.includes('進度'));

              if (dateKey && progKey) {
                parsedData.push({
                  date: row[dateKey],
                  progress: parseFloat(row[progKey]) || 0
                });
              }
            });

            // Sort by date
            parsedData.sort((a, b) => a.date.localeCompare(b.date));

            if (parsedData.length > 0) {
              setNewProject(prev => ({ ...prev, scheduleData: parsedData }));
              Alert.alert('成功', `已匯入 ${parsedData.length} 筆進度資料`);
            } else {
              Alert.alert('錯誤', '無法解析 CSV，請確保有「日期」與「進度」欄位');
            }
          },
          error: (err) => {
            Alert.alert('匯入失敗', err.message);
          }
        });
      }
    } catch (err) {
      console.log("Import Error", err);
      Alert.alert('錯誤', '匯入失敗');
    }
  };

  // Auto Calculations
  const calculateCompletionDate = () => {
    if (!newProject.startDate || !newProject.contractDuration) return '請輸入開工日與工期';
    const start = new Date(newProject.startDate);
    if (isNaN(start.getTime())) return '日期格式錯誤';
    const totalExtensions = newProject.extensions?.reduce((sum, ext) => sum + ext.days, 0) || 0;
    const totalDays = (parseInt(newProject.contractDuration.toString()) || 0) + totalExtensions - 1;
    const end = new Date(start);
    end.setDate(start.getDate() + totalDays);
    return end.toISOString().split('T')[0];
  };

  const completionDate = calculateCompletionDate();

  const currentTotalAmount = useMemo(() => {
    let amount = parseFloat(newProject.contractAmount?.toString() || '0');
    if (newProject.changeDesigns && newProject.changeDesigns.length > 0) {
      amount = newProject.changeDesigns[newProject.changeDesigns.length - 1].newTotalAmount;
    }
    return amount;
  }, [newProject.contractAmount, newProject.changeDesigns]);

  // Submit
  const handleSubmitProject = () => {
    if (!newProject.name || !newProject.startDate) {
      Alert.alert('錯誤', '專案名稱與開工日為必填');
      return;
    }

    addProject({
      ...newProject,
      contractAmount: parseFloat(newProject.contractAmount?.toString() || '0'),
      contractDuration: parseInt(newProject.contractDuration?.toString() || '0'),
      extensions: newProject.extensions || [],
      changeDesigns: newProject.changeDesigns || [],
      scheduleData: newProject.scheduleData || [],
      currentActualProgress: newProject.currentActualProgress || 0,
    } as any);

    setAddModalVisible(false);
    // Reset
    setNewProject({ name: '', address: '', manager: '', executionStatus: 'not_started', status: 'planning', startDate: '', contractDuration: 0, progress: 0, extensions: [], contractAmount: 0, changeDesigns: [], scheduleData: [] });
    setExtForm({ days: '', date: '', docNumber: '', reason: '' });
    setCdForm({ date: '', docNumber: '', reason: '', newTotalAmount: '' });
    Alert.alert('成功', '專案已新增');
  };

  // Render components
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

      {/* Header */}
      <SafeAreaView style={styles.headerSafeArea}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.menuBtn}>
            <Ionicons name="menu" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>專案列表</Text>
          <View style={{ width: 28 }} />
        </View>
      </SafeAreaView>

      {/* Content */}
      <View style={styles.contentContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="搜尋專案名稱..."
            value={searchText}
            onChangeText={setSearchText}
          />
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
              <TouchableOpacity style={styles.card} onPress={() => router.push(`/projects/${item.id}`)}>
                <View style={styles.cardHeader}>
                  <View style={[styles.statusTag, { backgroundColor: '#E3F2FD' }]}>
                    <Text style={{ color: '#002147', fontSize: 12, fontWeight: 'bold' }}>
                      {EXECUTION_STATUS_MAP[item.executionStatus || 'not_started']}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#ccc" />
                </View>
                <Text style={styles.projectTitle}>{item.name}</Text>
                <Text style={styles.projectInfo}>📍 {item.address}</Text>

                {/* Financial Overview */}
                <Text style={styles.projectInfo}>💰 契約：${item.currentContractAmount?.toLocaleString() || item.contractAmount?.toLocaleString()}</Text>

                {/* Dual Progress Bar */}
                <View style={styles.progressSection}>
                  <View style={styles.progressLabels}>
                    <Text style={styles.progressLabelText}>
                      實際: <Text style={{ fontWeight: 'bold' }}>{actual}%</Text>
                    </Text>
                    <Text style={styles.progressLabelText}>
                      預定: <Text style={{ fontWeight: 'bold' }}>{planned}%</Text>
                    </Text>
                    <Text style={[styles.progressStatus, { color: isBehind ? THEME.danger : THEME.success }]}>
                      {isBehind ? `🔴 落後 ${Math.abs(diff).toFixed(1)}%` : `🟢 正常 +${diff.toFixed(1)}%`}
                    </Text>
                  </View>
                  <View style={styles.progressTrack}>
                    {/* Actual Bar */}
                    <View style={[styles.progressBar, { width: `${Math.min(actual, 100)}%` }]} />
                    {/* Planned Marker (Vertical Line) */}
                    <View style={[styles.plannedMarker, { left: `${Math.min(planned, 100)}%` }]} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="folder-open-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>沒有符合的專案</Text>
            </View>
          }
        />

        {user && (
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
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <Ionicons name="close" size={26} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll}>
              <Text style={styles.groupHeader}>基本資料</Text>
              <Text style={styles.label}>專案名稱 *</Text>
              <TextInput style={styles.input} value={newProject.name} onChangeText={t => setNewProject({ ...newProject, name: t })} placeholder="輸入專案名稱" />

              <Text style={styles.label}>地址</Text>
              <TextInput style={styles.input} value={newProject.address} onChangeText={t => setNewProject({ ...newProject, address: t })} placeholder="輸入專案地址" />

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.label}>工地主任</Text>
                  <TouchableOpacity style={styles.dropdownBtn} onPress={() => setShowManagerPicker(!showManagerPicker)}>
                    <Text style={styles.dropdownBtnText}>{newProject.manager || '請選擇'}</Text>
                    <Ionicons name="chevron-down" size={20} color="#666" />
                  </TouchableOpacity>
                  {showManagerPicker && (
                    <View style={[styles.dropdownList, { zIndex: 999 }]}>
                      {managers.map((mgr, idx) => (
                        <TouchableOpacity key={idx} style={styles.dropdownItem} onPress={() => { setNewProject({ ...newProject, manager: mgr }); setShowManagerPicker(false); }}>
                          <Text style={styles.dropdownItemText}>{mgr}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>執行狀態</Text>
                  <TouchableOpacity style={styles.dropdownBtn} onPress={() => setShowStatusPicker(!showStatusPicker)}>
                    <Text style={styles.dropdownBtnText}>{EXECUTION_STATUS_MAP[newProject.executionStatus || 'not_started']}</Text>
                    <Ionicons name="chevron-down" size={20} color="#666" />
                  </TouchableOpacity>
                  {showStatusPicker && (
                    <View style={[styles.dropdownList, { zIndex: 999 }]}>
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

              <Text style={styles.label}>契約工期 (天)</Text>
              <TextInput style={styles.input} value={newProject.contractDuration?.toString()} onChangeText={t => setNewProject({ ...newProject, contractDuration: parseInt(t) || 0 })} keyboardType="number-pad" placeholder="600" />

              {/* Schedule Import */}
              <View style={{ marginTop: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: 'bold', color: '#333' }}>預定進度表</Text>
                <TouchableOpacity style={styles.importBtn} onPress={handleImportSchedule}>
                  <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
                  <Text style={{ color: '#fff', marginLeft: 5 }}>匯入 CSV</Text>
                </TouchableOpacity>
              </View>
              {newProject.scheduleData && newProject.scheduleData.length > 0 && (
                <Text style={{ color: THEME.success, fontSize: 12, marginTop: 5 }}>✓ 已匯入 {newProject.scheduleData.length} 筆進度資料</Text>
              )}


              {/* Extension Logic */}
              <View style={styles.extensionSection}>
                <Text style={styles.sectionTitle}>展延工期明細</Text>
                {newProject.extensions?.map((ext, idx) => (
                  <View key={ext.id} style={styles.extItem}>
                    <Text style={styles.extText}>{idx + 1}. {ext.date} (文號：{ext.docNumber}) - {ext.days}天</Text>
                    <Text style={styles.extReason}>理由：{ext.reason}</Text>
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
                    <TextInput style={[styles.smallInput, { flex: 2, marginLeft: 5 }]} placeholder="展延理由" value={extForm.reason} onChangeText={t => setExtForm({ ...extForm, reason: t })} />
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
              <Text style={styles.label}>契約金額 (元)</Text>
              <TextInput style={styles.input} value={newProject.contractAmount?.toString()} onChangeText={t => setNewProject({ ...newProject, contractAmount: parseFloat(t) || 0 })} keyboardType="number-pad" placeholder="1000000" />

              <Text style={styles.label}>目前契約總價 (自動計算)</Text>
              <TextInput style={[styles.input, { backgroundColor: '#eee' }]} value={currentTotalAmount.toLocaleString()} editable={false} />

              <View style={styles.extensionSection}>
                <Text style={styles.sectionTitle}>變更設計明細</Text>
                {newProject.changeDesigns?.map((cd, idx) => (
                  <View key={cd.id} style={styles.extItem}>
                    <Text style={styles.extText}>第{cd.count}次變更 ({cd.date}) - ${cd.newTotalAmount.toLocaleString()}</Text>
                    <Text style={styles.extReason}>{cd.docNumber} / {cd.reason}</Text>
                    <TouchableOpacity onPress={() => handleRemoveChangeDesign(cd.id)} style={styles.removeExt}>
                      <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                    </TouchableOpacity>
                  </View>
                ))}

                <View style={styles.addExtBox}>
                  <View style={{ flexDirection: 'row' }}>
                    <View style={{ flex: 1, marginRight: 5 }}>
                      {renderDateInput('changeDesign', cdForm.date || '', '日期', { height: 35, padding: 8, fontSize: 13, backgroundColor: '#fff', borderRadius: 6 })}
                    </View>
                    <TextInput style={[styles.smallInput, { flex: 1.5 }]} placeholder="變更後總價" keyboardType="number-pad" value={cdForm.newTotalAmount} onChangeText={t => setCdForm({ ...cdForm, newTotalAmount: t })} />
                  </View>
                  <View style={[styles.row, { marginTop: 5 }]}>
                    <TextInput style={[styles.smallInput, { flex: 1 }]} placeholder="文號" value={cdForm.docNumber} onChangeText={t => setCdForm({ ...cdForm, docNumber: t })} />
                    <TextInput style={[styles.smallInput, { flex: 2, marginLeft: 5 }]} placeholder="變更事由" value={cdForm.reason} onChangeText={t => setCdForm({ ...cdForm, reason: t })} />
                  </View>
                  <TouchableOpacity style={styles.addExtBtn} onPress={handleAddChangeDesign}>
                    <Text style={{ color: '#fff', fontSize: 12 }}>加入變更設計</Text>
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
                      <DateTimePicker
                        value={tempDate}
                        mode="date"
                        display="spinner"
                        onChange={onNativeDateChange}
                        style={{ height: 150 }}
                      />
                      <TouchableOpacity style={styles.iosConfirmBtn} onPress={() => confirmNativeDate(tempDate)}>
                        <Text style={styles.iosConfirmText}>確認</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Modal>
              ) : (
                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  display="default"
                  onChange={onNativeDateChange}
                />
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
                <MenuItem icon="people" label="人員管理" onPress={() => { setMenuVisible(false); router.push('/personnel'); }} />
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

  // Card
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 12, marginBottom: 15, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  projectTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  projectInfo: { color: '#666', marginTop: 5 },

  // Progress
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

  // Add Project Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', height: '90%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#002147' },
  formScroll: { flex: 1 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#333', marginTop: 15, marginBottom: 5 },
  input: { backgroundColor: '#F9F9F9', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16 },
  row: { flexDirection: 'row' },
  smallInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 8, fontSize: 13 },

  // Date Btn
  dateBtn: { backgroundColor: '#F9F9F9', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 50 },
  dateBtnText: { color: '#333', fontSize: 16 },

  // Dropdown
  dropdownBtn: { backgroundColor: '#F9F9F9', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdownBtnText: { fontSize: 16, color: '#333' },
  dropdownList: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, marginTop: 5, backgroundColor: '#fff', elevation: 3, position: 'absolute', top: 50, left: 0, right: 0 },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  dropdownItemText: { fontSize: 16, color: '#333' },

  // Extension & Changes
  extensionSection: { marginTop: 25, backgroundColor: '#F0F4F8', padding: 15, borderRadius: 10 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#002147', marginBottom: 10 },
  addExtBox: { marginTop: 10, borderTopWidth: 1, borderColor: '#ddd', paddingTop: 10 },
  addExtBtn: { backgroundColor: '#555', padding: 8, borderRadius: 6, alignItems: 'center', marginTop: 10, alignSelf: 'flex-start' },
  extItem: { backgroundColor: '#fff', padding: 10, borderRadius: 8, marginBottom: 8 },
  extText: { fontWeight: 'bold', color: '#333', fontSize: 14 },
  extReason: { color: '#666', fontSize: 12 },
  removeExt: { position: 'absolute', top: 10, right: 10 },

  // Import
  importBtn: { backgroundColor: '#4CAF50', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4, flexDirection: 'row', alignItems: 'center' },

  // Calc Result
  calcRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  calcResultBox: { backgroundColor: '#002147', padding: 15, borderRadius: 10, alignItems: 'center' },
  calcLabel: { color: '#aaa', fontSize: 12 },
  calcValue: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginVertical: 5 },
  modalFooter: { marginTop: 10, borderTopWidth: 1, borderColor: '#eee', paddingTop: 10 },
  submitBtn: { backgroundColor: THEME.primary, padding: 15, borderRadius: 10, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  // iOS DatePicker
  iosDatePickerContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  iosDatePickerContent: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  iosConfirmBtn: { backgroundColor: THEME.primary, padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  iosConfirmText: { color: '#fff', fontWeight: 'bold' },

  // Menu
  menuOverlay: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.5)' },
  sideMenu: { width: '80%', backgroundColor: '#002147', height: '100%' },
  menuHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  menuTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  menuItem: { flexDirection: 'row', paddingVertical: 15, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  menuItemActive: { backgroundColor: 'rgba(198,156,109,0.1)' },
  menuItemText: { color: '#fff', marginLeft: 15, fontSize: 16 },

  // Helper
  groupHeader: { fontSize: 13, fontWeight: 'bold', color: '#999', backgroundColor: '#f0f0f0', padding: 5, marginTop: 15 }
});