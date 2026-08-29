import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getConfig } from '../config';

const config = getConfig();

export type JwtPayload = {
  userId: number;
  role: 'ADMIN' | 'MANAGER' | 'TEACHER' | 'CASHIER' | (string & {});
};

declare global {
  namespace Express {
    interface Request {
      auth?: JwtPayload;
    }
  }
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.split(' ')[1] || null;
  }
  const cookie = req.cookies?.token;
  if (typeof cookie === 'string' && cookie) return cookie;
  return null;
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: token talab qilinadi' });
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret, {
      algorithms: ['HS256'],
    }) as JwtPayload;
    if (!payload || typeof payload.userId !== 'number' || !payload.role) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }
    req.auth = payload;
    return next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token muddati tugagan' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function authorize(roles: JwtPayload['role'][]) {
  return (req: Request, res: Response, next: NextFunction) => {
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

export function issueToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as any,
    algorithm: 'HS256',
  });
}
