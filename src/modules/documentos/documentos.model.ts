import mongoose from 'mongoose';

const documentosGeneradosSchema = new mongoose.Schema(
  {
    usuario_id: { type: Number, required: true },
    tipo: { type: String, required: true },
    archivo_url: { type: String, required: true },
    generado_por: Number,
    estatus: { type: String, default: 'GENERADO' },
    metadata: Object,
  },
  { timestamps: true, collection: 'documentos_generados' }
);

export const DocumentoGeneradoModel = mongoose.model('DocumentoGenerado', documentosGeneradosSchema);
