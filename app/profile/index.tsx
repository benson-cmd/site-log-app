import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Modal, TextInput, Platform, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useUser } from '../../context/UserContext';
import { usePersonnel, Personnel } from '../../context/PersonnelContext';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useUser();
  const { getPersonnelByEmail, updatePersonnel, personnelList, loading: isPersonnelLoading } = usePersonnel();

  const [profile, setProfile] = useState<Personnel | null>(null);

  // Form State Extension
  const [licenseInput, setLicenseInput] = useState('');
  const [eduInput, setEduInput] = useState<{ school: string, degree: string, year: string }>({ school: '', degree: '', year: '' });
  const [expInput, setExpInput] = useState<{ company: string, role: string, duration: string }>({ company: '', role: '', duration: '' });

  // Password State
  const [pwdForm, setPwdForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });

  // Modal State
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [editForm, setEditForm] = useState<Personnel | null>(null);

  useEffect(() => {
    if (user && user.email && personnelList.length > 0) {
      const p = getPersonnelByEmail(user.email);
      if (p) {
        setProfile(p);
      }
    }
  }, [user, personnelList]); // Removed getPersonnelByEmail dependency to avoid loop if unstable

  // Loading State: Wait for User check AND Personnel fetch
  if (isUserLoading || isPersonnelLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#002147" />
        <Text style={{ marginTop: 10, color: '#666' }}>載入個人資料中...</Text>
      </View>
    );
  }

  // Handle case where profile is not found after loading
  const activeProfile = profile || (user?.email ? getPersonnelByEmail(user.email) : null);

  if (!activeProfile) {
    return (
      <View style={styles.container}>
        <SafeAreaView>
          <Text style={{ textAlign: 'center', marginTop: 100, color: '#999' }}>
            找不到使用者資料 ({user?.email || '未登入'})
          </Text>
          <TouchableOpacity onPress={() => router.replace('/')} style={{ marginTop: 20, alignSelf: 'center' }}>
            <Text style={{ color: '#002147' }}>返回登入</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    )
  }

  const displayProfile = activeProfile;

  const handleEditOpen = () => {
    if (displayProfile) {
      setEditForm({
        ...displayProfile,
        licenses: displayProfile.licenses || [],
        education: displayProfile.education || [],
        experience: displayProfile.experience || []
      });
      // Reset sub-forms
      setLicenseInput('');
      setEduInput({ school: '', degree: '', year: '' });
      setExpInput({ company: '', role: '', duration: '' });
      setPwdForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    }
    setEditModalVisible(true);
  };

  // Helper for tenure
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

  // Sub-list Handlers
  const addLicense = () => {
    if (licenseInput.trim() && editForm) {
      setEditForm({ ...editForm, licenses: [...(editForm.licenses || []), licenseInput.trim()] });
      setLicenseInput('');
    }
  };
  const removeLicense = (idx: number) => {
    if (editForm) {
      setEditForm({ ...editForm, licenses: editForm.licenses?.filter((_, i) => i !== idx) });
    }
  };

  const addEducation = () => {
    if (eduInput.school && eduInput.degree && editForm) {
      setEditForm({ ...editForm, education: [...(editForm.education || []), eduInput] });
      setEduInput({ school: '', degree: '', year: '' });
    }
  };
  const removeEducation = (idx: number) => {
    if (editForm) {
      setEditForm({ ...editForm, education: editForm.education?.filter((_, i) => i !== idx) });
    }
  };

  const addExperience = () => {
    if (expInput.company && expInput.role && editForm) {
      setEditForm({ ...editForm, experience: [...(editForm.experience || []), expInput] });
      setExpInput({ company: '', role: '', duration: '' });
    }
  };
  const removeExperience = (idx: number) => {
    if (editForm) {
      setEditForm({ ...editForm, experience: editForm.experience?.filter((_, i) => i !== idx) });
    }
  };

  const handleSaveProfile = async () => {
    if (!editForm) return;

    // Validate Password Change
    let passwordPayload = {};
    if (pwdForm.newPassword) {
      if (pwdForm.newPassword !== pwdForm.confirmPassword) {
        Alert.alert('錯誤', '新密碼與確認密碼不一致');
        return;
      }
      if (!pwdForm.oldPassword) {
        Alert.alert('錯誤', '請輸入舊密碼以確認身分');
        return;
      }
      // Verification logic: Check against current profile data
      const currentPwd = profile?.password;
      const initialPwd = profile?.initialPassword;

      // Note: This is client-side check. Secure enough for this scope but ideally server-side.
      // If user has a custom password, they MUST match it.
      // If user has NO custom password, they MUST match initialPassword.

      let isOldPwdCorrect = false;
      if (currentPwd) {
        isOldPwdCorrect = pwdForm.oldPassword === currentPwd;
      } else {
        isOldPwdCorrect = pwdForm.oldPassword === initialPwd;
      }

      if (!isOldPwdCorrect) {
        Alert.alert('錯誤', '舊密碼不正確');
        return;
      }

      // Validated
      passwordPayload = { password: pwdForm.newPassword };
    }

    // Merge updates
    const finalUpdate = {
      ...editForm,
      ...passwordPayload
    };

    try {
      await updatePersonnel(editForm.id, finalUpdate);
      setProfile(finalUpdate); // Optimistic update
      setEditModalVisible(false);
      Alert.alert('成功', '個人檔案已更新');
    } catch (e) {
      Alert.alert('錯誤', '更新失敗');
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
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

        {/* Dynamic Sections Display */}
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
          <Text style={styles.editBtnText}>編輯詳細資料 & 修改密碼</Text>
        </TouchableOpacity>

        <Text style={styles.footerVersion}>Built for DW Construction</Text>
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
                {/* Basic Info (Read Only or Limited) */}
                <View style={styles.sectionHeader}><Text style={styles.sectionTitleSmall}>基本資料 (僅檢視)</Text></View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>姓名</Text>
                  <TextInput style={[styles.input, styles.readonly]} value={editForm.name} editable={false} />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>職稱</Text>
                  <TextInput style={[styles.input, styles.readonly]} value={editForm.title} editable={false} />
                </View>
                {/* Editable Phone/Email */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email</Text>
                  <TextInput style={styles.input} value={editForm.email} onChangeText={t => setEditForm({ ...editForm, email: t })} keyboardType="email-address" />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>電話</Text>
                  <TextInput style={styles.input} value={editForm.phone} onChangeText={t => setEditForm({ ...editForm, phone: t })} keyboardType="phone-pad" />
                </View>

                {/* Licenses */}
                <View style={styles.sectionHeader}><Text style={styles.sectionTitleSmall}>專業證照</Text></View>
                <View style={{ flexDirection: 'row', marginBottom: 10 }}>
                  <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="證照名稱" value={licenseInput} onChangeText={setLicenseInput} />
                  <TouchableOpacity style={styles.addBtn} onPress={addLicense}><Text style={styles.addBtnText}>新增</Text></TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {editForm.licenses?.map((lic, idx) => (
                    <View key={idx} style={styles.tag}>
                      <Text style={styles.tagText}>{lic}</Text>
                      <TouchableOpacity onPress={() => removeLicense(idx)}><Ionicons name="close-circle" size={16} color="#555" /></TouchableOpacity>
                    </View>
                  ))}
                </View>

                {/* Education */}
                <View style={styles.sectionHeader}><Text style={styles.sectionTitleSmall}>學歷</Text></View>
                <View style={{ flexDirection: 'row', marginBottom: 5 }}>
                  <TextInput style={[styles.miniInput, { flex: 2 }]} placeholder="學校" value={eduInput.school} onChangeText={t => setEduInput({ ...eduInput, school: t })} />
                  <TextInput style={[styles.miniInput, { flex: 1, marginHorizontal: 2 }]} placeholder="學位" value={eduInput.degree} onChangeText={t => setEduInput({ ...eduInput, degree: t })} />
                  <TextInput style={[styles.miniInput, { flex: 1 }]} placeholder="年份" value={eduInput.year} onChangeText={t => setEduInput({ ...eduInput, year: t })} />
                </View>
                <TouchableOpacity style={[styles.addBtn, { alignSelf: 'flex-end', marginBottom: 10 }]} onPress={addEducation}><Text style={styles.addBtnText}>新增學歷</Text></TouchableOpacity>
                {editForm.education?.map((edu, i) => (
                  <View key={i} style={styles.listItem}>
                    <Text>{edu.school} - {edu.degree} ({edu.year})</Text>
                    <TouchableOpacity onPress={() => removeEducation(i)}><Ionicons name="trash" color="#FF6B6B" size={18} /></TouchableOpacity>
                  </View>
                ))}

                {/* Experience */}
                <View style={styles.sectionHeader}><Text style={styles.sectionTitleSmall}>經歷</Text></View>
                <View style={{ flexDirection: 'row', marginBottom: 5 }}>
                  <TextInput style={[styles.miniInput, { flex: 2 }]} placeholder="公司" value={expInput.company} onChangeText={t => setExpInput({ ...expInput, company: t })} />
                  <TextInput style={[styles.miniInput, { flex: 2, marginHorizontal: 2 }]} placeholder="職位" value={expInput.role} onChangeText={t => setExpInput({ ...expInput, role: t })} />
                  <TextInput style={[styles.miniInput, { flex: 1 }]} placeholder="期間" value={expInput.duration} onChangeText={t => setExpInput({ ...expInput, duration: t })} />
                </View>
                <TouchableOpacity style={[styles.addBtn, { alignSelf: 'flex-end', marginBottom: 10 }]} onPress={addExperience}><Text style={styles.addBtnText}>新增經歷</Text></TouchableOpacity>
                {editForm.experience?.map((exp, i) => (
                  <View key={i} style={styles.listItem}>
                    <Text>{exp.company} - {exp.role} ({exp.duration})</Text>
                    <TouchableOpacity onPress={() => removeExperience(i)}><Ionicons name="trash" color="#FF6B6B" size={18} /></TouchableOpacity>
                  </View>
                ))}

                {/* Password Change */}
                <View style={[styles.sectionHeader, { marginTop: 20, borderColor: '#FF6B6B' }]}><Text style={[styles.sectionTitleSmall, { color: '#FF6B6B' }]}>修改密碼</Text></View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>舊密碼 (驗證身分)</Text>
                  <TextInput
                    style={styles.input}
                    secureTextEntry
                    placeholder="若要修改密碼，請先輸入舊密碼"
                    value={pwdForm.oldPassword}
                    onChangeText={t => setPwdForm({ ...pwdForm, oldPassword: t })}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>新密碼</Text>
                  <TextInput
                    style={styles.input}
                    secureTextEntry
                    placeholder="請輸入新密碼"
                    value={pwdForm.newPassword}
                    onChangeText={t => setPwdForm({ ...pwdForm, newPassword: t })}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>確認新密碼</Text>
                  <TextInput
                    style={styles.input}
                    secureTextEntry
                    placeholder="請再次輸入新密碼"
                    value={pwdForm.confirmPassword}
                    onChangeText={t => setPwdForm({ ...pwdForm, confirmPassword: t })}
                  />
                </View>

                <View style={{ height: 50 }} />
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
    borderWidth: 4,
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
    borderWidth: 1,
    borderColor: '#eee',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#002147',
    marginBottom: 15,
    borderLeftWidth: 4,
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
    borderWidth: 1,
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
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    height: '92%',
    padding: 25,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
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
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#F9F9F9'
  },
  readonly: {
    backgroundColor: '#eee',
    color: '#888'
  },
  sectionHeader: {
    borderBottomWidth: 1,
    borderColor: '#eee',
    paddingBottom: 5,
    marginBottom: 10,
    marginTop: 10
  },
  sectionTitleSmall: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#C69C6D'
  },
  addBtn: {
    backgroundColor: '#555',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 10,
    justifyContent: 'center'
  },
  addBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  miniInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    backgroundColor: '#fff'
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eee',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginRight: 5,
    marginBottom: 5
  },
  tagText: {
    marginRight: 5,
    fontSize: 12
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#F9F9F9',
    marginBottom: 5,
    borderRadius: 5
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