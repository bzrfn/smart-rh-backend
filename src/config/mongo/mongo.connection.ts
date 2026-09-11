import mongoose from 'mongoose';
import { env } from '../env.js';

export async function connectMongo(): Promise<void> {
  // ==========================================================
  // MONGODB DESHABILITADO
  // ==========================================================

  if (!env.mongo.uri) {
    console.log(
      '[MONGO] MONGO_URI no configurado. MongoDB queda deshabilitado.'
    );

    return;
  }

  // ==========================================================
  // CONEXION
  // ==========================================================

  try {
    await mongoose.connect(
      env.mongo.uri,
      {
        dbName: env.mongo.database,
        serverSelectionTimeoutMS: 10000,
      }
    );

    console.log(
      `[MONGO] Connected → ${env.mongo.database}`
    );
  } catch (error) {
    console.error(
      '[MONGO] Connection error:',
      error
    );

    throw error;
  }
}