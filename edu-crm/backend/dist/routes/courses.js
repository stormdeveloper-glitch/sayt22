"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.coursesRouter = void 0;
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
exports.coursesRouter = router;
router.use(auth_1.authenticate);
router.get('/', (0, auth_1.authorize)(['ADMIN', 'MANAGER', 'TEACHER', 'CASHIER']), async (req, res) => {
    const query = req.query.q ? String(req.query.q) : undefined;
    const page = Number(req.query.page || 1);
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const skip = (page - 1) * limit;
    const where = {};
    if (query) {
        where.OR = [
            { code: { contains: query, mode: 'insensitive' } },
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } }
        ];
    }
    const [courses, total] = await Promise.all([
        prisma_1.default.course.findMany({
            where,
            include: { groups: true },
            orderBy: [{ title: 'asc' }],
            skip,
            take: limit
        }),
        prisma_1.default.course.count({ where })
    ]);
    res.json({ data: courses, meta: { page, limit, total } });
});
router.get('/:id', (0, auth_1.authorize)(['ADMIN', 'MANAGER', 'TEACHER', 'CASHIER']), async (req, res) => {
    const id = Number(req.params.id);
    const course = await prisma_1.default.course.findUnique({
        where: { id },
        include: { groups: true }
    });
    if (!course) {
        return res.status(404).json({ error: 'Course not found' });
    }
    res.json(course);
});
router.post('/', (0, auth_1.authorize)(['ADMIN', 'MANAGER']), async (req, res) => {
    const { code, title, description, durationMonths } = req.body;
    if (!code || !title) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    const course = await prisma_1.default.course.create({
        data: { code, title, description, durationMonths: Number(durationMonths || 3) }
    });
    res.status(201).json(course);
});
router.put('/:id', (0, auth_1.authorize)(['ADMIN', 'MANAGER']), async (req, res) => {
    const id = Number(req.params.id);
    const course = await prisma_1.default.course.update({
        where: { id },
        data: {
            ...req.body,
            durationMonths: req.body.durationMonths ? Number(req.body.durationMonths) : undefined
        }
    });
    res.json(course);
});
router.delete('/:id', (0, auth_1.authorize)(['ADMIN', 'MANAGER']), async (req, res) => {
    const id = Number(req.params.id);
    await prisma_1.default.course.delete({ where: { id } });
    res.status(204).send();
});
//# sourceMappingURL=courses.js.map