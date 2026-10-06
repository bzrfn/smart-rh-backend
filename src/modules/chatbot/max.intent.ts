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

export function isEmployeeAttendanceIntent(message: string) {
  return (
    has(message, /asistencia|asistencias|entrada|salida|qr|checador|jornada|historial/) &&
    has(message, /mi|marcar|registrar|escanear|historial|entrada|salida|qr|camara|cámara|vencido|vencida/)
  );
}

export function isCredentialOperationalIntent(message: string) {
  return (
    has(message, /credencial|documentos|contrato|expediente|qr/) &&
    has(message, /como|donde|revis|validar|verificar|cargado|consultar|flujo/)
  );
}

export function isVacationOperationalIntent(message: string) {
  return (
    has(message, /vacacion|vacaciones|descanso|dias disponibles|saldo/) &&
    has(message, /como|donde|revis|solicit|crear|consult|saldo|aprobar|rechazar|estado|flujo/)
  );
}

export function isPayrollOperationalIntent(message: string) {
  return (
    has(message, /nomina|nómina|pago|recibo|salario|sueldo|periodo/) &&
    has(message, /como|donde|revis|consult|no aparece|falta|periodo|recibo|flujo/)
  );
}

export function isCalendarOperationalIntent(message: string) {
  return (
    has(message, /calendario|agenda|mes|evento|eventos|dia|día/) &&
    has(message, /como|donde|revis|consult|ver|filtrar|resumen|flujo/)
  );
}

export function isTerminalOperationalIntent(message: string) {
  return (
    has(message, /terminal|terminal asistencia|autorizar terminal|codigo terminal|código terminal/) &&
    has(message, /como|donde|autorizar|validar|revis|flujo|qr|codigo|código/)
  );
}

export function resolveDirectEntryId(message: string) {
  if (isAdminInvitationIntent(message)) return 'usuarios-admin';
  if (isUserPermissionsIntent(message)) return 'usuarios-admin';
  if (isIncapacityOperationalIntent(message)) return 'incapacidades';
  if (isTerminalOperationalIntent(message)) return 'terminal-admin';
  if (isEmployeeAttendanceIntent(message)) return 'asistencia-empleado';
  if (isAttendanceOperationalIntent(message)) return 'asistencia-admin';
  if (isCredentialOperationalIntent(message)) return 'credencial';
  if (isVacationOperationalIntent(message)) return 'vacaciones';
  if (isPayrollOperationalIntent(message)) return 'nomina';
  if (isCalendarOperationalIntent(message)) return 'calendario';

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
    /usuario|usuarios|permiso|permisos|incapacidad|incapacidades|asistencia|credencial|contrato|documentos|vacaciones|nomina|nómina|calendario|terminal/
  );

  return processCue && moduleCue;
}
