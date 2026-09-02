"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const router = (0, express_1.Router)();
exports.authRouter = router;
const config = (0, config_1.getConfig)();
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }
    const user = await prisma_1.default.user.findUnique({ where: { email } });
    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    const valid = await bcryptjs_1.default.compare(password, user.password);
    if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role }, config.jwtSecret, {
        expiresIn: config.jwtExpiresIn,
        algorithm: 'HS256',
    });
    return res.json({
        token,
        user: {
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name ?? null,
            phone: user.phone ?? null,
        }
    });
});
//# sourceMappingURL=auth.js.map