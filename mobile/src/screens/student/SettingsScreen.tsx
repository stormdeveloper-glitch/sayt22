import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Switch,
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

export const SettingsScreen: React.FC = () => {
  const { currentUser, updatePassword, requestTelegramLink, logout } = useAppData();
  const { colors, isDarkMode, toggleTheme } = useTheme();

  // Password fields
  const [newPass, setNewPass] = useState<string>('');
  const [confirmPass, setConfirmPass] = useState<string>('');
  const [passLoading, setPassLoading] = useState<boolean>(false);

  // Telegram Link fields
  const [telegramId, setTelegramId] = useState<string>('');
  const [tgLoading, setTgLoading] = useState<boolean>(false);

  // Toast
  const [toastVisible, setToastVisible] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');

  const triggerToast = (msg: string, type: 'success' | 'error' | 'info') => {
    setToastMessage(msg);
    setToastType(type);
    setToastVisible(true);
  };

  const handleUpdatePassword = async () => {
    if (!newPass) {
      triggerToast('Yangi parolni kiriting', 'error');
      return;
    }
    if (newPass !== confirmPass) {
      triggerToast('Parollar mos kelmadi', 'error');
      return;
    }

    setPassLoading(true);
    try {
      const success = await updatePassword(newPass);
      if (success) {
        triggerToast('Parol muvaffaqiyatli yangilandi', 'success');
        setNewPass('');
        setConfirmPass('');
      } else {
        triggerToast('Parolni o\'zgartirishda xato yuz berdi', 'error');
      }
    } catch {
      triggerToast('Tarmoq xatosi', 'error');
    } finally {
      setPassLoading(false);
    }
  };

  const handleTelegramLink = async () => {
    const tid = parseInt(telegramId, 10);
    if (isNaN(tid) || tid <= 0) {
      triggerToast('Iltimos, to\'g\'ri Telegram ID kiriting', 'error');
      return;
    }

    setTgLoading(true);
    try {
      const res = await requestTelegramLink(tid);
      if (res.status === 'pending') {
        triggerToast('Telegram botga tasdiqlash yuborildi', 'info');
        setTelegramId('');
      } else {
        triggerToast(res.message || 'Xatolik yuz berdi', 'error');
      }
    } catch {
      triggerToast('Tarmoq xatosi', 'error');
    } finally {
      setTgLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Chiqish', 'Haqiqatan ham tizimdan chiqmoqchimisiz?', [
      { text: 'Yo\'q', style: 'cancel' },
      { text: 'Ha, chiqish', onPress: () => logout(), style: 'destructive' },
    ]);
  };

  const roleLabel =
    currentUser?.role === 'student'
      ? 'Talaba'
      : currentUser?.role === 'teacher'
      ? 'O\'qituvchi'
      : 'Administrator';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Sozlamalar" showThemeToggle={false} />
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onHide={() => setToastVisible(false)}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Card */}
        <Card style={styles.userCard}>
          <View style={styles.userRow}>
            <View style={[styles.avatarCircle, { backgroundColor: colors.primaryLight }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {currentUser?.name
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </Text>
            </View>
            <View style={styles.userDetails}>
              <Text style={[styles.userName, { color: colors.text }]}>{currentUser?.name}</Text>
              <Text style={[styles.userRole, { color: colors.textDim }]}>
                ID: {currentUser?.id} • {roleLabel}
              </Text>
            </View>
          </View>
        </Card>

        {/* Theme Settings */}
        <Card style={styles.settingRowCard}>
          <View style={styles.settingRow}>
            <View style={styles.rowLabelWrapper}>
              <Ionicons name="moon-outline" size={22} color={colors.text} style={styles.rowIcon} />
              <Text style={[styles.rowLabel, { color: colors.text }]}>Tungi rejim (Dark Mode)</Text>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#ffffff"
            />
          </View>
        </Card>

        {/* Telegram Link Card */}
        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Telegram profilini ulash</Text>
          <Text style={[styles.cardSubtitle, { color: colors.textDim }]}>
            Bot orqali tranzaksiyalar va e'lonlar haqida push-bildirishnoma olish uchun Telegram
            Profilingiz ID raqamini kiriting va botda tasdiqlang.
          </Text>
          <Input
            label="Telegram ID"
            placeholder="Masalan: 123456789"
            value={telegramId}
            onChangeText={setTelegramId}
            keyboardType="numeric"
          />
          <Button
            title="Tasdiqlash so'rovini yuborish"
            onPress={handleTelegramLink}
            loading={tgLoading}
          />
        </Card>

        {/* Change Password Card */}
        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Parolni o'zgartirish</Text>
          <Input
            label="Yangi parol"
            placeholder="••••••"
            value={newPass}
            onChangeText={setNewPass}
            secureTextEntry
          />
          <Input
            label="Yangi parolni takrorlang"
            placeholder="••••••"
            value={confirmPass}
            onChangeText={setConfirmPass}
            secureTextEntry
          />
          <Button title="Parolni Yangilash" onPress={handleUpdatePassword} loading={passLoading} />
        </Card>

        {/* Logout Button */}
        <TouchableOpacity
          onPress={handleLogout}
          style={[styles.logoutBtn, { borderColor: colors.danger }]}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={22} color={colors.danger} style={styles.logoutIcon} />
          <Text style={[styles.logoutText, { color: colors.danger }]}>Tizimdan Chiqish</Text>
        </TouchableOpacity>
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
  userCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
  },
  userRole: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  settingRowCard: {
    padding: 14,
    borderRadius: 16,
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabelWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowIcon: {
    marginRight: 12,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  card: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
    marginBottom: 16,
  },
  logoutBtn: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 30,
  },
  logoutIcon: {
    marginRight: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

export default SettingsScreen;
