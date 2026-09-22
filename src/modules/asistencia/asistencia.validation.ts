export type EstadoSalidaAsistencia =
  | 'pendiente'
  | 'INVALIDA_PENDIENTE_REVISION';

export type EvaluarDuracionAsistenciaInput = {
  horaEntrada: string;
  horaSalida: string;
  duracionMinimaMinutos: number;
};

export type EvaluarDuracionAsistenciaResult = {
  duracionSegundos: number;
  cumpleMinimo: boolean;
  estadoSalida: EstadoSalidaAsistencia;
};

function convertirHoraASegundos(
  value: string
): number {
  const match =
    /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/
      .exec(value);

  if (!match) {
    throw new Error(
      'Hora de asistencia invalida'
    );
  }

  const horas =
    Number(match[1]);

  const minutos =
    Number(match[2]);

  const segundos =
    Number(match[3]);

  return (
    horas * 3600 +
    minutos * 60 +
    segundos
  );
}

export function evaluarDuracionAsistencia(
  input: EvaluarDuracionAsistenciaInput
): EvaluarDuracionAsistenciaResult {
  const {
    horaEntrada,
    horaSalida,
    duracionMinimaMinutos,
  } = input;

  if (
    !Number.isFinite(
      duracionMinimaMinutos
    ) ||
    duracionMinimaMinutos <= 0
  ) {
    throw new Error(
      'La duracion minima debe ser mayor que cero'
    );
  }

  const entradaSegundos =
    convertirHoraASegundos(
      horaEntrada
    );

  const salidaSegundos =
    convertirHoraASegundos(
      horaSalida
    );

  const duracionSegundos =
    salidaSegundos -
    entradaSegundos;

  if (duracionSegundos < 0) {
    throw new Error(
      'La hora de salida no puede ser anterior a la hora de entrada'
    );
  }

  const minimoSegundos =
    duracionMinimaMinutos * 60;

  const cumpleMinimo =
    duracionSegundos >=
    minimoSegundos;

  return {
    duracionSegundos,

    cumpleMinimo,

    estadoSalida:
      cumpleMinimo
        ? 'pendiente'
        : 'INVALIDA_PENDIENTE_REVISION',
  };
}
