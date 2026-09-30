import {
  NextFunction,
  Response,
} from 'express';
import { AuthRequest } from '../../middlewares/authJwt.js';
import { AppError } from '../../utils/AppError.js';
import {
  crearTicketDesdeChatbot,
  obtenerSugerenciasChatbot,
  responderChatbot,
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
  return Boolean(
    body?.crear_ticket ||
      body?.crearTicket ||
      body?.escalar ||
      body?.crear_soporte
  );
}

export async function responderChatbotController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const auth = requireAuth(req);
    const mensaje = String(req.body?.mensaje || '').trim();

    const respuesta = responderChatbot({
      role: auth.role,
      mensaje,
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
