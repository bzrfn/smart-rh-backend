import { Router } from 'express';
import { authJwt } from '../../middlewares/authJwt.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { listRolesController } from './roles.controller.js';
export const roleRoutes = Router();
roleRoutes.get('/', authJwt, requireRole('admin'), listRolesController);
