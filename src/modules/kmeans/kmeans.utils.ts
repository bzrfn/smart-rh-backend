export type NumericVector = number[];

// Representa un empleado convertido a un punto de entrada para el algoritmo de K-Means.
// Cada punto tiene datos originales, el vector numérico usado para clustering y su versión normalizada.
export type KMeansPoint = {
  usuario_id: number;
  nombre: string;
  apellido: string;
  correo: string;
  role: string;
  raw: Record<string, any>;
  vector: NumericVector;
  normalizedVector: NumericVector;
};

// Estructura del resultado final del clustering.
// Incluye la cantidad de grupos, métricas de calidad y la información de cada cluster.
export type KMeansResult = {
  k: number;
  iterations: number;
  inertia: number;
  silhouette: number;
  labels: number[];
  centroids: NumericVector[];
  clusters: {
    cluster: number;
    total: number;
    porcentaje: number;
    perfil: string;
    promedio: Record<string, number>;
    empleados: any[];
  }[];
};

// Lista de características que se usarán como variables del modelo.
// Estas columnas provienen del dataset de empleados y sirven para agrupar personas con comportamientos parecidos.
export const KMEANS_FEATURES = [
  'antiguedad_dias',
  'dias_vacaciones_disponibles',
  'total_asistencias',
  'asistencias_aprobadas',
  'asistencias_pendientes',
  'asistencias_rechazadas',
  'asistencias_con_salida',
  'tasa_aprobacion_asistencia',
  'tasa_salida_asistencia',
  'salario_estimado',
  'promedio_nomina',
  'solicitudes_vacaciones',
  'dias_vacaciones_solicitados',
  'contratos_activos',
];

// Etiquetas legibles para mostrar cada variable en la interfaz o en reportes.
export const KMEANS_FEATURE_LABELS: Record<string, string> = {
  antiguedad_dias: 'Antigüedad en días',
  dias_vacaciones_disponibles: 'Días de vacaciones disponibles',
  total_asistencias: 'Total de asistencias',
  asistencias_aprobadas: 'Asistencias aprobadas',
  asistencias_pendientes: 'Asistencias pendientes',
  asistencias_rechazadas: 'Asistencias rechazadas',
  asistencias_con_salida: 'Asistencias con salida',
  tasa_aprobacion_asistencia: 'Tasa de aprobación de asistencia',
  tasa_salida_asistencia: 'Tasa de salida registrada',
  salario_estimado: 'Salario estimado',
  promedio_nomina: 'Promedio de nómina',
  solicitudes_vacaciones: 'Solicitudes de vacaciones',
  dias_vacaciones_solicitados: 'Días de vacaciones solicitados',
  contratos_activos: 'Contratos activos',
};

// Convierte un valor a número y devuelve 0 si no es válido.
export function toNumber(value: any) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// Transforma cada fila del dataset en un punto listo para K-Means.
// Construye el vector numérico con las características seleccionadas.
export function buildPoints(rows: any[]): KMeansPoint[] {
  return rows.map((row) => {
    const vector = KMEANS_FEATURES.map((feature) => toNumber(row[feature]));

    return {
      usuario_id: Number(row.usuario_id),
      nombre: row.nombre || '',
      apellido: row.apellido || '',
      correo: row.correo || '',
      role: row.role || '',
      raw: row,
      vector,
      normalizedVector: [],
    };
  });
}

// Normaliza los valores de cada característica al rango [0, 1].
// Esto evita que una variable de gran escala domine sobre otras en la distancia euclidiana.
export function normalizePoints(points: KMeansPoint[]) {
  if (!points.length) return [];

  const featureCount = points[0].vector.length;

  const mins = Array.from({ length: featureCount }, (_, index) =>
    Math.min(...points.map((point) => point.vector[index]))
  );

  const maxs = Array.from({ length: featureCount }, (_, index) =>
    Math.max(...points.map((point) => point.vector[index]))
  );

  return points.map((point) => ({
    ...point,
    normalizedVector: point.vector.map((value, index) => {
      const min = mins[index];
      const max = maxs[index];

      if (max === min) return 0;

      return (value - min) / (max - min);
    }),
  }));
}

