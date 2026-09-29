import {
  Router,
} from 'express';

import {
  requireTerminalSession,
} from '../../middlewares/requireTerminalSession.js';

import {
  generateTerminalQrController,
} from './terminal.controller.js';

export const terminalRoutes =
  Router();

terminalRoutes.get(
  '/qr',
  requireTerminalSession,
  generateTerminalQrController
);
