// ============================================================
// SMART RH
// POLITICA DE REGISTRO PUBLICO
//
// El endpoint publico /auth/register NO decide privilegios.
//
// Mientras el autorregistro legado siga disponible para
// compatibilidad con clientes existentes, toda cuenta creada
// mediante ese flujo pertenece exclusivamente al rol empleado.
//
// La creacion de administradores utilizará un flujo separado,
// protegido por ADMIN_PORTAL_ACCESS.
// ============================================================

export const PUBLIC_REGISTRATION_ROLE_ID =
  2;


export function resolvePublicRegistrationRoleId(
  requestedRoleId?: unknown
): number {
  /*
   * El valor enviado por el cliente se ignora deliberadamente.
   *
   * Mantener el parámetro temporalmente permite compatibilidad
   * con clientes antiguos que todavía envían rol_id.
   */
  void requestedRoleId;

  return PUBLIC_REGISTRATION_ROLE_ID;
}
