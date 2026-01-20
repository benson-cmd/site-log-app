import { View, Text, FlatList, TouchableOpacity, Alert, StyleSheet, Modal, TextInput, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';

// 本地數據模擬 (Mock Data)
interface SOPItem {
  id: string;
  title: string;
  category: string;
  date: string;
  content: string; // 詳情內容
}

export default function SOPScreen() {
  const [sops, setSops] = useState<SOPItem[]>([
    { id: '1', title: '地基開挖作業標準', category: '基礎工程', date: '2023-12-01', content: '1. 確認地下管線分佈\n2.設置安全圍籬\n3.監測鄰房傾斜度...' },
    { id: '2', title: '鋼筋綁紮規範', category: '結構工程', date: '2023-12-05', content: '1.確認鋼筋號數\n2.綁紮間距需符合設計圖...' }
  ]);

  // View Modal
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedSOP, setSelectedSOP] = useState<SOPItem | null>(null);

  // Add Modal
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newSOP, setNewSOP] = useState({ title: '', category: '', content: '' });

  const handleOpenView = (item: SOPItem) => {
    setSelectedSOP(item);
    setViewModalVisible(true);
  };

  const handleAddSOP = () => {
    if (!newSOP.title || !newSOP.content) {
      Alert.alert('錯誤', '請填寫標題與內容');
      return;
    }
    const newItem: SOPItem = {
      id: Math.random().toString(36).substr(2, 9),
      title: newSOP.title,
      category: newSOP.category || '未分類',
      date: new Date().toISOString().split('T')[0],
      content: newSOP.content
    };
    setSops(prev => [newItem, ...prev]);
    setAddModalVisible(false);
    setNewSOP({ title: '', category: '', content: '' });
    Alert.alert('成功', 'SOP 文件已新增');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F7FA' }}>
      <Stack.Screen options={{ title: 'SOP 資料庫', headerShown: true, headerStyle: { backgroundColor: '#002147' }, headerTintColor: '#fff' }} />

      <FlatList
        data={sops}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => handleOpenView(item)}>
            <Ionicons name="document-text" size={24} color="#C69C6D" />
            <View style={{ marginLeft: 15, flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>{item.title}</Text>
              <Text style={{ color: '#999', fontSize: 13, marginTop: 2 }}>{item.category} | {item.date}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setAddModalVisible(true)}>
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      {/* View Detail Modal */}
      <Modal visible={viewModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.viewCard}>
            <View style={styles.viewHeader}>
              <Text style={styles.viewTitle}>{selectedSOP?.title}</Text>
              <TouchableOpacity onPress={() => setViewModalVisible(false)}>
                <Ionicons name="close-circle" size={30} color="#999" />
              </TouchableOpacity>
            </View>
            <View style={styles.badgeRow}>
              <View style={styles.badge}><Text style={styles.badgeText}>{selectedSOP?.category}</Text></View>
              <Text style={styles.dateText}>{selectedSOP?.date}</Text>
            </View>
            <ScrollView style={{ marginTop: 15, maxHeight: 300 }}>
              <Text style={styles.contentBody}>{selectedSOP?.content}</Text>
            </ScrollView>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setViewModalVisible(false)}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>關閉</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add SOP Modal */}
      <Modal visible={addModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.slideModalContainer}>
          <View style={styles.slideModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>新增 SOP 文件</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}><Ionicons name="close" size={24} color="#333" /></TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={styles.label}>標題</Text>
              <TextInput style={styles.input} placeholder="例：高空作業規範" value={newSOP.title} onChangeText={t => setNewSOP({ ...newSOP, title: t })} />

              <Text style={styles.label}>分類</Text>
              <TextInput style={styles.input} placeholder="例：安全衛生" value={newSOP.category} onChangeText={t => setNewSOP({ ...newSOP, category: t })} />

              <Text style={styles.label}>詳細內容</Text>
              <TextInput
                style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
                placeholder="請輸入詳細規範內容..."
                multiline
                value={newSOP.content}
                onChangeText={t => setNewSOP({ ...newSOP, content: t })}
              />
            </ScrollView>
            <TouchableOpacity style={styles.submitBtn} onPress={handleAddSOP}>
              <Text style={styles.submitBtnText}>發布</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 15, marginVertical: 8, padding: 15, borderRadius: 10, elevation: 2, borderWidth: 1, borderColor: '#eee' },
  fab: { position: 'absolute', bottom: 30, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#C69C6D', justifyContent: 'center', alignItems: 'center', elevation: 5 },

  // View Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  viewCard: { backgroundColor: '#fff', borderRadius: 15, padding: 25 },
  viewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  viewTitle: { fontSize: 22, fontWeight: 'bold', color: '#002147', flex: 1 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  badge: { backgroundColor: '#E3F2FD', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, marginRight: 10 },
  badgeText: { color: '#002147', fontSize: 12, fontWeight: 'bold' },
  dateText: { color: '#999', fontSize: 12 },
  contentBody: { fontSize: 16, color: '#444', lineHeight: 24 },
  closeBtn: { backgroundColor: '#002147', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 20 },

  // Add Modal (Slide up)
  slideModalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  slideModalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, height: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#002147' },
  label: { fontSize: 14, color: '#666', marginBottom: 5, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16 },
  submitBtn: { backgroundColor: '#C69C6D', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 30 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});