"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.attendanceRouter = void 0;
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
exports.attendanceRouter = router;
router.use(auth_1.authenticate);
router.get('/', (0, auth_1.authorize)(['ADMIN', 'MANAGER', 'TEACHER']), async (req, res) => {
    const studentId = req.query.studentId ? Number(req.query.studentId) : undefined;
    const groupId = req.query.groupId ? Number(req.query.groupId) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    const search = req.query.q ? String(req.query.q) : undefined;
    const page = Number(req.query.page || 1);
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const skip = (page - 1) * limit;
    const where = {};
    if (studentId) {
        where.studentId = studentId;
    }
    if (groupId) {
        where.groupId = groupId;
    }
    if (status) {
        where.status = status;
    }
    if (search) {
        where.OR = [
            { note: { contains: search, mode: 'insensitive' } },
            { status: { contains: search, mode: 'insensitive' } },
            { student: { firstName: { contains: search, mode: 'insensitive' } } },
            { student: { lastName: { contains: search, mode: 'insensitive' } } },
            { student: { studentId: { contains: search, mode: 'insensitive' } } },
            { group: { name: { contains: search, mode: 'insensitive' } } }
        ];
    }
    const [attendances, total] = await Promise.all([
        prisma_1.default.attendance.findMany({
            where,
            include: { student: true, group: true },
            orderBy: [{ date: 'desc' }],
            skip,
            take: limit
        }),
        prisma_1.default.attendance.count({ where })
    ]);
    res.json({ data: attendances, meta: { page, limit, total } });
});
router.post('/', (0, auth_1.authorize)(['ADMIN', 'MANAGER', 'TEACHER']), async (req, res) => {
    const { studentId, groupId, date, status, note } = req.body;
    if (!studentId || !groupId || !date || !status) {
        return res.status(400).json({ error: 'Missing attendance fields' });
    }
    const attendance = await prisma_1.default.attendance.create({
        data: {
            studentId: Number(studentId),
            groupId: Number(groupId),
            date: new Date(date),
            status,
            note
        },
        include: { student: true, group: true }
    });
    res.status(201).json(attendance);
});
router.get('/student/:studentId', (0, auth_1.authorize)(['ADMIN', 'MANAGER', 'TEACHER']), async (req, res) => {
    const studentId = Number(req.params.studentId);
    const attendances = await prisma_1.default.attendance.findMany({
        where: { studentId },
        include: { group: true },
        orderBy: [{ date: 'desc' }]
    });
    res.json(attendances);
});
router.delete('/:id', (0, auth_1.authorize)(['ADMIN', 'MANAGER']), async (req, res) => {
    const id = Number(req.params.id);
    await prisma_1.default.attendance.delete({ where: { id } });
    res.status(204).send();
});
//# sourceMappingURL=attendance.js.map