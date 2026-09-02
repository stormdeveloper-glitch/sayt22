import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', authorize(['ADMIN', 'MANAGER', 'TEACHER', 'CASHIER']), async (req, res) => {
  const query = req.query.q ? String(req.query.q) : undefined;
  const status = req.query.status ? String(req.query.status) : undefined;
  const page = Number(req.query.page || 1);
  const limit = Math.min(Number(req.query.limit || 20), 100);
  const skip = (page - 1) * limit;
  const where: any = {};

  if (query) {
    where.OR = [
      { name: { contains: query, mode: 'insensitive' } },
      { course: { title: { contains: query, mode: 'insensitive' } } },
      { teacher: { name: { contains: query, mode: 'insensitive' } } },
      { classroom: { name: { contains: query, mode: 'insensitive' } } }
    ];
  }

  if (status) {
    where.status = status;
  }

  const [groups, total] = await Promise.all([
    prisma.group.findMany({
      where,
      include: { course: true, teacher: true, classroom: true, students: true, lessons: true },
      orderBy: [{ startDate: 'desc' }],
      skip,
      take: limit
    }),
    prisma.group.count({ where })
  ]);

  const data = groups.map(group => ({
    ...group,
    availableSeats: Math.max(0, group.capacity - group.students.length)
  }));

  res.json({ data, meta: { page, limit, total } });
});

router.post('/', authorize(['ADMIN', 'MANAGER']), async (req, res) => {
  const { name, courseId, teacherId, classroomId, startDate, endDate, capacity, monthlyFee, status, lessons } = req.body;

  if (!name || !courseId || !teacherId || !classroomId || !startDate || !capacity) {
    return res.status(400).json({ error: 'Missing required fields for group creation' });
  }

  const group = await prisma.group.create({
    data: {
      name,
      courseId: Number(courseId),
      teacherId: Number(teacherId),
      classroomId: Number(classroomId),
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
      capacity: Number(capacity),
      monthlyFee: Number(monthlyFee || 0),
      status,
      lessons: {
        create: Array.isArray(lessons)
          ? lessons.map((lesson: any) => ({ weekday: lesson.weekday, startTime: lesson.startTime, endTime: lesson.endTime }))
          : []
      }
    },
    include: { lessons: true, course: true, teacher: true, classroom: true, students: true }
  });

  res.status(201).json({ ...group, availableSeats: Math.max(0, group.capacity - group.students.length) });
});

router.get('/:id', authorize(['ADMIN', 'MANAGER', 'TEACHER', 'CASHIER']), async (req, res) => {
  const id = Number(req.params.id);
  const group = await prisma.group.findUnique({
    where: { id },
    include: { course: true, teacher: true, classroom: true, lessons: true, students: true }
  });

  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  res.json({ ...group, availableSeats: Math.max(0, group.capacity - group.students.length) });
});

router.put('/:id', authorize(['ADMIN', 'MANAGER']), async (req, res) => {
  const id = Number(req.params.id);
  const { lessons, ...payload } = req.body;

  const group = await prisma.group.update({
    where: { id },
    data: {
      ...payload,
      startDate: payload.startDate ? new Date(payload.startDate) : undefined,
      endDate: payload.endDate ? new Date(payload.endDate) : undefined,
      capacity: payload.capacity ? Number(payload.capacity) : undefined,
      monthlyFee: payload.monthlyFee ? Number(payload.monthlyFee) : undefined
    }
  });

  if (Array.isArray(lessons)) {
    await prisma.lessonSchedule.deleteMany({ where: { groupId: id } });
    await prisma.lessonSchedule.createMany({
      data: lessons.map((lesson: any) => ({ groupId: id, weekday: lesson.weekday, startTime: lesson.startTime, endTime: lesson.endTime }))
    });
  }

  const updatedGroup = await prisma.group.findUnique({
    where: { id },
    include: { lessons: true, course: true, teacher: true, classroom: true, students: true }
  });

  res.json({
    ...updatedGroup,
    availableSeats: Math.max(0, (updatedGroup?.capacity ?? 0) - (updatedGroup?.students?.length ?? 0))
  });
});

router.delete('/:id', authorize(['ADMIN', 'MANAGER']), async (req, res) => {
  const id = Number(req.params.id);
  await prisma.group.delete({ where: { id } });
  res.status(204).send();
});

export { router as groupsRouter };
