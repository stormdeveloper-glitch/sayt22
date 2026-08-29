export interface Student {
  id: number;
  name: string;
  group: string;
  coins: Record<string, number>;
  totalCoins: number;
  level: number;
  badge: string;
  pass: string;
  olmos?: number;
  diamonds?: number;
  teacherIds?: number[];
  teacherId?: number;
}

export interface Teacher {
  id: number;
  name: string;
  pass: string;
}

export interface Admin {
  id: number;
  name: string;
  pass: string;
  status?: string;
}

export interface Transaction {
  studentId: number;
  studentName?: string;
  amount: number;
  timestamp: number;
  teacherId?: number | null;
  adminId?: number | null;
  reason: string;
  type?: 'give' | 'take';
}

export interface Group {
  name: string;
  teacherId: number;
  image: string | null;
  createdAt: number;
  category: string;
  price: number;
}

export interface Question {
  q: string; // question text
  a: string[]; // options (4 items)
  c: number; // correct answer index (0-3)
}

export interface Test {
  id: number;
  title: string;
  teacherId: number;
  questions: Question[];
  startTime: number;
}

export interface Plan {
  id: number;
  title: string;
  desc: string;
  teacherId: number;
}

export interface Submission {
  id: string;
  studentId: number;
  studentName: string;
  testId?: number;
  fileUrl?: string;
  text?: string;
  timestamp: number;
  status: 'pending' | 'approved' | 'rejected';
  score?: number;
}

export interface ChatMessage {
  id: string;
  fromId: number;
  fromName: string;
  fromType: 'student' | 'teacher' | 'admin';
  toId: number | string;
  toType: 'specific_student' | 'specific_teacher' | 'group' | 'all' | 'all_students' | 'all_teachers';
  content: string;
  timestamp: number;
}

export interface TelegramProfileLink {
  token: string;
  role: 'student' | 'teacher' | 'admin';
  accountId: number;
  telegramId: number;
  name: string;
  createdAt: number;
  status: 'pending' | 'approved' | 'rejected';
}

export interface AppDB {
  seedVersion?: string;
  students: Student[];
  transactions: Transaction[];
  nextStudentId: number;
  teachers: Teacher[];
  nextTeacherId: number;
  admins: Admin[];
  nextAdminId: number;
  adminRequests?: any[];
  nextRequestId?: number;
  messages: ChatMessage[];
  groups: Group[];
  tests: Test[];
  plans: Plan[];
  submissions: Submission[];
  pendingTelegramLinks?: TelegramProfileLink[];
  telegramProfiles?: Record<string, string>;
}

export type UserRole = 'student' | 'teacher' | 'admin';

export interface CurrentUser {
  id: number;
  name: string;
  role: UserRole;
  pass: string;
  group?: string;
  coins?: Record<string, number>;
  totalCoins?: number;
  level?: number;
  badge?: string;
  olmos?: number;
  diamonds?: number;
  teacherId?: number;
  teacherIds?: number[];
}
