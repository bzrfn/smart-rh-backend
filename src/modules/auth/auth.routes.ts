import { Router } from 'express';

import {
  requireAdminAccess,
} from '../../middlewares/requireAdminAccess.js';


import {
  adminAccessRoutes,
} from './adminAccess.routes.js';

import {
  adminInviteRoutes,
} from './adminInvite.routes.js';

import {
  forgotPasswordController,
  adminLoginController,
  loginController,
  registerController,
  resetPasswordController,
  verifyAccountController,
  verifyLoginCodeController,
} from './auth.controller.js';

export const authRoutes = Router();
authRoutes.use(
  '/admin-access',
  adminAccessRoutes
);


authRoutes.use(
  '/admin-invitations',
  adminInviteRoutes
);


authRoutes.post('/login', loginController);

authRoutes.post(
  '/admin-login',
  requireAdminAccess,
  adminLoginController
);
authRoutes.post('/verify-login-code', verifyLoginCodeController);

authRoutes.post('/register', registerController);
authRoutes.post('/verify-account', verifyAccountController);

authRoutes.post('/forgot-password', forgotPasswordController);
authRoutes.post('/reset-password', resetPasswordController);