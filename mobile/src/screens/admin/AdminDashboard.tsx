import React from 'react';
import { StyleSheet, View, Text, ScrollView, SafeAreaView } from 'react-native';
import { useAppData } from '../../context/AppDataContext';
import { useTheme } from '../../context/ThemeContext';
import Header from '../../components/Header';
import Card from '../../components/Card';
import { Ionicons } from '@expo/vector-icons';

export const AdminDashboard: React.FC = () => {
  const { db } = useAppData();
  const { colors } = useTheme();

  const totalCoins = db?.students.reduce((acc, s) => acc + (s.totalCoins || 0), 0) || 0;
  const totalStudents = db?.students.length || 0;
  const totalTeachers = db?.teachers.length || 0;
  const totalAdmins = db?.admins.length || 0;

  const transactions = db?.transactions || [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Admin Dashboard" showThemeToggle={false} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Stat Cards Grid */}
        <View style={styles.statsGrid}>
          <Card style={[styles.statCard, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="logo-bitcoin" size={24} color={colors.primary} />
            <Text style={[styles.statNumber, { color: colors.text }]}>{totalCoins}</Text>
            <Text style={[styles.statLabel, { color: colors.textDim }]}>Jami coinlar</Text>
          </Card>

          <Card style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Ionicons name="people" size={24} color={colors.success} />
            <Text style={[styles.statNumber, { color: colors.text }]}>{totalStudents}</Text>
            <Text style={[styles.statLabel, { color: colors.textDim }]}>Talabalar</Text>
          </Card>
        </View>

        <View style={styles.statsGrid}>
          <Card style={[styles.statCard, { backgroundColor: colors.card, marginRight: 12 }]}>
            <Ionicons name="school" size={24} color={colors.gold} />
            <Text style={[styles.statNumber, { color: colors.text }]}>{totalTeachers}</Text>
            <Text style={[styles.statLabel, { color: colors.textDim }]}>O'qituvchilar</Text>
          </Card>

          <Card style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Ionicons name="shield-checkmark" size={24} color={colors.danger} />
            <Text style={[styles.statNumber, { color: colors.text }]}>{totalAdmins}</Text>
            <Text style={[styles.statLabel, { color: colors.textDim }]}>Adminlar</Text>
          </Card>
        </View>

        {/* Transaction History Log */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Tizim tranzaksiyalari</Text>

        {transactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={48} color={colors.textDim} />
            <Text style={[styles.emptyText, { color: colors.textDim }]}>
              Hozircha o'tkazmalar tarixi bo'sh.
            </Text>
          </View>
        ) : (
          transactions.map((tx, idx) => {
            const isPositive = tx.amount >= 0;
            const dateStr = new Date(tx.timestamp).toLocaleString('uz-UZ', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            let actorName = 'Tizim';
            if (tx.teacherId) {
              actorName = db?.teachers.find((t) => t.id === tx.teacherId)?.name || 'O\'qituvchi';
            } else if (tx.adminId) {
              actorName = db?.admins.find((a) => a.id === tx.adminId)?.name || 'Admin';
            }

            return (
              <Card key={idx} style={styles.txCard}>
                <View style={styles.txRow}>
                  <View style={styles.txDetails}>
                    <Text style={[styles.txText, { color: colors.text }]}>
                      {tx.studentName || `Talaba ID: ${tx.studentId}`}
                    </Text>
                    <Text style={[styles.txReason, { color: colors.textDim }]} numberOfLines={1}>
                      Sabab: {tx.reason}
                    </Text>
                    <Text style={[styles.txMeta, { color: colors.textDim }]}>
                      Tomonidan: {actorName} • {dateStr}
                    </Text>
                  </View>
                  <View style={styles.amountBox}>
                    <Text style={[styles.txAmount, { color: isPositive ? colors.success : colors.danger }]}>
                      {isPositive ? '+' : ''}
                      {tx.amount}
                    </Text>
                  </View>
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
  statsGrid: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginRight: 12,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 20,
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
  txCard: {
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  txDetails: {
    flex: 1,
    marginRight: 8,
  },
  txText: {
    fontSize: 15,
    fontWeight: '700',
  },
  txReason: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },
  txMeta: {
    fontSize: 11,
    marginTop: 4,
  },
  amountBox: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 18,
    fontWeight: '900',
  },
});

export default AdminDashboard;
