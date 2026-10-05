function has(message: string, pattern: RegExp) {
  return pattern.test(message);
}

export function isAdminInvitationIntent(message: string) {
  const talksAboutAdmin = has(
    message,
    /\badmin\b|administrador|administradora|administrativo|administrativa/
  );
  const talksAboutInvite = has(
    message,
    /invit|inivt|agreg|crear|nuevo|nueva|alta|registr|correo|mandar|enviar/
  );
  const talksAboutUser = has(
    message,
    /usuario|cuenta|acceso|permiso|rol|correo|admin/
  );

  return talksAboutAdmin && talksAboutInvite && talksAboutUser;
}

export function isUserPermissionsIntent(message: string) {
  return (
    has(message, /usuario|usuarios|cuenta|cuentas|permiso|permisos|rol|roles/) &&
    has(message, /agreg|crear|nuevo|alta|asign|cambia|cambio|cambiar|editar|modific|activar|desactivar|invitar|invitacion/)
  );
}

export function isIncapacityOperationalIntent(message: string) {
  return (
    has(message, /incapacidad|incapacidades|imss|comprobante|validacion/) &&
    has(message, /como|donde|revis|aprob|rechaz|pendiente|aparece|aparezca|proceso|flujo|primero|validar|adjuntar|registrar/)
  );
}

export function isAttendanceOperationalIntent(message: string) {
  return (
    has(message, /asistencia|asistencias|entrada|salida|pendiente|pendientes|checador|qr/) &&
    has(message, /como|donde|revis|aprobar|rechazar|corregir|justificar|pendiente|pendientes|registro|flujo/)
  );
}

export function isCredentialOperationalIntent(message: string) {
  return (
    has(message, /credencial|documentos|contrato|expediente|qr/) &&
    has(message, /como|donde|revis|validar|verificar|cargado|consultar|flujo/)
  );
}

export function resolveDirectEntryId(message: string) {
  if (isAdminInvitationIntent(message)) return 'usuarios-admin';
  if (isUserPermissionsIntent(message)) return 'usuarios-admin';
  if (isIncapacityOperationalIntent(message)) return 'incapacidades';
  if (isAttendanceOperationalIntent(message)) return 'asistencia-admin';
  if (isCredentialOperationalIntent(message)) return 'credencial';

  return null;
}

export function isOperationalFlowIntent(message: string) {
  if (resolveDirectEntryId(message)) return true;

  const processCue = has(
    message,
    /como|donde|paso|proceso|flujo|ayudame|que reviso|que hago|no se|no entiendo/
  );
  const moduleCue = has(
    message,
    /usuario|usuarios|permiso|permisos|incapacidad|incapacidades|asistencia|credencial|contrato|documentos|vacaciones|nomina/
  );

  return processCue && moduleCue;
}
