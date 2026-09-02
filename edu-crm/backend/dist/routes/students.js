"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.studentsRouter = void 0;
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
exports.studentsRouter = router;
router.use(auth_1.authenticate);
router.get('/', (0, auth_1.authorize)(['ADMIN', 'MANAGER', 'TEACHER', 'CASHIER']), async (req, res) => {
    const query = req.query.q ? String(req.query.q) : undefined;
    const group = req.query.group ? String(req.query.group) : undefined;
    const where = {};
    if (query) {
        where.OR = [
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query, mode: 'insensitive' } },
            { parentPhone: { contains: query, mode: 'insensitive' } },
            { studentId: { contains: query, mode: 'insensitive' } }
        ];
    }
    if (group) {
        where.group = { name: { contains: group, mode: 'insensitive' } };
    }
    const students = await prisma_1.default.student.findMany({
        where,
        include: {
            group: true
        },
        orderBy: [{ updatedAt: 'desc' }]
    });
    res.json(students);
});
router.post('/', (0, auth_1.authorize)(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
    const { firstName, lastName, gender, dateOfBirth, phone, parentName, parentPhone, address, notes, photoUrl, groupId, studentId, status } = req.body;
    if (!firstName || !lastName || !gender || !dateOfBirth || !phone || !groupId || !studentId) {
        return res.status(400).json({ error: 'Missing required student fields' });
    }
    const group = await prisma_1.default.group.findUnique({ where: { id: Number(groupId) } });
    if (!group) {
        return res.status(404).json({ error: 'Group not found' });
    }
    const currentCount = await prisma_1.default.student.count({ where: { groupId: group.id } });
    if (currentCount >= group.capacity) {
        return res.status(422).json({ error: 'Group is full' });
    }
    const student = await prisma_1.default.student.create({
        data: {
            studentId,
            firstName,
            lastName,
            gender,
            dateOfBirth: new Date(dateOfBirth),
            phone,
            parentName,
            parentPhone,
            address,
            notes,
            photoUrl,
            status,
            groupId: group.id
        }
    });
    res.status(201).json(student);
});
router.get('/:id', (0, auth_1.authorize)(['ADMIN', 'MANAGER', 'TEACHER', 'CASHIER']), async (req, res) => {
    const id = Number(req.params.id);
    const student = await prisma_1.default.student.findUnique({
        where: { id },
        include: { group: true, attendances: true, payments: true }
    });
    if (!student) {
        return res.status(404).json({ error: 'Student not found' });
    }
    res.json(student);
});
router.put('/:id', (0, auth_1.authorize)(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
    const id = Number(req.params.id);
    const payload = req.body;
    const student = await prisma_1.default.student.update({
        where: { id },
        data: {
            ...payload,
            dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : undefined,
            groupId: payload.groupId ? Number(payload.groupId) : undefined
        }
    });
    res.json(student);
});
router.delete('/:id', (0, auth_1.authorize)(['ADMIN', 'MANAGER']), async (req, res) => {
    const id = Number(req.params.id);
    await prisma_1.default.student.delete({ where: { id } });
    res.status(204).send();
});
//# sourceMappingURL=students.js.map