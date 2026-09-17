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


function normalizeOrigin(value = '') {
  const clean = String(value || '').trim();

  if (!clean) return '';

  try {
    return new URL(clean).origin;
  } catch {
    return clean.replace(/\/+$/, '');
  }
}


export function createApp() {
  const app = express();

  // Railway / Cloudflare menggunakan reverse proxy.
  app.set('trust proxy', 1);

  app.disable('x-powered-by');

  app.use(requestId);

  app.use(helmet());

  app.use(compression());


  // =========================================================
  // NO CACHE UNTUK API
  // =========================================================

  app.use((req, res, next) => {
    if (String(req.path || '').startsWith(env.apiPrefix)) {
      res.setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
      );

      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }

    next();
  });


  // =========================================================
  // CORS
  // =========================================================

  const allowedOrigins = env.frontendUrls
    .map(normalizeOrigin)
    .filter(Boolean);


  app.use(
    cors({
      origin(origin, callback) {

        // Request server-to-server, health checker, curl,
        // Railway internal check, dan request tanpa Origin.
        if (!origin) {
          return callback(null, true);
        }


        const requestOrigin = normalizeOrigin(origin);


        // Development wildcard jika memang dikonfigurasi.
        if (allowedOrigins.includes('*')) {
          return callback(null, true);
        }


        // Origin Cloudflare / frontend production yang valid.
        if (allowedOrigins.includes(requestOrigin)) {
          return callback(null, true);
        }


        console.warn('[CORS BLOCKED]', {
          receivedOrigin: origin,
          normalizedOrigin: requestOrigin,
          allowedOrigins
        });


        const error = new Error(
          `Origin tidak diizinkan oleh CORS: ${origin}`
        );

        error.statusCode = 403;
        error.code = 'CORS_DENIED';
        error.isOperational = true;

        return callback(error);
      },


      credentials: true,


      methods: [
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'OPTIONS'
      ],


      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Request-ID',
        'X-Requested-With',
        'Accept'
      ],


      exposedHeaders: [
        'X-Request-ID'
      ],


      optionsSuccessStatus: 204
    })
  );


  // =========================================================
  // PARSER
  // =========================================================

  app.use(cookieParser());

  app.use(
    express.json({
      limit: '2mb'
    })
  );

  app.use(
    express.urlencoded({
      extended: true,
      limit: '2mb'
    })
  );


  // =========================================================
  // RATE LIMIT
  // =========================================================

  app.use(globalRateLimit);


  // =========================================================
  // LOGGING
  // =========================================================

  if (env.nodeEnv !== 'test') {
    app.use(
      morgan(
        env.nodeEnv === 'production'
          ? 'combined'
          : 'dev'
      )
    );
  }


  // =========================================================
  // ROOT
  // =========================================================

  app.get('/', (_req, res) =>
    sendSuccess(res, {
      message: `${env.appName} backend aktif.`,

      data: {
        api: env.apiPrefix,
        health: `${env.apiPrefix}/health`,
        environment: env.nodeEnv,
        version: env.appVersion
      }
    })
  );


  // =========================================================
  // API ROUTES
  // =========================================================

  app.use(env.apiPrefix, apiRoutes);


  // =========================================================
  // ERROR HANDLING
  // =========================================================

  app.use(notFound);

  app.use(errorHandler);


  return app;
}