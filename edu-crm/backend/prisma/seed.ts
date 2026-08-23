import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash('Admin123!', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@educrm.local' },
    update: { password: adminPassword, role: 'ADMIN' },
    create: {
      email: 'admin@educrm.local',
      password: adminPassword,
      role: 'ADMIN'
    }
  });

  const teacherUser = await prisma.user.upsert({
    where: { email: 'teacher@educrm.local' },
    update: { password: await bcrypt.hash('Teacher123!', 10), role: 'TEACHER' },
    create: {
      email: 'teacher@educrm.local',
      password: await bcrypt.hash('Teacher123!', 10),
      role: 'TEACHER'
    }
  });

  const teacher = await prisma.teacher.upsert({
    where: { userId: teacherUser.id },
    update: { name: 'Jane Doe', phone: '+998901234567', bio: 'Senior instructor for web development.' },
    create: {
      userId: teacherUser.id,
      name: 'Jane Doe',
      phone: '+998901234567',
      bio: 'Senior instructor for web development.'
    }
  });

  const course = await prisma.course.upsert({
    where: { code: 'WEB101' },
    update: { title: 'Web Development Basics', durationMonths: 3 },
    create: {
      code: 'WEB101',
      title: 'Web Development Basics',
      description: 'A practical course for modern web development fundamentals.',
      durationMonths: 3
    }
  });

  const classroom = await prisma.classroom.upsert({
    where: { name: 'Room A' },
    update: { capacity: 24, location: 'First floor' },
    create: { name: 'Room A', capacity: 24, location: 'First floor' }
  });

  const group = await prisma.group.upsert({
    where: { name: 'Web Dev Morning' },
    update: { capacity: 20, monthlyFee: 220, status: 'ACTIVE' },
    create: {
      name: 'Web Dev Morning',
      courseId: course.id,
      teacherId: teacher.id,
      classroomId: classroom.id,
      startDate: new Date(),
      endDate: new Date(new Date().setMonth(new Date().getMonth() + 3)),
      capacity: 20,
      monthlyFee: 220,
      status: 'ACTIVE',
      lessons: {
        create: [
          { weekday: 'MONDAY', startTime: '09:00', endTime: '11:00' },
          { weekday: 'WEDNESDAY', startTime: '09:00', endTime: '11:00' }
        ]
      }
    }
  });

  await prisma.student.upsert({
    where: { studentId: 'STU-001' },
    update: { firstName: 'Ali', lastName: 'Karimov', phone: '+998901112233', groupId: group.id },
    create: {
      studentId: 'STU-001',
      firstName: 'Ali',
      lastName: 'Karimov',
      gender: 'MALE',
      dateOfBirth: new Date('2008-04-14'),
      phone: '+998901112233',
      parentName: 'Nodir Karimov',
      parentPhone: '+998911223344',
      address: 'Tashkent, Uzbekistan',
      status: 'ACTIVE',
      groupId: group.id
    }
  });

  console.log('Database seeded successfully.');
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
