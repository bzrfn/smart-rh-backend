import mongoose from 'mongoose';

const EventoSistemaSchema = new mongoose.Schema(
  {
    tipo: { type: String, required: true, index: true },
    usuario_id: { type: Number, default: null, index: true },
    correo: { type: String, default: null, index: true },
    modulo: { type: String, required: true, index: true },
    descripcion: { type: String, required: true },
    resultado: {
      type: String,
      enum: ['exitoso', 'fallido'],
      required: true,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    collection: 'eventos_sistema',
    timestamps: true,
  }
);

export const EventoSistemaModel = mongoose.model(
  'EventoSistema',
  EventoSistemaSchema
);