import mongoose from 'mongoose';

const ActividadEmpleadoSchema = new mongoose.Schema(
  {
    usuario_id: {
      type: Number,
      required: true,
      index: true,
    },
    tipo: {
      type: String,
      required: true,
      index: true,
    },
    titulo: {
      type: String,
      required: true,
    },
    descripcion: {
      type: String,
      required: true,
    },
    modulo: {
      type: String,
      required: true,
      index: true,
    },
    origen: {
      type: String,
      default: 'mobile',
    },
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
    collection: 'actividad_empleados',
    timestamps: true,
  }
);

export const ActividadEmpleadoModel = mongoose.model(
  'ActividadEmpleado',
  ActividadEmpleadoSchema
);