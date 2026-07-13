// src/server.ts
import express from 'express';
import path from 'path';
import fs from 'fs';
import { env } from './config/env.js';
import { connectMongo } from './config/mongo/mongo.connection.js';
import { router as mainRouter } from './routes/index.js';
import { etlRoutes } from './modules/etl/etl.routes.js';

const app = express();

// Middleware JSON y formularios
// Se aumenta el límite porque la foto de perfil puede viajar como base64 o payload grande.
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

// MongoDB
connectMongo();

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

// Crear carpetas necesarias si no existen
const uploadsRoot = path.join(process.cwd(), 'uploads');

const uploadsFolders = [
  'profiles',
  'documentos',
  'contratos',
  'credenciales',
  'etl',
];

for (const folder of uploadsFolders) {
  const folderPath = path.join(uploadsRoot, folder);

  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
}

// Archivos estáticos públicos
// IMPORTANTE: esto debe ir antes de las rutas principales.
app.use('/uploads', express.static(uploadsRoot));

// Rutas ETL
app.use('/etl', etlRoutes);

// Rutas principales
app.use('/', mainRouter);

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[SERVER ERROR]', err);

  res.status(err.statusCode || err.status || 500).json({
    ok: false,
    message: err.message || 'Error interno del servidor',
  });
});

const HOST = '0.0.0.0';
const PORT = env.port || 4000;

app.listen(PORT, HOST, () => {
  console.log(`[rrhh-backend] running on http://${HOST}:${PORT}`);
  console.log(`[rrhh-backend] uploads enabled → http://localhost:${PORT}/uploads`);
  console.log(`[rrhh-backend] accessible from network → http://192.168.3.48:${PORT}`);
});

export { app };