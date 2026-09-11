import express from 'express';
import cors from 'cors';

import { env } from './config/env.js';
import { router as mainRouter } from './routes/index.js';
import { etlRoutes } from './modules/etl/etl.routes.js';

import { notFound } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';

import {
  ensureUploadStructure,
  uploadRoot,
} from './config/storage.js';


export const app = express();


// ============================================================
// ESTRUCTURA DE UPLOADS
// ============================================================

ensureUploadStructure();


// ============================================================
// CORS
//
// CORS_ORIGIN puede contener uno o varios orígenes:
//
// CORS_ORIGIN=http://localhost:5173,https://portal.ejemplo.com
//
// Si está vacío, se permite cualquier origen.
// Esto mantiene compatibilidad con desarrollo local.
//
// Las solicitudes sin encabezado Origin también se permiten,
// lo cual es importante para la app móvil y comunicaciones
// servidor-servidor.
// ============================================================

const allowedOrigins = env.cors.origin
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Apps móviles, Postman y llamadas servidor-servidor
      // pueden no enviar Origin.
      if (!origin) {
        return callback(null, true);
      }

      // Desarrollo local:
      // si no se configuró CORS_ORIGIN, se permite cualquier
      // origen.
      if (allowedOrigins.length === 0) {
        return callback(null, true);
      }

      // Producción:
      // únicamente orígenes autorizados.
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error(`Origen no permitido por CORS: ${origin}`)
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
// JSON
// ============================================================

app.use(
  express.json({
    limit: '15mb',
  })
);


// ============================================================
// FORMULARIOS
//
// Se conserva porque el backend anterior soportaba también
// express.urlencoded.
// ============================================================

app.use(
  express.urlencoded({
    extended: true,
    limit: '15mb',
  })
);


// ============================================================
// ARCHIVOS ESTÁTICOS
// ============================================================

app.use(
  '/uploads',
  express.static(uploadRoot)
);


// ============================================================
// HEALTH CHECK
//
// Será utilizado posteriormente por AWS/Nginx para comprobar
// que el backend se encuentra activo.
// ============================================================

app.get('/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'SMART RH Backend',
  });
});


// ============================================================
// ETL
//
// Se conserva exactamente la ruta que utilizaba server.ts.
// ============================================================

app.use(
  '/etl',
  etlRoutes
);


// ============================================================
// RUTAS PRINCIPALES
// ============================================================

app.use(
  '/',
  mainRouter
);


// ============================================================
// RUTA NO ENCONTRADA
// ============================================================

app.use(notFound);


// ============================================================
// MANEJO GLOBAL DE ERRORES
// ============================================================

app.use(errorHandler);