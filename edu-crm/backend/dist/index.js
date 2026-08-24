"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const config_1 = require("./config");
const prisma_1 = __importDefault(require("./lib/prisma"));
const { port, nodeEnv } = (0, config_1.getConfig)();
async function shutdown(signal, server) {
    // eslint-disable-next-line no-console
    console.log(`\n[${signal}] Graceful shutdown boshlandi...`);
    server.close(async () => {
        try {
            await prisma_1.default.$disconnect();
            // eslint-disable-next-line no-console
            console.log('[OK] Prisma disconnected');
            process.exit(0);
        }
        catch (err) {
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
        await prisma_1.default.$connect();
        dbConnected = true;
        // eslint-disable-next-line no-console
        console.log('[OK] Prisma DB ulandi');
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[WARN] Prisma ulanib bo'lmadi. DB so'rovlari ishlamaydi, lekin HTTP server ishga tushadi:", err.message);
    }
    const server = app_1.default.listen(port, () => {
        // eslint-disable-next-line no-console
        console.log(`[OK] Edu-CRM server ishlaydi: http://localhost:${port}  (env=${nodeEnv}, db=${dbConnected ? 'online' : 'offline'})`);
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
//# sourceMappingURL=index.js.map