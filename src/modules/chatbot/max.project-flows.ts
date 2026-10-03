import type { ChatbotRole } from './chatbot.types.js';

export type MaxProjectFlow = {
  id: string;
  categoria: string;
  roles: Array<ChatbotRole | 'all'>;
  resumen: string;
  pasos: string[];
  keywords: string[];
};

export const MAX_PROJECT_FLOWS: MaxProjectFlow[] = [
  {
    id: 'usuarios-admin',
    categoria: 'Usuarios y permisos',
    roles: ['admin'],
    resumen:
      'Alta, invitacion, cambio de rol y permisos de usuarios desde herramientas administrativas.',
    pasos: [
      'Abrir Usuarios y permisos.',
      'Crear o seleccionar usuario.',
      'Asignar rol y modulos necesarios.',
      'Enviar invitacion o guardar cambios.',
      'Pedir cierre e inicio de sesion si el permiso no aparece.',
    ],
    keywords: ['usuario', 'usuarios', 'permiso', 'permisos', 'admin', 'invitacion'],
  },
  {
    id: 'incapacidades',
    categoria: 'Incapacidades',
    roles: ['all'],
    resumen:
      'Registro, validacion, revision, aprobacion y rechazo de incapacidades con comprobante.',
    pasos: [
      'Revisar solicitud pendiente.',
      'Validar empleado, fechas y comprobante.',
      'Consultar observaciones de validacion.',
      'Aprobar, rechazar o solicitar correccion.',
    ],
    keywords: ['incapacidad', 'incapacidades', 'comprobante', 'aprobar', 'rechazar'],
  },
  {
    id: 'asistencia-admin',
    categoria: 'Asistencia administrativa',
    roles: ['admin'],
    resumen:
      'Revision administrativa de pendientes, correcciones y justificaciones de asistencia.',
    pasos: [
      'Abrir pendientes de asistencia.',
      'Revisar empleado, fecha y evidencia.',
      'Aprobar solo registros consistentes.',
      'Rechazar o solicitar correccion si falta evidencia.',
    ],
    keywords: ['asistencia', 'pendientes', 'entrada', 'salida', 'justificar'],
  },
  {
    id: 'credencial',
    categoria: 'Credencial y documentos',
    roles: ['all'],
    resumen:
      'Consulta de documentos laborales, contrato cargado, expediente y validacion de credencial.',
    pasos: [
      'Abrir documentos o verificador de credencial.',
      'Revisar contrato, expediente o QR segun el caso.',
      'Confirmar vigencia y estado del usuario.',
      'Solicitar actualizacion si el documento no aparece o esta vencido.',
    ],
    keywords: ['credencial', 'documentos', 'contrato', 'expediente', 'qr'],
  },
];

export function getMaxProjectFlow(flowId: string) {
  return MAX_PROJECT_FLOWS.find((flow) => flow.id === flowId) || null;
}
