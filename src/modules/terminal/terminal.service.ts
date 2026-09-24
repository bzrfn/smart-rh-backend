import {
  env,
} from '../../config/env.js';

import {
  generateDynamicQr,
} from '../asistencia/asistencia.service.js';


export const TERMINAL_ROLE =
  'terminal_asistencia';


export const TERMINAL_SCOPE =
  'attendance:kiosk';


export const TERMINAL_ATTENDANCE_ENABLED =
  env.terminalAccess.attendanceEnabled;


export function getTerminalQrScaffoldState() {
  return {
    enabled:
      TERMINAL_ATTENDANCE_ENABLED,

    role:
      TERMINAL_ROLE,

    scope:
      TERMINAL_SCOPE,
  };
}


export async function generateTerminalQr() {
  return generateDynamicQr();
}
