import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { getConfig } from '../config';

const { nodeEnv } = getConfig();
const isProd = nodeEnv === 'production';

type AnyError = Error & {
  status?: number;
  statusCode?: number;
  expose?: boolean;
  code?: string;
  body?: unknown;
};

function logError(err: AnyError, req: Request): void {
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

export function errorHandler(
  err: AnyError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  logError(err, req);

  if (res.headersSent) return;

  if (err.status || err.statusCode) {
    const status = err.status || err.statusCode || 400;
    const message = err.expose || !isProd ? err.message : 'Bad request';
    res.status(status).json({ error: message });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
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

  if (err instanceof Prisma.PrismaClientValidationError) {
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

