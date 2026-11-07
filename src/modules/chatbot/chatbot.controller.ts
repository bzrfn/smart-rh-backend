import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import { runMaxTurn, type MaxState } from './max.support-flow.js';
import { withMaxSession, maxSessionKey, MaxSessionModel } from './max.session.js';
import { crearTicketSoporte, obtenerTicketSoporteAutorizado } from '../soporte/soporte.service.js';
import {
  NextFunction,
  Response,
} from 'express';
import { AuthRequest } from '../../middlewares/authJwt.js';
import { AppError } from '../../utils/AppError.js';
import {
  obtenerSugerenciasChatbot,
  responderChatbotConDatos,
} from './chatbot.service.js';

function requireAuth(req: AuthRequest) {
  const usuarioId = req.auth?.userId;

  if (!usuarioId) {
    throw new AppError('Usuario no autenticado', 401);
  }

  return {
    usuarioId,
    role: req.auth?.role || 'empleado',
  };
}

function normalizeChannel(body: any) {
  const value = String(
    body?.canal ||
      body?.channel ||
      body?.origen ||
      body?.source ||
      ''
  ).toLowerCase();

  if (['mobile', 'movil', 'app', 'ios', 'android'].includes(value)) {
    return 'mobile';
  }

  return 'web';
}

function normalizeHistory(body: any) {
  const source = Array.isArray(body?.historial)
    ? body.historial
    : Array.isArray(body?.messages)
      ? body.messages
      : [];

  return source
    .slice(-20)
    .map((item: any) => ({
      author:
        item?.author === 'assistant' || item?.role === 'assistant'
          ? 'assistant'
          : 'user',
      text: String(item?.text || item?.content || '').slice(0, 2000),
    }))
    .filter((item: any) => item.text.trim());
}

export async function responderChatbotController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const auth = requireAuth(req);
    const mensaje = String(req.body?.mensaje || '').trim();

    if (!mensaje || mensaje.length > 4000) throw new AppError('Escribe un mensaje de 1 a 4000 caracteres.', 400);
    const canal = normalizeChannel(req.body);
    const conversationId = String(req.body?.conversacion_id || `legacy-${canal}`);
    const requestId = String(req.body?.solicitud_id || createHash('sha256').update(JSON.stringify([mensaje, normalizeHistory(req.body), Boolean(req.body?.crear_ticket || req.body?.crearTicket || req.body?.escalar || req.body?.crear_soporte)])).digest('hex'));
    if (![conversationId, requestId].every(id => /^[a-zA-Z0-9_-]{1,100}$/.test(id))) throw new AppError('Identificador de conversación o mensaje no válido.', 400);
    const crearTicket = Boolean(req.body?.crear_ticket || req.body?.crearTicket || req.body?.escalar || req.body?.crear_soporte);
    const input = { mensaje, usuarioId: auth.usuarioId, role: auth.role, canal, requestId, crearTicket };
    const publicTicket = (ticket: any) => ({ _id: String(ticket._id), titulo: ticket.titulo, estado: ticket.estado, respuesta_admin: ticket.respuesta_admin || '', updatedAt: ticket.updatedAt });
    const execute = async (state: MaxState) => runMaxTurn(input, state, {
      respond: async historial => await responderChatbotConDatos({
        role: auth.role, mensaje, historial, canal, usuarioId: auth.usuarioId,
      }),
      get: async id => publicTicket(await obtenerTicketSoporteAutorizado({ ticket_id: id, usuario_id: auth.usuarioId, role: auth.role })),
      create: async (draft, key, historial) => publicTicket(await crearTicketSoporte({
        usuario_id: auth.usuarioId, categoria: 'Chatbot SMART RH', prioridad: 'media',
        titulo: draft.titulo, descripcion: draft.descripcion + '\n\nConversación reportada:\n' + historial.filter(m => m.author === 'user').slice(-20).map(m => m.text).join('\n'),
        max_request_key: key,
        metadata: { origen: 'max_chatbot', canal, conversacion_id: conversationId },
      })),
    });
    // El historial aportado por el cliente sirve como reporte; nunca como prueba de un ticket.
    const seed: MaxState = { history: normalizeHistory(req.body).filter((m: any) => m.author === 'user') };
    let result;
    if (mongoose.connection.readyState === 1) {
      result = await withMaxSession(maxSessionKey(auth.usuarioId, auth.role, canal, conversationId), async state => {
        if (!state.history.length) state.history = seed.history;
        return execute(state);
      }, { usuarioId: auth.usuarioId, role: auth.role, canal });
    } else {
      if (crearTicket || /ticket|folio|soporte/i.test(mensaje) && !/^(cómo|como|dónde|donde)/i.test(mensaje)) {
        throw new AppError('Soporte no está disponible. No se confirmó ningún ticket nuevo. Intenta nuevamente cuando el servicio esté disponible.', 503);
      }
      result = await execute(seed);
    }
    res.status(result.created ? 201 : 200).json({ ok: true, respuesta: result.respuesta, ticket: result.ticket });
  } catch (error) {
    next(error);
  }
}

export async function sugerenciasChatbotController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const auth = requireAuth(req);

    res.json({
      ok: true,
      sugerencias: obtenerSugerenciasChatbot(auth.role),
    });
  } catch (error) {
    next(error);
  }
}


export async function eliminarConversacionMaxController(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const auth = requireAuth(req);
    if (mongoose.connection.readyState !== 1) throw new AppError('No pude eliminar el historial del servidor. Reintenta cuando el servicio esté disponible.', 503);
    const canal = normalizeChannel({ canal: req.query.canal });
    const owner = { usuarioId: auth.usuarioId, role: auth.role, canal };
    const id = req.params.id;
    if (id && !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new AppError('Conversación no válida.', 400);
    const filter = id ? { key: maxSessionKey(auth.usuarioId, auth.role, canal, id), ...owner } : owner;
    if (await MaxSessionModel.exists({ ...filter, lockUntil: { $gt: new Date() } })) throw new AppError('Hay un mensaje en proceso. Espera antes de eliminar el historial.', 409);
    await MaxSessionModel.deleteMany({ ...filter, $or: [{ lockUntil: { $exists: false } }, { lockUntil: { $lte: new Date() } }] });
    if (await MaxSessionModel.exists({ ...filter, lockUntil: { $gt: new Date() } })) throw new AppError('Un mensaje comenzó a procesarse. Reintenta la eliminación al terminar.', 409);
    res.json({ ok: true });
  } catch (error) { next(error); }
}
