import {
  guardarPrediccionML,
  limpiarPrediccionesML,
  obtenerPrediccionesGuardadas,
  obtenerUsuariosParaML,
  UsuarioML,
} from './ml.repository.js';

type RiesgoLaboral = 'BAJO' | 'MEDIO' | 'ALTO';

type RegistroDataset = {
  usuario_id: number;
  nombre_completo: string;
  correo: string;
  rol: string;
  activo: number;
  antiguedad_meses: number;
  dias_vacaciones_disponibles: number;
  score_riesgo: number;
  ausencias_estimadas: number;
  riesgo_real: RiesgoLaboral;
};

type PrediccionML = RegistroDataset & {
  riesgo_predicho: RiesgoLaboral;
  probabilidad: number;
  recomendacion: string;
  matriz_decision: DecisionEmpleado;
};

type ReglaDecision = {
  criterio: string;
  condicion: string;
  efecto: string;
  puntos: number;
  justificacion: string;
};

type NivelDecision = {
  nivel: RiesgoLaboral;
  rango_score: string;
  descripcion: string;
  accion_recomendada: string;
};

type MatrizDecisionML = {
  objetivo: string;
  variables_consideradas: string[];
  reglas_score: ReglaDecision[];
  niveles_riesgo: NivelDecision[];
  interpretacion: string;
};

type DecisionEmpleado = {
  score_final: number;
  nivel_riesgo: RiesgoLaboral;
  reglas_aplicadas: ReglaDecision[];
  interpretacion: string;
};

