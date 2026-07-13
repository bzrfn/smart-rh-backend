// src/types/etl.ts
export type ETLSourceName = 'usuarios' | 'nomina' | 'vacaciones';

export interface ETLSource {
  name: ETLSourceName;
}

export interface ArchivoGenerado {
  name: string;           // nombre del archivo generado
  filasProcesadas?: number;
  errores?: string[];
  tiempo?: number;        // ms
}

export interface ETLResult {
  archivo: ArchivoGenerado;
  filasProcesadas: number;
  errores: string[];
  tiempo: number;         // ms
}