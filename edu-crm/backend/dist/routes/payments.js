"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentRouter = void 0;
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
exports.paymentRouter = router;
router.use(auth_1.authenticate);
router.get('/', (0, auth_1.authorize)(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
    const studentId = req.query.studentId ? Number(req.query.studentId) : undefined;
    const groupId = req.query.groupId ? Number(req.query.groupId) : undefined;
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
    if (search) {
        where.OR = [
            { reference: { contains: search, mode: 'insensitive' } },
            { method: { contains: search, mode: 'insensitive' } },
            { note: { contains: search, mode: 'insensitive' } },
            { student: { firstName: { contains: search, mode: 'insensitive' } } },
            { student: { lastName: { contains: search, mode: 'insensitive' } } },
            { student: { studentId: { contains: search, mode: 'insensitive' } } },
            { group: { name: { contains: search, mode: 'insensitive' } } }
        ];
    }
    const [payments, total] = await Promise.all([
        prisma_1.default.payment.findMany({
            where,
            include: { student: true, group: true },
            orderBy: [{ paidAt: 'desc' }],
            skip,
            take: limit
        }),
        prisma_1.default.payment.count({ where })
    ]);
    res.json({ data: payments, meta: { page, limit, total } });
});
router.post('/', (0, auth_1.authorize)(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
    const { studentId, groupId, amount, method, paidAt, reference, note } = req.body;
    if (!studentId || !groupId || !amount || !method) {
        return res.status(400).json({ error: 'Missing payment fields' });
    }
    const payment = await prisma_1.default.payment.create({
        data: {
            studentId: Number(studentId),
            groupId: Number(groupId),
            amount: Number(amount),
            method,
            paidAt: paidAt ? new Date(paidAt) : new Date(),
            reference,
            note
        },
        include: { student: true, group: true }
    });
    res.status(201).json(payment);
});
router.get('/receipt/:id', (0, auth_1.authorize)(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
    const id = Number(req.params.id);
    const payment = await prisma_1.default.payment.findUnique({
        where: { id },
        include: { student: true, group: true }
    });
    if (!payment) {
        return res.status(404).json({ error: 'Payment receipt not found' });
    }
    res.json(payment);
});
router.get('/balance/:studentId', (0, auth_1.authorize)(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
    const studentId = Number(req.params.studentId);
    const student = await prisma_1.default.student.findUnique({
        where: { id: studentId },
        include: { payments: true, group: true }
    });
    if (!student) {
        return res.status(404).json({ error: 'Student not found' });
    }
    const totalPaid = student.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const now = new Date();
    const start = new Date(student.group.startDate);
    const end = student.group.endDate ? new Date(student.group.endDate) : now;
    const effectiveEnd = now < end ? now : end;
    const months = Math.max(1, (effectiveEnd.getFullYear() - start.getFullYear()) * 12 + (effectiveEnd.getMonth() - start.getMonth()) + 1);
    const expectedTotal = months * student.group.monthlyFee;
    res.json({
        studentId: student.id,
        monthlyFee: student.group.monthlyFee,
        totalPaid,
        expectedTotal,
        balance: Number(totalPaid) - expectedTotal
    });
});
router.delete('/:id', (0, auth_1.authorize)(['ADMIN', 'MANAGER', 'CASHIER']), async (req, res) => {
    const id = Number(req.params.id);
    await prisma_1.default.payment.delete({ where: { id } });
    res.status(204).send();
});
//# sourceMappingURL=payments.js.map