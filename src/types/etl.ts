export type ETLSourceName = 'usuarios' | 'nomina' | 'vacaciones';

export interface ETLSource {
  name: ETLSourceName;
}

export interface ArchivoGenerado {
  name: string;
  filasProcesadas?: number;
  errores?: string[];
  tiempo?: number;
}

export interface ETLResult {
  archivo: ArchivoGenerado;
  filasProcesadas: number;
  errores: string[];
  tiempo: number;
}

export interface ETLResumenReporte {
  totalUsuarios: number;
  usuariosActivos: number;
  usuariosInactivos: number;
  totalNominas: number;
  totalPagadoNomina: number;
  totalBonos: number;
  totalDeducciones: number;
  promedioSalarioBase: number;
  totalSolicitudesVacaciones: number;
  vacacionesPendientes: number;
  vacacionesAprobadas: number;
  vacacionesRechazadas: number;
  totalDiasSolicitados: number;
}

export interface ChartItem {
  name: string;
  value: number;
}

export interface ETLReporteData {
  generatedAt: string;
  resumen: ETLResumenReporte;
  usuarios: {
    total: number;
    activos: number;
    inactivos: number;
    conFoto: number;
    sinFoto: number;
    promedioDiasVacacionesDisponibles: number;
    porRol: ChartItem[];
  };
  nomina: {
    totalRegistros: number;
    totalSalarioBase: number;
    totalBonos: number;
    totalDeducciones: number;
    totalPagado: number;
    promedioSalarioBase: number;
    porEstado: ChartItem[];
    componentes: ChartItem[];
    porPeriodo: {
      periodo: string;
      total: number;
      bonos: number;
      deducciones: number;
      salarioBase: number;
    }[];
  };
  vacaciones: {
    totalSolicitudes: number;
    pendientes: number;
    aprobadas: number;
    rechazadas: number;
    totalDiasSolicitados: number;
    promedioDiasSolicitados: number;
    porEstado: ChartItem[];
    porFecha: {
      fecha: string;
      solicitudes: number;
      dias: number;
    }[];
  };
  insights: string[];
}