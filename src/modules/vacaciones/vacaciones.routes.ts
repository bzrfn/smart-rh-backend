import { Router } from 'express';
import { authJwt } from '../../middlewares/authJwt.js';
import { requireRole } from '../../middlewares/requireRole.js';
import {
  approve,
  create,
  list,
  listMine,
  reject,
} from './vacaciones.controller.js';

export const vacacionesRoutes = Router();

vacacionesRoutes.get('/', authJwt, requireRole('admin'), list);
vacacionesRoutes.get('/me', authJwt, requireRole('empleado', 'admin'), listMine);
vacacionesRoutes.post('/', authJwt, requireRole('empleado', 'admin'), create);
vacacionesRoutes.patch('/:id/approve', authJwt, requireRole('admin'), approve);
vacacionesRoutes.patch('/:id/reject', authJwt, requireRole('admin'), reject);