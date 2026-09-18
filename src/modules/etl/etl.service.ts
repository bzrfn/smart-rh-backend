import { pool } from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';

import {
  listStorageObjects,
  readStorageObject,
  writeStorageObject,
} from '../../config/storage.js';

import {
  ETLSource,
  ArchivoGenerado,
  ETLReporteData,
  ChartItem,
} from '../../types/etl.js';


// ============================================================
// FUENTES ETL PERMITIDAS
// ============================================================

const ALLOWED_ETL_SOURCES = new Set([
  'usuarios',
  'nomina',
  'vacaciones',
]);


export class ETLService {

  // ==========================================================
  // HELPERS
  // ==========================================================

  private toNumber(value: any): number {
    const numberValue = Number(value);

    return Number.isFinite(numberValue)
      ? numberValue
      : 0;
  }


  private normalizeEstado(value: any): string {
    return String(
      value || 'sin_estado'
    )
      .trim()
      .toLowerCase();
  }


  private formatDate(value: any): string {
    if (!value) {
      return 'Sin fecha';
    }


    if (value instanceof Date) {
      return value
        .toISOString()
        .slice(0, 10);
    }


    const text = String(value);


    if (text.includes('T')) {
      return text.slice(0, 10);
    }


    if (
      /^\d{4}-\d{2}-\d{2}/.test(text)
    ) {
      return text.slice(0, 10);
    }


    return text;
  }


  private groupCount(
    rows: any[],
    key: string,
    fallback = 'Sin dato'
  ): ChartItem[] {

    const map =
      new Map<string, number>();


    for (const row of rows) {

      const name =
        String(
          row[key] || fallback
        );


      map.set(
        name,
        (map.get(name) || 0) + 1
      );
    }


    return Array
      .from(map.entries())
      .map(
        ([name, value]) => ({
          name,
          value,
        })
      );
  }


  private csvEscape(
    value: any
  ): string {

    if (
      value === null ||
      value === undefined
    ) {
      return '';
    }


    const text =
      String(value)
        .replace(
          /"/g,
          '""'
        );


    if (
      text.includes(',') ||
      text.includes('\n') ||
      text.includes('"')
    ) {
      return `"${text}"`;
    }


    return text;
  }


  // ==========================================================
  // VALIDAR FUENTE ETL
  // ==========================================================

  private validateSourceName(
    source: ETLSource
  ): string {

    const sourceName =
      String(
        source?.name || ''
      )
        .trim()
        .toLowerCase();


    if (
      !sourceName ||
      !ALLOWED_ETL_SOURCES.has(
        sourceName
      )
    ) {
      throw new AppError(
        `Fuente ETL no permitida: ${sourceName || 'sin nombre'}`,
        400
      );
    }


    return sourceName;
  }


  // ==========================================================
  // VALIDAR NOMBRE DE ARCHIVO
  // ==========================================================

  private validateCsvFilename(
    filename: string
  ): string {

    const clean =
      String(
        filename || ''
      )
        .trim();


    if (
      !/^[a-zA-Z0-9._-]+\.csv$/i.test(
        clean
      )
    ) {
      throw new AppError(
        'Nombre de archivo ETL inválido.',
        400
      );
    }


    return clean;
  }


  // ==========================================================
  // EJECUTAR ETL
  // ==========================================================

