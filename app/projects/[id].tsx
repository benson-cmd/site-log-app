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
  // S-Curve States
  const [plannedData, setPlannedData] = useState<number[]>([0]);
  const [actualData, setActualData] = useState<(number | null)[]>([0]);
  const [chartLabels, setChartLabels] = useState<string[]>(['Start']);

  // Computed Schedule Data (Source of Truth for Chart)
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

  // Handler: Edit Button (Fix Empty Form Issue)
  const handleEditPress = () => {
    if (project) {
      setEditProject({
        name: project.name || '',
        address: project.address || '',
        manager: project.manager || '',
        status: project.status || 'construction',
        startDate: project.startDate || '',
        contractAmount: project.contractAmount || 0,
        contractDuration: project.contractDuration || 0,
      });
    }
    setEditModalVisible(true);
  };

  useEffect(() => {
    if (project) {
      // [輔助工具] 統一轉 Timestamp，無視斜線或橫線差異
      const toTs = (d: any) => {
        if (!d) return 0;
        const str = typeof d === 'string' ? d.replace(/\//g, '-') : d.toISOString();
        return new Date(str).getTime();
      };

      const startTs = toTs(project.startDate);
      const endTs = toTs(plannedCompletionDate);

      // 取得「現在」的時間戳記
      const nowTs = new Date().getTime();

      // 1. 建立 X 軸座標 (固定 6 等分，提高解析度)
      const points = [];
      const totalDuration = endTs - startTs;
      const steps = 6;
      for (let i = 0; i <= steps; i++) {
        // 強制最後一點一定是 End Date (對齊 100%)
        if (i === steps) points.push(endTs);
        else points.push(startTs + (totalDuration * (i / steps)));
      }

      // 更新 Labels (MM/DD)
      const labelsStr = points.map(ts => {
        const d = new Date(ts);
        return `${d.getMonth() + 1}/${d.getDate()}`;
      });
      setChartLabels(labelsStr);

      // 2. 計算實際進度 (Red Line)
      if (projectLogs && projectLogs.length > 0) {
        // (A) 整理 Logs：全部轉成 { timestamp, value } 並依照日期排序
        const cleanLogs = projectLogs.map(l => ({
          ts: toTs(l.date),
          val: parseFloat((l as any).actualProgress || 0)
        })).sort((a, b) => a.ts - b.ts); // 由舊到新

        // (B) 對應圖表上的每個點
        const mappedData = points.map(pointTs => {
          // ⚠️ 關鍵修正：如果是未來時間 (比現在還晚)，回傳 null
          if (pointTs > nowTs) {
            return null;
          }

          // 核心邏輯：找出 "發生時間 <= 圖表時間點" 的最後一筆紀錄 (Carry Forward)
          const validLogs = cleanLogs.filter(l => l.ts <= pointTs);

          if (validLogs.length > 0) {
            return validLogs[validLogs.length - 1].val; // 取最新的一筆
          }
          return 0; // 該時間點前無紀錄
        });

        // 避免全 null 導致錯誤，若有資料則設定，否則初始為 [0]
        const hasData = mappedData.some(d => d !== null);
        setActualData(hasData ? mappedData : [0]);
      } else {
        setActualData([0]);
      }

      // 3. 計算預定進度 (Blue Line) - 採用相同歸一化邏輯
      if (project.scheduleData && project.scheduleData.length > 0) {
        const sortedSchedule = [...project.scheduleData].sort((a, b) => toTs(a.date) - toTs(b.date));
        const newPlannedData = points.map(pointTs => {
          const valid = sortedSchedule.filter(s => toTs(s.date) <= pointTs);
          if (valid.length > 0) {
            return valid[valid.length - 1].progress;
          }
          return 0;
        });
        setPlannedData(newPlannedData);
      } else {
        // 若無資料，則線性 0-100 (確保最後一點是 100)
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
              // Flexible key matching
              const keys = Object.keys(row);
              const dKey = keys.find(k => k.toLowerCase().includes('date') || k.includes('日期'));
              const pKey = keys.find(k => k.toLowerCase().includes('progress') || k.includes('進度'));

              if (dKey && pKey && row[dKey]) {
                parsed.push({
                  date: row[dKey],
                  progress: parseFloat(row[pKey]) || 0
                });
              }
            });

            if (parsed.length > 0) {
              parsed.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

              // Update Project State (to save)
              // We should probably save this to the project via updateProject
              // But for now, user asked to "Import... and Display". 
              // Ideally we save it so it persists.
              // I'll update the 'editProject' state if modal is open, or just local state?
              // User said "Import button allows uploading... Parsed data will be Planned Progress Curve".
              // Better to persist it. I will call updateProject silently or ask user to save?
              // Let's just update the local chart view first, but logically it should replace project.scheduleData

              // Let's auto-save or prompt? 
              // Re-using the logic from Edit Modal seems complex here since we are in Detail View.
              // I will just update the chart state and trigger an update to DB.

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
    } catch (e) {
      Alert.alert('錯誤', '匯入失敗');
    }
  };

  // --- Calculations ---




  // --- Handlers ---

  const handleDelete = async () => {
    if (Platform.OS === 'web') {
      const confirm = window.confirm('確定要刪除此專案嗎？此動作無法復原。');
      if (confirm) {
        if (id) {
          try {
            console.log('正在刪除專案 ID:', id);
            await deleteProject(id as string);
            window.alert('專案已刪除');
            router.replace('/projects');
          } catch (e) {
            window.alert('刪除失敗');
            console.error(e);
          }
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
                Alert.alert('成功', '專案已刪除', [{ text: 'OK', onPress: () => router.replace('/projects') }]);
              } catch (e) {
                Alert.alert('錯誤', '刪除失敗');
              }
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

    await updateProject(id as string, {
      ...editProject,
      currentContractAmount: newTotal
    });
    setEditModalVisible(false);
    Platform.OS === 'web' ? window.alert('已儲存：專案資料已更新') : Alert.alert('已儲存', '專案資料已更新');
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
        type: 'date',
        value: value,
        onChange: (e: any) => handleDateChange(field, e.target.value),
        style: {
          padding: 8, backgroundColor: '#fff',
          borderWidth: 1, borderColor: '#ddd', borderRadius: 6,
          width: '100%', height: 40, boxSizing: 'border-box',
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

  const handleAddExtension = () => {
    if (!extForm.days) return;
    const newExt: Extension = {
      id: Math.random().toString(36).substr(2, 9),
      days: parseInt(extForm.days) || 0, date: extForm.date, docNumber: extForm.docNumber, reason: extForm.reason
    };
    setEditProject(prev => ({ ...prev, extensions: [...(prev.extensions || []), newExt] }));
    setExtForm({ days: '', date: '', docNumber: '', reason: '' });
  };
  const handleAddChangeDesign = () => {
    if (!cdForm.newTotalAmount) return;
    const newCd: ChangeDesign = {
      id: Math.random().toString(36).substr(2, 9),
      count: parseInt(cdForm.count) || 1, date: cdForm.date, docNumber: cdForm.docNumber, reason: cdForm.reason, newTotalAmount: parseCurrency(cdForm.newTotalAmount), type: 'set'
    };
    setEditProject(prev => ({ ...prev, changeDesigns: [...(prev.changeDesigns || []), newCd] }));
    setCdForm({ count: '1', date: '', docNumber: '', reason: '', newTotalAmount: '' });
    setShowCdCountPicker(false);
  };
  const handleAddSubsequent = () => {
    if (!seForm.amount) return;
    const newSe: SubsequentExpansion = {
      id: Math.random().toString(36).substr(2, 9),
      count: parseInt(seForm.count) || 1, date: seForm.date, docNumber: seForm.docNumber, reason: seForm.reason, amount: parseCurrency(seForm.amount)
    };
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

  if (!project) return null;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: '專案詳情', headerShown: false }} />
      {/* Header */}
      <SafeAreaView style={styles.headerSafeArea}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
          <Text style={styles.headerTitle}>{project.name}</Text>
          <View style={{ flexDirection: 'row' }}>
            {user?.role === 'admin' && (
              <>
                <TouchableOpacity onPress={handleDelete} style={{ marginRight: 15 }}><Ionicons name="trash-outline" size={24} color="#FF6B6B" /></TouchableOpacity>
                <TouchableOpacity onPress={handleEditPress}><Ionicons name="create-outline" size={24} color="#fff" /></TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView style={styles.content}>

        {/* Basic Info Card - PRECISE ALIGNMENT */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>基本資訊</Text>
            <View style={[styles.statusBadge, { zIndex: 1 }]}><Text style={styles.statusText}>{EXECUTION_STATUS_MAP[project.executionStatus || 'not_started']}</Text></View>
          </View>

          <View style={styles.infoRow}><Ionicons name="location-outline" size={18} color="#666" /><Text style={styles.infoText}>{project.address || '-'}</Text></View>
          <View style={styles.infoRow}><Ionicons name="person-outline" size={18} color="#666" /><Text style={styles.infoText}>主任: {project.manager || '-'}</Text></View>
          <View style={styles.divider} />

          <View style={styles.infoRow}><Text style={styles.labelCol}>契約工期:</Text><Text style={styles.valCol}>{project.contractDuration} 天</Text></View>
          <View style={styles.infoRow}><Text style={styles.labelCol}>累計展延工期:</Text><Text style={styles.valCol}>{totalExtensionDays} 天</Text></View>
          <View style={styles.divider} />

          <View style={styles.infoRow}><Text style={styles.labelCol}>原始總價:</Text><Text style={styles.valCol}>${formatCurrency(project.contractAmount)}</Text></View>
          <View style={styles.infoRow}><Text style={[styles.labelCol, { color: THEME.primary, fontWeight: 'bold' }]}>變更(擴充)後總價:</Text><Text style={[styles.valCol, { color: THEME.primary, fontWeight: 'bold' }]}>${formatCurrency(currentTotalAmount)}</Text></View>
        </View>

        {/* S-Curve Chart */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>專案進度 S-Curve</Text>
          {chartLabels.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <LineChart
                data={{
                  labels: chartLabels.length > 6 ?
                    chartLabels.filter((_, i) => i % Math.ceil(chartLabels.length / 6) === 0) :
                    chartLabels,
                  datasets: [
                    {
                      data: plannedData,
                      color: (opacity = 1) => `rgba(0, 0, 255, ${opacity})`, // Blue (Planned)
                      strokeWidth: 2,
                      withDots: false,
                    },
                    {
                      data: actualData as number[], // Cast to allow nulls (library supports it, typings might be strict)
                      color: (opacity = 1) => `rgba(255, 0, 0, ${opacity})`, // Red (Actual)
                      strokeWidth: 2,
                      withDots: true,
                    }
                  ],
                  legend: ["預定", "實際"]
                }}
                width={Dimensions.get("window").width - 60} // Adjust width freely
                height={220}
                yAxisSuffix="%"
                chartConfig={{
                  backgroundColor: "#ffffff",
                  backgroundGradientFrom: "#ffffff",
                  backgroundGradientTo: "#ffffff",
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(51, 51, 51, ${opacity})`,
                  style: { borderRadius: 16 },
                  propsForDots: { r: "4", strokeWidth: "2", stroke: "#ffa726" }
                }}
                bezier
                style={{ marginVertical: 8, borderRadius: 16 }}
              />
            </ScrollView>
          )}

          <View style={{ marginTop: 10, flexDirection: 'row', justifyContent: 'flex-end' }}>
            <TouchableOpacity onPress={handleImportPlannedCSV} style={styles.smallBtn}>
              <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
              <Text style={{ color: '#fff', marginLeft: 5, fontSize: 12 }}>匯入預定進度</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Important Dates Card - PRECISE ALIGNMENT */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>重要日期</Text>
          <View style={styles.rowBetween}><Text style={styles.dateLabel}>決標日期:</Text><Text style={styles.dateVal}>{project.awardDate || '-'}</Text></View>
          <View style={styles.rowBetween}><Text style={styles.dateLabel}>開工日:</Text><Text style={styles.dateVal}>{project.startDate || '-'}</Text></View>
          <View style={[styles.rowBetween, { backgroundColor: '#E3F2FD', padding: 5, borderRadius: 4, marginVertical: 5 }]}><Text style={{ color: '#002147', fontWeight: 'bold' }}>預定竣工日:</Text><Text style={{ color: '#002147', fontWeight: 'bold' }}>{plannedCompletionDate}</Text></View>
          <View style={styles.rowBetween}><Text style={styles.dateLabel}>實際竣工日:</Text><Text style={styles.dateVal}>{project.actualCompletionDate || '-'}</Text></View>
          <View style={styles.divider} />
          <View style={styles.rowBetween}><Text style={styles.dateLabel}>驗收日期:</Text><Text style={styles.dateVal}>{project.inspectionDate || '-'}</Text></View>
          <View style={styles.rowBetween}><Text style={styles.dateLabel}>驗收合格:</Text><Text style={styles.dateVal}>{project.inspectionPassedDate || '-'}</Text></View>
        </View>

        {/* Extensions List */}
        {project.extensions && project.extensions.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>展延記錄</Text>
            {project.extensions.map((ext, i) => (
              <View key={i} style={styles.logItem}>
                <Text style={{ fontWeight: 'bold' }}>{ext.date} (文號: {ext.docNumber})</Text>
                <Text>理由: {ext.reason}</Text>
                <Text style={{ color: THEME.primary, fontWeight: 'bold', marginTop: 2 }}>+ {ext.days} 天</Text>
              </View>
            ))}
          </View>
        )}

        {/* Change Designs */}
        {(project.changeDesigns?.length || 0) > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>變更設計</Text>
            {project.changeDesigns?.map((cd, i) => (
              <View key={i} style={styles.logItem}>
                <Text style={{ fontWeight: 'bold' }}>第{cd.count}次 ({cd.date})</Text>
                <Text>新總價: ${formatCurrency(cd.newTotalAmount)}</Text>
                <Text style={{ color: '#666' }}>{cd.reason}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Expansions */}
        {(project.subsequentExpansions?.length || 0) > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>後續擴充</Text>
            {project.subsequentExpansions?.map((se, i) => (
              <View key={i} style={styles.logItem}>
                <Text style={{ fontWeight: 'bold' }}>擴充{se.count} ({se.date})</Text>
                <Text>追加: +${formatCurrency(se.amount)}</Text>
                <Text style={{ color: '#666' }}>{se.reason}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Logs */}
        <Text style={[styles.cardTitle, { margin: 15 }]}>施工日誌 ({projectLogs.length})</Text>
        {projectLogs.map(log => (
          <TouchableOpacity key={log.id} style={styles.logCard} onPress={() => router.push('/logs')}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: 'bold' }}>{log.date}</Text>
              {/* <Text style={{ fontSize: 12, color: '#999' }}>進度: {log.todayProgress || '-'}%</Text> */}
            </View>
            <Text numberOfLines={2} style={{ color: '#444', marginTop: 5 }}>{log.content}</Text>
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
              {/* Basic Fields */}
              <Text style={styles.label}>專案名稱</Text>
              <TextInput style={styles.input} value={editProject.name} onChangeText={t => setEditProject({ ...editProject, name: t })} />
              <Text style={styles.label}>專案地址</Text>
              <TextInput style={styles.input} value={editProject.address} onChangeText={t => setEditProject({ ...editProject, address: t })} />

              {/* Dropdowns */}
              <View style={[styles.row, { zIndex: 3000 }]}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.label}>工地主任</Text>
                  <TouchableOpacity style={styles.dropdownBtn} onPress={() => setShowManagerPicker(!showManagerPicker)}>
                    <Text>{editProject.manager || '請選擇'}</Text><Ionicons name="chevron-down" size={20} />
                  </TouchableOpacity>
                  {showManagerPicker && (
                    <View style={styles.dropdownList}>
                      {managers.map(m => <TouchableOpacity key={m} style={styles.dropdownItem} onPress={() => { setEditProject({ ...editProject, manager: m }); setShowManagerPicker(false) }}><Text>{m}</Text></TouchableOpacity>)}
                    </View>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>執行狀態</Text>
                  <TouchableOpacity style={styles.dropdownBtn} onPress={() => setShowStatusPicker(!showStatusPicker)}>
                    <Text>{EXECUTION_STATUS_MAP[editProject.executionStatus || 'not_started']}</Text><Ionicons name="chevron-down" size={20} />
                  </TouchableOpacity>
                  {showStatusPicker && (
                    <View style={styles.dropdownList}>
                      {EXECUTION_STATUS_OPTIONS.map(s => <TouchableOpacity key={s} style={styles.dropdownItem} onPress={() => { setEditProject({ ...editProject, executionStatus: s as any }); setShowStatusPicker(false) }}><Text>{EXECUTION_STATUS_MAP[s]}</Text></TouchableOpacity>)}
                    </View>
                  )}
                </View>
              </View>

              {/* Schedule */}
              <Text style={styles.groupHeader}>時程</Text>
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 5 }}><Text style={styles.label}>決標日期</Text>{renderDateInput('award', editProject.awardDate || '', '日期')}</View>
                <View style={{ flex: 1 }}><Text style={styles.label}>開工日期</Text>{renderDateInput('start', editProject.startDate || '', '日期')}</View>
              </View>
              <Text style={styles.label}>契約工期 (天)</Text>
              <TextInput style={styles.input} keyboardType="number-pad" value={editProject.contractDuration?.toString()} onChangeText={t => setEditProject({ ...editProject, contractDuration: parseInt(t) || 0 })} />

              <View style={styles.rowCenter}>
                <Text style={styles.label}>進度表 (CSV)</Text>
                <TouchableOpacity onPress={handleImportSchedule} style={{ marginLeft: 10 }}><Text style={{ color: THEME.primary }}>匯入</Text></TouchableOpacity>
              </View>

              {/* Extensions */}
              <Text style={styles.sectionTitle}>展延工期明細</Text>
              {editProject.extensions?.map((ext, idx) => (
                <View key={ext.id} style={styles.editItem}>
                  <Text>{idx + 1}. {ext.date} ({ext.days}天)</Text>
                  <TouchableOpacity onPress={() => setEditProject(p => ({ ...p, extensions: p.extensions?.filter(e => e.id !== ext.id) }))}><Ionicons name="trash" size={18} color="red" /></TouchableOpacity>
                </View>
              ))}
              <View style={styles.addBox}>
                <View style={styles.row}>
                  <TextInput style={[styles.miniInput, { flex: 1 }]} placeholder="天數" value={extForm.days} onChangeText={t => setExtForm({ ...extForm, days: t })} keyboardType="number-pad" />
                  <View style={{ flex: 2, marginLeft: 5 }}>{renderDateInput('extension', extForm.date, '公文日期')}</View>
                </View>
                <TextInput style={styles.miniInput} placeholder="文號" value={extForm.docNumber} onChangeText={t => setExtForm({ ...extForm, docNumber: t })} />
                <TextInput style={[styles.miniInput, { minHeight: 40 }]} placeholder="理由" multiline value={extForm.reason} onChangeText={t => setExtForm({ ...extForm, reason: t })} />
                <TouchableOpacity onPress={handleAddExtension} style={styles.addBtn}><Text style={{ color: '#fff' }}>加入</Text></TouchableOpacity>
              </View>

              {/* Financials */}
              <Text style={styles.groupHeader}>金額</Text>
              <Text style={styles.label}>契約原金</Text>
              <TextInput style={styles.input} value={formatCurrency(editProject.contractAmount)} onChangeText={t => setEditProject({ ...editProject, contractAmount: parseCurrency(t) })} keyboardType="number-pad" />

              {/* Change Designs */}
              <Text style={styles.sectionTitle}>變更設計</Text>
              {editProject.changeDesigns?.map(cd => (
                <View key={cd.id} style={styles.editItem}>
                  <Text>#{cd.count} {cd.date} ${formatCurrency(cd.newTotalAmount)}</Text>
                  <TouchableOpacity onPress={() => setEditProject(p => ({ ...p, changeDesigns: p.changeDesigns?.filter(c => c.id !== cd.id) }))}><Ionicons name="trash" size={18} color="red" /></TouchableOpacity>
                </View>
              ))}
              <View style={styles.addBox}>
                <View style={styles.row}>
                  <TouchableOpacity style={[styles.miniInput, { width: 60, justifyContent: 'center' }]} onPress={() => setShowCdCountPicker(!showCdCountPicker)}><Text>{cdForm.count} <Ionicons name="chevron-down" size={12} /></Text></TouchableOpacity>
                  {showCdCountPicker && <View style={styles.dropdownListMini}>{COUNT_OPTIONS.map(c => <TouchableOpacity key={c} onPress={() => { setCdForm({ ...cdForm, count: c }); setShowCdCountPicker(false) }} style={{ padding: 8 }}><Text>{c}</Text></TouchableOpacity>)}</View>}
                  <View style={{ flex: 1, marginLeft: 5 }}>{renderDateInput('changeDesign', cdForm.date, '日期')}</View>
                </View>
                <TextInput style={styles.miniInput} placeholder="新總價" value={formatCurrency(cdForm.newTotalAmount)} onChangeText={t => setCdForm({ ...cdForm, newTotalAmount: parseCurrency(t).toString() })} keyboardType="number-pad" />
                <TextInput style={styles.miniInput} placeholder="文號" value={cdForm.docNumber} onChangeText={t => setCdForm({ ...cdForm, docNumber: t })} />
                <TextInput style={[styles.miniInput, { minHeight: 40 }]} placeholder="事由" multiline value={cdForm.reason} onChangeText={t => setCdForm({ ...cdForm, reason: t })} />
                <TouchableOpacity onPress={handleAddChangeDesign} style={styles.addBtn}><Text style={{ color: '#fff' }}>加入</Text></TouchableOpacity>
              </View>

              {/* Expansions */}
              <Text style={styles.sectionTitle}>後續擴充</Text>
              {editProject.subsequentExpansions?.map(se => (
                <View key={se.id} style={styles.editItem}>
                  <Text>#{se.count} {se.date} +${formatCurrency(se.amount)}</Text>
                  <TouchableOpacity onPress={() => setEditProject(p => ({ ...p, subsequentExpansions: p.subsequentExpansions?.filter(s => s.id !== se.id) }))}><Ionicons name="trash" size={18} color="red" /></TouchableOpacity>
                </View>
              ))}
              <View style={styles.addBox}>
                <View style={styles.row}>
                  <TouchableOpacity style={[styles.miniInput, { width: 60, justifyContent: 'center' }]} onPress={() => setShowSeCountPicker(!showSeCountPicker)}><Text>{seForm.count} <Ionicons name="chevron-down" size={12} /></Text></TouchableOpacity>
                  {showSeCountPicker && <View style={styles.dropdownListMini}>{EXPANSION_COUNT_OPTIONS.map(c => <TouchableOpacity key={c} onPress={() => { setSeForm({ ...seForm, count: c }); setShowSeCountPicker(false) }} style={{ padding: 8 }}><Text>{c}</Text></TouchableOpacity>)}</View>}
                  <View style={{ flex: 1, marginLeft: 5 }}>{renderDateInput('subsequentExpansion', seForm.date, '日期')}</View>
                </View>
                <TextInput style={styles.miniInput} placeholder="追加金額" value={formatCurrency(seForm.amount)} onChangeText={t => setSeForm({ ...seForm, amount: parseCurrency(t).toString() })} keyboardType="number-pad" />
                <TextInput style={styles.miniInput} placeholder="文號" value={seForm.docNumber} onChangeText={t => setSeForm({ ...seForm, docNumber: t })} />
                <TextInput style={[styles.miniInput, { minHeight: 40 }]} placeholder="事由" multiline value={seForm.reason} onChangeText={t => setSeForm({ ...seForm, reason: t })} />
                <TouchableOpacity onPress={handleAddSubsequent} style={styles.addBtn}><Text style={{ color: '#fff' }}>加入</Text></TouchableOpacity>
              </View>

              {/* Inspection Dates */}
              <Text style={styles.groupHeader}>驗收日期</Text>
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 5 }}>
                  <Text style={styles.label}>驗收日期</Text>
                  {renderDateInput('inspection', editProject.inspectionDate || '', '日期')}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>複驗日期</Text>
                  {renderDateInput('reinspection', editProject.reinspectionDate || '', '日期')}
                </View>
              </View>
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 5 }}>
                  <Text style={styles.label}>驗收合格</Text>
                  {renderDateInput('passed', editProject.inspectionPassedDate || '', '日期')}
                </View>
              </View>

              <View style={{ height: 50 }} />
              {user?.role === 'admin' && (
                <TouchableOpacity onPress={handleDelete} style={styles.deleteBtnFull}>
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>刪除此專案</Text>
                </TouchableOpacity>
              )}
              <View style={{ height: 30 }} />

            </ScrollView>
          </KeyboardAvoidingView>

          {/* Native Picker Modal */}
          {showDatePicker && Platform.OS !== 'web' && (<DateTimePicker value={tempDate} mode="date" display="default" onChange={onNativeDateChange} />)}
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
  // Cards
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
  // Modal
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center' },
  label: { fontWeight: 'bold', color: '#666', marginTop: 15, marginBottom: 5 },
  input: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 },
  row: { flexDirection: 'row' },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  dropdownBtn: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdownList: { position: 'absolute', top: 45, left: 0, right: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, elevation: 5, zIndex: 9999 },
  dropdownListMini: { position: 'absolute', top: 35, left: 0, width: 60, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', zIndex: 9999 },
  dropdownItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  groupHeader: { fontSize: 13, color: '#999', backgroundColor: '#f0f0f0', padding: 5, marginTop: 20, fontWeight: 'bold' },
  sectionTitle: { marginTop: 20, fontSize: 14, fontWeight: 'bold', color: '#002147' },
  editItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9f9f9', padding: 8, borderRadius: 6, marginBottom: 5 },
  addBox: { backgroundColor: '#f5f5f5', padding: 10, borderRadius: 8, marginTop: 5 },
  miniInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 4, padding: 6, marginBottom: 5, fontSize: 13, textAlignVertical: 'top' },
  addBtn: { backgroundColor: '#555', padding: 8, borderRadius: 4, alignItems: 'center' },
  deleteBtnFull: { backgroundColor: '#FF6B6B', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  dateBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 10 },
  dateBtnText: { color: '#333' },
  smallBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
});