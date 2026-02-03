import { View, Text, FlatList, TouchableOpacity, Alert, StyleSheet, Modal, TextInput, ScrollView, Platform, KeyboardAvoidingView, SafeAreaView, ActivityIndicator, StatusBar } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, createElement, useEffect } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { WebView } from 'react-native-webview';
import { useUser } from '../../context/UserContext';
import Sidebar from '../../components/Sidebar';

import { db } from '../../src/lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';

// SOP Data Interface
interface SOPItem {
  id: string;
  title: string;
  category: '基礎工程' | '結構工程' | '裝修工程' | '安全衛生';
  date: string;
  pdfUrl?: string;
}

const CATEGORIES = ['基礎工程', '結構工程', '裝修工程', '安全衛生'] as const;

export default function SOPScreen() {
  const router = useRouter();
  const { user, logout } = useUser();
  const isSuperAdmin = user?.email === 'wu@dwcc.com.tw';

  // Side Menu State
  const [isSidebarVisible, setSidebarVisible] = useState(false);

  const [sops, setSops] = useState<SOPItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedSOP, setSelectedSOP] = useState<SOPItem | null>(null);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);

  const [newSOP, setNewSOP] = useState<{
    title: string;
    category: SOPItem['category'] | '';
    pdfUri: string;
    pdfName: string;
  }>({ title: '', category: '', pdfUri: '', pdfName: '' });

  // Fetch SOPs from Firestore
  useEffect(() => {
    const q = query(collection(db, 'sop'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: SOPItem[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as SOPItem);
      });
      setSops(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true
      });

      if (result.canceled) return;
      const asset = result.assets[0];
      setNewSOP(prev => ({ ...prev, pdfUri: asset.uri, pdfName: asset.name }));
    } catch (err) {
      Alert.alert('錯誤', '無法選取檔案');
    }
  };

  const handleAddSOP = async () => {
    if (!isSuperAdmin) {
      Alert.alert('權限不足', '僅限超級管理員可執行此操作');
      return;
    }
    if (!newSOP.title || !newSOP.category) {
      Alert.alert('錯誤', '請填寫標題並選擇分類');
      return;
    }

    const data = {
      title: newSOP.title,
      category: newSOP.category,
      date: new Date().toISOString().split('T')[0],
      pdfUrl: newSOP.pdfUri
    };

    try {
      if (isEditMode && currentId) {
        await updateDoc(doc(db, 'sop', currentId), data);
        Alert.alert('成功', 'SOP 已更新');
      } else {
        await addDoc(collection(db, 'sop'), data);
        Alert.alert('成功', 'SOP 已新增');
      }
      setAddModalVisible(false);
      resetForm();
    } catch (error) {
      console.error("Error saving SOP:", error);
      Alert.alert('錯誤', '儲存失敗');
    }
  };

  const handleEdit = (item: SOPItem) => {
    setIsEditMode(true);
    setCurrentId(item.id);
    setNewSOP({
      title: item.title,
      category: item.category,
      pdfUri: item.pdfUrl || '',
      pdfName: item.pdfUrl ? '已上傳檔案' : ''
    });
    setAddModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    const doDelete = async () => {
      try {
        await deleteDoc(doc(db, 'sop', id));
        if (Platform.OS === 'web') {
          window.alert('SOP 已刪除');
        } else {
          Alert.alert('成功', 'SOP 已刪除');
        }
      } catch (error) {
        console.error("Error deleting SOP:", error);
        Alert.alert('錯誤', '刪除失敗');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('確定要刪除此 SOP 嗎？')) {
        await doDelete();
      }
    } else {
      Alert.alert('刪除確認', '確定要刪除此 SOP 嗎？', [
        { text: '取消', style: 'cancel' },
        { text: '刪除', style: 'destructive', onPress: doDelete }
      ]);
    }
  };

  const resetForm = () => {
    setIsEditMode(false);
    setCurrentId(null);
    setNewSOP({ title: '', category: '', pdfUri: '', pdfName: '' });
  };

  const handleOpenView = (item: SOPItem) => {
    if (Platform.OS === 'web' && item.pdfUrl) {
      // Web Specific Handling
      window.open(item.pdfUrl, '_blank');
      return;
    }
    setSelectedSOP(item);
    setViewModalVisible(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F7FA' }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'SOP 資料庫',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => setSidebarVisible(true)}
              style={{ marginLeft: 0, marginRight: 15 }}
            >
              <Ionicons name="menu" size={28} color="#fff" />
            </TouchableOpacity>
          ),
          headerStyle: { backgroundColor: '#002147' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
      <StatusBar barStyle="light-content" backgroundColor="#002147" />

      <FlatList
        data={sops}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }} onPress={() => handleOpenView(item)}>
              <View style={styles.iconContainer}>
                <Ionicons name="document-text" size={24} color="#C69C6D" />
              </View>
              <View style={{ marginLeft: 15, flex: 1 }}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <View style={styles.tagRow}>
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{item.category}</Text>
                  </View>
                  <Text style={styles.dateText}>{item.date}</Text>
                </View>
              </View>
            </TouchableOpacity>

            {isSuperAdmin && (
              <View style={styles.actionButtons}>
                <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionBtn}>
                  <Ionicons name="create-outline" size={22} color="#C69C6D" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionBtn}>
                  <Ionicons name="trash-outline" size={22} color="#FF6B6B" />
                </TouchableOpacity>
              </View>
            )}
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </View>
        )}
        contentContainerStyle={{ padding: 15 }}
      />

      {isSuperAdmin && (
        <TouchableOpacity style={styles.fab} onPress={() => setAddModalVisible(true)}>
          <Ionicons name="add" size={30} color="#fff" />
        </TouchableOpacity>
      )}

      {/* View PDF Modal (Native Only) */}
      <Modal visible={viewModalVisible && Platform.OS !== 'web'} animationType="fade" transparent onRequestClose={() => setViewModalVisible(false)}>
        <View style={styles.fullScreenModal}>
          <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
            <View style={styles.pdfHeader}>
              <TouchableOpacity onPress={() => setViewModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#fff" />
                <Text style={{ color: '#fff', marginLeft: 5 }}>關閉預覽</Text>
              </TouchableOpacity>
              <Text style={styles.pdfTitle} numberOfLines={1}>{selectedSOP?.title}</Text>
            </View>

            <View style={{ flex: 1, backgroundColor: '#f0f0f0' }}>
              {selectedSOP?.pdfUrl ? (
                <WebView
                  source={{ uri: selectedSOP.pdfUrl }}
                  style={{ flex: 1 }}
                  startInLoadingState={true}
                  renderLoading={() => <ActivityIndicator size="large" color="#002147" style={{ position: 'absolute', top: '50%', left: '50%' }} />}
                />
              ) : (
                <View style={styles.centerMsg}>
                  <Text>無 PDF 檔案</Text>
                </View>
              )}
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Add Modal */}
      <Modal visible={addModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.addModalOverlay}>
          <View style={styles.addModalContent}>
            <View style={styles.addModalHeader}>
              <Text style={styles.addModalTitle}>{isEditMode ? '編輯 SOP 文件' : '新增 SOP 文件'}</Text>
              <TouchableOpacity onPress={() => { setAddModalVisible(false); resetForm(); }}>
                <Ionicons name="close" size={26} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Text style={styles.label}>文件標題</Text>
              <TextInput style={styles.input} placeholder="請輸入標題" value={newSOP.title} onChangeText={t => setNewSOP({ ...newSOP, title: t })} />

              <Text style={styles.label}>所屬分類</Text>
              <View style={styles.categoryContainer}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity key={cat} style={[styles.categoryChip, newSOP.category === cat && styles.categoryChipActive]} onPress={() => setNewSOP({ ...newSOP, category: cat })}>
                    <Text style={[styles.categoryText, newSOP.category === cat && styles.categoryTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>上傳 PDF</Text>
              <TouchableOpacity style={styles.uploadBtn} onPress={handlePickDocument}>
                <Ionicons name="cloud-upload-outline" size={24} color="#555" />
                <Text style={styles.uploadText}>{newSOP.pdfName ? newSOP.pdfName : '點擊選擇檔案 (PDF)'}</Text>
              </TouchableOpacity>
              {newSOP.pdfName ? <Text style={styles.fileHint}>已選擇: {newSOP.pdfName}</Text> : null}
            </ScrollView>

            <TouchableOpacity style={styles.submitBtn} onPress={handleAddSOP}>
              <Text style={styles.submitBtnText}>{isEditMode ? '儲存變更' : '確認發布'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Side Menu */}
      {/* Side Menu */}
      <Sidebar
        isVisible={isSidebarVisible}
        onClose={() => setSidebarVisible(false)}
      />

    </View >
  );
}



