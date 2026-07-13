import { Router } from 'express';
import { authJwt } from '../../middlewares/authJwt.js';
import { requireRole } from '../../middlewares/requireRole.js';
import {
  getMyPermisosController,
  getUserPermisosController,
  updatePermisosController,
} from './permisos.controller.js';

export const permisosRoutes = Router();

permisosRoutes.get('/me', authJwt, getMyPermisosController);
permisosRoutes.get('/:userId', authJwt, requireRole('admin'), getUserPermisosController);
permisosRoutes.put('/:userId', authJwt, requireRole('admin'), updatePermisosController);