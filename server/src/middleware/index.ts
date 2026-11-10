import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { ProviderError } from '../services/provider';

export interface AuthReq extends Request { userId?: string }
export const signToken = (id: string) => jwt.sign({ sub: id }, env.JWT_SECRET, { expiresIn: '7d' });
export function requireAuth(req: AuthReq, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Login required' });
  try { req.userId = (jwt.verify(h.slice(7), env.JWT_SECRET) as any).sub; next(); }
  catch { res.status(401).json({ error: 'Session expired. Log in again.' }); }
}
export const wrap = (fn: (req: AuthReq, res: Response) => Promise<any>) => (req: AuthReq, res: Response, next: NextFunction) => fn(req, res).catch(next);
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) return res.status(400).json({ error: 'Invalid input', details: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`) });
  if (err instanceof ProviderError) return res.status(err.status).json({ error: err.message });
  if (err?.code === 11000) return res.status(409).json({ error: 'Already exists' });
  logger.error(`${err?.message}\n${err?.stack}`);
  res.status(500).json({ error: 'Internal server error' });
}
