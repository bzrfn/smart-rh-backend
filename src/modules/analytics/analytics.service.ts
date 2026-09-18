import { obtenerResumenVisualRepository } from './analytics.repository.js';

// Servicio encargado de pedir el resumen visual al repositorio y devolverlo
// con un mensaje amigable para la capa HTTP o el frontend.
export async function obtenerResumenVisualService() {
  // Llama al repositorio para obtener todos los KPI, gráficos e interpretaciones.
  const resumen = await obtenerResumenVisualRepository();

  return {
    message: 'Resumen visual generado correctamente.',
    ...resumen,
  };
}