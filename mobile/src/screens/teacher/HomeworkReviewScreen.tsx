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
import Button from '../../components/Button';
import Input from '../../components/Input';
import Toast from '../../components/Toast';
import { Submission } from '../../types';
import { Ionicons } from '@expo/vector-icons';

export const HomeworkReviewScreen: React.FC = () => {
  const { db, gradeSubmission } = useAppData();
  const { colors } = useTheme();

  const [activeSubmission, setActiveSubmission] = useState<Submission | null>(null);
  const [rewardCoins, setRewardCoins] = useState<string>('10');
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

  const handleReview = (sub: Submission) => {
    setActiveSubmission(sub);
    setRewardCoins('10');
  };

  const handleApprove = async () => {
    if (!activeSubmission) return;
    const coins = parseInt(rewardCoins, 10);
    if (isNaN(coins) || coins < 0) {
      triggerToast('Mukofot tangalarini to\'g\'ri kiriting', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const success = await gradeSubmission(activeSubmission.id, true, coins);
      if (success) {
        triggerToast('Vazifa tasdiqlandi va coinlar o\'tkazildi', 'success');
        setActiveSubmission(null);
      } else {
        triggerToast('Tasdiqlashda xatolik', 'error');
      }
    } catch {
      triggerToast('Tarmoq xatosi', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!activeSubmission) return;

    setSubmitting(true);
    try {
      const success = await gradeSubmission(activeSubmission.id, false, 0);
      if (success) {
        triggerToast('Vazifa rad etildi', 'info');
        setActiveSubmission(null);
      } else {
        triggerToast('Rad etishda xatolik', 'error');
      }
    } catch {
      triggerToast('Tarmoq xatosi', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const pendingSubmissions = db?.submissions.filter((s) => s.status === 'pending') || [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Vazifalarni Tekshirish" showThemeToggle={false} />
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onHide={() => setToastVisible(false)}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Tekshirilishi kutilayotgan vazifalar ({pendingSubmissions.length})
        </Text>

        {pendingSubmissions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-done-circle-outline" size={56} color={colors.success} />
            <Text style={[styles.emptyText, { color: colors.textDim }]}>
              Hamma vazifalar tekshirilgan. Kutilayotgan xabarlar yo'q!
            </Text>
          </View>
        ) : (
          pendingSubmissions.map((sub) => {
            const dateStr = new Date(sub.timestamp).toLocaleDateString('uz-UZ', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <Card key={sub.id} style={styles.subCard}>
                <View style={styles.subHeader}>
                  <Text style={[styles.studentName, { color: colors.text }]}>{sub.studentName}</Text>
                  <Text style={[styles.subDate, { color: colors.textDim }]}>{dateStr}</Text>
                </View>
                {sub.text && (
                  <Text style={[styles.subText, { color: colors.text }]} numberOfLines={2}>
                    {sub.text}
                  </Text>
                )}
                {sub.fileUrl && (
                  <View style={[styles.fileRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Ionicons name="document-outline" size={16} color={colors.text} />
                    <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
                      {sub.fileUrl.split('/').pop()}
                    </Text>
                  </View>
                )}
                <Button
                  title="Tekshirish"
                  onPress={() => handleReview(sub)}
                  style={styles.reviewBtn}
                  textStyle={styles.reviewBtnText}
                />
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Review Grade Modal */}
      <Modal visible={activeSubmission !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          {activeSubmission && (
            <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Vazifani Baholash</Text>
                <TouchableOpacity onPress={() => setActiveSubmission(null)} activeOpacity={0.7}>
                  <Ionicons name="close" size={26} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll}>
                <Text style={[styles.infoLabel, { color: colors.textDim }]}>Talaba:</Text>
                <Text style={[styles.infoVal, { color: colors.text, marginBottom: 12 }]}>
                  {activeSubmission.studentName}
                </Text>

                {activeSubmission.text && (
                  <View style={styles.detailBlock}>
                    <Text style={[styles.infoLabel, { color: colors.textDim }]}>Vazifa matni:</Text>
                    <Card style={[styles.textDetailCard, { backgroundColor: colors.background }]}>
                      <Text style={[styles.detailText, { color: colors.text }]}>
                        {activeSubmission.text}
                      </Text>
                    </Card>
                  </View>
                )}

                {activeSubmission.fileUrl && (
                  <View style={styles.detailBlock}>
                    <Text style={[styles.infoLabel, { color: colors.textDim }]}>Biriktirilgan fayl:</Text>
                    <View style={[styles.fileRow, { backgroundColor: colors.background, borderColor: colors.border, marginBottom: 16 }]}>
                      <Ionicons name="document-outline" size={18} color={colors.text} />
                      <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
                        {activeSubmission.fileUrl.split('/').pop()}
                      </Text>
                    </View>
                  </View>
                )}

                <Input
                  label="Mukofot Coin miqdori"
                  placeholder="Masalan: 10"
                  value={rewardCoins}
                  onChangeText={setRewardCoins}
                  keyboardType="numeric"
                />

                <View style={styles.actionRow}>
                  <Button
                    title="Rad Etish"
                    variant="danger"
                    onPress={handleReject}
                    loading={submitting}
                    style={styles.modalActionBtn}
                  />
                  <Button
                    title="Tasdiqlash"
                    variant="success"
                    onPress={handleApprove}
                    loading={submitting}
                    style={styles.modalActionBtn}
                  />
                </View>
              </ScrollView>
            </View>
          )}
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
    paddingLeft: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 16,
    textAlign: 'center',
  },
  subCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  subHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '800',
  },
  subDate: {
    fontSize: 12,
    fontWeight: '600',
  },
  subText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    marginBottom: 8,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  fileName: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  reviewBtn: {
    height: 38,
    borderRadius: 10,
  },
  reviewBtnText: {
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
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
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoVal: {
    fontSize: 16,
    fontWeight: '700',
  },
  detailBlock: {
    marginBottom: 16,
  },
  textDetailCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 6,
    marginBottom: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  detailText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 20,
  },
  modalActionBtn: {
    width: '48%',
  },
});

export default HomeworkReviewScreen;
