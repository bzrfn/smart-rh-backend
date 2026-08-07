import { pool } from '../../config/db.js';

// Define la estructura de cada fila que será usada por el algoritmo de K-Means.
// Cada registro representa a un empleado con métricas de RRHH que sirven como variables de clustering.
export type KMeansEmployeeRow = {
  usuario_id: number;
  nombre: string;
  apellido: string;
  correo: string;
  role: string;
  antiguedad_dias: number;
  dias_vacaciones_disponibles: number;
  total_asistencias: number;
  asistencias_aprobadas: number;
  asistencias_pendientes: number;
  asistencias_rechazadas: number;
  asistencias_con_salida: number;
  tasa_aprobacion_asistencia: number;
  tasa_salida_asistencia: number;
  salario_estimado: number;
  promedio_nomina: number;
  solicitudes_vacaciones: number;
  dias_vacaciones_solicitados: number;
  contratos_activos: number;
};

type Row = Record<string, any>;

// Convierte cualquier valor a número, pero devuelve 0 si no es un número válido.
function toNumber(value: any) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// Normaliza texto para comparar estados de forma consistente: quita espacios y lo vuelve minúsculas.
function normalizeText(value: any) {
  return String(value || '').trim().toLowerCase();
}

// Calcula la diferencia en días entre dos fechas.
// Usa Math.ceil para contar días completos de forma conservadora.
function dateDiffInDays(start?: any, end?: any) {
  if (!start || !end) return 0;

  const startDate = new Date(start);
  const endDate = new Date(end);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return 0;
  }

  const diff = endDate.getTime() - startDate.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  return Math.max(days, 0);
}

// Similar a dateDiffInDays, pero incluye el día inicial y el final en el conteo.
function inclusiveDateDiffInDays(start?: any, end?: any) {
  const days = dateDiffInDays(start, end);

  if (!start || !end) return 0;

  return days + 1;
}
    
// Busca el primer valor numérico entre varias posibles columnas del registro.
// Sirve para soportar nombres de campos distintos en la base de datos.
function getFirstNumber(row: Row, keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return toNumber(row[key]);
    }
  }

  return 0;
}

// Busca el primer valor válido entre varias posibles columnas del registro.
// Se usa para recuperar fechas o textos cuando el nombre de columna cambia.
function getFirstValue(row: Row, keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return row[key];
    }
  }

  return null;
}

// Intenta obtener el ID de usuario desde varias variantes de nombres de columna.
// Esto hace el código más robusto frente a diferencias en el esquema.
function getUsuarioId(row: Row) {
  return toNumber(
    row.usuario_id ??
      row.id_usuario ??
      row.user_id ??
      row.empleado_id ??
      row.id_empleado ??
      row.id
  );
}

// Verifica si una tabla existe en la base de datos actual.
async function tableExists(tableName: string) {
  const [rows] = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = ?
    `,
    [tableName]
  );

  return toNumber((rows as any[])[0]?.total) > 0;
}

// Selecciona todos los registros de una tabla solo si esta existe.
// Evita errores si alguna tabla no está presente.
async function safeSelectAll(tableName: string) {
  const exists = await tableExists(tableName);

  if (!exists) {
    return [] as Row[];
  }

  const [rows] = await pool.query(`SELECT * FROM \`${tableName}\``);

  return rows as Row[];
}

// Agrupa las asistencias por usuario y acumula métricas de estado.
// Permite luego construir indicadores como aprobadas, pendientes, rechazadas y con salida.
function buildAsistenciaMap(asistencias: Row[]) {
  const map = new Map<number, {
    total_asistencias: number;
    asistencias_aprobadas: number;
    asistencias_pendientes: number;
    asistencias_rechazadas: number;
    asistencias_con_salida: number;
  }>();

  for (const row of asistencias) {
    const usuarioId = getUsuarioId(row);

    if (!usuarioId) continue;

    const current = map.get(usuarioId) || {
      total_asistencias: 0,
      asistencias_aprobadas: 0,
      asistencias_pendientes: 0,
      asistencias_rechazadas: 0,
      asistencias_con_salida: 0,
    };

    const estado = normalizeText(row.estado);

    current.total_asistencias += 1;

    if (estado === 'aprobada' || estado === 'aprobado' || estado === 'approved') {
      current.asistencias_aprobadas += 1;
    }

    if (estado === 'pendiente' || estado === 'pending') {
      current.asistencias_pendientes += 1;
    }

    if (estado === 'rechazada' || estado === 'rechazado' || estado === 'rejected') {
      current.asistencias_rechazadas += 1;
    }

    if (
      row.hora_salida !== undefined &&
      row.hora_salida !== null &&
      String(row.hora_salida).trim() !== ''
    ) {
      current.asistencias_con_salida += 1;
    }

    map.set(usuarioId, current);
  }

  return map;
}

