import { Request, Response } from 'express';
import {
  entrenarKMeansService,
  obtenerDatasetService,
  obtenerElbowService,
} from './kmeans.service.js';

// Centraliza el manejo de errores para que todas las rutas respondan de forma uniforme.
function handleError(res: Response, error: any) {
  const status = error?.statusCode || 500;

  return res.status(status).json({
    ok: false,
    message: error?.message || 'Error interno en análisis K-means.',
  });
}

// Controlador para devolver el dataset preparado para K-Means.
export async function obtenerDatasetController(_req: Request, res: Response) {
  try {
    const data = await obtenerDatasetService();

    return res.json({
      ok: true,
      ...data,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

// Controlador para ejecutar el análisis de codo y sugerir un valor de k.
export async function obtenerElbowController(req: Request, res: Response) {
  try {
    const data = await obtenerElbowService(req.query);

    return res.json({
      ok: true,
      ...data,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

// Controlador para entrenar el modelo de K-Means con los parámetros enviados desde la petición.
export async function entrenarKMeansController(req: Request, res: Response) {
  try {
    const data = await entrenarKMeansService(req.body);

    return res.json({
      ok: true,
      ...data,
    });
  } catch (error) {
    return handleError(res, error);
  }
}