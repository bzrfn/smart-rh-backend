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
    id: 'usuarios-permisos-existente',
    categoria: 'Usuarios y permisos',
    roles: ['admin'],
    resumen:
      'Cambio controlado de rol o modulos para un usuario existente sin recrear la cuenta.',
    pasos: [
      'Abrir Usuarios y permisos.',
      'Buscar al usuario por nombre o correo.',
      'Entrar al detalle de la cuenta.',
      'Modificar solo rol o modulos requeridos.',
      'Guardar y pedir nuevo inicio de sesion si el cambio no se refleja.',
    ],
    keywords: ['permisos', 'modulos', 'usuario existente', 'rol', 'sin afectar cuenta'],
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
    id: 'incapacidad-no-visible',
    categoria: 'Incapacidades',
    roles: ['all'],
    resumen:
      'Diagnostico cuando una incapacidad registrada no aparece para el empleado o el administrador.',
    pasos: [
      'Confirmar que la incapacidad existe para el empleado correcto.',
      'Validar comprobante, fechas y estado.',
      'Revisar observaciones de validacion.',
      'Documentar folio, usuario y pantalla si existe pero no se muestra.',
    ],
    keywords: ['no aparece', 'no se muestra', 'no ve incapacidad', 'folio incapacidad'],
  },
  {
    id: 'incapacidad-revision-admin',
    categoria: 'Incapacidades',
    roles: ['admin'],
    resumen:
      'Revision administrativa para aprobar o rechazar incapacidades con evidencia y comentario.',
    pasos: [
      'Filtrar solicitudes pendientes.',
      'Abrir la incapacidad.',
      'Validar empleado, fechas, dias, comprobante y observaciones.',
      'Aprobar o rechazar dejando motivo administrativo.',
    ],
    keywords: ['aprobar incapacidad', 'rechazar incapacidad', 'revision incapacidad'],
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
    id: 'asistencia-empleado',
    categoria: 'Asistencia',
    roles: ['all'],
    resumen:
      'Registro y consulta de asistencia del empleado mediante QR, entrada, salida e historial.',
    pasos: [
      'Abrir Mi asistencia.',
      'Revisar si ya existe registro del dia.',
      'Escanear QR vigente con permiso de camara.',
      'Si el QR falla, validar vigencia, iluminacion y conexion.',
    ],
    keywords: ['mi asistencia', 'qr', 'entrada', 'salida', 'historial asistencia'],
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
  {
    id: 'vacaciones',
    categoria: 'Vacaciones',
    roles: ['all'],
    resumen:
      'Consulta de saldo, solicitud, seguimiento y validacion de vacaciones.',
    pasos: [
      'Abrir Vacaciones.',
      'Consultar dias disponibles.',
      'Capturar fechas de solicitud.',
      'Validar cruces y dar seguimiento al estado.',
    ],
    keywords: ['vacaciones', 'dias disponibles', 'saldo', 'solicitud vacaciones'],
  },
  {
    id: 'nomina',
    categoria: 'Nomina',
    roles: ['all'],
    resumen:
      'Consulta de recibos, periodos y pagos visibles por permiso de nomina.',
    pasos: [
      'Abrir Nomina.',
      'Seleccionar periodo.',
      'Revisar estado y total del recibo.',
      'Reportar periodo faltante con fecha exacta si no aparece.',
    ],
    keywords: ['nomina', 'recibo', 'pago', 'salario', 'periodo'],
  },
  {
    id: 'calendario',
    categoria: 'Calendario laboral',
    roles: ['all'],
    resumen:
      'Vista mensual que consolida asistencia, vacaciones e incapacidades por dia.',
    pasos: [
      'Abrir Calendario laboral.',
      'Seleccionar mes.',
      'Revisar dia o resumen mensual.',
      'Cruzar eventos con el modulo origen si falta informacion.',
    ],
    keywords: ['calendario', 'agenda', 'eventos', 'mes', 'dia'],
  },
  {
    id: 'terminal-admin',
    categoria: 'Terminal de asistencia',
    roles: ['admin'],
    resumen:
      'Autorizacion de terminal de asistencia como flujo administrativo independiente.',
    pasos: [
      'Abrir Autorizar Terminal.',
      'Validar dispositivo y codigo.',
      'Autorizar solo terminales controladas.',
      'Revisar conexion y sesion si la terminal no carga.',
    ],
    keywords: ['terminal', 'autorizar terminal', 'codigo terminal', 'qr terminal'],
  },
];

export function getMaxProjectFlow(flowId: string) {
  return MAX_PROJECT_FLOWS.find((flow) => flow.id === flowId) || null;
}
