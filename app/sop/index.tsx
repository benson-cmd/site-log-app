import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../../context/UserContext';
import { useState } from 'react';

const THEME = {
  primary: '#C69C6D',
  background: '#F5F7FA',
  card: '#ffffff',
  headerBg: '#002147',
  text: '#333333'
};

type SOPItem = {
  id: string;
  title: string;
  category: string;
  date: string;
};

const MOCK_SOP: SOPItem[] = [
  { id: '1', title: '模板支撐作業標準', category: '結構工程', date: '2023-10-01' },
  { id: '2', title: '鋼筋綁紮查驗規範', category: '結構工程', date: '2023-10-05' },
];

export default function SOPScreen() {
  const router = useRouter();
  const { user } = useUser();
  
  // ⭐️ 修正重點：手動判斷是否為管理員，解決 isAdmin 報錯
  const isAdmin = user?.role === 'admin';

  const [sops, setSops] = useState<SOPItem[]>(MOCK_SOP);

  const handleDelete = (id: string) => {
    Alert.alert('確認刪除', '確定要刪除這份 SOP 嗎？', [
      { text: '取消', style: 'cancel' },
      { 
        text: '刪除', 
        style: 'destructive',
        onPress: () => setSops(prev => prev.filter(item => item.id !== id))
      }
    ]);
  };

  const renderItem = ({ item }: { item: SOPItem }) => (
    <TouchableOpacity style={styles.card} onPress={() => Alert.alert('開啟文件', `正在預覽: ${item.title}`)}>
      <View style={styles.iconContainer}>
        <Ionicons name="document-text-outline" size={24} color={THEME.primary} />
      </View>
      <View style={styles.infoContainer}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subInfo}>{item.category} • {item.date}</Text>
      </View>
      {isAdmin && (
        <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={20} color="#ff4444" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          title: 'SOP 標準作業',
          headerStyle: { backgroundColor: THEME.headerBg },
          headerTintColor: '#fff',
          headerShadowVisible: false,
        }} 
      />
      <FlatList
        data={sops}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />
      {isAdmin && (
        <TouchableOpacity style={styles.fab} onPress={() => Alert.alert('提示', '這裡未來可實作上傳功能')}>
          <Ionicons name="add" size={30} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  listContent: { padding: 15 },
  card: { backgroundColor: THEME.card, padding: 15, borderRadius: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  iconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF9F0', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  infoContainer: { flex: 1 },
  title: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  subInfo: { fontSize: 12, color: '#999', marginTop: 4 },
  deleteBtn: { padding: 8 },
  fab: { position: 'absolute', right: 20, bottom: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: THEME.primary, justifyContent: 'center', alignItems: 'center', elevation: 8 }
});