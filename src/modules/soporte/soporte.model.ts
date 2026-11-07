import mongoose from 'mongoose';

const SoporteTicketSchema = new mongoose.Schema(
  {
    usuario_id: {
      type: Number,
      required: true,
      index: true,
    },
    categoria: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    titulo: {
      type: String,
      required: true,
      trim: true,
    },
    descripcion: {
      type: String,
      required: true,
      trim: true,
    },
    estado: {
      type: String,
      enum: ['abierto', 'en_revision', 'resuelto', 'cerrado'],
      default: 'abierto',
      index: true,
    },
    prioridad: {
      type: String,
      enum: ['baja', 'media', 'alta'],
      default: 'media',
      index: true,
    },
    respuesta_admin: {
      type: String,
      default: '',
    },
    max_request_key: { type: String },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    collection: 'soporte_tickets',
    timestamps: true,
  }
);

SoporteTicketSchema.index({ max_request_key: 1 }, { unique: true, partialFilterExpression: { max_request_key: { $type: 'string' } } });

export const SoporteTicketModel = mongoose.model(
  'SoporteTicket',
  SoporteTicketSchema
);