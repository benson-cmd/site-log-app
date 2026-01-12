import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useUser } from '../context/UserContext'; 

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading } = useUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!email || !password) { alert('請輸入帳號與密碼'); return; }
    const success = await login(email, password);
    if (success) router.replace('/dashboard'); 
  };

  return (
    <View style={{flex:1, backgroundColor:'#fff', justifyContent:'center', alignItems:'center', padding:30}}>
      <Image source={require('../assets/logo.png')} style={{width:180, height:180}} resizeMode="contain" />
      <Text style={{fontSize:32, fontWeight:'bold', color:'#002147', marginVertical:20}}>DW工程日誌系統</Text>
      <View style={{width:'100%', padding:20, backgroundColor:'#fff', borderRadius:15, elevation:5}}>
        <TextInput style={styles.input} placeholder="帳號" value={email} onChangeText={setEmail} autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="密碼" value={password} onChangeText={setPassword} secureTextEntry />
        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={{color:'#fff', fontWeight:'bold'}}>登入系統</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  input: { backgroundColor:'#F5F5F5', padding:15, borderRadius:10, marginBottom:15 },
  button: { backgroundColor:'#C69C6D', padding:15, borderRadius:10, alignItems:'center' }
});