import type { Request, Response, NextFunction } from 'express';
import { obtenerResumenVisualService } from './analytics.service.js';

// Controlador que responde a la petición HTTP para devolver el resumen visual del dashboard.
export async function obtenerResumenVisualController(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Llama al servicio para generar el resumen completo del análisis.
    const result = await obtenerResumenVisualService();

    // Envía la respuesta al cliente en formato JSON.
    res.json(result);
  } catch (error) {
    // Pasa cualquier error al middleware siguiente para manejarlo centralmente.
    next(error);
  }
}