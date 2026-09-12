import express from 'express';
import cors from 'cors';

import { env } from './config/env.js';

import {
  ensureUploadStructure,
  getStorageDriver,
  readStorageObject,
  uploadRoot,
} from './config/storage.js';

import { router as mainRouter } from './routes/index.js';

import { notFound } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';


export const app = express();


// ============================================================
// ESTRUCTURA DE STORAGE
// ============================================================

ensureUploadStructure();


// ============================================================
// CORS
// ============================================================

const allowedOrigins = env.cors.origin
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);


app.use(
  cors({
    origin(origin, callback) {
      // Apps móviles, Postman y servicios
      // servidor-servidor pueden no enviar Origin.
      if (!origin) {
        return callback(null, true);
      }

      // Desarrollo local.
      if (allowedOrigins.length === 0) {
        return callback(null, true);
      }

      // Producción.
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error(
          `Origen no permitido por CORS: ${origin}`
        )
      );
    },

    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
    ],
  })
);


// ============================================================
// BODY
// ============================================================

app.use(
  express.json({
    limit: '15mb',
  })
);


app.use(
  express.urlencoded({
    extended: true,
    limit: '15mb',
  })
);


// ============================================================
// ARCHIVOS
//
// LOCAL:
//
// /uploads -> express.static
//
// AWS:
//
// /uploads -> Backend -> S3 privado
//
// De esta forma web y móvil pueden conservar las rutas
// existentes aunque el archivo ya no viva en EC2.
// ============================================================

if (getStorageDriver() === 'local') {

  app.use(
    '/uploads',
    express.static(uploadRoot)
  );

} else {

  app.get(
    '/uploads/*',
    async (req, res, next) => {
      try {
        const params =
          req.params as Record<
            string,
            string
          >;

        const key = params['0'];

        if (!key) {
          return res.status(404).json({
            ok: false,
            message:
              'Archivo no encontrado',
          });
        }

        const object =
          await readStorageObject(key);

        if (!object) {
          return res.status(404).json({
            ok: false,
            message:
              'Archivo no encontrado',
          });
        }

        res.setHeader(
          'Content-Type',
          object.contentType
        );

        res.setHeader(
          'Content-Length',
          String(object.body.length)
        );

        // Evitamos que CloudFront almacene
        // documentos laborales indefinidamente.
        res.setHeader(
          'Cache-Control',
          'private, no-store'
        );

        return res.send(object.body);

      } catch (error) {
        return next(error);
      }
    }
  );
}


// ============================================================
// HEALTH CHECK
// ============================================================

app.get('/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'SMART RH Backend',
    storage: getStorageDriver(),
  });
});


// ============================================================
// RUTAS PRINCIPALES
//
// /etl ya forma parte de mainRouter.
// ============================================================

app.use(
  '/',
  mainRouter
);


// ============================================================
// 404
// ============================================================

app.use(notFound);


// ============================================================
// ERROR HANDLER
// ============================================================

app.use(errorHandler);