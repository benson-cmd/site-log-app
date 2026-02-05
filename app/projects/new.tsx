
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, SafeAreaView, Platform, KeyboardAvoidingView, StatusBar, Modal } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { addDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';
import { useUser } from '../../context/UserContext';
import * as DocumentPicker from 'expo-document-picker';

// --- 全域常數 ---
const THEME = {
  primary: '#C69C6D',
  background: '#F5F7FA',
  headerBg: '#fff',
  text: '#333',
  border: '#E0E0E0'
};

const STATUS_OPTIONS = ['未開工', '已開工未進場', '施工中', '完工待驗收', '驗收中', '結案'];
const CONTRACT_TYPES = ['日曆天', '工作天'];

// --- 介面定義 ---
interface ChangeOrder { date: string; amount: string; number: string; reason: string; }
interface Extension { date: string; days: string; number: string; reason: string; }
interface Expansion { date: string; amount: string; number: string; reason: string; }
interface ProjectDocument { title: string; url: string; type: string; name: string; }
interface Personnel { id: string; name: string; role?: string; }

export default function NewProjectScreen() {
  const router = useRouter();
  const { user } = useUser();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [personnelList, setPersonnelList] = useState<Personnel[]>([]);

  // --- 表單資料 State ---
  const [formData, setFormData] = useState({
    name: '', address: '', manager: '', status: 'planning', executionStatus: '未開工',
    awardDate: '', startDate: '', duration: '', contractType: '日曆天',
    endDate: '', actualEndDate: '',
    acceptanceDate: '', reverificationDate: '', qualifiedDate: '',
    originalAmount: '', amendedAmount: '',
    changeOrders: [] as ChangeOrder[],
    extensions: [] as Extension[],
    subsequentExpansions: [] as Expansion[],
    documents: [] as ProjectDocument[],
    scheduleFile: null as any,
  });

  // 日曆相關
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [currentDateField, setCurrentDateField] = useState('');
  const [displayDate, setDisplayDate] = useState(new Date());

  // 下拉選單控制
  const [showManagerPicker, setShowManagerPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);

  // 初始化：讀取人員名單
  useEffect(() => {
    const fetchPersonnel = async () => {
      try {
        const q = query(collection(db, 'personnel'), orderBy('name', 'asc'));
        const querySnapshot = await getDocs(q);
        const list: Personnel[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.name) list.push({ id: doc.id, name: data.name, role: data.role });
        });
        setPersonnelList(list);
      } catch (error) {
        if (user?.name) setPersonnelList([{ id: user.uid || 'current', name: user.name }]);
      }
    };
    fetchPersonnel();
  }, [user]);

  // --- 自動計算邏輯 ---
  useEffect(() => {
    calculateDatesAndAmounts();
  }, [formData.startDate, formData.duration, formData.contractType, formData.extensions, formData.originalAmount, formData.changeOrders, formData.subsequentExpansions]);

  const calculateDatesAndAmounts = () => {
    // 1. 計算金額 (Amended Amount)
    // Formula: (Latest CO Amount OR Original Amount) + (Latest Expansion Amount)
    let baseAmount = parseFloat(formData.originalAmount) || 0;

    // 如果有變更設計，取最新一筆的金額作為新的 Base
    if (formData.changeOrders.length > 0) {
      const lastCO = formData.changeOrders[formData.changeOrders.length - 1];
      const lastCOAmount = parseFloat(lastCO.amount) || 0;
      if (lastCOAmount > 0) baseAmount = lastCOAmount;
    }

    // 後續擴充：取最新一筆
    let expansionAmount = 0;
    if (formData.subsequentExpansions.length > 0) {
      const lastExp = formData.subsequentExpansions[formData.subsequentExpansions.length - 1];
      expansionAmount = parseFloat(lastExp.amount) || 0;
    }

    const totalAmount = baseAmount + expansionAmount;

    // 只有在有變更或擴充時，才填寫變更後總價，否則留空
    const hasChanges = formData.changeOrders.length > 0 || formData.subsequentExpansions.length > 0;
    const finalAmendedAmount = hasChanges ? totalAmount.toString() : '';

    // 2. 計算竣工日
    let calcEndDate = formData.endDate;

    // 只有「日曆天」才自動計算；「工作天」保留使用者手動輸入
    if (formData.contractType === '日曆天') {
      if (formData.startDate && formData.duration) {
        const start = new Date(formData.startDate.replace(/\//g, '-'));
        const days = parseInt(formData.duration) || 0;
        const extDays = formData.extensions.reduce((acc, curr) => acc + (parseInt(curr.days) || 0), 0);

        const totalDays = days + extDays;
        if (totalDays > 0) {
          const end = new Date(start);
          end.setDate(start.getDate() + totalDays - 1);
          if (!isNaN(end.getTime())) {
            calcEndDate = end.toISOString().split('T')[0].replace(/-/g, '/');
          }
        }
      }
    } else {
      // 工作天模式：如果不做任何事，保持原值 (allow manual input)
      // 但如果切換回工作天，這裡不強制覆蓋
    }

    setFormData(prev => ({
      ...prev,
      amendedAmount: finalAmendedAmount,
      endDate: formData.contractType === '日曆天' ? calcEndDate : prev.endDate
    }));
  };

  const formatNumber = (num: string) => {
    if (!num) return '';
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // --- 輔助函式：更新陣列 ---
  const updateArray = (field: 'changeOrders' | 'extensions' | 'subsequentExpansions' | 'documents', newArray: any[]) => {
    setFormData(prev => ({ ...prev, [field]: newArray }));
  };

  const addItem = (field: 'changeOrders' | 'extensions' | 'subsequentExpansions', item: any) => {
    setFormData(prev => ({ ...prev, [field]: [...prev[field], item] }));
  };

  const updateItem = (field: 'changeOrders' | 'extensions' | 'subsequentExpansions', index: number, key: string, value: string) => {
    const list = [...formData[field]] as any[];
    list[index] = { ...list[index], [key]: value };
    setFormData({ ...formData, [field]: list });
  };

  const removeItem = (field: 'changeOrders' | 'extensions' | 'subsequentExpansions', index: number) => {
    const list = [...formData[field]] as any[];
    list.splice(index, 1);
    setFormData({ ...formData, [field]: list });
  };

  // --- CSV 匯入 ---
  const handleImportCSV = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'application/vnd.ms-excel', 'text/comma-separated-values'],
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets) {
        setFormData(prev => ({ ...prev, scheduleFile: result.assets[0] }));
        Alert.alert('成功', `已讀取檔案：${result.assets[0].name}`);
      }
    } catch (e) {
      Alert.alert('錯誤', '無法讀取檔案');
    }
  };

  const handleRemoveCSV = () => {
    setFormData(prev => ({ ...prev, scheduleFile: null }));
  };

  // --- 文件上傳 ---
  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true });
      if (!result.canceled && result.assets) {
        const newDocs = result.assets.map(asset => ({
          title: asset.name, name: asset.name, url: asset.uri, type: asset.mimeType || 'file'
        }));
        setFormData(prev => ({ ...prev, documents: [...prev.documents, ...newDocs] }));
      }
    } catch (err) { Alert.alert('錯誤', '選取失敗'); }
  };

  // --- 提交 ---
  const handleSubmit = async () => {
    if (!formData.name.trim()) return Alert.alert('提示', '請輸入專案名稱');
    if (!formData.manager) return Alert.alert('提示', '請選擇工地主任');

    try {
      setIsSubmitting(true);
      await addDoc(collection(db, 'projects'), {
        ...formData,
        contractDuration: formData.duration,
        type: formData.contractType,
        createdAt: new Date().toISOString(),
        createdBy: user?.uid || 'admin'
      });
      Alert.alert('成功', '專案已建立', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (error: any) {
      Alert.alert('錯誤', error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 日曆邏輯 ---
  const openCalendar = (field: string) => { setCurrentDateField(field); setDisplayDate(new Date()); setCalendarVisible(true); };

  const onSelectDate = (d: number) => {
    const y = displayDate.getFullYear(); const m = displayDate.getMonth() + 1;
    const dateStr = `${y}/${m < 10 ? '0' + m : m}/${d < 10 ? '0' + d : d}`;

    if (currentDateField === 'awardDate') setFormData(prev => ({ ...prev, awardDate: dateStr }));
    else if (currentDateField === 'startDate') setFormData(prev => ({ ...prev, startDate: dateStr }));
    else if (currentDateField === 'endDate') setFormData(prev => ({ ...prev, endDate: dateStr }));
    else if (currentDateField === 'actualEndDate') setFormData(prev => ({ ...prev, actualEndDate: dateStr }));
    else if (currentDateField === 'reverificationDate') setFormData(prev => ({ ...prev, reverificationDate: dateStr }));
    else if (currentDateField === 'qualifiedDate') setFormData(prev => ({ ...prev, qualifiedDate: dateStr }));
    else if (currentDateField === 'acceptanceDate') setFormData(prev => ({ ...prev, acceptanceDate: dateStr }));
    else if (currentDateField.startsWith('ext_')) {
      const idx = parseInt(currentDateField.split('_')[1]);
      updateItem('extensions', idx, 'date', dateStr);
    }
    else if (currentDateField.startsWith('co_')) {
      const idx = parseInt(currentDateField.split('_')[1]);
      updateItem('changeOrders', idx, 'date', dateStr);
    }
    else if (currentDateField.startsWith('se_')) {
      const idx = parseInt(currentDateField.split('_')[1]);
      updateItem('subsequentExpansions', idx, 'date', dateStr);
    } else {
      setFormData(prev => ({ ...prev, [currentDateField]: dateStr }));
    }

    setCalendarVisible(false);
  };

  const renderCalendarDays = () => {
    const y = displayDate.getFullYear(); const m = displayDate.getMonth(); const daysInMonth = new Date(y, m + 1, 0).getDate(); const firstDay = new Date(y, m, 1).getDay();
    const days = []; for (let i = 0; i < firstDay; i++) days.push(<View key={`e-${i}`} style={styles.dayCellEmpty} />);
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(<TouchableOpacity key={i} style={styles.dayCell} onPress={() => onSelectDate(i)}><Text style={styles.dayText}>{i}</Text></TouchableOpacity>);
    }
    return days;
  };

  const DateInput = ({ value, field, placeholder = "年/月/日", disabled = false }: any) => (
    <TouchableOpacity
      style={[styles.dateInput, disabled && { backgroundColor: '#f0f0f0' }]}
      onPress={() => !disabled && openCalendar(field)}
      disabled={disabled}
    >
      <Text style={{ color: value ? '#333' : '#999' }}>{value || placeholder}</Text>
      <Ionicons name="calendar-outline" size={20} color="#666" />
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Stack.Screen options={{
        title: '新增專案',
        headerStyle: { backgroundColor: '#fff' },
        headerTintColor: '#333',
        headerTitleStyle: { fontWeight: 'bold' },
        headerShown: true,
        presentation: 'modal',
        headerLeft: () => null,
        headerRight: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 10 }}>
            <Ionicons name="close" size={26} color="#333" />
          </TouchableOpacity>
        )
      }} />
      <StatusBar barStyle="dark-content" />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>

              {/* 1. 基本資料 (High Z-Index for Dropdowns) */}
              <View style={[styles.section, { zIndex: 3000 }]}>
                <Text style={styles.sectionHeader}>基本資料</Text>
                <Text style={styles.label}>專案名稱 *</Text>
                <TextInput style={styles.input} value={formData.name} onChangeText={t => setFormData({ ...formData, name: t })} placeholder="輸入專案名稱" />
                <Text style={styles.label}>地址</Text>
                <TextInput style={styles.input} value={formData.address} onChangeText={t => setFormData({ ...formData, address: t })} placeholder="輸入專案位置" />

                <View style={[styles.row, { zIndex: 3000 }]}>
                  <View style={{ flex: 1, marginRight: 10, zIndex: 3000 }}>
                    <Text style={styles.label}>工地主任</Text>
                    <TouchableOpacity style={styles.dropdown} onPress={() => setShowManagerPicker(!showManagerPicker)}>
                      <Text style={{ color: formData.manager ? '#333' : '#999' }} numberOfLines={1}>{formData.manager || '請選擇'}</Text>
                      <Ionicons name="chevron-down" size={16} color="#666" />
                    </TouchableOpacity>
                    {showManagerPicker && (
                      <View style={styles.dropdownList}>
                        {personnelList.length > 0 ? personnelList.map(p => (
                          <TouchableOpacity key={p.id} style={styles.dropdownItem} onPress={() => { setFormData({ ...formData, manager: p.name }); setShowManagerPicker(false) }}>
                            <Text style={styles.dropdownItemText}>{p.name}</Text>
                          </TouchableOpacity>
                        )) : <View style={styles.dropdownItem}><Text style={{ color: '#999' }}>無人員資料</Text></View>}
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1, zIndex: 2000 }}>
                    <Text style={styles.label}>執行狀態</Text>
                    <TouchableOpacity style={styles.dropdown} onPress={() => setShowStatusPicker(!showStatusPicker)}>
                      <Text style={{ color: '#333' }}>{formData.executionStatus}</Text>
                      <Ionicons name="chevron-down" size={16} color="#666" />
                    </TouchableOpacity>
                    {showStatusPicker && (
                      <View style={styles.dropdownList}>
                        {STATUS_OPTIONS.map(s => (
                          <TouchableOpacity key={s} style={styles.dropdownItem} onPress={() => { setFormData({ ...formData, executionStatus: s }); setShowStatusPicker(false) }}>
                            <Text style={styles.dropdownItemText}>{s}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* 2. 時程管理 (Lower Z-Index) */}
              <View style={[styles.section, { zIndex: 1000 }]}>
                <Text style={styles.sectionHeader}>時程管理</Text>
                <View style={styles.row}>
                  <View style={{ flex: 1, marginRight: 10 }}><Text style={styles.label}>決標日期</Text><DateInput value={formData.awardDate} field="awardDate" /></View>
                  <View style={{ flex: 1 }}><Text style={styles.label}>開工日期</Text><DateInput value={formData.startDate} field="startDate" /></View>
                </View>

                {/* Contract Duration & Type */}
                <View style={styles.row}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={styles.label}>契約工期</Text>
                    <TextInput style={styles.input} value={formData.duration} onChangeText={t => setFormData({ ...formData, duration: t })} keyboardType="numeric" placeholder="天數" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>工期類型</Text>
                    <TouchableOpacity style={styles.dropdown} onPress={() => setShowTypePicker(!showTypePicker)}>
                      <Text style={{ color: '#333' }}>{formData.contractType}</Text>
                      <Ionicons name="chevron-down" size={16} color="#666" />
                    </TouchableOpacity>
                    {showTypePicker && (
                      <View style={styles.dropdownList}>
                        {CONTRACT_TYPES.map((t) => (
                          <TouchableOpacity key={t} style={styles.dropdownItem} onPress={() => { setFormData({ ...formData, contractType: t }); setShowTypePicker(false) }}>
                            <Text style={styles.dropdownItemText}>{t}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </View>

                {/* CSV Import */}
                <View style={styles.rowCentered}>
                  <Text style={styles.label}>預定進度表 (CSV)</Text>

                  {formData.scheduleFile ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, color: 'green', marginRight: 10 }}>{formData.scheduleFile.name}</Text>
                      <TouchableOpacity onPress={handleRemoveCSV}>
                        <Ionicons name="trash" size={20} color="#FF6B6B" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.csvBtn} onPress={handleImportCSV}>
                      <Ionicons name="document-attach" color="#fff" size={14} />
                      <Text style={{ color: '#fff', fontSize: 12, marginLeft: 4 }}>匯入檔案</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionHeader}>展延工期明細</Text>
                {formData.extensions.map((ext, i) => (
                  <View key={i} style={styles.cardItem}>
                    <View style={styles.row}>
                      <View style={{ flex: 1, marginRight: 5 }}>
                        <Text style={styles.labelSmall}>日期</Text>
                        <DateInput value={ext.date} field={`ext_${i}`} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.labelSmall}>展延天數</Text>
                        <TextInput style={styles.inputSmall} value={ext.days} onChangeText={v => updateItem('extensions', i, 'days', v)} keyboardType="numeric" />
                      </View>
                    </View>
                    <Text style={styles.labelSmall}>核准文號</Text>
                    <TextInput style={styles.inputSmall} value={ext.number} onChangeText={v => updateItem('extensions', i, 'number', v)} />
                    <Text style={styles.labelSmall}>展延理由</Text>
                    <TextInput style={styles.inputSmall} value={ext.reason} onChangeText={v => updateItem('extensions', i, 'reason', v)} />
                    <TouchableOpacity onPress={() => removeItem('extensions', i)} style={styles.deleteBtn}>
                      <Ionicons name="trash-outline" size={18} color="red" />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addBtn} onPress={() => addItem('extensions', { date: '', days: '', number: '', reason: '' })}><Text style={{ color: '#fff' }}>加入展延</Text></TouchableOpacity>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionHeader}>竣工日期</Text>
                <View style={styles.row}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={styles.label}>預定竣工日</Text>
                    {formData.contractType === '日曆天' ? (
                      <View style={[styles.input, { backgroundColor: '#f0f0f0', justifyContent: 'center' }]}>
                        <Text style={{ color: '#333' }}>{formData.endDate || '-'}</Text>
                      </View>
                    ) : (
                      <DateInput value={formData.endDate} field="endDate" placeholder="請選擇" />
                    )}
                    {formData.contractType === '日曆天' && <Text style={{ fontSize: 10, color: '#999', marginTop: 2 }}>*系統自動計算</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>實際竣工日</Text>
                    <DateInput value={formData.actualEndDate} field="actualEndDate" placeholder="請選擇" />
                  </View>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionHeader}>金額與變更設計</Text>
                <View style={styles.row}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={styles.label}>契約金額 (元)</Text>
                    <TextInput
                      style={styles.input}
                      value={formatNumber(formData.originalAmount)}
                      onChangeText={t => setFormData({ ...formData, originalAmount: t.replace(/,/g, '') })}
                      keyboardType="numeric"
                      placeholder="請輸入金額"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>變更後總價 (元)</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: '#eee' }]}
                      value={formatNumber(formData.amendedAmount)}
                      editable={false}
                      placeholder="無變更"
                    />
                  </View>
                </View>

                <Text style={[styles.label, { marginTop: 15 }]}>變更設計明細</Text>
                {formData.changeOrders.map((co, i) => (
                  <View key={i} style={styles.cardItem}>
                    <View style={styles.row}>
                      <View style={{ flex: 1, marginRight: 5 }}>
                        <Text style={styles.labelSmall}>日期</Text>
                        <DateInput value={co.date} field={`co_${i}`} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.labelSmall}>變更金額</Text>
                        <TextInput style={styles.inputSmall} value={co.amount} onChangeText={v => updateItem('changeOrders', i, 'amount', v)} keyboardType="numeric" />
                      </View>
                    </View>
                    <Text style={styles.labelSmall}>核准文號</Text>
                    <TextInput style={styles.inputSmall} value={co.number} onChangeText={v => updateItem('changeOrders', i, 'number', v)} />
                    <Text style={styles.labelSmall}>變更事由</Text>
                    <TextInput style={styles.inputSmall} value={co.reason} onChangeText={v => updateItem('changeOrders', i, 'reason', v)} placeholder="請輸入事由" multiline />
                    <TouchableOpacity onPress={() => removeItem('changeOrders', i)} style={styles.deleteBtn}>
                      <Ionicons name="trash-outline" size={18} color="red" />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addBtn} onPress={() => addItem('changeOrders', { date: '', amount: '', number: '', reason: '' })}><Text style={{ color: '#fff' }}>加入變更設計</Text></TouchableOpacity>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionHeader}>後續擴充明細</Text>
                {formData.subsequentExpansions.map((se, i) => (
                  <View key={i} style={styles.cardItem}>
                    <View style={styles.row}>
                      <View style={{ flex: 1, marginRight: 5 }}>
                        <Text style={styles.labelSmall}>日期</Text>
                        <DateInput value={se.date} field={`se_${i}`} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.labelSmall}>擴充金額</Text>
                        <TextInput style={styles.inputSmall} value={se.amount} onChangeText={v => updateItem('subsequentExpansions', i, 'amount', v)} keyboardType="numeric" />
                      </View>
                    </View>
                    <Text style={styles.labelSmall}>核准文號</Text>
                    <TextInput style={styles.inputSmall} value={se.number} onChangeText={v => updateItem('subsequentExpansions', i, 'number', v)} />
                    <Text style={styles.labelSmall}>擴充事由</Text>
                    <TextInput style={styles.inputSmall} value={se.reason} onChangeText={v => updateItem('subsequentExpansions', i, 'reason', v)} />
                    <TouchableOpacity onPress={() => removeItem('subsequentExpansions', i)} style={styles.deleteBtn}>
                      <Ionicons name="trash-outline" size={18} color="red" />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addBtn} onPress={() => addItem('subsequentExpansions', { date: '', amount: '', number: '', reason: '' })}><Text style={{ color: '#fff' }}>加入後續擴充</Text></TouchableOpacity>
              </View>

              <View style={styles.section}>
                <View style={styles.row}>
                  <View style={{ flex: 1, marginRight: 10 }}><Text style={styles.label}>驗收日期</Text><DateInput value={formData.acceptanceDate} field="acceptanceDate" /></View>
                  <View style={{ flex: 1 }}><Text style={styles.label}>複驗日期</Text><DateInput value={formData.reverificationDate} field="reverificationDate" /></View>
                </View>
                <Text style={styles.label}>驗收合格日</Text>
                <DateInput value={formData.qualifiedDate} field="qualifiedDate" />
              </View>

              {/* 📁 文件上傳區 */}
              <View style={styles.fileSection}>
                <Text style={styles.fileTitle}>📁 契約與相關文件</Text>
                {formData.documents.map((doc, idx) => (
                  <View key={idx} style={styles.fileItem}>
                    <Ionicons name="document-text" size={20} color="#555" />
                    <Text style={{ flex: 1, marginLeft: 10 }}>{doc.name}</Text>
                    <TouchableOpacity onPress={() => { const l = [...formData.documents]; l.splice(idx, 1); updateArray('documents', l) }}><Ionicons name="trash" size={20} color="red" /></TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.uploadBtn} onPress={handlePickDocument}>
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>+ 上傳文件</Text>
                </TouchableOpacity>
              </View>

            </ScrollView>

            {/* 底部按鈕 */}
            <View style={styles.footer}>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>確認新增專案</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>

        {/* 日曆 Modal */}
        <Modal visible={calendarVisible} transparent onRequestClose={() => setCalendarVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.calContent}>
              <View style={styles.calendarHeader}>
                <TouchableOpacity onPress={() => { const d = new Date(displayDate); d.setMonth(d.getMonth() - 1); setDisplayDate(d) }}><Ionicons name="chevron-back" size={24} /></TouchableOpacity>
                <Text style={styles.monthTitle}>{displayDate.getFullYear()}/{displayDate.getMonth() + 1}</Text>
                <TouchableOpacity onPress={() => { const d = new Date(displayDate); d.setMonth(d.getMonth() + 1); setDisplayDate(d) }}><Ionicons name="chevron-forward" size={24} /></TouchableOpacity>
              </View>
              <View style={styles.weekHeader}>
                {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                  <Text key={d} style={styles.weekText}>{d}</Text>
                ))}
              </View>
              <View style={styles.daysGrid}>
                {renderCalendarDays()}
              </View>
              <TouchableOpacity onPress={() => setCalendarVisible(false)} style={{ marginTop: 20, alignItems: 'center' }}><Text>取消</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  // Header
  // Note: custom header is handled by stack options

  // Form
  form: { padding: 20, paddingBottom: 150 },
  section: { marginBottom: 20 },
  sectionHeader: { fontSize: 14, fontWeight: 'bold', color: '#0052cc', marginBottom: 10, backgroundColor: '#f0f8ff', padding: 5 },
  label: { fontSize: 13, fontWeight: 'bold', color: '#333', marginBottom: 5, marginTop: 5 },
  labelSmall: { fontSize: 12, color: '#666', marginBottom: 2 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 6, fontSize: 15, backgroundColor: '#fff' },
  inputSmall: { borderWidth: 1, borderColor: '#ddd', padding: 8, borderRadius: 6, fontSize: 14, backgroundColor: '#fff', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowCentered: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },

  // Dropdown
  dropdown: { borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff' },
  dropdownList: { position: 'absolute', top: 45, left: 0, right: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', zIndex: 9999, borderRadius: 6, elevation: 5, maxHeight: 200 },
  dropdownItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  dropdownItemText: { fontSize: 16, color: '#333' },

  dateInput: { borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff' },

  csvBtn: { flexDirection: 'row', backgroundColor: '#4CAF50', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4, alignItems: 'center' },
  addBtn: { backgroundColor: '#666', padding: 8, borderRadius: 5, alignItems: 'center', alignSelf: 'flex-start', marginTop: 5, paddingHorizontal: 15 },
  // addBtnText: { color: '#fff', fontSize: 12 },
  deleteBtn: { position: 'absolute', top: 10, right: 10 },

  cardItem: { backgroundColor: '#f9f9f9', padding: 12, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#eee', position: 'relative' },

  // autoCalcBox: { backgroundColor: '#E3F2FD', padding: 15, borderRadius: 8, marginBottom: 10, alignItems: 'center', borderWidth: 1, borderColor: '#BBDEFB' },
  // autoLabel: { color: '#ccc', fontSize: 12 },
  // autoValue: { color: '#0D47A1', fontSize: 18, fontWeight: 'bold', marginTop: 2 },

  // File Upload
  fileSection: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginTop: 20, borderWidth: 1, borderColor: '#eee' },
  fileTitle: { fontWeight: 'bold', color: '#333', marginBottom: 10 },
  fileItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', padding: 8, borderRadius: 6, marginBottom: 5, borderWidth: 1, borderColor: '#eee' },
  uploadBtn: { backgroundColor: '#1976D2', padding: 10, borderRadius: 6, alignItems: 'center', marginTop: 10 },

  footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#eee', backgroundColor: '#fff' },
  submitBtn: { backgroundColor: THEME.primary, padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 50 },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

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
});