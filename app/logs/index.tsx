import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, SafeAreaView, StatusBar, ScrollView, TextInput, Platform, KeyboardAvoidingView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';

// 定義日誌型別
interface LogEntry {
  id: string;
  date: string;       // YYYY-MM-DD
  project: string;    // 關聯專案名稱
  weather: string;    // 天氣
  temperature: string;// 氣溫
  content: string;    // 施工內容
  reporter: string;   // 填寫人
}

// 模擬資料 (依日期排序)
const MOCK_LOGS: LogEntry[] = [
  {
    id: '1',
    date: '2026-01-20',
    project: '台中七期商辦',
    weather: '晴 ☀️',
    temperature: '24°C',
    content: '1. 1F 柱牆鋼筋綁紮查驗\n2. B1F 模板拆除作業\n3. 工地現場環境整理',
    reporter: '吳資彬'
  },
  {
    id: '2',
    date: '2026-01-19',
    project: '台中七期商辦',
    weather: '陰 ☁️',
    temperature: '20°C',
    content: '1. B1F 混凝土澆置養護\n2. 進場材料：鋼筋 50 噸\n3. 勞安巡檢：正常',
    reporter: '陳曉華'
  },
  {
    id: '3',
    date: '2026-01-18',
    project: '高雄亞灣住宅案',
    weather: '雨 🌧️',
    temperature: '18°C',
    content: '1. 暫停戶外吊掛作業\n2. 室內泥作粉刷\n3. 機電管路預埋',
    reporter: '林建國'
  },
];

export default function LogsScreen() {
  const router = useRouter();
  const [logs, setLogs] = useState<LogEntry[]>(MOCK_LOGS);

  // Modal States
  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [newLog, setNewLog] = useState<Partial<LogEntry>>({
    project: '', date: '', weather: '', temperature: '', content: '', reporter: ''
  });

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
      {/* Header: Date & Weather */}
      <View style={styles.cardHeader}>
        <View style={styles.dateBadge}>
          <Ionicons name="calendar-outline" size={16} color="#fff" />
          <Text style={styles.dateText}>{item.date}</Text>
        </View>
        <View style={styles.weatherContainer}>
          <Text style={styles.weatherText}>{item.weather} {item.temperature}</Text>
        </View>
      </View>

      {/* Project Info */}
      <Text style={styles.projectTitle}>{item.project}</Text>

      {/* Content */}
      <View style={styles.contentBox}>
        <Text style={styles.contentLabel}>施工內容：</Text>
        <Text style={styles.contentText}>{item.content}</Text>
      </View>

      {/* Footer */}
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

      {/* FAB - Add Log */}
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
              <Text style={styles.inputLabel}>日期 (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                placeholder="2026-01-20"
                value={newLog.date}
                onChangeText={t => setNewLog({ ...newLog, date: t })}
              />

              <Text style={styles.inputLabel}>專案名稱</Text>
              <TextInput
                style={styles.input}
                placeholder="請輸入專案名稱"
                value={newLog.project}
                onChangeText={t => setNewLog({ ...newLog, project: t })}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.inputLabel}>天氣</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="晴/雨"
                    value={newLog.weather}
                    onChangeText={t => setNewLog({ ...newLog, weather: t })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>氣溫</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="25°C"
                    value={newLog.temperature}
                    onChangeText={t => setNewLog({ ...newLog, temperature: t })}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>施工內容重點</Text>
              <TextInput
                style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                placeholder="1. ..."
                multiline
                value={newLog.content}
                onChangeText={t => setNewLog({ ...newLog, content: t })}
              />

              <Text style={styles.inputLabel}>填寫人</Text>
              <TextInput
                style={styles.input}
                placeholder="您的姓名"
                value={newLog.reporter}
                onChangeText={t => setNewLog({ ...newLog, reporter: t })}
              />
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
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 15,
    padding: 15,
    // Shadow
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#eee'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dateBadge: {
    flexDirection: 'row',
    backgroundColor: '#002147',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    alignItems: 'center',
  },
  dateText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  weatherContainer: {
    backgroundColor: '#FFF8E1',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  weatherText: {
    color: '#F9A825',
    fontSize: 12,
    fontWeight: 'bold',
  },
  projectTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  contentBox: {
    backgroundColor: '#F5F7FA',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  contentLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 5,
  },
  contentText: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
    marginTop: 5,
  },
  reporterText: {
    fontSize: 12,
    color: '#999',
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#C69C6D',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#C69C6D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '85%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#002147',
  },
  modalBody: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 15,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
  },
  submitBtn: {
    backgroundColor: '#C69C6D',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20, // safe area
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});