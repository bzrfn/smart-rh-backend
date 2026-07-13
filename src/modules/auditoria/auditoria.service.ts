import { AuditoriaModel } from './auditoria.model.js';

type AuditoriaPayload = {
  usuario_id?: number;
  modulo: string;
  accion: string;
  descripcion: string;
  ip?: string;
  metadata?: object;
};

export async function registrarAuditoria(data: AuditoriaPayload) {
  try {
    await AuditoriaModel.create(data);
  } catch (error) {
    console.error('[AUDITORIA] No se pudo registrar auditoría:', error);
  }
}
