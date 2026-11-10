import winston from 'winston';
import { env } from '../config/env';

const secrets = [env.OPENWEATHER_API_KEY, env.OPENUV_API_KEY, env.JWT_SECRET].filter(Boolean) as string[];
const redact = winston.format((info) => {
  let m = String(info.message);
  for (const s of secrets) m = m.split(s).join('[redacted]');
  info.message = m;
  return info;
});
export const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(redact(), winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console({ silent: env.NODE_ENV === 'test' }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error', silent: env.NODE_ENV === 'test' }),
  ],
});
