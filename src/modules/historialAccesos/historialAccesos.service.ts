import mongoose from 'mongoose';
import { HistorialAccesoModel } from './historialAccesos.model.js';
import { RegistrarHistorialAccesoInput } from './historialAccesos.types.js';

export async function registrarHistorialAcceso(data: RegistrarHistorialAccesoInput) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return;
    }

    await HistorialAccesoModel.create({
      usuario_id: data.usuario_id ?? null,
      correo: data.correo ?? null,
      evento: data.evento,
      resultado: data.resultado,
      origen: data.origen ?? 'desconocido',
      ip: data.ip ?? null,
      user_agent: data.user_agent ?? null,
      motivo: data.motivo ?? null,
      metadata: data.metadata ?? {},
    });
  } catch (error) {
    console.error('[MONGO] Error registrando historial_accesos:', error);
  }
}