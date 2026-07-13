import { Router } from 'express';
import {
  entrenarModeloMLController,
  obtenerDatasetMLController,
  obtenerEvaluacionMLController,
  obtenerPrediccionesMLController,
  obtenerResumenMLController,
} from './ml.controller.js';

export const mlRoutes = Router();

mlRoutes.get('/dataset', obtenerDatasetMLController);
mlRoutes.get('/resumen', obtenerResumenMLController);
mlRoutes.get('/predicciones', obtenerPrediccionesMLController);
mlRoutes.get('/evaluacion', obtenerEvaluacionMLController);
mlRoutes.post('/entrenar', entrenarModeloMLController);