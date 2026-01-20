import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, SafeAreaView, StatusBar, ScrollView, TextInput, Platform, KeyboardAvoidingView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useProjects } from '../../context/ProjectContext';
import { useUser } from '../../context/UserContext';

interface LogEntry {
  id: string;
  date: string;       // YYYY-MM-DD
  project: string;    // 關聯專案名稱
  weather: string;    // 天氣
  temperature: string;// 氣溫
  content: string;    // 施工內容
  reporter: string;   // 填寫人
}

// 模擬資料 (依日期排序) - 初始可保留，但 Ideally 應移至 LogContext
const MOCK_LOGS: LogEntry[] = [
  {
    id: '1',
    date: '2026-01-20',
    project: '台中七期商辦大樓',
    weather: '晴 ☀️',
    temperature: '24°C',
    content: '1. 1F 柱牆鋼筋綁紮查驗\n2. B1F 模板拆除作業\n3. 工地現場環境整理',
    reporter: '吳資彬'
  },
  {
    id: '2',
    date: '2026-01-19',
    project: '台中七期商辦大樓',
    weather: '陰 ☁️',
    temperature: '20°C',
    content: '1. B1F 混凝土澆置養護\n2. 進場材料：鋼筋 50 噸\n3. 勞安巡檢：正常',
    reporter: '陳曉華'
  }
];

