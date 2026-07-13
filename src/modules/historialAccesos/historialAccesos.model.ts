import mongoose from 'mongoose';

const HistorialAccesoSchema = new mongoose.Schema(
  {
    usuario_id: { type: Number, default: null, index: true },
    correo: { type: String, default: null, index: true },
    evento: { type: String, required: true, index: true },
    resultado: {
      type: String,
      enum: ['exitoso', 'fallido'],
      required: true,
      index: true,
    },
    origen: {
      type: String,
      enum: ['web', 'mobile', 'api', 'desconocido'],
      default: 'desconocido',
      index: true,
    },
    ip: { type: String, default: null },
    user_agent: { type: String, default: null },
    motivo: { type: String, default: null },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    collection: 'historial_accesos',
    timestamps: true,
  }
);

export const HistorialAccesoModel = mongoose.model(
  'HistorialAcceso',
  HistorialAccesoSchema
);