"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importStar(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
require("express-async-errors");
const config_1 = require("./config");
const auth_1 = require("./routes/auth");
const students_1 = require("./routes/students");
const groups_1 = require("./routes/groups");
const teachers_1 = require("./routes/teachers");
const users_1 = require("./routes/users");
const dashboard_1 = require("./routes/dashboard");
const payments_1 = require("./routes/payments");
const attendance_1 = require("./routes/attendance");
const courses_1 = require("./routes/courses");
const classrooms_1 = require("./routes/classrooms");
const errorHandler_1 = require("./middleware/errorHandler");
const prisma_1 = __importDefault(require("./lib/prisma"));
const { corsOrigin, rateLimitWindowMs, rateLimitMax, nodeEnv } = (0, config_1.getConfig)();
const app = (0, express_1.default)();
// Security headers
app.use((0, helmet_1.default)({
    contentSecurityPolicy: nodeEnv === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false,
}));
// Trust proxy (Railway/Vercel kabi xizmatlar uchun)
app.set('trust proxy', 1);
// Global rate limiter (brute force oldini olish)
const limiter = (0, express_rate_limit_1.default)({
    windowMs: rateLimitWindowMs,
    max: rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'So‘rovlar chegarasi etildi. Birozdan keyin qayta urinib ko‘ring.' },
});
app.use('/api/', limiter);
// Auth endpointlari uchun alohida qattiqroq limit (login brute force oldini olish)
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Kirish urinishlari ko'p. 15 daqiqa kuting." },
});
// CORS
app.use((0, cors_1.default)({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
// Body parsers
app.use((0, express_1.json)({ limit: '1mb' }));
app.use((0, express_1.urlencoded)({ extended: true, limit: '1mb' }));
app.use((0, cookie_parser_1.default)());
// HTTP logging
app.use((0, morgan_1.default)(nodeEnv === 'production' ? 'combined' : 'dev'));
// Root health check
app.get('/health', async (_req, res) => {
    let dbStatus = 'connecting';
    let dbError = null;
    try {
        await prisma_1.default.$queryRaw `SELECT 1::int AS ping`.then(() => { dbStatus = 'online'; });
    }
    catch (err) {
        dbStatus = 'offline';
        dbError = err.message;
    }
    res.status(dbStatus === 'online' ? 200 : 503).json({
        status: dbStatus === 'online' ? 'ok' : 'degraded',
        uptime: process.uptime(),
        env: nodeEnv,
        services: {
            http: 'online',
            db: dbStatus,
        },
        ...(dbError && nodeEnv !== 'production' ? { dbError } : {}),
    });
});
// Routelar
app.use('/api/auth', authLimiter, auth_1.authRouter);
app.use('/api/users', users_1.usersRouter);
app.use('/api/students', students_1.studentsRouter);
app.use('/api/groups', groups_1.groupsRouter);
app.use('/api/teachers', teachers_1.teachersRouter);
app.use('/api/dashboard', dashboard_1.dashboardRouter);
app.use('/api/payments', payments_1.paymentRouter);
app.use('/api/attendance', attendance_1.attendanceRouter);
app.use('/api/courses', courses_1.coursesRouter);
app.use('/api/classrooms', classrooms_1.classroomsRouter);
// 404 for API
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: `API endpoint topilmadi: ${req.method} ${req.originalUrl}` });
});
// Global xato handleri (eng oxirida bo'lishi kerak!)
app.use(errorHandler_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map