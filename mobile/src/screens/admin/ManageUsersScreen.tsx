import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useAppData } from '../../context/AppDataContext';
import { useTheme } from '../../context/ThemeContext';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import { Ionicons } from '@expo/vector-icons';

export const ManageUsersScreen: React.FC = () => {
  const { db, createUser, deleteUser } = useAppData();
  const { colors } = useTheme();

  const [activeTab, setActiveTab] = useState<'student' | 'teacher' | 'admin'>('student');

  // Form states
  const [name, setName] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [group, setGroup] = useState<string>('D1');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Toast
  const [toastVisible, setToastVisible] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');

  const triggerToast = (msg: string, type: 'success' | 'error' | 'info') => {
    setToastMessage(msg);
    setToastType(type);
    setToastVisible(true);
  };

  const handleAddUser = async () => {
    if (!name.trim() || !password.trim()) {
      triggerToast('Ism va parolni kiriting', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const success = await createUser(activeTab, name.trim(), password.trim(), activeTab === 'student' ? group.trim() : undefined);
      if (success) {
        triggerToast('Foydalanuvchi muvaffaqiyatli qo\'shildi', 'success');
        setName('');
        setPassword('');
        setGroup('D1');
      } else {
        triggerToast('Qo\'shishda xatolik', 'error');
      }
    } catch {
      triggerToast('Tarmoq xatosi', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = (id: number, userName: string) => {
    Alert.alert('O\'chirish', `Haqiqatan ham "${userName}" ni o'chirmoqchimisiz?`, [
      { text: 'Bekor qilish', style: 'cancel' },
      {
        text: 'O\'chirish',
        style: 'destructive',
        onPress: async () => {
          try {
            const success = await deleteUser(activeTab, id);
            if (success) {
              triggerToast('Foydalanuvchi o\'chirildi', 'success');
            } else {
              triggerToast('O\'chirishda xatolik', 'error');
            }
          } catch {
            triggerToast('Tarmoq xatosi', 'error');
          }
        },
      },
    ]);
  };

  const getUsers = () => {
    if (!db) return [];
    if (activeTab === 'student') return db.students || [];
    if (activeTab === 'teacher') return db.teachers || [];
    return db.admins || [];
  };

  const activeTabStyle = {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Foydalanuvchilar" showThemeToggle={false} />
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onHide={() => setToastVisible(false)}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Tab Controls */}
        <View style={[styles.tabContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {(['student', 'teacher', 'admin'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => {
                setActiveTab(tab);
                setName('');
                setPassword('');
              }}
              style={[styles.tabButton, activeTab === tab ? activeTabStyle : null]}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, { color: activeTab === tab ? '#ffffff' : colors.textDim }]}>
                {tab === 'student' ? 'Talabalar' : tab === 'teacher' ? 'O\'qituvchilar' : 'Adminlar'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Add User Form Card */}
        <Card style={styles.formCard}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Yangi {activeTab === 'student' ? 'talaba' : activeTab === 'teacher' ? 'o\'qituvchi' : 'admin'} qo'shish
          </Text>

          <Input label="To'liq ismi" placeholder="Masalan: Sardor Bahodirjonov" value={name} onChangeText={setName} />
          <Input label="Paroli" placeholder="••••••" value={password} onChangeText={setPassword} secureTextEntry />

          {activeTab === 'student' && (
            <Input label="Guruh (D1, D2 va h.k.)" placeholder="D1" value={group} onChangeText={setGroup} />
          )}

          <Button title="Saqlash" onPress={handleAddUser} loading={submitting} />
        </Card>

        {/* Users List */}
        <Text style={[styles.listTitle, { color: colors.text }]}>Mavjud ro'yxat ({getUsers().length})</Text>

        {getUsers().map((u: any) => (
          <Card key={u.id} style={styles.userItemCard}>
            <View style={styles.userItemRow}>
              <View style={styles.userInfo}>
                <Text style={[styles.userName, { color: colors.text }]}>{u.name}</Text>
                <Text style={[styles.userMeta, { color: colors.textDim }]}>
                  ID: {u.id} {u.group ? `• Guruh: ${u.group}` : ''}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleDeleteUser(u.id, u.name)}
                style={[styles.deleteBtn, { backgroundColor: colors.danger + '10' }]}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </TouchableOpacity>
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 4,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  formCard: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 16,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
    paddingLeft: 4,
  },
  userItemCard: {
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
  },
  userItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
    marginRight: 8,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
  },
  userMeta: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  deleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ManageUsersScreen;
