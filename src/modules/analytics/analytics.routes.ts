import { Router } from 'express';
import { authJwt } from '../../middlewares/authJwt.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { obtenerResumenVisualController } from './analytics.controller.js';

const router = Router();

// Endpoint administrativo para consultar el resumen visual del dashboard.
// authJwt valida la sesión y requireRole limita el acceso exclusivamente a administradores.
router.get(
  '/resumen-visual',
  authJwt,
  requireRole('admin'),
  obtenerResumenVisualController
);

export default router;
