import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useAppData } from '../../context/AppDataContext';
import { useTheme } from '../../context/ThemeContext';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import { Ionicons } from '@expo/vector-icons';

export const ApproveRequestsScreen: React.FC = () => {
  const { db, approveAdminRequest, rejectAdminRequest } = useAppData();
  const { colors } = useTheme();

  const [submittingId, setSubmittingId] = useState<number | null>(null);

  // Toast
  const [toastVisible, setToastVisible] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');

  const triggerToast = (msg: string, type: 'success' | 'error' | 'info') => {
    setToastMessage(msg);
    setToastType(type);
    setToastVisible(true);
  };

  const handleApprove = async (id: number) => {
    setSubmittingId(id);
    try {
      const success = await approveAdminRequest(id);
      if (success) {
        triggerToast('So\'rov muvaffaqiyatli tasdiqlandi', 'success');
      } else {
        triggerToast('Tasdiqlashda xatolik yuz berdi', 'error');
      }
    } catch {
      triggerToast('Tarmoq xatosi', 'error');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleReject = async (id: number) => {
    setSubmittingId(id);
    try {
      const success = await rejectAdminRequest(id);
      if (success) {
        triggerToast('So\'rov bekor qilindi', 'info');
      } else {
        triggerToast('Rad etishda xatolik yuz berdi', 'error');
      }
    } catch {
      triggerToast('Tarmoq xatosi', 'error');
    } finally {
      setSubmittingId(null);
    }
  };

  const adminRequests = db?.adminRequests || [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="So'rovlar" showThemeToggle={false} />
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onHide={() => setToastVisible(false)}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Adminlik so'rovlari ({adminRequests.length})
        </Text>

        {adminRequests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="git-pull-request-outline" size={56} color={colors.textDim} />
            <Text style={[styles.emptyText, { color: colors.textDim }]}>
              Hozircha adminlikka ko'tarish so'rovlari mavjud emas.
            </Text>
          </View>
        ) : (
          adminRequests.map((req) => {
            const requester = db?.admins.find((a) => a.id === req.requesterAdminId);
            const candidate = db?.admins.find((a) => a.id === req.candidateAdminId);
            const dateStr = new Date(req.createdAt).toLocaleDateString('uz-UZ', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <Card key={req.id} style={styles.reqCard}>
                <View style={styles.reqHeader}>
                  <Text style={[styles.candidateName, { color: colors.text }]}>
                    Nomzod: {candidate?.name || req.teacherName || 'O\'qituvchi'}
                  </Text>
                  <Text style={[styles.reqDate, { color: colors.textDim }]}>{dateStr}</Text>
                </View>
                <Text style={[styles.reqDetail, { color: colors.textDim }]}>
                  Taklif qilgan admin: {requester?.name || 'Tizim'}
                </Text>
                <View style={styles.actionRow}>
                  <Button
                    title="Rad etish"
                    variant="danger"
                    onPress={() => handleReject(req.id)}
                    loading={submittingId === req.id}
                    style={styles.actionBtn}
                    textStyle={styles.actionBtnText}
                  />
                  <Button
                    title="Tasdiqlash"
                    variant="success"
                    onPress={() => handleApprove(req.id)}
                    loading={submittingId === req.id}
                    style={styles.actionBtn}
                    textStyle={styles.actionBtnText}
                  />
                </View>
              </Card>
            );
          })
        )}
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
  reqCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  reqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  candidateName: {
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
  reqDate: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
  },
  reqDetail: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionBtn: {
    width: '48%',
    height: 38,
    borderRadius: 10,
  },
  actionBtnText: {
    fontSize: 13,
  },
});

export default ApproveRequestsScreen;
