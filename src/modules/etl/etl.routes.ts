import { Router } from 'express';
import { ETLController } from './etl.controller.js';

const router = Router();

router.post('/ejecutar', ETLController.ejecutarETL);
router.post('/reportes', ETLController.generarReporteETL);
router.get('/archivos', ETLController.listarArchivos);
router.get('/archivo/:filename', ETLController.descargarArchivo);

export const etlRoutes = router;