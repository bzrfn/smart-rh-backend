import { Router } from 'express';
import { authJwt } from '../../middlewares/authJwt.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { requireModule } from '../../middlewares/requireModule.js';
import {
  create,
  listAll,
  listByUser,
  listMine,
  update,
  updateEstado,
} from './contratos.controller.js';

export const contratoRoutes = Router();

contratoRoutes.get(
  '/',
  authJwt,
  requireRole('admin'),
  listAll
);

contratoRoutes.get(
  '/me',
  authJwt,
  requireRole('admin', 'empleado'),
  requireModule('contratos'),
  listMine
);

contratoRoutes.get(
  '/user/:usuarioId',
  authJwt,
  requireRole('admin'),
  listByUser
);

contratoRoutes.post(
  '/',
  authJwt,
  requireRole('admin'),
  create
);

contratoRoutes.put(
  '/:id',
  authJwt,
  requireRole('admin'),
  update
);

contratoRoutes.patch(
  '/:id/estado',
  authJwt,
  requireRole('admin'),
  updateEstado
);
