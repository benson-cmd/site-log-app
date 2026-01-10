import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useState } from 'react';

const THEME = {
  primary: '#C69C6D',       // 金色
  background: '#F5F7FA',    // 淺灰底
  headerBg: '#002147',      // 深藍色
  card: '#ffffff',
  text: '#333'
};

export default function NewProjectScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [manager, setManager] = useState('');

  const handleSave = () => {
    // 簡單驗證
    if (!name || !manager) {
      if (Platform.OS === 'web') alert('請填寫專案名稱與主任');
      else Alert.alert('提示', '請填寫專案名稱與主任');
      return;
    }

    // 這裡未來會連接資料庫，現在先模擬成功
    if (Platform.OS === 'web') alert('新增成功！(測試)');
    else Alert.alert('成功', '專案已建立');
    
    // 回到上一頁
    router.back();
  };

  return (
    <View style={styles.container}>
      {/* 設定這一頁的標題欄 */}
      <Stack.Screen 
        options={{
          title: '新增專案',
          headerStyle: { backgroundColor: THEME.headerBg },
          headerTintColor: '#fff',
          headerBackTitle: '返回',
          headerShown: true // 確保這裡顯示標題列
        }} 
      />

      <ScrollView contentContainerStyle={styles.form}>
        <View style={styles.card}>
          <Text style={styles.title}>基本資料</Text>
          
          <Text style={styles.label}>專案名稱 *</Text>
          <TextInput 
            style={styles.input} 
            placeholder="例如：台中七期商辦大樓" 
            placeholderTextColor="#999"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>工地地址</Text>
          <TextInput 
            style={styles.input} 
            placeholder="例如：台中市西屯區..." 
            placeholderTextColor="#999"
            value={address}
            onChangeText={setAddress}
          />

          <Text style={styles.label}>工地主任 *</Text>
          <TextInput 
            style={styles.input} 
            placeholder="請輸入姓名" 
            placeholderTextColor="#999"
            value={manager}
            onChangeText={setManager}
          />

          <TouchableOpacity style={styles.btn} onPress={handleSave}>
            <Text style={styles.btnText}>確認新增</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  form: { padding: 20 },
  card: {
    backgroundColor: THEME.card,
    padding: 25,
    borderRadius: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2
  },
  title: { fontSize: 20, fontWeight: 'bold', color: THEME.headerBg, marginBottom: 20 },
  label: { fontSize: 16, fontWeight: 'bold', color: '#555', marginBottom: 8 },
  input: {
    backgroundColor: '#F9F9F9',
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8,
    padding: 12, fontSize: 16, marginBottom: 20, color: '#333'
  },
  btn: {
    backgroundColor: THEME.primary,
    padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10
  },
  btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});