// Agrupa los contratos por usuario y extrae métricas como cantidad de contratos activos y salario estimado.
function buildContratosMap(contratos: Row[]) {
  const map = new Map<number, {
    contratos_activos: number;
    salario_estimado: number;
  }>();

  for (const row of contratos) {
    const usuarioId = getUsuarioId(row);

    if (!usuarioId) continue;

    const current = map.get(usuarioId) || {
      contratos_activos: 0,
      salario_estimado: 0,
    };

    const estado = normalizeText(row.estado);

    if (
      estado === 'activo' ||
      estado === 'activa' ||
      estado === 'vigente' ||
      estado === 'aprobado' ||
      estado === 'aprobada'
    ) {
      current.contratos_activos += 1;
    }

    const salario = getFirstNumber(row, [
      'salario',
      'sueldo',
      'sueldo_base',
      'salario_base',
      'salario_mensual',
      'monto',
      'total',
    ]);

    if (salario > current.salario_estimado) {
      current.salario_estimado = salario;
    }

    map.set(usuarioId, current);
  }

  return map;
}

// Reúne los valores de nómina por usuario y calcula un promedio para tener una señal estable del salario.
function buildNominasMap(nominas: Row[]) {
  const totalsByUser = new Map<number, number[]>();

  for (const row of nominas) {
    const usuarioId = getUsuarioId(row);

    if (!usuarioId) continue;

    const total = getFirstNumber(row, [
      'total',
      'neto',
      'total_neto',
      'sueldo_neto',
      'salario_neto',
      'sueldo_base',
      'salario',
      'monto',
    ]);

    const current = totalsByUser.get(usuarioId) || [];
    current.push(total);

    totalsByUser.set(usuarioId, current);
  }

  const map = new Map<number, {
    promedio_nomina: number;
  }>();

  for (const [usuarioId, values] of totalsByUser.entries()) {
    const validValues = values.filter((value) => Number.isFinite(value));
    const promedio = validValues.length
      ? validValues.reduce((sum, value) => sum + value, 0) / validValues.length
      : 0;

    map.set(usuarioId, {
      promedio_nomina: promedio,
    });
  }

  return map;
}

// Agrupa las solicitudes de vacaciones por usuario y suma los días solicitados.
function buildVacacionesMap(vacaciones: Row[]) {
  const map = new Map<number, {
    solicitudes_vacaciones: number;
    dias_vacaciones_solicitados: number;
  }>();

  for (const row of vacaciones) {
    const usuarioId = getUsuarioId(row);

    if (!usuarioId) continue;

    const current = map.get(usuarioId) || {
      solicitudes_vacaciones: 0,
      dias_vacaciones_solicitados: 0,
    };

    current.solicitudes_vacaciones += 1;

    let dias = getFirstNumber(row, [
      'dias',
      'dia',
      'dias_solicitados',
      'dias_vacaciones',
      'total_dias',
      'cantidad_dias',
      'numero_dias',
    ]);

    if (!dias) {
      const fechaInicio = getFirstValue(row, [
        'fecha_inicio',
        'inicio',
        'fecha_desde',
        'desde',
      ]);

      const fechaFin = getFirstValue(row, [
        'fecha_fin',
        'fin',
        'fecha_hasta',
        'hasta',
      ]);

      dias = inclusiveDateDiffInDays(fechaInicio, fechaFin);
    }

    current.dias_vacaciones_solicitados += dias;

    map.set(usuarioId, current);
  }

  return map;
}

