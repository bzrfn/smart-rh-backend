import { Request, Response, NextFunction } from 'express';
import {
  validateForgotPassword,
  validateLogin,
  validateRegister,
  validateResetPassword,
} from '../../validators/authValidators.js';
import {
  forgotPassword,
  login,
  register,
  resetPassword,
  verifyAccount,
  verifyLoginCode,
} from './auth.service.js';
import { guardarFotoPerfil } from '../documentos/documentos.service.js';

export async function loginController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const {
      correo,
      contrasena,
    } =
      validateLogin(
        req.body
      );

    const data =
      await login(
        correo,
        contrasena,
        req.ip
      );

    res.json({
      ok: true,
      ...data,
    });

  } catch (e) {
    next(e);
  }
}


export async function verifyLoginCodeController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const challengeId =
      String(
        req.body?.challengeId ||
        ''
      )
        .trim()
        .toLowerCase();

    const codigo =
      String(
        req.body?.codigo ||
        ''
      )
        .trim();

    const data =
      await verifyLoginCode(
        challengeId,
        codigo
      );

    res.json({
      ok: true,
      ...data,
    });

  } catch (e) {
    next(e);
  }
}


export async function registerController(req: Request, res: Response, next: NextFunction) {
  try {
    const validated = validateRegister(req.body);

    const payload = {
      ...validated,
      telefono: req.body?.telefono || null,
      direccion: req.body?.direccion || null,
      fecha_ingreso: req.body?.fecha_ingreso || null,
      dias_vacaciones_disponibles: req.body?.dias_vacaciones_disponibles ?? 12,
    };

    const data = await register(payload);

    let foto_perfil_url: string | undefined;

    if (req.body?.foto_perfil_base64 && data?.user?.id) {
      const foto = await guardarFotoPerfil({
        usuarioId: data.user.id,
        base64: req.body.foto_perfil_base64,
        filename: req.body?.foto_perfil_filename || 'perfil.png',
        ip: req.ip,
        actorId: data.user.id,
      });

      foto_perfil_url = foto.foto_perfil_url;
    }

    res.status(201).json({
      ok: true,
      ...data,
      user: {
        ...data.user,
        foto_perfil_url: foto_perfil_url || data.user?.foto_perfil_url,
      },
      foto_perfil_url,
    });
  } catch (e) {
    next(e);
  }
}

export async function verifyAccountController(req: Request, res: Response, next: NextFunction) {
  try {
    const correo = String(req.body?.correo || '').trim().toLowerCase();
    const codigo = String(req.body?.codigo || '').trim();

    const data = await verifyAccount(correo, codigo);

    res.json({
      ok: true,
      ...data,
    });
  } catch (e) {
    next(e);
  }
}

export async function forgotPasswordController(req: Request, res: Response, next: NextFunction) {
  try {
    const { correo } = validateForgotPassword(req.body);
    const data = await forgotPassword(correo, req.ip);

    res.json({
      ok: true,
      ...data,
    });
  } catch (e) {
    next(e);
  }
}

export async function resetPasswordController(req: Request, res: Response, next: NextFunction) {
  try {
    const { correo, codigo, nuevaContrasena } = validateResetPassword(req.body);
    const data = await resetPassword(correo, codigo, nuevaContrasena);

    res.json({
      ok: true,
      ...data,
    });
  } catch (e) {
    next(e);
  }
}
