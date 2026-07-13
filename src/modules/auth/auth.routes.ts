import { Router } from 'express';
import {
  forgotPasswordController,
  loginController,
  registerController,
  resetPasswordController,
  verifyAccountController,
  verifyLoginCodeController,
} from './auth.controller.js';

export const authRoutes = Router();

authRoutes.post('/login', loginController);
authRoutes.post('/verify-login-code', verifyLoginCodeController);

authRoutes.post('/register', registerController);
authRoutes.post('/verify-account', verifyAccountController);

authRoutes.post('/forgot-password', forgotPasswordController);
authRoutes.post('/reset-password', resetPasswordController);