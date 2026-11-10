import http from 'http';
import mongoose from 'mongoose';
import { env } from './config/env';
import { app } from './app';
import { initSockets } from './sockets';
import { startJobs } from './jobs';
import { logger } from './utils/logger';
import { connectDb } from './config/db';

(async () => {
  await connectDb();
  const server = http.createServer(app);
  initSockets(server);
  server.listen(env.PORT, () => logger.info(`API listening on :${env.PORT}`));
  if (env.JOBS_ENABLED) { startJobs(); }
  process.on('SIGINT', async () => { await mongoose.disconnect(); process.exit(0); });
})();
