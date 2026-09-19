import {
  resolvePublicRegistrationRoleId,
} from './publicRegistration.policy.js';


import {
  createUser,
  findUserByEmail,
  findUserById,
  marcarEmailVerificado,
} from './auth.repository.js';
import { verifyPassword, hashPassword } from '../../utils/password.js';
import { AppError } from '../../utils/AppError.js';
import { signJwt } from '../../config/jwt.js';
import {
  completePasswordRecovery,
  requestPasswordRecovery,
} from './passwordRecovery.service.js';

import {
  issueAdminLogin2fa,
  verifyAdminLogin2fa,
} from './login2fa.service.js';
import { registrarEventoSistema } from '../eventosSistema/eventosSistema.service.js';
import { registrarHistorialAcceso } from '../historialAccesos/historialAccesos.service.js';
import { generarRecordatorioAsistenciaLogin } from '../notificaciones/notificaciones.service.js';
import { registrarActividadEmpleado } from '../actividad/actividad.service.js';
import {
  consumirCodigoEmail,
  crearCodigoEmail,
  generarCodigoEmail,
  invalidarCodigosActivos,
} from './auth.email-code.repository.js';
import {
  enviarCodigoConfirmacionCuentaEmail,
  enviarCuentaConfirmadaEmail,
} from './auth.email.service.js';

function buildUserResponse(u: any) {
  return {
    id: u.id,
    nombre: u.nombre,
    apellido: u.apellido,
    correo: u.correo,
    role: u.rol_nombre,
    telefono: u.telefono,
    direccion: u.direccion,
    fecha_ingreso: u.fecha_ingreso,
    dias_vacaciones_disponibles: u.dias_vacaciones_disponibles,
    foto_perfil_url: u.foto_perfil_url,
    credencial_url: u.credencial_url,
    email_verificado: Boolean(u.email_verificado),
  };
}

function getFullName(u: any) {
  return `${u.nombre || ''} ${u.apellido || ''}`.trim() || u.correo;
}

async function registrarLoginExitoso(
  u: any,
  twoFactor: boolean
) {
  await registrarEventoSistema({
    tipo: 'LOGIN_EXITOSO',
    usuario_id: u.id,
    correo: u.correo,
    modulo: 'auth',
    descripcion:
      twoFactor
        ? 'Inicio de sesión exitoso con verificación 2FA.'
        : 'Inicio de sesión exitoso.',
    resultado: 'exitoso',
    metadata: {
      role: u.rol_nombre,
      twoFactor,
    },
  });

  await registrarHistorialAcceso({
    usuario_id: u.id,
    correo: u.correo,
    evento: 'LOGIN_EXITOSO',
    resultado: 'exitoso',
    origen: 'api',
    metadata: {
      role: u.rol_nombre,
      twoFactor,
    },
  });

  await generarRecordatorioAsistenciaLogin(
    u.id
  );

  await registrarActividadEmpleado({
    usuario_id: u.id,
    tipo: 'LOGIN_EXITOSO',
    titulo: 'Inicio de sesión',
    descripcion:
      twoFactor
        ? 'El usuario inició sesión correctamente en SMART RH con verificación 2FA.'
        : 'El usuario inició sesión correctamente en SMART RH.',
    modulo: 'auth',
    origen: 'mobile',
    metadata: {
      role: u.rol_nombre,
      correo: u.correo,
      twoFactor,
    },
  });
}


