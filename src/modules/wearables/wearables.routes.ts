import { Router } from 'express';
import { authJwt } from '../../middlewares/authJwt.js';
import {
  crearEventoController,
  crearSensoresController,
  desvincularDispositivoController,
  enviarNotificacionController,
  generarCodigoPairingController,
  listarDispositivosController,
  listarEventosController,
  listarMisDispositivosController,
  listarNotificacionesController,
  listarSensoresController,
  marcarNotificacionLeidaController,
  obtenerDispositivoController,
  vincularDispositivoController,
} from './wearables.controller.js';

const wearablesRoutes = Router();

wearablesRoutes.post('/pairing-code', authJwt, generarCodigoPairingController);

wearablesRoutes.get('/mis-dispositivos', authJwt, listarMisDispositivosController);

wearablesRoutes.patch(
  '/device/:deviceId/unpair',
  authJwt,
  desvincularDispositivoController
);

wearablesRoutes.post('/pair', vincularDispositivoController);

wearablesRoutes.get('/device/:deviceId', obtenerDispositivoController);

wearablesRoutes.get('/dispositivos', listarDispositivosController);

wearablesRoutes.post('/eventos', crearEventoController);
wearablesRoutes.get('/eventos', listarEventosController);

wearablesRoutes.post('/sensores', crearSensoresController);
wearablesRoutes.get('/sensores/:deviceId', listarSensoresController);

wearablesRoutes.post('/notificaciones', enviarNotificacionController);
wearablesRoutes.get('/notificaciones/:deviceId', listarNotificacionesController);
wearablesRoutes.patch('/notificaciones/:id/leida', marcarNotificacionLeidaController);

export { wearablesRoutes };
export default wearablesRoutes;