import { Router } from 'express';
import { authJwt } from '../../middlewares/authJwt.js';
import { requireRole } from '../../middlewares/requireRole.js';
import {
  create,
  listAll,
  listByUser,
  listMine,
  update,
  updateEstado,
} from './nomina.controller.js';

export const nominaRoutes = Router();

nominaRoutes.get('/', authJwt, requireRole('admin'), listAll);
nominaRoutes.get('/me', authJwt, requireRole('admin', 'empleado'), listMine);
nominaRoutes.get('/user/:usuarioId', authJwt, requireRole('admin'), listByUser);
nominaRoutes.post('/', authJwt, requireRole('admin'), create);
nominaRoutes.put('/:id', authJwt, requireRole('admin'), update);
nominaRoutes.patch('/:id/estado', authJwt, requireRole('admin'), updateEstado);