export async function login(
  correo: string,
  contrasena: string,
  requestIp?: unknown
) {
  const u = await findUserByEmail(correo);

  if (!u) {
    await registrarEventoSistema({
      tipo: 'LOGIN_FALLIDO',
      correo,
      modulo: 'auth',
      descripcion: 'Intento de inicio de sesión con correo no registrado.',
      resultado: 'fallido',
    });

    await registrarHistorialAcceso({
      correo,
      evento: 'LOGIN_FALLIDO',
      resultado: 'fallido',
      origen: 'api',
      motivo: 'Correo no registrado',
    });

    throw new AppError('Credenciales incorrectas', 401);
  }

  if (!u.activo) {
    await registrarEventoSistema({
      tipo: 'LOGIN_FALLIDO',
      usuario_id: u.id,
      correo: u.correo,
      modulo: 'auth',
      descripcion: 'Intento de inicio de sesión con usuario inactivo.',
      resultado: 'fallido',
    });

    await registrarHistorialAcceso({
      usuario_id: u.id,
      correo: u.correo,
      evento: 'LOGIN_FALLIDO',
      resultado: 'fallido',
      origen: 'api',
      motivo: 'Usuario inactivo',
    });

    throw new AppError('Usuario inactivo', 403);
  }

  const ok = await verifyPassword(contrasena, u.contrasena);

  if (!ok) {
    await registrarEventoSistema({
      tipo: 'LOGIN_FALLIDO',
      usuario_id: u.id,
      correo: u.correo,
      modulo: 'auth',
      descripcion: 'Intento de inicio de sesión con contraseña incorrecta.',
      resultado: 'fallido',
    });

    await registrarHistorialAcceso({
      usuario_id: u.id,
      correo: u.correo,
      evento: 'LOGIN_FALLIDO',
      resultado: 'fallido',
      origen: 'api',
      motivo: 'Contraseña incorrecta',
    });

    throw new AppError('Credenciales incorrectas', 401);
  }

  if (!u.email_verificado) {
    await invalidarCodigosActivos({
      correo: u.correo,
      tipo: 'REGISTER',
    });

    const codigo = generarCodigoEmail();

    const registroCodigo = await crearCodigoEmail({
      usuario_id: u.id,
      correo: u.correo,
      codigo,
      tipo: 'REGISTER',
      minutosExpiracion: 10,
    });

    await enviarCodigoConfirmacionCuentaEmail({
      correo: u.correo,
      nombre: getFullName(u),
      codigo,
    });

    return {
      requiresEmailVerification: true,
      correo: u.correo,
      expiresInMinutes: registroCodigo.expiresInMinutes,
      message: 'Tu cuenta aún no está verificada. Te enviamos un código de confirmación al correo.',
    };
  }

  const normalizedRole =
    String(
      u.rol_nombre ||
      ''
    )
      .trim()
      .toLowerCase();

  if (
    normalizedRole ===
    'admin'
  ) {
    const challenge =
      await issueAdminLogin2fa(
        {
          id:
            u.id,

          correo:
            u.correo,

          nombre:
            u.nombre,

          apellido:
            u.apellido,

          role:
            u.rol_nombre,

          sessionVersion:
            Number(
              u.session_version
            ),
        },
        requestIp
      );

    await registrarEventoSistema({
      tipo:
        'LOGIN_2FA_REQUERIDO',

      usuario_id:
        u.id,

      correo:
        u.correo,

      modulo:
        'auth',

      descripcion:
        challenge.reused
          ? 'Inicio administrativo pendiente de un código 2FA previamente enviado.'
          : 'Código 2FA administrativo enviado para completar el inicio de sesión.',

      resultado:
        'exitoso',

      metadata: {
        role:
          u.rol_nombre,

        expiresInMinutes:
          challenge.expiresInMinutes,

        reused:
          challenge.reused,
      },
    });

    return challenge;
  }

  const token =
    signJwt({
      userId:
        u.id,

      role:
        u.rol_nombre,

      sessionVersion:
        Number(
          u.session_version
        ),
    });

  await registrarLoginExitoso(
    u,
    false
  );

  return {
    token,

    user:
      buildUserResponse(
        u
      ),
  };
}


export async function verifyLoginCode(
  challengeId: string,
  codigo: string
) {
  const result =
    await verifyAdminLogin2fa(
      challengeId,
      codigo
    );

  const u =
    await findUserById(
      result.userId
    );

  if (
    !u ||
    !u.activo ||
    !u.email_verificado ||
    String(
      u.rol_nombre ||
      ''
    )
      .trim()
      .toLowerCase() !==
      'admin' ||
    Number(
      u.session_version
    ) !==
      Number(
        result.sessionVersion
      )
  ) {
    throw new AppError(
      'Sesión administrativa inválida',
      401
    );
  }

  await registrarLoginExitoso(
    u,
    true
  );

  return {
    token:
      result.token,

    user:
      buildUserResponse(
        u
      ),
  };
}