function calcularAntiguedadMeses(fechaIngreso?: string | null) {
  if (!fechaIngreso) return 0;

  const inicio = new Date(fechaIngreso);
  const hoy = new Date();

  if (Number.isNaN(inicio.getTime())) return 0;

  const anios = hoy.getFullYear() - inicio.getFullYear();
  const meses = hoy.getMonth() - inicio.getMonth();

  return Math.max(0, anios * 12 + meses);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function redondear(value: number, decimals = 2) {
  return Number(value.toFixed(decimals));
}

/**
 * Matriz de decisión general del modelo.
 * Esta matriz explica las reglas utilizadas para construir el score de riesgo.
 */
function crearMatrizDecisionML(): MatrizDecisionML {
  return {
    objetivo:
      'Evaluar el nivel de riesgo laboral de cada empleado a partir de variables operativas disponibles en SMART RH.',

    variables_consideradas: [
      'Estado del empleado: activo o inactivo.',
      'Antigüedad laboral calculada en meses.',
      'Días de vacaciones disponibles.',
      'Rol del usuario dentro del sistema.',
      'Score de riesgo calculado.',
      'Estimación de ausencias.',
    ],

    reglas_score: [
      {
        criterio: 'Score base',
        condicion: 'Todo empleado inicia con un score base.',
        efecto: 'Punto de partida del análisis.',
        puntos: 35,
        justificacion:
          'Se establece una base media para que el riesgo pueda aumentar o disminuir según las condiciones del empleado.',
      },
      {
        criterio: 'Empleado inactivo',
        condicion: 'activo = 0',
        efecto: 'Aumenta el riesgo.',
        puntos: 25,
        justificacion:
          'Un empleado inactivo representa una condición laboral crítica o no disponible para operación.',
      },
      {
        criterio: 'Antigüedad muy baja',
        condicion: 'antigüedad menor o igual a 3 meses',
        efecto: 'Aumenta el riesgo.',
        puntos: 18,
        justificacion:
          'Los empleados de nuevo ingreso pueden requerir mayor seguimiento por adaptación, capacitación o rotación temprana.',
      },
      {
        criterio: 'Antigüedad baja o media',
        condicion: 'antigüedad mayor a 3 meses y menor o igual a 12 meses',
        efecto: 'Aumenta moderadamente el riesgo.',
        puntos: 8,
        justificacion:
          'El empleado aún se considera relativamente reciente y puede requerir seguimiento preventivo.',
      },
      {
        criterio: 'Vacaciones muy bajas',
        condicion: 'días de vacaciones disponibles menor o igual a 2',
        efecto: 'Aumenta el riesgo.',
        puntos: 18,
        justificacion:
          'Pocos días disponibles pueden indicar alta carga laboral, uso frecuente de días o necesidad de revisar descansos.',
      },
      {
        criterio: 'Vacaciones suficientes',
        condicion: 'días de vacaciones disponibles mayor o igual a 14',
        efecto: 'Disminuye el riesgo.',
        puntos: -8,
        justificacion:
          'Una disponibilidad adecuada de vacaciones se interpreta como una condición más estable.',
      },
      {
        criterio: 'Rol administrativo',
        condicion: 'rol contiene admin',
        efecto: 'Disminuye ligeramente el riesgo.',
        puntos: -6,
        justificacion:
          'Los usuarios administrativos suelen tener mayor estabilidad operativa dentro del sistema.',
      },
    ],

    niveles_riesgo: [
      {
        nivel: 'BAJO',
        rango_score: '5 a 44 puntos',
        descripcion:
          'Empleado con condiciones laborales estables, sin señales críticas detectadas por el modelo.',
        accion_recomendada:
          'Mantener monitoreo normal dentro del periodo laboral.',
      },
      {
        nivel: 'MEDIO',
        rango_score: '45 a 69 puntos',
        descripcion:
          'Empleado con señales preventivas que requieren revisión moderada por parte de Recursos Humanos.',
        accion_recomendada:
          'Dar seguimiento preventivo, revisar hábitos de asistencia y comunicación con el empleado.',
      },
      {
        nivel: 'ALTO',
        rango_score: '70 a 95 puntos',
        descripcion:
          'Empleado con condiciones críticas o combinación de factores que requieren atención inmediata.',
        accion_recomendada:
          'Requiere seguimiento preventivo inmediato por parte de RRHH.',
      },
    ],

    interpretacion:
      'La matriz de decisión permite justificar cómo se asigna el riesgo laboral. Cada variable aporta o resta puntos al score final. Posteriormente, el score se clasifica en bajo, medio o alto.',
  };
}

/**
 * Matriz de decisión individual.
 * Explica qué reglas se aplicaron a un empleado específico.
 */
function crearDecisionEmpleado(usuario: UsuarioML, score: number): DecisionEmpleado {
  const antiguedadMeses = calcularAntiguedadMeses(usuario.fecha_ingreso);
  const diasVacaciones = Number(usuario.dias_vacaciones_disponibles ?? 12);
  const rol = String(usuario.rol_nombre || '').toLowerCase();

  const reglasAplicadas: ReglaDecision[] = [
    {
      criterio: 'Score base',
      condicion: 'Todo empleado inicia con un score base.',
      efecto: 'Punto de partida del análisis.',
      puntos: 35,
      justificacion:
        'Se establece una base inicial para evaluar el comportamiento del empleado.',
    },
  ];

  if (!usuario.activo) {
    reglasAplicadas.push({
      criterio: 'Empleado inactivo',
      condicion: 'activo = 0',
      efecto: 'Aumenta el riesgo.',
      puntos: 25,
      justificacion:
        'El empleado aparece como inactivo, lo que representa una condición crítica para operación.',
    });
  }

  if (antiguedadMeses <= 3) {
    reglasAplicadas.push({
      criterio: 'Antigüedad muy baja',
      condicion: 'antigüedad menor o igual a 3 meses',
      efecto: 'Aumenta el riesgo.',
      puntos: 18,
      justificacion:
        'El empleado es de nuevo ingreso y puede requerir mayor seguimiento.',
    });
  }

  if (antiguedadMeses > 3 && antiguedadMeses <= 12) {
    reglasAplicadas.push({
      criterio: 'Antigüedad baja o media',
      condicion: 'antigüedad mayor a 3 meses y menor o igual a 12 meses',
      efecto: 'Aumenta moderadamente el riesgo.',
      puntos: 8,
      justificacion:
        'El empleado aún se encuentra en una etapa relativamente reciente dentro de la organización.',
    });
  }

  if (diasVacaciones <= 2) {
    reglasAplicadas.push({
      criterio: 'Vacaciones muy bajas',
      condicion: 'días de vacaciones disponibles menor o igual a 2',
      efecto: 'Aumenta el riesgo.',
      puntos: 18,
      justificacion:
        'El empleado tiene pocos días disponibles, lo que puede indicar necesidad de seguimiento.',
    });
  }

  if (diasVacaciones >= 14) {
    reglasAplicadas.push({
      criterio: 'Vacaciones suficientes',
      condicion: 'días de vacaciones disponibles mayor o igual a 14',
      efecto: 'Disminuye el riesgo.',
      puntos: -8,
      justificacion:
        'El empleado mantiene una disponibilidad adecuada de días, lo que reduce el nivel de alerta.',
    });
  }

  if (rol.includes('admin')) {
    reglasAplicadas.push({
      criterio: 'Rol administrativo',
      condicion: 'rol contiene admin',
      efecto: 'Disminuye ligeramente el riesgo.',
      puntos: -6,
      justificacion:
        'El perfil administrativo se considera más estable dentro del contexto operativo del sistema.',
    });
  }

  const nivelRiesgo = clasificarRiesgo(score);

  return {
    score_final: score,
    nivel_riesgo: nivelRiesgo,
    reglas_aplicadas: reglasAplicadas,
    interpretacion: `El empleado obtuvo un score final de ${score}, por lo que se clasifica en riesgo ${nivelRiesgo}.`,
  };
}

function calcularScoreRiesgo(usuario: UsuarioML) {
  const antiguedadMeses = calcularAntiguedadMeses(usuario.fecha_ingreso);
  const diasVacaciones = Number(usuario.dias_vacaciones_disponibles ?? 12);
  const rol = String(usuario.rol_nombre || '').toLowerCase();

  let score = 35;

  if (!usuario.activo) score += 25;
  if (antiguedadMeses <= 3) score += 18;
  if (antiguedadMeses > 3 && antiguedadMeses <= 12) score += 8;
  if (diasVacaciones <= 2) score += 18;
  if (diasVacaciones >= 14) score -= 8;
  if (rol.includes('admin')) score -= 6;

  return clamp(score, 5, 95);
}

function clasificarRiesgo(score: number): RiesgoLaboral {
  if (score >= 70) return 'ALTO';
  if (score >= 45) return 'MEDIO';
  return 'BAJO';
}

function estimarAusencias(score: number, antiguedadMeses: number, diasVacaciones: number) {
  const base = score / 18;
  const ajusteAntiguedad = antiguedadMeses <= 3 ? 1.2 : 0;
  const ajusteVacaciones = diasVacaciones <= 2 ? 0.8 : 0;

  return redondear(clamp(base + ajusteAntiguedad + ajusteVacaciones, 0, 12));
}

function recomendacionPorRiesgo(riesgo: RiesgoLaboral) {
  if (riesgo === 'ALTO') {
    return 'Requiere seguimiento preventivo inmediato por parte de RRHH. Revisar asistencia, carga laboral y posibles incidencias.';
  }

  if (riesgo === 'MEDIO') {
    return 'Dar seguimiento moderado. Recomendar revisión de hábitos de asistencia y comunicación con el empleado.';
  }

  return 'Sin alertas críticas. Mantener monitoreo normal dentro del periodo laboral.';
}

function crearDataset(usuarios: UsuarioML[]): RegistroDataset[] {
  return usuarios.map((usuario) => {
    const antiguedadMeses = calcularAntiguedadMeses(usuario.fecha_ingreso);
    const diasVacaciones = Number(usuario.dias_vacaciones_disponibles ?? 12);
    const score = calcularScoreRiesgo(usuario);
    const riesgo = clasificarRiesgo(score);

    return {
      usuario_id: usuario.id,
      nombre_completo: `${usuario.nombre} ${usuario.apellido}`.trim(),
      correo: usuario.correo,
      rol: usuario.rol_nombre,
      activo: usuario.activo,
      antiguedad_meses: antiguedadMeses,
      dias_vacaciones_disponibles: diasVacaciones,
      score_riesgo: score,
      ausencias_estimadas: estimarAusencias(score, antiguedadMeses, diasVacaciones),
      riesgo_real: riesgo,
    };
  });
}

function distanciaEuclidiana(a: RegistroDataset, b: RegistroDataset) {
  const f1 = a.antiguedad_meses - b.antiguedad_meses;
  const f2 = a.dias_vacaciones_disponibles - b.dias_vacaciones_disponibles;
  const f3 = a.score_riesgo - b.score_riesgo;
  const f4 = a.activo - b.activo;

  return Math.sqrt(f1 * f1 + f2 * f2 + f3 * f3 + f4 * f4);
}

function predecirRiesgoKNN(
  registro: RegistroDataset,
  entrenamiento: RegistroDataset[],
  k = 3
): RiesgoLaboral {
  const vecinos = entrenamiento
    .filter((item) => item.usuario_id !== registro.usuario_id)
    .map((item) => ({
      riesgo: item.riesgo_real,
      distancia: distanciaEuclidiana(registro, item),
    }))
    .sort((a, b) => a.distancia - b.distancia)
    .slice(0, k);

  const conteo = vecinos.reduce<Record<string, number>>((acc, item) => {
    acc[item.riesgo] = (acc[item.riesgo] || 0) + 1;
    return acc;
  }, {});

  const ganador = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0];

  return (ganador?.[0] as RiesgoLaboral) || registro.riesgo_real;
}

