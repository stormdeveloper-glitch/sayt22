import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { useAppData } from '../../context/AppDataContext';
import { useTheme } from '../../context/ThemeContext';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

type AuthStackParamList = {
  RoleSelect: undefined;
  Login: undefined;
};

export const RoleSelectScreen: React.FC = () => {
  const { setSelectedRole } = useAppData();
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();

  const handleSelect = (role: 'student' | 'teacher' | 'admin') => {
    setSelectedRole(role);
    navigation.replace('Login'); // Move to login screen
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Rolni Tanlang</Text>
        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => handleSelect('student')}
          >
            <Ionicons name="person-outline" size={24} color="#fff" />
            <Text style={styles.buttonText}>Talaba</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.gold }]}
            onPress={() => handleSelect('teacher')}
          >
            <Ionicons name="school-outline" size={24} color="#fff" />
            <Text style={styles.buttonText}>O'qituvchi</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.danger }]}
            onPress={() => handleSelect('admin')}
          >
            <Ionicons name="settings-outline" size={24} color="#fff" />
            <Text style={styles.buttonText}>Admin</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 32,
  },
  buttons: {
    width: '100%',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
