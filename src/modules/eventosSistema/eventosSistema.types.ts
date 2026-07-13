export type EventoSistemaTipo =
  | 'LOGIN_EXITOSO'
  | 'LOGIN_FALLIDO'
  | 'LOGIN_2FA_ENVIADO'
  | 'LOGIN_2FA_FALLIDO'
  | 'REGISTER_USUARIO'
  | 'VERIFY_ACCOUNT_EXITOSO'
  | 'VERIFY_ACCOUNT_FALLIDO'
  | 'RECUPERACION_PASSWORD'
  | 'RESET_PASSWORD';

export type RegistrarEventoSistemaInput = {
  tipo: EventoSistemaTipo;
  usuario_id?: number | null;
  correo?: string | null;
  modulo: string;
  descripcion: string;
  resultado: 'exitoso' | 'fallido';
  metadata?: Record<string, any>;
};