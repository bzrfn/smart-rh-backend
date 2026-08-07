import type { Request, Response, NextFunction } from 'express';
import { obtenerResumenVisualService } from './analytics.service.js';

export async function obtenerResumenVisualController(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await obtenerResumenVisualService();

    res.json(result);
  } catch (error) {
    next(error);
  }
}