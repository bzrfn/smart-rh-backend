import { Router } from 'express';

import { ETLController } from './etl.controller.js';

import {
  authJwt,
} from '../../middlewares/authJwt.js';

import {
  requireRole,
} from '../../middlewares/requireRole.js';


const router = Router();


// ============================================================
// SEGURIDAD ETL
//
// Todos los endpoints ETL contienen información sensible
// de Recursos Humanos.
//
// Flujo:
//
// Request
//   ↓
// authJwt
//   ↓
// requireRole('Admin')
//   ↓
// ETLController
//
// Sin token       -> 401
// Token inválido  -> 401
// No Admin        -> 403
// Admin           -> acceso permitido
// ============================================================

router.use(
  authJwt,
  requireRole('Admin')
);


// ============================================================
// EJECUTAR ETL
// ============================================================

router.post(
  '/ejecutar',
  ETLController.ejecutarETL
);


// ============================================================
// GENERAR REPORTE
// ============================================================

router.post(
  '/reportes',
  ETLController.generarReporteETL
);


// ============================================================
// LISTAR ARCHIVOS GENERADOS
// ============================================================

router.get(
  '/archivos',
  ETLController.listarArchivos
);


// ============================================================
// DESCARGAR ARCHIVO
// ============================================================

router.get(
  '/archivo/:filename',
  ETLController.descargarArchivo
);


export const etlRoutes = router;