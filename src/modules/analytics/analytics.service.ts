import { obtenerResumenVisualRepository } from './analytics.repository.js';

export async function obtenerResumenVisualService() {
  const resumen = await obtenerResumenVisualRepository();

  return {
    message: 'Resumen visual generado correctamente.',
    ...resumen,
  };
}