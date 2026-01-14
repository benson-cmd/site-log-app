import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function PersonnelScreen() {
  const people = [{ id: '1', name: '吳資彬', title: '副總', email: 'wu@dwcc.com.tw', phone: '0988967900', startDate: '2017-07-17' }];
  
  const calculateTenure = (date: string) => {
    const start = new Date(date);
    const diff = new Date().getTime() - start.getTime();
    const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    const months = Math.floor((diff % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44));
    return `${years} 年 ${months} 個月`;
  };

  return (
    <View style={{flex: 1, backgroundColor: '#F5F7FA'}}>
      <Stack.Screen options={{ title: '人員管理', headerShown: true, headerStyle: { backgroundColor: '#002147' }, headerTintColor: '#fff' }} />
      <FlatList 
        data={people}
        renderItem={({item}) => (
          <View style={styles.card}>
            <View style={{flexDirection:'row', alignItems:'center'}}>
              <View style={styles.avatar}><Text style={{color:'#fff', fontSize:24}}>{item.name[0]}</Text></View>
              <View style={{flex:1, marginLeft: 15}}><Text style={styles.name}>{item.name}</Text><Text style={styles.role}>{item.title}</Text></View>
              <TouchableOpacity onPress={() => Alert.alert('編輯', '編輯人員資料')}><Ionicons name="create-outline" size={28} color="#C69C6D" /></TouchableOpacity>
            </View>
            <View style={styles.infoBox}>
              <Text>📧 {item.email} | 📞 {item.phone}</Text>
              <View style={styles.tenure}><Text style={{color:'#002147', fontWeight:'bold'}}>服務年資：{calculateTenure(item.startDate)}</Text></View>
            </View>
          </View>
        )}
      />
      <TouchableOpacity style={styles.fab} onPress={() => Alert.alert('新增', '新增人員')}><Ionicons name="add" size={30} color="#fff" /></TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', margin: 15, borderRadius: 15, padding: 20, elevation: 3 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#C69C6D', justifyContent: 'center', alignItems: 'center' },
  name: { fontSize: 20, fontWeight: 'bold' },
  role: { color: '#C69C6D', fontWeight: 'bold' },
  infoBox: { marginTop: 15, borderTopWidth: 1, borderColor: '#eee', paddingTop: 10 },
  tenure: { backgroundColor: '#E3F2FD', padding: 8, borderRadius: 10, marginTop: 10, alignSelf: 'flex-start' },
  fab: { position: 'absolute', bottom: 30, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#C69C6D', justifyContent: 'center', alignItems: 'center', elevation: 5 }
});