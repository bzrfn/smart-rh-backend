import mongoose from 'mongoose';
import { pool } from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';
import { SoporteTicketModel } from './soporte.model.js';
import { registrarActividadEmpleado } from '../actividad/actividad.service.js';
import { crearNotificacionSoporte } from '../notificaciones/notificaciones.service.js';

type EstadoTicket = 'abierto' | 'en_revision' | 'resuelto' | 'cerrado';
type PrioridadTicket = 'baja' | 'media' | 'alta';

function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

function normalizarPrioridad(value?: string): PrioridadTicket {
  const prioridad = String(value || 'media').trim().toLowerCase();

  if (['baja', 'media', 'alta'].includes(prioridad)) {
    return prioridad as PrioridadTicket;
  }

  throw new AppError('La prioridad no es válida', 400);
}

function normalizarEstado(value?: string): EstadoTicket {
  const estado = String(value || '').trim().toLowerCase();

  if (['abierto', 'en_revision', 'resuelto', 'cerrado'].includes(estado)) {
    return estado as EstadoTicket;
  }

  throw new AppError('El estado no es válido', 400);
}

function validarObjectId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('El ticket no es válido', 400);
  }
}

function estadoLegible(estado: EstadoTicket) {
  const map: Record<EstadoTicket, string> = {
    abierto: 'abierto',
    en_revision: 'en revisión',
    resuelto: 'resuelto',
    cerrado: 'cerrado',
  };

  return map[estado];
}

function crearMensajeNotificacionSoporte(data: {
  tituloTicket: string;
  estadoActual: EstadoTicket;
  respuestaAdmin?: string;
  estadoCambio: boolean;
  respuestaCambio: boolean;
}) {
  const respuesta = String(data.respuestaAdmin || '').trim();

  if (data.estadoCambio && data.estadoActual === 'en_revision') {
    return {
      tipo: 'SOPORTE_EN_REVISION',
      titulo: 'Ticket en revisión',
      mensaje: `Tu reporte "${data.tituloTicket}" está siendo revisado por el área administrativa.${
        respuesta ? ` Mensaje: ${respuesta}` : ''
      }`,
    };
  }

  if (data.estadoCambio && data.estadoActual === 'resuelto') {
    return {
      tipo: 'SOPORTE_RESUELTO',
      titulo: 'Ticket resuelto',
      mensaje: `Tu reporte "${data.tituloTicket}" fue marcado como resuelto.${
        respuesta ? ` Mensaje: ${respuesta}` : ''
      }`,
    };
  }

  if (data.estadoCambio && data.estadoActual === 'cerrado') {
    return {
      tipo: 'SOPORTE_CERRADO',
      titulo: 'Ticket cerrado',
      mensaje: `Tu reporte "${data.tituloTicket}" fue cerrado por el área administrativa.${
        respuesta ? ` Mensaje: ${respuesta}` : ''
      }`,
    };
  }

  if (data.estadoCambio && data.estadoActual === 'abierto') {
    return {
      tipo: 'SOPORTE_ABIERTO',
      titulo: 'Ticket abierto',
      mensaje: `Tu reporte "${data.tituloTicket}" fue actualizado a estado abierto.${
        respuesta ? ` Mensaje: ${respuesta}` : ''
      }`,
    };
  }

  if (data.respuestaCambio && respuesta) {
    return {
      tipo: 'SOPORTE_RESPUESTA_ADMIN',
      titulo: 'Nueva respuesta de soporte',
      mensaje: `El área administrativa respondió tu reporte "${data.tituloTicket}". Mensaje: ${respuesta}`,
    };
  }

  return null;
}

async function obtenerUsuariosMap() {
  try {
    const [rows] = await pool.query(`
      SELECT 
        id,
        nombre,
        apellido,
        correo,
        rol_id
      FROM usuarios
    `);

    const map = new Map<number, any>();

    for (const row of rows as any[]) {
      map.set(Number(row.id), {
        id: Number(row.id),
        nombre: row.nombre,
        apellido: row.apellido,
        correo: row.correo,
        rol_id: row.rol_id,
      });
    }

    return map;
  } catch {
    return new Map<number, any>();
  }
}

async function enriquecerTicketsConUsuario(tickets: any[]) {
  const usuariosMap = await obtenerUsuariosMap();

  return tickets.map((ticket) => {
    const usuario = usuariosMap.get(Number(ticket.usuario_id));

    return {
      ...ticket,
      usuario: usuario || null,
    };
  });
}

