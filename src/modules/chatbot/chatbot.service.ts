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
import { pool } from '../../config/db.js';

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
    titulo: 'Invitar y administrar usuarios',
    roles: ['admin'],
    keywords: [
      'usuarios',
      'permisos',
      'roles',
      'activar usuario',
      'desactivar usuario',
      'admin',
      'administrador',
      'nuevo admin',
      'nuevo administrador',
      'agregar admin',
      'agregar un admin',
      'agregar administrador',
      'agregar un administrador',
      'crear admin',
      'crear administrador',
      'registrar administrador',
      'dar de alta administrador',
      'invitar admin',
      'invitar administrador',
      'invitar a un administrador',
      'invitar usuario',
      'invitacion',
      'inivtacion',
      'enviar invitacion',
      'enviarle su invitacion',
      'mandar invitacion',
      'mandarle invitacion',
      'correo administrador',
      'crud usuarios',
    ],
    respuesta:
      'Si, te ayudo con ese flujo. Para agregar un administrador no necesitas ir a soporte: en el portal entra a Usuarios y permisos, crea o invita al usuario, asigna el rol admin y valida los permisos de modulos antes de enviar la invitacion al correo.',
    pasos: [
      'En el portal web abre Usuarios y permisos desde el menu administrativo.',
      'Selecciona Nuevo usuario, Crear usuario o Enviar invitacion, segun el boton disponible en el CRUD.',
      'Captura nombre, correo y datos base del nuevo administrador.',
      'Asigna el rol admin y confirma que los permisos de modulos correspondan a lo que realmente necesita.',
      'Envia la invitacion y verifica que el usuario quede como pendiente, invitado o activo segun el flujo configurado.',
      'Pide al nuevo administrador abrir el correo de invitacion, completar el acceso y validar inicio de sesion.',
    ],
    preguntas_seguimiento: [
      'Ya tienes el correo del nuevo administrador?',
      'Quieres darle acceso admin completo o solo a algunos modulos?',
      'Te aparece el boton de crear usuario o el de enviar invitacion?',
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

function isAdminInvitationIntent(message: string) {
  const talksAboutAdmin =
    /\badmin\b|administrador|administradora|administrativo|administrativa/.test(message);
  const talksAboutInvite =
    /invit|inivt|agreg|crear|nuevo|nueva|alta|registr|correo|mandar|enviar/.test(message);
  const talksAboutUser =
    /usuario|cuenta|acceso|permiso|rol|correo|admin/.test(message);

  return talksAboutAdmin && talksAboutInvite && talksAboutUser;
}

function isUserPermissionsIntent(message: string) {
  return (
    /usuario|usuarios|cuenta|cuentas|permiso|permisos|rol|roles/.test(message) &&
    /agreg|crear|nuevo|alta|asign|cambiar|editar|modificar|activar|desactivar|invitar|invitacion/.test(message)
  );
}

function isIncapacityOperationalIntent(message: string) {
  return (
    /incapacidad|incapacidades|imss|comprobante|validacion/.test(message) &&
    /como|donde|revis|aprobar|rechazar|pendiente|aparece|aparezca|proceso|flujo|primero|validar|adjuntar|registrar/.test(message)
  );
}

function isAttendanceOperationalIntent(message: string) {
  return (
    /asistencia|asistencias|entrada|salida|pendiente|pendientes|checador|qr/.test(message) &&
    /como|donde|revis|aprobar|rechazar|corregir|justificar|pendiente|pendientes|registro|flujo/.test(message)
  );
}

function isCredentialOperationalIntent(message: string) {
  return (
    /credencial|documentos|contrato|expediente|qr/.test(message) &&
    /como|donde|revis|validar|verificar|cargado|consultar|flujo/.test(message)
  );
}

function resolveDirectEntryId(message: string) {
  if (isAdminInvitationIntent(message)) {
    return 'usuarios-admin';
  }

  if (isUserPermissionsIntent(message)) {
    return 'usuarios-admin';
  }

  if (isIncapacityOperationalIntent(message)) {
    return 'incapacidades';
  }

  if (isAttendanceOperationalIntent(message)) {
    return 'asistencia-admin';
  }

  if (isCredentialOperationalIntent(message)) {
    return 'credencial';
  }

  return null;
}

function isOperationalFlowIntent(message: string) {
  if (resolveDirectEntryId(message)) return true;

  const processCue =
    /como|donde|paso|proceso|flujo|ayudame|que reviso|que hago|no se|no entiendo/.test(message);
  const moduleCue =
    /usuario|usuarios|permiso|permisos|incapacidad|incapacidades|asistencia|credencial|contrato|documentos|vacaciones|nomina/.test(message);

  return processCue && moduleCue;
}

function scoreEntry(entry: ChatbotKnowledgeEntry, message: string) {
  const searchable = buildSearchText(entry);
  let score = 0;

  for (const keyword of entry.keywords) {
    const normalizedKeyword = normalizeText(keyword);

    if (normalizedKeyword && message.includes(normalizedKeyword)) {
      score += normalizedKeyword.length > 10 ? 6 : 3;
    }
  }

  const words = message.split(/\s+/).filter((word) => word.length >= 4);

  for (const word of words) {
    if (searchable.includes(word)) {
      score += 1;
    }
  }

  if (entry.id === resolveDirectEntryId(message)) {
    score += 80;
  }

  if (hasAny(message, PROBLEM_WORDS) && !resolveDirectEntryId(message)) {
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
    ? 'Te entiendo. Vamos por partes y lo resolvemos desde el flujo correcto.'
    : 'Va, lo revisamos con calma.';

  const channelContext =
    channel === 'mobile'
      ? ' Estoy tomando en cuenta que estas escribiendo desde la app movil.'
      : ' Estoy tomando en cuenta que estas en el portal web.';

  const closing =
    confidence === 'baja'
      ? ' Si despues de revisar estos datos no queda claro, ahi si dejamos un ticket con el contexto completo.'
      : ' Te dejo el camino directo y despues afinamos cualquier detalle que no aparezca igual en tu pantalla.';

  return `${intro} ${entry.respuesta}${channelContext}${closing}`;
}

function adaptFollowUpQuestions(
  questions: string[],
  channel: ChatbotChannel
) {
  return questions
    .filter((item) => !/portal o app movil/i.test(item))
    .map((item) => {
      if (channel === 'mobile') {
        return item.replace(/portal web|portal|app movil/gi, 'app movil');
      }

      return item.replace(/app movil|movil/gi, 'portal web');
    });
}

function adaptSteps(steps: string[], channel: ChatbotChannel) {
  return steps
    .filter((item) => !/portal o app movil/i.test(item))
    .map((item) => {
      if (channel === 'mobile') {
        return item.replace(/portal web|portal|app movil/gi, 'app movil');
      }

      return item.replace(/app movil|movil/gi, 'portal web');
    });
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

type ChatbotRuntimeRequest = {
  role?: string | null;
  mensaje?: string | null;
  historial?: ChatbotMessageContext[];
  canal?: string | null;
  usuarioId?: number | null;
};

type EmployeeLookup = {
  id?: number;
  correo?: string;
  nombre?: string;
};

const PROJECT_INTERNAL_KNOWLEDGE_LINES = [
  'Backend Node.js, Express, TypeScript, MySQL, JWT y MongoDB para auditoria/notificaciones.',
  'Portal web React, Vite y TypeScript; app movil React Native con Expo.',
  'Rutas internas backend y modulos protegidos por JWT, rol y permisos.',
  'Usuarios y permisos administra usuarios, roles, estado activo, modulos habilitados e invitaciones.',
  'Asistencia incluye QR, entrada/salida, pendientes, revision administrativa, correccion, justificacion y terminal autorizada.',
  'Incapacidades permite registro por empleado, comprobante PDF, analisis/validacion, revision admin, aprobacion, rechazo e historial.',
  'Calendario laboral consolida asistencia, vacaciones e incapacidades por mes y dia.',
  'Documentos maneja contrato PDF, foto de perfil y credencial digital con QR.',
  'ETL, ML, KMeans y Analytics generan analisis y metricas administrativas.',
  'Max usa canal web/mobile recibido en la peticion y no debe preguntar de nuevo el canal.',
];

const PROJECT_SAFE_OPERATIONAL_LINES = [
  'Puedo orientarte por modulo visible: Usuarios y permisos, Asistencia, Incapacidades, Documentos, Vacaciones, Nomina, Calendario, Credenciales o Soporte.',
  'Si buscas un flujo administrativo, primero confirmo tu rol y despues te explico los pasos dentro del portal o la app.',
  'Si buscas informacion de un empleado, solo la muestro cuando tu rol lo permite y evitando datos sensibles.',
  'No muestro identificadores internos, stack tecnico, tokens, hashes, QR privados ni detalles de infraestructura en respuestas operativas.',
];

function isProjectKnowledgeIntent(message: string) {
  return hasAny(message, [
    'que sabes del proyecto',
    'informacion del proyecto',
    'rutas',
    'endpoints',
    'modulos',
    'arquitectura',
    'tecnologias',
    'stack',
    'funcionalidades',
    'como esta hecho',
    'mapa del sistema',
  ]);
}

function buildProjectKnowledgeResponse(
  role: ChatbotRole,
  channel: ChatbotChannel,
  currentMessage = ''
): ChatbotResponse {
  const technicalIntent =
    role === 'admin' &&
    /diagnostico tecnico|debug|arquitectura interna|revision tecnica|infraestructura|stack tecnico/i.test(currentMessage);

  const safeTechnicalSummary = [
    'Uso internamente el mapa tecnico del proyecto para diagnosticar, pero no expongo identificadores internos, secretos ni detalles de infraestructura en una conversacion operativa.',
    'Para revisar un problema tecnico, dime el modulo afectado, el sintoma visible y el rol con el que ocurrio.',
    'Si necesitas trazabilidad tecnica formal, conviene levantar una tarea interna con evidencias y logs controlados.',
  ];

  return {
    asistente: ASSISTANT_NAME,
    categoria: 'Conocimiento del proyecto',
    titulo: 'Mapa funcional SMART RH',
    intent: technicalIntent ? 'diagnostico_tecnico_seguro' : 'conocimiento_operativo',
    confianza: 'alta',
    respuesta:
      channel === 'mobile'
        ? 'Tengo contexto funcional de SMART RH y se que estas consultando desde la app movil. Te voy a guiar por flujos visibles y permisos, sin exponer informacion tecnica interna.'
        : 'Tengo contexto funcional de SMART RH y se que estas consultando desde el portal web. Te voy a guiar por flujos visibles y permisos, sin exponer informacion tecnica interna.',
    pasos: technicalIntent ? safeTechnicalSummary : PROJECT_SAFE_OPERATIONAL_LINES,
    preguntas_seguimiento: [
      'Que modulo quieres revisar?',
      'Que rol estas usando en este momento?',
      'Quieres un flujo operativo o un diagnostico seguro del problema?',
    ],
    acciones: [],
    sugerencias: [
      'Usuarios',
      'Asistencia',
      'Incapacidades',
      'Empleado',
    ],
    requiere_escalamiento: false,
    puede_crear_ticket: false,
  };
}

function hasEmployeeSearchVerb(message: string) {
  return /busca|buscar|buscame|encuentra|localiza|consulta|consultar|muestra|mostrar|dame|ver/.test(message);
}

function hasEmployeeDataTerm(message: string) {
  return /informacion|datos|perfil|resumen|detalle|estatus|estado|expediente|contrato|nomina|vacaciones|asistencia|incapacidad|incapacidades|permisos/.test(message);
}

function hasEmployeeSubject(message: string) {
  return /empleado|empleada|colaborador|colaboradora|trabajador|trabajadora|usuario|persona|admin|administrador|administradora|correo|id\s*\d+/.test(message);
}

function isLikelyName(value: string) {
  const tokens = value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length < 2 || tokens.length > 4) return false;

  const blocked = new Set([
    'empleado',
    'usuario',
    'colaborador',
    'trabajador',
    'administrador',
    'admin',
    'informacion',
    'datos',
    'perfil',
    'resumen',
    'detalle',
    'contrato',
    'nomina',
    'vacaciones',
    'asistencia',
    'incapacidad',
    'incapacidades',
    'pendiente',
    'pendientes',
    'permiso',
    'permisos',
    'como',
    'donde',
    'reviso',
    'aprobar',
    'rechazar',
    'cambiar',
    'validar',
    'credencial',
    'portal',
    'movil',
    'app',
    'antes',
    'despues',
    'para',
    'quiero',
    'necesito',
  ]);

  return tokens.every((token) => /^[a-zñ.'-]{2,}$/.test(token) && !blocked.has(token));
}

function extractEmployeeLookup(rawMessage: string): EmployeeLookup | null {
  const normalized = compactText(rawMessage);
  const email = normalized.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}/i)?.[0];
  if (email) return { correo: email };

  const idMatch = normalized.match(/(?:empleado|usuario|colaborador|trabajador|id)\s*#?\s*(\d+)/i);
  if (idMatch) return { id: Number(idMatch[1]) };

  const explicitSearchName = normalized.match(
    /(?:busca|buscar|buscame|encuentra|localiza|consulta|consultar|muestra|mostrar)\s+(?:a\s+)?([a-zñ.'-]+(?:\s+[a-zñ.'-]+){1,3})/i
  );

  if (explicitSearchName) {
    const nombre = explicitSearchName[1]
      .replace(/\s+/g, ' ')
      .trim();

    if (isLikelyName(nombre)) return { nombre };
  }

  const labeledName = normalized.match(
    /(?:empleado|colaborador|trabajador|usuario|persona|admin|administrador)\s+(?:llamado|llamada|con nombre|nombre)\s+([a-zñ.'-]+(?:\s+[a-zñ.'-]+){1,3})/i
  );

  if (labeledName) {
    const nombre = labeledName[1].replace(/\s+/g, ' ').trim();
    if (isLikelyName(nombre)) return { nombre };
  }

  return null;
}

function isEmployeeDataIntent(message: string) {
  const lookup = extractEmployeeLookup(message);
  if (!lookup) return false;

  if (isOperationalFlowIntent(message) && !hasEmployeeSearchVerb(message)) {
    return false;
  }

  return (
    hasEmployeeSearchVerb(message) ||
    hasEmployeeDataTerm(message) ||
    Boolean(lookup.id) ||
    Boolean(lookup.correo)
  );
}

function shouldAskEmployeeIdentifier(message: string) {
  if (isOperationalFlowIntent(message)) return false;

  return (
    hasEmployeeSubject(message) &&
    (hasEmployeeSearchVerb(message) || hasEmployeeDataTerm(message)) &&
    !extractEmployeeLookup(message)
  );
}

function safeText(value: unknown, fallback = 'No registrado') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function formatDate(value: unknown) {
  if (!value) return 'No registrado';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 10);
}