  async ejecutarETL(
    sources: ETLSource[]
  ): Promise<ArchivoGenerado[]> {

    const archivos:
      ArchivoGenerado[] = [];


    for (
      const source of sources
    ) {

      // ------------------------------------------------------
      // VALIDAR FUENTE
      //
      // Esto se realiza ANTES del try/catch para que una fuente
      // inválida produzca HTTP 400 y no termine generando un
      // archivo como undefined.csv.
      // ------------------------------------------------------

      const sourceName =
        this.validateSourceName(
          source
        );


      const filename =
        `${sourceName}.csv`;


      let rows: any[] = [];


      try {

        // ----------------------------------------------------
        // USUARIOS
        // ----------------------------------------------------

        if (
          sourceName ===
          'usuarios'
        ) {

          const [results] =
            await pool.query(`
              SELECT
                u.id,
                u.nombre,
                u.apellido,
                u.correo,
                u.rol_id,
                u.activo,
                u.dias_vacaciones_disponibles,
                u.foto_perfil_url,
                COALESCE(
                  NULLIF(TRIM(r.nombre), ''),
                  CONCAT('Rol ', u.rol_id)
                ) AS rol
              FROM usuarios u
              LEFT JOIN roles r
                ON r.id = u.rol_id
            `);


          rows =
            Array.isArray(results)
              ? results
              : [];
        }


        // ----------------------------------------------------
        // NOMINA
        // ----------------------------------------------------

        if (
          sourceName ===
          'nomina'
        ) {

          const [results] =
            await pool.query(`
              SELECT
                id,
                usuario_id,
                salario_base,
                deducciones,
                bonos,
                total,
                estado,
                periodo_inicio,
                periodo_fin
              FROM nominas
            `);


          rows =
            Array.isArray(results)
              ? results
              : [];
        }


        // ----------------------------------------------------
        // VACACIONES
        // ----------------------------------------------------

        if (
          sourceName ===
          'vacaciones'
        ) {

          const [results] =
            await pool.query(`
              SELECT
                id,
                usuario_id,
                dias_disponibles,
                dias_solicitados,
                fecha_inicio,
                fecha_fin,
                estado
              FROM vacaciones
            `);


          rows =
            Array.isArray(results)
              ? results
              : [];
        }

      } catch (error: any) {

        console.error(
          '[ETL] Error procesando fuente',
          sourceName,
          error.message
        );


        rows = [];
      }


      // ------------------------------------------------------
      // GENERAR CSV
      // ------------------------------------------------------

      const csvContent =
        rows.length > 0
          ? Object
              .keys(rows[0])
              .join(',') +
            '\n' +
            rows
              .map(
                (row) =>
                  Object
                    .values(row)
                    .map(
                      (value) =>
                        this.csvEscape(
                          value
                        )
                    )
                    .join(',')
              )
              .join('\n')
          : 'No hay datos disponibles';


      // ------------------------------------------------------
      // STORAGE
      //
      // LOCAL:
      //
      // uploads/etl/usuarios.csv
      //
      // AWS:
      //
      // s3://bucket/etl/usuarios.csv
      // ------------------------------------------------------

      await writeStorageObject(
        `etl/${filename}`,
        csvContent,
        'text/csv; charset=utf-8'
      );


      archivos.push({
        name:
          filename,

        filasProcesadas:
          rows.length,
      });
    }


    return archivos;
  }


  // ==========================================================
  // LISTAR ARCHIVOS ETL
  // ==========================================================

  async listarArchivosGenerados():
  Promise<ArchivoGenerado[]> {

    const objects =
      await listStorageObjects(
        'etl'
      );


    return objects
      .filter(
        (key) =>
          key
            .toLowerCase()
            .endsWith('.csv')
      )
      .map(
        (key) => {

          const parts =
            key.split('/');


          return {
            name:
              parts[
                parts.length - 1
              ],
          };
        }
      );
  }


  // ==========================================================
  // OBTENER ARCHIVO ETL
  // ==========================================================

  async obtenerArchivoGenerado(
    filename: string
  ) {

    const cleanFilename =
      this.validateCsvFilename(
        filename
      );


    return await readStorageObject(
      `etl/${cleanFilename}`
    );
  }


  // ==========================================================
  // REPORTE ETL
  // ==========================================================

