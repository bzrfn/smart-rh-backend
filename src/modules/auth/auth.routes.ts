import { Router } from 'express';

import {
  adminAccessRoutes,
} from './adminAccess.routes.js';

import {
  adminInviteRoutes,
} from './adminInvite.routes.js';

import {
  forgotPasswordController,
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
authRoutes.post('/verify-login-code', verifyLoginCodeController);

authRoutes.post('/register', registerController);
authRoutes.post('/verify-account', verifyAccountController);

authRoutes.post('/forgot-password', forgotPasswordController);
authRoutes.post('/reset-password', resetPasswordController);