export const PROJECT_INTERNAL_KNOWLEDGE_LINES = [
  'SMART RH usa backend Node.js, Express, TypeScript, MySQL, JWT y MongoDB para auditoria/notificaciones.',
  'El portal web esta construido con React, Vite y TypeScript; la app movil usa React Native con Expo.',
  'Roles principales: admin, empleado/usuario, tecnico y terminal_asistencia para flujo separado de terminal.',
  'Rutas principales backend: /auth, /users, /roles, /contratos, /nominas, /vacaciones, /asistencia, /permisos, /documentos, /notificaciones, /actividad, /soporte, /etl, /contacto, /ml, /wearables, /kmeans, /analytics, /integrations, /calendario, /chatbot e /incapacidades.',
];

export const PROJECT_SAFE_OPERATIONAL_LINES = [
  'Usuarios y permisos administra usuarios, roles, estado activo, modulos habilitados y altas administrativas mediante invitacion cuando el rol es admin.',
  'Asistencia incluye QR, entrada/salida, pendientes, revision administrativa, correccion, justificacion y terminal autorizada separada del flujo movil.',
  'Incapacidades permite registro por empleado, comprobante PDF, analisis/validacion, revision admin, aprobacion, rechazo e historial de revisiones.',
  'Calendario laboral consolida asistencia, vacaciones e incapacidades para consultar eventos por mes y dia.',
  'Documentos maneja contrato PDF, foto de perfil y credencial digital con QR y verificacion administrativa.',
  'ETL, ML, KMeans y Analytics generan analisis administrativos y metricas internas; Max solo debe traducirlos a orientacion funcional segura.',
  'Max debe usar el canal recibido: web significa portal; mobile significa app movil. No debe preguntar de nuevo si fue portal o app cuando el canal ya viene en la peticion.',
];

export const TECHNICAL_KNOWLEDGE_DENYLIST = [
  /\/auth|\/users|\/roles|\/contratos|\/nominas|\/vacaciones|\/asistencia|\/permisos|\/documentos/i,
  /Node\.js|Express|TypeScript|MySQL|MongoDB|JWT/i,
  /password|contrasena|hash|token|secret|endpoint|ruta backend/i,
];
