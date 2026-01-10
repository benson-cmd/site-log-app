import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useUser } from '../context/UserContext'; 

const THEME = {
  primary: '#C69C6D',
  background: '#ffffff',
  card: '#ffffff',
  text: '#002147',
  inputBg: '#F5F5F5',
  border: '#E0E0E0'
};

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useUser();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      alert('請輸入帳號與密碼');
      return;
    }

    setLoading(true);
    setTimeout(async () => {
      // 模擬登入
      if ((email === 'admin' && password === 'admin') || (email && password)) {
        await login(email, password); 
        router.replace('/projects');
      } else {
        alert('登入失敗');
        setLoading(false);
      }
    }, 500);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.logoArea}>
          {/* Logo 放大至 width: 180 */}
          <Image 
            source={require('../assets/logo.png')} 
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.logoText}>DW工程日誌系統</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>帳號 (Email)</Text>
          <TextInput 
            style={styles.input} 
            placeholder="請輸入帳號" 
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
          />

          <Text style={styles.label}>密碼</Text>
          <TextInput 
            style={styles.input} 
            placeholder="請輸入密碼"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
            <Text style={styles.btnText}>{loading ? '登入中...' : '登入系統'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => alert('請聯絡管理員重設密碼')}>
            <Text style={styles.forgot}>忘記密碼？</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity onPress={() => router.push('/register')} style={styles.registerContainer}>
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
  // 修改這裡：加大 Logo
  logoImage: { width: 180, height: 180, marginBottom: 15 },
  logoText: { fontSize: 32, fontWeight: 'bold', color: THEME.text },
  card: { 
    backgroundColor: THEME.card, padding: 30, borderRadius: 16, 
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 5 },
    elevation: 5, borderWidth: 1, borderColor: '#f0f0f0'
  },
  label: { fontWeight: 'bold', marginBottom: 8, color: '#333', fontSize: 16 },
  input: { 
    backgroundColor: THEME.inputBg, padding: 15, borderRadius: 8, marginBottom: 20, fontSize: 16, 
    borderWidth: 1, borderColor: THEME.border, color: '#000' 
  },
  btn: { backgroundColor: THEME.primary, padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  forgot: { color: '#666', textAlign: 'center', marginTop: 15, textDecorationLine: 'underline' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 20 },
  registerContainer: { alignItems: 'center' },
  registerText: { color: THEME.text, fontWeight: 'bold', fontSize: 16 }
});