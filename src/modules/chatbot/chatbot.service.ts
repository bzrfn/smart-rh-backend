import {
  ChatbotAction,
  ChatbotChannel,
  ChatbotKnowledgeEntry,
  ChatbotMessageContext,
  ChatbotResponse,
  ChatbotRole,
} from './chatbot.types.js';
import { crearTicketSoporte } from '../soporte/soporte.service.js';
import { AppError } from '../../utils/AppError.js';

const ASSISTANT_NAME = 'Max';

const DEFAULT_SUGGESTIONS = [
  'Tengo un problema',
  'Vacaciones',
  'Asistencia',
  'Documentos',
];

const ADMIN_SUGGESTIONS = [
  'Tengo un problema',
  'Pendientes',
  'Incapacidades',
  'Asistencia',
];

const GREETING_WORDS = [
  'hola',
  'buen dia',
  'buenas',
  'que tal',
  'hey',
  'saludos',
];

const THANKS_WORDS = [
  'gracias',
  'muchas gracias',
  'te agradezco',
  'perfecto',
  'listo',
];

const PROBLEM_WORDS = [
  'problema',
  'error',
  'falla',
  'fallo',
  'no puedo',
  'no me deja',
  'no funciona',
  'no entiendo',
  'ayuda',
  'atorado',
  'atorada',
  'duda',
  'confundido',
  'confundida',
  'crear',
  'solicitar',
];

const DOMAIN_WORDS = [
  'smart rh',
  'portal',
  'app',
  'movil',
  'asistencia',
  'vacaciones',
  'incapacidad',
  'incapacidades',
  'credencial',
  'documentos',
  'nomina',
  'perfil',
  'usuarios',
  'permisos',
];

const LEARNING_WORDS = [
  'aprende',
  'aprendizaje',
  'inteligencia',
  'inteligente',
  'conversacional',
  'contexto',
  'mejorar',
  'mejora',
];

