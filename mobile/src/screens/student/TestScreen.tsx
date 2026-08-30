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
import Toast from '../../components/Toast';
import { Test, Question } from '../../types';
import { Ionicons } from '@expo/vector-icons';

export const TestScreen: React.FC = () => {
  const { db, submitHomework } = useAppData();
  const { colors } = useTheme();

  const [activeTest, setActiveTest] = useState<Test | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [quizFinished, setQuizFinished] = useState<boolean>(false);
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

  const handleStartTest = (test: Test) => {
    if (!test.questions || test.questions.length === 0) {
      triggerToast('Bu testda savollar mavjud emas', 'info');
      return;
    }
    setActiveTest(test);
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setQuizFinished(false);
  };

  const handleAnswerSelect = (optionIndex: number) => {
    setSelectedAnswers({
      ...selectedAnswers,
      [currentQuestionIndex]: optionIndex,
    });
  };

  const handleNext = () => {
    if (activeTest && currentQuestionIndex < activeTest.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const calculateScore = () => {
    if (!activeTest) return { correct: 0, total: 0, percent: 0 };
    let correctCount = 0;
    activeTest.questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.c) {
        correctCount++;
      }
    });
    const total = activeTest.questions.length;
    return {
      correct: correctCount,
      total,
      percent: Math.round((correctCount / total) * 100),
    };
  };

  const handleSubmitTest = async () => {
    if (!activeTest) return;
    const { correct, total, percent } = calculateScore();

    setSubmitting(true);
    try {
      const textSummary = `Test: ${activeTest.title}\nNatija: ${correct}/${total} to'g'ri (${percent}%)`;
      const success = await submitHomework(activeTest.id, textSummary);
      if (success) {
        setQuizFinished(true);
        triggerToast('Natijangiz muvaffaqiyatli saqlandi', 'success');
      } else {
        triggerToast('Saqlashda xatolik', 'error');
      }
    } catch {
      triggerToast('Tarmoq xatosi', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseQuiz = () => {
    setActiveTest(null);
    setQuizFinished(false);
  };

  const tests = db?.tests || [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Test topshiriqlari" showThemeToggle={false} />
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onHide={() => setToastVisible(false)}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {tests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={56} color={colors.textDim} />
            <Text style={[styles.emptyText, { color: colors.textDim }]}>
              Hozircha faol testlar mavjud emas.
            </Text>
          </View>
        ) : (
          tests.map((test) => {
            const teacherName =
              db?.teachers.find((t) => t.id === test.teacherId)?.name || 'O\'qituvchi';
            return (
              <Card key={test.id} style={styles.testCard}>
                <View style={styles.testHeader}>
                  <Text style={[styles.testTitle, { color: colors.text }]}>{test.title}</Text>
                  <Text style={[styles.testTeacher, { color: colors.textDim }]}>
                    Tuzuvchi: {teacherName}
                  </Text>
                </View>
                <View style={[styles.metaRow, { borderTopColor: colors.border }]}>
                  <View style={styles.metaCol}>
                    <Ionicons name="help-circle-outline" size={18} color={colors.textDim} />
                    <Text style={[styles.metaVal, { color: colors.text }]}>
                      {test.questions.length} ta savol
                    </Text>
                  </View>
                  <Button
                    title="Boshlash"
                    onPress={() => handleStartTest(test)}
                    style={styles.startBtn}
                    textStyle={styles.startBtnText}
                  />
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Quiz Play Modal */}
      <Modal visible={activeTest !== null} animationType="slide">
        {activeTest && (
          <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitleText, { color: colors.text }]} numberOfLines={1}>
                {activeTest.title}
              </Text>
              {!quizFinished && (
                <TouchableOpacity onPress={handleCloseQuiz} activeOpacity={0.7}>
                  <Ionicons name="close-circle-outline" size={28} color={colors.textDim} />
                </TouchableOpacity>
              )}
            </View>

            {!quizFinished ? (
              <View style={styles.quizContent}>
                {/* Progress Indicators */}
                <View style={styles.quizProgressRow}>
                  <Text style={[styles.quizProgressText, { color: colors.textDim }]}>
                    Savol {currentQuestionIndex + 1} / {activeTest.questions.length}
                  </Text>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          backgroundColor: colors.primary,
                          width: `${((currentQuestionIndex + 1) / activeTest.questions.length) * 100}%`,
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* Question Block */}
                <ScrollView style={styles.questionScroll}>
                  <Card style={styles.questionCard}>
                    <Text style={[styles.questionText, { color: colors.text }]}>
                      {activeTest.questions[currentQuestionIndex].q}
                    </Text>
                  </Card>

                  {/* Options List */}
                  {activeTest.questions[currentQuestionIndex].a.map((option, optionIdx) => {
                    const isSelected = selectedAnswers[currentQuestionIndex] === optionIdx;
                    return (
                      <TouchableOpacity
                        key={optionIdx}
                        onPress={() => handleAnswerSelect(optionIdx)}
                        style={[
                          styles.optionBtn,
                          {
                            backgroundColor: colors.card,
                            borderColor: isSelected ? colors.primary : colors.border,
                            borderWidth: isSelected ? 2 : 1,
                          },
                        ]}
                        activeOpacity={0.8}
                      >
                        <View
                          style={[
                            styles.optionRadio,
                            {
                              borderColor: isSelected ? colors.primary : colors.textDim,
                              backgroundColor: isSelected ? colors.primary : 'transparent',
                            },
                          ]}
                        >
                          {isSelected && <View style={styles.radioDot} />}
                        </View>
                        <Text style={[styles.optionText, { color: colors.text }]}>{option}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Navigation Actions */}
                <View style={[styles.quizNavRow, { borderTopColor: colors.border }]}>
                  <Button
                    title="Orqaga"
                    variant="outline"
                    onPress={handlePrev}
                    disabled={currentQuestionIndex === 0}
                    style={styles.navBtn}
                  />
                  {currentQuestionIndex === activeTest.questions.length - 1 ? (
                    <Button
                      title="Yakunlash"
                      onPress={handleSubmitTest}
                      loading={submitting}
                      style={styles.navBtn}
                    />
                  ) : (
                    <Button
                      title="Keyingisi"
                      onPress={handleNext}
                      disabled={selectedAnswers[currentQuestionIndex] === undefined}
                      style={styles.navBtn}
                    />
                  )}
                </View>
              </View>
            ) : (
              // Quiz Finished Screen
              <View style={styles.resultContainer}>
                <Ionicons name="checkmark-done-circle" size={80} color={colors.success} />
                <Text style={[styles.resultTitle, { color: colors.text }]}>Test Yakunlandi!</Text>
                <Text style={[styles.resultSubtitle, { color: colors.textDim }]}>
                  Sizning natijangiz quyidagicha qayd etildi:
                </Text>

                <Card style={styles.resultCard}>
                  <View style={styles.resultRow}>
                    <Text style={[styles.resultLabel, { color: colors.textDim }]}>Jami savollar:</Text>
                    <Text style={[styles.resultVal, { color: colors.text }]}>{calculateScore().total}</Text>
                  </View>
                  <View style={styles.resultRow}>
                    <Text style={[styles.resultLabel, { color: colors.textDim }]}>To'g'ri javoblar:</Text>
                    <Text style={[styles.resultVal, { color: colors.success }]}>{calculateScore().correct}</Text>
                  </View>
                  <View style={styles.resultRow}>
                    <Text style={[styles.resultLabel, { color: colors.textDim }]}>Foiz ko'rsatkichi:</Text>
                    <Text style={[styles.resultVal, { color: colors.primary }]}>{calculateScore().percent}%</Text>
                  </View>
                </Card>

                <Button title="Dashboardga qaytish" onPress={handleCloseQuiz} style={styles.closeBtn} />
              </View>
            )}
          </SafeAreaView>
        )}
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
  testCard: {
    padding: 16,
    borderRadius: 18,
    marginBottom: 16,
  },
  testHeader: {
    marginBottom: 14,
  },
  testTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  testTeacher: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  metaRow: {
    borderTopWidth: 1,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaVal: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  startBtn: {
    height: 38,
    borderRadius: 10,
    width: 100,
  },
  startBtnText: {
    fontSize: 13,
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
    flex: 1,
    marginRight: 16,
  },
  quizContent: {
    flex: 1,
    padding: 16,
  },
  quizProgressRow: {
    marginBottom: 20,
  },
  quizProgressText: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  questionScroll: {
    flex: 1,
  },
  questionCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 0,
    elevation: 1,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
  },
  optionBtn: {
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ffffff',
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  quizNavRow: {
    borderTopWidth: 1,
    paddingTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  navBtn: {
    width: '48%',
  },
  resultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: 20,
  },
  resultSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
    marginTop: 8,
    marginBottom: 24,
  },
  resultCard: {
    width: '100%',
    padding: 20,
    marginBottom: 24,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  resultLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  resultVal: {
    fontSize: 16,
    fontWeight: '800',
  },
  closeBtn: {
    width: '100%',
  },
});

export default TestScreen;
