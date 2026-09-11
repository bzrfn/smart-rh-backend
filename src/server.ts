// ============================================================
// SMART RH - SERVER
//
// Punto principal de arranque del backend.
// ============================================================

import { app } from './app.js';

import { env } from './config/env.js';

import {
  connectMongo,
} from './config/mongo/mongo.connection.js';


// ============================================================
// SERVIDOR
// ============================================================

const HOST = '0.0.0.0';

const PORT = env.port;


// ============================================================
// INICIO
// ============================================================

async function startServer(): Promise<void> {
  try {
    // --------------------------------------------------------
    // MONGODB
    //
    // Esperamos el intento de conexión antes de iniciar
    // completamente el servidor.
    //
    // El comportamiento exacto cuando MONGO_URI no existe
    // depende de connectMongo().
    // --------------------------------------------------------

    await connectMongo();


    // --------------------------------------------------------
    // EXPRESS
    // --------------------------------------------------------

    app.listen(
      PORT,
      HOST,
      () => {
        console.log(
          `[SMART RH] Backend iniciado en ${HOST}:${PORT}`
        );

        console.log(
          `[SMART RH] Health check: http://localhost:${PORT}/health`
        );

        console.log(
          `[SMART RH] URL publica configurada: ${env.uploads.publicBaseUrl}`
        );
      }
    );
  } catch (error) {
    console.error(
      '[SMART RH] Error crítico durante el arranque:',
      error
    );

    process.exit(1);
  }
}


// ============================================================
// EJECUTAR
// ============================================================

void startServer();