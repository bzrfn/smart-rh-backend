import { Router } from 'express';
import { authJwt } from '../../middlewares/authJwt.js';
import { requireRole } from '../../middlewares/requireRole.js';
import {
  approveController,
  cleanupQrController,
  generateQrController,
  listAllController,
  listMineController,
  listMineWeeklyController,
  listPendientesController,
  rejectController,
  scanController,
  weeklyReportMineController,
} from './asistencia.controller.js';

export const asistenciaRoutes = Router();

asistenciaRoutes.post('/qr', authJwt, requireRole('admin'), generateQrController);
asistenciaRoutes.delete('/qr/expired', authJwt, requireRole('admin'), cleanupQrController);

asistenciaRoutes.post('/scan', authJwt, requireRole('admin', 'empleado'), scanController);

asistenciaRoutes.get('/me', authJwt, requireRole('admin', 'empleado'), listMineController);
asistenciaRoutes.get(
  '/me/weekly',
  authJwt,
  requireRole('admin', 'empleado'),
  listMineWeeklyController
);
asistenciaRoutes.get(
  '/me/weekly/report',
  authJwt,
  requireRole('admin', 'empleado'),
  weeklyReportMineController
);

asistenciaRoutes.get('/', authJwt, requireRole('admin'), listAllController);
asistenciaRoutes.get('/pendientes', authJwt, requireRole('admin'), listPendientesController);

asistenciaRoutes.patch('/:id/approve', authJwt, requireRole('admin'), approveController);
asistenciaRoutes.patch('/:id/reject', authJwt, requireRole('admin'), rejectController);