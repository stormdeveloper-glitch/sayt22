import app from './app';
import { getConfig } from './config';
import prisma from './lib/prisma';

const { port, nodeEnv } = getConfig();

async function shutdown(signal: string, server: any) {
  // eslint-disable-next-line no-console
  console.log(`\n[${signal}] Graceful shutdown boshlandi...`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
      // eslint-disable-next-line no-console
      console.log('[OK] Prisma disconnected');
      process.exit(0);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[FAIL] Shutdown xatosi:', err);
      process.exit(1);
    }
  });
  // 10 soniyadan keyin majburiy o'chirish
  setTimeout(() => {
    // eslint-disable-next-line no-console
    console.error('[TIMEOUT] Shutdown vaqti tugadi, majburiy chiqish');
    process.exit(1);
  }, 10_000).unref();
}

async function bootstrap() {
  let dbConnected = false;
  try {
    await prisma.$connect();
    dbConnected = true;
    // eslint-disable-next-line no-console
    console.log('[OK] Prisma DB ulandi');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[WARN] Prisma ulanib bo'lmadi. DB so'rovlari ishlamaydi, lekin HTTP server ishga tushadi:", (err as Error).message);
  }

  const server = app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(
      `[OK] Edu-CRM server ishlaydi: http://localhost:${port}  (env=${nodeEnv}, db=${dbConnected ? 'online' : 'offline'})`,
    );
    // eslint-disable-next-line no-console
    console.log(`[OK] Health: http://localhost:${port}/health`);
  });

  process.on('SIGTERM', () => shutdown('SIGTERM', server));
  process.on('SIGINT', () => shutdown('SIGINT', server));
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[FATAL] Bootstrap xatosi:', err);
  process.exit(1);
});

