import mongoose from 'mongoose';
import { env } from '../config/env';
export const connect = () => mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 4000 }).catch((e) => {
  console.error(`MongoDB is not reachable (${e.message}). Start MongoDB first (run: net start MongoDB) or use a MongoDB Atlas URL in .env.`);
  process.exit(1);
});
export const done = async (code = 0) => { await mongoose.disconnect(); process.exit(code); };
