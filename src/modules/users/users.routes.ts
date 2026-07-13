import { Router } from 'express';
import { authJwt } from '../../middlewares/authJwt.js';
import { requireRole } from '../../middlewares/requireRole.js';
import {
  createUserController,
  deleteUserController,
  listUsersController,
  setActiveController,
  setVacationDaysController,
  updateUserController,
} from './users.controller.js';

export const userRoutes = Router();

userRoutes.get('/', authJwt, requireRole('admin'), listUsersController);
userRoutes.post('/', authJwt, requireRole('admin'), createUserController);
userRoutes.put('/:id', authJwt, requireRole('admin'), updateUserController);
userRoutes.patch('/:id/active', authJwt, requireRole('admin'), setActiveController);
userRoutes.patch('/:id/vacation-days', authJwt, requireRole('admin'), setVacationDaysController);
userRoutes.delete('/:id', authJwt, requireRole('admin'), deleteUserController);