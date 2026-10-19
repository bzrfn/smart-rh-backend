import {
  deleteStorageObject,
  storageKeyFromPublicPath,
} from '../../config/storage.js';
import { ActividadEmpleadoModel } from '../actividad/actividad.model.js';
import { AuditoriaModel } from '../auditoria/auditoria.model.js';
import { DocumentoGeneradoModel } from '../documentos/documentos.model.js';
import { EventoSistemaModel } from '../eventosSistema/eventosSistema.model.js';
import { HistorialAccesoModel } from '../historialAccesos/historialAccesos.model.js';
import { NotificacionModel } from '../notificaciones/notificaciones.model.js';
import { SoporteTicketModel } from '../soporte/soporte.model.js';

type AccountOwner = {
  id: number;
  correo?: string | null;
  foto_perfil_url?: string | null;
  credencial_url?: string | null;
};

export async function purgeAccountOwnedData(user: AccountOwner) {
  const generatedDocuments = await DocumentoGeneradoModel.find(
    { usuario_id: user.id },
    { archivo_url: 1 }
  ).lean();

  const storageKeys = new Set<string>();
  const candidateUrls = [
    user.foto_perfil_url,
    user.credencial_url,
    ...generatedDocuments.map((document: any) => document.archivo_url),
  ];

  for (const url of candidateUrls) {
    const key = storageKeyFromPublicPath(url);
    if (key) storageKeys.add(key);
  }

  await Promise.all(
    Array.from(storageKeys).map((key) => deleteStorageObject(key))
  );

  const identityQuery = {
    $or: [
      { usuario_id: user.id },
      ...(user.correo ? [{ correo: user.correo }] : []),
    ],
  };

  await Promise.all([
    ActividadEmpleadoModel.deleteMany({ usuario_id: user.id }),
    AuditoriaModel.deleteMany({ usuario_id: user.id }),
    DocumentoGeneradoModel.deleteMany({ usuario_id: user.id }),
    NotificacionModel.deleteMany({ usuario_id: user.id }),
    SoporteTicketModel.deleteMany({ usuario_id: user.id }),
    EventoSistemaModel.deleteMany(identityQuery),
    HistorialAccesoModel.deleteMany(identityQuery),
  ]);
}
