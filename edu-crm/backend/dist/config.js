"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = getConfig;
const dotenv_1 = __importDefault(require("dotenv"));
const crypto_1 = __importDefault(require("crypto"));
dotenv_1.default.config();
const NODE_ENV = process.env.NODE_ENV || 'development';
function loadJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (secret && secret !== 'change_me' && secret.length >= 32) {
        return secret;
    }
    if (NODE_ENV === 'production') {
        if (!secret || secret === 'change_me') {
            throw new Error('[FATAL] Production muhitda JWT_SECRET majburiy va kamida 32 belgidan iborat bo‘lishi kerak!');
        }
        throw new Error('[FATAL] JWT_SECRET juda qisqa, kamida 32 belgi kerak.');
    }
    if (!secret || secret === 'change_me') {
        const fallback = crypto_1.default.randomBytes(48).toString('hex');
        // eslint-disable-next-line no-console
        console.warn('[WARN] JWT_SECRET sozlanmagan, sessiyalar faqat shu jarayon davomida ishlaydi. Iltimos .env ga JWT_SECRET ni yozing.');
        return fallback;
    }
    return secret;
}
function loadCorsOrigin() {
    const raw = process.env.CORS_ORIGIN;
    if (!raw) {
        return NODE_ENV === 'production' ? [] : '*';
    }
    const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
    return list.length === 1 ? list[0] : list;
}
function getConfig() {
    const databaseUrl = process.env.DATABASE_URL || '';
    if (NODE_ENV === 'production' && !databaseUrl) {
        throw new Error('[FATAL] Production muhitda DATABASE_URL majburiy!');
    }
    return {
        port: Number(process.env.PORT || 4000),
        jwtSecret: loadJwtSecret(),
        jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
        databaseUrl,
        nodeEnv: NODE_ENV,
        corsOrigin: loadCorsOrigin(),
        rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
        rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 100),
    };
}
//# sourceMappingURL=config.js.map