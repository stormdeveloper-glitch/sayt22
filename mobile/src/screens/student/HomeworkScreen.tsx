import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useAppData } from '../../context/AppDataContext';
import { useTheme } from '../../context/ThemeContext';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import { Ionicons } from '@expo/vector-icons';

export const HomeworkScreen: React.FC = () => {
  const { db, currentUser, submitHomework } = useAppData();
  const { colors } = useTheme();

  const [hwText, setHwText] = useState<string>('');
  const [attachedFile, setAttachedFile] = useState<string>('');
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

  const handleSimulateFile = () => {
    const mockFiles = ['screenshot_homework_1.png', 'project_doc.pdf', 'solution.js', 'homework_archive.zip'];
    const randomFile = mockFiles[Math.floor(Math.random() * mockFiles.length)];
    setAttachedFile(randomFile);
    triggerToast(`${randomFile} muvaffaqiyatli biriktirildi`, 'success');
  };

  const handleSubmit = async () => {
    if (!hwText.trim() && !attachedFile) {
      triggerToast('Iltimos, xabar matni yoki fayl kiriting', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const fileUrl = attachedFile ? `uploads/simulated_${attachedFile}` : undefined;
      const success = await submitHomework(undefined, hwText.trim(), fileUrl);
      if (success) {
        triggerToast('Vazifa tekshirish uchun yuborildi', 'success');
        setHwText('');
        setAttachedFile('');
      } else {
        triggerToast('Vazifani yuborishda xatolik', 'error');
      }
    } catch {
      triggerToast('Tarmoq xatosi', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const mySubmissions = db?.submissions.filter((s) => s.studentId === currentUser?.id) || [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Vazifa topshirish" showThemeToggle={false} />
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onHide={() => setToastVisible(false)}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Upload Form */}
        <Card style={styles.formCard}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Yangi vazifa topshirish</Text>

          <Input
            label="Vazifa haqida ma'lumot (matn)"
            placeholder="Yozma javob yoki izoh kiriting..."
            value={hwText}
            onChangeText={setHwText}
            style={styles.textInputStyle}
          />

          <View style={styles.attachmentWrapper}>
            <Text style={[styles.label, { color: colors.textDim }]}>Fayl biriktirish</Text>
            <TouchableOpacity
              onPress={handleSimulateFile}
              style={[
                styles.filePickerBtn,
                {
                  backgroundColor: colors.background,
                  borderColor: attachedFile ? colors.success : colors.border,
                },
              ]}
              activeOpacity={0.7}
            >
              <Ionicons
                name={attachedFile ? 'document-attach' : 'cloud-upload-outline'}
                size={22}
                color={attachedFile ? colors.success : colors.textDim}
              />
              <Text
                style={[
                  styles.filePickerText,
                  { color: attachedFile ? colors.text : colors.textDim },
                ]}
                numberOfLines={1}
              >
                {attachedFile ? attachedFile : 'Faylni tanlang (Simulyatsiya)'}
              </Text>
              {attachedFile && (
                <TouchableOpacity onPress={() => setAttachedFile('')} activeOpacity={0.7}>
                  <Ionicons name="close-circle" size={18} color={colors.danger} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </View>

          <Button title="Vazifani Yuborish" onPress={handleSubmit} loading={submitting} />
        </Card>

        {/* History of Submissions */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Mening vazifalarim</Text>

        {mySubmissions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={48} color={colors.textDim} />
            <Text style={[styles.emptyText, { color: colors.textDim }]}>
              Hozircha yuborilgan vazifalar mavjud emas.
            </Text>
          </View>
        ) : (
          mySubmissions.map((sub) => {
            const dateStr = new Date(sub.timestamp).toLocaleDateString('uz-UZ', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            let statusColor = colors.textDim;
            let statusText = 'Kutilmoqda';
            if (sub.status === 'approved') {
              statusColor = colors.success;
              statusText = 'Tasdiqlangan';
            } else if (sub.status === 'rejected') {
              statusColor = colors.danger;
              statusText = 'Rad etilgan';
            }

            return (
              <Card key={sub.id} style={styles.subCard}>
                <View style={styles.subHeader}>
                  <Text style={[styles.subDate, { color: colors.textDim }]}>{dateStr}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + '15', borderColor: statusColor }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
                  </View>
                </View>

                {sub.text && <Text style={[styles.subText, { color: colors.text }]}>{sub.text}</Text>}

                {sub.fileUrl && (
                  <View style={[styles.fileRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Ionicons name="document-outline" size={18} color={colors.text} />
                    <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
                      {sub.fileUrl.split('/').pop()}
                    </Text>
                  </View>
                )}
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
  formCard: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
  },
  textInputStyle: {
    marginBottom: 12,
  },
  attachmentWrapper: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    paddingLeft: 4,
  },
  filePickerBtn: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  filePickerText: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    marginLeft: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
    paddingLeft: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 12,
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
  subDate: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
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
    marginTop: 4,
  },
  fileName: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
});

export default HomeworkScreen;
