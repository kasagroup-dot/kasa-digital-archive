import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { globalRateLimit } from './middleware/rateLimit.js';
import { requestId } from './middleware/requestId.js';
import apiRoutes from './routes/index.js';
import { sendSuccess } from './utils/apiResponse.js';

export function createApp() {
  const app = express();

  // Railway/Cloudflare menggunakan reverse proxy.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(helmet());
  app.use(compression());

  app.use(cors({
    origin(origin, callback) {
      // Request tanpa Origin seperti browser address bar, curl, health checker.
      if (!origin) return callback(null, true);
      if (env.frontendUrls.includes('*')) return callback(null, true);
      if (env.frontendUrls.includes(origin)) return callback(null, true);

      const error = new Error(`Origin tidak diizinkan oleh CORS: ${origin}`);
      error.statusCode = 403;
      error.code = 'CORS_DENIED';
      error.isOperational = true;
      return callback(error);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
  }));

  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(globalRateLimit);

  if (env.nodeEnv !== 'test') {
    app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
  }

  app.get('/', (_req, res) => sendSuccess(res, {
    message: `${env.appName} backend aktif.`,
    data: {
      api: env.apiPrefix,
      health: `${env.apiPrefix}/health`
    }
  }));

  app.use(env.apiPrefix, apiRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
