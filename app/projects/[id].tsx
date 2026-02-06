import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, StatusBar, Platform, SafeAreaView, Modal, TextInput, Alert, KeyboardAvoidingView } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useMemo, useRef } from 'react';
import { LineChart } from "react-native-chart-kit";
import { Dimensions } from "react-native";
import { useProjects } from '../../context/ProjectContext';
import { useLogs } from '../../context/LogContext';
import * as Linking from 'expo-linking';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { doc, updateDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';

const STATUS_OPTIONS = ['未開工', '已開工未進場', '施工中', '完工待驗收', '驗收中', '結案'];

const Tabs = ({ activeTab, setActiveTab }: any) => (
  <View style={styles.tabContainer}>
    <TouchableOpacity style={[styles.tab, activeTab === 'progress' && styles.activeTab]} onPress={() => setActiveTab('progress')}>
      <Text style={[styles.tabText, activeTab === 'progress' && styles.activeTabText]}>施工進度</Text>
    </TouchableOpacity>
    <TouchableOpacity style={[styles.tab, activeTab === 'info' && styles.activeTab]} onPress={() => setActiveTab('info')}>
      <Text style={[styles.tabText, activeTab === 'info' && styles.activeTabText]}>專案資訊</Text>
    </TouchableOpacity>
  </View>
);

const InfoItem = ({ label, value, subText, color = 'black', valueStyle, children }: any) => (
  <View style={styles.infoItem}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={[styles.infoValue, { color }, valueStyle]}>{value}</Text>
    {subText && <Text style={styles.infoSub}>{subText}</Text>}
    {children}
  </View>
);

export default function ProjectDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projects, updateProject } = useProjects();
  const { logs } = useLogs();

  const [activeTab, setActiveTab] = useState('progress');
  const [project, setProject] = useState<any>(null);
  const [projectLogs, setProjectLogs] = useState<any[]>([]);
  const [chartData, setChartData] = useState<{ labels: string[], actual: (number | null)[] }>({ labels: [], actual: [] });

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);

  // Personnel and Dropdown State
  const [personnelList, setPersonnelList] = useState<any[]>([]);
  const [showManagerPicker, setShowManagerPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  // Calendar State
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [currentDateField, setCurrentDateField] = useState('');
  const [displayDate, setDisplayDate] = useState(new Date());

  // 2. 載入人員名單
  useEffect(() => {
    const fetchPersonnel = async () => {
      try {
        const q = query(collection(db, 'personnel'), orderBy('name', 'asc'));
        const querySnapshot = await getDocs(q);
        const list: any[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.name) list.push({ id: doc.id, name: data.name, role: data.role });
        });
        setPersonnelList(list);
      } catch (error) {
        console.error('Failed to fetch personnel:', error);
      }
    };
    fetchPersonnel();
  }, []);

  // 3. 載入專案資料
  useEffect(() => {
    if (id && projects.length > 0) {
      const p = projects.find(item => item.id === id);
      if (p) {
        setProject(p);
        const safeP = p as any;
        setEditForm({
          ...safeP,
          originalAmount: String(safeP.originalAmount || safeP.contractPrice || safeP.totalPrice || '').replace(/,/g, ''),
          amendedAmount: String(safeP.amendedAmount || '').replace(/,/g, ''),
          changeOrders: safeP.changeOrders || [],
          extensions: safeP.extensions || [],
          documents: safeP.documents || [],
          scheduleFile: safeP.scheduleFile || null
        });
      }
    }
  }, [id, projects]);

  // 2. 載入相關日誌
  useEffect(() => {
    if (logs.length > 0 && id) {
      const filtered = logs.filter(l => l.projectId === id).sort((a, b) => b.date.localeCompare(a.date));
      setProjectLogs(filtered);
    }
  }, [id, logs]);

  // --- 核心邏輯：日期計算 (提升至 Top Level 以便 S-Curve 使用) ---
  const calculateDates = useMemo(() => {
    if (!project) return { calculatedEndDateStr: '-', totalExtensionDays: 0, startTs: 0, endTs: 0 };

    const startStr = project.startDate ? String(project.startDate).replace(/\//g, '-') : '';
    const duration = Number(project.duration || (project as any).contractDuration || 0);
    const totalExtensionDays = (project.extensions || []).reduce((acc: number, curr: any) => acc + (Number(curr.days) || 0), 0);

    let calculatedEndDateStr = project.endDate;
    let endTs = 0;
    let startTs = 0;

    // 若有開工日與工期，優先使用動態計算
    if (startStr && duration > 0) {
      const startDate = new Date(startStr);
      startTs = startDate.getTime();

      // 計算公式：開工日 + 工期 + 展延 - 1
      const totalDays = duration + totalExtensionDays;
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + totalDays - 1);

      endTs = endDate.getTime();
      const y = endDate.getFullYear();
      const m = String(endDate.getMonth() + 1).padStart(2, '0');
      const d = String(endDate.getDate()).padStart(2, '0');
      calculatedEndDateStr = `${y}-${m}-${d}`;
    } else {
      // Fallback
      const eStr = project.endDate ? String(project.endDate).replace(/\//g, '-') : '';
      if (eStr) endTs = new Date(eStr).getTime();
      if (startStr) startTs = new Date(startStr).getTime();
    }

    return { calculatedEndDateStr, totalExtensionDays, startTs, endTs };
  }, [project]);

  // 3. S-Curve 計算
  useEffect(() => {
    if (project && calculateDates.startTs > 0 && calculateDates.endTs > 0) {
      const { startTs, endTs } = calculateDates;
      const nowTs = new Date().getTime();

      const points = [];
      // 若日期有效，建立 6 等分座標
      if (endTs > startTs) {
        const totalDuration = endTs - startTs;
        const steps = 6;
        for (let i = 0; i <= steps; i++) {
          if (i === steps) points.push(endTs);
          else points.push(startTs + (totalDuration * (i / steps)));
        }
      } else {
        points.push(nowTs);
      }

      const labelsStr = points.map(ts => {
        const d = new Date(ts);
        return `${d.getMonth() + 1}/${d.getDate()}`;
      });

      if (projectLogs.length > 0) {
        const cleanLogs = projectLogs.map(l => {
          const dStr = l.date ? String(l.date).replace(/\//g, '-') : '';
          // 處理百分比字串 "20%" -> 20
          const valStr = String(l.actualProgress || '0').replace('%', '');
          return {
            ts: dStr ? new Date(dStr).getTime() : 0,
            val: parseFloat(valStr) || 0
          };
        }).sort((a, b) => a.ts - b.ts);

        const mappedData = points.map(pointTs => {
          // 未來不畫線 (容許一天誤差)
          if (pointTs > nowTs + 86400000) return null;

          const validLogs = cleanLogs.filter(l => l.ts > 0 && l.ts <= pointTs);
          if (validLogs.length > 0) return validLogs[validLogs.length - 1].val;
          return 0;
        });

        const hasData = mappedData.some(d => d !== null);
        setChartData({ labels: labelsStr, actual: hasData ? mappedData : [0] });
      } else {
        setChartData({ labels: labelsStr, actual: [0] });
      }
    }
  }, [project, projectLogs, calculateDates]);

  if (!project) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#002147" />
      <Text style={{ marginTop: 10, color: '#666' }}>專案資料載入中...</Text>
    </View>
  );

  const todayStr = new Date().toISOString().split('T')[0];
  const todayLog = projectLogs.find(l => {
    const lDate = l.date ? String(l.date).replace(/\//g, '-') : '';
    return lDate === todayStr;
  });
  const actualDisplay = todayLog ? `${todayLog.actualProgress}%` : '尚未更新';
  const actualColor = todayLog ? '#333' : '#EF4444';

  let remainingDays = 0;
  if (calculateDates.endTs > 0) {
    const now = new Date().getTime();
    remainingDays = Math.ceil((calculateDates.endTs - now) / (1000 * 60 * 60 * 24));
  }
  const remainingText = `${remainingDays} 天`;
  const remainingColor = remainingDays < 0 ? '#EF4444' : '#111827';

  const getStatusText = (status: string) => {
    const map: any = {
      'planning': '尚未開工',
      'in-progress': '施工中',
      'construction': '施工中',
      'completed': '已完工',
      'suspended': '停工中'
    };
    return map[status] || status || '未知狀態';
  };

  const handleOpenDoc = async (url: string) => {
    console.log('Opening document:', url);
    if (!url) return Alert.alert('錯誤', '無效的連結');
    try {
      if (Platform.OS === 'web') {
        // Check if it's a blob URL
        if (url.startsWith('blob:')) {
          Alert.alert(
            '無法預覽文件',
            '本地 blob 檔案無法在新分頁中預覽。請在生產環境中使用雲端儲存服務（如 Cloudinary 或 Firebase Storage）進行檔案管理。'
          );
          return;
        }

        // Try to open regular URLs in new tab
        const newWindow = window.open(url, '_blank');
        // If blocked or local file access issue
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
          Alert.alert(
            '無法開啟文件',
            '此文件可能是本地檔案，瀏覽器無法直接存取。請將文件上傳至雲端儲存服務後再試。'
          );
        }
      } else {
        const supported = await Linking.canOpenURL(url);
        if (supported) await Linking.openURL(url);
        else Alert.alert('錯誤', '無法開啟此檔案');
      }
    } catch (e) {
      console.error('Error opening document:', e);
      if (Platform.OS === 'web') {
        Alert.alert(
          '檔案存取錯誤',
          '無法存取此文件。本地檔案路徑在 Web 版本中無法直接開啟，建議使用雲端儲存。'
        );
      } else {
        Alert.alert('錯誤', '開啟檔案時發生錯誤');
      }
    }
  };

  const formatCurrency = (val: number | string | undefined) => {
    if (!val) return '0';
    const strVal = String(val).replace(/,/g, '');
    const num = parseFloat(strVal);
    return isNaN(num) ? '0' : num.toLocaleString();
  };

  const formatNumber = (num: string) => {
    if (!num) return '';
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // Calendar handlers
  const openCalendar = (field: string) => {
    setCurrentDateField(field);
    setDisplayDate(new Date());
    setCalendarVisible(true);
  };

  const onSelectDate = (d: number) => {
    const y = displayDate.getFullYear();
    const m = displayDate.getMonth() + 1;
    const dateStr = `${y}-${m < 10 ? '0' + m : m}-${d < 10 ? '0' + d : d}`;

    if (currentDateField === 'awardDate') setEditForm((prev: any) => ({ ...prev, awardDate: dateStr }));
    else if (currentDateField === 'startDate') setEditForm((prev: any) => ({ ...prev, startDate: dateStr }));
    else if (currentDateField === 'endDate') setEditForm((prev: any) => ({ ...prev, endDate: dateStr }));
    else setEditForm((prev: any) => ({ ...prev, [currentDateField]: dateStr }));

    setCalendarVisible(false);
  };

  const renderCalendarDays = () => {
    const y = displayDate.getFullYear();
    const m = displayDate.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const firstDay = new Date(y, m, 1).getDay();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(<View key={`e-${i}`} style={styles.dayCellEmpty} />);
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(
        <TouchableOpacity key={i} style={styles.dayCell} onPress={() => onSelectDate(i)}>
          <Text style={styles.dayText}>{i}</Text>
        </TouchableOpacity>
      );
    }
    return days;
  };

  const DateInput = ({ value, field, placeholder = "YYYY-MM-DD" }: any) => (
    <TouchableOpacity style={styles.dateInput} onPress={() => openCalendar(field)}>
      <Text style={{ color: value ? '#333' : '#999' }}>{value || placeholder}</Text>
      <Ionicons name="calendar-outline" size={20} color="#666" />
    </TouchableOpacity>
  );

  // Document picker handlers
  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true });
      if (!result.canceled && result.assets) {
        const newDocs = result.assets.map(asset => ({
          title: asset.name,
          name: asset.name,
          url: asset.uri,
          type: asset.mimeType || 'file'
        }));
        setEditForm((prev: any) => ({ ...prev, documents: [...(prev.documents || []), ...newDocs] }));
      }
    } catch (err) {
      Alert.alert('錯誤', '選取失敗');
    }
  };

  const handleRemoveDocument = (index: number) => {
    const newDocs = [...(editForm.documents || [])];
    newDocs.splice(index, 1);
    setEditForm({ ...editForm, documents: newDocs });
  };

  // CSV Schedule Management
  const handleImportCSVForEdit = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'application/vnd.ms-excel', 'text/comma-separated-values'],
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets) {
        setEditForm((prev: any) => ({ ...prev, scheduleFile: result.assets[0] }));
        Alert.alert('成功', `已讀取檔案：${result.assets[0].name}`);
      }
    } catch (e) {
      Alert.alert('錯誤', '無法讀取檔案');
    }
  };

  const handleRemoveCSVForEdit = () => {
    setEditForm((prev: any) => ({ ...prev, scheduleFile: null }));
  };

  const handleSaveProject = async () => {
    setIsSaving(true);
    try {
      const docRef = doc(db, 'projects', project.id);

      // Sanitize form data before saving (especially scheduleFile)
      const projectData = { ...editForm };
      if (projectData.scheduleFile) {
        projectData.scheduleFile = {
          name: projectData.scheduleFile.name,
          uri: projectData.scheduleFile.uri,
          mimeType: projectData.scheduleFile.mimeType
        };
      }

      await updateDoc(docRef, projectData);
      setProject(projectData);
      setIsEditModalVisible(false);
      Alert.alert("成功", "專案資料已更新");
    } catch (e) {
      console.error('更新失敗:', e);
      Alert.alert("錯誤", "更新失敗，請檢查網路");
    } finally {
      setIsSaving(false);
    }
  };

  const addItemToForm = (field: string, item: any) => {
    setEditForm((prev: any) => ({ ...prev, [field]: [...(prev[field] || []), item] }));
  };
  const updateItemInForm = (field: string, index: number, key: string, value: string) => {
    const newList = [...(editForm[field] || [])];
    newList[index] = { ...newList[index], [key]: value };
    setEditForm({ ...editForm, [field]: newList });
  };
  const removeItemFromForm = (field: string, index: number) => {
    const newList = [...(editForm[field] || [])];
    newList.splice(index, 1);
    setEditForm({ ...editForm, [field]: newList });
  };

  const displayOriginalAmount = project.originalAmount || (project as any).contractPrice || '$0';

  return (
    <View style={styles.container}>
      <Stack.Screen options={{
        headerShown: true,
        title: project.name,
        headerStyle: { backgroundColor: '#002147' },
        headerTintColor: '#fff',
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 10 }}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        ),
        headerRight: () => (
          <TouchableOpacity onPress={() => setIsEditModalVisible(true)} style={{ marginRight: 10 }}>
            <Ionicons name="create-outline" size={24} color="#fff" />
          </TouchableOpacity>
        )
      }} />
      <StatusBar barStyle="light-content" />

      <Tabs activeTab={activeTab} setActiveTab={setActiveTab} />

      {activeTab === 'progress' ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionTitle}>專案狀態</Text>
          <View style={styles.dashboardRow}>
            <InfoItem label="剩餘工期" value={remainingText} color={remainingColor} />
            <InfoItem label="預定進度" value="21.5%" subText={`(${todayStr})`} />
            <InfoItem label="實際進度" value={actualDisplay} subText={`(${todayStr})`} color={actualColor} />
            <InfoItem label="執行狀態" value={getStatusText(project.status)} />
          </View>

          <Text style={styles.sectionTitle}>專案進度 S-Curve</Text>
          <View style={styles.chartCard}>
            <LineChart
              data={{
                labels: chartData.labels,
                datasets: [
                  { data: chartData.actual as any, color: (opacity = 1) => `rgba(255, 87, 34, ${opacity})`, strokeWidth: 2 },
                  { data: [0, 10, 25, 45, 65, 85, 100], color: (opacity = 1) => `rgba(65, 105, 225, ${opacity})`, strokeWidth: 2, withDots: false }
                ],
                legend: ['實際', '預定']
              }}
              width={Dimensions.get("window").width - 40}
              height={220}
              chartConfig={{
                backgroundColor: "#fff",
                backgroundGradientFrom: "#fff",
                backgroundGradientTo: "#fff",
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                propsForDots: { r: "4" }
              }}
              bezier
              style={{ marginVertical: 8, borderRadius: 16 }}
              withDots={true}
              getDotColor={(dataPoint, index) => index === 0 ? 'rgba(255, 87, 34, 1)' : 'rgba(255, 87, 34, 1)'}
            />
          </View>

          <Text style={styles.sectionTitle}>重要日期</Text>
          <View style={styles.infoCard}>
            <View style={styles.dateRow}><Text style={styles.label}>開工日期：</Text><Text>{project.startDate}</Text></View>
            <View style={styles.dateRow}><Text style={styles.label}>契約工期：</Text><Text>{project.duration || (project as any).contractDuration || '-'} 天</Text></View>
            <View style={styles.dateRow}><Text style={styles.label}>累計展延：</Text><Text style={{ color: calculateDates.totalExtensionDays > 0 ? 'red' : 'black' }}>{calculateDates.totalExtensionDays} 天</Text></View>
            <View style={styles.dateRow}><Text style={styles.label}>預定竣工：</Text><Text style={{ fontWeight: 'bold' }}>{calculateDates.calculatedEndDateStr}</Text></View>
            <View style={styles.dateRow}><Text style={styles.label}>實際竣工：</Text><Text>{project.actualEndDate || '-'}</Text></View>
            <View style={styles.dateRow}><Text style={styles.label}>驗收日期：</Text><Text>{project.acceptanceDate || '-'}</Text></View>
          </View>

          <Text style={styles.sectionTitle}>施工日誌 ({projectLogs.length})</Text>
          {projectLogs.map(log => {
            const issueStr = log.issues ? String(log.issues).trim() : '';
            const hasIssue = log.status === 'issue' || issueStr.length > 0;
            return (
              <View key={log.id} style={styles.logItem}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.logDate}>{log.date}</Text>
                  {hasIssue && <View style={styles.tagIssue}><Text style={{ color: '#fff', fontSize: 10 }}>⚠️ 異常</Text></View>}
                </View>
                <Text numberOfLines={1} style={{ color: '#666', marginTop: 4 }}>{log.content}</Text>
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionTitle}>基本資料</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}><Text style={styles.label}>專案名稱：</Text><Text style={{ flex: 1 }}>{project.name}</Text></View>
            <View style={styles.infoRow}><Text style={styles.label}>專案地點：</Text><Text>{project.address}</Text></View>
            <View style={styles.infoRow}><Text style={styles.label}>工地主任：</Text><Text>{project.manager}</Text></View>
            <View style={styles.infoRow}><Text style={styles.label}>決標日期：</Text><Text>{project.awardDate || '-'}</Text></View>
          </View>

          <Text style={styles.sectionTitle}>契約金額</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}><Text style={styles.label}>原始總價：</Text><Text>${formatCurrency(displayOriginalAmount)}</Text></View>
            <View style={styles.infoRow}><Text style={styles.label}>變更後總價：</Text><Text style={{ color: '#D32F2F', fontWeight: 'bold' }}>${formatCurrency(project.amendedAmount || project.originalAmount)}</Text></View>
          </View>

          <Text style={styles.sectionTitle}>變更設計紀錄</Text>
          <View style={styles.infoCard}>
            {(project.changeOrders || []).map((co: any, i: number) => (
              <View key={i} style={{ marginBottom: 10, borderBottomWidth: 1, borderColor: '#eee', paddingBottom: 5 }}>
                <Text style={{ fontWeight: 'bold', color: '#333' }}>{co.date} - 第{i + 1}次變更</Text>
                <Text style={{ color: '#666' }}>金額: {co.amount} | 文號: {co.number}</Text>
                <Text style={{ color: '#555' }}>理由: {co.reason}</Text>
              </View>
            ))}
            {(project.changeOrders || []).length === 0 && <Text style={{ color: '#999' }}>尚無變更紀錄</Text>}
          </View>

          <Text style={styles.sectionTitle}>展延工期紀錄</Text>
          <View style={styles.infoCard}>
            {(project.extensions || []).map((ext: any, i: number) => (
              <View key={i} style={{ marginBottom: 10, borderBottomWidth: 1, borderColor: '#eee', paddingBottom: 5 }}>
                <Text style={{ fontWeight: 'bold', color: '#333' }}>{ext.date} - 展延 {ext.days} 天</Text>
                <Text style={{ color: '#666' }}>文號: {ext.number}</Text>
                <Text style={{ color: '#555' }}>理由: {ext.reason}</Text>
              </View>
            ))}
            {(project.extensions || []).length === 0 && <Text style={{ color: '#999' }}>尚無展延紀錄</Text>}
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>契約與施工圖說</Text>

          {(project.documents || []).map((doc: any, i: number) => (
            <TouchableOpacity key={i} style={styles.docItem} onPress={() => handleOpenDoc(doc.url || doc.uri)}>
              <Ionicons name={doc.type === 'pdf' ? 'document-text' : 'image'} size={24} color="#555" />
              <Text style={{ marginLeft: 10 }}>{doc.title || doc.name}</Text>
            </TouchableOpacity>
          ))}
          {(project.documents || []).length === 0 && <Text style={{ color: '#999', textAlign: 'center', marginTop: 10 }}>尚無文件資料</Text>}

        </ScrollView>
      )}

      {/* 編輯 Modal */}
      <Modal visible={isEditModalVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsEditModalVisible(false)}><Ionicons name="close" size={28} /></TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>編輯專案資料</Text>
            <TouchableOpacity onPress={handleSaveProject} disabled={isSaving}>
              {isSaving ? <ActivityIndicator /> : <Text style={{ color: 'blue', fontWeight: 'bold', fontSize: 16 }}>儲存</Text>}
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView style={{ padding: 20, paddingBottom: 50 }}>

              <View style={{ zIndex: 3000 }}>
                <Text style={styles.groupTitle}>基本資訊</Text>
                <Text style={styles.inputLabel}>專案名稱</Text>
                <TextInput style={styles.input} value={editForm.name} onChangeText={t => setEditForm({ ...editForm, name: t })} />
                <Text style={styles.inputLabel}>專案地點</Text>
                <TextInput style={styles.input} value={editForm.address} onChangeText={t => setEditForm({ ...editForm, address: t })} />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1, zIndex: 3000 }}>
                    <Text style={styles.inputLabel}>工地主任</Text>
                    <TouchableOpacity style={styles.dropdown} onPress={() => setShowManagerPicker(!showManagerPicker)}>
                      <Text style={{ color: editForm.manager ? '#333' : '#999' }} numberOfLines={1}>{editForm.manager || '請選擇'}</Text>
                      <Ionicons name="chevron-down" size={16} color="#666" />
                    </TouchableOpacity>
                    {showManagerPicker && (
                      <View style={styles.dropdownList}>
                        {personnelList.length > 0 ? personnelList.map(p => (
                          <TouchableOpacity key={p.id} style={styles.dropdownItem} onPress={() => { setEditForm({ ...editForm, manager: p.name }); setShowManagerPicker(false); }}>
                            <Text style={styles.dropdownItemText}>{p.name}</Text>
                          </TouchableOpacity>
                        )) : <View style={styles.dropdownItem}><Text style={{ color: '#999' }}>無人員資料</Text></View>}
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1, zIndex: 2000 }}>
                    <Text style={styles.inputLabel}>執行狀態</Text>
                    <TouchableOpacity style={styles.dropdown} onPress={() => setShowStatusPicker(!showStatusPicker)}>
                      <Text style={{ color: '#333' }}>{editForm.executionStatus || editForm.status || '未開工'}</Text>
                      <Ionicons name="chevron-down" size={16} color="#666" />
                    </TouchableOpacity>
                    {showStatusPicker && (
                      <View style={styles.dropdownList}>
                        {STATUS_OPTIONS.map(s => (
                          <TouchableOpacity key={s} style={styles.dropdownItem} onPress={() => { setEditForm({ ...editForm, executionStatus: s }); setShowStatusPicker(false); }}>
                            <Text style={styles.dropdownItemText}>{s}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              </View>

              <Text style={styles.groupTitle}>時程管理</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>決標日期</Text>
                  <DateInput value={editForm.awardDate} field="awardDate" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>開工日期</Text>
                  <DateInput value={editForm.startDate} field="startDate" />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}><Text style={styles.inputLabel}>契約工期(天)</Text><TextInput style={styles.input} value={String(editForm.duration || '')} keyboardType="numeric" onChangeText={t => setEditForm({ ...editForm, duration: t })} /></View>
                <View style={{ flex: 1 }}><Text style={styles.inputLabel}>預定竣工日</Text><DateInput value={editForm.endDate} field="endDate" /></View>
              </View>

              {/* CSV Schedule File */}
              <Text style={styles.inputLabel}>預定進度表 (CSV)</Text>
              {editForm.scheduleFile ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9', padding: 10, borderRadius: 6, borderWidth: 1, borderColor: '#4CAF50' }}>
                  <Ionicons name="document-attach" size={20} color="#4CAF50" style={{ marginRight: 8 }} />
                  <Text style={{ flex: 1, color: '#2E7D32', fontSize: 14 }}>{editForm.scheduleFile.name || '已選擇檔案'}</Text>
                  <TouchableOpacity onPress={handleRemoveCSVForEdit}>
                    <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={{ flexDirection: 'row', backgroundColor: '#4CAF50', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, alignItems: 'center', alignSelf: 'flex-start' }} onPress={handleImportCSVForEdit}>
                  <Ionicons name="document-attach" size={18} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>匯入</Text>
                </TouchableOpacity>
              )}

              <Text style={styles.groupTitle}>契約金額</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>原始總價</Text>
                  <TextInput style={styles.input} value={formatNumber(String(editForm.originalAmount || ''))} keyboardType="numeric" onChangeText={t => setEditForm({ ...editForm, originalAmount: t.replace(/,/g, '') })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>變更後總價</Text>
                  <TextInput style={styles.input} value={formatNumber(String(editForm.amendedAmount || ''))} keyboardType="numeric" onChangeText={t => setEditForm({ ...editForm, amendedAmount: t.replace(/,/g, '') })} />
                </View>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
                <Text style={styles.groupTitle}>變更設計紀錄</Text>
                <TouchableOpacity onPress={() => addItemToForm('changeOrders', { date: '', amount: '', number: '', reason: '' })}><Text style={{ color: 'blue' }}>+ 新增變更</Text></TouchableOpacity>
              </View>
              {editForm.changeOrders?.map((item: any, i: number) => (
                <View key={i} style={styles.subFormCard}>
                  <TextInput style={styles.miniInput} placeholder="日期 (YYYY-MM-DD)" value={item.date} onChangeText={v => updateItemInForm('changeOrders', i, 'date', v)} />
                  <TextInput style={styles.miniInput} placeholder="金額" value={item.amount} onChangeText={v => updateItemInForm('changeOrders', i, 'amount', v)} />
                  <TextInput style={styles.miniInput} placeholder="文號" value={item.number} onChangeText={v => updateItemInForm('changeOrders', i, 'number', v)} />
                  <TextInput style={styles.miniInput} placeholder="理由" value={item.reason} onChangeText={v => updateItemInForm('changeOrders', i, 'reason', v)} />
                  <TouchableOpacity onPress={() => removeItemFromForm('changeOrders', i)}><Text style={{ color: 'red', textAlign: 'right' }}>刪除</Text></TouchableOpacity>
                </View>
              ))}

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
                <Text style={styles.groupTitle}>展延工期紀錄</Text>
                <TouchableOpacity onPress={() => addItemToForm('extensions', { date: '', days: '', number: '', reason: '' })}><Text style={{ color: 'blue' }}>+ 新增展延</Text></TouchableOpacity>
              </View>
              {editForm.extensions?.map((item: any, i: number) => (
                <View key={i} style={styles.subFormCard}>
                  <TextInput style={styles.miniInput} placeholder="核准日期" value={item.date} onChangeText={v => updateItemInForm('extensions', i, 'date', v)} />
                  <TextInput style={styles.miniInput} placeholder="展延天數" value={item.days} keyboardType="numeric" onChangeText={v => updateItemInForm('extensions', i, 'days', v)} />
                  <TextInput style={styles.miniInput} placeholder="核准文號" value={item.number} onChangeText={v => updateItemInForm('extensions', i, 'number', v)} />
                  <TextInput style={styles.miniInput} placeholder="理由" value={item.reason} onChangeText={v => updateItemInForm('extensions', i, 'reason', v)} />
                  <TouchableOpacity onPress={() => removeItemFromForm('extensions', i)}><Text style={{ color: 'red', textAlign: 'right' }}>刪除</Text></TouchableOpacity>
                </View>
              ))}

              <Text style={styles.groupTitle}>契約與施工圖說</Text>
              {(editForm.documents || []).map((doc: any, i: number) => (
                <View key={i} style={styles.fileItem}>
                  <Ionicons name={doc.type?.includes('pdf') ? 'document-text' : 'image'} size={20} color="#555" />
                  <Text style={{ flex: 1, marginLeft: 8, fontSize: 14 }}>{doc.title || doc.name}</Text>
                  <TouchableOpacity onPress={() => handleRemoveDocument(i)}>
                    <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.uploadBtn} onPress={handlePickDocument}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>+ 選擇文件</Text>
              </TouchableOpacity>

              <View style={{ height: 100 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Calendar Modal */}
      <Modal visible={calendarVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.calContent}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={() => setDisplayDate(new Date(displayDate.getFullYear(), displayDate.getMonth() - 1, 1))}>
                <Ionicons name="chevron-back" size={24} color="#333" />
              </TouchableOpacity>
              <Text style={styles.monthTitle}>{`${displayDate.getFullYear()}年 ${displayDate.getMonth() + 1}月`}</Text>
              <TouchableOpacity onPress={() => setDisplayDate(new Date(displayDate.getFullYear(), displayDate.getMonth() + 1, 1))}>
                <Ionicons name="chevron-forward" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <View style={styles.weekHeader}>
              {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                <Text key={d} style={styles.weekText}>{d}</Text>
              ))}
            </View>
            <View style={styles.daysGrid}>
              {renderCalendarDays()}
            </View>
            <TouchableOpacity onPress={() => setCalendarVisible(false)} style={{ marginTop: 20, alignItems: 'center' }}>
              <Text>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  headerSafeArea: { backgroundColor: '#002147' },
  customHeader: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  headerBtn: { padding: 5 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  tab: { flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#C69C6D' },
  tabText: { color: '#999', fontWeight: 'bold' },
  activeTabText: { color: '#C69C6D' },
  scrollContent: { padding: 20, paddingBottom: 50 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#002147', marginTop: 20, marginBottom: 10 },
  dashboardRow: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 15, justifyContent: 'space-between' },
  infoItem: { alignItems: 'center', flex: 1 },
  infoLabel: { fontSize: 12, color: '#666', marginBottom: 4 },
  infoValue: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  infoSub: { fontSize: 10, color: '#999' },
  chartCard: { backgroundColor: '#fff', borderRadius: 12, padding: 10, alignItems: 'center' },
  logItem: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10 },
  logDate: { fontWeight: 'bold', color: '#333' },
  tagIssue: { backgroundColor: '#FF8F00', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  infoCard: { backgroundColor: '#fff', padding: 15, borderRadius: 12 },
  infoRow: { flexDirection: 'row', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#f9f9f9', paddingBottom: 8 },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { color: '#666', width: 90, fontWeight: '600' },
  docItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 8 },
  // Modal
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderColor: '#eee', alignItems: 'center' },
  groupTitle: { fontSize: 16, fontWeight: 'bold', color: '#002147', marginTop: 20, marginBottom: 5, backgroundColor: '#eef2f6', padding: 8, borderRadius: 5 },
  inputLabel: { marginTop: 10, marginBottom: 5, fontWeight: 'bold', color: '#555' },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 8, fontSize: 16, backgroundColor: '#fafafa' },
  subFormCard: { backgroundColor: '#fff', padding: 10, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginBottom: 10 },
  miniInput: { borderWidth: 1, borderColor: '#eee', padding: 8, borderRadius: 5, marginBottom: 5, fontSize: 14 },
  // Dropdown
  dropdown: { borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fafafa' },
  dropdownList: { position: 'absolute', top: 45, left: 0, right: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', zIndex: 9999, borderRadius: 6, elevation: 5, maxHeight: 200 },
  dropdownItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  dropdownItemText: { fontSize: 16, color: '#333' },
  // Date Input
  dateInput: { borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fafafa' },
  // Calendar Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  calContent: { width: 340, backgroundColor: '#fff', padding: 20, borderRadius: 10 },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, alignItems: 'center' },
  monthTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  weekHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  weekText: { width: 40, textAlign: 'center', color: '#999', fontWeight: 'bold', fontSize: 14 },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  dayCellEmpty: { width: 40, height: 40 },
  dayText: { fontSize: 16 },
  // File Upload
  fileItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', padding: 10, borderRadius: 6, marginBottom: 5, borderWidth: 1, borderColor: '#eee' },
  uploadBtn: { backgroundColor: '#1976D2', padding: 10, borderRadius: 6, alignItems: 'center', marginTop: 10 }
});