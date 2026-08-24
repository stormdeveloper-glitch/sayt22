"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardRouter = void 0;
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
exports.dashboardRouter = router;
router.use(auth_1.authenticate);
router.get('/', (0, auth_1.authorize)(['ADMIN', 'MANAGER', 'TEACHER', 'CASHIER']), async (req, res) => {
    const totalStudents = await prisma_1.default.student.count();
    const activeStudents = await prisma_1.default.student.count({ where: { status: 'ACTIVE' } });
    const totalGroups = await prisma_1.default.group.count();
    const teachers = await prisma_1.default.teacher.count();
    const classrooms = await prisma_1.default.classroom.count();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const todaysLessons = await prisma_1.default.lessonSchedule.count({
        where: {
            group: {
                startDate: { lte: tomorrow },
                OR: [{ endDate: null }, { endDate: { gte: today } }]
            }
        }
    });
    const todaysAttendance = await prisma_1.default.attendance.count({
        where: { date: { gte: today, lt: tomorrow } }
    });
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const monthlyIncome = await prisma_1.default.payment.aggregate({
        where: { paidAt: { gte: monthStart, lt: nextMonth } },
        _sum: { amount: true }
    });
    const overdueStudents = await prisma_1.default.student.count({
        where: {
            payments: {
                some: {
                    paidAt: { lt: monthStart }
                }
            }
        }
    });
    const topGroups = await prisma_1.default.group.findMany({
        take: 5,
        orderBy: [{ students: { _count: 'desc' } }],
        include: { students: true }
    });
    const upcomingLessons = await prisma_1.default.lessonSchedule.findMany({
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
//# sourceMappingURL=dashboard.js.map