const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginBottom: 15, padding: 15, borderRadius: 12, elevation: 2, borderWidth: 1, borderColor: '#eee' },
  iconContainer: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#F0F4F8', justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  tagRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  tag: { backgroundColor: '#E3F2FD', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginRight: 8 },
  tagText: { fontSize: 12, color: '#002147', fontWeight: 'bold' },
  dateText: { fontSize: 12, color: '#999' },
  fab: { position: 'absolute', bottom: 30, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#C69C6D', justifyContent: 'center', alignItems: 'center', elevation: 5 },
  actionButtons: { flexDirection: 'row', alignItems: 'center', marginLeft: 10 },
  actionBtn: { padding: 5, marginLeft: 5 },

  // Viewer
  fullScreenModal: { flex: 1, backgroundColor: '#000' },
  pdfHeader: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: '#000', paddingTop: Platform.OS === 'android' ? 40 : 15 },
  closeBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 15 },
  pdfTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', flex: 1 },
  centerMsg: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Add Modal
  addModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  addModalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 25, height: '70%' },
  addModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  addModalTitle: { fontSize: 20, fontWeight: 'bold', color: '#002147' },
  label: { fontSize: 14, color: '#666', marginTop: 15, marginBottom: 10, fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#F9F9F9' },
  categoryContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  categoryChip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', marginRight: 10, marginBottom: 10 },
  categoryChipActive: { backgroundColor: '#002147', borderColor: '#002147' },
  categoryText: { color: '#666' },
  categoryTextActive: { color: '#fff', fontWeight: 'bold' },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#eee', borderStyle: 'dashed', borderRadius: 10, padding: 20, marginTop: 5 },
  uploadText: { marginLeft: 10, color: '#666', fontSize: 16 },
  fileHint: { color: '#C69C6D', fontSize: 12, marginTop: 5, textAlign: 'center' },
  submitBtn: { backgroundColor: '#C69C6D', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 30 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});