const KNOWLEDGE_BASE: ChatbotKnowledgeEntry[] = [
  {
    id: 'login-acceso',
    categoria: 'Acceso',
    titulo: 'Problemas para iniciar sesion',
    roles: ['all'],
    keywords: [
      'login',
      'iniciar sesion',
      'acceso',
      'credenciales',
      'codigo',
      'correo',
      'contrasena',
      'password',
      'credenciales incorrectas',
      'no puedo entrar',
    ],
    respuesta:
      'Entiendo. Si el acceso marca credenciales incorrectas o no avanza, revisa primero que estes usando el flujo correcto y que el backend sea el ambiente esperado. En portal administrativo debe pasar por codigo de acceso cuando aplique; en movil debe consumir la API configurada en EXPO_PUBLIC_API_URL.',
    pasos: [
      'Confirma que el correo este escrito completo y sin espacios.',
      'Verifica que la app o portal apunte a https://api.smart-rh.com.mx cuando estes validando produccion.',
      'Si estas en desarrollo local, confirma que el backend este levantado y que el celular alcance esa red.',
      'Si el error continua, levanta un ticket con el correo usado y la pantalla donde ocurre.',
    ],
    preguntas_seguimiento: [
      'El error aparece en portal o en app movil?',
      'Estas probando contra produccion o backend local?',
      'Te aparece codigo de acceso o falla antes de llegar ahi?',
    ],
    acciones: [
      {
        label: 'Abrir soporte',
        target: 'Soporte',
        scope: 'both',
      },
    ],
  },
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
      'retardo',
      'faltas',
    ],
    respuesta:
      'Para asistencia puedes revisar historial, jornada semanal y registros de entrada o salida. Si el QR no funciona, conviene validar permiso de camara, vigencia del QR y conexion con la API antes de generar un reporte.',
    pasos: [
      'Abre Mi asistencia para revisar si ya existe registro del dia.',
      'Si vas a escanear QR, confirma permiso de camara y buena iluminacion.',
      'Si el QR esta vencido, solicita uno nuevo o espera a que la terminal lo regenere.',
      'Si existe registro pendiente, el administrador puede revisarlo desde Pendientes de asistencia.',
    ],
    preguntas_seguimiento: [
      'El problema es al escanear QR o al consultar historial?',
      'Te marca QR vencido, no autorizado o simplemente no responde?',
    ],
    acciones: [
      {
        label: 'Abrir asistencia',
        target: 'Asistencia',
        scope: 'both',
      },
      {
        label: 'Abrir calendario laboral',
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
      'justificar asistencia',
      'asistencia pendiente',
    ],
    respuesta:
      'Como administrador puedes revisar pendientes de asistencia, validar el caso, aprobar, rechazar o dejar seguimiento. Max puede orientarte sobre el flujo, pero los cambios se hacen desde la herramienta administrativa protegida por rol.',
    pasos: [
      'Entra a Pendientes de asistencia desde el panel admin movil o portal.',
      'Revisa empleado, fecha, tipo de registro y evidencia disponible.',
      'Aprueba solo si el registro corresponde a la jornada real.',
      'Rechaza o solicita correccion cuando falte evidencia o exista inconsistencia.',
    ],
    preguntas_seguimiento: [
      'Quieres revisar pendientes generales o un empleado especifico?',
      'El problema es aprobar, rechazar o que no carga la lista?',
    ],
    acciones: [
      {
        label: 'Pendientes de asistencia',
        target: 'AdminAsistenciaPendientes',
        scope: 'mobile',
      },
      {
        label: 'Modulo asistencia',
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
      'resumen mensual',
      'dia',
    ],
    respuesta:
      'El calendario laboral concentra asistencia, vacaciones e incapacidades. Sirve para entender que ocurre en un dia o en todo el mes sin revisar cada modulo por separado.',
    pasos: [
      'Selecciona el mes que quieres revisar.',
      'Toca un dia para ver sus eventos asociados.',
      'Usa el resumen mensual para distinguir asistencia, vacaciones e incapacidades.',
      'Si algo no aparece, revisa si el evento ya fue aprobado o si pertenece a otro periodo.',
    ],
    preguntas_seguimiento: [
      'Quieres revisar eventos de un dia o el resumen del mes?',
      'Buscas asistencia, vacaciones o incapacidades?',
    ],
    acciones: [
      {
        label: 'Abrir calendario laboral',
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
      'crear vacaciones',
      'periodo de vacaciones',
      'apartado vacaciones',
      'no entiendo vacaciones',
      'saldo',
      'periodo vacacional',
    ],
    respuesta:
      'En vacaciones puedes consultar dias disponibles, enviar solicitudes y dar seguimiento al estado. Si ya fueron aprobadas, tambien deben verse reflejadas en el calendario laboral.',
    pasos: [
      'Revisa tu saldo disponible antes de solicitar.',
      'Captura fechas de inicio y fin.',
      'Valida que no exista cruce con incapacidades u otro periodo aprobado.',
      'Da seguimiento al estado de la solicitud.',
    ],
    preguntas_seguimiento: [
      'Quieres consultar saldo o crear una solicitud?',
      'La solicitud no aparece o fue rechazada?',
    ],
    acciones: [
      {
        label: 'Abrir vacaciones',
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
      'revisar incapacidad',
      'adjunto',
      'archivo',
    ],
    respuesta:
      'El modulo de incapacidades permite registrar una incapacidad, adjuntar comprobante y consultar validacion automatica. Si hay observaciones, el administrador debe revisar la informacion antes de aprobar o rechazar.',
    pasos: [
      'Confirma que el archivo adjunto sea legible y corresponda al empleado.',
      'Revisa fechas de inicio, fin y dias calculados.',
      'Consulta la validacion automatica para detectar inconsistencias.',
      'Si requiere seguimiento humano, crea ticket o solicita revision administrativa.',
    ],
    preguntas_seguimiento: [
      'El problema es al registrar, adjuntar archivo o revisar el resultado?',
      'La incapacidad aparece pendiente, aprobada, rechazada o con observaciones?',
    ],
    acciones: [
      {
        label: 'Abrir incapacidades',
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
      'vigencia',
      'validar credencial',
    ],
    respuesta:
      'En documentos puedes consultar contrato, expediente y credencial laboral. La credencial digital incluye QR y vigencia; la validacion administrativa confirma identidad, usuario, estado y fecha de expiracion.',
    pasos: [
      'Abre Documentos para consultar credencial o expediente.',
      'Si eres admin, usa Verificar credencial QR para validar una credencial de empleado.',
      'Si marca vencida o invalida, solicita renovacion o revisa el estado del usuario.',
    ],
    preguntas_seguimiento: [
      'Quieres consultar tu credencial o verificar la de un empleado?',
      'El resultado fue valida, vencida, invalida o no autorizada?',
    ],
    acciones: [
      {
        label: 'Abrir documentos',
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
      'comprobante de pago',
    ],
    respuesta:
      'En nomina puedes consultar periodos, pagos y registros economicos asociados a tu perfil. Si no ves informacion, puede depender de permisos, periodo cargado o datos administrativos pendientes.',
    pasos: [
      'Abre Nomina y revisa el periodo seleccionado.',
      'Confirma que tu usuario tenga permiso de nomina activo.',
      'Si falta un recibo, solicita revision administrativa con periodo y fecha de pago.',
    ],
    preguntas_seguimiento: [
      'No ves ningun recibo o falta un periodo especifico?',
      'Estas revisando como empleado o administrador?',
    ],
    acciones: [
      {
        label: 'Abrir nomina',
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
      'crear usuario',
    ],
    respuesta:
      'Como administrador puedes gestionar usuarios, permisos por modulo, estado de cuenta y accesos. Max puede ayudarte a decidir que revisar antes de cambiar permisos.',
    pasos: [
      'Identifica el usuario y confirma su rol actual.',
      'Revisa que modulos necesita segun su actividad.',
      'Activa solo permisos necesarios y evita mezclar herramientas admin con flujo de empleado.',
      'Guarda cambios y pide al usuario cerrar e iniciar sesion si no ve el permiso.',
    ],
    preguntas_seguimiento: [
      'Quieres crear usuario, activar cuenta o ajustar permisos?',
      'El usuario es empleado, admin o tecnico?',
    ],
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
      'reporte',
      'seguimiento',
    ],
    respuesta:
      'Primero revisamos el caso con pasos concretos. Si despues de intentar el diagnostico no queda resuelto, Max puede crear un ticket con el contexto de la conversacion para que soporte o administracion lo revise.',
    pasos: [
      'Describe que estabas intentando hacer.',
      'Indica si ocurrio en portal o app movil.',
      'Agrega el mensaje exacto de error si existe.',
      'Si no se resuelve con el diagnostico, crea el ticket para dejar evidencia y seguimiento.',
    ],
    preguntas_seguimiento: [
      'Quieres que cree un ticket con esta conversacion?',
      'El problema bloquea tu trabajo o solo es una duda?',
    ],
    acciones: [
      {
        label: 'Abrir soporte',
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
      'autorizar terminal',
    ],
    respuesta:
      'La Terminal de Asistencia es un flujo separado. Se autoriza desde el portal administrativo y no debe mezclarse con herramientas administrativas moviles ni con la verificacion de credenciales.',
    pasos: [
      'Abre Autorizar Terminal en el portal.',
      'Valida que el dispositivo y codigo correspondan a la terminal esperada.',
      'Autoriza solo terminales controladas por la empresa.',
      'Si la terminal no carga, revisa conexion y sesion autorizada.',
    ],
    preguntas_seguimiento: [
      'Necesitas autorizar una terminal o resolver un error de la terminal?',
      'La terminal muestra codigo de autorizacion o pantalla en blanco?',
    ],
    acciones: [
      {
        label: 'Autorizar terminal',
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

function compactText(value?: string | null) {
  return normalizeText(value).replace(/\s+/g, ' ');
}

function normalizeChannel(value?: string | null): ChatbotChannel {
  const channel = normalizeText(value);

  if (['mobile', 'movil', 'app', 'ios', 'android'].includes(channel)) {
    return 'mobile';
  }

  return 'web';
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

function hasAny(message: string, words: string[]) {
  return words.some((word) => message.includes(normalizeText(word)));
}

function getSuggestions(role: ChatbotRole) {
  return role === 'admin'
    ? ADMIN_SUGGESTIONS
    : DEFAULT_SUGGESTIONS;
}

function buildSearchText(entry: ChatbotKnowledgeEntry) {
  return [
    entry.categoria,
    entry.titulo,
    entry.respuesta,
    ...entry.keywords,
    ...entry.pasos,
  ]
    .map(normalizeText)
    .join(' ');
}

function scoreEntry(entry: ChatbotKnowledgeEntry, message: string) {
  const searchable = buildSearchText(entry);
  let score = 0;

  for (const keyword of entry.keywords) {
    const normalizedKeyword = normalizeText(keyword);

    if (normalizedKeyword && message.includes(normalizedKeyword)) {
      score += normalizedKeyword.length > 10 ? 5 : 3;
    }
  }

  const words = message.split(/\s+/).filter((word) => word.length >= 4);

  for (const word of words) {
    if (searchable.includes(word)) {
      score += 1;
    }
  }

  if (hasAny(message, PROBLEM_WORDS)) {
    score += entry.id === 'soporte' ? 2 : 0;
  }

  return score;
}

function buildContextMessage(
  message: string,
  historial?: ChatbotMessageContext[]
) {
  const recentContext = (historial || [])
    .slice(-4)
    .map((item) => item.text)
    .filter(Boolean)
    .map(compactText)
    .join(' ');

  return compactText([recentContext, message].filter(Boolean).join(' '));
}

function confidenceFromScore(score: number): ChatbotResponse['confianza'] {
  if (score >= 18) return 'alta';
  if (score >= 9) return 'media';
  return 'baja';
}

function buildConversationResponse(
  role: ChatbotRole,
  message: string,
  channel: ChatbotChannel
): ChatbotResponse | null {
  if (hasAny(message, THANKS_WORDS)) {
    return {
      asistente: ASSISTANT_NAME,
      categoria: 'Conversacion',
      titulo: 'Seguimos atentos',
      intent: 'agradecimiento',
      confianza: 'alta',
      respuesta:
        'Con gusto. Me quedo contigo por si quieres revisar otro punto. Si algo no queda claro, seguimos desde lo que ya me contaste para no empezar de cero.',
      pasos: [],
      preguntas_seguimiento: [
        'Quieres revisar otro tema?',
        channel === 'mobile'
          ? 'Seguimos con algo de la app movil?'
          : 'Seguimos con algo del portal web?',
      ],
      acciones: [
        {
          label: 'Abrir soporte',
          target: 'Soporte',
          scope: 'both',
        },
      ],
      sugerencias: getSuggestions(role),
      requiere_escalamiento: false,
      puede_crear_ticket: true,
    };
  }

  if (hasAny(message, LEARNING_WORDS)) {
    return {
      asistente: ASSISTANT_NAME,
      categoria: 'Conversacion',
      titulo: 'Contexto de la conversacion',
      intent: 'aprendizaje_contextual',
      confianza: 'alta',
      respuesta:
        'Si. Max usa el contexto reciente de la conversacion para no tratar cada mensaje como si fuera el primero. Cuando me cuentas que intentabas hacer, que pantalla viste y que esperabas que pasara, puedo ordenar el problema, descartar causas probables y darte el siguiente paso mas util antes de pensar en un ticket.',
      pasos: [],
      preguntas_seguimiento: [
        'Que intentabas hacer exactamente?',
        channel === 'mobile'
          ? 'En que pantalla de la app estabas?'
          : 'En que pantalla del portal estabas?',
        'Que resultado esperabas ver?',
      ],
      acciones: [],
      sugerencias: getSuggestions(role),
      requiere_escalamiento: false,
      puede_crear_ticket: true,
    };
  }

  const looksLikeGreeting =
    hasAny(message, GREETING_WORDS) &&
    !hasAny(message, PROBLEM_WORDS) &&
    !hasAny(message, DOMAIN_WORDS);

  if (looksLikeGreeting) {
    const channelQuestion =
      channel === 'mobile'
        ? 'En que pantalla de la app estas?'
        : 'En que pantalla del portal estas?';

    return {
      asistente: ASSISTANT_NAME,
      categoria: 'Conversacion',
      titulo: 'Max, asistente interno',
      intent: 'saludo',
      confianza: 'alta',
      respuesta:
        channel === 'mobile'
          ? 'Hola, soy Max. Estoy contigo desde la app movil. Escribeme el problema como te salga: que intentabas hacer, que viste en pantalla o que se sintio raro. Yo lo ordeno y lo revisamos paso a paso.'
          : 'Hola, soy Max. Estoy contigo en el portal web. Escribeme el problema como te salga: que intentabas hacer, que viste en pantalla o que se sintio raro. Yo lo ordeno y lo revisamos paso a paso.',
      pasos: [],
      preguntas_seguimiento: [
        'Que quieres resolver ahora?',
        channelQuestion,
        'Te aparece algun mensaje de error?',
      ],
      acciones: [],
      sugerencias: getSuggestions(role),
      requiere_escalamiento: false,
      puede_crear_ticket: true,
    };
  }

  return null;
}

function buildNaturalAnswer(
  entry: ChatbotKnowledgeEntry,
  isProblem: boolean,
  confidence: ChatbotResponse['confianza'],
  channel: ChatbotChannel
) {
  const intro = isProblem
    ? 'Te entiendo. Vamos por partes y sin brincar directo a soporte.'
    : 'Va, lo revisamos con calma.';

  const closing =
    confidence === 'baja'
      ? ' Dame la pantalla exacta y el mensaje que viste para afinar el diagnostico; si despues de eso no queda, dejamos un ticket bien armado.'
      : ' Dime que viste en pantalla y lo aterrizamos al caso exacto antes de pensar en ticket.';

  const channelContext =
    channel === 'mobile'
      ? ' Estoy tomando en cuenta que estas escribiendo desde la app movil.'
      : ' Estoy tomando en cuenta que estas en el portal web.';

  return `${intro} ${entry.respuesta}${channelContext}${closing}`;
}

function adaptFollowUpQuestions(
  questions: string[],
  channel: ChatbotChannel
) {
  if (channel !== 'mobile') return questions;

  return questions
    .filter((item) => !/portal o app movil/i.test(item))
    .map((item) =>
      /pantalla/i.test(item)
        ? item
        : item.replace(/portal|app movil/gi, 'app movil')
    );
}

function adaptSteps(steps: string[], channel: ChatbotChannel) {
  if (channel !== 'mobile') return steps;

  return steps.filter((item) => !/portal o app movil/i.test(item));
}

function buildUnauthorizedAdminResponse(role: ChatbotRole): ChatbotResponse {
  return {
    asistente: ASSISTANT_NAME,
    categoria: 'Permisos',
    titulo: 'Funcion administrativa restringida',
    intent: 'permiso_admin',
    confianza: 'alta',
    respuesta:
      'Esa accion corresponde a herramientas administrativas. Tu sesion actual no tiene rol admin, por eso Max no debe guiarte a cambiar usuarios, permisos o revisiones administrativas.',
    pasos: [
      'Si necesitas esa accion, solicita apoyo a un administrador.',
      'Si tu cuenta deberia ser admin, pide que revisen tu rol y vuelve a iniciar sesion.',
      'No compartas credenciales para saltar permisos.',
    ],
    preguntas_seguimiento: [
      'Quieres que te explique que puede hacer tu rol actual?',
      'Quieres crear un ticket para solicitar revision de permisos?',
    ],
    acciones: [
      {
        label: 'Abrir soporte',
        target: 'Soporte',
        scope: 'both',
      },
    ],
    sugerencias: getSuggestions(role),
    requiere_escalamiento: true,
    puede_crear_ticket: true,
  };
}

function buildFallbackResponse(
  role: ChatbotRole,
  channel: ChatbotChannel
): ChatbotResponse {
  return {
    asistente: ASSISTANT_NAME,
    categoria: 'Soporte',
    titulo: 'Necesito un poco mas de contexto',
    intent: 'aclaracion',
    confianza: 'baja',
    respuesta:
      channel === 'mobile'
        ? 'Te leo desde la app movil. Para ayudarte bien, dime que intentabas hacer dentro de la pantalla actual y que parte no quedo clara. Primero lo resolvemos con pasos; si despues no queda solucionado, entonces puedo ayudarte a dejar un ticket con contexto.'
        : 'Te leo desde el portal web. Para ayudarte bien, dime que intentabas hacer dentro de la pantalla actual y que parte no quedo clara. Primero lo resolvemos con pasos; si despues no queda solucionado, entonces puedo ayudarte a dejar un ticket con contexto.',
    pasos:
      channel === 'mobile'
        ? [
            'Dime el nombre de la pantalla o apartado donde estas.',
            'Describe que intentabas hacer y en que paso te atoraste.',
            'Si aparece un mensaje de error, escribelo tal cual.',
            'Si con esos pasos no se resuelve, cerramos el caso creando un ticket con contexto.',
          ]
        : [
            'Dime el nombre de la pantalla o apartado donde estas.',
            'Describe que intentabas hacer y en que paso te atoraste.',
            'Si aparece un mensaje de error, escribelo tal cual.',
            'Si con esos pasos no se resuelve, cerramos el caso creando un ticket con contexto.',
          ],
    preguntas_seguimiento: [
      'En que pantalla ocurrio?',
      'Que esperabas que pasara y que paso realmente?',
      'Quieres crear un ticket con esta informacion?',
    ],
    acciones: [

    ],
    sugerencias: getSuggestions(role),
    requiere_escalamiento: true,
    puede_crear_ticket: true,
  };
}

export function obtenerSugerenciasChatbot(role?: string | null) {
  const normalizedRole = normalizeRole(role);
  return getSuggestions(normalizedRole);
}

export function responderChatbot(data: {
  role?: string | null;
  mensaje?: string | null;
  historial?: ChatbotMessageContext[];
  canal?: string | null;
}): ChatbotResponse {
  const role = normalizeRole(data.role);
  const channel = normalizeChannel(data.canal);
  const rawMessage = String(data.mensaje || '').trim();
  const mensaje = compactText(rawMessage);
  const messageWithContext = buildContextMessage(
    rawMessage,
    data.historial
  );

  if (!mensaje) {
    throw new AppError('El mensaje es obligatorio', 400);
  }

  const conversational = buildConversationResponse(role, mensaje, channel);
  if (conversational) {
    return conversational;
  }

  const adminIntent = hasAny(messageWithContext, [
    'administro usuarios',
    'usuarios y permisos',
    'aprobar asistencia',
    'rechazar asistencia',
    'verificar credencial',
    'credencial qr',
    'revision admin',
    'autorizar terminal',
  ]);

  if (adminIntent && role !== 'admin') {
    return buildUnauthorizedAdminResponse(role);
  }

  const entries = KNOWLEDGE_BASE.filter((entry) =>
    canUseEntry(entry, role)
  );

  const ranked = entries
    .map((entry) => ({
      entry,
      score: scoreEntry(entry, mensaje) * 2 + scoreEntry(entry, messageWithContext),
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];

  if (!best || best.score <= 8) {
    return buildFallbackResponse(role, channel);
  }

  const isProblem = hasAny(messageWithContext, PROBLEM_WORDS);
  const confidence = confidenceFromScore(best.score);

  return {
    asistente: ASSISTANT_NAME,
    categoria: best.entry.categoria,
    titulo: best.entry.titulo,
    intent: best.entry.categoria === 'Acceso' || isProblem ? 'diagnostico' : confidence === 'baja' ? 'escalamiento' : 'orientacion',
    confianza: confidence,
    respuesta: buildNaturalAnswer(best.entry, isProblem, confidence, channel),
    pasos: adaptSteps(best.entry.pasos, channel),
    preguntas_seguimiento: adaptFollowUpQuestions(
      best.entry.preguntas_seguimiento,
      channel
    ),
    acciones: best.entry.acciones,
    sugerencias: best.entry.preguntas_seguimiento.length
      ? best.entry.preguntas_seguimiento
      : getSuggestions(role),
    requiere_escalamiento: confidence === 'baja',
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
    titulo: `Consulta con Max: ${data.respuesta.categoria}`.slice(
      0,
      120
    ),
    descripcion: [
      'Consulta registrada desde Max, asistente interno SMART RH.',
      '',
      `Pregunta del usuario: ${mensaje}`,
      '',
      `Categoria detectada: ${data.respuesta.categoria}`,
      `Intencion: ${data.respuesta.intent}`,
      `Confianza: ${data.respuesta.confianza}`,
      '',
      `Respuesta entregada: ${data.respuesta.respuesta}`,
    ].join('\n'),
    metadata: {
      origen: 'max_chatbot',
      asistente: ASSISTANT_NAME,
      categoria_respuesta: data.respuesta.categoria,
      intent: data.respuesta.intent,
      confianza: data.respuesta.confianza,
      requiere_escalamiento: data.respuesta.requiere_escalamiento,
    },
  });
}
