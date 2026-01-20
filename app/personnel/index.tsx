import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, TextInput, ScrollView, Platform, KeyboardAvoidingView, SafeAreaView, StatusBar } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { usePersonnel, Personnel, Education, Experience } from '../../context/PersonnelContext';

const DEPARTMENTS = ['總經理室', '工務部', '採購部', '行政部'];

export default function PersonnelScreen() {
  const router = useRouter();
  const { personnelList, addPersonnel, updatePersonnel, deletePersonnel } = usePersonnel();

  // Modal States
  const [isModalVisible, setModalVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Form Data
  const [currentId, setCurrentId] = useState<string>('');
  const [formData, setFormData] = useState<Partial<Personnel>>({
    name: '', title: '', email: '', phone: '', startDate: '', birthDate: '', department: '工務部', licenses: [], education: [], experience: []
  });

  // Sub-form inputs
  const [licenseInput, setLicenseInput] = useState('');
  const [eduInput, setEduInput] = useState<Education>({ school: '', degree: '', year: '' });
  const [expInput, setExpInput] = useState<Experience>({ company: '', role: '', duration: '' });

  // Helper: Generate ROC Password
  const generateROCPassword = (dateStr: string) => {
    if (!dateStr || dateStr.length !== 10) return ''; // Expect YYYY-MM-DD
    const parts = dateStr.split('-');
    if (parts.length !== 3) return '';
    const year = parseInt(parts[0]);
    const rocYear = year - 1911;
    if (rocYear < 0) return '';
    // Pad to 3 digits (e.g. 72 -> 072, 100 -> 100)
    const rocYearStr = rocYear.toString().padStart(3, '0');
    const month = parts[1];
    const day = parts[2];
    return `${rocYearStr}${month}${day}`;
  };

  const handleOpenAdd = () => {
    setIsEditMode(false);
    setFormData({
      name: '', title: '', email: '', phone: '', startDate: '', birthDate: '', department: '工務部',
      licenses: [], education: [], experience: []
    });
    setModalVisible(true);
  };

  const handleOpenEdit = (person: Personnel) => {
    setIsEditMode(true);
    setCurrentId(person.id);
    setFormData({ ...person });
    setModalVisible(true);
  };

  const handleDelete = (id: string) => {
    Alert.alert('刪除確認', '確定要刪除此人員資料嗎？', [
      { text: '取消', style: 'cancel' },
      { text: '刪除', style: 'destructive', onPress: () => deletePersonnel(id) }
    ]);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.email || !formData.startDate || !formData.birthDate) {
      Alert.alert('錯誤', '姓名、Email、到職日、生日為必填欄位');
      return;
    }

    // Auto Generate Pwd for New User
    let finalData = { ...formData };
    if (!isEditMode && formData.birthDate) {
      const pwd = generateROCPassword(formData.birthDate);
      finalData.initialPassword = pwd;
      Alert.alert('提示', `已自動生成初始密碼：${pwd}`);
    }

    if (isEditMode) {
      updatePersonnel(currentId, finalData);
      Alert.alert('成功', '資料已更新');
    } else {
      addPersonnel(finalData as Personnel);
      Alert.alert('成功', '人員已新增');
    }
    setModalVisible(false);
  };

  // Sub-list Handlers
  const addLicense = () => {
    if (licenseInput.trim()) {
      setFormData(prev => ({ ...prev, licenses: [...(prev.licenses || []), licenseInput.trim()] }));
      setLicenseInput('');
    }
  };
  const removeLicense = (idx: number) => {
    setFormData(prev => ({ ...prev, licenses: prev.licenses?.filter((_, i) => i !== idx) }));
  };

  const addEducation = () => {
    if (eduInput.school && eduInput.degree) {
      setFormData(prev => ({ ...prev, education: [...(prev.education || []), eduInput] }));
      setEduInput({ school: '', degree: '', year: '' });
    }
  };
  const removeEducation = (idx: number) => {
    setFormData(prev => ({ ...prev, education: prev.education?.filter((_, i) => i !== idx) }));
  };

  const addExperience = () => {
    if (expInput.company && expInput.role) {
      setFormData(prev => ({ ...prev, experience: [...(prev.experience || []), expInput] }));
      setExpInput({ company: '', role: '', duration: '' });
    }
  };
  const removeExperience = (idx: number) => {
    setFormData(prev => ({ ...prev, experience: prev.experience?.filter((_, i) => i !== idx) }));
  };

  const PersonnelCard = ({ item }: { item: Personnel }) => {
    const tenure = (() => {
      const start = new Date(item.startDate);
      const now = new Date();
      const diff = now.getFullYear() - start.getFullYear();
      return diff < 0 ? 0 : diff;
    })();

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.name}>{item.name} <Text style={styles.title}>({item.title})</Text></Text>
            <Text style={styles.dept}>{item.department || '未分派'} | 年資 {tenure} 年</Text>
          </View>
          <TouchableOpacity onPress={() => handleOpenEdit(item)}>
            <Ionicons name="create-outline" size={24} color="#C69C6D" />
          </TouchableOpacity>
        </View>

        <View style={styles.contactRow}>
          <Ionicons name="mail" size={14} color="#666" style={{ marginRight: 5 }} />
          <Text style={styles.contactText}>{item.email}</Text>
        </View>
        <View style={styles.contactRow}>
          <Ionicons name="call" size={14} color="#666" style={{ marginRight: 5 }} />
          <Text style={styles.contactText}>{item.phone}</Text>
        </View>
        {item.initialPassword && (
          <View style={styles.pwdRow}>
            <Text style={styles.pwdLabel}>初始密碼：</Text>
            <Text style={styles.pwdValue}>{item.initialPassword}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: '人員管理', headerShown: true, headerStyle: { backgroundColor: '#002147' }, headerTintColor: '#fff' }} />
      <StatusBar barStyle="light-content" />

      <FlatList
        data={personnelList}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <PersonnelCard item={item} />}
        contentContainerStyle={{ padding: 15, paddingBottom: 100 }}
      />

      <TouchableOpacity style={styles.fab} onPress={handleOpenAdd}>
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      {/* Main Modal */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{isEditMode ? '編輯人員' : '新增人員'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={26} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formBody}>
              <Text style={styles.sectionHeader}>基本資料</Text>
              <TextInput style={styles.input} placeholder="姓名 *" value={formData.name} onChangeText={t => setFormData({ ...formData, name: t })} />
              <TextInput style={styles.input} placeholder="職稱 *" value={formData.title} onChangeText={t => setFormData({ ...formData, title: t })} />

              <Text style={styles.label}>部門 *</Text>
              <View style={styles.deptContainer}>
                {DEPARTMENTS.map(dept => (
                  <TouchableOpacity
                    key={dept}
                    style={[styles.chip, formData.department === dept && styles.chipActive]}
                    onPress={() => setFormData({ ...formData, department: dept })}
                  >
                    <Text style={[styles.chipText, formData.department === dept && styles.chipTextActive]}>{dept}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput style={styles.input} placeholder="Email (必填) *" value={formData.email} onChangeText={t => setFormData({ ...formData, email: t })} keyboardType="email-address" autoCapitalize="none" />
              <TextInput style={styles.input} placeholder="電話" value={formData.phone} onChangeText={t => setFormData({ ...formData, phone: t })} keyboardType="phone-pad" />

              <View style={styles.row}>
                <TextInput style={[styles.input, { flex: 1, marginRight: 5 }]} placeholder="到職日 (YYYY-MM-DD)" value={formData.startDate} onChangeText={t => setFormData({ ...formData, startDate: t })} />
                <TextInput style={[styles.input, { flex: 1, marginLeft: 5 }]} placeholder="生日 (YYYY-MM-DD)" value={formData.birthDate} onChangeText={t => setFormData({ ...formData, birthDate: t })} />
              </View>

              <Text style={styles.sectionHeader}>專業證照</Text>
              <View style={styles.row}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="證照名稱" value={licenseInput} onChangeText={setLicenseInput} />
                <TouchableOpacity style={styles.miniBtn} onPress={addLicense}><Text style={styles.miniBtnText}>新增</Text></TouchableOpacity>
              </View>
              <View style={styles.tagContainer}>
                {formData.licenses?.map((lic, idx) => (
                  <View key={idx} style={styles.tag}>
                    <Text style={styles.tagText}>{lic}</Text>
                    <TouchableOpacity onPress={() => removeLicense(idx)}><Ionicons name="close-circle" size={16} color="#555" /></TouchableOpacity>
                  </View>
                ))}
              </View>

              <Text style={styles.sectionHeader}>學歷</Text>
              <View style={styles.row}>
                <TextInput style={[styles.miniInput, { flex: 2 }]} placeholder="學校" value={eduInput.school} onChangeText={t => setEduInput({ ...eduInput, school: t })} />
                <TextInput style={[styles.miniInput, { flex: 1, marginHorizontal: 2 }]} placeholder="學位" value={eduInput.degree} onChangeText={t => setEduInput({ ...eduInput, degree: t })} />
                <TextInput style={[styles.miniInput, { flex: 1 }]} placeholder="年份" value={eduInput.year} onChangeText={t => setEduInput({ ...eduInput, year: t })} />
              </View>
              <TouchableOpacity style={[styles.miniBtn, { alignSelf: 'flex-end', marginTop: 5 }]} onPress={addEducation}><Text style={styles.miniBtnText}>新增學歷</Text></TouchableOpacity>
              {formData.education?.map((edu, i) => (
                <View key={i} style={styles.listItem}>
                  <Text>{edu.school} - {edu.degree} ({edu.year})</Text>
                  <TouchableOpacity onPress={() => removeEducation(i)}><Ionicons name="trash" color="#FF6B6B" size={18} /></TouchableOpacity>
                </View>
              ))}

              <Text style={styles.sectionHeader}>經歷</Text>
              <View style={styles.row}>
                <TextInput style={[styles.miniInput, { flex: 2 }]} placeholder="公司" value={expInput.company} onChangeText={t => setExpInput({ ...expInput, company: t })} />
                <TextInput style={[styles.miniInput, { flex: 2, marginHorizontal: 2 }]} placeholder="職位" value={expInput.role} onChangeText={t => setExpInput({ ...expInput, role: t })} />
                <TextInput style={[styles.miniInput, { flex: 1 }]} placeholder="期間" value={expInput.duration} onChangeText={t => setExpInput({ ...expInput, duration: t })} />
              </View>
              <TouchableOpacity style={[styles.miniBtn, { alignSelf: 'flex-end', marginTop: 5 }]} onPress={addExperience}><Text style={styles.miniBtnText}>新增經歷</Text></TouchableOpacity>
              {formData.experience?.map((exp, i) => (
                <View key={i} style={styles.listItem}>
                  <Text>{exp.company} - {exp.role} ({exp.duration})</Text>
                  <TouchableOpacity onPress={() => removeExperience(i)}><Ionicons name="trash" color="#FF6B6B" size={18} /></TouchableOpacity>
                </View>
              ))}

              {isEditMode && (
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(currentId)}>
                  <Text style={styles.deleteBtnText}>刪除此人員</Text>
                </TouchableOpacity>
              )}

              <View style={{ height: 50 }} />
            </ScrollView>

            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
              <Text style={styles.submitBtnText}>{isEditMode ? '儲存變更' : '新增人員'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  card: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 15, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#002147', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  headerInfo: { flex: 1 },
  name: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  title: { fontSize: 14, color: '#666', fontWeight: 'normal' },
  dept: { fontSize: 13, color: '#999', marginTop: 2 },
  contactRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  contactText: { color: '#555', fontSize: 13 },
  pwdRow: { marginTop: 10, padding: 8, backgroundColor: '#E3F2FD', borderRadius: 6, flexDirection: 'row' },
  pwdLabel: { fontSize: 12, color: '#002147', fontWeight: 'bold' },
  pwdValue: { fontSize: 12, color: '#002147' },

  fab: { position: 'absolute', right: 20, bottom: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: '#C69C6D', justifyContent: 'center', alignItems: 'center', elevation: 5 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', height: '90%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#002147' },
  formBody: { flex: 1 },

  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 10, fontSize: 15, backgroundColor: '#F9F9F9' },
  label: { fontSize: 14, fontWeight: 'bold', color: '#333', marginTop: 5, marginBottom: 5 },

  deptContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', marginRight: 5, marginBottom: 5 },
  chipActive: { backgroundColor: '#002147', borderColor: '#002147' },
  chipText: { color: '#666' },
  chipTextActive: { color: '#fff', fontWeight: 'bold' },

  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },

  sectionHeader: { fontSize: 16, fontWeight: 'bold', color: '#C69C6D', marginTop: 15, marginBottom: 10, borderBottomWidth: 1, borderColor: '#eee', paddingBottom: 5 },

  miniInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 5, padding: 8, fontSize: 13, backgroundColor: '#fff' },
  miniBtn: { backgroundColor: '#555', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, marginLeft: 5 },
  miniBtnText: { color: '#fff', fontSize: 12 },

  tagContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 5 },
  tag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eee', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15, marginRight: 5, marginBottom: 5 },
  tagText: { marginRight: 5, fontSize: 12 },

  listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, backgroundColor: '#F9F9F9', marginBottom: 5, borderRadius: 5 },

  submitBtn: { backgroundColor: '#C69C6D', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  deleteBtn: { marginTop: 20, alignItems: 'center' },
  deleteBtnText: { color: '#FF6B6B' }
});