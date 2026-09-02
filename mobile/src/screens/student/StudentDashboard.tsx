import React from 'react';
import { StyleSheet, View, Text, ScrollView, SafeAreaView, FlatList } from 'react-native';
import { useAppData } from '../../context/AppDataContext';
import { useTheme } from '../../context/ThemeContext';
import Header from '../../components/Header';
import Card from '../../components/Card';
import { Ionicons } from '@expo/vector-icons';

export const StudentDashboard: React.FC = () => {
  const { currentUser, db } = useAppData();
  const { colors } = useTheme();

  // Find latest student details from DB
  const student = db?.students.find((s) => s.id === currentUser?.id) || currentUser;
  const recentTransactions = db?.transactions.filter((tx) => tx.studentId === student?.id) || [];

  const renderTransactionItem = ({ item }: { item: typeof recentTransactions[0] }) => {
    const isPositive = item.amount >= 0;
    const dateStr = new Date(item.timestamp).toLocaleDateString('uz-UZ', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    let giverName = 'Tizim';
    if (item.teacherId) {
      giverName = db?.teachers.find((t) => t.id === item.teacherId)?.name || 'O\'qituvchi';
    } else if (item.adminId) {
      giverName = db?.admins.find((a) => a.id === item.adminId)?.name || 'Admin';
    }

    return (
      <Card style={styles.txCard}>
        <View style={styles.txRow}>
          <View style={[styles.txIconWrapper, { backgroundColor: isPositive ? colors.success + '15' : colors.danger + '15' }]}>
            <Ionicons
              name={isPositive ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
              size={24}
              color={isPositive ? colors.success : colors.danger}
            />
          </View>
          <View style={styles.txDetails}>
            <Text style={[styles.txReason, { color: colors.text }]} numberOfLines={1}>
              {item.reason}
            </Text>
            <Text style={[styles.txMeta, { color: colors.textDim }]}>
              {giverName} • {dateStr}
            </Text>
          </View>
          <View style={styles.txAmountWrapper}>
            <Text
              style={[
                styles.txAmount,
                { color: isPositive ? colors.success : colors.danger },
              ]}
            >
              {isPositive ? '+' : ''}
              {item.amount}
            </Text>
            <Text style={[styles.txCoinLabel, { color: colors.textDim }]}>coin</Text>
          </View>
        </View>
      </Card>
    );
  };

  const totalCoins = student?.totalCoins || 0;
  const currentLevel = student?.level || 1;
  const currentLevelBase = (currentLevel - 1) * 100;
  const nextLevelTarget = currentLevel * 100;
  const levelProgress = totalCoins - currentLevelBase;
  const progressPercent = Math.max(0, Math.min(100, (levelProgress / 100) * 100));

  const badgeColor =
    student?.badge === 'Elite'
      ? colors.gold
      : student?.badge === 'Pro'
      ? colors.accent
      : student?.badge === 'Active'
      ? colors.primary
      : colors.textDim;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Texno Park" showThemeToggle />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <Card style={[styles.profileCard, { backgroundColor: colors.primary }]}>
          <View style={styles.profileHeader}>
            <View>
              <Text style={styles.profileName}>{student?.name}</Text>
              <Text style={styles.profileGroup}>Guruh: {student?.group}</Text>
            </View>
            <View style={[styles.badgeContainer, { backgroundColor: badgeColor + '30', borderColor: badgeColor }]}>
              <Text style={[styles.badgeText, { color: '#ffffff' }]}>{student?.badge}</Text>
            </View>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>JAMI COINLAR</Text>
              <View style={styles.statValueContainer}>
                <Ionicons name="logo-bitcoin" size={28} color="#FFD700" style={styles.statIcon} />
                <Text style={styles.statValue}>{totalCoins}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>OLMOSLAR</Text>
              <View style={styles.statValueContainer}>
                <Ionicons name="diamond" size={26} color="#00E5FF" style={styles.statIcon} />
                <Text style={styles.statValue}>{student?.olmos ?? student?.diamonds ?? 0}</Text>
              </View>
            </View>
          </View>

          {/* Level Progress */}
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.levelText}>Daraja: {currentLevel}</Text>
              <Text style={styles.progressCoins}>
                {levelProgress}/100 coin keyingisiga
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
          </View>
        </Card>

        {/* Transaction Section */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Tranzaksiyalar tarixi</Text>

        {recentTransactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={48} color={colors.textDim} />
            <Text style={[styles.emptyText, { color: colors.textDim }]}>
              Hozircha tanga o'tkazmalari mavjud emas.
            </Text>
          </View>
        ) : (
          recentTransactions.map((item, index) => (
            <React.Fragment key={index}>
              {renderTransactionItem({ item })}
            </React.Fragment>
          ))
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
  profileCard: {
    borderWidth: 0,
    padding: 22,
    borderRadius: 24,
    marginBottom: 24,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 8,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
  },
  profileGroup: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: '600',
    marginTop: 4,
  },
  badgeContainer: {
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1.5,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 20,
  },
  statBox: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  statValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    marginRight: 6,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
  },
  divider: {
    width: 1.5,
    height: '60%',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  progressContainer: {
    marginTop: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  levelText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '800',
  },
  progressCoins: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: '600',
  },
  progressBarBg: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
    paddingLeft: 4,
  },
  txCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txDetails: {
    flex: 1,
  },
  txReason: {
    fontSize: 15,
    fontWeight: '700',
  },
  txMeta: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  txAmountWrapper: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  txAmount: {
    fontSize: 18,
    fontWeight: '800',
  },
  txCoinLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
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
});

export default StudentDashboard;
