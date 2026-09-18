import {
  AppError,
} from '../../utils/AppError.js';

export type ValidatedUserPayload = {
  nombre: string;
  apellido: string;
  correo: string;
  rol_id: number;
  telefono: string | null;
  direccion: string | null;
  fecha_ingreso: string | null;
  dias_vacaciones_disponibles: number;
};

export type ValidatedCreateUserPayload =
  ValidatedUserPayload & {
    contrasena: string;
  };

function asObject(
  payload: unknown
): Record<string, unknown> {
  if (
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload)
  ) {
    throw new AppError(
      'Formato de usuario inválido',
      400
    );
  }

  return payload as
    Record<string, unknown>;
}

function requiredText(
  value: unknown,
  field: string,
  maxLength: number
) {
  if (
    typeof value !== 'string'
  ) {
    throw new AppError(
      `${field} es obligatorio`,
      400
    );
  }

  const normalized =
    value.trim();

  if (!normalized) {
    throw new AppError(
      `${field} es obligatorio`,
      400
    );
  }

  if (
    normalized.length >
    maxLength
  ) {
    throw new AppError(
      `${field} excede la longitud permitida`,
      400
    );
  }

  return normalized;
}

function optionalText(
  value: unknown,
  field: string,
  maxLength: number
): string | null {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null;
  }

  if (
    typeof value !== 'string'
  ) {
    throw new AppError(
      `${field} tiene un formato inválido`,
      400
    );
  }

  const normalized =
    value.trim();

  if (!normalized) {
    return null;
  }

  if (
    normalized.length >
    maxLength
  ) {
    throw new AppError(
      `${field} excede la longitud permitida`,
      400
    );
  }

  return normalized;
}

function validateEmail(
  value: unknown
) {
  const correo =
    requiredText(
      value,
      'Correo',
      190
    )
      .toLowerCase();

  const EMAIL_REGEX =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (
    !EMAIL_REGEX.test(
      correo
    )
  ) {
    throw new AppError(
      'Correo inválido',
      400
    );
  }

  return correo;
}

function validateRoleId(
  value: unknown
) {
  const rolId =
    Number(value);

  if (
    !Number.isInteger(
      rolId
    ) ||
    rolId <= 0
  ) {
    throw new AppError(
      'Rol inválido',
      400
    );
  }

  return rolId;
}

export function validateVacationDays(
  value: unknown
) {
  const dias =
    Number(value);

  if (
    !Number.isInteger(
      dias
    ) ||
    dias < 0
  ) {
    throw new AppError(
      'Los días de vacaciones deben ser un número entero mayor o igual a 0',
      400
    );
  }

  return dias;
}

function validateDate(
  value: unknown
): string | null {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null;
  }

  if (
    typeof value !== 'string'
  ) {
    throw new AppError(
      'Fecha de ingreso inválida',
      400
    );
  }

  const normalized =
    value.trim();

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/
      .exec(normalized);

  if (!match) {
    throw new AppError(
      'Fecha de ingreso inválida',
      400
    );
  }

  const year =
    Number(match[1]);

  const month =
    Number(match[2]);

  const day =
    Number(match[3]);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  if (
    date.getUTCFullYear() !==
      year ||
    date.getUTCMonth() !==
      month - 1 ||
    date.getUTCDate() !==
      day
  ) {
    throw new AppError(
      'Fecha de ingreso inválida',
      400
    );
  }

  return normalized;
}

function validatePassword(
  value: unknown
) {
  if (
    typeof value !== 'string'
  ) {
    throw new AppError(
      'La contraseña es obligatoria',
      400
    );
  }

  if (
    value.length < 8 ||
    value.length > 128
  ) {
    throw new AppError(
      'La contraseña debe tener entre 8 y 128 caracteres',
      400
    );
  }

  if (
    !value.trim()
  ) {
    throw new AppError(
      'La contraseña no puede estar vacía',
      400
    );
  }

  return value;
}

export function validateUserId(
  value: unknown
) {
  const id =
    Number(value);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    throw new AppError(
      'ID de usuario inválido',
      400
    );
  }

  return id;
}

export function validateActiveValue(
  value: unknown
) {
  if (
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (
    value === 1 ||
    value === 0
  ) {
    return value === 1;
  }

  throw new AppError(
    'El campo activo debe ser booleano',
    400
  );
}

function validateCommonUser(
  payload: unknown
): ValidatedUserPayload {
  const data =
    asObject(payload);

  return {
    nombre:
      requiredText(
        data.nombre,
        'Nombre',
        100
      ),

    apellido:
      requiredText(
        data.apellido,
        'Apellido',
        100
      ),

    correo:
      validateEmail(
        data.correo
      ),

    rol_id:
      validateRoleId(
        data.rol_id
      ),

    telefono:
      optionalText(
        data.telefono,
        'Teléfono',
        30
      ),

    direccion:
      optionalText(
        data.direccion,
        'Dirección',
        500
      ),

    fecha_ingreso:
      validateDate(
        data.fecha_ingreso
      ),

    dias_vacaciones_disponibles:
      validateVacationDays(
        data
          .dias_vacaciones_disponibles ??
          12
      ),
  };
}

export function validateCreateUserPayload(
  payload: unknown
): ValidatedCreateUserPayload {
  const data =
    asObject(payload);

  return {
    ...validateCommonUser(
      data
    ),

    contrasena:
      validatePassword(
        data.contrasena
      ),
  };
}

export function validateUpdateUserPayload(
  payload: unknown
): ValidatedUserPayload {
  return validateCommonUser(
    payload
  );
}
