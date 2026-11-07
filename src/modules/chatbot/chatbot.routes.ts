import { Router } from 'express';
import { authJwt } from '../../middlewares/authJwt.js';
import {
  responderChatbotController,
  eliminarConversacionMaxController,
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

chatbotRoutes.delete('/conversaciones/:id', authJwt, eliminarConversacionMaxController);
chatbotRoutes.delete('/conversaciones', authJwt, eliminarConversacionMaxController);
