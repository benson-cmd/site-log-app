import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Image, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useState } from 'react';
import { useUser } from '../context/UserContext';
import { useRouter, Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

// 定義明亮主題配色
const THEME = {
  background: '#ffffff', // 純白背景
  textPrimary: '#002147', // 深藍主色
  textSecondary: '#666666', // 深灰次要色
  accent: '#C69C6D', // 金色強調色
  inputBg: '#F5F5F5', // 輸入框淺灰背景
  inputBorder: '#E0E0E0', // 輸入框邊框
  placeholder: '#999999' // 提示文字灰色
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading } = useUser();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('錯誤', '請輸入帳號與密碼');
      return;
    }

    const success = await login(email, password);
    if (success) {
      Alert.alert('成功', '登入成功！', [
        { text: 'OK', onPress: () => router.replace('/') }
      ]);
    } else {
      Alert.alert('登入失敗', '帳號或密碼錯誤，請重試。');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.formContainer}>
          {/* Logo */}
          <Image
            source={require('../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          {/* 主標題 */}
          <Text style={styles.title}>DW工程日誌系統</Text>

          {/* 已移除「德旺營造」副標題 */}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>帳號 (Email)</Text>
            <TextInput
              style={styles.input}
              placeholder="請輸入Email"
              placeholderTextColor={THEME.placeholder}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>密碼</Text>
            <TextInput
              style={styles.input}
              placeholder="請輸入密碼"
              placeholderTextColor={THEME.placeholder}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>{isLoading ? '登入中...' : '登入系統'}</Text>
          </TouchableOpacity>


          {/* === 新增這一段：忘記密碼 === */}
          <Link href="/forgot-password" asChild>
            <TouchableOpacity style={{ marginTop: 15 }}>
              <Text style={{ color: '#666666', textDecorationLine: 'underline' }}>
                忘記密碼？
              </Text>
            </TouchableOpacity>
          </Link>

          {/* ... 下面是註冊連結 ... */}
          <Link href="/register" asChild>
            <TouchableOpacity style={styles.linkButton}>
              <Text style={styles.linkText}>沒有帳號？申請註冊</Text>
            </TouchableOpacity>
          </Link>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 220, // 稍微加大一點 Logo
    height: 70,
    marginBottom: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: THEME.textPrimary,
    marginBottom: 40, // 增加間距，讓標題跟輸入框分開一點，取代原本副標題的位置
    textAlign: 'center',
  },
  inputGroup: {
    width: '100%',
    marginBottom: 20,
  },
  label: {
    color: '#333333',
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: THEME.inputBg,
    borderWidth: 1,
    borderColor: THEME.inputBorder,
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    color: '#000000',
  },
  button: {
    width: '100%',
    backgroundColor: THEME.accent,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#C69C6D', // 增加一點金色陰影讓按鈕更立體
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  linkButton: {
    marginTop: 20,
    padding: 10,
  },
  linkText: {
    color: THEME.textPrimary,
    fontSize: 16,
    textAlign: 'center',
  },
});