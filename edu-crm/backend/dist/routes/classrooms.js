"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.classroomsRouter = void 0;
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
exports.classroomsRouter = router;
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
            { location: { contains: query, mode: 'insensitive' } }
        ];
    }
    const [classrooms, total] = await Promise.all([
        prisma_1.default.classroom.findMany({
            where,
            include: { groups: true },
            orderBy: [{ name: 'asc' }],
            skip,
            take: limit
        }),
        prisma_1.default.classroom.count({ where })
    ]);
    res.json({ data: classrooms, meta: { page, limit, total } });
});
router.get('/:id', (0, auth_1.authorize)(['ADMIN', 'MANAGER', 'TEACHER', 'CASHIER']), async (req, res) => {
    const id = Number(req.params.id);
    const classroom = await prisma_1.default.classroom.findUnique({
        where: { id },
        include: { groups: true }
    });
    if (!classroom) {
        return res.status(404).json({ error: 'Classroom not found' });
    }
    res.json(classroom);
});
router.post('/', (0, auth_1.authorize)(['ADMIN', 'MANAGER']), async (req, res) => {
    const { name, capacity, location } = req.body;
    if (!name || !capacity) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    const classroom = await prisma_1.default.classroom.create({
        data: { name, capacity: Number(capacity), location }
    });
    res.status(201).json(classroom);
});
router.put('/:id', (0, auth_1.authorize)(['ADMIN', 'MANAGER']), async (req, res) => {
    const id = Number(req.params.id);
    const classroom = await prisma_1.default.classroom.update({
        where: { id },
        data: {
            name: req.body.name,
            capacity: req.body.capacity ? Number(req.body.capacity) : undefined,
            location: req.body.location
        }
    });
    res.json(classroom);
});
router.delete('/:id', (0, auth_1.authorize)(['ADMIN', 'MANAGER']), async (req, res) => {
    const id = Number(req.params.id);
    await prisma_1.default.classroom.delete({ where: { id } });
    res.status(204).send();
});
//# sourceMappingURL=classrooms.js.map