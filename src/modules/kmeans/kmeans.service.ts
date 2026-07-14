import { obtenerDatasetKMeans } from './kmeans.repository.js';
import {
  buildPoints,
  KMEANS_FEATURE_LABELS,
  KMEANS_FEATURES,
  normalizePoints,
  runBestKMeans,
  runElbow,
} from './kmeans.utils.js';

// Crea un error con un código HTTP útil para que el controlador pueda responder adecuadamente.
function crearError(message: string, statusCode = 400) {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
}

// Devuelve el dataset preparado para K-Means, junto con las características y etiquetas de cada feature.
export async function obtenerDatasetService() {
  const rows = await obtenerDatasetKMeans();

  return {
    total: rows.length,
    features: KMEANS_FEATURES,
    featureLabels: KMEANS_FEATURE_LABELS,
    dataset: rows,
  };
}

// Ejecuta el análisis de codo para sugerir un valor de k adecuado.
// Revisa varios valores de clusters y devuelve la calidad de cada prueba.
export async function obtenerElbowService(query: any) {
  const rows = await obtenerDatasetKMeans();

  if (rows.length < 2) {
    throw crearError('Se requieren al menos 2 empleados para ejecutar K-means.');
  }

  // Convierte las filas a puntos numéricos y las normaliza para que todas las variables tengan el mismo peso.
  const points = normalizePoints(buildPoints(rows));

  const kMin = Number(query.kMin || 2);
  const kMax = Number(query.kMax || Math.min(8, points.length));
  const trials = Number(query.trials || 5);
  const maxIterations = Number(query.maxIterations || 100);

  // Ejecuta el análisis de elbow con los parámetros recibidos desde la petición.
  const result = runElbow({
    points,
    kMin,
    kMax,
    trials,
    maxIterations,
  });

  return {
    total: rows.length,
    features: KMEANS_FEATURES,
    featureLabels: KMEANS_FEATURE_LABELS,
    ...result,
  };
}

// Entrena el modelo de K-Means con los parámetros recibidos por la API.
// Devuelve el mejor resultado entre varios intentos y un resumen de cada ejecución.
export async function entrenarKMeansService(body: any) {
  const rows = await obtenerDatasetKMeans();

  if (rows.length < 2) {
    throw crearError('Se requieren al menos 2 empleados para ejecutar K-means.');
  }

  // Transformación del dataset a puntos vectoriales y normalización de variables.
  const points = normalizePoints(buildPoints(rows));

  const k = Number(body.k || 3);
  const trials = Number(body.trials || 10);
  const maxIterations = Number(body.maxIterations || 100);

  // Valida que el número de clusters sea razonable.
  if (k < 2) {
    throw crearError('K debe ser mayor o igual a 2.');
  }

  if (k > points.length) {
    throw crearError('K no puede ser mayor que la cantidad de empleados.');
  }

  // Ejecuta varias corridas de K-Means con distintas semillas y elige la mejor según silueta.
  const result = runBestKMeans({
    points,
    k,
    trials,
    maxIterations,
  });

  return {
    total: rows.length,
    features: KMEANS_FEATURES,
    featureLabels: KMEANS_FEATURE_LABELS,
    parametros: {
      k,
      trials,
      maxIterations,
    },
    mejorResultado: result.mejor,
    intentos: result.intentos,
  };
}