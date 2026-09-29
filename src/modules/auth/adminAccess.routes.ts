import {
  Router,
} from 'express';

import {
  requestAdminAccessController,
  verifyAdminAccessController,
} from './adminAccess.controller.js';


export const adminAccessRoutes =
  Router();


adminAccessRoutes.post(
  '/request',
  requestAdminAccessController
);


adminAccessRoutes.post(
  '/verify',
  verifyAdminAccessController
);
