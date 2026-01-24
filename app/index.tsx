import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Modal, ImageBackground, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useUser } from '../context/UserContext';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../src/lib/firebase';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

const THEME = {
  primary: '#002147',
  accent: '#C69C6D',
  background: '#F5F7FA',
  placeholder: '#999999',
  inputBg: '#f9f9f9',
  border: '#e0e0e0'
};

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

      if (Platform.OS === 'web') {
        window.alert(`發送失敗\n${msg}\n(錯誤代碼: ${error.code})`);
      } else {
        Alert.alert('發送失敗', `${msg}\n(錯誤代碼: ${error.code})`);
      }
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1541888941259-7907ff14e94b?q=80&w=2070&auto=format&fit=crop' }}
      style={styles.backgroundImage}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <StatusBar style="light" />
          <SafeAreaView style={{ flex: 1 }}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.loginCard}>
                {/* Logo Section */}
                <View style={styles.logoBadge}>
                  <Image
                    source={require('../assets/logo.png')}
                    style={styles.logo}
                    resizeMode="contain"
                  />
                  <Text style={styles.title}>DW工程日誌系統</Text>
                </View>

                {/* Account Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>帳號 (Email)</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="mail-outline" size={20} color={THEME.accent} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="請輸入 Email"
                      placeholderTextColor={THEME.placeholder}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </View>
                </View>

                {/* Password Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>密碼</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="lock-closed-outline" size={20} color={THEME.accent} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="請輸入密碼"
                      placeholderTextColor={THEME.placeholder}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                    />
                  </View>
                </View>

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
            </ScrollView>

            <View style={styles.footer}>
              <Text style={styles.footerText}>© 2026 DW Construction Co., Ltd. All Rights Reserved.</Text>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>

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
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  loginCard: {
    width: '100%',
    maxWidth: 450,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 40,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.58,
    shadowRadius: 16.00,
    elevation: 24,
  },
  logoBadge: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 200,
    height: 60,
    marginBottom: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: THEME.primary,
    textAlign: 'center',
    letterSpacing: 1,
  },
  inputGroup: {
    width: '100%',
    marginBottom: 20,
  },
  label: {
    color: THEME.primary,
    marginBottom: 10,
    fontWeight: '700',
    fontSize: 14,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    height: 54,
  },
  inputIcon: {
    paddingLeft: 15,
    paddingRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
    paddingRight: 15,
    height: '100%',
  },
  button: {
    width: '100%',
    backgroundColor: THEME.primary,
    height: 54,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
  },
  forgotBtn: {
    marginTop: 20,
    alignSelf: 'center',
    padding: 5
  },
  forgotText: {
    color: THEME.accent,
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    textAlign: 'center',
  },
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