function calcularProbabilidad(score: number) {
  return redondear(clamp(score + 4, 10, 98));
}

function calcularEvaluacion(dataset: RegistroDataset[], predicciones: PrediccionML[]) {
  if (!dataset.length || !predicciones.length) {
    return {
      accuracy: 0,
      mae: 0,
      mse: 0,
      total_registros: 0,
      descripcion: 'No hay datos suficientes para evaluar el modelo.',
    };
  }

  const aciertos = predicciones.filter(
    (item) => item.riesgo_predicho === item.riesgo_real
  ).length;

  const erroresAbsolutos = predicciones.map((item) =>
    Math.abs(item.ausencias_estimadas - item.score_riesgo / 18)
  );

  const erroresCuadraticos = erroresAbsolutos.map((item) => item * item);

  const mae =
    erroresAbsolutos.reduce((acc, item) => acc + item, 0) / erroresAbsolutos.length;

  const mse =
    erroresCuadraticos.reduce((acc, item) => acc + item, 0) /
    erroresCuadraticos.length;

  const accuracy = (aciertos / predicciones.length) * 100;

  return {
    accuracy: redondear(accuracy),
    mae: redondear(mae, 4),
    mse: redondear(mse, 4),
    total_registros: dataset.length,
    descripcion:
      'Evaluación del modelo supervisado mediante clasificación KNN y estimación de ausencias.',
  };
}

