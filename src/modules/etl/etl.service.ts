import { pool } from '../../config/db.js';
import fs from 'fs';
import path from 'path';
import {
  ETLSource,
  ArchivoGenerado,
  ETLReporteData,
  ChartItem,
} from '../../types/etl.js';

export class ETLService {
  private outputDir = path.join(process.cwd(), 'uploads', 'etl');

  constructor() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  private toNumber(value: any): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  private normalizeEstado(value: any): string {
    return String(value || 'sin_estado').trim().toLowerCase();
  }

  private formatDate(value: any): string {
    if (!value) return 'Sin fecha';

    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }

    const text = String(value);
    if (text.includes('T')) return text.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);

    return text;
  }

  private groupCount(rows: any[], key: string, fallback = 'Sin dato'): ChartItem[] {
    const map = new Map<string, number>();

    for (const row of rows) {
      const name = String(row[key] || fallback);
      map.set(name, (map.get(name) || 0) + 1);
    }

    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }

  private csvEscape(value: any): string {
    if (value === null || value === undefined) return '';
    const text = String(value).replace(/"/g, '""');

    if (text.includes(',') || text.includes('\n') || text.includes('"')) {
      return `"${text}"`;
    }

    return text;
  }

  async ejecutarETL(sources: ETLSource[]): Promise<ArchivoGenerado[]> {
    const archivos: ArchivoGenerado[] = [];

    for (const source of sources) {
      const filename = `${source.name}.csv`;
      const filepath = path.join(this.outputDir, filename);

      let rows: any[] = [];

      try {
        if (source.name === 'usuarios') {
          const [results] = await pool.query(`
            SELECT 
              id,
              nombre,
              apellido,
              correo,
              rol_id,
              activo,
              dias_vacaciones_disponibles,
              foto_perfil_url,
              CASE 
                WHEN rol_id = 1 THEN 'Admin'
                WHEN rol_id = 2 THEN 'Empleado'
                ELSE CONCAT('Rol ', rol_id)
              END AS rol
            FROM usuarios
          `);

          rows = Array.isArray(results) ? results : [];
        }

        if (source.name === 'nomina') {
          const [results] = await pool.query(`
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

          rows = Array.isArray(results) ? results : [];
        }

        if (source.name === 'vacaciones') {
          const [results] = await pool.query(`
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

          rows = Array.isArray(results) ? results : [];
        }
      } catch (err: any) {
        console.error('Error ejecutando ETL en source', source.name, err.message);
        rows = [];
      }

      const csvContent =
        rows.length > 0
          ? Object.keys(rows[0]).join(',') +
            '\n' +
            rows
              .map((row) =>
                Object.values(row)
                  .map((value) => this.csvEscape(value))
                  .join(',')
              )
              .join('\n')
          : 'No hay datos disponibles';

      fs.writeFileSync(filepath, csvContent, 'utf8');

      archivos.push({
        name: filename,
        filasProcesadas: rows.length,
      });
    }

    return archivos;
  }

  listarArchivosGenerados(): ArchivoGenerado[] {
    if (!fs.existsSync(this.outputDir)) return [];

    return fs
      .readdirSync(this.outputDir)
      .filter((file) => file.endsWith('.csv'))
      .map((file) => ({ name: file }));
  }

  async generarReporteETL(): Promise<ETLReporteData> {
    const [usuariosResult] = await pool.query(`
      SELECT 
        id,
        nombre,
        apellido,
        correo,
        rol_id,
        activo,
        dias_vacaciones_disponibles,
        foto_perfil_url,
        CASE 
          WHEN rol_id = 1 THEN 'Admin'
          WHEN rol_id = 2 THEN 'Empleado'
          ELSE CONCAT('Rol ', rol_id)
        END AS rol
      FROM usuarios
    `);

    const [nominasResult] = await pool.query(`
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

    const [vacacionesResult] = await pool.query(`
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

    const usuarios = Array.isArray(usuariosResult) ? (usuariosResult as any[]) : [];
    const nominas = Array.isArray(nominasResult) ? (nominasResult as any[]) : [];
    const vacaciones = Array.isArray(vacacionesResult) ? (vacacionesResult as any[]) : [];

    const usuariosActivos = usuarios.filter((user) => this.toNumber(user.activo) === 1).length;
    const usuariosInactivos = usuarios.length - usuariosActivos;
    const usuariosConFoto = usuarios.filter((user) => Boolean(user.foto_perfil_url)).length;
    const usuariosSinFoto = usuarios.length - usuariosConFoto;

    const totalDiasDisponibles = usuarios.reduce(
      (sum, user) => sum + this.toNumber(user.dias_vacaciones_disponibles),
      0
    );

    const promedioDiasVacacionesDisponibles =
      usuarios.length > 0 ? totalDiasDisponibles / usuarios.length : 0;

    const totalSalarioBase = nominas.reduce(
      (sum, item) => sum + this.toNumber(item.salario_base),
      0
    );

    const totalBonos = nominas.reduce(
      (sum, item) => sum + this.toNumber(item.bonos),
      0
    );

    const totalDeducciones = nominas.reduce(
      (sum, item) => sum + this.toNumber(item.deducciones),
      0
    );

    const totalPagado = nominas.reduce(
      (sum, item) => sum + this.toNumber(item.total),
      0
    );

    const promedioSalarioBase =
      nominas.length > 0 ? totalSalarioBase / nominas.length : 0;

    const vacacionesPendientes = vacaciones.filter(
      (item) => this.normalizeEstado(item.estado) === 'pendiente'
    ).length;

    const vacacionesAprobadas = vacaciones.filter(
      (item) => this.normalizeEstado(item.estado) === 'aprobada' || this.normalizeEstado(item.estado) === 'aprobado'
    ).length;

    const vacacionesRechazadas = vacaciones.filter(
      (item) => this.normalizeEstado(item.estado) === 'rechazada' || this.normalizeEstado(item.estado) === 'rechazado'
    ).length;

    const totalDiasSolicitados = vacaciones.reduce(
      (sum, item) => sum + this.toNumber(item.dias_solicitados),
      0
    );

    const promedioDiasSolicitados =
      vacaciones.length > 0 ? totalDiasSolicitados / vacaciones.length : 0;

    const nominaPorPeriodoMap = new Map<
      string,
      {
        periodo: string;
        total: number;
        bonos: number;
        deducciones: number;
        salarioBase: number;
      }
    >();

    for (const item of nominas) {
      const periodoInicio = this.formatDate(item.periodo_inicio);
      const periodoFin = this.formatDate(item.periodo_fin);
      const periodo = `${periodoInicio} a ${periodoFin}`;

      const current = nominaPorPeriodoMap.get(periodo) || {
        periodo,
        total: 0,
        bonos: 0,
        deducciones: 0,
        salarioBase: 0,
      };

      current.total += this.toNumber(item.total);
      current.bonos += this.toNumber(item.bonos);
      current.deducciones += this.toNumber(item.deducciones);
      current.salarioBase += this.toNumber(item.salario_base);

      nominaPorPeriodoMap.set(periodo, current);
    }

    const vacacionesPorFechaMap = new Map<
      string,
      {
        fecha: string;
        solicitudes: number;
        dias: number;
      }
    >();

    for (const item of vacaciones) {
      const fecha = this.formatDate(item.fecha_inicio);

      const current = vacacionesPorFechaMap.get(fecha) || {
        fecha,
        solicitudes: 0,
        dias: 0,
      };

      current.solicitudes += 1;
      current.dias += this.toNumber(item.dias_solicitados);

      vacacionesPorFechaMap.set(fecha, current);
    }

    const insights: string[] = [];

    if (usuarios.length === 0) {
      insights.push('No existen usuarios registrados para analizar.');
    } else {
      insights.push(`Actualmente existen ${usuarios.length} usuarios registrados en el sistema.`);
    }

    if (usuariosSinFoto > 0) {
      insights.push(`${usuariosSinFoto} usuario(s) no tienen foto de perfil registrada.`);
    } else if (usuarios.length > 0) {
      insights.push('Todos los usuarios registrados cuentan con foto de perfil.');
    }

    if (vacacionesPendientes > 0) {
      insights.push(`Hay ${vacacionesPendientes} solicitud(es) de vacaciones pendientes por revisar.`);
    } else {
      insights.push('No hay solicitudes de vacaciones pendientes en este momento.');
    }

    if (totalPagado > 0) {
      insights.push(`El total pagado registrado en nómina es de $${totalPagado.toLocaleString('es-MX', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}.`);
    } else {
      insights.push('No se encontró monto pagado en nómina para analizar.');
    }

    if (totalBonos > totalDeducciones) {
      insights.push('Los bonos acumulados son mayores que las deducciones registradas.');
    } else if (totalDeducciones > totalBonos) {
      insights.push('Las deducciones acumuladas son mayores que los bonos registrados.');
    } else if (totalBonos > 0 || totalDeducciones > 0) {
      insights.push('Los bonos y deducciones se encuentran equilibrados.');
    }

    if (promedioDiasSolicitados > 0) {
      insights.push(`El promedio de días solicitados por vacaciones es de ${promedioDiasSolicitados.toFixed(1)} días.`);
    }

    return {
      generatedAt: new Date().toISOString(),
      resumen: {
        totalUsuarios: usuarios.length,
        usuariosActivos,
        usuariosInactivos,
        totalNominas: nominas.length,
        totalPagadoNomina: totalPagado,
        totalBonos,
        totalDeducciones,
        promedioSalarioBase,
        totalSolicitudesVacaciones: vacaciones.length,
        vacacionesPendientes,
        vacacionesAprobadas,
        vacacionesRechazadas,
        totalDiasSolicitados,
      },
      usuarios: {
        total: usuarios.length,
        activos: usuariosActivos,
        inactivos: usuariosInactivos,
        conFoto: usuariosConFoto,
        sinFoto: usuariosSinFoto,
        promedioDiasVacacionesDisponibles,
        porRol: this.groupCount(usuarios, 'rol', 'Sin rol'),
      },
      nomina: {
        totalRegistros: nominas.length,
        totalSalarioBase,
        totalBonos,
        totalDeducciones,
        totalPagado,
        promedioSalarioBase,
        porEstado: this.groupCount(nominas, 'estado', 'Sin estado'),
        componentes: [
          { name: 'Salario base', value: totalSalarioBase },
          { name: 'Bonos', value: totalBonos },
          { name: 'Deducciones', value: totalDeducciones },
          { name: 'Total pagado', value: totalPagado },
        ],
        porPeriodo: Array.from(nominaPorPeriodoMap.values()),
      },
      vacaciones: {
        totalSolicitudes: vacaciones.length,
        pendientes: vacacionesPendientes,
        aprobadas: vacacionesAprobadas,
        rechazadas: vacacionesRechazadas,
        totalDiasSolicitados,
        promedioDiasSolicitados,
        porEstado: this.groupCount(vacaciones, 'estado', 'Sin estado'),
        porFecha: Array.from(vacacionesPorFechaMap.values()),
      },
      insights,
    };
  }
}