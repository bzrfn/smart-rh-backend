import { pool } from '../../config/db.js';

// Tipo auxiliar para representar una fila genérica de la base de datos.
type Row = Record<string, any>;

// Convierte cualquier valor en número; si no se puede convertir, devuelve 0.
function toNumber(value: any) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// Normaliza texto para comparar estados, nombres o valores de forma consistente.
function normalizeText(value: any) {
  return String(value || '').trim().toLowerCase();
}

// Busca el primer valor numérico válido entre varias claves posibles.
// Esto sirve porque algunas tablas usan nombres ligeramente distintos para el mismo dato.
function getFirstNumber(row: Row, keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return toNumber(row[key]);
    }
  }

  return 0;
}

// Obtiene el ID de usuario desde nombres de columna alternativos.
function getUsuarioId(row: Row) {
  return toNumber(
    row.usuario_id ??
      row.id_usuario ??
      row.user_id ??
      row.empleado_id ??
      row.id_empleado
  );
}

// Normaliza una fecha para usarla como clave de agrupación sin problemas de zona horaria.
function formatDateKey(value: any) {
  if (!value) return 'Sin fecha';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

// Construye el nombre completo del empleado para mostrarlo en reportes y gráficas.
function displayName(usuario?: Row) {
  if (!usuario) return 'Sin empleado';

  const nombre = String(usuario.nombre || '').trim();
  const apellido = String(usuario.apellido || '').trim();

  return `${nombre} ${apellido}`.trim() || usuario.correo || 'Sin empleado';
}

// Calcula el promedio de un arreglo de números ignorando valores inválidos.
function average(values: number[]) {
  const validValues = values.filter((value) => Number.isFinite(value));

  if (!validValues.length) return 0;

  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
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

// Selecciona todos los registros de una tabla solo si existe.
async function safeSelectAll(tableName: string) {
  const exists = await tableExists(tableName);

  if (!exists) {
    return [] as Row[];
  }

  const [rows] = await pool.query(`SELECT * FROM \`${tableName}\``);

  return rows as Row[];
}


// Obtiene los usuarios junto con el nombre real de su rol.
// Evita depender de IDs fijos como rol_id = 1 para identificar administradores.
async function safeSelectUsuariosConRol() {
  const [usuariosExiste, rolesExiste] =
    await Promise.all([
      tableExists('usuarios'),
      tableExists('roles'),
    ]);

  if (
    !usuariosExiste ||
    !rolesExiste
  ) {
    return [] as Row[];
  }

  const [rows] =
    await pool.query(
      `SELECT
         u.*,
         r.nombre AS rol_nombre
       FROM usuarios u
       JOIN roles r
         ON r.id = u.rol_id`
    );

  return rows as Row[];
}


// Determina si un usuario activo debe formar parte
// de las métricas de personal de Analytics.
export function isAnalyticsEmployee(
  usuario: Row
): boolean {
  const activo =
    toNumber(
      usuario.activo ?? 1
    );

  const rol =
    normalizeText(
      usuario.rol_nombre ??
      usuario.role ??
      usuario.rol
    );

  return (
    activo === 1 &&
    rol !== 'admin' &&
    rol !== 'administrador'
  );
}

// Normaliza distintos nombres de estados para que queden dentro de un conjunto fijo.
// Ejemplo: "aprobado", "aprobada", "approved" o "pendiente" se convierten a un mismo formato.
function normalizeEstado(value: any) {
  const estado = normalizeText(value);

  if (!estado) return 'sin_estado';

  if (estado.includes('aprob')) return 'aprobada';
  if (estado.includes('pend')) return 'pendiente';
  if (estado.includes('rech')) return 'rechazada';
  if (estado.includes('pag')) return 'pagado';
  if (estado.includes('activo')) return 'activo';
  if (estado.includes('inactivo')) return 'inactivo';
  if (estado.includes('final')) return 'finalizado';

  return estado;
}

// Construye una gráfica de barras o de conteo a partir de una lista de filas y una lista base de estados.
// Sirve para saber, por ejemplo, cuántas asistencias están aprobadas, pendientes o rechazadas.
function buildEstadoChart(
  rows: Row[],
  defaultEstados: string[],
  estadoKey = 'estado'
) {
  const map = new Map<string, number>();

  for (const estado of defaultEstados) {
    map.set(estado, 0);
  }

  for (const row of rows) {
    const estado = normalizeEstado(row[estadoKey]);
    map.set(estado, (map.get(estado) || 0) + 1);
  }

  return Array.from(map.entries()).map(([name, value]) => ({
    name,
    value,
  }));
}

// Agrupa asistencias por fecha para representar la evolución temporal del comportamiento del personal.
function buildAsistenciaPorFecha(asistencias: Row[]) {
  const map = new Map<
    string,
    {
      fecha: string;
      asistencias: number;
      aprobadas: number;
      pendientes: number;
      rechazadas: number;
    }
  >();

  for (const row of asistencias) {
    const fecha = formatDateKey(row.fecha);
    const estado = normalizeEstado(row.estado);

    const current = map.get(fecha) || {
      fecha,
      asistencias: 0,
      aprobadas: 0,
      pendientes: 0,
      rechazadas: 0,
    };

    current.asistencias += 1;

    if (estado === 'aprobada') current.aprobadas += 1;
    if (estado === 'pendiente') current.pendientes += 1;
    if (estado === 'rechazada') current.rechazadas += 1;

    map.set(fecha, current);
  }

  return Array.from(map.values())
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(-20);
}

// Calcula el promedio de nómina por empleado a partir de todas sus filas de nómina.
function buildNominaPorEmpleado(nominas: Row[], usuariosMap: Map<number, Row>) {
  const map = new Map<number, number[]>();

  for (const row of nominas) {
    const usuarioId = getUsuarioId(row);

    if (!usuarioId) continue;

    const total = getFirstNumber(row, [
      'total',
      'salario_base',
      'sueldo_base',
      'neto',
      'monto',
      'salario',
    ]);

    const current = map.get(usuarioId) || [];
    current.push(total);

    map.set(usuarioId, current);
  }

  return Array.from(map.entries())
    .map(([usuarioId, values]) => ({
      usuario_id: usuarioId,
      empleado: displayName(usuariosMap.get(usuarioId)),
      promedio_nomina: Number(average(values).toFixed(2)),
    }))
    .sort((a, b) => b.promedio_nomina - a.promedio_nomina)
    .slice(0, 10);
}

// Agrupa las solicitudes de vacaciones por empleado y suma los días solicitados.
function buildVacacionesPorEmpleado(
  vacaciones: Row[],
  usuariosMap: Map<number, Row>
) {
  const map = new Map<
    number,
    {
      usuario_id: number;
      empleado: string;
      solicitudes: number;
      dias_solicitados: number;
    }
  >();

  for (const row of vacaciones) {
    const usuarioId = getUsuarioId(row);

    if (!usuarioId) continue;

    const current = map.get(usuarioId) || {
      usuario_id: usuarioId,
      empleado: displayName(usuariosMap.get(usuarioId)),
      solicitudes: 0,
      dias_solicitados: 0,
    };

    current.solicitudes += 1;
    current.dias_solicitados += getFirstNumber(row, [
      'dias_solicitados',
      'dias',
      'total_dias',
      'cantidad_dias',
    ]);

    map.set(usuarioId, current);
  }

  return Array.from(map.values())
    .sort((a, b) => b.dias_solicitados - a.dias_solicitados)
    .slice(0, 10);
}

// Combina asistencia, nómina y vacaciones para crear una vista comparativa por empleado.
// Sirve para detectar relación entre rendimiento de asistencia y nivel salarial o descanso solicitado.
function buildAsistenciaVsNomina(
  usuarios: Row[],
  asistencias: Row[],
  nominas: Row[],
  vacaciones: Row[]
) {
  const asistenciaMap = new Map<
    number,
    {
      total: number;
      aprobadas: number;
      pendientes: number;
      rechazadas: number;
    }
  >();

  const nominaMap = new Map<number, number[]>();
  const vacacionesMap = new Map<number, number>();

  for (const row of asistencias) {
    const usuarioId = getUsuarioId(row);
    if (!usuarioId) continue;

    const estado = normalizeEstado(row.estado);

    const current = asistenciaMap.get(usuarioId) || {
      total: 0,
      aprobadas: 0,
      pendientes: 0,
      rechazadas: 0,
    };

    current.total += 1;

    if (estado === 'aprobada') current.aprobadas += 1;
    if (estado === 'pendiente') current.pendientes += 1;
    if (estado === 'rechazada') current.rechazadas += 1;

    asistenciaMap.set(usuarioId, current);
  }

  for (const row of nominas) {
    const usuarioId = getUsuarioId(row);
    if (!usuarioId) continue;

    const total = getFirstNumber(row, [
      'total',
      'salario_base',
      'sueldo_base',
      'neto',
      'monto',
      'salario',
    ]);

    const current = nominaMap.get(usuarioId) || [];
    current.push(total);

    nominaMap.set(usuarioId, current);
  }

  for (const row of vacaciones) {
    const usuarioId = getUsuarioId(row);
    if (!usuarioId) continue;

    vacacionesMap.set(usuarioId, (vacacionesMap.get(usuarioId) || 0) + 1);
  }

  return usuarios
    .map((usuario) => {
      const usuarioId = toNumber(usuario.id);
      const asistencia = asistenciaMap.get(usuarioId) || {
        total: 0,
        aprobadas: 0,
        pendientes: 0,
        rechazadas: 0,
      };

      const tasaAprobacion =
        asistencia.total > 0 ? asistencia.aprobadas / asistencia.total : 0;

      const promedioNomina = average(nominaMap.get(usuarioId) || []);

      return {
        usuario_id: usuarioId,
        empleado: displayName(usuario),
        correo: String(usuario.correo || ''),
        tasa_asistencia: Number(tasaAprobacion.toFixed(4)),
        nomina_promedio: Number(promedioNomina.toFixed(2)),
        asistencias: asistencia.total,
        incidencias: asistencia.pendientes + asistencia.rechazadas,
        solicitudes_vacaciones: vacacionesMap.get(usuarioId) || 0,
      };
    })
    .filter((item) => item.asistencias > 0 || item.nomina_promedio > 0);
}

// Genera interpretaciones automáticas para contextualizar cada KPI y permitir lectura del dashboard.
function buildInterpretaciones(params: {
  totalEmpleados: number;
  totalAsistencias: number;
  tasaAprobacion: number;
  promedioNomina: number;
  totalVacaciones: number;
  totalIncidencias: number;
}) {
  const {
    totalEmpleados,
    totalAsistencias,
    tasaAprobacion,
    promedioNomina,
    totalVacaciones,
    totalIncidencias,
  } = params;

  const asistencia =
    tasaAprobacion >= 0.8
      ? 'La asistencia general muestra un comportamiento favorable porque la mayoría de registros se encuentran aprobados.'
      : tasaAprobacion >= 0.5
        ? 'La asistencia general es moderada. Existen registros aprobados, pero también hay incidencias que deben revisarse.'
        : 'La asistencia general requiere atención, ya que existe una proporción importante de registros pendientes o rechazados.';

  const nomina =
    promedioNomina > 0
      ? `La nómina promedio permite comparar el comportamiento económico del personal. El promedio actual es de ${promedioNomina.toFixed(
          2
        )} MXN.`
      : 'No hay suficiente información de nómina para generar una interpretación económica.';

  const vacaciones =
    totalVacaciones > 0
      ? 'Las solicitudes de vacaciones permiten observar carga administrativa y comportamiento de descanso del personal.'
      : 'No existen suficientes solicitudes de vacaciones para identificar patrones administrativos.';

  const incidencias =
    totalIncidencias > 0
      ? 'Las incidencias detectadas deben revisarse como apoyo preventivo para Recursos Humanos.'
      : 'No se observan incidencias relevantes en los datos analizados.';

  const conclusion =
    totalEmpleados > 0 && totalAsistencias > 0
      ? 'El dashboard permite convertir registros operativos de SMART RH en información visual útil para la toma de decisiones.'
      : 'El dashboard requiere más datos operativos para generar visualizaciones con mayor valor analítico.';

  return {
    asistencia,
    nomina,
    vacaciones,
    incidencias,
    conclusion,
  };
}

// Función principal que arma el resumen visual del dashboard.
// Reúne KPI, gráficas, descripciones e interpretaciones para ser consumido por la API.
export async function obtenerResumenVisualRepository() {
  // Carga todas las tablas relevantes de RRHH en paralelo para acelerar la consulta.
  const [usuarios, asistencias, contratos, nominas, vacaciones] = await Promise.all([
    safeSelectUsuariosConRol(),
    safeSelectAll('asistencias'),
    safeSelectAll('contratos'),
    safeSelectAll('nominas'),
    safeSelectAll('vacaciones'),
  ]);

  // Filtra personal activo usando el nombre real del rol.
  // No depende de que el administrador tenga un ID específico.
  const empleados =
    usuarios.filter(
      isAnalyticsEmployee
    );

  const empleadosIds = new Set(empleados.map((usuario) => toNumber(usuario.id)));

  // Mapea usuarios para buscar su información rápidamente en los reportes.
  const usuariosMap = new Map<number, Row>(
    empleados.map((usuario) => [toNumber(usuario.id), usuario])
  );

  // Limpia cada conjunto de registros para trabajar solo con empleados válidos.
  const asistenciasFiltradas = asistencias.filter((row) =>
    empleadosIds.has(getUsuarioId(row))
  );

  const contratosFiltrados = contratos.filter((row) =>
    empleadosIds.has(getUsuarioId(row))
  );

  const nominasFiltradas = nominas.filter((row) =>
    empleadosIds.has(getUsuarioId(row))
  );

  const vacacionesFiltradas = vacaciones.filter((row) =>
    empleadosIds.has(getUsuarioId(row))
  );

  const totalAsistencias = asistenciasFiltradas.length;

  // Calcula contadores por estado para la sección de asistencia.
  const asistenciasAprobadas = asistenciasFiltradas.filter(
    (row) => normalizeEstado(row.estado) === 'aprobada'
  ).length;

  const asistenciasPendientes = asistenciasFiltradas.filter(
    (row) => normalizeEstado(row.estado) === 'pendiente'
  ).length;

  const asistenciasRechazadas = asistenciasFiltradas.filter(
    (row) => normalizeEstado(row.estado) === 'rechazada'
  ).length;

  // Extrae los valores de nómina de todas las filas del personal activo.
  const nominaValores = nominasFiltradas.map((row) =>
    getFirstNumber(row, [
      'total',
      'salario_base',
      'sueldo_base',
      'neto',
      'monto',
      'salario',
    ])
  );

  const promedioNomina = average(nominaValores);

  // Cuenta contratos activos para KPI de estructura laboral.
  const contratosActivos = contratosFiltrados.filter(
    (row) => normalizeEstado(row.estado) === 'activo'
  ).length;

  const totalIncidencias = asistenciasPendientes + asistenciasRechazadas;

  const tasaAprobacion =
    totalAsistencias > 0 ? asistenciasAprobadas / totalAsistencias : 0;

  // Construye los grupos de datos usados por el dashboard para graficar.
  const charts = {
    asistenciasPorEstado: buildEstadoChart(asistenciasFiltradas, [
      'aprobada',
      'pendiente',
      'rechazada',
    ]),
    asistenciasPorFecha: buildAsistenciaPorFecha(asistenciasFiltradas),
    nominaTopEmpleados: buildNominaPorEmpleado(nominasFiltradas, usuariosMap),
    vacacionesPorEstado: buildEstadoChart(vacacionesFiltradas, [
      'aprobada',
      'pendiente',
      'rechazada',
    ]),
    vacacionesPorEmpleado: buildVacacionesPorEmpleado(
      vacacionesFiltradas,
      usuariosMap
    ),
    contratosPorEstado: buildEstadoChart(contratosFiltrados, [
      'activo',
      'inactivo',
      'finalizado',
    ]),
    asistenciaVsNomina: buildAsistenciaVsNomina(
      empleados,
      asistenciasFiltradas,
      nominasFiltradas,
      vacacionesFiltradas
    ),
  };

  // Genera interpretaciones textuales para explicarle al usuario qué significan los KPI.
  const interpretaciones = buildInterpretaciones({
    totalEmpleados: empleados.length,
    totalAsistencias,
    tasaAprobacion,
    promedioNomina,
    totalVacaciones: vacacionesFiltradas.length,
    totalIncidencias,
  });

  // Describe cada gráfica del dashboard y el tipo de visualización más útil para ella.
  const graficas = [
    {
      nombre: 'Asistencias por estado',
      tipo: 'Gráfica de barras',
      pregunta: '¿Cuántas asistencias fueron aprobadas, pendientes o rechazadas?',
      justificacion:
        'Se utiliza barras porque permite comparar categorías de forma clara.',
    },
    {
      nombre: 'Evolución de asistencias',
      tipo: 'Gráfica de línea',
      pregunta: '¿Cómo cambia la asistencia a través del tiempo?',
      justificacion:
        'Se utiliza línea porque representa una tendencia temporal por fecha.',
    },
    {
      nombre: 'Nómina promedio por empleado',
      tipo: 'Barras horizontales',
      pregunta: '¿Qué empleados tienen mayor promedio de nómina?',
      justificacion:
        'Se utiliza barra horizontal porque los nombres de empleados son largos y se comparan cantidades.',
    },
    {
      nombre: 'Vacaciones por estado',
      tipo: 'Gráfica de dona',
      pregunta: '¿Cómo se distribuyen las solicitudes de vacaciones?',
      justificacion:
        'Se utiliza dona porque son pocas categorías y se busca mostrar proporción.',
    },
    {
      nombre: 'Asistencia vs nómina',
      tipo: 'Gráfica de dispersión',
      pregunta: '¿Existe relación visual entre asistencia y nómina?',
      justificacion:
        'Se utiliza dispersión porque compara dos variables numéricas al mismo tiempo.',
    },
  ];

  // Devuelve todo el resumen listo para que la capa de servicio o controlador lo envíe a frontend.
  return {
    generatedAt: new Date().toISOString(),
    kpis: {
      totalEmpleados: empleados.length,
      totalAsistencias,
      asistenciasAprobadas,
      asistenciasPendientes,
      asistenciasRechazadas,
      tasaAprobacion: Number(tasaAprobacion.toFixed(4)),
      promedioNomina: Number(promedioNomina.toFixed(2)),
      solicitudesVacaciones: vacacionesFiltradas.length,
      contratosActivos,
      totalIncidencias,
    },
    charts,
    interpretaciones,
    graficas,
  };
}
