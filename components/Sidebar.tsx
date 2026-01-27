import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../context/UserContext';

interface SidebarProps {
    isVisible: boolean;
    onClose: () => void;
}

export default function Sidebar({ isVisible, onClose }: SidebarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, logout } = useUser();

    const handleLogout = () => {
        onClose();
        logout();
        router.replace('/');
    };

    const menuItems = [
        { icon: 'home', label: '首頁', route: '/dashboard' },
        { icon: 'folder-open', label: '專案列表', route: '/projects' },
        { icon: 'clipboard', label: '施工紀錄', route: '/logs' },
        { icon: 'people', label: '人員管理', route: '/personnel', adminOnly: true },
        { icon: 'library', label: 'SOP資料庫', route: '/sop' },
        { icon: 'person-circle', label: '我的檔案', route: '/profile' },
    ];

    const handlePress = (route: string) => {
        onClose();
        router.push(route as any);
    };

    return (
        <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.menuOverlay}>
                <View style={styles.sideMenu}>
                    <SafeAreaView style={{ flex: 1, padding: 20 }}>
                        <View style={styles.menuHeader}>
                            <Text style={styles.menuTitle}>功能選單</Text>
                            <TouchableOpacity onPress={onClose}>
                                <Ionicons name="close" size={28} color="#fff" />
                            </TouchableOpacity>
                        </View>
                        <View style={{ flex: 1 }}>
                            {menuItems.map((item, index) => {
                                // Check permissions
                                if (item.adminOnly && user?.role !== 'admin' && user?.email !== 'wu@dwcc.com.tw') {
                                    return null;
                                }

                                // Check active (Simple startsWith check, allows /projects/123 to highlight projects)
                                const isActive = pathname.startsWith(item.route) && (item.route !== '/dashboard' || pathname === '/dashboard');

                                return (
                                    <TouchableOpacity
                                        key={index}
                                        style={[styles.menuItem, isActive && styles.menuItemActive]}
                                        onPress={() => handlePress(item.route)}
                                    >
                                        <Ionicons
                                            name={item.icon as any}
                                            size={24}
                                            color={isActive ? '#C69C6D' : '#fff'}
                                        />
                                        <Text style={[styles.menuItemText, isActive && { color: '#C69C6D' }]}>
                                            {item.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        <View style={{ paddingBottom: 20 }}>
                            <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
                                <Ionicons name="log-out-outline" size={24} color="#FF6B6B" />
                                <Text style={[styles.menuItemText, { color: '#FF6B6B' }]}>登出系統</Text>
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>
                </View>
                <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row' },
    sideMenu: { width: '80%', maxWidth: 300, backgroundColor: '#002147', height: '100%' },
    menuHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30, marginTop: 10 },
    menuTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
    menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 10, borderRadius: 8, marginBottom: 5 },
    menuItemActive: { backgroundColor: 'rgba(255,255,255,0.1)' },
    menuItemText: { color: '#fff', fontSize: 16, marginLeft: 15 },
});