// Función principal que arma el dataset listo para usar en K-Means.
// Reúne información de usuarios, asistencias, contratos, nóminas y vacaciones
// y la transforma en una estructura uniforme por empleado.
export async function obtenerDatasetKMeans() {
  const [
    usuarios,
    asistencias,
    contratos,
    nominas,
    vacaciones,
  ] = await Promise.all([
    safeSelectAll('usuarios'),
    safeSelectAll('asistencias'),
    safeSelectAll('contratos'),
    safeSelectAll('nominas'),
    safeSelectAll('vacaciones'),
  ]);

  // Construye mapas indexados por usuario para acceder a la información de forma rápida.
  const asistenciaMap = buildAsistenciaMap(asistencias);
  const contratosMap = buildContratosMap(contratos);
  const nominasMap = buildNominasMap(nominas);
  const vacacionesMap = buildVacacionesMap(vacaciones);

  const today = new Date();

  // Filtra usuarios no administrativos y transforma cada registro en una fila de entrenamiento.
  const dataset: KMeansEmployeeRow[] = usuarios
    .filter((usuario) => {
      const role = normalizeText(usuario.role || usuario.rol);

      return role !== 'admin' && role !== 'administrador';
    })
    .map((usuario) => {
      const usuarioId = toNumber(usuario.id);

      // Obtiene estadísticas agregadas para este usuario, o valores por defecto si no existen.
      const asistencia = asistenciaMap.get(usuarioId) || {
        total_asistencias: 0,
        asistencias_aprobadas: 0,
        asistencias_pendientes: 0,
        asistencias_rechazadas: 0,
        asistencias_con_salida: 0,
      };

      const contrato = contratosMap.get(usuarioId) || {
        contratos_activos: 0,
        salario_estimado: 0,
      };

      const nomina = nominasMap.get(usuarioId) || {
        promedio_nomina: 0,
      };

      const vacacion = vacacionesMap.get(usuarioId) || {
        solicitudes_vacaciones: 0,
        dias_vacaciones_solicitados: 0,
      };

      // Busca la fecha de ingreso entre varios nombres de columna posibles.
      const fechaIngreso = getFirstValue(usuario, [
        'fecha_ingreso',
        'created_at',
        'creado_en',
        'fecha_creacion',
      ]);

      // Calcula la antigüedad en días hasta la fecha actual.
      const antiguedad = fechaIngreso
        ? dateDiffInDays(fechaIngreso, today)
        : 0;

      const totalAsistencias = asistencia.total_asistencias;
      const asistenciasAprobadas = asistencia.asistencias_aprobadas;
      const asistenciasConSalida = asistencia.asistencias_con_salida;

      // Calcula tasas relativas para normalizar el comportamiento del empleado.
      const tasaAprobacion =
        totalAsistencias > 0 ? asistenciasAprobadas / totalAsistencias : 0;

      const tasaSalida =
        totalAsistencias > 0 ? asistenciasConSalida / totalAsistencias : 0;

      // Usa el salario estimado del contrato si existe; si no, cae al promedio de nómina.
      const salarioEstimado =
        contrato.salario_estimado > 0
          ? contrato.salario_estimado
          : nomina.promedio_nomina;

      return {
        // Identificación básica del empleado.
        usuario_id: usuarioId,
        nombre: String(usuario.nombre || ''),
        apellido: String(usuario.apellido || ''),
        correo: String(usuario.correo || usuario.email || ''),
        role: String(usuario.role || usuario.rol || ''),

        // Antigüedad y disponibilidad de vacaciones.
        antiguedad_dias: Math.round(antiguedad),
        dias_vacaciones_disponibles: getFirstNumber(usuario, [
          'dias_vacaciones_disponibles',
          'vacaciones_disponibles',
          'dias_disponibles',
        ]),

        // Indicadores de asistencia.
        total_asistencias: totalAsistencias,
        asistencias_aprobadas: asistenciasAprobadas,
        asistencias_pendientes: asistencia.asistencias_pendientes,
        asistencias_rechazadas: asistencia.asistencias_rechazadas,
        asistencias_con_salida: asistenciasConSalida,

        // Tasas calculadas a partir de las asistencias.
        tasa_aprobacion_asistencia: Number(tasaAprobacion.toFixed(4)),
        tasa_salida_asistencia: Number(tasaSalida.toFixed(4)),

        // Indicadores salariales.
        salario_estimado: Number(salarioEstimado.toFixed(2)),
        promedio_nomina: Number(nomina.promedio_nomina.toFixed(2)),

        // Indicadores de vacaciones.
        solicitudes_vacaciones: vacacion.solicitudes_vacaciones,
        dias_vacaciones_solicitados: vacacion.dias_vacaciones_solicitados,

        // Cantidad de contratos activos.
        contratos_activos: contrato.contratos_activos,
      };
    })
    // Elimina registros sin ID válido para evitar filas incompletas.
    .filter((row) => row.usuario_id);

  return dataset;
}