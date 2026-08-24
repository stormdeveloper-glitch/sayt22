import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 9) return '998' + digits;
  if (digits.startsWith('8') && digits.length === 10) return '99' + digits.slice(1);
  if (digits.startsWith('+')) return digits.slice(1);
  return digits;
}

router.get('/', authorize(['ADMIN', 'MANAGER']), async (req, res) => {
  const query = req.query.q ? String(req.query.q).trim() : undefined;
  const roleFilter = req.query.role ? String(req.query.role).trim() : undefined;
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(Math.max(1, Number(req.query.limit || 20)), 100);
  const skip = (page - 1) * limit;
  const where: any = {};

  if (query) {
    const q = { contains: query, mode: 'insensitive' as const };
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
    prisma.user.findMany({
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
    prisma.user.count({ where }),
  ]);

  const pageCount = Math.ceil(total / limit) || 1;
  res.json({
    data: users,
    meta: { page, limit, total, pageCount },
  });
});

router.post('/', authorize(['ADMIN']), async (req, res) => {
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
    const exists = await prisma.user.findFirst({
      where: { OR: [{ email: emailStr }, ...(phoneNorm ? [{ phone: phoneNorm }] : [])] },
      select: { email: true, phone: true },
    });

    if (exists) {
      if (exists.email === emailStr) {
        return res.status(409).json({ error: 'Bu email allaqachon tizimda mavjud', field: 'email' });
      }
      return res.status(409).json({ error: 'Bu telefon raqami allaqachon tizimda mavjud', field: 'phone' });
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);
    const user = await prisma.user.create({
      data: {
        email: emailStr,
        password: hashedPassword,
        name: nameStr,
        phone: phoneNorm,
        role: roleStr as any,
      },
      select: {
        id: true, email: true, name: true, phone: true, role: true,
        createdAt: true, updatedAt: true,
      },
    });
    res.status(201).json(user);
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? (err.meta.target as string[]).join(',') : '';
      if (target.includes('email')) return res.status(409).json({ error: 'Bu email allaqachon mavjud', field: 'email' });
      if (target.includes('phone')) return res.status(409).json({ error: 'Bu telefon raqami allaqachon mavjud', field: 'phone' });
      return res.status(409).json({ error: 'Bunday yozuv allaqachon mavjud' });
    }
    throw err;
  }
});

router.get('/:id', authorize(['ADMIN', 'MANAGER']), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'Noto‘g‘ri foydalanuvchi ID' });
  }
  const user = await prisma.user.findUnique({
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
  if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
  res.json(user);
});

router.put('/:id', authorize(['ADMIN']), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'Noto‘g‘ri foydalanuvchi ID' });
  }
  const current = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true } });
  if (!current) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });

  const { email, password, name, phone, role } = req.body || {};

  const emailStr = email ? String(email).trim().toLowerCase() : current.email;
  const nameStr = name !== undefined ? (name ? String(name).trim() : null) : undefined;
  const phoneNorm = phone !== undefined ? normalizePhone(phone) : undefined;
  let roleStr: string | undefined;
  if (role && ['ADMIN', 'MANAGER', 'TEACHER', 'CASHIER'].includes(String(role).toUpperCase())) {
    roleStr = String(role).toUpperCase();
  }

  if (password !== undefined && password !== '' && String(password).length < 6) {
    return res.status(400).json({ error: 'Parol kamida 6 belgidan iborat bo‘lishi kerak' });
  }

  if (emailStr !== current.email) {
    const conflict = await prisma.user.findUnique({ where: { email: emailStr }, select: { id: true } });
    if (conflict && conflict.id !== id) {
      return res.status(409).json({ error: 'Bu email boshqa foydalanuvchi tomonidan ishlatilgan', field: 'email' });
    }
  }
  if (phoneNorm !== undefined && phoneNorm !== null) {
    const conflict = await prisma.user.findUnique({ where: { phone: phoneNorm }, select: { id: true } });
    if (conflict && conflict.id !== id) {
      return res.status(409).json({ error: 'Bu telefon raqami boshqa foydalanuvchi tomonidan ishlatilgan', field: 'phone' });
    }
  }

  const data: any = { email: emailStr };
  if (nameStr !== undefined) data.name = nameStr;
  if (phoneNorm !== undefined) data.phone = phoneNorm;
  if (roleStr) data.role = roleStr;
  if (password && password !== '') data.password = await bcrypt.hash(String(password), 10);

  try {
    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true, email: true, name: true, phone: true, role: true,
        createdAt: true, updatedAt: true,
      },
    });
    res.json(user);
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? (err.meta.target as string[]).join(',') : '';
      if (target.includes('email')) return res.status(409).json({ error: 'Bu email allaqachon mavjud', field: 'email' });
      if (target.includes('phone')) return res.status(409).json({ error: 'Bu telefon raqami allaqachon mavjud', field: 'phone' });
      return res.status(409).json({ error: 'Bunday yozuv allaqachon mavjud' });
    }
    throw err;
  }
});

router.delete('/:id', authorize(['ADMIN']), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'Noto‘g‘ri foydalanuvchi ID' });
  }
  const selfId = req.auth?.userId;
  if (selfId === id) {
    return res.status(400).json({ error: 'O‘zingizni o‘chira olmaysiz. Boshqa admin dan so‘rang.' });
  }
  const user = await prisma.user.findUnique({ where: { id }, include: { teacher: true } });
  if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });

  if (user.role === 'ADMIN') {
    const otherAdmins = await prisma.user.count({ where: { role: 'ADMIN', id: { not: id } } });
    if (otherAdmins === 0) {
      return res.status(400).json({ error: 'Oxirgi adminni o‘chira olmaysiz. Avval yangi admin yarating.' });
    }
  }

  try {
    if (user.teacher) {
      await prisma.teacher.update({
        where: { id: user.teacher.id },
        data: { groups: { set: [] } },
      });
      await prisma.teacher.delete({ where: { id: user.teacher.id } });
    }
    await prisma.user.delete({ where: { id } });
    res.status(204).send();
  } catch (err: any) {
    if (err?.code === 'P2003') {
      return res.status(409).json({
        error: "Foydalanuvchi bog'liq yozuvlar mavjud. Avval bog'liqliklarni tozlang.",
      });
    }
    throw err;
  }
});

export { router as usersRouter };
