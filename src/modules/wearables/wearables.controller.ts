import { Request, Response } from 'express';
import {
  crearEventoWearable,
  crearSensoresWearable,
  desvincularDispositivoWearable,
  enviarNotificacionWearable,
  generarCodigoPairing,
  leerNotificacionWearable,
  listarDispositivosWearable,
  listarEventosWearable,
  listarMisDispositivosWearable,
  listarNotificacionesWearable,
  listarSensoresWearable,
  obtenerDispositivoWearable,
  vincularDispositivoWearable,
} from './wearables.service.js';

function getAuthUserId(req: Request) {
  const authData = req as any;

  const value =
    authData.user?.userId ||
    authData.user?.id ||
    authData.user?.usuario_id ||
    authData.usuario?.userId ||
    authData.usuario?.id ||
    authData.usuario?.usuario_id ||
    authData.auth?.userId ||
    authData.auth?.id ||
    authData.auth?.usuario_id ||
    authData.userId ||
    authData.usuario_id;

  const parsed = Number(value);

  return Number.isNaN(parsed) ? null : parsed;
}

function handleError(res: Response, error: any) {
  const status = error?.statusCode || 500;

  return res.status(status).json({
    ok: false,
    message: error?.message || 'Error interno en módulo wearables.',
  });
}

export async function generarCodigoPairingController(req: Request, res: Response) {
  try {
    const usuarioId = getAuthUserId(req);

    if (!usuarioId) {
      return res.status(401).json({
        ok: false,
        message: 'Usuario no autenticado.',
      });
    }

    const data = await generarCodigoPairing(usuarioId);

    return res.json({
      ok: true,
      ...data,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function vincularDispositivoController(req: Request, res: Response) {
  try {
    const data = await vincularDispositivoWearable(req.body);

    return res.json({
      ok: true,
      ...data,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function obtenerDispositivoController(req: Request, res: Response) {
  try {
    const { deviceId } = req.params;
    const data = await obtenerDispositivoWearable(deviceId);

    return res.json({
      ok: true,
      ...data,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function listarDispositivosController(_req: Request, res: Response) {
  try {
    const data = await listarDispositivosWearable();

    return res.json({
      ok: true,
      ...data,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function listarMisDispositivosController(req: Request, res: Response) {
  try {
    const usuarioId = getAuthUserId(req);

    if (!usuarioId) {
      return res.status(401).json({
        ok: false,
        message: 'Usuario no autenticado.',
      });
    }

    const data = await listarMisDispositivosWearable(usuarioId);

    return res.json({
      ok: true,
      ...data,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function desvincularDispositivoController(req: Request, res: Response) {
  try {
    const usuarioId = getAuthUserId(req);
    const { deviceId } = req.params;

    if (!usuarioId) {
      return res.status(401).json({
        ok: false,
        message: 'Usuario no autenticado.',
      });
    }

    const data = await desvincularDispositivoWearable({
      usuario_id: usuarioId,
      device_id: deviceId,
    });

    return res.json({
      ok: true,
      ...data,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function crearEventoController(req: Request, res: Response) {
  try {
    const data = await crearEventoWearable(req.body);

    return res.status(201).json({
      ok: true,
      ...data,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function listarEventosController(_req: Request, res: Response) {
  try {
    const data = await listarEventosWearable();

    return res.json({
      ok: true,
      ...data,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function crearSensoresController(req: Request, res: Response) {
  try {
    const data = await crearSensoresWearable(req.body);

    return res.status(201).json({
      ok: true,
      ...data,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function listarSensoresController(req: Request, res: Response) {
  try {
    const { deviceId } = req.params;
    const data = await listarSensoresWearable(deviceId);

    return res.json({
      ok: true,
      ...data,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function enviarNotificacionController(req: Request, res: Response) {
  try {
    const data = await enviarNotificacionWearable(req.body);

    return res.status(201).json({
      ok: true,
      ...data,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function listarNotificacionesController(req: Request, res: Response) {
  try {
    const { deviceId } = req.params;
    const data = await listarNotificacionesWearable(deviceId);

    return res.json({
      ok: true,
      ...data,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function marcarNotificacionLeidaController(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const data = await leerNotificacionWearable(id);

    return res.json({
      ok: true,
      ...data,
    });
  } catch (error) {
    return handleError(res, error);
  }
}