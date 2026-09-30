import {
  AppError,
} from '../../utils/AppError.js';

import {
  isModuloEnabledForUser,
} from '../permisos/permisos.repository.js';

import {
  CalendarioAsistenciaRow,
  CalendarioIncapacidadRow,
  CalendarioVacacionRow,
  listAsistenciasCalendario,
  listIncapacidadesCalendario,
  listVacacionesCalendario,
} from './calendario.repository.js';


export const MAX_CALENDARIO_RANGE_DAYS =
  93;


type CalendarioActor = {
  userId: number;
  role: string;
};


export type CalendarioTipo =
  | 'asistencia'
  | 'vacacion'
  | 'incapacidad';


export type CalendarioEvento = {
  id: string;
  origen_id: number;
  tipo: CalendarioTipo;
  titulo: string;
  descripcion: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
  usuario_id: number;
  empleado_nombre: string;
  empleado_correo: string | null;
  metadata: Record<string, unknown>;
};


type CalendarioRange = {
  inicio: string;
  fin: string;
};


function normalizeRole(
  value?: string | null
) {
  return String(value || '')
    .trim()
    .toLowerCase();
}


function isAdmin(
  actor?: CalendarioActor | null
) {
  return normalizeRole(
    actor?.role
  ) === 'admin';
}


function assertActor(
  actor?: CalendarioActor | null
): CalendarioActor {
  if (
    !actor?.userId ||
    !actor.role
  ) {
    throw new AppError(
      'Unauthorized',
      401
    );
  }

  return actor;
}


function parseDateOnly(
  value: unknown
): Date | null {
  if (
    typeof value !== 'string'
  ) {
    return null;
  }

  const match =
    value.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (!match) {
    return null;
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
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}


function toDateOnly(
  value: Date
) {
  return value
    .toISOString()
    .slice(
      0,
      10
    );
}


function defaultRange(): CalendarioRange {
  const now =
    new Date();

  const start =
    new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        1
      )
    );

  const end =
    new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() + 1,
        0
      )
    );

  return {
    inicio:
      toDateOnly(start),
    fin:
      toDateOnly(end),
  };
}


export function normalizeCalendarioRange(
  rawInicio?: unknown,
  rawFin?: unknown
): CalendarioRange {
  const fallback =
    defaultRange();

  const inicioText =
    rawInicio === undefined ||
    rawInicio === null ||
    rawInicio === ''
      ? fallback.inicio
      : String(rawInicio);

  const finText =
    rawFin === undefined ||
    rawFin === null ||
    rawFin === ''
      ? fallback.fin
      : String(rawFin);

  const inicioDate =
    parseDateOnly(
      inicioText
    );

  const finDate =
    parseDateOnly(
      finText
    );

  if (
    !inicioDate ||
    !finDate
  ) {
    throw new AppError(
      'inicio y fin deben tener formato YYYY-MM-DD',
      400
    );
  }

  if (
    finDate.getTime() <
    inicioDate.getTime()
  ) {
    throw new AppError(
      'fin no puede ser menor que inicio',
      400
    );
  }

  const days =
    Math.floor(
      (
        finDate.getTime() -
        inicioDate.getTime()
      ) / 86_400_000
    ) + 1;

  if (
    days >
    MAX_CALENDARIO_RANGE_DAYS
  ) {
    throw new AppError(
      `El rango máximo permitido es de ${MAX_CALENDARIO_RANGE_DAYS} días`,
      400
    );
  }

  return {
    inicio:
      toDateOnly(inicioDate),
    fin:
      toDateOnly(finDate),
  };
}


function normalizeRowDate(
  value: string | Date
) {
  if (
    value instanceof Date
  ) {
    return toDateOnly(
      value
    );
  }

  return String(value || '')
    .slice(
      0,
      10
    );
}


function normalizeEstado(
  value?: string | null
) {
  return String(value || 'sin_estado')
    .trim()
    .toLowerCase();
}


function empleadoNombre(
  row: {
    nombre?: string | null;
    apellido?: string | null;
  }
) {
  const fullName =
    `${row.nombre || ''} ${row.apellido || ''}`
      .replace(
        /\s+/g,
        ' '
      )
      .trim();

  return fullName || 'Empleado';
}


function buildAsistenciaEvento(
  row: CalendarioAsistenciaRow
): CalendarioEvento {
  const fecha =
    normalizeRowDate(
      row.fecha
    );

  const entrada =
    row.hora_entrada || 'Sin entrada';

  const salida =
    row.hora_salida || 'Sin salida';

  return {
    id:
      `asistencia-${row.id}`,
    origen_id:
      Number(row.id),
    tipo:
      'asistencia',
    titulo:
      'Asistencia registrada',
    descripcion:
      `Entrada: ${entrada} · Salida: ${salida}`,
    fecha_inicio:
      fecha,
    fecha_fin:
      fecha,
    estado:
      normalizeEstado(
        row.estado
      ),
    usuario_id:
      Number(row.usuario_id),
    empleado_nombre:
      empleadoNombre(row),
    empleado_correo:
      row.correo || null,
    metadata: {
      hora_entrada:
        row.hora_entrada,
      hora_salida:
        row.hora_salida,
      duracion_minima_aplicada_minutos:
        row.duracion_minima_aplicada_minutos,
      duracion_registrada_segundos:
        row.duracion_registrada_segundos,
    },
  };
}


