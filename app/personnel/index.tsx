import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, TextInput, ScrollView, Platform, KeyboardAvoidingView, SafeAreaView, StatusBar, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { usePersonnel, Personnel, Education, Experience } from '../../context/PersonnelContext';
import { useUser } from '../../context/UserContext';
import { useEffect } from 'react';
import { toast } from 'sonner';

const DEPARTMENTS = ['總經理室', '工務部', '專案部', '採購部', '財務行政部'];

export default function PersonnelScreen() {
  const router = useRouter();
  const { personnelList, loading, error, addPersonnel, updatePersonnel, deletePersonnel } = usePersonnel();
  const { user } = useUser();

  // Route Protection: Only Admin can access
  useEffect(() => {
    if (!loading && user?.role !== 'admin' && user?.email !== 'wu@dwcc.com.tw') {
      router.replace('/dashboard');
    }
  }, [user, loading]);

  // Modal States
  const [isModalVisible, setModalVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Form Data
  const [currentId, setCurrentId] = useState<string>('');
  // Extend Personnel type locally or in context, but for now we rely on Partial<Personnel> in state.
  // Since UserContext defines fields, we should treat password fields as optional extra props during form handling.
  // However, best practice is to ensure TypeScript knows about them.
  // We will modify the state type definition.
  const [formData, setFormData] = useState<Partial<Personnel> & { password?: string; confirmPassword?: string; }>({
    name: '', title: '', email: '', phone: '', startDate: '', birthDate: '', department: '工務部', role: 'user', licenses: [], education: [], experience: []
  });

  // Sub-form inputs
  const [licenseInput, setLicenseInput] = useState('');
  const [eduInput, setEduInput] = useState<Education>({ school: '', major: '', degree: '', year: '' });
  const [expInput, setExpInput] = useState<Experience>({ company: '', role: '', startMonth: '', endMonth: '' });

  // Date Picker State (Native)
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateTarget, setDateTarget] = useState<'start' | 'birth'>('start');
  const [tempDate, setTempDate] = useState(new Date());

  // Helper: Generate ROC Password
  const generateROCPassword = (dateStr: string) => {
    if (!dateStr || dateStr.length !== 10) return ''; // Expect YYYY-MM-DD
    const parts = dateStr.split('-');
    if (parts.length !== 3) return '';
    const year = parseInt(parts[0]);
    const rocYear = year - 1911;
    if (rocYear < 0) return '';
    const rocYearStr = rocYear.toString().padStart(3, '0');
    const month = parts[1].padStart(2, '0');
    const day = parts[2].padStart(2, '0');
    return `${rocYearStr}${month}${day}`;
  };

  const handleOpenAdd = () => {
    setIsEditMode(false);
    setFormData({
      name: '', title: '', email: '', phone: '', startDate: '', birthDate: '', department: '工務部', role: 'user',
      licenses: [], education: [], experience: []
    });
    setModalVisible(true);
  };

  const handleOpenEdit = (person: Personnel) => {
    setIsEditMode(true);
    setCurrentId(person.id);
    setFormData({
      ...person,
      licenses: person.licenses || [],
      education: person.education || [],
      experience: person.experience || []
    });
    setModalVisible(true);
  };

  const showFeedback = (title: string, msg: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  };

  const handleDelete = (id: string) => {
    const doDelete = async () => {
      try {
        await deletePersonnel(id);
        showFeedback('操作成功', '人員已刪除');
        setModalVisible(false);
      } catch (e) {
        showFeedback('錯誤', '刪除失敗');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('確定要刪除此人員資料嗎？此操作無法復原。')) {
        doDelete();
      }
    } else {
      Alert.alert('刪除確認', '確定要刪除此人員資料嗎？此操作無法復原。', [
        { text: '取消', style: 'cancel' },
        { text: '刪除', style: 'destructive', onPress: doDelete }
      ]);
    }
  };

  const handleSubmit = async () => {
    // [手術級優化] 姓名、Email 為必填；生日因涉及預設密碼邏輯亦改回必填
    if (!formData.name || !formData.email) {
      toast.error('⚠️ 姓名與 Email 為必填欄位！');
      return;
    }

    if (!formData.birthDate) {
      toast.error('⚠️ 生日為必填欄位（預設密碼依據），請務必輸入。');
      return;
    }

    // Auto Generate Pwd for New User
    let finalData = { ...formData };
    if (!isEditMode && formData.birthDate) {
      const pwd = generateROCPassword(formData.birthDate);
      finalData.initialPassword = pwd;
    }

    try {
      if (isEditMode) {
        // Password Validation
        if (formData.password && formData.password !== formData.confirmPassword) {
          showFeedback('錯誤', '兩次輸入的密碼不一致');
          return;
        }

        // Clean up confirmPassword before saving
        const dataToSave = { ...finalData };
        delete dataToSave.confirmPassword;

        await updatePersonnel(currentId, dataToSave);
        setModalVisible(false);
        toast.success('✅ 資料已更新');
      } else {
        await addPersonnel(finalData as Personnel);
        setModalVisible(false);
        const msg = finalData.initialPassword
          ? `人員已新增，初始密碼為：${finalData.initialPassword}`
          : '人員已新增';
        toast.success('✅ ' + msg);
      }
    } catch (e) {
      toast.error('❌ 儲存失敗，請重試');
      console.error(e);
    }
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
    if (eduInput.school && eduInput.major && eduInput.degree && eduInput.year) {
      // Validate year format (YYYY)
      if (!/^\d{4}$/.test(eduInput.year)) {
        showFeedback('錯誤', '年份格式錯誤，請輸入 4 位數字西元年份');
        return;
      }

      setFormData(prev => ({ ...prev, education: [...(prev.education || []), eduInput] }));
      setEduInput({ school: '', major: '', degree: '', year: '' });
    }
  };
  const removeEducation = (idx: number) => {
    setFormData(prev => ({ ...prev, education: prev.education?.filter((_, i) => i !== idx) }));
  };

  const addExperience = () => {
    if (expInput.company && expInput.role && expInput.startMonth && expInput.endMonth) {
      // Validate end date is not before start date
      if (expInput.endMonth < expInput.startMonth) {
        showFeedback('錯誤', '結束日期不得早於開始日期');
        return;
      }

      // Compute duration display string
      const duration = `西元 ${expInput.startMonth.replace('-', '/')} - 西元 ${expInput.endMonth.replace('-', '/')}`;

      setFormData(prev => ({ ...prev, experience: [...(prev.experience || []), { ...expInput, duration }] }));
      setExpInput({ company: '', role: '', startMonth: '', endMonth: '' });
    }
  };
  const removeExperience = (idx: number) => {
    setFormData(prev => ({ ...prev, experience: prev.experience?.filter((_, i) => i !== idx) }));
  };

  // Date Picker Helpers
  const handleDateChange = (type: 'start' | 'birth', value: string) => {
    if (type === 'start') setFormData(prev => ({ ...prev, startDate: value }));
    else setFormData(prev => ({ ...prev, birthDate: value }));
  };

  const openNativeDatePicker = (type: 'start' | 'birth') => {
    setDateTarget(type);
    const currentVal = type === 'start' ? formData.startDate : formData.birthDate;
    if (currentVal) setTempDate(new Date(currentVal));
    else setTempDate(new Date());
    setShowDatePicker(true);
  };

  const onNativeDateConfirm = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selectedDate) {
      const str = selectedDate.toISOString().split('T')[0];
      handleDateChange(dateTarget, str);
    }
  };

  const renderDateInput = (type: 'start' | 'birth', value: string, placeholder: string) => {
    if (Platform.OS === 'web') {
      return (
        <input
          type="date"
          value={value}
          onChange={(e) => handleDateChange(type, e.target.value)}
          style={{
            flex: 1, padding: 12, backgroundColor: '#F9F9F9',
            borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
            fontSize: 15, marginBottom: 0,
            boxSizing: 'border-box', // Ensure padding included in width
            width: '100%'
          }}
          placeholder={placeholder}
        />
      );
    }
    return (
      <TouchableOpacity style={styles.dateBtn} onPress={() => openNativeDatePicker(type)}>
        <Text style={{ color: value ? '#333' : '#999' }}>{value || placeholder}</Text>
        <Ionicons name="calendar-outline" size={18} color="#666" />
      </TouchableOpacity>
    );
  };

  const PersonnelCard = ({ item }: { item: Personnel }) => {
    const tenure = (() => {
      if (!item.startDate) return 0;
      const start = new Date(item.startDate);
      const now = new Date();
      const diff = now.getFullYear() - start.getFullYear();
      return diff < 0 ? 0 : diff;
    })();

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.name ? item.name.charAt(0) : '?'}</Text>
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
        {item.password && item.password !== item.initialPassword ? (
          <View style={[styles.pwdRow, styles.pwdRowModified]}>
            <Text style={[styles.pwdLabel, styles.pwdLabelModified]}>密碼：</Text>
            <Text style={[styles.pwdValue, styles.pwdLabelModified]}>
              {item.password.length > 20 ? '已自行變更' : item.password}
            </Text>
          </View>
        ) : item.initialPassword ? (
          <View style={styles.pwdRow}>
            <Text style={styles.pwdLabel}>初始密碼：</Text>
            <Text style={styles.pwdValue}>{item.initialPassword}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#002147" />
        <Text style={{ marginTop: 10, color: '#666' }}>載入中...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="alert-circle-outline" size={48} color="#FF6B6B" />
        <Text style={{ marginTop: 10, color: '#FF6B6B', fontWeight: 'bold' }}>載入失敗</Text>
        <Text style={{ marginTop: 5, color: '#666' }}>{error}</Text>
      </View>
    );
  }

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

            <ScrollView style={styles.formBody} showsVerticalScrollIndicator={true}>
              <Text style={styles.sectionHeader}>基本資料</Text>

              {/* Row 1: 姓名 & 職稱 */}
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 5 }}>
                  <Text style={styles.label}>姓名 *</Text>
                  <TextInput style={styles.input} placeholder="姓名" value={formData.name} onChangeText={t => setFormData({ ...formData, name: t })} />
                </View>
                <View style={{ flex: 1, marginLeft: 5 }}>
                  <Text style={styles.label}>職稱</Text>
                  <TextInput style={styles.input} placeholder="職稱" value={formData.title} onChangeText={t => setFormData({ ...formData, title: t })} />
                </View>
              </View>

              {/* Row 2: 部門 & 系統權限 */}
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 5 }}>
                  <Text style={styles.label}>部門</Text>
                  <View style={styles.deptContainer}>
                    {DEPARTMENTS.map(dept => (
                      <TouchableOpacity
                        key={dept}
                        style={[styles.chip, formData.department === dept && styles.chipActive, { paddingHorizontal: 8, paddingVertical: 5 }]}
                        onPress={() => setFormData({ ...formData, department: dept })}
                      >
                        <Text style={[styles.chipText, formData.department === dept && styles.chipTextActive, { fontSize: 12 }]}>{dept}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={{ flex: 1, marginLeft: 5 }}>
                  <Text style={styles.label}>系統權限</Text>
                  <View style={styles.deptContainer}>
                    {[{ id: 'admin', label: '管理員' }, { id: 'user', label: '一般使用者' }].map(r => (
                      <TouchableOpacity
                        key={r.id}
                        style={[styles.chip, formData.role === r.id && styles.chipActive, { paddingHorizontal: 8, paddingVertical: 5 }]}
                        onPress={() => setFormData({ ...formData, role: r.id as 'admin' | 'user' })}
                      >
                        <Text style={[styles.chipText, formData.role === r.id && styles.chipTextActive, { fontSize: 12 }]}>{r.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <Text style={styles.label}>帳號與 Email (綁定) *</Text>
              <TextInput style={styles.input} placeholder="Email" value={formData.email} onChangeText={t => setFormData({ ...formData, email: t })} keyboardType="email-address" autoCapitalize="none" />

              <Text style={styles.label}>電話</Text>
              <TextInput style={styles.input} placeholder="電話" value={formData.phone} onChangeText={t => setFormData({ ...formData, phone: t })} keyboardType="phone-pad" />

              {/* 生日優先，到職日隨後 */}
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 5 }}>
                  <Text style={styles.label}>生日 *</Text>
                  {renderDateInput('birth', formData.birthDate || '', '生日')}
                </View>
                <View style={{ flex: 1, marginLeft: 5 }}>
                  <Text style={styles.label}>到職日</Text>
                  {renderDateInput('start', formData.startDate || '', '到職日')}
                </View>
              </View>

              <Text style={styles.sectionHeader}>學歷</Text>
              <View style={styles.row}>
                <TextInput style={[styles.miniInput, { flex: 2 }]} placeholder="學校" value={eduInput.school} onChangeText={t => setEduInput({ ...eduInput, school: t })} />
                <TextInput style={[styles.miniInput, { flex: 2, marginHorizontal: 2 }]} placeholder="科系" value={eduInput.major} onChangeText={t => setEduInput({ ...eduInput, major: t })} />
                <TextInput style={[styles.miniInput, { flex: 1, marginHorizontal: 2 }]} placeholder="學位" value={eduInput.degree} onChangeText={t => setEduInput({ ...eduInput, degree: t })} />
                <TextInput style={[styles.miniInput, { flex: 1 }]} placeholder="西元 YYYY" value={eduInput.year} onChangeText={t => setEduInput({ ...eduInput, year: t })} keyboardType="numeric" maxLength={4} />
              </View>
              <TouchableOpacity style={[styles.miniBtn, { alignSelf: 'flex-end', marginTop: 5 }]} onPress={addEducation}><Text style={styles.miniBtnText}>新增學歷</Text></TouchableOpacity>
              {formData.education?.map((edu, i) => (
                <View key={i} style={styles.listItem}>
                  <Text>{edu.school} - {edu.major} - {edu.degree} (西元 {edu.year} 年)</Text>
                  <TouchableOpacity onPress={() => removeEducation(i)}><Ionicons name="trash" color="#FF6B6B" size={18} /></TouchableOpacity>
                </View>
              ))}

              <Text style={styles.sectionHeader}>經歷</Text>
              <View style={styles.row}>
                <TextInput style={[styles.miniInput, { flex: 2 }]} placeholder="公司" value={expInput.company} onChangeText={t => setExpInput({ ...expInput, company: t })} />
                <TextInput style={[styles.miniInput, { flex: 2, marginHorizontal: 2 }]} placeholder="職位" value={expInput.role} onChangeText={t => setExpInput({ ...expInput, role: t })} />
              </View>
              <View style={styles.row}>
                {Platform.OS === 'web' ? (
                  <>
                    <input
                      type="month"
                      value={expInput.startMonth}
                      onChange={(e) => setExpInput({ ...expInput, startMonth: e.target.value })}
                      placeholder="起始年月"
                      style={{
                        flex: 1, padding: 8, backgroundColor: '#fff',
                        borderWidth: 1, borderColor: '#ddd', borderRadius: 5,
                        fontSize: 13, marginRight: 2,
                        boxSizing: 'border-box'
                      }}
                    />
                    <input
                      type="month"
                      value={expInput.endMonth}
                      onChange={(e) => setExpInput({ ...expInput, endMonth: e.target.value })}
                      placeholder="結束年月"
                      style={{
                        flex: 1, padding: 8, backgroundColor: '#fff',
                        borderWidth: 1, borderColor: '#ddd', borderRadius: 5,
                        fontSize: 13, marginLeft: 2,
                        boxSizing: 'border-box'
                      }}
                    />
                  </>
                ) : (
                  <>
                    <TextInput style={[styles.miniInput, { flex: 1, marginRight: 2 }]} placeholder="起始 (YYYY-MM)" value={expInput.startMonth} onChangeText={t => setExpInput({ ...expInput, startMonth: t })} />
                    <TextInput style={[styles.miniInput, { flex: 1, marginLeft: 2 }]} placeholder="結束 (YYYY-MM)" value={expInput.endMonth} onChangeText={t => setExpInput({ ...expInput, endMonth: t })} />
                  </>
                )}
              </View>
              <TouchableOpacity style={[styles.miniBtn, { alignSelf: 'flex-end', marginTop: 5 }]} onPress={addExperience}><Text style={styles.miniBtnText}>新增經歷</Text></TouchableOpacity>
              {formData.experience?.map((exp, i) => (
                <View key={i} style={styles.listItem}>
                  <Text>{exp.company} - {exp.role} ({exp.duration || `${exp.startMonth} - ${exp.endMonth}`})</Text>
                  <TouchableOpacity onPress={() => removeExperience(i)}><Ionicons name="trash" color="#FF6B6B" size={18} /></TouchableOpacity>
                </View>
              ))}

              <Text style={styles.sectionHeader}>專業證照或技能</Text>
              <View style={styles.row}>
                <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="證照名稱" value={licenseInput} onChangeText={setLicenseInput} />
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

              {isEditMode && (
                <>
                  <Text style={styles.sectionHeader}>安全性設定</Text>
                  <View style={{ marginBottom: 10 }}>
                    <Text style={styles.label}>新密碼</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="若不修改請留空"
                      value={formData.password || ''}
                      onChangeText={t => setFormData({ ...formData, password: t })}
                      secureTextEntry
                    />
                    <Text style={styles.label}>確認新密碼</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="請再次輸入新密碼"
                      value={formData.confirmPassword || ''}
                      onChangeText={t => setFormData({ ...formData, confirmPassword: t })}
                      secureTextEntry
                    />
                  </View>
                </>
              )}

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
        </KeyboardAvoidingView >

        {/* Native Date Picker Modal */}
        {
          showDatePicker && Platform.OS !== 'web' && (
            <DateTimePicker value={tempDate} mode="date" display="default" onChange={onNativeDateConfirm} />
          )
        }
      </Modal >
    </View >
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
  pwdRowModified: { backgroundColor: '#FFF3E0' },
  pwdLabel: { fontSize: 12, color: '#002147', fontWeight: 'bold' },
  pwdLabelModified: { color: '#E65100' },
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
  dateBtn: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#F9F9F9', borderWidth: 1, borderColor: '#ddd', borderRadius: 8 },

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
  deleteBtn: { marginTop: 20, alignItems: 'center', padding: 15 },
  deleteBtnText: { color: '#FF6B6B', fontSize: 15, fontWeight: 'bold' }
});