function crearResumen(dataset: RegistroDataset[], predicciones: PrediccionML[]) {
  const total = dataset.length;
  const alto = predicciones.filter((item) => item.riesgo_predicho === 'ALTO').length;
  const medio = predicciones.filter((item) => item.riesgo_predicho === 'MEDIO').length;
  const bajo = predicciones.filter((item) => item.riesgo_predicho === 'BAJO').length;

  return {
    total_empleados: total,
    riesgo_alto: alto,
    riesgo_medio: medio,
    riesgo_bajo: bajo,
    modelo_clasificacion: 'KNN educativo',
    modelo_regresion: 'Estimación lineal de ausencias',
    objetivo:
      'Clasificar empleados por nivel de riesgo laboral y estimar ausencias del próximo periodo.',
  };
}

async function ejecutarAnalisisSupervisado() {
  const usuarios = await obtenerUsuariosParaML();
  const dataset = crearDataset(usuarios);

  const entrenamiento =
    dataset.length >= 4 ? dataset.filter((_, index) => index % 3 !== 0) : dataset;

  const predicciones: PrediccionML[] = dataset.map((registro) => {
    const usuarioOriginal = usuarios.find((usuario) => usuario.id === registro.usuario_id);

    const riesgoPredicho =
      entrenamiento.length > 1
        ? predecirRiesgoKNN(registro, entrenamiento, 3)
        : registro.riesgo_real;

    const decisionEmpleado = usuarioOriginal
      ? crearDecisionEmpleado(usuarioOriginal, registro.score_riesgo)
      : {
          score_final: registro.score_riesgo,
          nivel_riesgo: riesgoPredicho,
          reglas_aplicadas: [],
          interpretacion: `El empleado obtuvo un score final de ${registro.score_riesgo}, por lo que se clasifica en riesgo ${riesgoPredicho}.`,
        };

    return {
      ...registro,
      riesgo_predicho: riesgoPredicho,
      probabilidad: calcularProbabilidad(registro.score_riesgo),
      recomendacion: recomendacionPorRiesgo(riesgoPredicho),
      matriz_decision: decisionEmpleado,
    };
  });

  const evaluacion = calcularEvaluacion(dataset, predicciones);
  const resumen = crearResumen(dataset, predicciones);
  const matrizDecision = crearMatrizDecisionML();

  return {
    resumen,
    evaluacion,
    matriz_decision: matrizDecision,
    dataset,
    predicciones,
  };
}

