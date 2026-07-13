import mongoose from 'mongoose';

const qrLogSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
    },

    fecha_generacion: {
      type: Date,
      required: true,
      default: Date.now,
    },

    fecha_expiracion: {
      type: Date,
      required: true,
      expires: 0,
    },

    usado: {
      type: Boolean,
      default: false,
    },

    usuario_id: {
      type: Number,
      default: null,
    },

    fecha_uso: {
      type: Date,
      default: null,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'qr_logs',
  }
);

qrLogSchema.index({ usuario_id: 1 });

export const QrLogModel = mongoose.model('QrLog', qrLogSchema);