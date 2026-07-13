import { Router } from 'express';
import { authJwt } from '../../middlewares/authJwt.js';
import {
  actualizarTicketSoporteAdminController,
  cerrarTicketSoporteController,
  crearTicketSoporteController,
  obtenerMisTicketsSoporteController,
  obtenerResumenSoporteAdminController,
  obtenerResumenSoporteController,
  obtenerTicketsSoporteAdminController,
} from './soporte.controller.js';

export const soporteRoutes = Router();

/**
 * Rutas del empleado móvil
 */
soporteRoutes.get(
  '/mis-tickets',
  authJwt,
  obtenerMisTicketsSoporteController
);

soporteRoutes.get(
  '/resumen',
  authJwt,
  obtenerResumenSoporteController
);

soporteRoutes.post(
  '/mis-tickets',
  authJwt,
  crearTicketSoporteController
);

soporteRoutes.patch(
  '/mis-tickets/:id/cerrar',
  authJwt,
  cerrarTicketSoporteController
);

/**
 * Rutas administrativas web
 */
soporteRoutes.get(
  '/tickets',
  authJwt,
  obtenerTicketsSoporteAdminController
);

soporteRoutes.get(
  '/admin/resumen',
  authJwt,
  obtenerResumenSoporteAdminController
);

soporteRoutes.patch(
  '/tickets/:id',
  authJwt,
  actualizarTicketSoporteAdminController
);