import { Router } from 'express';
import { authJwt } from '../../middlewares/authJwt.js';
import {
  obtenerMisNotificacionesController,
  marcarNotificacionLeidaController,
} from './notificaciones.controller.js';

export const notificacionesRoutes = Router();

notificacionesRoutes.get(
  '/mis-notificaciones',
  authJwt,
  obtenerMisNotificacionesController
);

notificacionesRoutes.patch(
  '/:id/leida',
  authJwt,
  marcarNotificacionLeidaController
);