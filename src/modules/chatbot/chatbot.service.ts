import { crearTicketSoporte } from '../soporte/soporte.service.js';
import { AppError } from '../../utils/AppError.js';
import {
  ChatbotKnowledgeEntry,
  ChatbotResponse,
  ChatbotRole,
} from './chatbot.types.js';

const DEFAULT_SUGGESTIONS = [
  '¿Cómo reviso mi asistencia?',
  '¿Dónde consulto mi calendario laboral?',
  '¿Cómo levanto un ticket de soporte?',
  '¿Dónde veo mis incapacidades?',
];

const ADMIN_SUGGESTIONS = [
  '¿Cómo reviso pendientes de asistencia?',
  '¿Cómo verifico una credencial QR?',
  '¿Cómo reviso incapacidades?',
  '¿Dónde administro usuarios y permisos?',
];

const KNOWLEDGE_BASE: ChatbotKnowledgeEntry[] = [
  {
    id: 'asistencia-empleado',
    categoria: 'Asistencia',
    titulo: 'Consulta y registro de asistencia',
    roles: ['all'],
    keywords: [
      'asistencia',
      'entrada',
      'salida',
      'qr',
      'registro',
      'jornada',
      'checador',
    ],
    respuesta:
      'Para asistencia puedes revisar tu historial, jornada semanal y registrar entrada o salida mediante QR desde la app móvil. Si un registro queda pendiente, el área administrativa puede revisarlo.',
    acciones: [
      {
        label: 'Abrir Asistencia',
        target: 'Asistencia',
        scope: 'both',
      },
      {
        label: 'Abrir Calendario laboral',
        target: 'CalendarioLaboral',
        scope: 'both',
      },
    ],
  },
  {
    id: 'asistencia-admin',
    categoria: 'Asistencia administrativa',
    titulo: 'Pendientes de asistencia',
    roles: ['admin'],
    keywords: [
      'pendientes',
      'corregir asistencia',
      'aprobar asistencia',
      'rechazar asistencia',
      'revision asistencia',
    ],
    respuesta:
      'Como administrador puedes revisar pendientes de asistencia, aprobar, rechazar, justificar o corregir registros desde el panel administrativo móvil o el portal.',
    acciones: [
      {
        label: 'Pendientes de asistencia',
        target: 'AdminAsistenciaPendientes',
        scope: 'mobile',
      },
      {
        label: 'Modulo Asistencia',
        target: '/portal/asistencia',
        scope: 'web',
      },
    ],
  },
  {
    id: 'calendario',
    categoria: 'Calendario laboral',
    titulo: 'Agenda mensual',
    roles: ['all'],
    keywords: [
      'calendario',
      'agenda',
      'mes',
      'eventos',
      'vacaciones calendario',
      'incapacidades calendario',
    ],
    respuesta:
      'El calendario laboral concentra asistencia, vacaciones e incapacidades en una vista mensual. En móvil y portal puedes abrir tarjetas de resumen para revisar los eventos del mes o de un día seleccionado.',
    acciones: [
      {
        label: 'Abrir Calendario laboral',
        target: 'CalendarioLaboral',
        scope: 'both',
      },
    ],
  },
  {
    id: 'vacaciones',
    categoria: 'Vacaciones',
    titulo: 'Solicitudes de vacaciones',
    roles: ['all'],
    keywords: [
      'vacaciones',
      'descanso',
      'dias disponibles',
      'solicitud vacaciones',
      'saldo',
    ],
    respuesta:
      'En Vacaciones puedes consultar días disponibles, enviar solicitudes y dar seguimiento al estado. Los eventos aprobados también aparecen en el calendario laboral.',
    acciones: [
      {
        label: 'Abrir Vacaciones',
        target: 'Vacaciones',
        scope: 'both',
      },
    ],
  },
  {
    id: 'incapacidades',
    categoria: 'Incapacidades',
    titulo: 'Incapacidades inteligentes',
    roles: ['all'],
    keywords: [
      'incapacidad',
      'incapacidades',
      'medica',
      'imss',
      'pdf',
      'comprobante',
      'validacion',
    ],
    respuesta:
      'El modulo de incapacidades permite registrar una incapacidad, adjuntar comprobante y consultar validacion automatica. Administracion puede revisar casos pendientes o con observaciones.',
    acciones: [
      {
        label: 'Abrir Incapacidades',
        target: 'Incapacidades',
        scope: 'both',
      },
      {
        label: 'Revision admin',
        target: 'AdminIncapacidadesRevision',
        scope: 'mobile',
      },
    ],
  },
  {
    id: 'credencial',
    categoria: 'Credencial y documentos',
    titulo: 'Credencial laboral',
    roles: ['all'],
    keywords: [
      'credencial',
      'documentos',
      'contrato',
      'expediente',
      'qr credencial',
      'identificacion',
    ],
    respuesta:
      'En Documentos puedes consultar contrato, expediente y credencial laboral. La credencial digital incluye QR y vigencia. La verificacion administrativa valida identidad, vigencia, usuario y estado.',
    acciones: [
      {
        label: 'Abrir Documentos',
        target: 'Documentos',
        scope: 'both',
      },
      {
        label: 'Verificar credencial QR',
        target: 'VerificarCredencial',
        scope: 'mobile',
      },
    ],
  },
  {
    id: 'nomina',
    categoria: 'Nomina',
    titulo: 'Consulta de nomina',
    roles: ['all'],
    keywords: [
      'nomina',
      'pago',
      'recibo',
      'salario',
      'sueldo',
      'periodo',
    ],
    respuesta:
      'En Nomina puedes consultar periodos, pagos y registros economicos asociados a tu perfil. Si no ves informacion, puede depender de permisos o carga administrativa.',
    acciones: [
      {
        label: 'Abrir Nomina',
        target: 'Nomina',
        scope: 'both',
      },
    ],
  },
  {
    id: 'usuarios-admin',
    categoria: 'Usuarios y permisos',
    titulo: 'Administracion de usuarios',
    roles: ['admin'],
    keywords: [
      'usuarios',
      'permisos',
      'roles',
      'activar usuario',
      'desactivar',
      'admin',
      'accesos',
    ],
    respuesta:
      'Como administrador puedes gestionar usuarios, permisos por modulo, estado de cuenta y accesos. Estos cambios deben realizarse desde las herramientas administrativas, no desde el flujo de empleado.',
    acciones: [
      {
        label: 'Usuarios y permisos',
        target: 'AdminUsuarios',
        scope: 'mobile',
      },
      {
        label: 'Usuarios en portal',
        target: '/portal/usuarios',
        scope: 'web',
      },
    ],
  },
  {
    id: 'soporte',
    categoria: 'Soporte',
    titulo: 'Tickets de soporte',
    roles: ['all'],
    keywords: [
      'soporte',
      'ticket',
      'ayuda',
      'problema',
      'error',
      'incidencia',
      'no puedo',
    ],
    respuesta:
      'Si el asistente no resuelve tu caso, puedes crear un ticket de soporte. El ticket queda registrado con categoria, prioridad, descripcion y seguimiento administrativo.',
    acciones: [
      {
        label: 'Abrir Soporte',
        target: 'Soporte',
        scope: 'both',
      },
    ],
  },
  {
    id: 'terminal-admin',
    categoria: 'Terminal de asistencia',
    titulo: 'Terminal separada del flujo admin movil',
    roles: ['admin'],
    keywords: [
      'terminal',
      'terminal asistencia',
      'autorizacion terminal',
      'qr terminal',
    ],
    respuesta:
      'La Terminal de Asistencia es un flujo separado. Desde el portal administrativo se autoriza el acceso a terminal; no debe mezclarse con herramientas administrativas moviles ni con la verificacion de credenciales.',
    acciones: [
      {
        label: 'Autorizar Terminal',
        target: '/portal/terminal-autorizacion',
        scope: 'web',
      },
    ],
  },
];

