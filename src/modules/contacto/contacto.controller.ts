import { Request, Response } from 'express';
import { enviarCorreoContactoService } from './contacto.service';

export async function enviarCorreoContactoController(req: Request, res: Response) {
  try {
    const result = await enviarCorreoContactoService({
      nombre: req.body.nombre,
      correo: req.body.correo,
      empresa: req.body.empresa,
      mensaje: req.body.mensaje,
    });

    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(400).json({
      ok: false,
      message: error?.message || 'No se pudo enviar el mensaje.',
    });
  }
}