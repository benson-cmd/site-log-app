import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Modal, TextInput, Platform, KeyboardAvoidingView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useUser } from '../../context/UserContext';
import { usePersonnel, Personnel } from '../../context/PersonnelContext';

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useUser();
  const { getPersonnelByEmail, updatePersonnel } = usePersonnel();

  const [profile, setProfile] = useState<Personnel | null>(null);

  // Modal State
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [editForm, setEditForm] = useState<Personnel | null>(null);

  useEffect(() => {
    if (user && user.email) {
      const p = getPersonnelByEmail(user.email);
      if (p) {
        setProfile(p);
      }
    }
  }, [user, getPersonnelByEmail]);

  if (!profile) {
    return (
      <View style={styles.container}>
        <SafeAreaView><Text style={{ textAlign: 'center', marginTop: 100, color: '#999' }}>找不到使用者資料 ({user?.email})</Text></SafeAreaView>
      </View>
    )
  }

  const calculateTenure = (dateStr: string) => {
    if (!dateStr) return '0 年 0 個月';
    const start = new Date(dateStr);
    const now = new Date();
    if (isNaN(start.getTime())) return '日期格式錯誤';

    let months = (now.getFullYear() - start.getFullYear()) * 12;
    months -= start.getMonth();
    months += now.getMonth();

    if (months < 0) return '尚未到職';

    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;

    return `${years} 年 ${remainingMonths} 個月`;
  };

  const handleEditOpen = () => {
    setEditForm({ ...profile });
    setEditModalVisible(true);
  };

  const handleSaveProfile = () => {
    if (!editForm) return;
    if (!editForm.name || !editForm.title) {
      Alert.alert('錯誤', '姓名與職稱不可為空');
      return;
    }
    updatePersonnel(editForm.id, editForm);
    setProfile(editForm);
    setEditModalVisible(false);
    Alert.alert('成功', '個人檔案已更新');
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Fixed: Removed StatusBar component to avoid potential conflicts or let layout handle it, preserving style */}

      {/* Header Area */}
      <View style={styles.headerArea}>
        <SafeAreaView>
          <View style={styles.navHeader}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>我的檔案</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>{profile.name.charAt(0)}</Text>
            </View>
            <Text style={styles.nameText}>{profile.name}</Text>
            <Text style={styles.titleText}>{profile.title}</Text>

            <View style={styles.tenureBadge}>
              <Ionicons name="time-outline" size={16} color="#002147" />
              <Text style={styles.tenureText}>服務年資：{calculateTenure(profile.startDate)}</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Contact Info */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>基本資料</Text>
          <View style={styles.infoRow}>
            <View style={styles.iconBox}><Ionicons name="mail" size={18} color="#002147" /></View>
            <View>
              <Text style={styles.label}>電子郵件</Text>
              <Text style={styles.value}>{profile.email}</Text>
            </View>
          </View>
          <View style={styles.separator} />
          <View style={styles.infoRow}>
            <View style={styles.iconBox}><Ionicons name="call" size={18} color="#002147" /></View>
            <View>
              <Text style={styles.label}>聯絡電話</Text>
              <Text style={styles.value}>{profile.phone}</Text>
            </View>
          </View>
          <View style={styles.separator} />
          <View style={styles.infoRow}>
            <View style={styles.iconBox}><Ionicons name="business" size={18} color="#002147" /></View>
            <View>
              <Text style={styles.label}>部門單位</Text>
              <Text style={styles.value}>{profile.department || '未設定'}</Text>
            </View>
          </View>
          <View style={styles.separator} />
          <View style={styles.infoRow}>
            <View style={styles.iconBox}><Ionicons name="calendar" size={18} color="#002147" /></View>
            <View>
              <Text style={styles.label}>到職日期</Text>
              <Text style={styles.value}>{profile.startDate}</Text>
            </View>
          </View>
        </View>

        {/* Licenses Section */}
        {profile.licenses && profile.licenses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>專業證照</Text>
            <View style={styles.licenseRow}>
              {profile.licenses.map((lic, idx) => (
                <View key={idx} style={styles.licenseTag}>
                  <Ionicons name="ribbon-outline" size={14} color="#002147" style={{ marginRight: 4 }} />
                  <Text style={styles.licenseText}>{lic}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Experience Section */}
        {profile.experience && profile.experience.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>工作經歷</Text>
            {profile.experience.map((exp, idx) => (
              <View key={`exp-${idx}`} style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineRole}>{exp.role}</Text>
                  <Text style={styles.timelineCompany}>{exp.company}</Text>
                  <Text style={styles.timelineDate}>{exp.duration}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Education Section */}
        {profile.education && profile.education.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>學歷背景</Text>
            {profile.education.map((edu, idx) => (
              <View key={`edu-${idx}`} style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: '#C69C6D' }]} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineRole}>{edu.degree}</Text>
                  <Text style={styles.timelineCompany}>{edu.school}</Text>
                  <Text style={styles.timelineDate}>{edu.year}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.editBtn} onPress={handleEditOpen}>
          <Ionicons name="create-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.editBtnText}>編輯詳細資料</Text>
        </TouchableOpacity>

        <Text style={styles.footerVersion}>Made for Benson (Demo Build)</Text>
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={isEditModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>編輯個人檔案</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            {editForm && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>姓名</Text>
                  <TextInput style={styles.input} value={editForm.name} onChangeText={t => setEditForm({ ...editForm, name: t })} />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>職稱</Text>
                  <TextInput style={styles.input} value={editForm.title} onChangeText={t => setEditForm({ ...editForm, title: t })} />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email</Text>
                  <TextInput style={styles.input} value={editForm.email} onChangeText={t => setEditForm({ ...editForm, email: t })} keyboardType="email-address" />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>電話</Text>
                  <TextInput style={styles.input} value={editForm.phone} onChangeText={t => setEditForm({ ...editForm, phone: t })} keyboardType="phone-pad" />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>部門</Text>
                  <TextInput style={styles.input} value={editForm.department || ''} onChangeText={t => setEditForm({ ...editForm, department: t })} />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>到職日</Text>
                  <TextInput style={styles.input} value={editForm.startDate} onChangeText={t => setEditForm({ ...editForm, startDate: t })} />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>專業證照 (逗號分隔)</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.licenses?.join(', ') || ''}
                    onChangeText={t => setEditForm({ ...editForm, licenses: t.split(',').map(s => s.trim()).filter(s => s) })}
                  />
                </View>
              </ScrollView>
            )}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile}>
              <Text style={styles.saveBtnText}>確認儲存</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  headerArea: {
    backgroundColor: '#002147',
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingTop: Platform.OS === 'android' ? 25 : 0,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 50,
  },
  backBtn: {
    padding: 5,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  profileHeader: {
    alignItems: 'center',
    marginTop: 10,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#C69C6D',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4, // Corrected
    borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 15,
  },
  avatarText: {
    fontSize: 40,
    color: '#fff',
    fontWeight: 'bold',
  },
  nameText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  titleText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 15,
  },
  tenureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 6,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  tenureText: {
    color: '#002147',
    fontWeight: 'bold',
    marginLeft: 5,
    fontSize: 14,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    borderWidth: 1, // Enforced
    borderColor: '#eee',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#002147',
    marginBottom: 15,
    borderLeftWidth: 4, // Enforced
    borderLeftColor: '#C69C6D',
    paddingLeft: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F0F4F8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  label: {
    fontSize: 12,
    color: '#666',
  },
  value: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    marginTop: 2
  },
  separator: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 10,
    marginLeft: 51,
  },
  licenseRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  licenseTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1, // Enforced
    borderColor: '#BBDEFB'
  },
  licenseText: {
    color: '#002147',
    fontSize: 14,
    fontWeight: 'bold'
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#002147',
    marginTop: 6,
    marginRight: 15,
  },
  timelineContent: {
    flex: 1,
  },
  timelineRole: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  timelineCompany: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  timelineDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  editBtn: {
    flexDirection: 'row',
    backgroundColor: '#C69C6D',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#C69C6D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    marginBottom: 20,
  },
  editBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  footerVersion: {
    textAlign: 'center',
    color: '#ccc',
    fontSize: 12,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    height: '85%',
    padding: 25,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#002147',
  },
  modalBody: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 15
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: 'bold'
  },
  input: {
    borderWidth: 1, // Enforced
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#F9F9F9'
  },
  saveBtn: {
    backgroundColor: '#002147',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  }
});