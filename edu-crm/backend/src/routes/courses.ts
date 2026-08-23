import { Router } from 'express';
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
      { code: { contains: query, mode: 'insensitive' } },
      { title: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } }
    ];
  }

  const [courses, total] = await Promise.all([
    prisma.course.findMany({
      where,
      include: { groups: true },
      orderBy: [{ title: 'asc' }],
      skip,
      take: limit
    }),
    prisma.course.count({ where })
  ]);

  res.json({ data: courses, meta: { page, limit, total } });
});

router.get('/:id', authorize(['ADMIN', 'MANAGER', 'TEACHER', 'CASHIER']), async (req, res) => {
  const id = Number(req.params.id);
  const course = await prisma.course.findUnique({
    where: { id },
    include: { groups: true }
  });

  if (!course) {
    return res.status(404).json({ error: 'Course not found' });
  }

  res.json(course);
});

router.post('/', authorize(['ADMIN', 'MANAGER']), async (req, res) => {
  const { code, title, description, durationMonths } = req.body;
  if (!code || !title) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const course = await prisma.course.create({
    data: { code, title, description, durationMonths: Number(durationMonths || 3) }
  });
  res.status(201).json(course);
});

router.put('/:id', authorize(['ADMIN', 'MANAGER']), async (req, res) => {
  const id = Number(req.params.id);
  const course = await prisma.course.update({
    where: { id },
    data: {
      ...req.body,
      durationMonths: req.body.durationMonths ? Number(req.body.durationMonths) : undefined
    }
  });
  res.json(course);
});

router.delete('/:id', authorize(['ADMIN', 'MANAGER']), async (req, res) => {
  const id = Number(req.params.id);
  await prisma.course.delete({ where: { id } });
  res.status(204).send();
});

export { router as coursesRouter };
