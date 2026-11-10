import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().default(5000),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(16, 'must be at least 16 characters'),
  OPENWEATHER_API_KEY: z.string().min(10).refine((v) => !v.startsWith('YOUR_'), 'still a placeholder'),
  OPENUV_API_KEY: z.string().optional().transform((v) => (v && !v.startsWith('YOUR_') ? v : undefined)),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  CACHE_TTL_SECONDS: z.coerce.number().default(600),
  COLLECT_CRON: z.string().default('*/30 * * * *'),
  PREDICT_CRON: z.string().default('10 * * * *'),
  MONITOR_CRON: z.string().default('30 3 * * *'),
  UV_DAILY_BUDGET: z.coerce.number().default(45),
  JOBS_ENABLED: z.string().default('true').transform((v) => v !== 'false'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Print only field names + reasons, never values.
  console.error('Invalid environment configuration:');
  for (const i of parsed.error.issues) console.error(` - ${i.path.join('.')}: ${i.message}`);
  console.error('Copy .env.example to .env in the project root and fill it in.');
  process.exit(1);
}
export const env = parsed.data;
