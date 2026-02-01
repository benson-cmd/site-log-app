import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Platform, StatusBar, Modal, TextInput, Alert, KeyboardAvoidingView, Dimensions } from 'react-native';
import React, { useState, useEffect, useMemo } from 'react';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import Papa from 'papaparse';
import { LineChart } from "react-native-chart-kit";
import { useProjects, Project, Extension, ChangeDesign, SubsequentExpansion, SchedulePoint } from '../../context/ProjectContext';
import { usePersonnel } from '../../context/PersonnelContext';
import { useLogs } from '../../context/LogContext';
import { useUser } from '../../context/UserContext';

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
  if (!val) return '0';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '0';
  return num.toLocaleString();
};

const parseCurrency = (val: string) => {
  return parseFloat(val.replace(/,/g, '')) || 0;
};

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { projects, updateProject, deleteProject } = useProjects();
  const { personnelList } = usePersonnel();
  const { logs } = useLogs();
  const { user } = useUser();

  const project = projects.find(p => p.id === id);
  const projectLogs = logs.filter(l => l.projectId === id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // --- Calculations (Moved Up) ---
  const totalExtensionDays = useMemo(() => {
    return project?.extensions?.reduce((sum, ext) => sum + (ext.days || 0), 0) || 0;
  }, [project?.extensions]);

  const plannedCompletionDate = useMemo(() => {
    if (!project?.startDate || !project?.contractDuration) return '-';
    const start = new Date(project.startDate);
    if (isNaN(start.getTime())) return '-';
    const totalDays = (project.contractDuration || 0) + totalExtensionDays - 1;
    const end = new Date(start);
    end.setDate(start.getDate() + totalDays);
    return end.toISOString().split('T')[0];
  }, [project?.startDate, project?.contractDuration, totalExtensionDays]);

  const currentTotalAmount = useMemo(() => {
    if (!project) return 0;
    let base = project.contractAmount || 0;
    if (project.changeDesigns && project.changeDesigns.length > 0) {
      base = project.changeDesigns[project.changeDesigns.length - 1].newTotalAmount;
    }
    const expansions = project.subsequentExpansions?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
    return base + expansions;
  }, [project?.contractAmount, project?.changeDesigns, project?.subsequentExpansions]);

  const projectSchedule = useMemo(() => {
    let data: SchedulePoint[] = [];
    if (project?.scheduleData && project.scheduleData.length > 0) {
      data = [...project.scheduleData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
    // Inject Start Point if needed
    const pStart = project?.startDate;
    if (pStart && pStart !== '-') {
      if (data.length === 0 || data[0].date !== pStart) {
        data.unshift({ date: pStart, progress: 0 });
      }
    }
    // Inject End Point if needed 
    const pEndDateVal = plannedCompletionDate;
    if (pEndDateVal && pEndDateVal !== '-') {
      if (data.length > 0 && data[data.length - 1].date !== pEndDateVal) {
        data.push({ date: pEndDateVal, progress: 100 });
      }
    }
    return data;
  }, [project?.scheduleData, project?.startDate, plannedCompletionDate]);

  // --- Metrics Calculation for Project Status Dashboard ---
  const projectMetrics = useMemo(() => {
    if (!project) return { remainingDays: 0, plannedProgress: 0, actualProgress: 0, hasTodayLog: false, actualDisplay: '尚未更新', todayStr: new Date().toISOString().split('T')[0], diffElement: null };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // 1. Remaining Duration
    let remainingDays = 0;
    if (plannedCompletionDate !== '-') {
      const end = new Date(plannedCompletionDate);
      remainingDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }

    // 2. Planned Progress (Today)
    let plannedProgress = 0;
    if (projectSchedule.length > 0) {
      const todayTs = today.getTime();
      const schedule = [...projectSchedule].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const nextIdx = schedule.findIndex(s => new Date(s.date).getTime() >= todayTs);
      if (nextIdx === 0) {
        plannedProgress = schedule[0].progress;
      } else if (nextIdx === -1) {
        plannedProgress = schedule[schedule.length - 1].progress;
      } else {
        const p1 = schedule[nextIdx - 1];
        const p2 = schedule[nextIdx];
        const t1 = new Date(p1.date).getTime();
        const t2 = new Date(p2.date).getTime();
        const ratio = (todayTs - t1) / (t2 - t1);
        plannedProgress = p1.progress + (p2.progress - p1.progress) * ratio;
      }
    }
    plannedProgress = Math.round(plannedProgress * 10) / 10;

    // 3. Strict Daily Actual Progress Check
    const todayLog = projectLogs.find(l => l.date === todayStr);
    const actualProgress = todayLog ? parseFloat((todayLog as any).actualProgress || 0) : 0;
    const hasTodayLog = !!todayLog;

    // Gap Analysis
    let diffElement = null;
    if (hasTodayLog) {
      const diff = actualProgress - plannedProgress;
      const diffFix = diff.toFixed(1);
      if (diff > 0) {
        diffElement = <Text style={{ color: '#52c41a', fontSize: 11, marginTop: 4, fontWeight: 'bold' }}>▲ 超前 {diffFix}%</Text>;
      } else if (diff < 0) {
        diffElement = <Text style={{ color: '#ff4d4f', fontSize: 11, marginTop: 4, fontWeight: 'bold' }}>▼ 落後 {Math.abs(diff).toFixed(1)}%</Text>;
      } else {
        diffElement = <Text style={{ color: '#888', fontSize: 11, marginTop: 4 }}>- 持平 -</Text>;
      }
    }

    return {
      remainingDays,
      plannedProgress,
      actualProgress: Math.round(actualProgress * 10) / 10,
      hasTodayLog,
      actualDisplay: hasTodayLog ? `${Math.round(actualProgress * 10) / 10}%` : '尚未更新',
      todayStr,
      diffElement
    };
  }, [project, projectSchedule, projectLogs, plannedCompletionDate]);

  // Edit Modal State
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [editProject, setEditProject] = useState<Partial<Project>>({});

  // Forms
  const [extForm, setExtForm] = useState({ days: '', date: '', docNumber: '', reason: '' });
  const [cdForm, setCdForm] = useState({ count: '1', date: '', docNumber: '', reason: '', newTotalAmount: '' });
  const [seForm, setSeForm] = useState({ count: '1', date: '', docNumber: '', reason: '', amount: '' });

  // UI States
  const [showCdCountPicker, setShowCdCountPicker] = useState(false);
  const [showSeCountPicker, setShowSeCountPicker] = useState(false);
  const [showManagerPicker, setShowManagerPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  const managers = useMemo(() => personnelList.map(p => p.name), [personnelList]);

  // Date Picker
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateFieldTarget, setDateFieldTarget] = useState<string>('');
  const [tempDate, setTempDate] = useState(new Date());


  // S-Curve States
  const [plannedData, setPlannedData] = useState<number[]>([0]);
  const [actualData, setActualData] = useState<(number | null)[]>([0]);
  const [chartLabels, setChartLabels] = useState<string[]>(['Start']);
  const [activeTab, setActiveTab] = useState<'progress' | 'info'>('progress');

  // Documents Section States
  const [isDocModalVisible, setDocModalVisible] = useState(false);
  const [docForm, setDocForm] = useState({ title: '', file: null as any, uploading: false });

  // Handler: Edit Button (Fix Empty Form Issue)
  const handleEditPress = () => {
    if (project) {
      setEditProject({
        name: project.name || '',
        address: project.address || '',
        manager: project.manager || '',
        executionStatus: project.executionStatus || 'not_started',
        startDate: project.startDate || '',
        contractAmount: project.contractAmount || 0,
        contractDuration: project.contractDuration || 0,
        awardDate: project.awardDate || '',
        actualCompletionDate: project.actualCompletionDate || '',
        inspectionDate: project.inspectionDate || '',
        inspectionPassedDate: project.inspectionPassedDate || '',
        reinspectionDate: project.reinspectionDate || '',
        description: project.description || '',
        extensions: project.extensions || [],
        changeDesigns: project.changeDesigns || [],
        subsequentExpansions: project.subsequentExpansions || [],
        scheduleData: project.scheduleData || []
      });
    }
    setEditModalVisible(true);
  };

  useEffect(() => {
    if (project) {
      const toTs = (d: any) => {
        if (!d) return 0;
        const str = typeof d === 'string' ? d.replace(/\//g, '-') : d.toISOString();
        return new Date(str).getTime();
      };

      const startTs = toTs(project.startDate);
      const endTs = toTs(plannedCompletionDate);
      const nowTs = new Date().getTime();

      const points = [];
      const totalDuration = endTs - startTs;
      const steps = 6;
      for (let i = 0; i <= steps; i++) {
        if (i === steps) points.push(endTs);
        else points.push(startTs + (totalDuration * (i / steps)));
      }

      const labelsStr = points.map(ts => {
        const d = new Date(ts);
        return `${d.getMonth() + 1}/${d.getDate()}`;
      });
      setChartLabels(labelsStr);

      if (projectLogs && projectLogs.length > 0) {
        const cleanLogs = projectLogs.map(l => ({
          ts: toTs(l.date),
          val: parseFloat((l as any).actualProgress || 0)
        })).sort((a, b) => a.ts - b.ts);

        const mappedData = points.map(pointTs => {
          if (pointTs > nowTs) return null;
          const validLogs = cleanLogs.filter(l => l.ts <= pointTs);
          if (validLogs.length > 0) return validLogs[validLogs.length - 1].val;
          return 0;
        });
        const hasData = mappedData.some(d => d !== null);
        setActualData(hasData ? mappedData : [0]);
      } else {
        setActualData([0]);
      }

      if (project.scheduleData && project.scheduleData.length > 0) {
        const sortedSchedule = [...project.scheduleData].sort((a, b) => toTs(a.date) - toTs(b.date));
        const newPlannedData = points.map(pointTs => {
          const valid = sortedSchedule.filter(s => toTs(s.date) <= pointTs);
          if (valid.length > 0) return valid[valid.length - 1].progress;
          return 0;
        });
        setPlannedData(newPlannedData);
      } else {
        const linear = points.map((_, i) => Math.round((i / steps) * 100));
        setPlannedData(linear);
      }
    }
  }, [project, projectLogs, plannedCompletionDate]);

  const handleImportPlannedCSV = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/plain'], copyToCacheDirectory: true });
      if (!res.canceled && res.assets && res.assets[0]) {
        const file = res.assets[0];
        const response = await fetch(file.uri);
        const content = await response.text();
        Papa.parse(content, {
          header: true, skipEmptyLines: true,
          complete: (results) => {
            const parsed: SchedulePoint[] = [];
            results.data.forEach((row: any) => {
              const keys = Object.keys(row);
              const dKey = keys.find(k => k.toLowerCase().includes('date') || k.includes('日期'));
              const pKey = keys.find(k => k.toLowerCase().includes('progress') || k.includes('進度'));
              if (dKey && pKey && row[dKey]) {
                parsed.push({ date: row[dKey], progress: parseFloat(row[pKey]) || 0 });
              }
            });
            if (parsed.length > 0) {
              parsed.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
              if (id) {
                updateProject(id as string, { scheduleData: parsed });
                Alert.alert('成功', '預定進度已匯入並更新');
              }
            } else {
              Alert.alert('錯誤', '無法解析 CSV，請確保包含日期與進度欄位');
            }
          }
        });
      }
    } catch (e) { Alert.alert('錯誤', '匯入失敗'); }
  };

  const handleDelete = async () => {
    if (Platform.OS === 'web') {
      if (window.confirm('確定要刪除此專案嗎？此動作無法復原。')) {
        if (id) {
          try {
            await deleteProject(id as string);
            router.replace('/projects');
          } catch (e) { window.alert('刪除失敗'); }
        }
      }
    } else {
      Alert.alert('刪除專案', '確定要刪除此專案嗎？此動作無法復原。', [
        { text: '取消', style: 'cancel' },
        {
          text: '確定刪除', style: 'destructive', onPress: async () => {
            if (id) {
              try {
                await deleteProject(id as string);
                router.replace('/projects');
              } catch (e) { Alert.alert('錯誤', '刪除失敗'); }
            }
          }
        }
      ]);
    }
  };

  const handleSave = async () => {
    if (!id) return;
    let newTotal = parseFloat(editProject.contractAmount?.toString() || '0');
    if (editProject.changeDesigns && editProject.changeDesigns.length > 0) {
      newTotal = editProject.changeDesigns[editProject.changeDesigns.length - 1].newTotalAmount;
    }
    if (editProject.subsequentExpansions) {
      newTotal += editProject.subsequentExpansions.reduce((sum, s) => sum + (s.amount || 0), 0);
    }
    await updateProject(id as string, { ...editProject, currentContractAmount: newTotal });
    setEditModalVisible(false);
    Platform.OS === 'web' ? window.alert('已儲存') : Alert.alert('已儲存');
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
    else if (field === 'passed') setEditProject(prev => ({ ...prev, inspectionPassedDate: value }));
  };

  const openNativeDatePicker = (field: string) => {
    setDateFieldTarget(field);
    setTempDate(new Date());
    setShowDatePicker(true);
  };

  const onNativeDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selectedDate) {
      const str = selectedDate.toISOString().split('T')[0];
      handleDateChange(dateFieldTarget, str);
    }
  };

  const renderDateInput = (field: any, value: string, placeholder: string, customStyle?: any) => {
    if (Platform.OS === 'web') {
      return React.createElement('input', {
        type: 'date', value: value, onChange: (e: any) => handleDateChange(field, e.target.value),
        style: { padding: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 6, width: '100%', height: 40, ...customStyle }
      });
    }
    return (
      <TouchableOpacity style={[styles.dateBtn, customStyle]} onPress={() => openNativeDatePicker(field)}>
        <Text style={[styles.dateBtnText, !value && { color: '#999' }]}>{value || placeholder}</Text>
      </TouchableOpacity>
    );
  };

  const handleAddExtension = () => {
    if (!extForm.days) return;
    const newExt: Extension = { id: Math.random().toString(36).substr(2, 9), days: parseInt(extForm.days) || 0, date: extForm.date, docNumber: extForm.docNumber, reason: extForm.reason };
    setEditProject(prev => ({ ...prev, extensions: [...(prev.extensions || []), newExt] }));
    setExtForm({ days: '', date: '', docNumber: '', reason: '' });
  };
  const handleAddChangeDesign = () => {
    if (!cdForm.newTotalAmount) return;
    const newCd: ChangeDesign = { id: Math.random().toString(36).substr(2, 9), count: parseInt(cdForm.count) || 1, date: cdForm.date, docNumber: cdForm.docNumber, reason: cdForm.reason, newTotalAmount: parseCurrency(cdForm.newTotalAmount), type: 'set' };
    setEditProject(prev => ({ ...prev, changeDesigns: [...(prev.changeDesigns || []), newCd] }));
    setCdForm({ count: '1', date: '', docNumber: '', reason: '', newTotalAmount: '' });
    setShowCdCountPicker(false);
  };
  const handleAddSubsequent = () => {
    if (!seForm.amount) return;
    const newSe: SubsequentExpansion = { id: Math.random().toString(36).substr(2, 9), count: parseInt(seForm.count) || 1, date: seForm.date, docNumber: seForm.docNumber, reason: seForm.reason, amount: parseCurrency(seForm.amount) };
    setEditProject(prev => ({ ...prev, subsequentExpansions: [...(prev.subsequentExpansions || []), newSe] }));
    setSeForm({ count: '1', date: '', docNumber: '', reason: '', amount: '' });
    setShowSeCountPicker(false);
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
            const data: SchedulePoint[] = [];
            results.data.forEach((row: any) => {
              const k = Object.keys(row);
              const d = k.find(x => x.includes('date') || x.includes('日期'));
              const p = k.find(x => x.includes('progress') || x.includes('進度'));
              if (d && p) data.push({ date: row[d], progress: parseFloat(row[p]) || 0 });
            });
            if (data.length) setEditProject(prev => ({ ...prev, scheduleData: data }));
          }
        });
      }
    } catch (e) { Alert.alert('Error', 'Import failed'); }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
      if (!result.canceled && result.assets && result.assets[0]) setDocForm(prev => ({ ...prev, file: result.assets[0] }));
    } catch (err) { console.error('Pick document error:', err); }
  };

  const { uploadPhoto } = useLogs();

  const handleSaveDocument = async () => {
    if (!docForm.title || !docForm.file || !id || !project) return;
    setDocForm(prev => ({ ...prev, uploading: true }));
    try {
      const url = await uploadPhoto(docForm.file.uri);
      const fileType = docForm.file.mimeType?.includes('pdf') || docForm.file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image';
      const newDoc = { id: Math.random().toString(36).substr(2, 9), title: docForm.title, url, type: fileType, createdAt: new Date().toISOString() };
      await updateProject(id as string, { documents: [...(project.documents || []), newDoc] });
      setDocModalVisible(false);
      setDocForm({ title: '', file: null, uploading: false });
      Alert.alert('成功', '文件已上傳');
    } catch (err: any) { Alert.alert('失敗', err.message); }
    finally { setDocForm(prev => ({ ...prev, uploading: false })); }
  };

  const openDocument = (doc: any) => {
    import('expo-linking').then(Linking => { Linking.openURL(doc.url); });
  };

  if (!project) return null;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: '專案詳情', headerShown: false }} />
      <SafeAreaView style={styles.headerSafeArea}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
          <Text style={styles.headerTitle}>{project.name}</Text>
          <View style={{ flexDirection: 'row' }}>
            {user?.role === 'admin' && (
              <>
                <TouchableOpacity onPress={handleDelete} style={{ marginRight: 15 }}>
                  <Ionicons name="trash-outline" size={24} color="#FF6B6B" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleEditPress}>
                  <Ionicons name="create-outline" size={24} color="#fff" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
        <View style={styles.tabContainer}>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'progress' && styles.tabBtnActive]} onPress={() => setActiveTab('progress')}><Text style={[styles.tabText, activeTab === 'progress' && styles.tabTextActive]}>施工進度</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'info' && styles.tabBtnActive]} onPress={() => setActiveTab('info')}><Text style={[styles.tabText, activeTab === 'info' && styles.tabTextActive]}>專案資訊</Text></TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView style={styles.content}>
        {activeTab === 'progress' ? (
          <>
            <View style={{ marginTop: 15, paddingHorizontal: 15 }}>
              <Text style={styles.cardTitle}>專案狀態</Text>
            </View>
            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>剩餘工期</Text>
                <Text style={[styles.metricValue, projectMetrics.remainingDays < 0 && { color: THEME.danger }]}>
                  {projectMetrics.remainingDays} 天
                </Text>
              </View>

              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>預定進度</Text>
                <Text style={styles.metricValue}>{projectMetrics.plannedProgress}%</Text>
                <Text style={{ fontSize: 9, color: '#999', marginTop: 2 }}>({projectMetrics.todayStr})</Text>
              </View>

              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>實際進度</Text>
                <Text style={[
                  styles.metricValue,
                  !projectMetrics.hasTodayLog && { color: '#ff4d4f', fontSize: 13 }
                ]}>
                  {projectMetrics.actualDisplay}
                </Text>
                {projectMetrics.hasTodayLog && (
                  <Text style={{ fontSize: 9, color: '#999', marginTop: 2 }}>({projectMetrics.todayStr})</Text>
                )}
                {projectMetrics.diffElement}
              </View>

              <View style={[styles.metricItem, { borderRightWidth: 0, flex: 1.2 }]}>
                <Text style={styles.metricLabel}>執行狀態</Text>
                <View style={styles.statusBadgeSmall}>
                  <Text style={styles.statusTextSmall}>
                    {EXECUTION_STATUS_MAP[project.executionStatus || 'not_started']}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>專案進度 S-Curve</Text>
              {chartLabels.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <LineChart
                    data={{
                      labels: chartLabels.length > 6 ? chartLabels.filter((_, i) => i % Math.ceil(chartLabels.length / 6) === 0) : chartLabels,
                      datasets: [
                        { data: plannedData, color: () => `rgba(0, 0, 255, 1)`, strokeWidth: 2, withDots: false },
                        { data: actualData as number[], color: () => `rgba(255, 0, 0, 1)`, strokeWidth: 2, withDots: true }
                      ],
                      legend: ["預定", "實際"]
                    }}
                    width={Dimensions.get("window").width - 60} height={220} yAxisSuffix="%"
                    chartConfig={{ backgroundColor: "#ffffff", backgroundGradientFrom: "#ffffff", backgroundGradientTo: "#ffffff", decimalPlaces: 0, color: () => `rgba(0, 0, 0, 1)`, labelColor: () => `rgba(51, 51, 51, 1)`, style: { borderRadius: 16 }, propsForDots: { r: "4", strokeWidth: "2", stroke: "#ffa726" } }}
                    bezier style={{ marginVertical: 8, borderRadius: 16 }}
                  />
                </ScrollView>
              )}
              <View style={{ marginTop: 10, flexDirection: 'row', justifyContent: 'flex-end' }}>
                <TouchableOpacity onPress={handleImportPlannedCSV} style={styles.smallBtn}><Ionicons name="cloud-upload-outline" size={16} color="#fff" /><Text style={{ color: '#fff', marginLeft: 5, fontSize: 12 }}>匯入預定進度</Text></TouchableOpacity>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>重要日期</Text>
              <View style={styles.rowBetween}><Text style={styles.dateLabel}>開工日:</Text><Text style={styles.dateVal}>{project.startDate || '-'}</Text></View>
              <View style={[styles.rowBetween, { backgroundColor: '#E3F2FD', padding: 5, borderRadius: 4, marginVertical: 5 }]}><Text style={{ color: '#002147', fontWeight: 'bold' }}>預定竣工日:</Text><Text style={{ color: '#002147', fontWeight: 'bold' }}>{plannedCompletionDate}</Text></View>
              <View style={styles.rowBetween}><Text style={styles.dateLabel}>實際竣工日:</Text><Text style={styles.dateVal}>{project.actualCompletionDate || '-'}</Text></View>
              <View style={styles.divider} />
              <View style={styles.rowBetween}><Text style={styles.dateLabel}>驗收日期:</Text><Text style={styles.dateVal}>{project.inspectionDate || '-'}</Text></View>
              <View style={styles.rowBetween}><Text style={styles.dateLabel}>驗收合格:</Text><Text style={styles.dateVal}>{project.inspectionPassedDate || '-'}</Text></View>
            </View>

            <Text style={[styles.cardTitle, { margin: 15 }]}>施工日誌 ({projectLogs.length})</Text>
            {projectLogs.map(log => {
              const pendingCount = (log.issues || []).filter((i: any) => i.status === 'pending').length;
              return (
                <TouchableOpacity key={log.id} style={styles.logCard} onPress={() => router.push('/logs')}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ fontWeight: 'bold' }}>{log.date}</Text>
                      {pendingCount > 0 && <View style={styles.issueBadge}><Text style={styles.issueText}>⚠️ 待處理: {pendingCount}</Text></View>}
                    </View>
                  </View>
                  <Text numberOfLines={2} style={{ color: '#444', marginTop: 5 }}>{log.content}</Text>
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 50 }} />
          </>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>專案詳情</Text>
              <View style={styles.infoRow}><Ionicons name="location-outline" size={18} color="#666" /><Text style={styles.infoText}>{project.address || '-'}</Text></View>
              <View style={styles.infoRow}><Ionicons name="person-outline" size={18} color="#666" /><Text style={styles.infoText}>主任: {project.manager || '-'}</Text></View>
              {project.description && <Text style={styles.descriptionText}>{project.description}</Text>}
              <View style={styles.divider} />
              <View style={styles.infoRow}><Text style={styles.labelCol}>原始總價:</Text><Text style={styles.valCol}>${formatCurrency(project.contractAmount)}</Text></View>
              <View style={styles.infoRow}><Text style={styles.labelCol}>變更後總價:</Text><Text style={styles.valCol}>${formatCurrency(currentTotalAmount)}</Text></View>
              <View style={styles.infoRow}><Text style={styles.labelCol}>決標日期:</Text><Text style={styles.valCol}>{project.awardDate || '-'}</Text></View>
            </View>
            <View style={styles.card}>
              <View style={styles.rowBetween}><Text style={styles.cardTitle}>📂 契約與施工圖說</Text>{user?.role === 'admin' && <TouchableOpacity style={styles.addSmallBtn} onPress={() => setDocModalVisible(true)}><Ionicons name="cloud-upload" size={16} color="#fff" /><Text style={{ color: '#fff', marginLeft: 4, fontWeight: 'bold' }}>上傳</Text></TouchableOpacity>}</View>
              <View style={{ marginTop: 15 }}>{(project.documents || []).length === 0 ? <Text style={{ color: '#999', textAlign: 'center', padding: 20 }}>尚無上傳文件</Text> : project.documents?.map(doc => <TouchableOpacity key={doc.id} style={styles.docItem} onPress={() => openDocument(doc)}><View style={styles.docIcon}><Ionicons name={doc.type === 'pdf' ? 'document-text' : 'image'} size={24} color={doc.type === 'pdf' ? '#FF4D4F' : '#1890FF'} /></View><View style={{ flex: 1 }}><Text style={styles.docTitle} numberOfLines={1}>{doc.title}</Text><Text style={styles.docMeta}>{doc.createdAt?.split('T')[0]} · {doc.type.toUpperCase()}</Text></View><Ionicons name="chevron-forward" size={18} color="#ccc" /></TouchableOpacity>)}</View>
            </View>
            <View style={{ height: 50 }} />
          </>
        )}
      </ScrollView>

      <Modal visible={isDocModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.docModalContent}>
            <View style={styles.modalHeader}>
              <Text style={{ fontSize: 18, fontWeight: 'bold' }}>上傳文件與圖說</Text>
              <TouchableOpacity onPress={() => setDocModalVisible(false)}>
                <Ionicons name="close" size={26} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 20 }}>
              <Text style={styles.label}>文件名稱</Text>
              <TextInput
                style={styles.input}
                placeholder="例如：施工契約、結構圖..."
                value={docForm.title}
                onChangeText={t => setDocForm({ ...docForm, title: t })}
              />
              <TouchableOpacity style={styles.filePickerBtn} onPress={handlePickDocument}>
                <Ionicons
                  name={docForm.file ? "checkmark-circle" : "document-attach-outline"}
                  size={22}
                  color={docForm.file ? "#52c41a" : "#666"}
                />
                <Text style={{ marginLeft: 10, color: '#333' }}>
                  {docForm.file ? docForm.file.name : "選取檔案 (圖片或 PDF)"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtnFull, (docForm.uploading || !docForm.file) && { backgroundColor: '#ccc' }]}
                onPress={handleSaveDocument}
                disabled={docForm.uploading || !docForm.file}
              >
                {docForm.uploading ? (
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>上傳中...</Text>
                ) : (
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>確認上傳</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isEditModalVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>編輯專案</Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={{ color: THEME.primary, fontWeight: 'bold', fontSize: 16 }}>儲存</Text>
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView style={{ flex: 1, padding: 20 }}>
              <Text style={styles.label}>專案名稱</Text>
              <TextInput
                style={styles.input}
                value={editProject.name}
                onChangeText={t => setEditProject({ ...editProject, name: t })}
              />
              <Text style={styles.label}>專案地址</Text>
              <TextInput
                style={styles.input}
                value={editProject.address}
                onChangeText={t => setEditProject({ ...editProject, address: t })}
              />
              <View style={[styles.row, { zIndex: 3000 }]}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.label}>工地主任</Text>
                  <TouchableOpacity style={styles.dropdownBtn} onPress={() => setShowManagerPicker(!showManagerPicker)}>
                    <Text>{editProject.manager || '請選擇'}</Text>
                    <Ionicons name="chevron-down" size={20} />
                  </TouchableOpacity>
                  {showManagerPicker && (
                    <View style={styles.dropdownList}>
                      {managers.map(m => (
                        <TouchableOpacity
                          key={m}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setEditProject({ ...editProject, manager: m });
                            setShowManagerPicker(false)
                          }}
                        >
                          <Text>{m}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>執行狀態</Text>
                  <TouchableOpacity style={styles.dropdownBtn} onPress={() => setShowStatusPicker(!showStatusPicker)}>
                    <Text>{EXECUTION_STATUS_MAP[editProject.executionStatus || 'not_started']}</Text>
                    <Ionicons name="chevron-down" size={20} />
                  </TouchableOpacity>
                  {showStatusPicker && (
                    <View style={styles.dropdownList}>
                      {EXECUTION_STATUS_OPTIONS.map(s => (
                        <TouchableOpacity
                          key={s}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setEditProject({ ...editProject, executionStatus: s as any });
                            setShowStatusPicker(false)
                          }}
                        >
                          <Text>{EXECUTION_STATUS_MAP[s]}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </View>
              <Text style={styles.groupHeader}>時程</Text>
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 5 }}>
                  <Text style={styles.label}>決標日期</Text>
                  {renderDateInput('award', editProject.awardDate || '', '日期')}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>開工日期</Text>
                  {renderDateInput('start', editProject.startDate || '', '日期')}
                </View>
              </View>
              <Text style={styles.label}>契約工期 (天)</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={editProject.contractDuration?.toString()}
                onChangeText={t => setEditProject({ ...editProject, contractDuration: parseInt(t) || 0 })}
              />
              <View style={{ height: 50 }} />
              {user?.role === 'admin' && (
                <TouchableOpacity onPress={handleDelete} style={styles.deleteBtnFull}>
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>刪除此專案</Text>
                </TouchableOpacity>
              )}
              <View style={{ height: 30 }} />
            </ScrollView>
          </KeyboardAvoidingView>
          {showDatePicker && Platform.OS !== 'web' && (
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
  card: { backgroundColor: '#fff', marginHorizontal: 15, marginTop: 15, padding: 15, borderRadius: 12 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12, color: '#002147' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: { backgroundColor: '#E3F2FD', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  statusText: { color: '#002147', fontSize: 12, fontWeight: 'bold' },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  infoText: { marginLeft: 8, color: '#333', fontSize: 14 },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 10 },
  labelCol: { flex: 1, color: '#666' },
  valCol: { flex: 1, textAlign: 'right', fontWeight: '500' },
  dateLabel: { color: '#666' },
  dateVal: { fontWeight: '500' },
  logItem: { borderLeftWidth: 3, borderLeftColor: '#eee', paddingLeft: 10, marginBottom: 12 },
  logCard: { backgroundColor: '#fff', marginHorizontal: 15, marginBottom: 10, padding: 15, borderRadius: 8, elevation: 1 },
  issueBadge: { backgroundColor: '#FFE5E5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8, borderWidth: 1, borderColor: '#FF4D4F' },
  issueText: { color: '#FF4D4F', fontSize: 10, fontWeight: 'bold' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center' },
  label: { fontWeight: 'bold', color: '#666', marginTop: 15, marginBottom: 5 },
  input: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 },
  row: { flexDirection: 'row' },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  dropdownBtn: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdownList: { position: 'absolute', top: 45, left: 0, right: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, elevation: 5, zIndex: 9999 },
  dropdownItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  groupHeader: { fontSize: 13, color: '#999', backgroundColor: '#f0f0f0', padding: 5, marginTop: 20, fontWeight: 'bold' },
  deleteBtnFull: { backgroundColor: '#FF6B6B', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  dateBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 10 },
  dateBtnText: { color: '#333' },
  smallBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  tabContainer: { flexDirection: 'row', backgroundColor: THEME.headerBg, paddingHorizontal: 15, paddingBottom: 10 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: THEME.primary },
  tabText: { color: 'rgba(255,255,255,0.6)', fontWeight: 'bold', fontSize: 15 },
  tabTextActive: { color: '#fff' },
  descriptionText: { color: '#555', lineHeight: 20, marginTop: 10, fontSize: 14 },
  addSmallBtn: { backgroundColor: THEME.primary, flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  docItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FB', padding: 12, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
  docIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 12, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  docTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  docMeta: { fontSize: 12, color: '#999', marginTop: 2 },
  filePickerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F7FA', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', borderStyle: 'dashed', marginVertical: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  docModalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, minHeight: '40%', paddingBottom: 40 },
  submitBtnFull: { backgroundColor: THEME.primary, paddingVertical: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  metricsRow: { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 15, marginTop: 15, borderRadius: 12, paddingVertical: 15, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  metricItem: { flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: '#eee' },
  metricLabel: { fontSize: 10, color: '#999', marginBottom: 4, fontWeight: '600' },
  metricValue: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  statusBadgeSmall: { backgroundColor: '#E3F2FD', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusTextSmall: { color: '#002147', fontSize: 10, fontWeight: 'bold' }
});