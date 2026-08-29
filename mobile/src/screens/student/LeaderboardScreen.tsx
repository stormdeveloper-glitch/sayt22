import React from 'react';
import { StyleSheet, View, Text, ScrollView, SafeAreaView, Image } from 'react-native';
import { useAppData } from '../../context/AppDataContext';
import { useTheme } from '../../context/ThemeContext';
import Header from '../../components/Header';
import Card from '../../components/Card';
import { Ionicons } from '@expo/vector-icons';

export const LeaderboardScreen: React.FC = () => {
  const { db, currentUser } = useAppData();
  const { colors } = useTheme();

  // Sort students by totalCoins descending
  const students = db ? [...db.students].sort((a, b) => b.totalCoins - a.totalCoins) : [];

  const topThree = students.slice(0, 3);
  const remainingStudents = students.slice(3);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const myRank = students.findIndex((s) => s.id === currentUser?.id) + 1;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Reyting" showThemeToggle={false} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Top 3 Podiums */}
        {topThree.length > 0 && (
          <View style={styles.podiumContainer}>
            {/* 2nd Place */}
            {topThree[1] && (
              <View style={[styles.podiumItem, styles.podiumSecond]}>
                <View style={[styles.avatarCircle, { backgroundColor: colors.card, borderColor: '#C0C0C0' }]}>
                  <Text style={[styles.avatarText, { color: colors.text }]}>{getInitials(topThree[1].name)}</Text>
                  <View style={[styles.rankBadge, { backgroundColor: '#C0C0C0' }]}>
                    <Text style={styles.rankBadgeText}>2</Text>
                  </View>
                </View>
                <Text style={[styles.podiumName, { color: colors.text }]} numberOfLines={1}>
                  {topThree[1].name.split(' ')[0]}
                </Text>
                <Text style={[styles.podiumCoins, { color: colors.primary }]}>{topThree[1].totalCoins} coin</Text>
              </View>
            )}

            {/* 1st Place */}
            {topThree[0] && (
              <View style={[styles.podiumItem, styles.podiumFirst]}>
                <View style={[styles.avatarCircle, styles.avatarFirst, { backgroundColor: colors.card, borderColor: '#FFD700' }]}>
                  <Text style={[styles.avatarText, { color: colors.text, fontSize: 20 }]}>{getInitials(topThree[0].name)}</Text>
                  <View style={[styles.rankBadge, { backgroundColor: '#FFD700', width: 24, height: 24, borderRadius: 12 }]}>
                    <Ionicons name="trophy" size={14} color="#ffffff" />
                  </View>
                </View>
                <Text style={[styles.podiumName, { color: colors.text, fontWeight: '900', fontSize: 15 }]} numberOfLines={1}>
                  {topThree[0].name.split(' ')[0]}
                </Text>
                <Text style={[styles.podiumCoins, { color: colors.gold, fontSize: 15 }]}>{topThree[0].totalCoins} coin</Text>
              </View>
            )}

            {/* 3rd Place */}
            {topThree[2] && (
              <View style={[styles.podiumItem, styles.podiumThird]}>
                <View style={[styles.avatarCircle, { backgroundColor: colors.card, borderColor: '#CD7F32' }]}>
                  <Text style={[styles.avatarText, { color: colors.text }]}>{getInitials(topThree[2].name)}</Text>
                  <View style={[styles.rankBadge, { backgroundColor: '#CD7F32' }]}>
                    <Text style={styles.rankBadgeText}>3</Text>
                  </View>
                </View>
                <Text style={[styles.podiumName, { color: colors.text }]} numberOfLines={1}>
                  {topThree[2].name.split(' ')[0]}
                </Text>
                <Text style={[styles.podiumCoins, { color: colors.danger }]}>{topThree[2].totalCoins} coin</Text>
              </View>
            )}
          </View>
        )}

        {/* Current User Rank Info Card */}
        {myRank > 0 && (
          <Card style={[styles.myRankCard, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
            <View style={styles.myRankRow}>
              <Text style={[styles.myRankNum, { color: colors.primary }]}>#{myRank}</Text>
              <Text style={[styles.myRankLabel, { color: colors.text }]}>Sizning o'rningiz</Text>
              <Text style={[styles.myRankCoins, { color: colors.primary }]}>
                {students[myRank - 1]?.totalCoins || 0} coin
              </Text>
            </View>
          </Card>
        )}

        {/* Remaining List */}
        <Text style={[styles.listTitle, { color: colors.text }]}>Umumiy Reyting</Text>
        {remainingStudents.map((item, index) => {
          const rank = index + 4;
          const isMe = item.id === currentUser?.id;

          return (
            <Card
              key={item.id}
              style={[
                styles.rankItemCard,
                isMe ? { borderColor: colors.primary, borderWidth: 1.5 } : null,
              ]}
            >
              <View style={styles.rankRow}>
                <Text style={[styles.rankNum, { color: isMe ? colors.primary : colors.textDim }]}>
                  {rank}
                </Text>
                <View style={[styles.smallAvatar, { backgroundColor: colors.background }]}>
                  <Text style={[styles.smallAvatarText, { color: colors.text }]}>
                    {getInitials(item.name)}
                  </Text>
                </View>
                <View style={styles.studentDetails}>
                  <Text style={[styles.studentName, { color: colors.text, fontWeight: isMe ? '800' : '600' }]}>
                    {item.name}
                  </Text>
                  <Text style={[styles.studentGroup, { color: colors.textDim }]}>
                    {item.group} • {item.badge}
                  </Text>
                </View>
                <Text style={[styles.studentCoins, { color: isMe ? colors.primary : colors.text }]}>
                  {item.totalCoins} coin
                </Text>
              </View>
            </Card>
          );
        })}
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
  podiumContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginVertical: 24,
    height: 180,
  },
  podiumItem: {
    alignItems: 'center',
    width: '30%',
  },
  podiumFirst: {
    height: 180,
    justifyContent: 'flex-start',
    zIndex: 2,
  },
  podiumSecond: {
    height: 150,
    justifyContent: 'flex-end',
    marginRight: -10,
  },
  podiumThird: {
    height: 140,
    justifyContent: 'flex-end',
    marginLeft: -10,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    marginBottom: 8,
  },
  avatarFirst: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
  },
  avatarText: {
    fontWeight: '800',
    fontSize: 16,
  },
  rankBadge: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  rankBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
  podiumName: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  podiumCoins: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  myRankCard: {
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  myRankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  myRankNum: {
    fontSize: 22,
    fontWeight: '900',
  },
  myRankLabel: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    paddingLeft: 16,
  },
  myRankCoins: {
    fontSize: 18,
    fontWeight: '800',
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
    paddingLeft: 4,
  },
  rankItemCard: {
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankNum: {
    fontSize: 16,
    fontWeight: '800',
    width: 32,
    textAlign: 'center',
  },
  smallAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  smallAvatarText: {
    fontSize: 13,
    fontWeight: '700',
  },
  studentDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: 15,
  },
  studentGroup: {
    fontSize: 12,
    marginTop: 2,
  },
  studentCoins: {
    fontSize: 15,
    fontWeight: '700',
  },
});

export default LeaderboardScreen;
