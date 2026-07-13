import { AppError } from '../utils/AppError.js';

export function validateCreateUser(body: any) {
  const nombre = String(body?.nombre || '').trim();
  const apellido = String(body?.apellido || '').trim();
  const correo = String(body?.correo || '').trim().toLowerCase();
  const contrasena = String(body?.contrasena || '');
  const rol_id = Number(body?.rol_id || 0);

  if (!nombre || !apellido || !correo || !contrasena || !rol_id) {
    throw new AppError('nombre, apellido, correo, contrasena, rol_id son requeridos', 400);
  }
  return { nombre, apellido, correo, contrasena, rol_id };
}
