import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Modal, Platform } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

const THEME = {
  primary: '#C69C6D',
  background: '#F5F7FA',
  headerBg: '#002147',
  sectionBg: '#FFF5E6',
  card: '#ffffff',
  text: '#333',
  border: '#E0E0E0'
};

const PERSONNEL_DB = [
  { id: '1', name: '吳資彬' },
  { id: '2', name: '現場工程師' },
  { id: '3', name: '陳大文' },
];

export default function NewProjectScreen() {
  const router = useRouter();

  // --- 1. 表單欄位 (完整的資料) ---
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [manager, setManager] = useState('');
  const [status, setStatus] = useState('未開工');
  
  // 日期欄位
  const [bidDate, setBidDate] = useState('');       
  const [startDate, setStartDate] = useState('');   
  const [contractDays, setContractDays] = useState('');
  const [type, setType] = useState('日曆天');
  
  const [actualEndDate, setActualEndDate] = useState(''); 
  const [inspectDate, setInspectDate] = useState('');     
  const [reInspectDate, setReInspectDate] = useState(''); 
  const [qualifiedDate, setQualifiedDate] = useState(''); 

  // --- 2. 日曆控制變數 ---
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [currentDateField, setCurrentDateField] = useState('');
  const [displayDate, setDisplayDate] = useState(new Date()); 

  const statusOptions = ['未開工', '已開工未進場', '施工中', '完工待驗收', '驗收中', '結案'];
  const typeOptions = ['日曆天', '工作天'];

  const handleSave = () => {
    if (!name || !manager) {
      alert('請填寫專案名稱與工地主任');
      return;
    }
    router.back();
  };

  // --- 3. 日曆核心邏輯 ---
  const openCalendar = (fieldName: string) => {
    setCurrentDateField(fieldName);
    setDisplayDate(new Date()); 
    setCalendarVisible(true);
  };

  const changeMonth = (offset: number) => {
    const newDate = new Date(displayDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setDisplayDate(newDate);
  };

  const selectDate = (day: number) => {
    const year = displayDate.getFullYear();
    const month = displayDate.getMonth() + 1;
    const formattedDate = `${year}/${month < 10 ? '0' + month : month}/${day < 10 ? '0' + day : day}`;
    
    if (currentDateField === 'bidDate') setBidDate(formattedDate);
    if (currentDateField === 'startDate') setStartDate(formattedDate);
    if (currentDateField === 'actualEndDate') setActualEndDate(formattedDate);
    if (currentDateField === 'inspectDate') setInspectDate(formattedDate);
    if (currentDateField === 'reInspectDate') setReInspectDate(formattedDate);
    if (currentDateField === 'qualifiedDate') setQualifiedDate(formattedDate);

    setCalendarVisible(false);
  };

  const renderCalendarDays = () => {
    const year = displayDate.getFullYear();
    const month = displayDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay(); 

    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.dayCellEmpty} />);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(
        <TouchableOpacity key={i} style={styles.dayCell} onPress={() => selectDate(i)}>
          <Text style={styles.dayText}>{i}</Text>
        </TouchableOpacity>
      );
    }
    return days;
  };

  const DateInput = ({ label, value, fieldName, required = false }: any) => (
    <View style={styles.halfField}>
      <Text style={styles.label}>{label} {required && '*'}</Text>
      <TouchableOpacity style={styles.dateInputBtn} onPress={() => openCalendar(fieldName)}>
        <Text style={[styles.dateText, !value && { color: '#999' }]}>{value || '請選擇日期'}</Text>
        <Ionicons name="calendar-outline" size={20} color="#666" />
      </TouchableOpacity>
    </View>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: '新增專案', headerStyle: { backgroundColor: THEME.headerBg }, headerTintColor: '#fff', headerShown: true }} />

      <ScrollView contentContainerStyle={styles.form}>
        
        {/* 基本資料 (這部分就是您要的表單) */}
        <View style={styles.card}>
          <SectionHeader title="基本資料" />
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>專案名稱 *</Text>
            <TextInput style={styles.input} placeholder="例如：台中七期商辦大樓" value={name} onChangeText={setName} />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>工地地址</Text>
            <TextInput style={styles.input} placeholder="例如：台中市西屯區..." value={address} onChangeText={setAddress} />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>工地主任 *</Text>
            <View style={styles.chipContainer}>
              {PERSONNEL_DB.map((p) => (
                <TouchableOpacity key={p.id} style={[styles.chip, manager === p.name && styles.chipSelected]} onPress={() => setManager(p.name)}>
                  <Text style={[styles.chipText, manager === p.name && styles.chipTextSelected]}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* 狀態 */}
        <View style={styles.card}>
          <SectionHeader title="狀態" />
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>施工狀態</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
              {statusOptions.map((s) => (
                <TouchableOpacity key={s} style={[styles.chip, status === s && styles.chipSelected]} onPress={() => setStatus(s)}>
                  <Text style={[styles.chipText, status === s && styles.chipTextSelected]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* 契約與工期 */}
        <View style={styles.card}>
          <SectionHeader title="契約與工期" />
          <View style={styles.row}>
            <DateInput label="決標日期" value={bidDate} fieldName="bidDate" />
            <DateInput label="開工日期" value={startDate} fieldName="startDate" required />
          </View>
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.label}>契約工期 (天) *</Text>
              <TextInput style={styles.input} placeholder="天數" value={contractDays} onChangeText={setContractDays} keyboardType="numeric" />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>工期類型</Text>
              <View style={styles.chipContainer}>
                {typeOptions.map((t) => (
                  <TouchableOpacity key={t} style={[styles.chip, type === t && styles.chipSelected]} onPress={() => setType(t)}>
                    <Text style={[styles.chipText, type === t && styles.chipTextSelected]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* 驗收結束 */}
        <View style={styles.card}>
          <SectionHeader title="驗收結束 (選填)" />
          <View style={styles.row}>
            <DateInput label="實際竣工日" value={actualEndDate} fieldName="actualEndDate" />
            <DateInput label="驗收日期" value={inspectDate} fieldName="inspectDate" />
          </View>
          <View style={styles.row}>
            <DateInput label="複驗日期" value={reInspectDate} fieldName="reInspectDate" />
            <DateInput label="驗收合格日" value={qualifiedDate} fieldName="qualifiedDate" />
          </View>
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleSave}>
          <Text style={styles.submitBtnText}>確認新增</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* --- 小日曆 Modal (保持 320px 寬度) --- */}
      <Modal visible={calendarVisible} transparent animationType="fade" onRequestClose={() => setCalendarVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthBtn}>
                <Ionicons name="chevron-back" size={24} color="#333" />
              </TouchableOpacity>
              <Text style={styles.monthTitle}>{displayDate.getFullYear()}年 {displayDate.getMonth() + 1}月</Text>
              <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthBtn}>
                <Ionicons name="chevron-forward" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <View style={styles.weekHeader}>
              {['日','一','二','三','四','五','六'].map(d => <Text key={d} style={styles.weekText}>{d}</Text>)}
            </View>
            <View style={styles.daysGrid}>{renderCalendarDays()}</View>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setCalendarVisible(false)}>
              <Text style={{color: '#666', fontSize: 16}}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  form: { padding: 15, paddingBottom: 50 },
  card: { backgroundColor: THEME.card, borderRadius: 8, marginBottom: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#eee' },
  sectionHeader: { backgroundColor: THEME.sectionBg, paddingVertical: 10, paddingHorizontal: 15, marginBottom: 10 },
  sectionTitle: { color: THEME.primary, fontWeight: 'bold', fontSize: 16 },
  fieldGroup: { paddingHorizontal: 15, marginBottom: 15 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#555', marginBottom: 8 },
  input: { backgroundColor: '#F9F9F9', borderWidth: 1, borderColor: THEME.border, borderRadius: 6, padding: 12, fontSize: 16, color: '#333' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 15, marginBottom: 15, gap: 10 },
  halfField: { flex: 1 },
  dateInputBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9F9F9', borderWidth: 1, borderColor: THEME.border, borderRadius: 6, padding: 12 },
  dateText: { fontSize: 16, color: '#333' },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  horizontalScroll: { flexDirection: 'row' },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff', marginRight: 8, marginBottom: 5 },
  chipSelected: { backgroundColor: THEME.primary, borderColor: THEME.primary },
  chipText: { color: '#666' },
  chipTextSelected: { color: '#fff', fontWeight: 'bold' },
  submitBtn: { backgroundColor: THEME.primary, padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  submitBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  
  // --- 關鍵：強制日曆寬度為 320，且居中 ---
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  calendarContainer: { width: 320, backgroundColor: '#fff', borderRadius: 16, padding: 20, elevation: 5 },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  monthTitle: { fontSize: 18, fontWeight: 'bold', color: THEME.headerBg },
  monthBtn: { padding: 5 },
  weekHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  weekText: { width: 40, textAlign: 'center', color: '#999', fontWeight: 'bold', fontSize: 14 },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginVertical: 2 },
  dayCellEmpty: { width: 40, height: 40, marginVertical: 2 },
  dayText: { fontSize: 16, color: '#333' },
  cancelBtn: { marginTop: 15, alignItems: 'center', padding: 10, borderTopWidth: 1, borderTopColor: '#eee' }
});