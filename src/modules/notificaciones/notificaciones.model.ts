import mongoose from 'mongoose';

const NotificacionSchema = new mongoose.Schema(
  {
    usuario_id: { type: Number, required: true, index: true },
    tipo: { type: String, required: true, index: true },
    titulo: { type: String, required: true },
    mensaje: { type: String, required: true },
    leida: { type: Boolean, default: false, index: true },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  {
    collection: 'notificaciones',
    timestamps: true,
  }
);

export const NotificacionModel = mongoose.model(
  'Notificacion',
  NotificacionSchema
);