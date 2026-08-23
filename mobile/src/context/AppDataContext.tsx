import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/client';
import { AppDB, CurrentUser, Student, Teacher, Admin, Transaction, ChatMessage, Submission, Test, Plan, Question } from '../types';

const DB_CACHE_KEY = '@texnopark_cached_db';
const USER_SESSION_KEY = '@texnopark_user_session';

interface AppDataContextType {
  selectedRole: 'student' | 'teacher' | 'admin' | null;
  setSelectedRole: (role: 'student' | 'teacher' | 'admin') => void;
  db: AppDB | null;
  currentUser: CurrentUser | null;
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  login: (role: 'student' | 'teacher' | 'admin', id: number, pass: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updatePassword: (newPass: string) => Promise<boolean>;
  giveCoins: (studentId: number, amount: number, reason: string) => Promise<boolean>;
  submitHomework: (testId?: number, text?: string, fileUrl?: string) => Promise<boolean>;
  gradeSubmission: (id: string, approve: boolean, rewardCoins: number) => Promise<boolean>;
  createUser: (role: 'student' | 'teacher' | 'admin', name: string, pass: string, group?: string) => Promise<boolean>;
  deleteUser: (role: 'student' | 'teacher' | 'admin', id: number) => Promise<boolean>;
  requestTelegramLink: (telegramId: number) => Promise<{ status: string; message: string }>;
  sendMessage: (toId: string | number, toType: ChatMessage['toType'], content: string) => Promise<boolean>;
  createTest: (title: string, questions: Question[]) => Promise<boolean>;
  createPlan: (title: string, desc: string) => Promise<boolean>;
  approveAdminRequest: (requestId: number) => Promise<boolean>;
  rejectAdminRequest: (requestId: number) => Promise<boolean>;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [db, setDb] = useState<AppDB | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRoleState] = useState<'student' | 'teacher' | 'admin' | null>(null);
  const SELECTED_ROLE_KEY = '@texnopark_selected_role';

  // Normalize data and recalculate level/badges
  const normalizeAndSetDb = (data: AppDB) => {
    const students = Array.isArray(data.students) ? data.students : [];
    const transactions = Array.isArray(data.transactions) ? data.transactions : [];
    const teachers = Array.isArray(data.teachers) ? data.teachers : [];
    const admins = Array.isArray(data.admins) ? data.admins : [];

    students.forEach((s) => {
      const teacherIds = s.teacherIds || (s.teacherId ? [s.teacherId] : [1]);
      s.teacherIds = teacherIds;
      s.teacherId = teacherIds[0] || 1;

      // Recalculate coins total
      let sumCoins = 0;
      if (s.coins && typeof s.coins === 'object') {
        sumCoins = Object.values(s.coins).reduce((acc, val) => acc + (Number(val) || 0), 0);
      }
      s.totalCoins = sumCoins;

      s.level = Math.max(1, Math.floor(s.totalCoins / 100) + 1);
      s.badge = s.totalCoins < 100 ? 'Starter' : s.totalCoins < 300 ? 'Active' : s.totalCoins < 600 ? 'Pro' : 'Elite';
    });

    const normalized: AppDB = {
      ...data,
      students,
      transactions,
      teachers,
      admins,
      messages: Array.isArray(data.messages) ? data.messages : [],
      groups: Array.isArray(data.groups) ? data.groups : [],
      tests: Array.isArray(data.tests) ? data.tests : [],
      plans: Array.isArray(data.plans) ? data.plans : [],
      submissions: Array.isArray(data.submissions) ? data.submissions : [],
      nextStudentId: data.nextStudentId || 1,
      nextTeacherId: data.nextTeacherId || 1,
      nextAdminId: data.nextAdminId || 1,
    };

    setDb(normalized);
    AsyncStorage.setItem(DB_CACHE_KEY, JSON.stringify(normalized)).catch((err) =>
      console.warn('AsyncStorage cache write failed:', err)
    );
    return normalized;
  };

  const loadInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Try to load cached session
      const savedSession = await AsyncStorage.getItem(USER_SESSION_KEY);
      if (savedSession) {
        setCurrentUser(JSON.parse(savedSession));
      }
      // Load persisted selected role
      const storedRole = await AsyncStorage.getItem(SELECTED_ROLE_KEY);
      if (storedRole) {
        setSelectedRoleState(storedRole as any);
      }

      // 2. Try load local cache first for speed
      const cachedDb = await AsyncStorage.getItem(DB_CACHE_KEY);
      if (cachedDb) {
        setDb(JSON.parse(cachedDb));
      }

