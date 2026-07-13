import mongoose from 'mongoose';
import { ActividadEmpleadoModel } from './actividad.model.js';

const TTL_DAYS = 60;

function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

function getExpirationDate() {
  return new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);
}

export async function registrarActividadEmpleado(data: {
  usuario_id: number;
  tipo: string;
  titulo: string;
  descripcion: string;
  modulo: string;
  origen?: string;
  metadata?: Record<string, any>;
}) {
  try {
    if (!isMongoConnected()) return null;

    const actividad = await ActividadEmpleadoModel.create({
      usuario_id: data.usuario_id,
      tipo: data.tipo,
      titulo: data.titulo,
      descripcion: data.descripcion,
      modulo: data.modulo,
      origen: data.origen || 'mobile',
      metadata: data.metadata || {},
      expiresAt: getExpirationDate(),
    });

    return actividad;
  } catch (error) {
    console.error('[MONGO] Error registrando actividad del empleado:', error);
    return null;
  }
}

export async function obtenerActividadEmpleado(usuario_id: number) {
  try {
    if (!isMongoConnected()) return [];

    return await ActividadEmpleadoModel.find({
      usuario_id,
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
  } catch (error) {
    console.error('[MONGO] Error obteniendo actividad del empleado:', error);
    return [];
  }
}