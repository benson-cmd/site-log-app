import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, TextInput, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { usePersonnel, Personnel } from '../../context/PersonnelContext';

export default function PersonnelScreen() {
  const { personnelList, addPersonnel, updatePersonnel, deletePersonnel } = usePersonnel();

  // Modal States
  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [currentPerson, setCurrentPerson] = useState<Personnel | null>(null);

  // Form States (Using Partial<Personnel> for flexibility)
  const [formData, setFormData] = useState<Partial<Personnel>>({
    name: '', title: '', email: '', phone: '', startDate: '', birthDate: '', department: ''
  });

  const calculateTenure = (date: string) => {
    if (!date) return '0 年 0 個月';
    const start = new Date(date);
    const diff = new Date().getTime() - start.getTime();
    if (isNaN(diff)) return '格式錯誤';
    const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    const months = Math.floor((diff % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44));
    return `${years} 年 ${months} 個月`;
  };

  const handleAddOpen = () => {
    setFormData({ name: '', title: '', email: '', phone: '', startDate: '', birthDate: '', department: '' });
    setAddModalVisible(true);
  };

  const handleEditOpen = (person: Personnel) => {
    setCurrentPerson(person);
    setFormData({ ...person });
    setEditModalVisible(true);
  };

  const submitAdd = () => {
    if (!formData.name || !formData.title) {
      Alert.alert('錯誤', '請填寫姓名與職稱');
      return;
    }
    addPersonnel({
      name: formData.name,
      title: formData.title,
      email: formData.email || '',
      phone: formData.phone || '',
      startDate: formData.startDate || new Date().toISOString().split('T')[0],
      birthDate: formData.birthDate,
      department: formData.department,
      licenses: [],
      education: [],
      experience: []
    } as any);

    setAddModalVisible(false);
    Alert.alert('成功', '人員新增成功');
  };

  const submitEdit = () => {
    if (!currentPerson) return;
    updatePersonnel(currentPerson.id, formData);
    setEditModalVisible(false);
    Alert.alert('成功', '資料更新成功');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F7FA' }}>
      <Stack.Screen options={{ title: '人員管理', headerShown: true, headerStyle: { backgroundColor: '#002147' }, headerTintColor: '#fff' }} />

      <FlatList
        data={personnelList}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.avatar}><Text style={{ color: '#fff', fontSize: 24 }}>{item.name[0]}</Text></View>
              <View style={{ flex: 1, marginLeft: 15 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.role}>{item.title} {item.department ? `| ${item.department}` : ''}</Text>
              </View>
              <TouchableOpacity onPress={() => handleEditOpen(item)} style={{ padding: 5 }}>
                <Ionicons name="create-outline" size={28} color="#C69C6D" />
              </TouchableOpacity>
            </View>
            <View style={styles.infoBox}>
              <Text style={{ color: '#555' }}>📧 {item.email || '未填寫'} | 📞 {item.phone || '未填寫'}</Text>
              {item.birthDate && <Text style={{ color: '#555', marginTop: 4 }}>🎂 生日：{item.birthDate}</Text>}
              <View style={styles.tenure}>
                <Text style={{ color: '#002147', fontWeight: 'bold' }}>服務年資：{calculateTenure(item.startDate)}</Text>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 50, color: '#999' }}>尚無人員資料</Text>}
      />

      <TouchableOpacity style={styles.fab} onPress={handleAddOpen}>
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      {/* Add Modal */}
      <Modal visible={isAddModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>新增人員</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}><Ionicons name="close" size={24} color="#333" /></TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={styles.label}>姓名 *</Text>
              <TextInput style={styles.input} value={formData.name} onChangeText={t => setFormData({ ...formData, name: t })} />

              <Text style={styles.label}>職稱 *</Text>
              <TextInput style={styles.input} value={formData.title} onChangeText={t => setFormData({ ...formData, title: t })} />

              <Text style={styles.label}>部門</Text>
              <TextInput style={styles.input} value={formData.department} onChangeText={t => setFormData({ ...formData, department: t })} />

              <Text style={styles.label}>Email</Text>
              <TextInput style={styles.input} value={formData.email} onChangeText={t => setFormData({ ...formData, email: t })} keyboardType="email-address" />

              <Text style={styles.label}>電話</Text>
              <TextInput style={styles.input} value={formData.phone} onChangeText={t => setFormData({ ...formData, phone: t })} keyboardType="phone-pad" />

              <Text style={styles.label}>到職日 (YYYY-MM-DD)</Text>
              <TextInput style={styles.input} value={formData.startDate} onChangeText={t => setFormData({ ...formData, startDate: t })} />

              <Text style={styles.label}>生日 (YYYY-MM-DD)</Text>
              <TextInput style={styles.input} value={formData.birthDate} onChangeText={t => setFormData({ ...formData, birthDate: t })} />
            </ScrollView>
            <TouchableOpacity style={styles.submitBtn} onPress={submitAdd}>
              <Text style={styles.submitBtnText}>確認新增</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={isEditModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>編輯人員</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}><Ionicons name="close" size={24} color="#333" /></TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={styles.label}>姓名</Text>
              <TextInput style={styles.input} value={formData.name} onChangeText={t => setFormData({ ...formData, name: t })} />

              <Text style={styles.label}>職稱</Text>
              <TextInput style={styles.input} value={formData.title} onChangeText={t => setFormData({ ...formData, title: t })} />

              <Text style={styles.label}>部門</Text>
              <TextInput style={styles.input} value={formData.department} onChangeText={t => setFormData({ ...formData, department: t })} />

              <Text style={styles.label}>Email</Text>
              <TextInput style={styles.input} value={formData.email} onChangeText={t => setFormData({ ...formData, email: t })} keyboardType="email-address" />

              <Text style={styles.label}>電話</Text>
              <TextInput style={styles.input} value={formData.phone} onChangeText={t => setFormData({ ...formData, phone: t })} keyboardType="phone-pad" />

              <Text style={styles.label}>到職日</Text>
              <TextInput style={styles.input} value={formData.startDate} onChangeText={t => setFormData({ ...formData, startDate: t })} />

              <Text style={styles.label}>生日</Text>
              <TextInput style={styles.input} value={formData.birthDate} onChangeText={t => setFormData({ ...formData, birthDate: t })} />
            </ScrollView>
            <TouchableOpacity style={styles.submitBtn} onPress={submitEdit}>
              <Text style={styles.submitBtnText}>儲存變更</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: '#FF6B6B', marginTop: 10 }]} onPress={() => {
              Alert.alert('確認刪除', `確定要刪除 ${currentPerson?.name} 嗎？`, [
                { text: '取消', style: 'cancel' },
                {
                  text: '刪除', style: 'destructive', onPress: () => {
                    if (currentPerson) deletePersonnel(currentPerson.id);
                    setEditModalVisible(false);
                  }
                }
              ])
            }}>
              <Text style={styles.submitBtnText}>刪除人員</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
  fab: { position: 'absolute', bottom: 30, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#C69C6D', justifyContent: 'center', alignItems: 'center', elevation: 5 },

  // Modal Styles
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, height: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#002147' },
  label: { fontSize: 14, color: '#666', marginBottom: 5, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16 },
  submitBtn: { backgroundColor: '#002147', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 30 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});