import { Router } from 'express';
import { authJwt } from '../../middlewares/authJwt.js';
import {
  entrenarKMeansController,
  obtenerDatasetController,
  obtenerElbowController,
} from './kmeans.controller.js';

const kmeansRoutes = Router();

kmeansRoutes.get('/dataset', authJwt, obtenerDatasetController);
kmeansRoutes.get('/elbow', authJwt, obtenerElbowController);
kmeansRoutes.post('/entrenar', authJwt, entrenarKMeansController);

export { kmeansRoutes };
export default kmeansRoutes;