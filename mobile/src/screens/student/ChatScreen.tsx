import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAppData } from '../../context/AppDataContext';
import { useTheme } from '../../context/ThemeContext';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Button from '../../components/Button';
import { ChatMessage } from '../../types';
import { Ionicons } from '@expo/vector-icons';

interface ChatRoom {
  id: string | number;
  name: string;
  toType: ChatMessage['toType'];
  subtitle: string;
  icon: keyof typeof Ionicons.prototype.props.name;
}

export const ChatScreen: React.FC = () => {
  const { db, currentUser, sendMessage, refreshData } = useAppData();
  const { colors } = useTheme();

  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [typedMessage, setTypedMessage] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const messageScrollRef = useRef<ScrollView>(null);

  // Poll for new messages when activeRoom is open
  useEffect(() => {
    let interval: any;
    if (activeRoom) {
      interval = setInterval(() => {
        refreshData().catch(() => {});
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeRoom]);

  useEffect(() => {
    if (activeRoom) {
      setTimeout(() => {
        messageScrollRef.current?.scrollToEnd({ animated: true });
      }, 200);
    }
  }, [activeRoom, db?.messages]);

  const handleSend = async () => {
    if (!activeRoom || !typedMessage.trim()) return;

    setSending(true);
    try {
      const success = await sendMessage(activeRoom.id, activeRoom.toType, typedMessage.trim());
      if (success) {
        setTypedMessage('');
        setTimeout(() => {
          messageScrollRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (e) {
      console.warn('Failed to send message:', e);
    } finally {
      setSending(false);
    }
  };

  // Chat Rooms Configuration
  const getChatRooms = (): ChatRoom[] => {
    const rooms: ChatRoom[] = [
      {
        id: 'all',
        name: 'Umumiy e\'lonlar',
        toType: 'all',
        subtitle: 'Barcha uchun xabarlar',
        icon: 'megaphone-outline',
      },
      {
        id: 'all_students',
        name: 'Talabalar guruhi',
        toType: 'all_students',
        subtitle: 'Talabalar o\'rtasida chat',
        icon: 'people-outline',
      },
    ];

    // Add teachers as direct message targets
    if (db && db.teachers) {
      db.teachers.forEach((t) => {
        rooms.push({
          id: t.id,
          name: t.name,
          toType: 'specific_teacher',
          subtitle: 'O\'qituvchi bilan muloqot',
          icon: 'person-outline',
        });
      });
    }

    return rooms;
  };

  const getFilteredMessages = () => {
    if (!db || !activeRoom || !currentUser) return [];

    return db.messages.filter((m) => {
      // 1. All announcements
      if (activeRoom.toType === 'all' && m.toType === 'all') return true;

      // 2. All students group chat
      if (activeRoom.toType === 'all_students' && m.toType === 'all_students') return true;

      // 3. Direct messaging to specific teacher
      if (activeRoom.toType === 'specific_teacher') {
        const isFromMeToTeacher =
          m.fromType === 'student' &&
          m.fromId === currentUser.id &&
          m.toType === 'specific_teacher' &&
          m.toId === activeRoom.id;
        const isFromTeacherToMe =
          m.fromType === 'teacher' &&
          m.fromId === activeRoom.id &&
          m.toType === 'specific_student' &&
          m.toId === currentUser.id;
        return isFromMeToTeacher || isFromTeacherToMe;
      }

      return false;
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Xabarlar" showThemeToggle={false} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Chat kanallari</Text>
        {getChatRooms().map((room, idx) => (
          <TouchableOpacity key={idx} onPress={() => setActiveRoom(room)} activeOpacity={0.8}>
            <Card style={styles.roomCard}>
              <View style={styles.roomRow}>
                <View style={[styles.roomIconWrapper, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name={room.icon} size={22} color={colors.primary} />
                </View>
                <View style={styles.roomDetails}>
                  <Text style={[styles.roomName, { color: colors.text }]}>{room.name}</Text>
                  <Text style={[styles.roomSubtitle, { color: colors.textDim }]}>{room.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
              </View>
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Chat Room Modal */}
      <Modal visible={activeRoom !== null} animationType="slide">
        {activeRoom && (
          <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setActiveRoom(null)} activeOpacity={0.7} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color={colors.text} />
              </TouchableOpacity>
              <View style={styles.modalHeaderTitle}>
                <Text style={[styles.modalTitleText, { color: colors.text }]} numberOfLines={1}>
                  {activeRoom.name}
                </Text>
                <Text style={[styles.modalSubtitleText, { color: colors.textDim }]}>
                  {activeRoom.subtitle}
                </Text>
              </View>
              <View style={styles.actionBtnPlaceholder} />
            </View>

            {/* Messages List */}
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ flex: 1 }}
            >
              <ScrollView
                ref={messageScrollRef}
                style={styles.messageScroll}
                contentContainerStyle={styles.messageScrollContent}
              >
                {getFilteredMessages().length === 0 ? (
                  <View style={styles.emptyChatContainer}>
                    <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.textDim} />
                    <Text style={[styles.emptyChatText, { color: colors.textDim }]}>
                      Suhbat boshlanmagan. Birinchi xabarni yozing!
                    </Text>
                  </View>
                ) : (
                  getFilteredMessages().map((m) => {
                    const isMe = m.fromType === currentUser?.role && m.fromId === currentUser?.id;
                    const dateStr = new Date(m.timestamp).toLocaleTimeString('uz-UZ', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <View
                        key={m.id}
                        style={[
                          styles.messageRow,
                          { justifyContent: isMe ? 'flex-end' : 'flex-start' },
                        ]}
                      >
                        {!isMe && (
                          <Text style={[styles.senderLabel, { color: colors.textDim }]}>
                            {m.fromName.split(' ')[0]}
                          </Text>
                        )}
                        <View
                          style={[
                            styles.messageBubble,
                            {
                              backgroundColor: isMe ? colors.primary : colors.card,
                              borderBottomLeftRadius: isMe ? 14 : 2,
                              borderBottomRightRadius: isMe ? 2 : 14,
                              borderColor: colors.border,
                              borderWidth: isMe ? 0 : 1,
                            },
                          ]}
                        >
                          <Text style={[styles.messageText, { color: isMe ? '#ffffff' : colors.text }]}>
                            {m.content}
                          </Text>
                          <Text
                            style={[
                              styles.messageTime,
                              { color: isMe ? 'rgba(255, 255, 255, 0.7)' : colors.textDim },
                            ]}
                          >
                            {dateStr}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>

              {/* Chat Input */}
              <View style={[styles.inputContainer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
                <TextInput
                  value={typedMessage}
                  onChangeText={setTypedMessage}
                  placeholder="Xabar yozing..."
                  placeholderTextColor={colors.textDim}
                  style={[styles.chatInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                  multiline
                />
                <TouchableOpacity
                  onPress={handleSend}
                  disabled={sending || !typedMessage.trim()}
                  style={[
                    styles.sendBtn,
                    {
                      backgroundColor: typedMessage.trim() ? colors.primary : colors.border,
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <Ionicons name="send" size={18} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
    paddingLeft: 4,
  },
  roomCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roomIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  roomDetails: {
    flex: 1,
  },
  roomName: {
    fontSize: 15,
    fontWeight: '700',
  },
  roomSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'left',
  },
  actionBtnPlaceholder: {
    width: 40,
  },
  modalHeaderTitle: {
    flex: 1,
    alignItems: 'center',
  },
  modalTitleText: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalSubtitleText: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  messageScroll: {
    flex: 1,
  },
  messageScrollContent: {
    padding: 16,
  },
  emptyChatContainer: {
    alignItems: 'center',
    paddingVertical: 120,
  },
  emptyChatText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 16,
    textAlign: 'center',
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 14,
    alignItems: 'flex-end',
    flexWrap: 'wrap',
  },
  senderLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginRight: 6,
    marginBottom: 4,
  },
  messageBubble: {
    maxWidth: '80%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  messageText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 9,
    fontWeight: '600',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
  },
  chatInput: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 15,
    fontWeight: '500',
    marginRight: 10,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ChatScreen;
