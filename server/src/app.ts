import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { router } from './routes';
import { errorHandler } from './middleware';

export const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN }));
app.use(express.json({ limit: '100kb' }));
app.use('/api', rateLimit({ windowMs: 15 * 60_000, limit: 600, standardHeaders: true, legacyHeaders: false }));
app.use('/api', (_req, res, next) => { res.setTimeout(60_000, () => res.status(503).json({ error: 'Request timed out' })); next(); });
app.use('/api', router);
app.use((_q, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);
