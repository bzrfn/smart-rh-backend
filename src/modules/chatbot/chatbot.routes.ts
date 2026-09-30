import { Router } from 'express';
import { authJwt } from '../../middlewares/authJwt.js';
import {
  responderChatbotController,
  sugerenciasChatbotController,
} from './chatbot.controller.js';

export const chatbotRoutes = Router();

chatbotRoutes.get(
  '/sugerencias',
  authJwt,
  sugerenciasChatbotController
);

chatbotRoutes.post(
  '/mensaje',
  authJwt,
  responderChatbotController
);
