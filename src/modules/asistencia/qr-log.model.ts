import mongoose from 'mongoose';


const qrUseSchema =
  new mongoose.Schema(
    {
      usuario_id: {
        type: Number,
        required: true,
      },

      fecha_uso: {
        type: Date,
        required: true,
        default: Date.now,
      },
    },
    {
      _id: false,
    }
  );


const qrLogSchema =
  new mongoose.Schema(
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

      // ======================================================
      // VALIDEZ DEL QR
      //
      // Determina hasta cuándo este código puede utilizarse
      // para registrar asistencia.
      // ======================================================

      valido_hasta: {
        type: Date,
        required: true,
      },


      // ======================================================
      // RETENCIÓN DEL REGISTRO
      //
      // No representa la validez para escanear.
      //
      // MongoDB elimina automáticamente el documento cuando
      // llega esta fecha mediante el índice TTL.
      // ======================================================

      fecha_expiracion: {
        type: Date,
        required: true,
        expires: 0,
      },


      // ======================================================
      // USOS
      //
      // Un mismo QR puede ser utilizado por diferentes
      // empleados durante su periodo de vigencia.
      //
      // Cada empleado queda registrado individualmente.
      // ======================================================

      usos: {
        type: [qrUseSchema],
        default: [],
      },


      metadata: {
        type:
          mongoose.Schema.Types.Mixed,

        default: {},
      },
    },
    {
      timestamps: true,

      collection:
        'qr_logs',
    }
  );


qrLogSchema.index({
  'usos.usuario_id': 1,
});


export const QrLogModel =
  mongoose.model(
    'QrLog',
    qrLogSchema
  );