function normalizeText(value?: string | null) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeRole(role?: string | null): ChatbotRole {
  const value = normalizeText(role);

  if (value === 'admin') return 'admin';
  if (value === 'tecnico') return 'tecnico';
  if (value === 'usuario') return 'usuario';

  return 'empleado';
}

function canUseEntry(entry: ChatbotKnowledgeEntry, role: ChatbotRole) {
  return entry.roles.includes('all') || entry.roles.includes(role);
}

function scoreEntry(entry: ChatbotKnowledgeEntry, message: string) {
  const searchable = [
    entry.categoria,
    entry.titulo,
    ...entry.keywords,
  ]
    .map(normalizeText)
    .join(' ');

  let score = 0;

  for (const keyword of entry.keywords) {
    const normalizedKeyword = normalizeText(keyword);

    if (message.includes(normalizedKeyword)) {
      score += normalizedKeyword.length > 8 ? 3 : 2;
    }
  }

  for (const word of message.split(/\s+/).filter(Boolean)) {
    if (word.length >= 4 && searchable.includes(word)) {
      score += 1;
    }
  }

  return score;
}

function getSuggestions(role: ChatbotRole) {
  return role === 'admin'
    ? ADMIN_SUGGESTIONS
    : DEFAULT_SUGGESTIONS;
}

