import {
  Router,
} from 'express';

import {
  authJwt,
} from '../../middlewares/authJwt.js';

import {
  requireRole,
} from '../../middlewares/requireRole.js';

import {
  acceptAdminInvitationController,
  requestAdminInvitationController,
} from './adminInvite.controller.js';


export const adminInviteRoutes =
  Router();


adminInviteRoutes.post(
  '/',
  authJwt,
  requireRole(
    'admin'
  ),
  requestAdminInvitationController
);


adminInviteRoutes.post(
  '/accept',
  acceptAdminInvitationController
);
