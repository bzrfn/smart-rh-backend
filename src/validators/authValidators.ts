import { AppError } from '../utils/AppError.js';

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateLogin(body: any) {
  const correo = String(body?.correo || '').trim().toLowerCase();
  const contrasena = String(body?.contrasena || '');

  if (!correo || !contrasena) {
    throw new AppError('correo y contrasena son requeridos', 400);
  }

  if (!isEmail(correo)) {
    throw new AppError('correo invalido', 400);
  }

  return { correo, contrasena };
}

export function validateRegister(body: any) {
  const nombre = String(body?.nombre || '').trim();
  const apellido = String(body?.apellido || '').trim();
  const correo = String(body?.correo || '').trim().toLowerCase();
  const contrasena = String(body?.contrasena || '');
  const rol_id = body?.rol_id ? Number(body.rol_id) : 2;

  if (!nombre || !apellido || !correo || !contrasena) {
    throw new AppError('nombre, apellido, correo y contrasena son requeridos', 400);
  }

  if (!isEmail(correo)) {
    throw new AppError('correo invalido', 400);
  }

  if (contrasena.length < 8) {
    throw new AppError('la contrasena debe tener al menos 8 caracteres', 400);
  }

  if (!Number.isInteger(rol_id) || rol_id <= 0) {
    throw new AppError('rol_id invalido', 400);
  }

  return {
    nombre,
    apellido,
    correo,
    contrasena,
    rol_id,
  };
}

export function validateForgotPassword(body: any) {
  const correo = String(body?.correo || '').trim().toLowerCase();

  if (!correo) {
    throw new AppError('correo es requerido', 400);
  }

  if (!isEmail(correo)) {
    throw new AppError('correo invalido', 400);
  }

  return { correo };
}

export function validateResetPassword(body: any) {
  const correo =
    String(
      body?.correo || ''
    )
      .trim()
      .toLowerCase();

  const codigo =
    String(
      body?.codigo || ''
    )
      .trim();

  const nuevaContrasena =
    String(
      body?.nuevaContrasena || ''
    );

  if (
    !correo ||
    !codigo ||
    !nuevaContrasena
  ) {
    throw new AppError(
      'correo, codigo y nuevaContrasena son requeridos',
      400
    );
  }

  if (!isEmail(correo)) {
    throw new AppError(
      'correo invalido',
      400
    );
  }

  if (!/^\d{6}$/.test(codigo)) {
    throw new AppError(
      'codigo invalido',
      400
    );
  }

  if (nuevaContrasena.length < 8) {
    throw new AppError(
      'la nueva contrasena debe tener al menos 8 caracteres',
      400
    );
  }

  return {
    correo,
    codigo,
    nuevaContrasena,
  };
}
