"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersRouter = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
exports.usersRouter = router;
router.use(auth_1.authenticate);
function normalizePhone(raw) {
    if (!raw)
        return null;
    const digits = raw.replace(/\D/g, '');
    if (!digits)
        return null;
    if (digits.length === 9)
        return '998' + digits;
    if (digits.startsWith('8') && digits.length === 10)
        return '99' + digits.slice(1);
    if (digits.startsWith('+'))
        return digits.slice(1);
    return digits;
}
router.get('/', (0, auth_1.authorize)(['ADMIN', 'MANAGER']), async (req, res) => {
    const query = req.query.q ? String(req.query.q).trim() : undefined;
    const roleFilter = req.query.role ? String(req.query.role).trim() : undefined;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(Math.max(1, Number(req.query.limit || 20)), 100);
    const skip = (page - 1) * limit;
    const where = {};
    if (query) {
        const q = { contains: query, mode: 'insensitive' };
        where.OR = [
            { name: q },
            { phone: q },
            { email: q },
        ];
    }
    if (roleFilter && ['ADMIN', 'MANAGER', 'TEACHER', 'CASHIER'].includes(roleFilter)) {
        where.role = roleFilter;
    }
    const [users, total] = await Promise.all([
        prisma_1.default.user.findMany({
            where,
            select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                role: true,
                createdAt: true,
                updatedAt: true,
                teacher: {
                    select: {
                        id: true,
                        name: true,
                        groups: { select: { id: true, name: true } },
                    },
                },
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            skip,
            take: limit,
        }),
        prisma_1.default.user.count({ where }),
    ]);
    const pageCount = Math.ceil(total / limit) || 1;
    res.json({
        data: users,
        meta: { page, limit, total, pageCount },
    });
});
router.post('/', (0, auth_1.authorize)(['ADMIN']), async (req, res) => {
    const { email, password, name, phone, role } = req.body || {};
    if (!email || !password) {
        return res.status(400).json({ error: 'Email va parol majburiy' });
    }
    if (String(password).length < 6) {
        return res.status(400).json({ error: 'Parol kamida 6 belgidan iborat bo‘lishi kerak' });
    }
    const emailStr = String(email).trim().toLowerCase();
    const nameStr = name ? String(name).trim() : null;
    const phoneNorm = normalizePhone(phone);
    const roleStr = role && ['ADMIN', 'MANAGER', 'TEACHER', 'CASHIER'].includes(String(role).toUpperCase())
        ? String(role).toUpperCase()
        : 'MANAGER';
    try {
        const exists = await prisma_1.default.user.findFirst({
            where: { OR: [{ email: emailStr }, ...(phoneNorm ? [{ phone: phoneNorm }] : [])] },
            select: { email: true, phone: true },
        });
        if (exists) {
            if (exists.email === emailStr) {
                return res.status(409).json({ error: 'Bu email allaqachon tizimda mavjud', field: 'email' });
            }
            return res.status(409).json({ error: 'Bu telefon raqami allaqachon tizimda mavjud', field: 'phone' });
        }
        const hashedPassword = await bcryptjs_1.default.hash(String(password), 10);
        const user = await prisma_1.default.user.create({
            data: {
                email: emailStr,
                password: hashedPassword,
                name: nameStr,
                phone: phoneNorm,
                role: roleStr,
            },
            select: {
                id: true, email: true, name: true, phone: true, role: true,
                createdAt: true, updatedAt: true,
            },
        });
        res.status(201).json(user);
    }
    catch (err) {
        if (err?.code === 'P2002') {
            const target = Array.isArray(err.meta?.target) ? err.meta.target.join(',') : '';
            if (target.includes('email'))
                return res.status(409).json({ error: 'Bu email allaqachon mavjud', field: 'email' });
            if (target.includes('phone'))
                return res.status(409).json({ error: 'Bu telefon raqami allaqachon mavjud', field: 'phone' });
            return res.status(409).json({ error: 'Bunday yozuv allaqachon mavjud' });
        }
        throw err;
    }
});
router.get('/:id', (0, auth_1.authorize)(['ADMIN', 'MANAGER']), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: 'Noto‘g‘ri foydalanuvchi ID' });
    }
    const user = await prisma_1.default.user.findUnique({
        where: { id },
        select: {
            id: true, email: true, name: true, phone: true, role: true,
            createdAt: true, updatedAt: true,
            teacher: {
                select: {
                    id: true, name: true,
                    groups: { select: { id: true, name: true } },
                },
            },
        },
    });
    if (!user)
        return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    res.json(user);
});
router.put('/:id', (0, auth_1.authorize)(['ADMIN']), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: 'Noto‘g‘ri foydalanuvchi ID' });
    }
    const current = await prisma_1.default.user.findUnique({ where: { id }, select: { id: true, email: true } });
    if (!current)
        return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    const { email, password, name, phone, role } = req.body || {};
    const emailStr = email ? String(email).trim().toLowerCase() : current.email;
    const nameStr = name !== undefined ? (name ? String(name).trim() : null) : undefined;
    const phoneNorm = phone !== undefined ? normalizePhone(phone) : undefined;
    let roleStr;
    if (role && ['ADMIN', 'MANAGER', 'TEACHER', 'CASHIER'].includes(String(role).toUpperCase())) {
        roleStr = String(role).toUpperCase();
    }
    if (password !== undefined && password !== '' && String(password).length < 6) {
        return res.status(400).json({ error: 'Parol kamida 6 belgidan iborat bo‘lishi kerak' });
    }
    if (emailStr !== current.email) {
        const conflict = await prisma_1.default.user.findUnique({ where: { email: emailStr }, select: { id: true } });
        if (conflict && conflict.id !== id) {
            return res.status(409).json({ error: 'Bu email boshqa foydalanuvchi tomonidan ishlatilgan', field: 'email' });
        }
    }
    if (phoneNorm !== undefined && phoneNorm !== null) {
        const conflict = await prisma_1.default.user.findUnique({ where: { phone: phoneNorm }, select: { id: true } });
        if (conflict && conflict.id !== id) {
            return res.status(409).json({ error: 'Bu telefon raqami boshqa foydalanuvchi tomonidan ishlatilgan', field: 'phone' });
        }
    }
    const data = { email: emailStr };
    if (nameStr !== undefined)
        data.name = nameStr;
    if (phoneNorm !== undefined)
        data.phone = phoneNorm;
    if (roleStr)
        data.role = roleStr;
    if (password && password !== '')
        data.password = await bcryptjs_1.default.hash(String(password), 10);
    try {
        const user = await prisma_1.default.user.update({
            where: { id },
            data,
            select: {
                id: true, email: true, name: true, phone: true, role: true,
                createdAt: true, updatedAt: true,
            },
        });
        res.json(user);
    }
    catch (err) {
        if (err?.code === 'P2002') {
            const target = Array.isArray(err.meta?.target) ? err.meta.target.join(',') : '';
            if (target.includes('email'))
                return res.status(409).json({ error: 'Bu email allaqachon mavjud', field: 'email' });
            if (target.includes('phone'))
                return res.status(409).json({ error: 'Bu telefon raqami allaqachon mavjud', field: 'phone' });
            return res.status(409).json({ error: 'Bunday yozuv allaqachon mavjud' });
        }
        throw err;
    }
});
router.delete('/:id', (0, auth_1.authorize)(['ADMIN']), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: 'Noto‘g‘ri foydalanuvchi ID' });
    }
    const selfId = req.auth?.userId;
    if (selfId === id) {
        return res.status(400).json({ error: 'O‘zingizni o‘chira olmaysiz. Boshqa admin dan so‘rang.' });
    }
    const user = await prisma_1.default.user.findUnique({ where: { id }, include: { teacher: true } });
    if (!user)
        return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    if (user.role === 'ADMIN') {
        const otherAdmins = await prisma_1.default.user.count({ where: { role: 'ADMIN', id: { not: id } } });
        if (otherAdmins === 0) {
            return res.status(400).json({ error: 'Oxirgi adminni o‘chira olmaysiz. Avval yangi admin yarating.' });
        }
    }
    try {
        if (user.teacher) {
            await prisma_1.default.teacher.update({
                where: { id: user.teacher.id },
                data: { groups: { set: [] } },
            });
            await prisma_1.default.teacher.delete({ where: { id: user.teacher.id } });
        }
        await prisma_1.default.user.delete({ where: { id } });
        res.status(204).send();
    }
    catch (err) {
        if (err?.code === 'P2003') {
            return res.status(409).json({
                error: "Foydalanuvchi bog'liq yozuvlar mavjud. Avval bog'liqliklarni tozlang.",
            });
        }
        throw err;
    }
});
//# sourceMappingURL=users.js.map