function formatMoney(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'No registrado';
  return number.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
  });
}

async function findEmployeeCandidates(
  lookup: EmployeeLookup,
  role: ChatbotRole,
  actorUserId: number
) {
  const params: unknown[] = [];
  let where = '';

  if (role !== 'admin') {
    where = 'u.id = ?';
    params.push(actorUserId);
  } else if (lookup.id) {
    where = 'u.id = ?';
    params.push(lookup.id);
  } else if (lookup.correo) {
    where = 'LOWER(u.correo) = ?';
    params.push(lookup.correo.toLowerCase());
  } else if (lookup.nombre) {
    where = "LOWER(CONCAT_WS(' ', u.nombre, u.apellido, u.correo)) LIKE ?";
    params.push(`%${lookup.nombre.toLowerCase()}%`);
  } else {
    where = 'u.id = ?';
    params.push(actorUserId);
  }

  const [rows] = await pool.query(
    `SELECT
       u.id,
       u.nombre,
       u.apellido,
       u.correo,
       u.telefono,
       u.direccion,
       u.fecha_ingreso,
       u.dias_vacaciones_disponibles,
       u.activo,
       u.created_at,
       u.updated_at,
       u.foto_perfil_url,
       u.credencial_url,
       r.nombre AS role
     FROM usuarios u
     JOIN roles r ON r.id = u.rol_id
     WHERE ${where}
     ORDER BY u.id DESC
     LIMIT 5`,
    params
  );

  return rows as any[];
}