  async generarReporteETL():
  Promise<ETLReporteData> {

    // ========================================================
    // CONSULTAS
    // ========================================================

    const [usuariosResult] =
      await pool.query(`
        SELECT
          u.id,
          u.nombre,
          u.apellido,
          u.correo,
          u.rol_id,
          u.activo,
          u.dias_vacaciones_disponibles,
          u.foto_perfil_url,
          COALESCE(
            NULLIF(TRIM(r.nombre), ''),
            CONCAT('Rol ', u.rol_id)
          ) AS rol
        FROM usuarios u
        LEFT JOIN roles r
          ON r.id = u.rol_id
      `);


    const [nominasResult] =
      await pool.query(`
        SELECT
          id,
          usuario_id,
          salario_base,
          deducciones,
          bonos,
          total,
          estado,
          periodo_inicio,
          periodo_fin
        FROM nominas
      `);


    const [vacacionesResult] =
      await pool.query(`
        SELECT
          id,
          usuario_id,
          dias_disponibles,
          dias_solicitados,
          fecha_inicio,
          fecha_fin,
          estado
        FROM vacaciones
      `);


    // ========================================================
    // NORMALIZAR RESULTADOS
    // ========================================================

    const usuarios =
      Array.isArray(
        usuariosResult
      )
        ? usuariosResult as any[]
        : [];


    const nominas =
      Array.isArray(
        nominasResult
      )
        ? nominasResult as any[]
        : [];


    const vacaciones =
      Array.isArray(
        vacacionesResult
      )
        ? vacacionesResult as any[]
        : [];


    // ========================================================
    // USUARIOS
    // ========================================================

    const usuariosActivos =
      usuarios.filter(
        (user) =>
          this.toNumber(
            user.activo
          ) === 1
      ).length;


    const usuariosInactivos =
      usuarios.length -
      usuariosActivos;


    const usuariosConFoto =
      usuarios.filter(
        (user) =>
          Boolean(
            user.foto_perfil_url
          )
      ).length;


    const usuariosSinFoto =
      usuarios.length -
      usuariosConFoto;


    const totalDiasDisponibles =
      usuarios.reduce(
        (sum, user) =>
          sum +
          this.toNumber(
            user
              .dias_vacaciones_disponibles
          ),
        0
      );


    const promedioDiasVacacionesDisponibles =
      usuarios.length > 0
        ? totalDiasDisponibles /
          usuarios.length
        : 0;


    // ========================================================
    // NOMINA
    // ========================================================

    const totalSalarioBase =
      nominas.reduce(
        (sum, item) =>
          sum +
          this.toNumber(
            item.salario_base
          ),
        0
      );


    const totalBonos =
      nominas.reduce(
        (sum, item) =>
          sum +
          this.toNumber(
            item.bonos
          ),
        0
      );


    const totalDeducciones =
      nominas.reduce(
        (sum, item) =>
          sum +
          this.toNumber(
            item.deducciones
          ),
        0
      );


    const totalPagado =
      nominas.reduce(
        (sum, item) =>
          sum +
          this.toNumber(
            item.total
          ),
        0
      );


    const promedioSalarioBase =
      nominas.length > 0
        ? totalSalarioBase /
          nominas.length
        : 0;


    // ========================================================
    // VACACIONES
    // ========================================================

    const vacacionesPendientes =
      vacaciones.filter(
        (item) =>
          this.normalizeEstado(
            item.estado
          ) === 'pendiente'
      ).length;


    const vacacionesAprobadas =
      vacaciones.filter(
        (item) => {

          const estado =
            this.normalizeEstado(
              item.estado
            );


          return (
            estado === 'aprobada' ||
            estado === 'aprobado'
          );
        }
      ).length;


    const vacacionesRechazadas =
      vacaciones.filter(
        (item) => {

          const estado =
            this.normalizeEstado(
              item.estado
            );


          return (
            estado === 'rechazada' ||
            estado === 'rechazado'
          );
        }
      ).length;


    const totalDiasSolicitados =
      vacaciones.reduce(
        (sum, item) =>
          sum +
          this.toNumber(
            item.dias_solicitados
          ),
        0
      );


    const promedioDiasSolicitados =
      vacaciones.length > 0
        ? totalDiasSolicitados /
          vacaciones.length
        : 0;


    // ========================================================
    // NOMINA POR PERIODO
    // ========================================================

    const nominaPorPeriodoMap =
      new Map<
        string,
        {
          periodo: string;
          total: number;
          bonos: number;
          deducciones: number;
          salarioBase: number;
        }
      >();


    for (
      const item of nominas
    ) {

      const periodoInicio =
        this.formatDate(
          item.periodo_inicio
        );


      const periodoFin =
        this.formatDate(
          item.periodo_fin
        );


      const periodo =
        `${periodoInicio} a ${periodoFin}`;


      const current =
        nominaPorPeriodoMap.get(
          periodo
        ) || {
          periodo,
          total: 0,
          bonos: 0,
          deducciones: 0,
          salarioBase: 0,
        };


      current.total +=
        this.toNumber(
          item.total
        );


      current.bonos +=
        this.toNumber(
          item.bonos
        );


      current.deducciones +=
        this.toNumber(
          item.deducciones
        );


      current.salarioBase +=
        this.toNumber(
          item.salario_base
        );


      nominaPorPeriodoMap.set(
        periodo,
        current
      );
    }


    // ========================================================
    // VACACIONES POR FECHA
    // ========================================================

    const vacacionesPorFechaMap =
      new Map<
        string,
        {
          fecha: string;
          solicitudes: number;
          dias: number;
        }
      >();


    for (
      const item of vacaciones
    ) {

      const fecha =
        this.formatDate(
          item.fecha_inicio
        );


      const current =
        vacacionesPorFechaMap.get(
          fecha
        ) || {
          fecha,
          solicitudes: 0,
          dias: 0,
        };


      current.solicitudes +=
        1;


      current.dias +=
        this.toNumber(
          item.dias_solicitados
        );


      vacacionesPorFechaMap.set(
        fecha,
        current
      );
    }


    // ========================================================
    // INSIGHTS
    // ========================================================

    const insights:
      string[] = [];


    if (
      usuarios.length === 0
    ) {

      insights.push(
        'No existen usuarios registrados para analizar.'
      );

    } else {

      insights.push(
        `Actualmente existen ${usuarios.length} usuarios registrados en el sistema.`
      );
    }


    if (
      usuariosSinFoto > 0
    ) {

      insights.push(
        `${usuariosSinFoto} usuario(s) no tienen foto de perfil registrada.`
      );

    } else if (
      usuarios.length > 0
    ) {

      insights.push(
        'Todos los usuarios registrados cuentan con foto de perfil.'
      );
    }


    if (
      vacacionesPendientes > 0
    ) {

      insights.push(
        `Hay ${vacacionesPendientes} solicitud(es) de vacaciones pendientes por revisar.`
      );

    } else {

      insights.push(
        'No hay solicitudes de vacaciones pendientes en este momento.'
      );
    }


    if (
      totalPagado > 0
    ) {

      insights.push(
        `El total pagado registrado en nómina es de $${totalPagado.toLocaleString(
          'es-MX',
          {
            minimumFractionDigits:
              2,

            maximumFractionDigits:
              2,
          }
        )}.`
      );

    } else {

      insights.push(
        'No se encontró monto pagado en nómina para analizar.'
      );
    }


    if (
      totalBonos >
      totalDeducciones
    ) {

      insights.push(
        'Los bonos acumulados son mayores que las deducciones registradas.'
      );

    } else if (
      totalDeducciones >
      totalBonos
    ) {

      insights.push(
        'Las deducciones acumuladas son mayores que los bonos registrados.'
      );

    } else if (
      totalBonos > 0 ||
      totalDeducciones > 0
    ) {

      insights.push(
        'Los bonos y deducciones se encuentran equilibrados.'
      );
    }


    if (
      promedioDiasSolicitados > 0
    ) {

      insights.push(
        `El promedio de días solicitados por vacaciones es de ${promedioDiasSolicitados.toFixed(
          1
        )} días.`
      );
    }


    // ========================================================
    // RESPUESTA
    // ========================================================

    return {

      generatedAt:
        new Date()
          .toISOString(),


      resumen: {

        totalUsuarios:
          usuarios.length,

        usuariosActivos,

        usuariosInactivos,

        totalNominas:
          nominas.length,

        totalPagadoNomina:
          totalPagado,

        totalBonos,

        totalDeducciones,

        promedioSalarioBase,

        totalSolicitudesVacaciones:
          vacaciones.length,

        vacacionesPendientes,

        vacacionesAprobadas,

        vacacionesRechazadas,

        totalDiasSolicitados,
      },


      usuarios: {

        total:
          usuarios.length,

        activos:
          usuariosActivos,

        inactivos:
          usuariosInactivos,

        conFoto:
          usuariosConFoto,

        sinFoto:
          usuariosSinFoto,

        promedioDiasVacacionesDisponibles,

        porRol:
          this.groupCount(
            usuarios,
            'rol',
            'Sin rol'
          ),
      },


      nomina: {

        totalRegistros:
          nominas.length,

        totalSalarioBase,

        totalBonos,

        totalDeducciones,

        totalPagado,

        promedioSalarioBase,

        porEstado:
          this.groupCount(
            nominas,
            'estado',
            'Sin estado'
          ),

        componentes: [
          {
            name:
              'Salario base',

            value:
              totalSalarioBase,
          },

          {
            name:
              'Bonos',

            value:
              totalBonos,
          },

          {
            name:
              'Deducciones',

            value:
              totalDeducciones,
          },

          {
            name:
              'Total pagado',

            value:
              totalPagado,
          },
        ],

        porPeriodo:
          Array.from(
            nominaPorPeriodoMap.values()
          ),
      },


      vacaciones: {

        totalSolicitudes:
          vacaciones.length,

        pendientes:
          vacacionesPendientes,

        aprobadas:
          vacacionesAprobadas,

        rechazadas:
          vacacionesRechazadas,

        totalDiasSolicitados,

        promedioDiasSolicitados,

        porEstado:
          this.groupCount(
            vacaciones,
            'estado',
            'Sin estado'
          ),

        porFecha:
          Array.from(
            vacacionesPorFechaMap.values()
          ),
      },


      insights,
    };
  }
}
