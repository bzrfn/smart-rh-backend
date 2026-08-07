import { Router } from 'express';
import { authJwt } from '../../middlewares/authJwt.js';
import {
  entrenarKMeansController,
  obtenerDatasetController,
  obtenerElbowController,
} from './kmeans.controller.js';

const kmeansRoutes = Router();

// Endpoint para obtener el dataset preparado para el análisis de K-Means.
kmeansRoutes.get('/dataset', authJwt, obtenerDatasetController);

// Endpoint para ejecutar el análisis de codo y sugerir un valor de k.
kmeansRoutes.get('/elbow', authJwt, obtenerElbowController);

// Endpoint para entrenar el modelo de K-Means con los parámetros enviados por el cliente.
kmeansRoutes.post('/entrenar', authJwt, entrenarKMeansController);

export { kmeansRoutes };
export default kmeansRoutes;