export async function obtenerDatasetML() {
  const usuarios = await obtenerUsuariosParaML();
  return crearDataset(usuarios);
}

export async function obtenerResumenML() {
  const analisis = await ejecutarAnalisisSupervisado();

  return {
    resumen: analisis.resumen,
    evaluacion: analisis.evaluacion,
    matriz_decision: analisis.matriz_decision,
  };
}

export async function obtenerPrediccionesML() {
  const analisis = await ejecutarAnalisisSupervisado();

  return {
    predicciones: analisis.predicciones,
    evaluacion: analisis.evaluacion,
    matriz_decision: analisis.matriz_decision,
  };
}

export async function obtenerEvaluacionML() {
  const analisis = await ejecutarAnalisisSupervisado();

  return {
    ...analisis.evaluacion,
    matriz_decision: analisis.matriz_decision,
  };
}

export async function obtenerMatrizDecisionML() {
  return crearMatrizDecisionML();
}

export async function entrenarModeloML() {
  const analisis = await ejecutarAnalisisSupervisado();

  await limpiarPrediccionesML();

  for (const item of analisis.predicciones) {
    await guardarPrediccionML({
      usuario_id: item.usuario_id,
      nombre_completo: item.nombre_completo,
      correo: item.correo,
      tipo_modelo: 'KNN_CLASIFICACION_RIESGO_LABORAL',
      riesgo: item.riesgo_predicho,
      probabilidad: item.probabilidad,
      prediccion_ausencias: item.ausencias_estimadas,
      mae: analisis.evaluacion.mae,
      mse: analisis.evaluacion.mse,
      accuracy: analisis.evaluacion.accuracy,
      recomendacion: item.recomendacion,
    });
  }

  const guardadas = await obtenerPrediccionesGuardadas();

  return {
    message: 'Modelo supervisado ejecutado correctamente.',
    resumen: analisis.resumen,
    evaluacion: analisis.evaluacion,
    matriz_decision: analisis.matriz_decision,
    predicciones: analisis.predicciones,
    guardadas,
  };
}