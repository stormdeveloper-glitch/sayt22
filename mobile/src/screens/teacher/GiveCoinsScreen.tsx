import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useAppData } from '../../context/AppDataContext';
import { useTheme } from '../../context/ThemeContext';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import { Ionicons } from '@expo/vector-icons';

export const GiveCoinsScreen: React.FC = () => {
  const { db, giveCoins } = useAppData();
  const { colors } = useTheme();

  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [coinAmount, setCoinAmount] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Student selection dropdown
  const [showStudentModal, setShowStudentModal] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Toast
  const [toastVisible, setToastVisible] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');

  const triggerToast = (msg: string, type: 'success' | 'error' | 'info') => {
    setToastMessage(msg);
    setToastType(type);
    setToastVisible(true);
  };

  const getSelectedStudentName = () => {
    if (selectedStudentId === null) return '';
    const s = db?.students.find((std) => std.id === selectedStudentId);
    return s ? s.name : '';
  };

  const handleQuickAmount = (amount: number) => {
    setCoinAmount(String(amount));
  };

  const handleSubmit = async () => {
    if (selectedStudentId === null) {
      triggerToast('Talabani tanlang', 'error');
      return;
    }
    const amt = parseInt(coinAmount, 10);
    if (isNaN(amt) || amt === 0) {
      triggerToast('Noldan farqli to\'g\'ri coin miqdorini kiriting', 'error');
      return;
    }
    if (!reason.trim()) {
      triggerToast('O\'tkazma sababini kiriting', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const success = await giveCoins(selectedStudentId, amt, reason.trim());
      if (success) {
        triggerToast('Tanga muvaffaqiyatli topshirildi', 'success');
        setSelectedStudentId(null);
        setCoinAmount('');
        setReason('');
      } else {
        triggerToast('Tangani yuborishda xatolik', 'error');
      }
    } catch {
      triggerToast('Tarmoq xatosi', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredStudents = db
    ? db.students.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const quickAmounts = [5, 10, 20, 50, -5, -10];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Tanga Topshirish" showThemeToggle={false} />
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onHide={() => setToastVisible(false)}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Card style={styles.formCard}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Tanga berish yoki olish</Text>

          {/* Student Select dropdown */}
          <Text style={[styles.label, { color: colors.textDim }]}>Talaba</Text>
          <TouchableOpacity
            onPress={() => setShowStudentModal(true)}
            style={[
              styles.selectDropdown,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.selectDropdownText,
                { color: selectedStudentId !== null ? colors.text : colors.textDim },
              ]}
            >
              {selectedStudentId !== null ? getSelectedStudentName() : '-- Talabani tanlang --'}
            </Text>
            <Ionicons name="chevron-down-outline" size={20} color={colors.textDim} />
          </TouchableOpacity>

          {/* Amount input */}
          <Input
            label="Tanga Miqdori (ayirish uchun minus qiling)"
            placeholder="Masalan: 10 yoki -5"
            value={coinAmount}
            onChangeText={setCoinAmount}
            keyboardType="numeric"
          />

          {/* Quick chips */}
          <View style={styles.chipsRow}>
            {quickAmounts.map((amt) => {
              const label = amt > 0 ? `+${amt}` : `${amt}`;
              const isNegative = amt < 0;
              return (
                <TouchableOpacity
                  key={amt}
                  onPress={() => handleQuickAmount(amt)}
                  style={[
                    styles.chipBtn,
                    {
                      backgroundColor: colors.background,
                      borderColor: isNegative ? colors.danger : colors.success,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, { color: isNegative ? colors.danger : colors.success }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Reason input */}
          <Input
            label="Sabab / Izoh"
            placeholder="Masalan: Darsda faol ishtirok etdi"
            value={reason}
            onChangeText={setReason}
          />

          <Button title="O'tkazmani tasdiqlash" onPress={handleSubmit} loading={submitting} />
        </Card>
      </ScrollView>

      {/* Student selection Modal */}
      <Modal visible={showStudentModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Talabani tanlang</Text>
              <TouchableOpacity onPress={() => setShowStudentModal(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={26} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Input
              placeholder="Qidiruv..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            <ScrollView style={styles.modalScroll}>
              {filteredStudents.map((std) => (
                <TouchableOpacity
                  key={std.id}
                  onPress={() => {
                    setSelectedStudentId(std.id);
                    setShowStudentModal(false);
                  }}
                  style={[styles.studentOption, { borderBottomColor: colors.border }]}
                  activeOpacity={0.7}
                >
                  <View>
                    <Text style={[styles.studentOptionName, { color: colors.text }]}>{std.name}</Text>
                    <Text style={[styles.studentOptionMeta, { color: colors.textDim }]}>
                      Guruh: {std.group} • Balans: {std.totalCoins} coin
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
                </TouchableOpacity>
              ))}
            </ScrollView>
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
  scrollContent: {
    padding: 16,
  },
  formCard: {
    padding: 20,
    borderRadius: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 20,
  },
  label: {
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
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    marginHorizontal: -4,
  },
  chipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    margin: 4,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '80%',
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
    marginTop: 8,
  },
  studentOption: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  studentOptionName: {
    fontSize: 15,
    fontWeight: '700',
  },
  studentOptionMeta: {
    fontSize: 12,
    marginTop: 4,
  },
});

export default GiveCoinsScreen;
