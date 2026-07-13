import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/authJwt.js';
import {
  actualizarTicketSoporteAdmin,
  cerrarTicketSoporte,
  crearTicketSoporte,
  obtenerMisTicketsSoporte,
  obtenerResumenSoporte,
  obtenerResumenSoporteAdmin,
  obtenerTicketsSoporteAdmin,
} from './soporte.service.js';
import { AppError } from '../../utils/AppError.js';

function requireAuth(req: AuthRequest) {
  const usuarioId = req.auth?.userId;

  if (!usuarioId) {
    throw new AppError('Usuario no autenticado', 401);
  }

  return usuarioId;
}

function requireAdmin(req: AuthRequest) {
  const usuarioId = requireAuth(req);
  const role = String(req.auth?.role || '').toLowerCase();

  if (role !== 'admin') {
    throw new AppError('No tienes permisos para administrar soporte', 403);
  }

  return usuarioId;
}

export async function crearTicketSoporteController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const usuarioId = requireAuth(req);

    const ticket = await crearTicketSoporte({
      usuario_id: usuarioId,
      categoria: req.body?.categoria,
      titulo: req.body?.titulo,
      descripcion: req.body?.descripcion,
      prioridad: req.body?.prioridad,
      metadata: {
        ip: req.ip,
        user_agent: req.headers['user-agent'],
      },
    });

    res.status(201).json({
      ok: true,
      message: 'Ticket de soporte registrado correctamente',
      ticket,
    });
  } catch (error) {
    next(error);
  }
}

export async function obtenerMisTicketsSoporteController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const usuarioId = requireAuth(req);
    const tickets = await obtenerMisTicketsSoporte(usuarioId);

    res.json({
      ok: true,
      total: tickets.length,
      tickets,
    });
  } catch (error) {
    next(error);
  }
}

export async function obtenerResumenSoporteController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const usuarioId = requireAuth(req);
    const resumen = await obtenerResumenSoporte(usuarioId);

    res.json({
      ok: true,
      resumen,
    });
  } catch (error) {
    next(error);
  }
}

export async function cerrarTicketSoporteController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const usuarioId = requireAuth(req);

    const ticket = await cerrarTicketSoporte({
      usuario_id: usuarioId,
      ticket_id: req.params.id,
    });

    res.json({
      ok: true,
      message: 'Ticket cerrado correctamente',
      ticket,
    });
  } catch (error) {
    next(error);
  }
}

export async function obtenerTicketsSoporteAdminController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    requireAdmin(req);

    const tickets = await obtenerTicketsSoporteAdmin({
      estado: String(req.query.estado || 'todos'),
      categoria: String(req.query.categoria || 'todas'),
      prioridad: String(req.query.prioridad || 'todas'),
      search: String(req.query.search || ''),
    });

    res.json({
      ok: true,
      total: tickets.length,
      tickets,
    });
  } catch (error) {
    next(error);
  }
}

export async function obtenerResumenSoporteAdminController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    requireAdmin(req);

    const resumen = await obtenerResumenSoporteAdmin();

    res.json({
      ok: true,
      resumen,
    });
  } catch (error) {
    next(error);
  }
}

export async function actualizarTicketSoporteAdminController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const adminId = requireAdmin(req);

    const ticket = await actualizarTicketSoporteAdmin({
      ticket_id: req.params.id,
      estado: req.body?.estado,
      prioridad: req.body?.prioridad,
      respuesta_admin: req.body?.respuesta_admin,
      admin_id: adminId,
    });

    res.json({
      ok: true,
      message: 'Ticket actualizado correctamente',
      ticket,
    });
  } catch (error) {
    next(error);
  }
}