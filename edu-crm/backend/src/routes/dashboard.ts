import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', authorize(['ADMIN', 'MANAGER', 'TEACHER', 'CASHIER']), async (req, res) => {
  const totalStudents = await prisma.student.count();
  const activeStudents = await prisma.student.count({ where: { status: 'ACTIVE' } });
  const totalGroups = await prisma.group.count();
  const teachers = await prisma.teacher.count();
  const classrooms = await prisma.classroom.count();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const todaysLessons = await prisma.lessonSchedule.count({
    where: {
      group: {
        startDate: { lte: tomorrow },
        OR: [{ endDate: null }, { endDate: { gte: today } }]
      }
    }
  });

  const todaysAttendance = await prisma.attendance.count({
    where: { date: { gte: today, lt: tomorrow } }
  });

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  const monthlyIncome = await prisma.payment.aggregate({
    where: { paidAt: { gte: monthStart, lt: nextMonth } },
    _sum: { amount: true }
  });

  const overdueStudents = await prisma.student.count({
    where: {
      payments: {
        some: {
          paidAt: { lt: monthStart }
        }
      }
    }
  });

  const topGroups = await prisma.group.findMany({
    take: 5,
    orderBy: [{ students: { _count: 'desc' } }],
    include: { students: true }
  });

  const upcomingLessons = await prisma.lessonSchedule.findMany({
    where: {
      group: {
        startDate: { lte: tomorrow },
        OR: [{ endDate: null }, { endDate: { gte: today } }]
      }
    },
    include: { group: true },
    orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    take: 12
  });

  res.json({
    totalStudents,
    activeStudents,
    totalGroups,
    teachers,
    classrooms,
    todaysLessons,
    todaysAttendance,
    monthlyIncome: Number(monthlyIncome._sum.amount || 0),
    monthlyExpenses: 0,
    overdueStudents,
    topGroups: topGroups.map(group => ({
      id: group.id,
      name: group.name,
      enrolled: group.students.length,
      capacity: group.capacity
    })),
    upcomingLessons: upcomingLessons.map(lesson => ({
      id: lesson.id,
      weekday: lesson.weekday,
      time: `${lesson.startTime} - ${lesson.endTime}`,
      group: { id: lesson.group.id, name: lesson.group.name }
    }))
  });
});

export { router as dashboardRouter };