function buildVacacionEvento(
  row: CalendarioVacacionRow
): CalendarioEvento {
  return {
    id:
      `vacacion-${row.id}`,
    origen_id:
      Number(row.id),
    tipo:
      'vacacion',
    titulo:
      'Vacaciones',
    descripcion:
      `${Number(row.dias_solicitados || 0)} días solicitados`,
    fecha_inicio:
      normalizeRowDate(
        row.fecha_inicio
      ),
    fecha_fin:
      normalizeRowDate(
        row.fecha_fin
      ),
    estado:
      normalizeEstado(
        row.estado
      ),
    usuario_id:
      Number(row.usuario_id),
    empleado_nombre:
      empleadoNombre(row),
    empleado_correo:
      row.correo || null,
    metadata: {
      dias_solicitados:
        Number(row.dias_solicitados || 0),
    },
  };
}


function buildIncapacidadEvento(
  row: CalendarioIncapacidadRow
): CalendarioEvento {
  const dias =
    Number(row.dias_calculados || 0);

  return {
    id:
      `incapacidad-${row.id}`,
    origen_id:
      Number(row.id),
    tipo:
      'incapacidad',
    titulo:
      'Incapacidad médica',
    descripcion:
      row.motivo ||
      `${dias} días calculados`,
    fecha_inicio:
      normalizeRowDate(
        row.fecha_inicio
      ),
    fecha_fin:
      normalizeRowDate(
        row.fecha_fin
      ),
    estado:
      normalizeEstado(
        row.estado
      ),
    usuario_id:
      Number(row.usuario_id),
    empleado_nombre:
      empleadoNombre(row),
    empleado_correo:
      row.correo || null,
    metadata: {
      dias_calculados:
        dias,
      motivo:
        row.motivo,
    },
  };
}


function buildResumen(
  eventos: CalendarioEvento[]
) {
  return eventos.reduce(
    (acc, item) => {
      acc.total += 1;
      acc[item.tipo] += 1;
      return acc;
    },
    {
      total: 0,
      asistencia: 0,
      vacacion: 0,
      incapacidad: 0,
    }
  );
}


async function resolveEmployeeModuleAccess(
  actor: CalendarioActor
) {
  if (
    isAdmin(actor)
  ) {
    return {
      asistencia:
        true,
      vacaciones:
        true,
      incapacidades:
        true,
    };
  }

  const [
    asistencia,
    vacaciones,
  ] =
    await Promise.all([
      isModuloEnabledForUser(
        actor.userId,
        'asistencia'
      ),
      isModuloEnabledForUser(
        actor.userId,
        'vacaciones'
      ),
    ]);

  return {
    asistencia,
    vacaciones,
    incapacidades:
      true,
  };
}


export async function getCalendarioLaboral(
  actorInput: CalendarioActor | undefined,
  rawInicio?: unknown,
  rawFin?: unknown
) {
  const actor =
    assertActor(
      actorInput
    );

  const range =
    normalizeCalendarioRange(
      rawInicio,
      rawFin
    );

  const scope = {
    ...range,
    usuarioId:
      isAdmin(actor)
        ? undefined
        : actor.userId,
  };

  const access =
    await resolveEmployeeModuleAccess(
      actor
    );

  const [
    asistencias,
    vacaciones,
    incapacidades,
  ] =
    await Promise.all([
      access.asistencia
        ? listAsistenciasCalendario(
            scope
          )
        : Promise.resolve(
            []
          ),
      access.vacaciones
        ? listVacacionesCalendario(
            scope
          )
        : Promise.resolve(
            []
          ),
      access.incapacidades
        ? listIncapacidadesCalendario(
            scope
          )
        : Promise.resolve(
            []
          ),
    ]);

  const eventos = [
    ...asistencias.map(
      buildAsistenciaEvento
    ),
    ...vacaciones.map(
      buildVacacionEvento
    ),
    ...incapacidades.map(
      buildIncapacidadEvento
    ),
  ].sort(
    (a, b) =>
      a.fecha_inicio.localeCompare(
        b.fecha_inicio
      ) ||
      a.tipo.localeCompare(
        b.tipo
      ) ||
      a.id.localeCompare(
        b.id
      )
  );

  return {
    inicio:
      range.inicio,
    fin:
      range.fin,
    scope:
      isAdmin(actor)
        ? 'admin'
        : 'empleado',
    resumen:
      buildResumen(
        eventos
      ),
    eventos,
  };
}
