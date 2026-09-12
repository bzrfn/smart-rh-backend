import { Router } from 'express';

import {
  authJwt,
} from '../../middlewares/authJwt.js';

import {
  requireSelfOrRole,
} from '../../middlewares/requireSelfOrRole.js';

import {
  generarContratoPdfController,
  generarCredencialImagenController,
  uploadFotoPerfilController,
} from './documentos.controller.js';


export const documentosRoutes =
  Router();


/**
 * FOTO DE PERFIL
 *
 * Permitido:
 * - propio usuario
 * - administrador
 */
documentosRoutes.patch(
  '/usuarios/:usuarioId/foto-perfil',
  authJwt,
  requireSelfOrRole(
    'usuarioId',
    'admin'
  ),
  uploadFotoPerfilController
);


/**
 * CONTRATO PDF
 *
 * Permitido:
 * - propio usuario
 * - administrador
 */
documentosRoutes.post(
  '/usuarios/:usuarioId/contrato-pdf',
  authJwt,
  requireSelfOrRole(
    'usuarioId',
    'admin'
  ),
  generarContratoPdfController
);


/**
 * CREDENCIAL IMAGEN
 *
 * Permitido:
 * - propio usuario
 * - administrador
 */
documentosRoutes.post(
  '/usuarios/:usuarioId/credencial-imagen',
  authJwt,
  requireSelfOrRole(
    'usuarioId',
    'admin'
  ),
  generarCredencialImagenController
);


/**
 * Alias histórico.
 *
 * Se mantiene por compatibilidad con clientes
 * anteriores de SMART RH.
 */
documentosRoutes.post(
  '/usuarios/:usuarioId/credencial-pdf',
  authJwt,
  requireSelfOrRole(
    'usuarioId',
    'admin'
  ),
  generarCredencialImagenController
);
