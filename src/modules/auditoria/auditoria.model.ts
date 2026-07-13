import mongoose from 'mongoose';

const auditoriaSchema = new mongoose.Schema(
  {
    usuario_id: Number,
    modulo: { type: String, required: true },
    accion: { type: String, required: true },
    descripcion: { type: String, required: true },
    ip: String,
    metadata: Object,
  },
  { timestamps: true, collection: 'auditoria' }
);

export const AuditoriaModel = mongoose.model('Auditoria', auditoriaSchema);
