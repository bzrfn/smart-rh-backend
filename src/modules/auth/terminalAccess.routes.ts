import {
  Router,
} from 'express';

import {
  requireTerminalApprover,
} from '../../middlewares/requireTerminalApprover.js';

import {
  authJwt,
} from '../../middlewares/authJwt.js';

import {
  requireRole,
} from '../../middlewares/requireRole.js';

import {
  createTerminalSessionController,
  requestTerminalAccessController,
  terminalAccessDecisionController,
  terminalAccessStatusController,
} from './terminalAccess.controller.js';

export const terminalAccessRoutes =
  Router();

terminalAccessRoutes.post(
  '/request',
  requestTerminalAccessController
);

terminalAccessRoutes.get(
  '/status',
  terminalAccessStatusController
);

terminalAccessRoutes.post(
  '/decision',
  authJwt,
  requireRole('admin'),
  requireTerminalApprover,
  terminalAccessDecisionController
);

terminalAccessRoutes.post(
  '/session',
  createTerminalSessionController
);
