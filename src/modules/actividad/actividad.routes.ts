import { Router } from 'express';
import { authJwt } from '../../middlewares/authJwt.js';
import { obtenerMiActividadController } from './actividad.controller.js';

export const actividadRoutes = Router();

actividadRoutes.get('/mi-actividad', authJwt, obtenerMiActividadController);