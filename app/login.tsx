import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, ImageBackground, SafeAreaView } from 'react-native';
import { useState } from 'react';
import { useUser } from '../context/UserContext';
import { useRouter, Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

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
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1541888941259-7907ff14e94b?q=80&w=2070&auto=format&fit=crop' }}
      style={styles.background}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <StatusBar style="light" />
          <SafeAreaView style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
                      placeholder="請輸入Email"
                      placeholderTextColor={THEME.placeholder}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
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
                  <Text style={styles.buttonText}>{isLoading ? '登入中...' : '登入系統'}</Text>
                </TouchableOpacity>

                <View style={styles.linkContainer}>
                  <Link href="/forgot-password" asChild>
                    <TouchableOpacity>
                      <Text style={styles.forgetPwdText}>忘記密碼？</Text>
                    </TouchableOpacity>
                  </Link>

                  <Link href="/register" asChild>
                    <TouchableOpacity>
                      <Text style={styles.registerText}>申請註冊帳號</Text>
                    </TouchableOpacity>
                  </Link>
                </View>
              </View>
            </ScrollView>

            {/* Footer Text */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>© 2026 DW Construction Co., Ltd. All Rights Reserved.</Text>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  loginCard: {
    width: '100%',
    maxWidth: 450, // 稍微加寬一點
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
    color: THEME.textPrimary,
    textAlign: 'center',
    letterSpacing: 1,
  },
  inputGroup: {
    width: '100%',
    marginBottom: 20,
  },
  label: {
    color: THEME.textPrimary,
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
    borderColor: THEME.inputBorder,
    height: 54, // 增加高度
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
    backgroundColor: THEME.accent,
    height: 54,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
    shadowColor: THEME.accent,
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
  linkContainer: {
    marginTop: 25,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  forgetPwdText: {
    color: THEME.textSecondary,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  registerText: {
    color: THEME.accent,
    fontSize: 14,
    fontWeight: '700',
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
});