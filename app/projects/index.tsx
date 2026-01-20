import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Platform, StatusBar, Modal, TextInput, ScrollView, Alert, KeyboardAvoidingView } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../../context/UserContext';
import { useProjects, Project, Extension } from '../../context/ProjectContext';
import { useState, useMemo } from 'react';

const THEME = {
  primary: '#C69C6D',
  background: '#F5F7FA',
  card: '#ffffff',
  headerBg: '#002147',
  text: '#333333'
};

export default function ProjectsScreen() {
  const router = useRouter();
  const { user, logout } = useUser();
  const { projects, addProject } = useProjects();

  // States
  const [menuVisible, setMenuVisible] = useState(false);
  const [searchText, setSearchText] = useState('');

  // Add Project Modal States
  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [newProject, setNewProject] = useState<Partial<Project>>({
    name: '', address: '', manager: '', status: 'planning', startDate: '', contractDuration: 0, progress: 0, extensions: [],
    awardDate: '', actualCompletionDate: '', inspectionDate: '', reinspectionDate: '', inspectionPassedDate: ''
  });

  // Extension Inputs
  const [extForm, setExtForm] = useState({ days: '', date: '', docNumber: '', reason: '' });

  // Filter Logic
  const filteredProjects = useMemo(() => {
    if (!searchText) return projects;
    return projects.filter(p => p.name.includes(searchText) || p.address.includes(searchText));
  }, [projects, searchText]);

  // Render Logic
  const handleLogout = () => {
    setMenuVisible(false);
    logout();
    router.replace('/');
  };

  // Add Item Logic
  const handleAddExtension = () => {
    if (!extForm.days || !extForm.reason) {
      Alert.alert('提示', '請至少填寫天數與理由');
      return;
    }
    const newExt: Extension = {
      id: Math.random().toString(36).substr(2, 9),
      days: parseInt(extForm.days) || 0,
      date: extForm.date,
      docNumber: extForm.docNumber,
      reason: extForm.reason
    };
    setNewProject(prev => ({
      ...prev,
      extensions: [...(prev.extensions || []), newExt]
    }));
    setExtForm({ days: '', date: '', docNumber: '', reason: '' });
  };

  const handleRemoveExtension = (id: string) => {
    setNewProject(prev => ({
      ...prev,
      extensions: prev.extensions?.filter(e => e.id !== id)
    }));
  };

  // Auto Calculation
  const calculateCompletionDate = () => {
    if (!newProject.startDate || !newProject.contractDuration) return '請輸入開工日與工期';

    // Formula: (Start + Duration + Extensions - 1)
    const start = new Date(newProject.startDate);
    if (isNaN(start.getTime())) return '日期格式錯誤';

    const totalExtensions = newProject.extensions?.reduce((sum, ext) => sum + ext.days, 0) || 0;
    const totalDays = (parseInt(newProject.contractDuration.toString()) || 0) + totalExtensions - 1;

    const end = new Date(start);
    end.setDate(start.getDate() + totalDays);

    return end.toISOString().split('T')[0];
  };

  const completionDate = calculateCompletionDate();

  const handleSubmitProject = () => {
    if (!newProject.name || !newProject.startDate) {
      Alert.alert('錯誤', '專案名稱與開工日為必填');
      return;
    }

    addProject({
      name: newProject.name!,
      address: newProject.address || '',
      manager: newProject.manager || '',
      progress: 0,
      status: 'planning', // Default
      startDate: newProject.startDate,
      contractDuration: parseInt(newProject.contractDuration?.toString() || '0'),
      extensions: newProject.extensions || [],
      awardDate: newProject.awardDate,
      inspectionDate: newProject.inspectionDate,
      reinspectionDate: newProject.reinspectionDate
    } as any);

    setAddModalVisible(false);
    // Reset Form
    setNewProject({ name: '', address: '', manager: '', status: 'planning', startDate: '', contractDuration: 0, progress: 0, extensions: [], awardDate: '', inspectionDate: '', reinspectionDate: '' });
    Alert.alert('成功', '專案已新增');
  };

  const MenuItem = ({ icon, label, onPress, isLogout = false, isActive = false }: any) => (
    <TouchableOpacity style={[styles.menuItem, isActive && styles.menuItemActive]} onPress={onPress}>
      <Ionicons name={icon} size={24} color={isLogout ? '#FF6B6B' : (isActive ? THEME.primary : '#fff')} />
      <Text style={[styles.menuItemText, isLogout && { color: '#FF6B6B' }, isActive && { color: THEME.primary }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor={THEME.headerBg} />

      {/* Header */}
      <SafeAreaView style={styles.headerSafeArea}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.menuBtn}>
            <Ionicons name="menu" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>專案列表</Text>
          <View style={{ width: 28 }} />
        </View>
      </SafeAreaView>

      {/* Search & List */}
      <View style={styles.contentContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="搜尋專案名稱..."
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        <FlatList
          data={filteredProjects}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 15 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => router.push(`/projects/${item.id}`)}>
              <View style={styles.cardHeader}>
                <View style={[styles.statusTag, { backgroundColor: item.status === 'construction' ? '#E3F2FD' : '#F5F5F5' }]}>
                  <Text style={{ color: item.status === 'construction' ? '#002147' : '#666', fontSize: 12, fontWeight: 'bold' }}>
                    {item.status === 'construction' ? '施工中' : item.status === 'planning' ? '規劃中' : '已完工'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </View>
              <Text style={styles.projectTitle}>{item.name}</Text>
              <Text style={styles.projectInfo}>📍 {item.address}</Text>
              <Text style={styles.projectInfo}>👷 主任：{item.manager}</Text>
              {item.awardDate && <Text style={styles.projectInfo}>📅 決標：{item.awardDate}</Text>}

              {/* Progress Bar */}
              <View style={styles.progressContainer}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressBar, { width: `${item.progress}%` }]} />
                </View>
                <Text style={styles.progressText}>{item.progress}%</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="folder-open-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>沒有符合的專案</Text>
            </View>
          }
        />

        {user && (
          <TouchableOpacity style={styles.fab} onPress={() => setAddModalVisible(true)}>
            <Ionicons name="add" size={30} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Add Project Modal */}
      <Modal visible={isAddModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>新增專案</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <Ionicons name="close" size={26} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll}>
              <Text style={styles.groupHeader}>基本資料</Text>
              <Text style={styles.label}>專案名稱 *</Text>
              <TextInput style={styles.input} value={newProject.name} onChangeText={t => setNewProject({ ...newProject, name: t })} placeholder="輸入專案名稱" />

              <Text style={styles.label}>地址</Text>
              <TextInput style={styles.input} value={newProject.address} onChangeText={t => setNewProject({ ...newProject, address: t })} placeholder="輸入專案地址" />

              <Text style={styles.label}>工地主任</Text>
              <TextInput style={styles.input} value={newProject.manager} onChangeText={t => setNewProject({ ...newProject, manager: t })} placeholder="輸入負責人姓名" />

              <Text style={styles.groupHeader}>時程管理</Text>
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.label}>決標日期</Text>
                  <TextInput style={styles.input} value={newProject.awardDate} onChangeText={t => setNewProject({ ...newProject, awardDate: t })} placeholder="YYYY-MM-DD" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>開工日期 *</Text>
                  <TextInput style={styles.input} value={newProject.startDate} onChangeText={t => setNewProject({ ...newProject, startDate: t })} placeholder="YYYY-MM-DD" />
                </View>
              </View>

              <Text style={styles.label}>契約工期 (天)</Text>
              <TextInput style={styles.input} value={newProject.contractDuration?.toString()} onChangeText={t => setNewProject({ ...newProject, contractDuration: parseInt(t) || 0 })} keyboardType="number-pad" placeholder="600" />

              {/* Auto Calculation Result */}
              <View style={styles.calcResultBox}>
                <Text style={styles.calcLabel}>預定竣工日 (自動計算)</Text>
                <Text style={styles.calcValue}>{completionDate}</Text>
                <Text style={styles.calcFormula}>( 開工日 + 工期 + 展延天數 - 1 )</Text>
              </View>

              {/* Extension Logic */}
              <View style={styles.extensionSection}>
                <Text style={styles.sectionTitle}>展延工期明細</Text>
                {newProject.extensions?.map((ext, idx) => (
                  <View key={ext.id} style={styles.extItem}>
                    <Text style={styles.extText}>{idx + 1}. {ext.date} (文號：{ext.docNumber}) - {ext.days}天</Text>
                    <Text style={styles.extReason}>理由：{ext.reason}</Text>
                    <TouchableOpacity onPress={() => handleRemoveExtension(ext.id)} style={styles.removeExt}>
                      <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                    </TouchableOpacity>
                  </View>
                ))}

                <View style={styles.addExtBox}>
                  <View style={styles.row}>
                    <TextInput style={[styles.smallInput, { flex: 1 }]} placeholder="天數" keyboardType="number-pad" value={extForm.days} onChangeText={t => setExtForm({ ...extForm, days: t })} />
                    <TextInput style={[styles.smallInput, { flex: 2, marginLeft: 5 }]} placeholder="公文日期" value={extForm.date} onChangeText={t => setExtForm({ ...extForm, date: t })} />
                  </View>
                  <View style={[styles.row, { marginTop: 5 }]}>
                    <TextInput style={[styles.smallInput, { flex: 1 }]} placeholder="文號" value={extForm.docNumber} onChangeText={t => setExtForm({ ...extForm, docNumber: t })} />
                    <TextInput style={[styles.smallInput, { flex: 2, marginLeft: 5 }]} placeholder="展延理由" value={extForm.reason} onChangeText={t => setExtForm({ ...extForm, reason: t })} />
                  </View>
                  <TouchableOpacity style={styles.addExtBtn} onPress={handleAddExtension}>
                    <Text style={{ color: '#fff', fontSize: 12 }}>加入展延清單</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.groupHeader}>驗收日期</Text>
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.label}>驗收日期</Text>
                  <TextInput style={styles.input} value={newProject.inspectionDate} onChangeText={t => setNewProject({ ...newProject, inspectionDate: t })} placeholder="YYYY-MM-DD" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>複驗日期</Text>
                  <TextInput style={styles.input} value={newProject.reinspectionDate} onChangeText={t => setNewProject({ ...newProject, reinspectionDate: t })} placeholder="YYYY-MM-DD" />
                </View>
              </View>

            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitProject}>
                <Text style={styles.submitBtnText}>確認新增專案</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Side Menu (Reused) */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <View style={styles.menuOverlay}>
          <View style={styles.sideMenu}>
            <SafeAreaView style={{ flex: 1, padding: 20 }}>
              <View style={styles.menuHeader}>
                <Text style={styles.menuTitle}>功能選單</Text>
                <TouchableOpacity onPress={() => setMenuVisible(false)}><Ionicons name="close" size={28} color="#fff" /></TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <MenuItem icon="home" label="首頁" onPress={() => { setMenuVisible(false); router.push('/dashboard'); }} />
                <MenuItem icon="folder-open" label="專案列表" isActive={true} onPress={() => setMenuVisible(false)} />
                <MenuItem icon="clipboard" label="施工紀錄" onPress={() => { setMenuVisible(false); router.push('/logs'); }} />
                <MenuItem icon="people" label="人員管理" onPress={() => { setMenuVisible(false); router.push('/personnel'); }} />
                <MenuItem icon="library" label="SOP資料庫" onPress={() => { setMenuVisible(false); router.push('/sop'); }} />
                <MenuItem icon="person-circle" label="我的檔案" onPress={() => { setMenuVisible(false); router.push('/profile'); }} />
              </View>
              <View style={{ paddingBottom: 20 }}>
                <MenuItem icon="log-out-outline" label="登出系統" isLogout onPress={handleLogout} />
              </View>
            </SafeAreaView>
          </View>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setMenuVisible(false)} />
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  headerSafeArea: { backgroundColor: THEME.headerBg, paddingTop: Platform.OS === 'android' ? 25 : 0 },
  headerContent: { height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, justifyContent: 'space-between' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  menuBtn: { padding: 5 },
  contentContainer: { flex: 1 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 15, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16 },

  // Card
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 12, marginBottom: 15, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  projectTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  projectInfo: { color: '#666', marginTop: 5 },
  progressContainer: { marginTop: 15, flexDirection: 'row', alignItems: 'center' },
  progressTrack: { flex: 1, height: 6, backgroundColor: '#eee', borderRadius: 3, marginRight: 10 },
  progressBar: { height: 6, backgroundColor: THEME.primary, borderRadius: 3 },
  progressText: { fontSize: 12, fontWeight: 'bold', color: THEME.primary },

  fab: { position: 'absolute', right: 20, bottom: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: THEME.primary, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { marginTop: 10, color: '#999' },

  // Add Project Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', height: '90%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#002147' },
  formScroll: { flex: 1 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#333', marginTop: 15, marginBottom: 5 },
  input: { backgroundColor: '#F9F9F9', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16 },
  row: { flexDirection: 'row' },
  smallInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 8, fontSize: 13 },

  // Extension
  extensionSection: { marginTop: 25, backgroundColor: '#F0F4F8', padding: 15, borderRadius: 10 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#002147', marginBottom: 10 },
  addExtBox: { marginTop: 10, borderTopWidth: 1, borderColor: '#ddd', paddingTop: 10 },
  addExtBtn: { backgroundColor: '#555', padding: 8, borderRadius: 6, alignItems: 'center', marginTop: 10, alignSelf: 'flex-start' },
  extItem: { backgroundColor: '#fff', padding: 10, borderRadius: 8, marginBottom: 8 },
  extText: { fontWeight: 'bold', color: '#333', fontSize: 14 },
  extReason: { color: '#666', fontSize: 12 },
  removeExt: { position: 'absolute', top: 10, right: 10 },

  // Calc Result
  calcResultBox: { marginTop: 20, backgroundColor: '#002147', padding: 15, borderRadius: 10, alignItems: 'center' },
  calcLabel: { color: '#aaa', fontSize: 12 },
  calcValue: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginVertical: 5 },
  calcFormula: { color: '#ccc', fontSize: 10 },
  modalFooter: { marginTop: 10, borderTopWidth: 1, borderColor: '#eee', paddingTop: 10 },
  submitBtn: { backgroundColor: THEME.primary, padding: 15, borderRadius: 10, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  // Helper
  groupHeader: { fontSize: 13, fontWeight: 'bold', color: '#999', backgroundColor: '#f0f0f0', padding: 5, marginTop: 15 },
  menuOverlay: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.5)' },
  sideMenu: { width: '80%', backgroundColor: '#002147', height: '100%' },
  menuHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  menuTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  menuItem: { flexDirection: 'row', paddingVertical: 15, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  menuItemActive: { backgroundColor: 'rgba(198,156,109,0.1)' },
  menuItemText: { color: '#fff', marginLeft: 15, fontSize: 16 }
});