async function getEmployeeOperationalData(userId: number) {
  const [permisos] = await pool.query(
    `SELECT modulo, habilitado
     FROM usuario_modulos
     WHERE usuario_id = ?
     ORDER BY modulo ASC`,
    [userId]
  );

  const [contratos] = await pool.query(
    `SELECT id, tipo_contrato, salario_base, fecha_inicio, fecha_fin, estado, contrato_pdf_url
     FROM contratos
     WHERE usuario_id = ?
     ORDER BY (estado = 'activo') DESC, id DESC
     LIMIT 2`,
    [userId]
  );

  const [nominas] = await pool.query(
    `SELECT id, salario_base, deducciones, bonos, total, estado, periodo_inicio, periodo_fin
     FROM nominas
     WHERE usuario_id = ?
     ORDER BY periodo_fin DESC, id DESC
     LIMIT 3`,
    [userId]
  );

  const [vacaciones] = await pool.query(
    `SELECT id, dias_disponibles, dias_solicitados, fecha_inicio, fecha_fin, estado
     FROM vacaciones
     WHERE usuario_id = ?
     ORDER BY id DESC
     LIMIT 3`,
    [userId]
  );

  const [asistencias] = await pool.query(
    `SELECT id, fecha, hora_entrada, hora_salida, estado, duracion_registrada_segundos
     FROM asistencias
     WHERE usuario_id = ?
     ORDER BY fecha DESC, id DESC
     LIMIT 5`,
    [userId]
  );

  const [incapacidades] = await pool.query(
    `SELECT id, fecha_inicio, fecha_fin, dias_calculados, motivo, estado, observaciones_admin, created_at
     FROM incapacidades
     WHERE usuario_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT 3`,
    [userId]
  );

  return {
    permisos: permisos as any[],
    contratos: contratos as any[],
    nominas: nominas as any[],
    vacaciones: vacaciones as any[],
    asistencias: asistencias as any[],
    incapacidades: incapacidades as any[],
  };
}

