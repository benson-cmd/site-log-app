import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useUser } from '../context/UserContext';

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading } = useUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('提示', '請輸入帳號與密碼');
      return;
    }

    const success = await login(email, password);

    if (success) {
      // 登入成功，導向 Dashboard
      router.replace('/dashboard');
    } else {
      Alert.alert('登入失敗', '帳號或密碼錯誤');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Image
          source={require('../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.title}>DW工程日誌系統</Text>

        <View style={styles.formCard}>
          <Text style={styles.label}>帳號</Text>
          <TextInput
            style={styles.input}
            placeholder="請輸入 Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>密碼</Text>
          <TextInput
            style={styles.input}
            placeholder="請輸入密碼"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>登入系統</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footerText}>© 2026 DW Construction Co., Ltd.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#002147',
    marginBottom: 40,
  },
  formCard: {
    width: '100%',
    padding: 25,
    backgroundColor: '#fff',
    borderRadius: 12,
    // Shadow properties for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    // Elevation for Android
    elevation: 4,
    // Border properties corrected - no shorthand 'border'
    borderWidth: 1,
    borderColor: '#eee',
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#f9f9f9',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 20,
    fontSize: 16,
    color: '#333',
  },
  button: {
    backgroundColor: '#002147',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: '#889bb0',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  footerText: {
    marginTop: 50,
    color: '#bbb',
    fontSize: 12,
  }
});