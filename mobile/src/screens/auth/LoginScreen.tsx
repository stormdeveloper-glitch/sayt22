import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useAppData } from '../../context/AppDataContext';
import { useTheme } from '../../context/ThemeContext';
import { getApiBaseUrl, setApiBaseUrl } from '../../api/client';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Toast from '../../components/Toast';
import { Ionicons } from '@expo/vector-icons';

export const LoginScreen: React.FC = () => {
  const { db, login, refreshData, loading } = useAppData();
  const { colors } = useTheme();

  // Use selectedRole from AppDataContext
const { selectedRole, setSelectedRole, login, db } = useAppData();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [password, setPassword] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Base URL Settings
  const [serverUrl, setServerUrl] = useState<string>('');
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

  // Dropdown selector modal
  const [showUserModal, setShowUserModal] = useState<boolean>(false);

  // Alert Toast State
  const [toastVisible, setToastVisible] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');

  useEffect(() => {
    const fetchUrl = async () => {
      const url = await getApiBaseUrl();
      setServerUrl(url);
    };
    fetchUrl();
  }, []);

  const triggerToast = (msg: string, type: 'success' | 'error' | 'info') => {
    setToastMessage(msg);
    setToastType(type);
    setToastVisible(true);
  };

  const handleSaveSettings = async () => {
    if (!serverUrl.trim()) {
      triggerToast('Server URL bo\'sh bo\'lishi mumkin emas', 'error');
      return;
    }
    await setApiBaseUrl(serverUrl.trim());
    triggerToast('Server sozlamalari saqlandi', 'success');
    setShowSettingsModal(false);
    refreshData().catch(() => {});
  };

  const getUserList = () => {
    if (!db) return [];
    if (selectedRole === 'student') return db.students || [];
    if (selectedRole === 'teacher') return db.teachers || [];
    return db.admins || [];
  };

  const getSelectedUserName = () => {
    if (selectedUserId === null) return '';
    const list = getUserList();
    const found = list.find((u: any) => u.id === selectedUserId);
    return found ? found.name : '';
  };

  const handleLogin = async () => {
    if (selectedUserId === null) {
      triggerToast('Iltimos, ismingizni tanlang', 'error');
      return;
    }
    if (!password) {
      triggerToast('Iltimos, parolingizni kiriting', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const success = await login(selectedRole, selectedUserId, password);
      if (success) {
        triggerToast('Xush kelibsiz!', 'success');
      } else {
        triggerToast('Parol noto\'g\'ri kiritildi', 'error');
      }
    } catch (e: any) {
      triggerToast('Serverga bog\'lanishda xato', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onHide={() => setToastVisible(false)}
      />

      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Settings button */}
        <View style={styles.settingsHeader}>
          <TouchableOpacity
            style={[styles.circleBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setShowSettingsModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Logo and Brand */}
        <View style={styles.logoContainer}>
          <View style={[styles.logoIcon, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="code-working" size={40} color={colors.primary} />
          </View>
          <Text style={[styles.appName, { color: colors.text }]}>TEXNO PARK</Text>
          <Text style={[styles.appSubtitle, { color: colors.textDim }]}>
            O'quv markazi boshqaruv tizimi
          </Text>
        </View>

        {/* Login Form Card */}
        <Card style={styles.formCard}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textDim }]}>
                Foydalanuvchilar ro'yxati yuklanmoqda...
              </Text>
            </View>
          ) : (
            <View>
              <Text style={[styles.formLabel, { color: colors.textDim }]}>Foydalanuvchi nomi</Text>
              <TouchableOpacity
                onPress={() => setShowUserModal(true)}
                style={[
                  styles.selectDropdown,
                  { backgroundColor: colors.background, borderColor: colors.border },
                ]}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.selectDropdownText,
                    { color: selectedUserId !== null ? colors.text : colors.textDim },
                  ]}
                >
                  {selectedUserId !== null ? getSelectedUserName() : '-- Ro\'yxatdan tanlang --'}
                </Text>
                <Ionicons name="chevron-down-outline" size={20} color={colors.textDim} />
              </TouchableOpacity>

              <Input
                label="Parol"
                placeholder="••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <Button
                title="Tizimga Kirish"
                onPress={handleLogin}
                loading={submitting}
                style={styles.loginBtn}
              />
            </View>
          )}
        </Card>
      </ScrollView>

      {/* User Selection Modal */}
      <Modal visible={showUserModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {role === 'student'
                  ? 'Talabalar'
                  : role === 'teacher'
                  ? 'O\'qituvchilar'
                  : 'Adminlar'}{' '}
                ro'yxati
              </Text>
              <TouchableOpacity onPress={() => setShowUserModal(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={26} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {getUserList().length === 0 ? (
                <Text style={[styles.noUsersText, { color: colors.textDim }]}>
                  Foydalanuvchilar topilmadi. Server URLni to'g'ri sozlaganingizga ishonch hosil qiling.
                </Text>
              ) : (
                getUserList().map((user: any) => (
                  <TouchableOpacity
                    key={user.id}
                    onPress={() => {
                      setSelectedUserId(user.id);
                      setShowUserModal(false);
                    }}
                    style={[styles.userOption, { borderBottomColor: colors.border }]}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.userOptionText, { color: colors.text }]}>{user.name}</Text>
                    {user.group && (
                      <Text style={[styles.userOptionGroup, { color: colors.textDim }]}>
                        Guruh: {user.group}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={showSettingsModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, maxHeight: 300 }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Server API Sozlamasi</Text>
              <TouchableOpacity onPress={() => setShowSettingsModal(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={26} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Input
                label="Flask API Server URL (Railway yoki Lokal IP)"
                placeholder="https://example.com yoki http://192.168.1.1:8080"
                value={serverUrl}
                onChangeText={setServerUrl}
              />
              <Button title="Sozlamalarni Saqlash" onPress={handleSaveSettings} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  settingsHeader: {
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  appSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 4,
    marginBottom: 24,
  },
  tabButton: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
  },
  formCard: {
    paddingVertical: 24,
  },
  loadingContainer: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    marginTop: 12,
    fontWeight: '500',
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    paddingLeft: 4,
  },
  selectDropdown: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  selectDropdownText: {
    fontSize: 16,
    fontWeight: '500',
  },
  loginBtn: {
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '70%',
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingBottom: 16,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalScroll: {
    marginVertical: 8,
  },
  noUsersText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
    fontWeight: '500',
    lineHeight: 20,
  },
  userOption: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userOptionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  userOptionGroup: {
    fontSize: 12,
    fontWeight: '500',
  },
  modalBody: {
    marginTop: 8,
  },
});

export default LoginScreen;
