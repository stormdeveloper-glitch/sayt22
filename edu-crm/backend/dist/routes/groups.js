"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupsRouter = void 0;
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
exports.groupsRouter = router;
router.use(auth_1.authenticate);
router.get('/', (0, auth_1.authorize)(['ADMIN', 'MANAGER', 'TEACHER', 'CASHIER']), async (req, res) => {
    const query = req.query.q ? String(req.query.q) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    const page = Number(req.query.page || 1);
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const skip = (page - 1) * limit;
    const where = {};
    if (query) {
        where.OR = [
            { name: { contains: query, mode: 'insensitive' } },
            { course: { title: { contains: query, mode: 'insensitive' } } },
            { teacher: { name: { contains: query, mode: 'insensitive' } } },
            { classroom: { name: { contains: query, mode: 'insensitive' } } }
        ];
    }
    if (status) {
        where.status = status;
    }
    const [groups, total] = await Promise.all([
        prisma_1.default.group.findMany({
            where,
            include: { course: true, teacher: true, classroom: true, students: true, lessons: true },
            orderBy: [{ startDate: 'desc' }],
            skip,
            take: limit
        }),
        prisma_1.default.group.count({ where })
    ]);
    const data = groups.map(group => ({
        ...group,
        availableSeats: Math.max(0, group.capacity - group.students.length)
    }));
    res.json({ data, meta: { page, limit, total } });
});
router.post('/', (0, auth_1.authorize)(['ADMIN', 'MANAGER']), async (req, res) => {
    const { name, courseId, teacherId, classroomId, startDate, endDate, capacity, monthlyFee, status, lessons } = req.body;
    if (!name || !courseId || !teacherId || !classroomId || !startDate || !capacity) {
        return res.status(400).json({ error: 'Missing required fields for group creation' });
    }
    const group = await prisma_1.default.group.create({
        data: {
            name,
            courseId: Number(courseId),
            teacherId: Number(teacherId),
            classroomId: Number(classroomId),
            startDate: new Date(startDate),
            endDate: endDate ? new Date(endDate) : undefined,
            capacity: Number(capacity),
            monthlyFee: Number(monthlyFee || 0),
            status,
            lessons: {
                create: Array.isArray(lessons)
                    ? lessons.map((lesson) => ({ weekday: lesson.weekday, startTime: lesson.startTime, endTime: lesson.endTime }))
                    : []
            }
        },
        include: { lessons: true, course: true, teacher: true, classroom: true, students: true }
    });
    res.status(201).json({ ...group, availableSeats: Math.max(0, group.capacity - group.students.length) });
});
router.get('/:id', (0, auth_1.authorize)(['ADMIN', 'MANAGER', 'TEACHER', 'CASHIER']), async (req, res) => {
    const id = Number(req.params.id);
    const group = await prisma_1.default.group.findUnique({
        where: { id },
        include: { course: true, teacher: true, classroom: true, lessons: true, students: true }
    });
    if (!group) {
        return res.status(404).json({ error: 'Group not found' });
    }
    res.json({ ...group, availableSeats: Math.max(0, group.capacity - group.students.length) });
});
router.put('/:id', (0, auth_1.authorize)(['ADMIN', 'MANAGER']), async (req, res) => {
    const id = Number(req.params.id);
    const { lessons, ...payload } = req.body;
    const group = await prisma_1.default.group.update({
        where: { id },
        data: {
            ...payload,
            startDate: payload.startDate ? new Date(payload.startDate) : undefined,
            endDate: payload.endDate ? new Date(payload.endDate) : undefined,
            capacity: payload.capacity ? Number(payload.capacity) : undefined,
            monthlyFee: payload.monthlyFee ? Number(payload.monthlyFee) : undefined
        }
    });
    if (Array.isArray(lessons)) {
        await prisma_1.default.lessonSchedule.deleteMany({ where: { groupId: id } });
        await prisma_1.default.lessonSchedule.createMany({
            data: lessons.map((lesson) => ({ groupId: id, weekday: lesson.weekday, startTime: lesson.startTime, endTime: lesson.endTime }))
        });
    }
    const updatedGroup = await prisma_1.default.group.findUnique({
        where: { id },
        include: { lessons: true, course: true, teacher: true, classroom: true, students: true }
    });
    res.json({
        ...updatedGroup,
        availableSeats: Math.max(0, (updatedGroup?.capacity ?? 0) - (updatedGroup?.students?.length ?? 0))
    });
});
router.delete('/:id', (0, auth_1.authorize)(['ADMIN', 'MANAGER']), async (req, res) => {
    const id = Number(req.params.id);
    await prisma_1.default.group.delete({ where: { id } });
    res.status(204).send();
});
//# sourceMappingURL=groups.js.map