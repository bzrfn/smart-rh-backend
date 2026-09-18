import { Request, Response, NextFunction } from 'express';
import {
  generarContratoPdf,
  generarCredencialImagen,
  verificarCredencialToken,
  guardarFotoPerfil,
} from './documentos.service.js';
import { registrarActividadEmpleado } from '../actividad/actividad.service.js';

function getActorId(req: Request) {
  return (
    Number(
      (req as any).auth?.userId ||
        (req as any).user?.id ||
        (req as any).user?.userId ||
        0
    ) || undefined
  );
}

export async function verificarCredencialController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result =
      await verificarCredencialToken(
        String(
          req.params.token || ''
        )
      );

    return res
      .status(200)
      .json(result);

  } catch (e) {
    next(e);
  }
}


export async function uploadFotoPerfilController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const usuarioId = Number(req.params.usuarioId);

    const result = await guardarFotoPerfil({
      usuarioId,
      base64: String(req.body?.base64 || ''),
      filename: req.body?.filename,
      actorId: getActorId(req),
      ip: req.ip,
    });

    await registrarActividadEmpleado({
      usuario_id: usuarioId,
      tipo: 'ACTUALIZACION_FOTO',
      titulo: 'Foto de perfil actualizada',
      descripcion: 'Se actualizó la foto de perfil del empleado.',
      modulo: 'documentos',
      origen: 'web',
      metadata: {
        filename: req.body?.filename,
        actor_id: getActorId(req),
        foto_perfil_url: result?.foto_perfil_url,
      },
    });

    res.json({ ok: true, ...result });
  } catch (e) {
    next(e);
  }
}

export async function generarContratoPdfController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const usuarioId = Number(req.params.usuarioId);

    const result = await generarContratoPdf(usuarioId, getActorId(req), req.ip);

    await registrarActividadEmpleado({
      usuario_id: usuarioId,
      tipo: 'GENERACION_CONTRATO',
      titulo: 'Contrato generado',
      descripcion: 'Se generó un nuevo contrato PDF para el empleado.',
      modulo: 'documentos',
      origen: 'web',
      metadata: {
        actor_id: getActorId(req),
        contrato_pdf_url: result?.contrato_pdf_url,
      },
    });

    res.json({ ok: true, ...result });
  } catch (e) {
    next(e);
  }
}

export async function generarCredencialImagenController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const usuarioId = Number(req.params.usuarioId);

    const result = await generarCredencialImagen(usuarioId, getActorId(req), req.ip);

    await registrarActividadEmpleado({
      usuario_id: usuarioId,
      tipo: 'GENERACION_CREDENCIAL',
      titulo: 'Credencial generada',
      descripcion: 'Se generó una nueva credencial digital para el empleado.',
      modulo: 'documentos',
      origen: 'web',
      metadata: {
        actor_id: getActorId(req),
        credencial_url: result?.credencial_url,
      },
    });

    res.json({ ok: true, ...result });
  } catch (e) {
    next(e);
  }
}