      // 3. Fetch fresh database from Flask server
      const res = await apiClient.get<AppDB>('/api/data');
      if (res.data && Array.isArray(res.data.students)) {
        const freshDb = normalizeAndSetDb(res.data);
        // Refresh session if logged in
        if (savedSession) {
          const parsed = JSON.parse(savedSession) as CurrentUser;
          let freshUser: any = null;
          if (parsed.role === 'student') {
            freshUser = freshDb.students.find((s) => s.id === parsed.id);
          } else if (parsed.role === 'teacher') {
            freshUser = freshDb.teachers.find((t) => t.id === parsed.id);
          } else if (parsed.role === 'admin') {
            freshUser = freshDb.admins.find((a) => a.id === parsed.id);
          }

          if (freshUser) {
            const updatedSession = { ...freshUser, role: parsed.role };
            setCurrentUser(updatedSession);
            await AsyncStorage.setItem(USER_SESSION_KEY, JSON.stringify(updatedSession));
          }
        }
      }
    } catch (e: any) {
      console.warn('Initial data load failed, using local cache if available:', e.message);
      setError('Serverga bog\'lanishda xatolik yuz berdi. Offline rejimda ishlamoqdasiz.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const refreshData = async () => {
    try {
      const res = await apiClient.get<AppDB>('/api/data');
      if (res.data && Array.isArray(res.data.students)) {
        const freshDb = normalizeAndSetDb(res.data);
        if (currentUser) {
          let freshUser: any = null;
          if (currentUser.role === 'student') {
            freshUser = freshDb.students.find((s) => s.id === currentUser.id);
          } else if (currentUser.role === 'teacher') {
            freshUser = freshDb.teachers.find((t) => t.id === currentUser.id);
          } else if (currentUser.role === 'admin') {
            freshUser = freshDb.admins.find((a) => a.id === currentUser.id);
          }

          if (freshUser) {
            const updatedSession = { ...freshUser, role: currentUser.role };
            setCurrentUser(updatedSession);
            await AsyncStorage.setItem(USER_SESSION_KEY, JSON.stringify(updatedSession));
          }
        }
      }
    } catch (e: any) {
      console.warn('Data refresh failed:', e.message);
      throw e;
    }
  };

  const saveDatabase = async (updatedDb: AppDB): Promise<boolean> => {
    try {
      normalizeAndSetDb(updatedDb);
      await apiClient.post('/api/data', updatedDb);
      return true;
    } catch (e) {
      console.error('Failed to post database updates to Flask server:', e);
      return false; // Offline saved but server push failed
    }
  };

  const login = async (role: 'student' | 'teacher' | 'admin', id: number, pass: string): Promise<boolean> => {
    if (!db) return false;
    let foundUser: any = null;

    if (role === 'student') {
      foundUser = db.students.find((s) => s.id === id);
    } else if (role === 'teacher') {
      foundUser = db.teachers.find((t) => t.id === id);
    } else if (role === 'admin') {
      foundUser = db.admins.find((a) => a.id === id);
    }

    if (foundUser && foundUser.pass === pass) {
      const sessionUser: CurrentUser = { ...foundUser, role };
      setCurrentUser(sessionUser);
      await AsyncStorage.setItem(USER_SESSION_KEY, JSON.stringify(sessionUser));
      return true;
    }
    return false;
  };

  const logout = async () => {
    setCurrentUser(null);
    await AsyncStorage.removeItem(USER_SESSION_KEY);
    setSelectedRoleState(null);
    await AsyncStorage.removeItem(SELECTED_ROLE_KEY);
  };

  const updatePassword = async (newPass: string): Promise<boolean> => {
    if (!db || !currentUser) return false;

    const updatedDb = { ...db };
    if (currentUser.role === 'student') {
      updatedDb.students = updatedDb.students.map((s) => (s.id === currentUser.id ? { ...s, pass: newPass } : s));
    } else if (currentUser.role === 'teacher') {
      updatedDb.teachers = updatedDb.teachers.map((t) => (t.id === currentUser.id ? { ...t, pass: newPass } : t));
    } else if (currentUser.role === 'admin') {
      updatedDb.admins = updatedDb.admins.map((a) => (a.id === currentUser.id ? { ...a, pass: newPass } : a));
    }

    const success = await saveDatabase(updatedDb);
    if (success) {
      const updatedSession = { ...currentUser, pass: newPass };
      setCurrentUser(updatedSession);
      await AsyncStorage.setItem(USER_SESSION_KEY, JSON.stringify(updatedSession));
    }
    return success;
  };

  const giveCoins = async (studentId: number, amount: number, reason: string): Promise<boolean> => {
    if (!db || !currentUser || currentUser.role === 'student') return false;

    const updatedDb = { ...db };
    const student = updatedDb.students.find((s) => s.id === studentId);
    if (!student) return false;

    const teacherId = currentUser.role === 'teacher' ? currentUser.id : null;
    const adminId = currentUser.role === 'admin' ? currentUser.id : null;
    const authorKey = teacherId ? String(teacherId) : 'admin';

    // Update coins record
    student.coins = student.coins || {};
    const prevCoins = student.coins[authorKey] || 0;
    student.coins[authorKey] = Math.max(0, prevCoins + amount);

    // Add transaction history
    const tx: Transaction = {
      studentId,
      studentName: student.name,
      amount,
      reason,
      timestamp: Date.now(),
      teacherId,
      adminId,
      type: amount >= 0 ? 'give' : 'take',
    };
    updatedDb.transactions = [tx, ...updatedDb.transactions];

    return await saveDatabase(updatedDb);
  };

  const submitHomework = async (testId?: number, text?: string, fileUrl?: string): Promise<boolean> => {
    if (!db || !currentUser || currentUser.role !== 'student') return false;

    const submission: Submission = {
      id: Math.random().toString(36).substring(2, 9),
      studentId: currentUser.id,
      studentName: currentUser.name,
      testId,
      text,
      fileUrl,
      timestamp: Date.now(),
      status: 'pending',
    };

    const updatedDb = { ...db };
    updatedDb.submissions = [submission, ...updatedDb.submissions];

    return await saveDatabase(updatedDb);
  };

  const gradeSubmission = async (id: string, approve: boolean, rewardCoins: number): Promise<boolean> => {
    if (!db || !currentUser || currentUser.role === 'student') return false;

    const updatedDb = { ...db };
    const sub = updatedDb.submissions.find((s) => s.id === id);
    if (!sub) return false;

    sub.status = approve ? 'approved' : 'rejected';
    if (approve && rewardCoins > 0) {
      const student = updatedDb.students.find((s) => s.id === sub.studentId);
      if (student) {
        const teacherId = currentUser.role === 'teacher' ? currentUser.id : null;
        const adminId = currentUser.role === 'admin' ? currentUser.id : null;
        const authorKey = teacherId ? String(teacherId) : 'admin';

        student.coins = student.coins || {};
        student.coins[authorKey] = (student.coins[authorKey] || 0) + rewardCoins;

        const tx: Transaction = {
          studentId: sub.studentId,
          studentName: student.name,
          amount: rewardCoins,
          reason: `Vazifa tasdiqlandi: ID ${id}`,
          timestamp: Date.now(),
          teacherId,
          adminId,
          type: 'give',
        };
        updatedDb.transactions = [tx, ...updatedDb.transactions];
      }
    }

    return await saveDatabase(updatedDb);
  };

  const createUser = async (role: 'student' | 'teacher' | 'admin', name: string, pass: string, group?: string): Promise<boolean> => {
    if (!db || !currentUser || currentUser.role !== 'admin') return false;

    const updatedDb = { ...db };

    if (role === 'student') {
      const newId = updatedDb.nextStudentId;
      const newStudent: Student = {
        id: newId,
        name,
        pass,
        group: group || 'D1',
        coins: { '1': 0 },
        totalCoins: 0,
        level: 1,
        badge: 'Starter',
      };
      updatedDb.students.push(newStudent);
      updatedDb.nextStudentId = newId + 1;
    } else if (role === 'teacher') {
      const newId = updatedDb.nextTeacherId;
      const newTeacher: Teacher = {
        id: newId,
        name,
        pass,
      };
      updatedDb.teachers.push(newTeacher);
      updatedDb.nextTeacherId = newId + 1;
    } else if (role === 'admin') {
      const newId = updatedDb.nextAdminId;
      const newAdmin: Admin = {
        id: newId,
        name,
        pass,
      };
      updatedDb.admins.push(newAdmin);
      updatedDb.nextAdminId = newId + 1;
    }

    return await saveDatabase(updatedDb);
  };

  const deleteUser = async (role: 'student' | 'teacher' | 'admin', id: number): Promise<boolean> => {
    if (!db || !currentUser || currentUser.role !== 'admin') return false;

    const updatedDb = { ...db };

    if (role === 'student') {
      updatedDb.students = updatedDb.students.filter((s) => s.id !== id);
    } else if (role === 'teacher') {
      updatedDb.teachers = updatedDb.teachers.filter((t) => t.id !== id);
    } else if (role === 'admin') {
      updatedDb.admins = updatedDb.admins.filter((a) => a.id !== id);
    }

    return await saveDatabase(updatedDb);
  };

  const requestTelegramLink = async (telegramId: number): Promise<{ status: string; message: string }> => {
    if (!currentUser) return { status: 'error', message: 'Tizimga kirilmagan' };

    try {
      const res = await apiClient.post('/api/telegram-link/request', {
        role: currentUser.role,
        accountId: currentUser.id,
        telegramId: telegramId,
      });
      return {
        status: res.data.status,
        message: res.data.message || 'Telegram botga so\'rov yuborildi',
      };
    } catch (e: any) {
      const errMsg = e.response?.data?.message || e.message;
      return { status: 'error', message: errMsg };
    }
  };

  const sendMessage = async (toId: string | number, toType: ChatMessage['toType'], content: string): Promise<boolean> => {
    if (!db || !currentUser) return false;

    const msg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      fromId: currentUser.id,
      fromName: currentUser.name,
      fromType: currentUser.role,
      toId,
      toType,
      content,
      timestamp: Date.now(),
    };

    const updatedDb = { ...db };
    updatedDb.messages = [...(updatedDb.messages || []), msg];

    return await saveDatabase(updatedDb);
  };

  const createTest = async (title: string, questions: Question[]): Promise<boolean> => {
    if (!db || !currentUser || currentUser.role !== 'teacher') return false;

    const updatedDb = { ...db };
    const nextTestId = (updatedDb.tests.length ? Math.max(...updatedDb.tests.map((t) => t.id)) + 1 : 1);

    const test: Test = {
      id: nextTestId,
      title,
      teacherId: currentUser.id,
      questions,
      startTime: Date.now(),
    };
    updatedDb.tests = [...updatedDb.tests, test];

    return await saveDatabase(updatedDb);
  };

  const createPlan = async (title: string, desc: string): Promise<boolean> => {
    if (!db || !currentUser || currentUser.role !== 'teacher') return false;

    const updatedDb = { ...db };
    const nextPlanId = (updatedDb.plans.length ? Math.max(...updatedDb.plans.map((p) => p.id)) + 1 : 1);

    const plan: Plan = {
      id: nextPlanId,
      title,
      desc,
      teacherId: currentUser.id,
    };
    updatedDb.plans = [...updatedDb.plans, plan];

    return await saveDatabase(updatedDb);
  };

  const approveAdminRequest = async (requestId: number): Promise<boolean> => {
    if (!db || !currentUser || currentUser.role !== 'admin') return false;

    const updatedDb = { ...db };
    const req = updatedDb.adminRequests?.find((r) => r.id === requestId);
    if (!req) return false;

    const cand = updatedDb.admins.find((a) => a.id === req.candidateAdminId);
    if (cand) {
      cand.status = 'active';
    }

    updatedDb.adminRequests = updatedDb.adminRequests?.filter((r) => r.id !== requestId) || [];
    return await saveDatabase(updatedDb);
  };

  const rejectAdminRequest = async (requestId: number): Promise<boolean> => {
    if (!db || !currentUser || currentUser.role !== 'admin') return false;

    const updatedDb = { ...db };
    const req = updatedDb.adminRequests?.find((r) => r.id === requestId);
    if (!req) return false;

    updatedDb.admins = updatedDb.admins.filter((a) => a.id !== req.candidateAdminId);
    updatedDb.adminRequests = updatedDb.adminRequests?.filter((r) => r.id !== requestId) || [];
    return await saveDatabase(updatedDb);
  };

  return (
    <AppDataContext.Provider
      value={{
        db,
        currentUser,
        loading,
        error,
        refreshData,
        login,
        logout,
        updatePassword,
        giveCoins,
        submitHomework,
        gradeSubmission,
        createUser,
        deleteUser,
        requestTelegramLink,
        sendMessage,
        createTest,
        createPlan,
        approveAdminRequest,
        rejectAdminRequest,
        selectedRole,
        setSelectedRole: (role) => {
          setSelectedRoleState(role);
          AsyncStorage.setItem(SELECTED_ROLE_KEY, role);
        },
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
};

export const useAppData = (): AppDataContextType => {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return context;
};