// Calcula la distancia euclidiana entre dos vectores.
// Se usa para medir qué tan cerca están dos puntos o un punto y un centroide.
export function euclideanDistance(a: NumericVector, b: NumericVector) {
  let sum = 0;

  for (let i = 0; i < a.length; i += 1) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

// Calcula la distancia al cuadrado, que es más eficiente para medir inercia.
export function squaredDistance(a: NumericVector, b: NumericVector) {
  let sum = 0;

  for (let i = 0; i < a.length; i += 1) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return sum;
}

// Generador pseudoaleatorio reproducible para inicializar los centroides de forma determinista.
function seededRandom(seed: number) {
  let value = seed % 2147483647;

  if (value <= 0) {
    value += 2147483646;
  }

  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

// Copia un vector para evitar mutaciones inesperadas.
function cloneVector(vector: NumericVector) {
  return vector.map((value) => value);
}

// Selecciona los centroides iniciales aleatorios desde los puntos existentes.
// La semilla permite repetir el experimento de forma estable.
function chooseInitialCentroids(points: KMeansPoint[], k: number, seed: number) {
  const random = seededRandom(seed);
  const chosen = new Set<number>();
  const centroids: NumericVector[] = [];

  while (centroids.length < k) {
    const index = Math.floor(random() * points.length);

    if (!chosen.has(index)) {
      chosen.add(index);
      centroids.push(cloneVector(points[index].normalizedVector));
    }
  }

  return centroids;
}

// Asigna cada punto al centroide más cercano.
// El resultado es la etiqueta o cluster al que pertenece cada empleado.
function assignLabels(points: KMeansPoint[], centroids: NumericVector[]) {
  return points.map((point) => {
    let bestCluster = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    centroids.forEach((centroid, index) => {
      const distance = euclideanDistance(point.normalizedVector, centroid);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestCluster = index;
      }
    });

    return bestCluster;
  });
}

// Recalcula el centroide de cada cluster como el promedio de los puntos asignados a él.
function recomputeCentroids(points: KMeansPoint[], labels: number[], k: number) {
  const featureCount = points[0].normalizedVector.length;
  const centroids = Array.from({ length: k }, () =>
    Array.from({ length: featureCount }, () => 0)
  );

  const counts = Array.from({ length: k }, () => 0);

  points.forEach((point, index) => {
    const cluster = labels[index];
    counts[cluster] += 1;

    point.normalizedVector.forEach((value, featureIndex) => {
      centroids[cluster][featureIndex] += value;
    });
  });

  return centroids.map((centroid, clusterIndex) => {
    if (counts[clusterIndex] === 0) {
      return centroid;
    }

    return centroid.map((value) => value / counts[clusterIndex]);
  });
}

// Mide qué tan dispersos están los puntos respecto a sus centroides.
// Menor inercia suele implicar mejor agrupación.
function calculateInertia(
  points: KMeansPoint[],
  labels: number[],
  centroids: NumericVector[]
) {
  return points.reduce((sum, point, index) => {
    const cluster = labels[index];
    return sum + squaredDistance(point.normalizedVector, centroids[cluster]);
  }, 0);
}

// Calcula la silueta para evaluar la calidad del clustering.
// Valores más cercanos a 1 indican clusters mejor definidos.
function calculateSilhouette(points: KMeansPoint[], labels: number[], k: number) {
  if (points.length <= 1 || k <= 1) return 0;

  const values = points.map((point, pointIndex) => {
    const currentCluster = labels[pointIndex];

    const sameClusterIndexes = labels
      .map((label, index) => ({ label, index }))
      .filter((item) => item.label === currentCluster && item.index !== pointIndex)
      .map((item) => item.index);

    const a =
      sameClusterIndexes.length === 0
        ? 0
        : sameClusterIndexes.reduce((sum, index) => {
            return sum + euclideanDistance(point.normalizedVector, points[index].normalizedVector);
          }, 0) / sameClusterIndexes.length;

    const otherClusterDistances: number[] = [];

    for (let cluster = 0; cluster < k; cluster += 1) {
      if (cluster === currentCluster) continue;

      const clusterIndexes = labels
        .map((label, index) => ({ label, index }))
        .filter((item) => item.label === cluster)
        .map((item) => item.index);

      if (!clusterIndexes.length) continue;

      const averageDistance =
        clusterIndexes.reduce((sum, index) => {
          return sum + euclideanDistance(point.normalizedVector, points[index].normalizedVector);
        }, 0) / clusterIndexes.length;

      otherClusterDistances.push(averageDistance);
    }

    const b = otherClusterDistances.length
      ? Math.min(...otherClusterDistances)
      : 0;

    if (a === 0 && b === 0) return 0;

    return (b - a) / Math.max(a, b);
  });

  const total = values.reduce((sum, value) => sum + value, 0);

  return total / values.length;
}

// Promedia una lista de valores numéricos.
function promedio(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// Redondea un valor para mostrar resultados más legibles.
function round(value: number, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// Genera un perfil descriptivo de cada cluster a partir de sus promedios.
function buildClusterProfile(clusterAverage: Record<string, number>) {
  const asistencia = clusterAverage.tasa_aprobacion_asistencia || 0;
  const salida = clusterAverage.tasa_salida_asistencia || 0;
  const pendientes = clusterAverage.asistencias_pendientes || 0;
  const salario = clusterAverage.salario_estimado || clusterAverage.promedio_nomina || 0;
  const vacaciones = clusterAverage.solicitudes_vacaciones || 0;

  if (asistencia >= 0.8 && salida >= 0.8 && pendientes <= 1) {
    return 'Grupo estable con buena asistencia';
  }

  if (pendientes >= 2 || asistencia < 0.5) {
    return 'Grupo con incidencias o asistencia irregular';
  }

  if (salario > 0 && vacaciones >= 2) {
    return 'Grupo con actividad laboral y solicitudes frecuentes';
  }

  return 'Grupo intermedio con comportamiento laboral mixto';
}

// Construye la salida final con el resumen de cada cluster y los empleados que pertenecen a él.
function buildClusters(
  points: KMeansPoint[],
  labels: number[],
  k: number
): KMeansResult['clusters'] {
  return Array.from({ length: k }, (_, cluster) => {
    const clusterPoints = points.filter((_, index) => labels[index] === cluster);

    const promedioFeatures: Record<string, number> = {};

    KMEANS_FEATURES.forEach((feature) => {
      promedioFeatures[feature] = round(
        promedio(clusterPoints.map((point) => toNumber(point.raw[feature]))),
        4
      );
    });

    return {
      cluster,
      total: clusterPoints.length,
      porcentaje: points.length ? round((clusterPoints.length / points.length) * 100, 2) : 0,
      perfil: buildClusterProfile(promedioFeatures),
      promedio: promedioFeatures,
      empleados: clusterPoints.map((point) => ({
        usuario_id: point.usuario_id,
        nombre: point.nombre,
        apellido: point.apellido,
        correo: point.correo,
        role: point.role,
        datos: point.raw,
      })),
    };
  });
}

// Ejecuta una corrida completa de K-Means con un número fijo de clusters y un máximo de iteraciones.
export function runKMeans(input: {
  points: KMeansPoint[];
  k: number;
  maxIterations?: number;
  seed?: number;
}) {
  const { points, k } = input;
  const maxIterations = input.maxIterations || 100;
  const seed = input.seed || 1;

  if (k < 2) {
    throw new Error('K debe ser mayor o igual a 2.');
  }

  if (k > points.length) {
    throw new Error('K no puede ser mayor que la cantidad de empleados.');
  }

  let centroids = chooseInitialCentroids(points, k, seed);
  let labels = Array.from({ length: points.length }, () => 0);
  let iterations = 0;

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    iterations = iteration + 1;

    const newLabels = assignLabels(points, centroids);
    const newCentroids = recomputeCentroids(points, newLabels, k);

    const changed = newLabels.some((label, index) => label !== labels[index]);

    labels = newLabels;
    centroids = newCentroids;

    if (!changed && iteration > 0) {
      break;
    }
  }

  const inertia = calculateInertia(points, labels, centroids);
  const silhouette = calculateSilhouette(points, labels, k);

  return {
    k,
    iterations,
    inertia: round(inertia, 6),
    silhouette: round(silhouette, 6),
    labels,
    centroids,
    clusters: buildClusters(points, labels, k),
  };
}

// Ejecuta varias corridas de K-Means con diferentes semillas y se queda con la mejor según silueta.
export function runBestKMeans(input: {
  points: KMeansPoint[];
  k: number;
  maxIterations?: number;
  trials?: number;
}) {
  const trials = input.trials || 10;
  let best: KMeansResult | null = null;
  const intentos: KMeansResult[] = [];

  for (let trial = 1; trial <= trials; trial += 1) {
    const result = runKMeans({
      points: input.points,
      k: input.k,
      maxIterations: input.maxIterations || 100,
      seed: trial * 97,
    });

    intentos.push(result);

    if (!best || result.silhouette > best.silhouette) {
      best = result;
    }
  }

  return {
    mejor: best as KMeansResult,
    intentos: intentos.map((item, index) => ({
      intento: index + 1,
      k: item.k,
      inertia: item.inertia,
      silhouette: item.silhouette,
      iterations: item.iterations,
    })),
  };
}

// Revisa múltiples valores de k y devuelve el mejor según la métrica de silueta.
// Es útil para elegir el número de clusters más adecuado.
export function runElbow(input: {
  points: KMeansPoint[];
  kMin?: number;
  kMax?: number;
  maxIterations?: number;
  trials?: number;
}) {
  const kMin = input.kMin || 2;
  const kMax = Math.min(input.kMax || 8, input.points.length);
  const results = [];

  for (let k = kMin; k <= kMax; k += 1) {
    const result = runBestKMeans({
      points: input.points,
      k,
      maxIterations: input.maxIterations || 100,
      trials: input.trials || 5,
    });

    results.push({
      k,
      inertia: result.mejor.inertia,
      silhouette: result.mejor.silhouette,
      iterations: result.mejor.iterations,
    });
  }

  const mejorPorSilueta = results.reduce((best, item) => {
    if (!best || item.silhouette > best.silhouette) return item;
    return best;
  }, null as any);

  return {
    kMin,
    kMax,
    mejor_k_silueta: mejorPorSilueta?.k || kMin,
    resultados: results,
  };
}