import {
  NextFunction,
  Response,
} from 'express';
import { AuthRequest } from '../../middlewares/authJwt.js';
import { AppError } from '../../utils/AppError.js';
import {
  crearTicketDesdeChatbot,
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

function shouldCreateTicket(body: any) {
  const mensaje = String(body?.mensaje || '').trim().toLowerCase();
  const isConfirmation = /^(si|sí|va|ok|dale|adelante|confirmo|confirmado|crealo|créalo|hazlo|de acuerdo|correcto)$/.test(
    mensaje
  );
  const history = normalizeHistory(body);
  const recentTicketAlreadyCreated = history.some(
    (item: { author: string; text: string }) =>
      item.author === 'assistant' &&
      /cree el ticket con folio|creé el ticket con folio|envie la consulta a soporte|envié la consulta a soporte|ticket con folio/i.test(
        item.text
      )
  );

  if (recentTicketAlreadyCreated) {
    return false;
  }

  const recentTicketOffer = history.some(
    (item: { author: string; text: string }) =>
      item.author === 'assistant' &&
      /crear ticket|ticket con contexto|quieres que cree|quieres crear|puedo crear un ticket/i.test(
        item.text
      )
  );

  return Boolean(
    body?.crear_ticket ||
      body?.crearTicket ||
      body?.escalar ||
      body?.crear_soporte ||
      (isConfirmation && recentTicketOffer)
  );
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
    .slice(-6)
    .map((item: any) => ({
      author:
        item?.author === 'assistant' || item?.role === 'assistant'
          ? 'assistant'
          : 'user',
      text: String(item?.text || item?.content || '').slice(0, 700),
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

    const respuesta = await responderChatbotConDatos({
      role: auth.role,
      mensaje,
      historial: normalizeHistory(req.body),
      canal: normalizeChannel(req.body),
      usuarioId: auth.usuarioId,
    });

    let ticket = null;

    if (shouldCreateTicket(req.body)) {
      ticket = await crearTicketDesdeChatbot({
        usuario_id: auth.usuarioId,
        mensaje,
        respuesta,
      });
    }

    res.status(ticket ? 201 : 200).json({
      ok: true,
      respuesta,
      ticket,
    });
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
