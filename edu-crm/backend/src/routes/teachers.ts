import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', authorize(['ADMIN', 'MANAGER', 'TEACHER', 'CASHIER']), async (req, res) => {
  const query = req.query.q ? String(req.query.q) : undefined;
  const page = Number(req.query.page || 1);
  const limit = Math.min(Number(req.query.limit || 20), 100);
  const skip = (page - 1) * limit;
  const where: any = {};

  if (query) {
    where.OR = [
      { name: { contains: query, mode: 'insensitive' } },
      { phone: { contains: query, mode: 'insensitive' } },
      { user: { email: { contains: query, mode: 'insensitive' } } }
    ];
  }

  const [teachers, total] = await Promise.all([
    prisma.teacher.findMany({
      where,
      include: { user: true, groups: { include: { course: true, classroom: true } } },
      orderBy: [{ name: 'asc' }],
      skip,
      take: limit
    }),
    prisma.teacher.count({ where })
  ]);

  res.json({ data: teachers, meta: { page, limit, total } });
});

router.post('/', authorize(['ADMIN', 'MANAGER']), async (req, res) => {
  const { email, password, name, phone, bio } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Missing required teacher fields' });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return res.status(409).json({ error: 'This email is already used' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      role: 'TEACHER'
    }
  });

  const teacher = await prisma.teacher.create({
    data: { userId: user.id, name, phone, bio }
  });

  const savedTeacher = await prisma.teacher.findUnique({
    where: { id: teacher.id },
    include: { user: true, groups: { include: { course: true, classroom: true } } }
  });

  res.status(201).json(savedTeacher);
});

router.get('/:id', authorize(['ADMIN', 'MANAGER', 'TEACHER', 'CASHIER']), async (req, res) => {
  const id = Number(req.params.id);
  const teacher = await prisma.teacher.findUnique({
    where: { id },
    include: { user: true, groups: { include: { course: true, classroom: true, lessons: true, students: true } } }
  });

  if (!teacher) {
    return res.status(404).json({ error: 'Teacher not found' });
  }

  res.json(teacher);
});

router.put('/:id', authorize(['ADMIN', 'MANAGER']), async (req, res) => {
  const id = Number(req.params.id);
  const { email, password, name, phone, bio } = req.body;
  const currentTeacher = await prisma.teacher.findUnique({ where: { id } });
  if (!currentTeacher) {
    return res.status(404).json({ error: 'Teacher not found' });
  }

  if (email || password) {
    const updateUser: any = {};
    if (email) updateUser.email = email;
    if (password) updateUser.password = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { id: currentTeacher.userId }, data: updateUser });
  }

  await prisma.teacher.update({
    where: { id },
    data: { name, phone, bio }
  });

  const teacher = await prisma.teacher.findUnique({
    where: { id },
    include: { user: true, groups: { include: { course: true, classroom: true } } }
  });

  res.json(teacher);
});

router.delete('/:id', authorize(['ADMIN', 'MANAGER']), async (req, res) => {
  const id = Number(req.params.id);
  const teacher = await prisma.teacher.findUnique({ where: { id } });
  if (!teacher) {
    return res.status(404).json({ error: 'Teacher not found' });
  }

  await prisma.teacher.delete({ where: { id } });
  await prisma.user.delete({ where: { id: teacher.userId } });

  res.status(204).send();
});

export { router as teachersRouter };
