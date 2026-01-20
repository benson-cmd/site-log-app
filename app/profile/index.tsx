import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image, StatusBar } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';

export default function ProfileScreen() {
  const router = useRouter();

  // 模擬使用者資料 (未來可從 Context 或 API 取得)
  const [profile] = useState({
    name: '吳資彬',
    title: '副總經理',
    email: 'wu@dwcc.com.tw',
    phone: '0988-967-900',
    startDate: '2017-07-17',
    department: '工務部',
    education: [
      { school: '國立成功大學', degree: '土木工程系 學士', year: '2010' },
      { school: '國立交通大學', degree: '土木工程研究所 碩士', year: '2012' },
    ],
    experience: [
      { company: '大陸工程', role: '專案經理', duration: '2012 - 2017' },
      { company: 'DW營造', role: '副總經理', duration: '2017 - Present' },
    ]
  });

  // 年資計算函式
  const calculateTenure = (dateStr: string) => {
    const start = new Date(dateStr);
    const now = new Date();

    // 計算總月數差
    let months = (now.getFullYear() - start.getFullYear()) * 12;
    months -= start.getMonth();
    months += now.getMonth();

    // 計算年與月
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;

    // 處理未滿一個月的情況 (選擇性忽略或簡易處理)
    return `${years} 年 ${remainingMonths} 個月`;
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#002147" />

      {/* Header Area */}
      <SafeAreaView style={styles.headerArea}>
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

      <ScrollView contentContainerStyle={styles.content}>
        {/* Contact Info */}
        <View style={styles.section}>
          <View style={styles.infoRow}>
            <View style={styles.iconBox}><Ionicons name="mail" size={20} color="#002147" /></View>
            <View>
              <Text style={styles.label}>電子郵件</Text>
              <Text style={styles.value}>{profile.email}</Text>
            </View>
          </View>
          <View style={styles.separator} />
          <View style={styles.infoRow}>
            <View style={styles.iconBox}><Ionicons name="call" size={20} color="#002147" /></View>
            <View>
              <Text style={styles.label}>聯絡電話</Text>
              <Text style={styles.value}>{profile.phone}</Text>
            </View>
          </View>
          <View style={styles.separator} />
          <View style={styles.infoRow}>
            <View style={styles.iconBox}><Ionicons name="business" size={20} color="#002147" /></View>
            <View>
              <Text style={styles.label}>部門單位</Text>
              <Text style={styles.value}>{profile.department}</Text>
            </View>
          </View>
        </View>

        {/* Education & Experience */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>學歷與經歷</Text>

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

        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => Alert.alert('編輯', '開啟資料修改視窗')}
        >
          <Text style={styles.editBtnText}>編輯詳細資料</Text>
        </TouchableOpacity>

        <Text style={styles.footerVersion}>App Version 1.0.5 (Build 20260115)</Text>
      </ScrollView>
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
    borderRadius: 50, // Circular Avatar
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
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#002147',
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  iconBox: {
    width: 40,
    height: 40,
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
  },
  separator: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 15,
    marginLeft: 55, // Align with text
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
    backgroundColor: '#C69C6D',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#C69C6D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  editBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  footerVersion: {
    textAlign: 'center',
    marginTop: 30,
    color: '#ccc',
    fontSize: 12,
  }
});