export async function register(data: {
  nombre: string;
  apellido: string;
  correo: string;
  contrasena: string;
  rol_id: number;
  telefono?: string | null;
  direccion?: string | null;
  fecha_ingreso?: string | null;
  dias_vacaciones_disponibles?: number;
}) {
  const exists = await findUserByEmail(data.correo);

  if (exists) {
    await registrarEventoSistema({
      tipo: 'REGISTER_USUARIO',
      usuario_id: exists.id,
      correo: data.correo,
      modulo: 'auth',
      descripcion: 'Intento de registro con correo ya existente.',
      resultado: 'fallido',
    });

    throw new AppError('El correo ya está registrado', 409);
  }

  const hashed = await hashPassword(data.contrasena);

  const created = await createUser({
    nombre: data.nombre,
    apellido: data.apellido,
    correo: data.correo,
    contrasena: hashed,
    rol_id:
      resolvePublicRegistrationRoleId(
        data.rol_id
      ),
    telefono: data.telefono || null,
    direccion: data.direccion || null,
    fecha_ingreso: data.fecha_ingreso || null,
    dias_vacaciones_disponibles: data.dias_vacaciones_disponibles ?? 12,
  });

  await invalidarCodigosActivos({
    correo: created.correo,
    tipo: 'REGISTER',
  });

  const codigo = generarCodigoEmail();

  const registroCodigo = await crearCodigoEmail({
    usuario_id: created.id,
    correo: created.correo,
    codigo,
    tipo: 'REGISTER',
    minutosExpiracion: 10,
  });

  await enviarCodigoConfirmacionCuentaEmail({
    correo: created.correo,
    nombre: getFullName(created),
    codigo,
  });

  await registrarEventoSistema({
    tipo: 'REGISTER_USUARIO',
    usuario_id: created.id,
    correo: created.correo,
    modulo: 'auth',
    descripcion: 'Usuario registrado correctamente. Código de confirmación enviado por correo.',
    resultado: 'exitoso',
    metadata: {
      rol_id: created.rol_id,
      role: created.rol_nombre,
      requiresEmailVerification: true,
    },
  });

  await registrarActividadEmpleado({
    usuario_id: created.id,
    tipo: 'REGISTER_USUARIO',
    titulo: 'Cuenta registrada',
    descripcion: 'El usuario fue registrado correctamente y tiene confirmación de correo pendiente.',
    modulo: 'auth',
    origen: 'api',
    metadata: {
      rol_id: created.rol_id,
      role: created.rol_nombre,
      correo: created.correo,
      requiresEmailVerification: true,
    },
  });

  return {
    requiresEmailVerification: true,
    correo: created.correo,
    expiresInMinutes: registroCodigo.expiresInMinutes,
    user: buildUserResponse(created),
    message: 'Cuenta creada. Se envió un código de confirmación al correo.',
  };
}

export async function verifyAccount(correo: string, codigo: string) {
  if (!correo?.trim() || !codigo?.trim()) {
    throw new AppError('Correo y código son obligatorios', 400);
  }

  const u = await findUserByEmail(correo);

  if (!u) {
    throw new AppError('No existe una cuenta con ese correo', 404);
  }

  if (!u.activo) {
    throw new AppError('Usuario inactivo', 403);
  }

  if (u.email_verificado) {
    return {
      requiresLogin: true,
      correo: u.correo,
      message: 'La cuenta ya estaba verificada. Inicia sesión para continuar.',
    };
  }

  const entry = await consumirCodigoEmail({
    correo: u.correo,
    codigo: codigo.trim(),
    tipo: 'REGISTER',
  });

  if (!entry) {
    await registrarEventoSistema({
      tipo: 'VERIFY_ACCOUNT_FALLIDO',
      usuario_id: u.id,
      correo: u.correo,
      modulo: 'auth',
      descripcion: 'Código de confirmación de cuenta inválido o expirado.',
      resultado: 'fallido',
    });

    throw new AppError('Código inválido o expirado', 400);
  }

  await marcarEmailVerificado(u.id);

  const updated = await findUserById(u.id);

  if (!updated) {
    throw new AppError('No se pudo recuperar el usuario verificado', 500);
  }

  await enviarCuentaConfirmadaEmail({
    correo: updated.correo,
    nombre: getFullName(updated),
  });

  await registrarEventoSistema({
    tipo: 'VERIFY_ACCOUNT_EXITOSO',
    usuario_id: updated.id,
    correo: updated.correo,
    modulo: 'auth',
    descripcion: 'Cuenta confirmada correctamente por correo.',
    resultado: 'exitoso',
  });

  await registrarActividadEmpleado({
    usuario_id: updated.id,
    tipo: 'VERIFY_ACCOUNT_EXITOSO',
    titulo: 'Cuenta confirmada',
    descripcion: 'La cuenta fue confirmada correctamente mediante código enviado al correo.',
    modulo: 'auth',
    origen: 'api',
    metadata: {
      correo: updated.correo,
    },
  });

  return {
    requiresLogin: true,
    correo: updated.correo,
    message: 'Cuenta confirmada correctamente. Inicia sesión para continuar.',
  };
}

export async function forgotPassword(
  correo: string,
  ip?: unknown
) {
  return requestPasswordRecovery(
    correo,
    ip
  );
}


export async function resetPassword(
  correo: string,
  codigo: string,
  nuevaContrasena: string
) {
  return completePasswordRecovery(
    correo,
    codigo,
    nuevaContrasena
  );
}
