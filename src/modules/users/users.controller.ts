import { Request, Response, NextFunction } from 'express';
import { validateCreateUser } from '../../validators/userValidators.js';
import {
  generarContratoPdf,
  generarCredencialPdf,
  guardarFotoPerfil,
} from '../documentos/documentos.service.js';
import {
  addUser,
  deleteUser,
  editUser,
  getUsers,
  toggleUser,
  updateUserVacationDays,
} from './users.service.js';

export async function listUsersController(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ ok: true, users: await getUsers() });
  } catch (e) {
    next(e);
  }
}

export async function createUserController(req: Request, res: Response, next: NextFunction) {
  try {
    const validated = validateCreateUser(req.body);

    const payload = {
      ...validated,
      telefono: req.body?.telefono || null,
      direccion: req.body?.direccion || null,
      fecha_ingreso: req.body?.fecha_ingreso || null,
      dias_vacaciones_disponibles: req.body?.dias_vacaciones_disponibles ?? 12,
    };

    const id = await addUser(payload);

    const archivos: any = {};

    if (req.body?.foto_perfil_base64) {
      archivos.foto = await guardarFotoPerfil({
        usuarioId: id,
        base64: req.body.foto_perfil_base64,
        filename: req.body?.foto_perfil_filename,
        ip: req.ip,
      });
    }

    if (req.body?.generar_contrato_pdf) {
      try {
        archivos.contrato = await generarContratoPdf(id, undefined, req.ip);
      } catch {
        archivos.contrato = {
          pendiente: true,
          message: 'Registra primero un contrato para generar el PDF.',
        };
      }
    }

    if (req.body?.generar_credencial_pdf || req.body?.generar_credencial_imagen) {
      try {
        archivos.credencial = await generarCredencialPdf(id, undefined, req.ip);
      } catch {
        archivos.credencial = {
          pendiente: true,
          message: 'Registra primero un contrato para generar la credencial.',
        };
      }
    }

    res.status(201).json({ ok: true, id, archivos });
  } catch (e) {
    next(e);
  }
}

export async function updateUserController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    await editUser(
      Number(req.params.id),
      {
        nombre: req.body?.nombre,
        apellido: req.body?.apellido,
        correo: req.body?.correo,
        rol_id: req.body?.rol_id,
        telefono:
          req.body?.telefono || null,
        direccion:
          req.body?.direccion || null,
        fecha_ingreso:
          req.body?.fecha_ingreso || null,
        dias_vacaciones_disponibles:
          req.body?.dias_vacaciones_disponibles ??
          12,
      },
      Number(
        (req as any)
          .auth?.userId
      )
    );

    res.json({
      ok: true,
      message:
        'Usuario actualizado correctamente',
    });
  } catch (e) {
    next(e);
  }
}

export async function setActiveController(req: Request, res: Response, next: NextFunction) {
  try {
    await toggleUser(
      Number(req.params.id),
      req.body?.activo,
      Number((req as any).auth?.userId)
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

export async function setVacationDaysController(req: Request, res: Response, next: NextFunction) {
  try {
    await updateUserVacationDays(
      Number(req.params.id),
      Number(req.body?.dias_vacaciones_disponibles)
    );

    res.json({
      ok: true,
      message: 'Días de vacaciones actualizados correctamente',
    });
  } catch (e) {
    next(e);
  }
}

export async function deleteUserController(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteUser(
      Number(req.params.id),
      Number((req as any).auth?.userId)
    );

    res.json({
      ok: true,
      message: 'Usuario desactivado correctamente',
    });
  } catch (e) {
    next(e);
  }
}