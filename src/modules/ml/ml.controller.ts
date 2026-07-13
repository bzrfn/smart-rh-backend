import { Request, Response, NextFunction } from 'express';
import {
  entrenarModeloML,
  obtenerDatasetML,
  obtenerEvaluacionML,
  obtenerPrediccionesML,
  obtenerResumenML,
} from './ml.service.js';

export async function obtenerDatasetMLController(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const dataset = await obtenerDatasetML();

    res.json({
      ok: true,
      dataset,
    });
  } catch (error) {
    next(error);
  }
}

export async function obtenerResumenMLController(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = await obtenerResumenML();

    res.json({
      ok: true,
      ...data,
    });
  } catch (error) {
    next(error);
  }
}

export async function obtenerPrediccionesMLController(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = await obtenerPrediccionesML();

    res.json({
      ok: true,
      ...data,
    });
  } catch (error) {
    next(error);
  }
}

export async function obtenerEvaluacionMLController(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const evaluacion = await obtenerEvaluacionML();

    res.json({
      ok: true,
      evaluacion,
    });
  } catch (error) {
    next(error);
  }
}

export async function entrenarModeloMLController(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = await entrenarModeloML();

    res.json({
      ok: true,
      ...data,
    });
  } catch (error) {
    next(error);
  }
}