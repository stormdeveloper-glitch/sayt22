"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.authorize = authorize;
exports.issueToken = issueToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const config = (0, config_1.getConfig)();
function extractToken(req) {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
        return header.split(' ')[1] || null;
    }
    const cookie = req.cookies?.token;
    if (typeof cookie === 'string' && cookie)
        return cookie;
    return null;
}
function authenticate(req, res, next) {
    const token = extractToken(req);
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: token talab qilinadi' });
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, config.jwtSecret, {
            algorithms: ['HS256'],
        });
        if (!payload || typeof payload.userId !== 'number' || !payload.role) {
            return res.status(401).json({ error: 'Invalid token payload' });
        }
        req.auth = payload;
        return next();
    }
    catch (err) {
        if (err instanceof jsonwebtoken_1.default.TokenExpiredError) {
            return res.status(401).json({ error: 'Token muddati tugagan' });
        }
        return res.status(401).json({ error: 'Invalid token' });
    }
}
function authorize(roles) {
    return (req, res, next) => {
        if (!req.auth) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!roles.includes(req.auth.role)) {
            return res.status(403).json({
                error: `Forbidden: ${roles.join(', ')} huquqlaridan biriga ega bo‘lishingiz kerak`,
            });
        }
        return next();
    };
}
function issueToken(payload) {
    return jsonwebtoken_1.default.sign(payload, config.jwtSecret, {
        expiresIn: config.jwtExpiresIn,
        algorithm: 'HS256',
    });
}
//# sourceMappingURL=auth.js.map