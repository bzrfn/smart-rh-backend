import express from 'express';
import cors from 'cors';
import { router } from './routes/index.js';
import { notFound } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { ensureUploadStructure, uploadRoot } from './config/storage.js';

export const app = express();

// Crea carpetas de uploads si no existen
ensureUploadStructure();

// Habilitar CORS
app.use(cors());

// Middleware para parsear JSON
app.use(
  express.json({
    limit: '15mb',
  })
);

// Servir archivos estáticos de uploads
app.use('/uploads', express.static(uploadRoot));

// Health check
app.get('/health', (_req, res) =>
  res.json({
    ok: true,
  })
);

// Rutas principales
app.use(router);

// Middlewares de error y 404
app.use(notFound);
app.use(errorHandler);