function buildAmbiguousEmployeeResponse(
  role: ChatbotRole,
  candidates: any[],
  channel: ChatbotChannel
): ChatbotResponse {
  return {
    asistente: ASSISTANT_NAME,
    categoria: 'Datos de empleado',
    titulo: 'Seleccion de empleado',
    intent: 'seleccion_empleado',
    confianza: 'media',
    respuesta:
      channel === 'mobile'
        ? 'Encontre mas de una coincidencia. Para darte datos exactos desde la app movil, dime el ID o correo del empleado.'
        : 'Encontre mas de una coincidencia. Para darte datos exactos desde el portal web, dime el ID o correo del empleado.',
    pasos: candidates.map((user) =>
      `ID ${user.id}: ${safeText(user.nombre)} ${safeText(user.apellido, '')} · ${safeText(user.correo)} · rol ${safeText(user.role)}`
    ),
    preguntas_seguimiento: [
      'Cual ID o correo quieres consultar?',
      'Quieres ver perfil general, contrato, asistencia o vacaciones?',
    ],
    acciones: [],
    sugerencias: getSuggestions(role),
    requiere_escalamiento: false,
    puede_crear_ticket: false,
  };
}

function buildEmployeeResponse(
  role: ChatbotRole,
  channel: ChatbotChannel,
  user: any,
  data: {
    permisos: any[];
    contratos: any[];
    nominas: any[];
    vacaciones: any[];
    asistencias: any[];
    incapacidades: any[];
  }
): ChatbotResponse {
  const nombreCompleto = `${safeText(user.nombre)} ${safeText(user.apellido, '')}`.trim();
  const contrato = data.contratos[0];
  const nomina = data.nominas[0];
  const permisosActivos = data.permisos
    .filter((item) => Number(item.habilitado) === 1)
    .map((item) => item.modulo);
  const permisosInactivos = data.permisos
    .filter((item) => Number(item.habilitado) !== 1)
    .map((item) => item.modulo);

  const pasos = [
    `Empleado: ${nombreCompleto} · ID ${user.id} · correo ${safeText(user.correo)}.`,
    `Rol: ${safeText(user.role)} · estado: ${Number(user.activo) === 1 ? 'activo' : 'inactivo'} · ingreso: ${formatDate(user.fecha_ingreso)}.`,
    `Contacto: telefono ${safeText(user.telefono)} · direccion ${safeText(user.direccion)}.`,
    `Vacaciones disponibles: ${Number(user.dias_vacaciones_disponibles ?? 0)} dia(s).`,
    contrato
      ? `Contrato: ${safeText(contrato.tipo_contrato)} · estado ${safeText(contrato.estado)} · salario ${formatMoney(contrato.salario_base)} · vigencia ${formatDate(contrato.fecha_inicio)} a ${formatDate(contrato.fecha_fin)}.`
      : 'Contrato: no hay contrato registrado.',
    nomina
      ? `Ultima nomina: periodo ${formatDate(nomina.periodo_inicio)} a ${formatDate(nomina.periodo_fin)} · estado ${safeText(nomina.estado)} · total ${formatMoney(nomina.total)}.`
      : 'Nomina: no hay registros recientes.',
    permisosActivos.length
      ? `Modulos activos: ${permisosActivos.join(', ')}.`
      : 'Modulos activos: no hay permisos activos registrados.',
    permisosInactivos.length
      ? `Modulos desactivados: ${permisosInactivos.join(', ')}.`
      : 'Modulos desactivados: sin bloqueos registrados por modulo.',
  ];

  if (data.vacaciones.length) {
    pasos.push(
      `Vacaciones recientes: ${data.vacaciones
        .map((item) => `#${item.id} ${safeText(item.estado)} ${formatDate(item.fecha_inicio)}-${formatDate(item.fecha_fin)} (${item.dias_solicitados} dia(s))`)
        .join(' | ')}.`
    );
  }

  if (data.asistencias.length) {
    pasos.push(
      `Asistencia reciente: ${data.asistencias
        .map((item) => `${formatDate(item.fecha)} ${safeText(item.estado)} entrada ${safeText(item.hora_entrada, 'N/A')} salida ${safeText(item.hora_salida, 'N/A')}`)
        .join(' | ')}.`
    );
  }

  if (data.incapacidades.length) {
    pasos.push(
      `Incapacidades recientes: ${data.incapacidades
        .map((item) => `#${item.id} ${safeText(item.estado)} ${formatDate(item.fecha_inicio)}-${formatDate(item.fecha_fin)} (${item.dias_calculados} dia(s))`)
        .join(' | ')}.`
    );
  }

  return {
    asistente: ASSISTANT_NAME,
    categoria: 'Datos de empleado',
    titulo: `Resumen de ${nombreCompleto}`,
    intent: 'consulta_empleado',
    confianza: 'alta',
    respuesta:
      channel === 'mobile'
        ? `Encontre el expediente de ${nombreCompleto}. Te doy el resumen permitido para tu sesion desde la app movil.`
        : `Encontre el expediente de ${nombreCompleto}. Te doy el resumen permitido para tu sesion desde el portal web.`,
    pasos,
    preguntas_seguimiento: [
      'Quieres revisar solo contrato, nomina, vacaciones, asistencia o incapacidades?',
      role === 'admin'
        ? 'Quieres abrir Usuarios y permisos para ajustar rol o modulos?'
        : 'Quieres que revise algun dato de tu propio perfil?',
    ],
    acciones:
      role === 'admin'
        ? [
            {
              label: 'Usuarios en portal',
              target: '/portal/usuarios',
              scope: 'web',
            },
            {
              label: 'Usuarios y permisos',
              target: 'AdminUsuarios',
              scope: 'mobile',
            },
          ]
        : [],
    sugerencias: [
      'Contrato',
      'Nomina',
      'Vacaciones',
      'Asistencia',
    ],
    requiere_escalamiento: false,
    puede_crear_ticket: false,
  };
}

async function buildEmployeeDataResponse(
  data: ChatbotRuntimeRequest,
  role: ChatbotRole,
  channel: ChatbotChannel,
  messageWithContext: string
): Promise<ChatbotResponse | null> {
  const lookup = extractEmployeeLookup(messageWithContext);

  if (!isEmployeeDataIntent(messageWithContext)) {
    if (!shouldAskEmployeeIdentifier(messageWithContext)) {
      return null;
    }

    return {
      asistente: ASSISTANT_NAME,
      categoria: 'Datos de empleado',
      titulo: 'Falta identificar al empleado',
      intent: 'solicitar_identificador_empleado',
      confianza: 'media',
      respuesta:
        channel === 'mobile'
          ? 'Puedo ayudarte a consultar datos de empleado desde la app movil, pero necesito identificarlo con precision para no mostrar informacion equivocada.'
          : 'Puedo ayudarte a consultar datos de empleado desde el portal web, pero necesito identificarlo con precision para no mostrar informacion equivocada.',
      pasos: [
        'Escribe el ID del empleado si lo tienes.',
        'Tambien puedes usar su correo institucional.',
        'Si solo tienes el nombre, escribe nombre y apellido completos.',
      ],
      preguntas_seguimiento: [
        'Cual es el ID, correo o nombre completo del empleado?',
      ],
      acciones: [],
      sugerencias: [
        'Buscar por ID',
        'Buscar por correo',
        'Buscar por nombre',
      ],
      requiere_escalamiento: false,
      puede_crear_ticket: false,
    };
  }

  if (!lookup) {
    return null;
  }

  const actorUserId = Number(data.usuarioId);
  if (!Number.isInteger(actorUserId) || actorUserId <= 0) {
    return null;
  }

  const candidates = await findEmployeeCandidates(lookup, role, actorUserId);

  if (candidates.length === 0) {
    return {
      asistente: ASSISTANT_NAME,
      categoria: 'Datos de empleado',
      titulo: 'Empleado no encontrado',
      intent: 'consulta_empleado_sin_resultado',
      confianza: 'media',
      respuesta:
        'No encontre un empleado con ese dato. Para buscarlo necesito ID, correo o nombre completo tal como esta registrado.',
      pasos: [
        'Intenta con el correo institucional del empleado.',
        'O usa el ID del usuario si lo tienes disponible.',
        'Si estas buscando a otra persona y no eres admin, Max no puede mostrar datos de terceros.',
      ],
      preguntas_seguimiento: [
        'Cual es el correo o ID del empleado?',
      ],
      acciones: [],
      sugerencias: getSuggestions(role),
      requiere_escalamiento: false,
      puede_crear_ticket: false,
    };
  }

  if (candidates.length > 1) {
    return buildAmbiguousEmployeeResponse(role, candidates, channel);
  }

  const [user] = candidates;
  const operationalData = await getEmployeeOperationalData(Number(user.id));

  return buildEmployeeResponse(role, channel, user, operationalData);
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
    'invitar administrador',
    'nuevo administrador',
    'agregar administrador',
    'crear administrador',
    'mandar invitacion',
    'enviar invitacion',
    'invitar usuario',
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

  const directEntryId = resolveDirectEntryId(messageWithContext);

  const ranked = entries
    .map((entry) => ({
      entry,
      score:
        scoreEntry(entry, mensaje) * 2 +
        scoreEntry(entry, messageWithContext) +
        (entry.id === directEntryId ? 120 : 0),
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
      ? adaptFollowUpQuestions(best.entry.preguntas_seguimiento, channel)
      : getSuggestions(role),
    requiere_escalamiento: confidence === 'baja',
    puede_crear_ticket: confidence === 'baja' || best.entry.id === 'soporte',
  };
}

export async function responderChatbotConDatos(
  data: ChatbotRuntimeRequest
): Promise<ChatbotResponse> {
  const role = normalizeRole(data.role);
  const channel = normalizeChannel(data.canal);
  const rawMessage = String(data.mensaje || '').trim();
  const messageWithContext = buildContextMessage(
    rawMessage,
    data.historial
  );

  if (!rawMessage) {
    throw new AppError('El mensaje es obligatorio', 400);
  }

  if (isProjectKnowledgeIntent(rawMessage)) {
    return buildProjectKnowledgeResponse(role, channel, rawMessage);
  }

  const isOperationalIncapacityFlow =
    /incapacidades?|incapacidad/.test(messageWithContext) &&
    /pendiente|pendientes|revisar|revision|aprobar|rechazar/.test(messageWithContext) &&
    !/correo|id\s*\d+|informacion|datos|perfil|resumen|detalle|estatus|estado|expediente/.test(messageWithContext);

  if (isOperationalIncapacityFlow) {
    return responderChatbot(data);
  }

  const employeeDataResponse = await buildEmployeeDataResponse(
    data,
    role,
    channel,
    messageWithContext
  );

  if (employeeDataResponse) {
    return employeeDataResponse;
  }

  return responderChatbot(data);
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
