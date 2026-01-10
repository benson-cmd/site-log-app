import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useUser } from '../context/UserContext'; 

// --- 1. 改回明亮色系主題 ---
const THEME = {
  primary: '#C69C6D',       // 金色按鈕
  background: '#ffffff',    // 白底 (關鍵修改)
  card: '#ffffff',          // 卡片也是白的
  text: '#002147',          // 深藍色字體
  textSec: '#666666',       // 灰色副標
  inputBg: '#F5F5F5',       // 淺灰輸入框背景
  border: '#E0E0E0'         // 淺灰邊框
};

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useUser();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    // 2. 加入除錯檢查
    console.log('輸入的帳號:', email);
    console.log('輸入的密碼:', password);

    if (!email || !password) {
      if (Platform.OS === 'web') {
        alert('請輸入帳號與密碼');
      } else {
        Alert.alert('錯誤', '請輸入帳號與密碼');
      }
      return;
    }

    // 3. 萬用登入邏輯 (包含 admin)
    if ((email === 'admin' && password === 'admin') || (email && password)) {
      // 這裡您可以選擇是否要呼叫 login(email)，目前先直接跳轉
      router.replace('/projects');
    } else {
      alert('登入失敗');
    }
  };

  const handleRegister = () => {
    router.push('/register');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.logoArea}>
          <Text style={styles.logoText}>DW工程日誌系統</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>帳號 (Email)</Text>
          <TextInput 
            style={styles.input} 
            placeholder="請輸入帳號 (admin)" 
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail} // 確保這裡綁定正確
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>密碼</Text>
          <TextInput 
            style={styles.input} 
            placeholder="請輸入密碼 (admin)" 
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity style={styles.btn} onPress={handleLogin}>
            <Text style={styles.btnText}>登入系統</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => alert('請聯絡管理員重設密碼')}>
            <Text style={styles.forgot}>忘記密碼？</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity onPress={handleRegister} style={styles.registerContainer}>
            <Text style={styles.registerText}>沒有帳號？申請註冊</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  
  logoArea: { alignItems: 'center', marginBottom: 40 },
  logoText: { fontSize: 32, fontWeight: 'bold', color: THEME.text, marginTop: 10 },
  
  card: { 
    backgroundColor: THEME.card, 
    padding: 30, 
    borderRadius: 16, 
    // 增加陰影讓白底卡片在白背景上浮起來
    shadowColor: '#000', 
    shadowOpacity: 0.1, 
    shadowRadius: 10, 
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
    borderWidth: 1,
    borderColor: '#f0f0f0'
  },
  
  label: { fontWeight: 'bold', marginBottom: 8, color: '#333', fontSize: 16 },
  
  // 修正輸入框樣式，確保文字是黑色的
  input: { 
    backgroundColor: THEME.inputBg, 
    padding: 15, 
    borderRadius: 8, 
    marginBottom: 20, 
    fontSize: 16, 
    borderWidth: 1, 
    borderColor: THEME.border,
    color: '#000000' // 強制文字黑色
  },
  
  btn: { backgroundColor: THEME.primary, padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  forgot: { color: '#666', textAlign: 'center', marginTop: 15, textDecorationLine: 'underline' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 20 },
  registerContainer: { alignItems: 'center' },
  registerText: { color: THEME.text, fontWeight: 'bold', fontSize: 16 }
});