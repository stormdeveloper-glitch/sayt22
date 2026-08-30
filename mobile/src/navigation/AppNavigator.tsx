import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAppData } from '../context/AppDataContext';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

// Import Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RoleSelectScreen from '../screens/auth/RoleSelectScreen';
import StudentDashboard from '../screens/student/StudentDashboard';
import LeaderboardScreen from '../screens/student/LeaderboardScreen';
import TestScreen from '../screens/student/TestScreen';
import HomeworkScreen from '../screens/student/HomeworkScreen';
import ChatScreen from '../screens/student/ChatScreen';
import SettingsScreen from '../screens/student/SettingsScreen';

import TeacherDashboard from '../screens/teacher/TeacherDashboard';
import GiveCoinsScreen from '../screens/teacher/GiveCoinsScreen';
import HomeworkReviewScreen from '../screens/teacher/HomeworkReviewScreen';
import TeacherChatScreen from '../screens/teacher/TeacherChatScreen';

import AdminDashboard from '../screens/admin/AdminDashboard';
import ManageUsersScreen from '../screens/admin/ManageUsersScreen';
import ApproveRequestsScreen from '../screens/admin/ApproveRequestsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

export const AppNavigator: React.FC = () => {
  const { currentUser, selectedRole, setSelectedRole } = useAppData();
  const { colors } = useTheme();

  const getTabOptions = (iconName: keyof typeof Ionicons.prototype.props.name) => ({
    tabBarIcon: ({ color, size }: { color: string; size: number }) => (
      <Ionicons name={iconName} size={size} color={color} />
    ),
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.textDim,
    tabBarStyle: {
      backgroundColor: colors.card,
      borderTopColor: colors.border,
      height: 60,
      paddingBottom: 8,
      paddingTop: 8,
    },
    headerShown: false,
  });

  const StudentTabs = () => (
    <Tab.Navigator>
      <Tab.Screen name="Asosiy" component={StudentDashboard} options={getTabOptions('home-outline')} />
      <Tab.Screen name="Reyting" component={LeaderboardScreen} options={getTabOptions('trophy-outline')} />
      <Tab.Screen name="Testlar" component={TestScreen} options={getTabOptions('document-text-outline')} />
      <Tab.Screen name="Vazifa" component={HomeworkScreen} options={getTabOptions('cloud-upload-outline')} />
      <Tab.Screen name="Chat" component={ChatScreen} options={getTabOptions('chatbubbles-outline')} />
      <Tab.Screen name="Sozlamalar" component={SettingsScreen} options={getTabOptions('settings-outline')} />
    </Tab.Navigator>
  );

  const TeacherTabs = () => (
    <Tab.Navigator>
      <Tab.Screen name="Dashboard" component={TeacherDashboard} options={getTabOptions('pie-chart-outline')} />
      <Tab.Screen name="Coin Berish" component={GiveCoinsScreen} options={getTabOptions('gift-outline')} />
      <Tab.Screen name="Vazifalar" component={HomeworkReviewScreen} options={getTabOptions('checkbox-outline')} />
      <Tab.Screen name="Chat" component={TeacherChatScreen} options={getTabOptions('chatbubbles-outline')} />
      <Tab.Screen name="Sozlamalar" component={SettingsScreen} options={getTabOptions('settings-outline')} />
    </Tab.Navigator>
  );

  const AdminTabs = () => (
    <Tab.Navigator>
      <Tab.Screen name="Dashboard" component={AdminDashboard} options={getTabOptions('analytics-outline')} />
      <Tab.Screen name="Foydalanuvchilar" component={ManageUsersScreen} options={getTabOptions('people-outline')} />
      <Tab.Screen name="So'rovlar" component={ApproveRequestsScreen} options={getTabOptions('git-pull-request-outline')} />
      <Tab.Screen name="Sozlamalar" component={SettingsScreen} options={getTabOptions('settings-outline')} />
    </Tab.Navigator>
  );

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {selectedRole === null ? (
          <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
        ) : currentUser === null ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            {currentUser.role === 'student' && (
              <Stack.Screen name="StudentHome" component={StudentTabs} />
            )}
            {currentUser.role === 'teacher' && (
              <Stack.Screen name="TeacherHome" component={TeacherTabs} />
            )}
            {currentUser.role === 'admin' && (
              <Stack.Screen name="AdminHome" component={AdminTabs} />
            )}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
