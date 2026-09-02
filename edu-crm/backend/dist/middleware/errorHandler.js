"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const client_1 = require("@prisma/client");
const config_1 = require("../config");
const { nodeEnv } = (0, config_1.getConfig)();
const isProd = nodeEnv === 'production';
function logError(err, req) {
    const ctx = {
        method: req.method,
        path: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('user-agent') || '',
        userId: req.auth?.userId,
        role: req.auth?.role,
    };
    // eslint-disable-next-line no-console
    console.error('[ERROR]', JSON.stringify(ctx));
    // eslint-disable-next-line no-console
    console.error(err.stack || `${err.name}: ${err.message}`);
}
function errorHandler(err, req, res, _next) {
    logError(err, req);
    if (res.headersSent)
        return;
    if (err.status || err.statusCode) {
        const status = err.status || err.statusCode || 400;
        const message = err.expose || !isProd ? err.message : 'Bad request';
        res.status(status).json({ error: message });
        return;
    }
    if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        switch (err.code) {
            case 'P2002':
                res.status(409).json({ error: 'Bunday yozuv allaqachon mavjud' });
                return;
            case 'P2025':
            case 'P2016':
                res.status(404).json({ error: 'Yozuv topilmadi' });
                return;
            case 'P2003':
                res.status(400).json({ error: "Bog'langan yozuv topilmadi (FK xatosi)" });
                return;
            case 'P2000':
                res.status(400).json({ error: "Maydon qiymati juda uzun" });
                return;
            default:
                res.status(400).json({
                    error: isProd ? "Ma'lumotlar bazasi xatosi" : `DB (${err.code}): ${err.message}`,
                });
                return;
        }
    }
    if (err instanceof client_1.Prisma.PrismaClientValidationError) {
        res.status(400).json({
            error: isProd ? "Ma'lumotlar validatsiyasi xatosi" : err.message,
        });
        return;
    }
    if (err instanceof SyntaxError && 'body' in err) {
        res.status(400).json({ error: "Noto'g'ri JSON format" });
        return;
    }
    res.status(500).json({
        error: isProd ? 'Ichki server xatosi' : err.message || 'Internal server error',
    });
}
//# sourceMappingURL=errorHandler.js.map