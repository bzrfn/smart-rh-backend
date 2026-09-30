import {
  Router,
} from 'express';

import {
  authJwt,
} from '../../middlewares/authJwt.js';

import {
  laboral,
} from './calendario.controller.js';


export const calendarioRoutes =
  Router();


calendarioRoutes.get(
  '/laboral',
  authJwt,
  laboral
);
