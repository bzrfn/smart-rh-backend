import { Router } from 'express';
import { authJwt } from '../../middlewares/authJwt.js';
import { obtenerResumenVisualController } from './analytics.controller.js';

const router = Router();

router.get('/resumen-visual', authJwt, obtenerResumenVisualController);

export default router;