export async function crearTicketSoporte(data: {
  usuario_id: number;
  categoria: string;
  titulo: string;
  descripcion: string;
  prioridad?: string;
  metadata?: Record<string, any>;
}) {
  if (!isMongoConnected()) {
    throw new AppError('MongoDB no está conectado. No se pudo registrar el ticket.', 500);
  }

  const categoria = String(data.categoria || '').trim();
  const titulo = String(data.titulo || '').trim();
  const descripcion = String(data.descripcion || '').trim();
  const prioridad = normalizarPrioridad(data.prioridad);

  if (!categoria) {
    throw new AppError('La categoría es obligatoria', 400);
  }

  if (!titulo) {
    throw new AppError('El título es obligatorio', 400);
  }

  if (!descripcion) {
    throw new AppError('La descripción es obligatoria', 400);
  }

  const ticket = await SoporteTicketModel.create({
    usuario_id: data.usuario_id,
    categoria,
    titulo,
    descripcion,
    prioridad,
    estado: 'abierto',
    respuesta_admin: '',
    metadata: data.metadata ?? {},
  });

  await registrarActividadEmpleado({
    usuario_id: data.usuario_id,
    tipo: 'TICKET_SOPORTE',
    titulo: 'Reporte de soporte enviado',
    descripcion: `El usuario registró una incidencia de soporte: ${titulo}.`,
    modulo: 'soporte',
    origen: 'mobile',
    metadata: {
      ticket_id: ticket._id,
      categoria,
      prioridad,
    },
  });

  return ticket;
}

export async function obtenerMisTicketsSoporte(usuario_id: number) {
  if (!isMongoConnected()) return [];

  return await SoporteTicketModel.find({ usuario_id })
    .sort({ createdAt: -1 })
    .lean();
}

export async function obtenerResumenSoporte(usuario_id: number) {
  if (!isMongoConnected()) {
    return {
      total: 0,
      abiertos: 0,
      en_revision: 0,
      resueltos: 0,
      cerrados: 0,
    };
  }

  const tickets = await SoporteTicketModel.find({ usuario_id }).lean();

  return {
    total: tickets.length,
    abiertos: tickets.filter((t) => t.estado === 'abierto').length,
    en_revision: tickets.filter((t) => t.estado === 'en_revision').length,
    resueltos: tickets.filter((t) => t.estado === 'resuelto').length,
    cerrados: tickets.filter((t) => t.estado === 'cerrado').length,
  };
}

export async function cerrarTicketSoporte(data: {
  usuario_id: number;
  ticket_id: string;
}) {
  if (!isMongoConnected()) {
    throw new AppError('MongoDB no está conectado. No se pudo cerrar el ticket.', 500);
  }

  validarObjectId(data.ticket_id);

  const ticket = await SoporteTicketModel.findOne({
    _id: data.ticket_id,
    usuario_id: data.usuario_id,
  });

  if (!ticket) {
    throw new AppError('Ticket no encontrado', 404);
  }

  ticket.estado = 'cerrado';
  await ticket.save();

  await registrarActividadEmpleado({
    usuario_id: data.usuario_id,
    tipo: 'TICKET_CERRADO',
    titulo: 'Ticket de soporte cerrado',
    descripcion: `El usuario cerró el ticket: ${ticket.titulo}.`,
    modulo: 'soporte',
    origen: 'mobile',
    metadata: {
      ticket_id: ticket._id,
      categoria: ticket.categoria,
    },
  });

  return ticket;
}

export async function obtenerTicketsSoporteAdmin(filters?: {
  estado?: string;
  categoria?: string;
  prioridad?: string;
  search?: string;
}) {
  if (!isMongoConnected()) return [];

  const query: Record<string, any> = {};

  if (filters?.estado && filters.estado !== 'todos') {
    query.estado = normalizarEstado(filters.estado);
  }

  if (filters?.categoria && filters.categoria !== 'todas') {
    query.categoria = filters.categoria;
  }

  if (filters?.prioridad && filters.prioridad !== 'todas') {
    query.prioridad = normalizarPrioridad(filters.prioridad);
  }

  if (filters?.search) {
    const search = String(filters.search).trim();

    if (search) {
      query.$or = [
        { titulo: { $regex: search, $options: 'i' } },
        { descripcion: { $regex: search, $options: 'i' } },
        { categoria: { $regex: search, $options: 'i' } },
      ];
    }
  }

  const tickets = await SoporteTicketModel.find(query)
    .sort({ createdAt: -1 })
    .lean();

  return await enriquecerTicketsConUsuario(tickets);
}