export function obtenerSugerenciasChatbot(role?: string | null) {
  const normalizedRole = normalizeRole(role);
  return getSuggestions(normalizedRole);
}

export function responderChatbot(data: {
  role?: string | null;
  mensaje?: string | null;
}): ChatbotResponse {
  const role = normalizeRole(data.role);
  const mensaje = normalizeText(data.mensaje);

  if (!mensaje) {
    throw new AppError('El mensaje es obligatorio', 400);
  }

  const entries = KNOWLEDGE_BASE.filter((entry) =>
    canUseEntry(entry, role)
  );

  const ranked = entries
    .map((entry) => ({
      entry,
      score: scoreEntry(entry, mensaje),
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];

  if (!best || best.score <= 0) {
    return {
      categoria: 'Soporte',
      titulo: 'No encontre una respuesta suficiente',
      respuesta:
        'No tengo una respuesta segura para esa consulta. Puedo ayudarte a crear un ticket de soporte para que el area administrativa lo revise con contexto.',
      acciones: [
        {
          label: 'Crear ticket de soporte',
          target: 'Soporte',
          scope: 'both',
        },
      ],
      sugerencias: getSuggestions(role),
      requiere_escalamiento: true,
      puede_crear_ticket: true,
    };
  }

  return {
    categoria: best.entry.categoria,
    titulo: best.entry.titulo,
    respuesta: best.entry.respuesta,
    acciones: best.entry.acciones,
    sugerencias: getSuggestions(role),
    requiere_escalamiento: false,
    puede_crear_ticket: true,
  };
}

export async function crearTicketDesdeChatbot(data: {
  usuario_id: number;
  mensaje: string;
  respuesta: ChatbotResponse;
}) {
  const mensaje = String(data.mensaje || '').trim();

  if (!mensaje) {
    throw new AppError('El mensaje es obligatorio', 400);
  }

  return crearTicketSoporte({
    usuario_id: data.usuario_id,
    categoria: 'Chatbot SMART RH',
    prioridad: data.respuesta.requiere_escalamiento ? 'media' : 'baja',
    titulo: `Consulta desde asistente: ${data.respuesta.categoria}`.slice(
      0,
      120
    ),
    descripcion: [
      'Consulta registrada desde el asistente SMART RH.',
      '',
      `Pregunta del usuario: ${mensaje}`,
      '',
      `Respuesta entregada: ${data.respuesta.respuesta}`,
    ].join('\n'),
    metadata: {
      origen: 'chatbot',
      categoria_respuesta: data.respuesta.categoria,
      requiere_escalamiento: data.respuesta.requiere_escalamiento,
    },
  });
}
