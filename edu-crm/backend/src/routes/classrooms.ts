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
      { name: { contains: query, mode: 'insensitive' } },
      { location: { contains: query, mode: 'insensitive' } }
    ];
  }

  const [classrooms, total] = await Promise.all([
    prisma.classroom.findMany({
      where,
      include: { groups: true },
      orderBy: [{ name: 'asc' }],
      skip,
      take: limit
    }),
    prisma.classroom.count({ where })
  ]);

  res.json({ data: classrooms, meta: { page, limit, total } });
});

router.get('/:id', authorize(['ADMIN', 'MANAGER', 'TEACHER', 'CASHIER']), async (req, res) => {
  const id = Number(req.params.id);
  const classroom = await prisma.classroom.findUnique({
    where: { id },
    include: { groups: true }
  });

  if (!classroom) {
    return res.status(404).json({ error: 'Classroom not found' });
  }

  res.json(classroom);
});

router.post('/', authorize(['ADMIN', 'MANAGER']), async (req, res) => {
  const { name, capacity, location } = req.body;
  if (!name || !capacity) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const classroom = await prisma.classroom.create({
    data: { name, capacity: Number(capacity), location }
  });
  res.status(201).json(classroom);
});

router.put('/:id', authorize(['ADMIN', 'MANAGER']), async (req, res) => {
  const id = Number(req.params.id);
  const classroom = await prisma.classroom.update({
    where: { id },
    data: {
      name: req.body.name,
      capacity: req.body.capacity ? Number(req.body.capacity) : undefined,
      location: req.body.location
    }
  });
  res.json(classroom);
});

router.delete('/:id', authorize(['ADMIN', 'MANAGER']), async (req, res) => {
  const id = Number(req.params.id);
  await prisma.classroom.delete({ where: { id } });
  res.status(204).send();
});

export { router as classroomsRouter };
