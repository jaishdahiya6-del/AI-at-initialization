import cron from 'node-cron';
import { env } from '../config/env';
import { collectAll } from '../services/collector';
import { CITIES } from '../utils/cities';
import { predictCity } from '../ml/predict';
import { trainCity } from '../ml/train';
import { ModelMeta } from '../models';
import { logger } from '../utils/logger';

const safe = (name: string, fn: () => Promise<any>) => async () => { try { await fn(); } catch (e: any) { logger.error(`job ${name}: ${e.message}`); } };
export function startJobs() {
  cron.schedule(env.COLLECT_CRON, safe('collect', collectAll));           // weather + pollution + UV + alert evaluation
  cron.schedule(env.PREDICT_CRON, safe('predict', async () => { for (const c of CITIES) await predictCity(c.id); }));
  // Daily model monitoring: retrain models older than 7 days (only cities that already have a ready model).
  cron.schedule(env.MONITOR_CRON, safe('monitor', async () => {
    const old = await ModelMeta.distinct('city', { status: 'ready', trainedAt: { $lt: new Date(Date.now() - 7 * 86400_000) } });
    for (const c of old) await trainCity(c);
  }));
  logger.info('background jobs scheduled');
}