export default function LogsScreen() {
  const router = useRouter();
  const { projects } = useProjects();
  const { user } = useUser();
  const [logs, setLogs] = useState<LogEntry[]>(MOCK_LOGS);

  // Modal States
  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [newLog, setNewLog] = useState<Partial<LogEntry>>({
    project: '', date: '', weather: '', temperature: '', content: '', reporter: ''
  });

  // Project Selection
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  useEffect(() => {
    // Auto-fill reporter and date when modal opens
    if (isAddModalVisible) {
      setNewLog(prev => ({
        ...prev,
        date: new Date().toISOString().split('T')[0],
        reporter: user?.name || '使用者'
      }));
    }
  }, [isAddModalVisible, user]);

  // 日期排序 (新 -> 舊)
  const sortedLogs = [...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleAddLog = () => {
    if (!newLog.project || !newLog.content || !newLog.date) {
      Alert.alert('錯誤', '請填寫完整資訊 (專案、日期、內容)');
      return;
    }
    const entry: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      date: newLog.date,
      project: newLog.project,
      weather: newLog.weather || '晴',
      temperature: newLog.temperature || '25°C',
      content: newLog.content,
      reporter: newLog.reporter || '使用者'
    };
    setLogs([entry, ...logs]);
    setAddModalVisible(false);
    setNewLog({ project: '', date: '', weather: '', temperature: '', content: '', reporter: '' });
    Alert.alert('成功', '施工日誌已新增');
  };

  const LogCard = ({ item }: { item: LogEntry }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.dateBadge}>
          <Ionicons name="calendar-outline" size={16} color="#fff" />
          <Text style={styles.dateText}>{item.date}</Text>
        </View>
        <View style={styles.weatherContainer}>
          <Text style={styles.weatherText}>{item.weather} {item.temperature}</Text>
        </View>
      </View>
      <Text style={styles.projectTitle}>{item.project}</Text>
      <View style={styles.contentBox}>
        <Text style={styles.contentLabel}>施工內容：</Text>
        <Text style={styles.contentText}>{item.content}</Text>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.reporterText}>填寫人：{item.reporter}</Text>
        <TouchableOpacity onPress={() => Alert.alert('編輯', `編輯 ${item.date} 日誌`)}>
          <Ionicons name="create-outline" size={20} color="#C69C6D" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F7FA' }}>
      <Stack.Screen options={{ title: '施工紀錄', headerShown: true, headerStyle: { backgroundColor: '#002147' }, headerTintColor: '#fff' }} />
      <StatusBar barStyle="light-content" />

      <FlatList
        data={sortedLogs}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <LogCard item={item} />}
        contentContainerStyle={{ padding: 15, paddingBottom: 100 }}
        ListEmptyComponent={<View style={{ alignItems: 'center', marginTop: 50 }}><Text style={{ color: '#999' }}>尚無施工紀錄</Text></View>}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setAddModalVisible(true)}>
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      {/* Add Modal */}
      <Modal visible={isAddModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>新增施工日誌</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>專案名稱 (下拉選擇)</Text>

              {!showProjectPicker ? (
                <TouchableOpacity style={styles.selectBtn} onPress={() => setShowProjectPicker(true)}>
                  <Text style={{ color: newLog.project ? '#333' : '#999', fontSize: 16 }}>
                    {newLog.project || '請選擇專案...'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#666" />
                </TouchableOpacity>
              ) : (
                <View style={styles.pickerContainer}>
                  {projects.map(p => (
                    <TouchableOpacity
                      key={p.id}
                      style={styles.pickerItem}
                      onPress={() => { setNewLog({ ...newLog, project: p.name }); setShowProjectPicker(false); }}
                    >
                      <Text style={styles.pickerText}>{p.name}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={[styles.pickerItem, { borderBottomWidth: 0 }]} onPress={() => setShowProjectPicker(false)}>
                    <Text style={{ color: '#FF6B6B' }}>取消選擇</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.inputLabel}>日期</Text>
              <TextInput style={styles.input} placeholder="YYYY-MM-DD" value={newLog.date} onChangeText={t => setNewLog({ ...newLog, date: t })} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.inputLabel}>天氣</Text>
                  <TextInput style={styles.input} placeholder="晴/雨" value={newLog.weather} onChangeText={t => setNewLog({ ...newLog, weather: t })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>氣溫</Text>
                  <TextInput style={styles.input} placeholder="25°C" value={newLog.temperature} onChangeText={t => setNewLog({ ...newLog, temperature: t })} />
                </View>
              </View>

              <Text style={styles.inputLabel}>施工內容重點</Text>
              <TextInput style={[styles.input, { height: 100, textAlignVertical: 'top' }]} placeholder="1. ..." multiline value={newLog.content} onChangeText={t => setNewLog({ ...newLog, content: t })} />

              {/* Photo Placeholder */}
              <TouchableOpacity style={styles.photoBox} onPress={() => Alert.alert('提示', '上傳照片功能 (預留區塊)')}>
                <Ionicons name="camera" size={30} color="#ccc" />
                <Text style={{ color: '#999', marginTop: 5 }}>點擊上傳施工照片 (0/5)</Text>
              </TouchableOpacity>

              <Text style={styles.inputLabel}>填寫人 (自動帶入)</Text>
              <TextInput style={[styles.input, { backgroundColor: '#eee' }]} value={newLog.reporter} editable={false} />
            </ScrollView>

            <TouchableOpacity style={styles.submitBtn} onPress={handleAddLog}>
              <Text style={styles.submitBtnText}>提交日報表</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 15, padding: 15, elevation: 3, borderWidth: 1, borderColor: '#eee' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dateBadge: { flexDirection: 'row', backgroundColor: '#002147', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 20, alignItems: 'center' },
  dateText: { color: '#fff', fontSize: 12, fontWeight: 'bold', marginLeft: 5 },
  weatherContainer: { backgroundColor: '#FFF8E1', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8 },
  weatherText: { color: '#F9A825', fontSize: 12, fontWeight: 'bold' },
  projectTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  contentBox: { backgroundColor: '#F5F7FA', padding: 10, borderRadius: 8, marginBottom: 10 },
  contentLabel: { fontSize: 12, color: '#999', marginBottom: 5 },
  contentText: { fontSize: 15, color: '#444', lineHeight: 22 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10, marginTop: 5 },
  reporterText: { fontSize: 12, color: '#999' },
  fab: { position: 'absolute', bottom: 30, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#C69C6D', justifyContent: 'center', alignItems: 'center', elevation: 5 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '85%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#002147' },
  modalBody: { flex: 1 },
  inputLabel: { fontSize: 14, color: '#666', marginTop: 15, marginBottom: 5, fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#F9F9F9' },
  submitBtn: { backgroundColor: '#C69C6D', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 20, marginBottom: 20 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // Picker
  selectBtn: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, backgroundColor: '#F9F9F9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerContainer: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginTop: 5, overflow: 'hidden' },
  pickerItem: { padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  pickerText: { fontSize: 16, color: '#333' },

  // Photo
  photoBox: { marginTop: 20, height: 100, borderStyle: 'dashed', borderWidth: 2, borderColor: '#ddd', borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAFA' }
});