export async function obtenerResumenSoporteAdmin() {
  if (!isMongoConnected()) {
    return {
      total: 0,
      abiertos: 0,
      en_revision: 0,
      resueltos: 0,
      cerrados: 0,
      alta_prioridad: 0,
    };
  }

  const tickets = await SoporteTicketModel.find({}).lean();

  return {
    total: tickets.length,
    abiertos: tickets.filter((t) => t.estado === 'abierto').length,
    en_revision: tickets.filter((t) => t.estado === 'en_revision').length,
    resueltos: tickets.filter((t) => t.estado === 'resuelto').length,
    cerrados: tickets.filter((t) => t.estado === 'cerrado').length,
    alta_prioridad: tickets.filter((t) => t.prioridad === 'alta').length,
  };
}

export async function actualizarTicketSoporteAdmin(data: {
  ticket_id: string;
  estado?: string;
  prioridad?: string;
  respuesta_admin?: string;
  admin_id?: number;
}) {
  if (!isMongoConnected()) {
    throw new AppError('MongoDB no está conectado. No se pudo actualizar el ticket.', 500);
  }

  validarObjectId(data.ticket_id);

  const ticket = await SoporteTicketModel.findById(data.ticket_id);

  if (!ticket) {
    throw new AppError('Ticket no encontrado', 404);
  }

  const estadoAnterior = ticket.estado as EstadoTicket;
  const prioridadAnterior = ticket.prioridad as PrioridadTicket;
  const respuestaAnterior = String(ticket.respuesta_admin || '').trim();

  let estadoNuevo = estadoAnterior;
  let prioridadNueva = prioridadAnterior;
  let respuestaNueva = respuestaAnterior;

  if (data.estado) {
    estadoNuevo = normalizarEstado(data.estado);
    ticket.estado = estadoNuevo;
  }

  if (data.prioridad) {
    prioridadNueva = normalizarPrioridad(data.prioridad);
    ticket.prioridad = prioridadNueva;
  }

  if (typeof data.respuesta_admin === 'string') {
    respuestaNueva = data.respuesta_admin.trim();
    ticket.respuesta_admin = respuestaNueva;
  }

  await ticket.save();

  const estadoCambio = estadoAnterior !== estadoNuevo;
  const prioridadCambio = prioridadAnterior !== prioridadNueva;
  const respuestaCambio = respuestaAnterior !== respuestaNueva && respuestaNueva.length > 0;

  await registrarActividadEmpleado({
    usuario_id: Number(ticket.usuario_id),
    tipo: 'TICKET_ACTUALIZADO',
    titulo: 'Ticket de soporte actualizado',
    descripcion: `El administrador actualizó el ticket "${ticket.titulo}" a estado ${estadoLegible(
      estadoNuevo
    )}.`,
    modulo: 'soporte',
    origen: 'web',
    metadata: {
      ticket_id: ticket._id,
      estado_anterior: estadoAnterior,
      estado: estadoNuevo,
      prioridad_anterior: prioridadAnterior,
      prioridad: prioridadNueva,
      prioridad_cambio: prioridadCambio,
      respuesta_cambio: respuestaCambio,
      admin_id: data.admin_id,
    },
  });

  const notificacion = crearMensajeNotificacionSoporte({
    tituloTicket: ticket.titulo,
    estadoActual: estadoNuevo,
    respuestaAdmin: respuestaNueva,
    estadoCambio,
    respuestaCambio,
  });

  if (notificacion) {
    await crearNotificacionSoporte({
      usuario_id: Number(ticket.usuario_id),
      tipo: notificacion.tipo,
      titulo: notificacion.titulo,
      mensaje: notificacion.mensaje,
      ticket_id: String(ticket._id),
      estado: estadoNuevo,
      categoria: ticket.categoria,
      prioridad: prioridadNueva,
      respuesta_admin: respuestaNueva,
      admin_id: data.admin_id,
    });
  }

  return ticket;
}