import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function LogsScreen() {
  const logs = [{ id: '1', date: '2026/01/14', project: '台中七期商辦', content: '1. 進場勘查\n2. 材料驗收' }];
  return (
    <View style={{flex: 1, backgroundColor: '#F5F7FA'}}>
      <Stack.Screen options={{ title: '施工紀錄', headerShown: true, headerStyle: { backgroundColor: '#002147' }, headerTintColor: '#fff' }} />
      <FlatList data={logs} renderItem={({item}) => (
        <View style={styles.card}>
          <View style={{flexDirection:'row', justifyContent:'space-between'}}>
            <Text style={{fontWeight:'bold', color:'#666'}}>{item.date}</Text>
            <TouchableOpacity onPress={() => Alert.alert('編輯', '修改施工紀錄')}><Ionicons name="pencil" size={20} color="#C69C6D" /></TouchableOpacity>
          </View>
          <Text style={{fontSize:18, fontWeight:'bold', color:'#002147', marginVertical:8}}>{item.project}</Text>
          <Text style={{color:'#444'}}>{item.content}</Text>
        </View>
      )} />
      <TouchableOpacity style={styles.fab} onPress={() => Alert.alert('新增', '填寫新日誌')}><Ionicons name="add" size={30} color="#fff" /></TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', padding: 20, margin: 15, borderRadius: 12, elevation: 2 },
  fab: { position: 'absolute', bottom: 30, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#C69C6D', justifyContent: 'center', alignItems: 'center', elevation: 5 }
});