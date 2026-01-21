import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useUser } from '../context/UserContext';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../src/lib/firebase';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading } = useUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Forgot Password State
  const [isForgotModalVisible, setForgotModalVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('提示', '請輸入帳號與密碼');
      return;
    }

    const success = await login(email, password);

    if (success) {
      router.replace('/dashboard');
    } else {
      Alert.alert('登入失敗', '帳號或密碼錯誤');
    }
  };

  const handleForgotPassword = async () => {
    if (!resetEmail.trim()) {
      Alert.alert('提示', '請輸入 Email');
      return;
    }

    setIsResetting(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      if (Platform.OS === 'web') {
        window.alert('重設郵件已發送，請檢查您的信箱（含垃圾郵件匣）。');
      } else {
        Alert.alert('重設郵件已發送，請檢查您的信箱（含垃圾郵件匣）。');
      }
      setForgotModalVisible(false);
      setResetEmail('');
    } catch (error: any) {
      console.error("Reset Error", error);
      let msg = '發送失敗：請確認此 Email 已註冊，或稍後再試。';

      if (error.code === 'auth/network-request-failed') {
        msg = '網路連線不穩定，請檢查您的網路狀態。';
      }

      Alert.alert('發送失敗', `${msg}\n(錯誤代碼: ${error.code})`);
    } finally {
      setIsResetting(false);
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

          <TouchableOpacity style={styles.forgotBtn} onPress={() => setForgotModalVisible(true)}>
            <Text style={styles.forgotText}>忘記密碼？</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerText}>© 2026 DW Construction Co., Ltd.</Text>

        {/* Forgot Password Modal */}
        <Modal visible={isForgotModalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>重設密碼</Text>
                <TouchableOpacity onPress={() => setForgotModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalDesc}>請輸入您的註冊 Email，我們將發送重設信件給您。</Text>

              <TextInput
                style={styles.input}
                placeholder="輸入 Email"
                value={resetEmail}
                onChangeText={setResetEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <TouchableOpacity
                style={[styles.button, isResetting && styles.buttonDisabled]}
                onPress={handleForgotPassword}
                disabled={isResetting}
              >
                {isResetting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>發送重設信件</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

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
  forgotBtn: {
    marginTop: 15,
    alignSelf: 'center',
    padding: 5
  },
  forgotText: {
    color: '#C69C6D',
    fontSize: 14,
    fontWeight: 'bold'
  },
  footerText: {
    marginTop: 50,
    color: '#bbb',
    fontSize: 12,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 25,
    elevation: 5
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#002147'
  },
  modalDesc: {
    color: '#666',
    marginBottom: 20,
    lineHeight: 20
  }
});