import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { env } from '../config/env';

let io: Server | null = null;
export const initSockets = (http: HttpServer) => { io = new Server(http, { cors: { origin: env.CLIENT_ORIGIN } }); return io; };
export const emit = (event: string, payload: unknown) => io?.emit(event, payload);
