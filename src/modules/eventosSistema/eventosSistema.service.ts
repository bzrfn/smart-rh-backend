import mongoose from 'mongoose';
import { EventoSistemaModel } from './eventosSistema.model.js';
import { RegistrarEventoSistemaInput } from './eventosSistema.types.js';

export async function registrarEventoSistema(data: RegistrarEventoSistemaInput) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return;
    }

    await EventoSistemaModel.create({
      tipo: data.tipo,
      usuario_id: data.usuario_id ?? null,
      correo: data.correo ?? null,
      modulo: data.modulo,
      descripcion: data.descripcion,
      resultado: data.resultado,
      metadata: data.metadata ?? {},
    });
  } catch (error) {
    console.error('[MONGO] Error registrando evento_sistema:', error);
  }
}