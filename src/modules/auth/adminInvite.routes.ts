import { resendExistingAccountController } from './adminInvite.controller.js';
import { listPendingInvitationsController, resendInvitationController } from './adminInvite.controller.js';
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

adminInviteRoutes.get('/', authJwt, requireRole('admin'), listPendingInvitationsController);
adminInviteRoutes.post('/:id/resend', authJwt, requireRole('admin'), resendInvitationController);

adminInviteRoutes.post('/users/:userId/resend', authJwt, requireRole('admin'), resendExistingAccountController);
