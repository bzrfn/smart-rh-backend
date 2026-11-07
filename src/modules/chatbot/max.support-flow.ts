import { AppError } from '../../utils/AppError.js';
import { createHash, randomUUID } from 'node:crypto';
import { buildMaxResponse } from './max.response.js';
import type { ChatbotMessageContext, ChatbotResponse } from './chatbot.types.js';

export type MaxDraft = { id: string; titulo: string; descripcion: string; ready: boolean };
export type MaxState = {
  history: ChatbotMessageContext[];
  draft?: MaxDraft;
  lastTicketId?: string;
  receipts?: Array<{ id: string; fingerprint: string; result: MaxTurnResult }>;
};
export type MaxTurnResult = { respuesta: ChatbotResponse; ticket: any | null; created?: boolean };
export type MaxTurn = {
  mensaje: string; usuarioId: number; role: string; canal: string;
  requestId: string; crearTicket?: boolean;
};
export type MaxTools = {
  respond: (history: ChatbotMessageContext[]) => Promise<ChatbotResponse>;
  create: (draft: MaxDraft, key: string, history: ChatbotMessageContext[]) => Promise<any>;
  get: (id: string) => Promise<any>;
};
export const normalizeMaxText = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const supportAction = [{ label: 'Abrir soporte', target: 'Soporte', scope: 'both' as const }];
const meta = /ticket|folio|soporte|resume|resumen|verificaciones|pasos.*intente/;
export function isMaxCreateRequest(text: string) {
  const s = normalizeMaxText(text);
  return !/\b(no|nunca)\s+(?:quiero\s+|debes\s+)?(?:crear|crees|generar|generes|registrar|registres|abras|abrir)/.test(s) &&
    /\b(crea|crear|creame|crees|genera|generar|generame|generes|levanta|levantar|levantes|abre|abrir|abras|registra|registrar|registres)\b.{0,100}\b(ticket|reporte|incidencia|solicitud de soporte)\b/.test(s) &&
    !/\b(como|donde|puedes|podrias)\b.{0,35}\b(crear|generar|abrir|registrar)/.test(s);
}
export function isMaxSupportTurn(text: string) {
  return /ticket|folio|soporte|resume|resumen.*conversa|verificaciones realizadas|que (?:intente|intentamos|pasos)/.test(normalizeMaxText(text));
}
function supportResponse(intent: string, text: string, steps: string[] = [], ready = false) {
  return buildMaxResponse({ categoria: 'Soporte', titulo: 'Seguimiento con Max', intent,
    confianza: 'alta', respuesta: text, pasos: steps, acciones: supportAction,
    requiere_escalamiento: ready, puede_crear_ticket: ready });
}
function cleanQuotedTitle(text: string) {
  return text.match(/(?:t[ií]tulo|asunto)\s*(?:es|ser[aá]|=|:)?\s*[“"«']([^”"»'\n]{3,120})[”"»']/i)?.[1]?.trim() ||
    text.match(/(?:t[ií]tulo|asunto)\s*:\s*([^\n]{3,120})/i)?.[1]?.trim();
}
function incidentLines(history: ChatbotMessageContext[]) {
  return history.filter(m => m.author === 'user').map(m => String(m.text || '').trim())
    .filter(t => !meta.test(normalizeMaxText(t)) && !/^[¿?]|^(como|donde|que |cual)/.test(normalizeMaxText(t)))
    .filter(t => /no (?:aparece|veo|puedo|funciona|permite|se)|error|fall|problema|ya |sigue |registr|actualic|cerre|comprobe/i.test(normalizeMaxText(t))).slice(-8);
}
function preview(draft: MaxDraft) {
  return supportResponse(draft.ready ? 'ticket_borrador_listo' : 'ticket_datos_faltantes',
    draft.ready ? 'Preparé el borrador. Todavía no está registrado. Revisa los datos y confirma «Sí, crear el ticket»; también puedes corregirlos o cancelar.' :
      'Todavía no he creado un ticket. Indica qué intentabas hacer, qué ocurrió y qué esperabas; puedes añadir fecha, empleado o mensaje de error si aplica.',
    [`Título: ${draft.titulo || 'Pendiente de indicar'}`, `Descripción: ${draft.descripcion || 'Pendiente de indicar'}`], draft.ready);
}
function buildDraft(message: string, history: ChatbotMessageContext[], previous?: MaxDraft): MaxDraft {
  const explicitDescription = message.match(/descripci[oó]n\s*:\s*([\s\S]+)/i)?.[1]?.trim();
  const reported = incidentLines(history);
  const directProblem = !cleanQuotedTitle(message) && !isMaxCreateRequest(message) && !isMaxSupportTurn(message) && message.length >= 15 &&
    !/[?¿]/.test(message) ? message.trim() : '';
  const description = explicitDescription || (directProblem ? [previous?.descripcion, directProblem].filter(Boolean).join('\n') :
    previous?.descripcion || reported.join('\n'));
  const subject = normalizeMaxText(description);
  const title = cleanQuotedTitle(message) || previous?.titulo || (description ?
    `Incidencia de ${/asistencia|entrada|salida|qr/.test(subject) ? 'asistencia' : /vacacion/.test(subject) ? 'vacaciones' : /incapacidad/.test(subject) ? 'incapacidades' : 'SMART RH'}` : '');
  return { id: previous?.id || randomUUID(), titulo: title, descripcion: description.slice(0, 6000), ready: title.length >= 3 && description.length >= 15 };
}
function summary(state: MaxState) {
  const reports = incidentLines(state.history);
  const said = state.draft?.descripcion || reports.join('\n');
  const attempted = reports.filter(t => /\bya\b|actualic|cerre|abri|comprobe|verifique|revise|intente/.test(normalizeMaxText(t)));
  return supportResponse('resumen_conversacion', said ? 'Este es el resumen de lo que reportaste; las verificaciones indicadas son las que tú mencionaste.' :
    'No tengo detalles suficientes del incidente en esta conversación. Describe el problema para resumirlo sin inventar información.',
    [`Problema reportado: ${said || 'No descrito.'}`, `Verificaciones reportadas: ${attempted.join(' | ') || 'No mencionaste verificaciones realizadas.'}`,
      `Siguiente paso: ${state.lastTicketId ? `consultar el ticket ${state.lastTicketId} en Soporte.` : state.draft?.ready ? 'confirmar o corregir el borrador.' : 'completar los datos del incidente.'}`]);
}
export async function runMaxTurn(input: MaxTurn, state: MaxState, tools: MaxTools): Promise<MaxTurnResult> {
  const message = input.mensaje.trim();
  const s = normalizeMaxText(message);
  const fingerprint = createHash('sha256').update(`${message}:${Boolean(input.crearTicket)}`).digest('hex');
  const prior = state.receipts?.find(r => r.id === input.requestId);
  if (prior) {
    if (prior.fingerprint !== fingerprint) throw new AppError('El identificador del mensaje ya fue usado para otro contenido. Envía un mensaje nuevo.', 409);
    return { ...prior.result, created: false };
  }
  let result: MaxTurnResult;
  const affirmative = /^(si|va|ok|dale|adelante|confirmo|confirmado|crealo|hazlo|de acuerdo|correcto)[.!]*$/.test(s) ||
    /^(si[, ]+)?(?:confirmo[, ]+)?(?:crear|crea|generar|genera) (?:el |ese )?ticket[.!]*$/.test(s);
  const cancels = /^(no|no[, ]+gracias|cancelar|cancela(?:r)?(?: el)?(?: ticket| borrador| solicitud)?)[.!]*$/.test(s) ||
    /\bno\s+(?:quiero\s+|debes\s+)?(?:crear|crees|generar|generes|registrar|registres|abras)\b/.test(s);
  const lookup = /ticket|folio|solicitud de soporte/.test(s) &&
    /estado|estatus|folio|seguimiento|consulta|consultar|confirm|creado|quedo|donde|ver |respuesta/.test(s) && !isMaxCreateRequest(message);
  if (/(?:muestra|dame|revela|consulta|ver).{0,50}(?:contrasen|secret|clave.*(?:servidor|conexion|base de datos))|contrasenas de|credenciales.*servidor|ignora (?:tus|las) reglas/.test(s)) {
    result = { respuesta: supportResponse('seguridad', 'No puedo revelar contraseñas, claves ni secretos del sistema. Utilizo los permisos de tu sesión autenticada.'), ticket: null };
  } else if (/que.*puedes.*(?:hacer|consultar)|puedes.*(?:aprobar|rechazar).*conversacion/.test(s)) {
    result = { respuesta: supportResponse('capacidades', 'Puedo orientar sobre los módulos de SMART RH, consultar datos permitidos de empleados identificados y preparar, crear con confirmación y consultar tickets de soporte. Las aprobaciones y cambios de asistencia se realizan en sus módulos con los permisos correspondientes.',
      ['Para consultar un empleado, indica su ID o correo.', 'Para soporte, describe el problema y pide generar un ticket.', 'Las consultas de datos dependen del rol de tu sesión; no cambio permisos desde el chat.']), ticket: null };
  } else if (/\b(resume|resumeme)\b|resumen.*(?:conversa|problema|caso|report)|que (?:intente|intentamos|pasos)|verificaciones realizadas/.test(s)) {
    result = { respuesta: summary(state), ticket: null };
  } else if (cancels && state.draft) {
    delete state.draft;
    result = { respuesta: supportResponse('ticket_cancelado', 'Cancelé el borrador. No se creó un ticket nuevo.'), ticket: null };
  } else if (input.crearTicket && !state.draft && !cancels && (!state.lastTicketId || /otro|nuevo|nueva/.test(s))) {
    // Compatibilidad: el botón de clientes publicados ya constituye una confirmación explícita.
    const lastCreated = state.lastTicketId ? state.history.map(m => m.author === 'assistant' && /Creé el ticket con folio/.test(m.text || '')).lastIndexOf(true) : -1;
    const draft = buildDraft(message, state.history.slice(lastCreated + 1));
    if (!draft.ready) throw new AppError('Faltan los datos del incidente. Describe el problema y pide generar un ticket antes de confirmar.', 400);
    draft.id = createHash('sha256').update(`${input.usuarioId}:${input.requestId}`).digest('hex');
    state.draft = draft;
    return runMaxTurn(input, state, tools);
  } else if ((affirmative || input.crearTicket) && state.draft?.ready && !cancels) {
    const draft = state.draft;
    const key = createHash('sha256').update(`${input.usuarioId}:${draft.id}`).digest('hex');
    const ticket = await tools.create(draft, key, state.history);
    if (!ticket?._id || !ticket?.estado) throw new AppError('No pude verificar el folio y estado del ticket. Reintenta el mismo mensaje antes de crear otro.', 503);
    state.lastTicketId = String(ticket._id);
    delete state.draft;
    result = { respuesta: supportResponse('ticket_creado', `Creé el ticket con folio ${ticket._id}. Estado: ${ticket.estado}.`,
      [`Título: ${ticket.titulo}`, 'Puedes consultar su seguimiento en Soporte.']), ticket, created: true };
  } else if (lookup || (affirmative && state.lastTicketId && !state.draft)) {
    const explicitId = message.match(/\b[a-f\d]{24}\b/i)?.[0];
    const id = explicitId || (state.draft && !/anterior|ultimo creado/.test(s) ? undefined : state.lastTicketId);
    if (!id) {
      result = { respuesta: supportResponse('ticket_sin_folio', 'No tengo un ticket registrado y verificado para esta conversación. Si ya existe, indica su folio para consultar el estado.',
        state.draft ? [`Hay un borrador pendiente. ${state.draft.ready ? 'Falta confirmar su creación.' : 'Falta completar el incidente.'}`] : []), ticket: null };
    } else {
      const ticket = await tools.get(id);
      result = { respuesta: supportResponse('ticket_consultado', `Consulté el ticket ${ticket._id}. Estado actual: ${ticket.estado}.`,
        [`Título: ${ticket.titulo}`, `Respuesta de soporte: ${ticket.respuesta_admin || 'Todavía no hay respuesta registrada.'}`,
          `Última actualización: ${ticket.updatedAt ? new Date(ticket.updatedAt).toISOString() : 'No disponible.'}`, 'Puedes darle seguimiento desde Soporte.']), ticket };
    }
  } else if (!cancels && (isMaxCreateRequest(message) || input.crearTicket || /no pude resolver|no se resolvio|sigue igual|no funciono/.test(s) || (affirmative && state.history.some(m => m.author === 'assistant' && /ticket/.test(m.text || ''))) || (state.draft && !/[?¿]/.test(message)))) {
    if (state.lastTicketId && !state.draft && !/otro|nuevo|nueva/.test(s)) {
      const ticket = await tools.get(state.lastTicketId);
      result = { respuesta: supportResponse('ticket_existente', `Ya existe el ticket ${ticket._id} en esta conversación. Estado: ${ticket.estado}. Para otro incidente, pide «crear otro ticket».`), ticket };
    } else {
      const lastCreated = state.lastTicketId ? state.history.map(m => m.author === 'assistant' && /Creé el ticket con folio/.test(m.text || '')).lastIndexOf(true) : -1;
      state.draft = buildDraft(message, state.history.slice(lastCreated + 1), state.draft);
      result = { respuesta: preview(state.draft), ticket: null };
    }
  } else if (cancels) {
    result = { respuesta: supportResponse('ticket_sin_cambios', 'No he creado ningún ticket nuevo.'), ticket: null };
  } else if (isMaxSupportTurn(message)) {
    result = { respuesta: supportResponse('soporte_orientacion', 'Puedo preparar un ticket con tu reporte, pedir los datos faltantes y registrarlo después de tu confirmación. También puedo consultar un folio permitido por tu sesión.',
      ['Describe el incidente y pide «generar un ticket».', 'Revisa el borrador y confirma su creación.', 'Consulta el folio en este chat o desde Soporte.']), ticket: null };
  } else {
    result = { respuesta: await tools.respond(state.history), ticket: null };
  }
  state.history = [...state.history, { author: 'user' as const, text: message }, { author: 'assistant' as const, text: [result.respuesta.respuesta, ...result.respuesta.pasos].join('\n') }].slice(-60);
  state.receipts = [...(state.receipts || []), { id: input.requestId, fingerprint, result }].slice(-8);
  return result;
}
