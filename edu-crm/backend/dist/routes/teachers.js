"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.teachersRouter = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
exports.teachersRouter = router;
router.use(auth_1.authenticate);
router.get('/', (0, auth_1.authorize)(['ADMIN', 'MANAGER', 'TEACHER', 'CASHIER']), async (req, res) => {
    const query = req.query.q ? String(req.query.q) : undefined;
    const page = Number(req.query.page || 1);
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const skip = (page - 1) * limit;
    const where = {};
    if (query) {
        where.OR = [
            { name: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query, mode: 'insensitive' } },
            { user: { email: { contains: query, mode: 'insensitive' } } }
        ];
    }
    const [teachers, total] = await Promise.all([
        prisma_1.default.teacher.findMany({
            where,
            include: { user: true, groups: { include: { course: true, classroom: true } } },
            orderBy: [{ name: 'asc' }],
            skip,
            take: limit
        }),
        prisma_1.default.teacher.count({ where })
    ]);
    res.json({ data: teachers, meta: { page, limit, total } });
});
router.post('/', (0, auth_1.authorize)(['ADMIN', 'MANAGER']), async (req, res) => {
    const { email, password, name, phone, bio } = req.body;
    if (!email || !password || !name) {
        return res.status(400).json({ error: 'Missing required teacher fields' });
    }
    const existingUser = await prisma_1.default.user.findUnique({ where: { email } });
    if (existingUser) {
        return res.status(409).json({ error: 'This email is already used' });
    }
    const hashedPassword = await bcryptjs_1.default.hash(password, 10);
    const user = await prisma_1.default.user.create({
        data: {
            email,
            password: hashedPassword,
            role: 'TEACHER'
        }
    });
    const teacher = await prisma_1.default.teacher.create({
        data: { userId: user.id, name, phone, bio }
    });
    const savedTeacher = await prisma_1.default.teacher.findUnique({
        where: { id: teacher.id },
        include: { user: true, groups: { include: { course: true, classroom: true } } }
    });
    res.status(201).json(savedTeacher);
});
router.get('/:id', (0, auth_1.authorize)(['ADMIN', 'MANAGER', 'TEACHER', 'CASHIER']), async (req, res) => {
    const id = Number(req.params.id);
    const teacher = await prisma_1.default.teacher.findUnique({
        where: { id },
        include: { user: true, groups: { include: { course: true, classroom: true, lessons: true, students: true } } }
    });
    if (!teacher) {
        return res.status(404).json({ error: 'Teacher not found' });
    }
    res.json(teacher);
});
router.put('/:id', (0, auth_1.authorize)(['ADMIN', 'MANAGER']), async (req, res) => {
    const id = Number(req.params.id);
    const { email, password, name, phone, bio } = req.body;
    const currentTeacher = await prisma_1.default.teacher.findUnique({ where: { id } });
    if (!currentTeacher) {
        return res.status(404).json({ error: 'Teacher not found' });
    }
    if (email || password) {
        const updateUser = {};
        if (email)
            updateUser.email = email;
        if (password)
            updateUser.password = await bcryptjs_1.default.hash(password, 10);
        await prisma_1.default.user.update({ where: { id: currentTeacher.userId }, data: updateUser });
    }
    await prisma_1.default.teacher.update({
        where: { id },
        data: { name, phone, bio }
    });
    const teacher = await prisma_1.default.teacher.findUnique({
        where: { id },
        include: { user: true, groups: { include: { course: true, classroom: true } } }
    });
    res.json(teacher);
});
router.delete('/:id', (0, auth_1.authorize)(['ADMIN', 'MANAGER']), async (req, res) => {
    const id = Number(req.params.id);
    const teacher = await prisma_1.default.teacher.findUnique({ where: { id } });
    if (!teacher) {
        return res.status(404).json({ error: 'Teacher not found' });
    }
    await prisma_1.default.teacher.delete({ where: { id } });
    await prisma_1.default.user.delete({ where: { id: teacher.userId } });
    res.status(204).send();
});
//# sourceMappingURL=teachers.js.map