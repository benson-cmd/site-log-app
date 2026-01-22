import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useLogs } from '../../context/LogContext';
import { useUser } from '../../context/UserContext';
import { Ionicons } from '@expo/vector-icons';

const THEME = {
  background: '#ffffff',
  text: '#002147',
  textSec: '#555555',
  cardBg: '#ffffff',
  accent: '#C69C6D',
  border: '#E0E0E0',
  danger: '#ff4444'
};

export default function LogDetailScreen() {
  const { id } = useLocalSearchParams();
  const { logs, deleteLog } = useLogs();
  const { user } = useUser();
  const router = useRouter();

  const isAdmin = user?.role === 'admin' || user?.email === 'wu@dwcc.com.tw';

  const log = logs.find(l => l.id === id);

  // --- 修改後的返回函式 ---
  const goBackToList = () => {
    console.log('正在返回列表...'); // 幫您加上除錯訊息
    // 改用 push，這是最強制的導航方式
    // 雖然 replace 比較乾淨，但 push 保證會「動」
    router.push('/logs');
  };

  if (!log) {
    return (
      <View style={styles.center}>
        <Text style={{ color: THEME.textSec, fontSize: 16 }}>找不到此施工紀錄</Text>
        <TouchableOpacity onPress={goBackToList} style={styles.errorBackBtn}>
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>返回列表</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleDelete = () => {
    const doDelete = async () => {
      await deleteLog(log.id);
      goBackToList();
    };

    if (Platform.OS === 'web') {
      if (confirm('確定要刪除此施工紀錄嗎？')) doDelete();
    } else {
      Alert.alert('刪除確認', '確定要刪除此施工紀錄嗎？此動作無法復原。', [
        { text: '取消', style: 'cancel' },
        { text: '刪除', style: 'destructive', onPress: doDelete }
      ]);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* 頂部導航列 */}
      <View style={styles.navBar}>
        {/* 這裡確保觸控範圍足夠大 */}
        <TouchableOpacity
          onPress={goBackToList}
          style={styles.navBackBtn}
          activeOpacity={0.7} // 增加點擊回饋感
        >
          <Ionicons name="chevron-back" size={28} color={THEME.text} />
          <Text style={styles.navBackText}>施工紀錄列表</Text>
        </TouchableOpacity>

        {/* 右側佔位，讓標題在視覺上不要太偏，或者留空 */}
        <View style={{ flex: 1 }} />
      </View>

      {/* 原有的內容 Header */}
      <View style={styles.header}>
        <View style={styles.dateBadge}>
          <Text style={styles.dateText}>{log.date}</Text>
        </View>
        <View style={styles.weatherBox}>
          <Ionicons name="partly-sunny" size={20} color={THEME.accent} />
          <Text style={styles.weatherText}>{log.weather}</Text>
        </View>
      </View>

      {/* 詳細資訊卡片 */}
      <View style={styles.section}>
        <Text style={styles.label}>🏗️ 所屬專案</Text>
        <Text style={styles.value}>{log.project}</Text>
      </View>

      <View style={styles.row}>
        <View style={[styles.section, { flex: 1, marginRight: 10 }]}>
          <Text style={styles.label}>👷 出工人數</Text>
          <Text style={styles.value}>{log.labor?.reduce((acc: number, curr: any) => acc + (curr.count || 0), 0) || 0} 人</Text>
        </View>
        <View style={[styles.section, { flex: 1 }]}>
          <Text style={styles.label}>🌤️ 天氣狀況</Text>
          <Text style={styles.value}>{log.weather}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>📋 施工項目摘要</Text>
        <Text style={styles.value}>{log.content}</Text>
      </View>

      {log.notes ? (
        <View style={styles.section}>
          <Text style={styles.label}>📝 備註事項</Text>
          <Text style={styles.value}>{log.notes}</Text>
        </View>
      ) : null}

      {/* 管理員專屬操作區 */}
      {isAdmin && (
        <View style={styles.adminArea}>
          <Text style={styles.adminTitle}>管理員操作</Text>
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.editBtn} onPress={() => alert('編輯功能開發中')}>
              <Ionicons name="pencil" size={20} color="#fff" />
              <Text style={styles.btnText}>修改日誌</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <Ionicons name="trash" size={20} color="#fff" />
              <Text style={styles.btnText}>刪除紀錄</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background, padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorBackBtn: { marginTop: 20, backgroundColor: THEME.accent, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },

  // 導航列樣式
  navBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  navBackBtn: { flexDirection: 'row', alignItems: 'center', padding: 5 }, // 增加 padding 讓點擊範圍變大
  navBackText: { fontSize: 18, color: THEME.text, marginLeft: 5, fontWeight: 'bold' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  dateBadge: { backgroundColor: THEME.text, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
  dateText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  weatherBox: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  weatherText: { fontSize: 18, color: THEME.text, fontWeight: 'bold' },

  row: { flexDirection: 'row' },
  section: { backgroundColor: THEME.cardBg, padding: 20, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: THEME.border, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  label: { color: THEME.textSec, fontSize: 14, marginBottom: 8, fontWeight: '600' },
  value: { color: THEME.text, fontSize: 18, fontWeight: 'bold', lineHeight: 26 },

  // 管理員區域樣式
  adminArea: { marginTop: 30, padding: 20, backgroundColor: '#FFF5F5', borderRadius: 12, borderWidth: 1, borderColor: '#FFEBEE' },
  adminTitle: { color: THEME.danger, fontWeight: 'bold', marginBottom: 15 },
  btnRow: { flexDirection: 'row', gap: 15 },
  editBtn: { flex: 1, flexDirection: 'row', backgroundColor: THEME.accent, padding: 15, borderRadius: 8, justifyContent: 'center', alignItems: 'center', gap: 8 },
  deleteBtn: { flex: 1, flexDirection: 'row', backgroundColor: THEME.danger, padding: 15, borderRadius: 8, justifyContent: 'center', alignItems: 'center', gap: 8 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});