import { View, Text, FlatList, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function SOPScreen() {
  const sops = [{ id: '1', title: '地基開挖作業標準', category: '基礎工程' }];
  return (
    <View style={{flex: 1, backgroundColor: '#F5F7FA'}}>
      <Stack.Screen options={{ title: 'SOP 資料庫', headerShown: true, headerStyle: { backgroundColor: '#002147' }, headerTintColor: '#fff' }} />
      <FlatList data={sops} renderItem={({item}) => (
        <TouchableOpacity style={styles.card} onPress={() => Alert.alert('查看文件', `開啟：${item.title}`)}>
          <Ionicons name="document-text" size={24} color="#C69C6D" />
          <View style={{marginLeft: 15, flex: 1}}>
            <Text style={{fontSize: 16, fontWeight:'bold'}}>{item.title}</Text>
            <Text style={{color: '#999'}}>{item.category}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>
      )} />
      <TouchableOpacity style={styles.fab} onPress={() => Alert.alert('新增資料', '上傳 SOP 文件')}><Ionicons name="add" size={30} color="#fff" /></TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 10, padding: 15, borderRadius: 10, elevation: 2 },
  fab: { position: 'absolute', bottom: 30, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#C69C6D', justifyContent: 'center', alignItems: 'center', elevation: 5 }
});