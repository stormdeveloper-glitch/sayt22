import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useAppData } from '../../context/AppDataContext';
import { useTheme } from '../../context/ThemeContext';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Toast from '../../components/Toast';
import { Question } from '../../types';
import { Ionicons } from '@expo/vector-icons';

export const TeacherDashboard: React.FC = () => {
  const { db, createTest, createPlan, currentUser } = useAppData();
  const { colors } = useTheme();

  // Search/Filter states
  const [studentSearch, setStudentSearch] = useState<string>('');

  // Modals
  const [showTestModal, setShowTestModal] = useState<boolean>(false);
  const [showPlanModal, setShowPlanModal] = useState<boolean>(false);

  // New Test form state
  const [testTitle, setTestTitle] = useState<string>('');
  const [questions, setQuestions] = useState<Question[]>([
    { q: '', a: ['', '', '', ''], c: 0 },
  ]);

  // New Plan form state
  const [planTitle, setPlanTitle] = useState<string>('');
  const [planDesc, setPlanDesc] = useState<string>('');

  // Toast
  const [toastVisible, setToastVisible] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');

  const triggerToast = (msg: string, type: 'success' | 'error' | 'info') => {
    setToastMessage(msg);
    setToastType(type);
    setToastVisible(true);
  };

  const handleAddQuestion = () => {
    setQuestions([...questions, { q: '', a: ['', '', '', ''], c: 0 }]);
  };

  const handleQuestionChange = (qIdx: number, text: string) => {
    const updated = [...questions];
    updated[qIdx].q = text;
    setQuestions(updated);
  };

  const handleOptionChange = (qIdx: number, optIdx: number, text: string) => {
    const updated = [...questions];
    updated[qIdx].a[optIdx] = text;
    setQuestions(updated);
  };

  const handleCorrectAnswerChange = (qIdx: number, val: number) => {
    const updated = [...questions];
    updated[qIdx].c = val;
    setQuestions(updated);
  };

  const handleCreateTest = async () => {
    if (!testTitle.trim()) {
      triggerToast('Test nomini kiriting', 'error');
      return;
    }
    const emptyQ = questions.some((q) => !q.q.trim() || q.a.some((opt) => !opt.trim()));
    if (emptyQ) {
      triggerToast('Barcha savol va variantlarni to\'ldiring', 'error');
      return;
    }

    try {
      const success = await createTest(testTitle.trim(), questions);
      if (success) {
        triggerToast('Test muvaffaqiyatli yaratildi', 'success');
        setTestTitle('');
        setQuestions([{ q: '', a: ['', '', '', ''], c: 0 }]);
        setShowTestModal(false);
      }
    } catch {
      triggerToast('Test yaratishda xatolik', 'error');
    }
  };

  const handleCreatePlan = async () => {
    if (!planTitle.trim() || !planDesc.trim()) {
      triggerToast('Sarlavha va tavsifni to\'ldiring', 'error');
      return;
    }

    try {
      const success = await createPlan(planTitle.trim(), planDesc.trim());
      if (success) {
        triggerToast('Dars rejasi muvaffaqiyatli qo\'shildi', 'success');
        setPlanTitle('');
        setPlanDesc('');
        setShowPlanModal(false);
      }
    } catch {
      triggerToast('Dars rejasini yaratishda xatolik', 'error');
    }
  };

  const filteredStudents = db
    ? db.students.filter((s) => s.name.toLowerCase().includes(studentSearch.toLowerCase()))
    : [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="O'qituvchi boshqaruvi" showThemeToggle={false} />
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onHide={() => setToastVisible(false)}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Quick Stats Grid */}
        <View style={styles.statsGrid}>
          <Card style={[styles.statItemCard, { flex: 1, marginRight: 12 }]}>
            <Ionicons name="people" size={24} color={colors.primary} />
            <Text style={[styles.statNumber, { color: colors.text }]}>
              {db?.students.length || 0} ta
            </Text>
            <Text style={[styles.statLabel, { color: colors.textDim }]}>Talabalar</Text>
          </Card>
          <Card style={[styles.statItemCard, { flex: 1 }]}>
            <Ionicons name="document-text" size={24} color={colors.gold} />
            <Text style={[styles.statNumber, { color: colors.text }]}>
              {db?.tests.length || 0} ta
            </Text>
            <Text style={[styles.statLabel, { color: colors.textDim }]}>Faol testlar</Text>
          </Card>
        </View>

        {/* Action Buttons */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Tezkor amallar</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            onPress={() => setShowTestModal(true)}
            style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.text }]}>Yangi test yaratish</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowPlanModal(true)}
            style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.7}
          >
            <Ionicons name="book-outline" size={22} color={colors.gold} />
            <Text style={[styles.actionText, { color: colors.text }]}>Dars rejasi qo'shish</Text>
          </TouchableOpacity>
        </View>

        {/* Student Search and List */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 16 }]}>Talabalar ro'yxati</Text>
        <Input
          placeholder="Qidirish (Ism)..."
          value={studentSearch}
          onChangeText={setStudentSearch}
        />

        {filteredStudents.length === 0 ? (
          <Text style={[styles.noResultText, { color: colors.textDim }]}>Talabalar topilmadi.</Text>
        ) : (
          filteredStudents.map((s) => (
            <Card key={s.id} style={styles.studentCard}>
              <View style={styles.studentRow}>
                <View style={styles.studentDetails}>
                  <Text style={[styles.studentName, { color: colors.text }]}>{s.name}</Text>
                  <Text style={[styles.studentMeta, { color: colors.textDim }]}>
                    Guruh: {s.group} • {s.badge} • Daraja: {s.level}
                  </Text>
                </View>
                <View style={styles.studentCoins}>
                  <Text style={[styles.coinText, { color: colors.primary }]}>{s.totalCoins} coin</Text>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Test Creation Modal */}
      <Modal visible={showTestModal} animationType="slide">
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitleText, { color: colors.text }]}>Yangi Test Yaratish</Text>
            <TouchableOpacity onPress={() => setShowTestModal(false)} activeOpacity={0.7}>
              <Ionicons name="close-circle-outline" size={26} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
            <Input label="Test Sarlavhasi" placeholder="Masalan: JavaScript Kirish" value={testTitle} onChangeText={setTestTitle} />

            {questions.map((q, qIdx) => (
              <Card key={qIdx} style={styles.questionFormCard}>
                <View style={styles.questionHeader}>
                  <Text style={[styles.questionFormTitle, { color: colors.text }]}>Savol {qIdx + 1}</Text>
                  {questions.length > 1 && (
                    <TouchableOpacity
                      onPress={() => setQuestions(questions.filter((_, idx) => idx !== qIdx))}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
                <Input placeholder="Savol matni" value={q.q} onChangeText={(text) => handleQuestionChange(qIdx, text)} />
                {q.a.map((option, optIdx) => (
                  <View key={optIdx} style={styles.optionFormRow}>
                    <TouchableOpacity
                      onPress={() => handleCorrectAnswerChange(qIdx, optIdx)}
                      style={[
                        styles.radioBtn,
                        {
                          borderColor: q.c === optIdx ? colors.primary : colors.textDim,
                          backgroundColor: q.c === optIdx ? colors.primary : 'transparent',
                        },
                      ]}
                      activeOpacity={0.8}
                    />
                    <TextInput
                      placeholder={`Variant ${String.fromCharCode(65 + optIdx)}`}
                      placeholderTextColor={colors.textDim}
                      value={option}
                      onChangeText={(text) => handleOptionChange(qIdx, optIdx, text)}
                      style={[styles.optionInput, { color: colors.text, borderBottomColor: colors.border }]}
                    />
                  </View>
                ))}
              </Card>
            ))}

            <Button title="+ Savol Qo'shish" variant="outline" onPress={handleAddQuestion} style={styles.addQBtn} />
            <Button title="Testni Saqlash" onPress={handleCreateTest} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Plan Creation Modal */}
      <Modal visible={showPlanModal} animationType="slide">
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitleText, { color: colors.text }]}>Yangi Dars Rejasi</Text>
            <TouchableOpacity onPress={() => setShowPlanModal(false)} activeOpacity={0.7}>
              <Ionicons name="close-circle-outline" size={26} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.planFormContainer}>
            <Input label="Reja Sarlavhasi" placeholder="Masalan: HTML & CSS Boshlang'ich" value={planTitle} onChangeText={setPlanTitle} />
            <Input label="Tafsilotlar" placeholder="Reja mazmunini kiriting..." value={planDesc} onChangeText={setPlanDesc} />
            <Button title="Rejani Saqlash" onPress={handleCreatePlan} />
          </View>
        </SafeAreaView>
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
  statsGrid: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  statItemCard: {
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '900',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
    paddingLeft: 4,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  actionBtn: {
    width: '48%',
    height: 60,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  noResultText: {
    textAlign: 'center',
    paddingVertical: 30,
    fontSize: 14,
    fontWeight: '500',
  },
  studentCard: {
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  studentDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '700',
  },
  studentMeta: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  studentCoins: {
    marginLeft: 8,
  },
  coinText: {
    fontSize: 15,
    fontWeight: '800',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  modalTitleText: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 16,
  },
  questionFormCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  questionFormTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  optionFormRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  radioBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    marginRight: 10,
  },
  optionInput: {
    flex: 1,
    height: 38,
    borderBottomWidth: 1.5,
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 2,
  },
  addQBtn: {
    marginBottom: 16,
  },
  planFormContainer: {
    padding: 24,
  },
});

export default TeacherDashboard;
