import { Router } from 'express';
import { authJwt } from '../../middlewares/authJwt.js';
import {
  generarContratoPdfController,
  generarCredencialImagenController,
  uploadFotoPerfilController,
} from './documentos.controller.js';

export const documentosRoutes = Router();

documentosRoutes.patch(
  '/usuarios/:usuarioId/foto-perfil',
  authJwt,
  uploadFotoPerfilController
);

documentosRoutes.post(
  '/usuarios/:usuarioId/contrato-pdf',
  authJwt,
  generarContratoPdfController
);

documentosRoutes.post(
  '/usuarios/:usuarioId/credencial-imagen',
  authJwt,
  generarCredencialImagenController
);

documentosRoutes.post(
  '/usuarios/:usuarioId/credencial-pdf',
  authJwt,
  generarCredencialImagenController
);