import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

/** Connects to MongoDB. In development, if it is unreachable, falls back to a TEMPORARY in-memory MongoDB. */
export async function connectDb() {
  try {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 4000 });
    logger.info('MongoDB connected');
    return;
  } catch (e: any) {
    logger.error(`MongoDB connection failed: ${e.message}`);
    if (env.NODE_ENV === 'production') process.exit(1);
  }
  try {
    logger.warn('Starting temporary in-memory MongoDB (first run downloads a MongoDB binary, this can take a few minutes)...');
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mem = await MongoMemoryServer.create();
    await mongoose.connect(mem.getUri('atmosphere_intelligence'));
    logger.warn('Using IN-MEMORY MongoDB: all data is lost when the server stops. Install/start real MongoDB for persistent history and ML training.');
  } catch (e: any) {
    logger.error(`In-memory MongoDB failed: ${e.message}. Start MongoDB (net start MongoDB) or set MONGODB_URI to a MongoDB Atlas URL.`);
    process.exit(1);
  }
}
