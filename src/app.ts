import express, {
  NextFunction,
  Request,
  Response,
} from 'express';

import cors from 'cors';

import { env } from './config/env.js';

import {
  ensureUploadStructure,
  getStorageDriver,
  normalizeStorageKey,
  readStorageObject,
} from './config/storage.js';

import {
  authJwt,
} from './middlewares/authJwt.js';

import {
  authorizeUploadAccess,
} from './middlewares/authorizeUploadAccess.js';

import {
  router as mainRouter,
} from './routes/index.js';

import {
  notFound,
} from './middlewares/notFound.js';

import {
  errorHandler,
} from './middlewares/errorHandler.js';


export const app = express();


// ============================================================
// HARDENING HTTP
// ============================================================

// Evita exponer innecesariamente que el backend utiliza Express.
app.disable('x-powered-by');


// Nginx local -> Express.
// Solo se confia por defecto en proxies de loopback.
app.set(
  'trust proxy',
  env.trustProxy
);


// ============================================================
// ESTRUCTURA DE STORAGE
// ============================================================

ensureUploadStructure();


// ============================================================
// CORS
// ============================================================

const allowedOrigins =
  env.cors.origin
    .split(',')
    .map(
      (origin) =>
        origin.trim()
    )
    .filter(Boolean);


app.use(
  cors({
    origin(
      origin,
      callback
    ) {
      // Aplicaciones móviles, Postman y llamadas
      // servidor-servidor pueden no enviar Origin.
      if (!origin) {
        return callback(
          null,
          true
        );
      }

      // Desarrollo local.
      if (
        allowedOrigins.length === 0
      ) {
        return callback(
          null,
          true
        );
      }

      // Producción.
      if (
        allowedOrigins.includes(
          origin
        )
      ) {
        return callback(
          null,
          true
        );
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
// ENVÍO DE OBJETOS DE STORAGE
// ============================================================

async function sendStorageObject(
  key: string,
  res: Response,
  next: NextFunction,
  cacheControl:
    | 'private'
    | 'public'
) {
  try {
    const object =
      await readStorageObject(
        key
      );

    if (!object) {
      return res
        .status(404)
        .json({
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
      String(
        object.body.length
      )
    );

    res.setHeader(
      'X-Content-Type-Options',
      'nosniff'
    );

    if (
      cacheControl ===
      'public'
    ) {
      res.setHeader(
        'Cache-Control',
        'public, max-age=3600'
      );
    } else {
      res.setHeader(
        'Cache-Control',
        'private, no-store'
      );

      res.setHeader(
        'Pragma',
        'no-cache'
      );

      res.setHeader(
        'Vary',
        'Authorization'
      );
    }

    return res.send(
      object.body
    );
  } catch (error) {
    return next(error);
  }
}


// ============================================================
// ARCHIVO PÚBLICO CORPORATIVO
// ============================================================
//
// Únicamente el logo corporativo se publica sin autenticación.
//
// Ningún perfil, contrato, credencial o documento laboral
// debe agregarse aquí.
// ============================================================

app.get(
  '/uploads/empresa/logo-smart-rh.jpeg',
  async (
    _req,
    res,
    next
  ) => {
    return sendStorageObject(
      'empresa/logo-smart-rh.jpeg',
      res,
      next,
      'public'
    );
  }
);


// ============================================================
// ARCHIVOS PRIVADOS
// ============================================================
//
// Flujo:
//
// request
//   ↓
// authJwt
//   ↓
// authorizeUploadAccess
//   ↓
// storage local / S3 privado
//
// La misma política aplica en desarrollo y producción.
// ============================================================

app.get(
  '/uploads/*',

  authJwt,

  authorizeUploadAccess,

  async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const params =
      req.params as Record<
        string,
        string
      >;

    const rawKey =
      params['0'];

    if (!rawKey) {
      return res
        .status(404)
        .json({
          ok: false,
          message:
            'Archivo no encontrado',
        });
    }

    let key: string;

    try {
      key =
        normalizeStorageKey(
          rawKey
        );
    } catch {
      return res
        .status(400)
        .json({
          ok: false,
          message:
            'Ruta de archivo inválida',
        });
    }

    return sendStorageObject(
      key,
      res,
      next,
      'private'
    );
  }
);


// ============================================================
// HEALTH CHECK
// ============================================================

app.get(
  '/health',
  (_req, res) => {
    res
      .status(200)
      .json({
        ok: true,
        service:
          'SMART RH Backend',
        storage:
          getStorageDriver(),
      });
  }
);


// ============================================================
// RUTAS PRINCIPALES
// ============================================================

app.use(
  '/',
  mainRouter
);


// ============================================================
// 404
// ============================================================

app.use(
  notFound
);


// ============================================================
// ERROR HANDLER
// ============================================================

app.use(
  errorHandler
);
