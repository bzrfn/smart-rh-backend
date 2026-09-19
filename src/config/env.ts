import 'dotenv/config';


type StorageDriver =
  'local' |
  's3';


const storageDriver:
StorageDriver =
  String(
    process.env.STORAGE_DRIVER ||
    'local'
  )
    .toLowerCase() === 's3'
    ? 's3'
    : 'local';


export const env = {

  // ==========================================================
  // SERVIDOR
  // ==========================================================

  port:
    Number(
      process.env.PORT ||
      4000
    ),

  trustProxy:
    process.env.TRUST_PROXY ||
    'loopback',


  // ==========================================================
  // ZONA HORARIA DE NEGOCIO
  //
  // AWS puede permanecer en UTC.
  //
  // Las fechas laborales de SMART RH se interpretan
  // explícitamente en la zona configurada aquí.
  // ==========================================================

  business: {
    timeZone:
      process.env.BUSINESS_TIME_ZONE ||
      'America/Mexico_City',
  },


  // ==========================================================
  // BASE DE DATOS SQL
  // ==========================================================

  db: {
    host:
      process.env.DB_HOST ||
      '127.0.0.1',

    port:
      Number(
        process.env.DB_PORT ||
        3307
      ),

    user:
      process.env.DB_USER ||
      'root',

    password:
      process.env.DB_PASSWORD ??
      '',

    database:
      process.env.DB_NAME ||
      'rrhh_system',
  },


  // ==========================================================
  // JWT
  // ==========================================================

  jwt: {
    secret:
      process.env.JWT_SECRET ||
      '',

    expiresIn:
      process.env.JWT_EXPIRES_IN ||
      '8h',
  },


  // ==========================================================
  // PREAUTORIZACION ADMINISTRATIVA
  // ==========================================================

  adminAccess: {
    jwtSecret:
      process.env.ADMIN_ACCESS_JWT_SECRET ||
      '',

    hmacSecret:
      process.env.ADMIN_ACCESS_HMAC_SECRET ||
      '',
  },


  // ==========================================================
  // RECUPERACION DE CONTRASENA
  // ==========================================================

  passwordRecovery: {
    hmacSecret:
      process.env.PASSWORD_RECOVERY_HMAC_SECRET ||
      '',
  },


  // ==========================================================
  // LOGIN 2FA ADMINISTRATIVO
  // ==========================================================

  login2fa: {
    hmacSecret:
      process.env.LOGIN_2FA_HMAC_SECRET ||
      '',
  },


  // ==========================================================
  // INVITACIONES ADMINISTRATIVAS
  // ==========================================================

  adminInvite: {
    hmacSecret:
      process.env.ADMIN_INVITE_HMAC_SECRET ||
      '',
  },

  // ==========================================================
  // QR
  // ==========================================================

  qr: {
    validitySeconds:
      Number(
        process.env.QR_VALIDITY_SECONDS ||
        10
      ),

    retentionMinutes:
      Number(
        process.env.QR_RETENTION_MINUTES ||
        3
      ),
  },


  // ==========================================================
  // MONGODB
  // ==========================================================

  mongo: {
    uri:
      process.env.MONGO_URI ||
      '',

    database:
      process.env.MONGO_DB ||
      'RRHH',
  },


  // ==========================================================
  // ARCHIVOS / UPLOADS
  // ==========================================================

  uploads: {
    publicBaseUrl:
      process.env.PUBLIC_BASE_URL ||
      'http://localhost:4000',
  },


  // ==========================================================
  // STORAGE
  // ==========================================================

  storage: {
    driver:
      storageDriver,

    region:
      process.env.AWS_REGION ||
      process.env.AWS_DEFAULT_REGION ||
      'us-east-1',

    bucket:
      process.env.S3_DOCUMENTS_BUCKET ||
      '',
  },


  // ==========================================================
  // CORS
  // ==========================================================

  cors: {
    origin:
      process.env.CORS_ORIGIN ||
      '',
  },


  // ==========================================================
  // SMTP
  // ==========================================================

  smtp: {
    host:
      process.env.SMTP_HOST ||
      'smtp.gmail.com',

    port:
      Number(
        process.env.SMTP_PORT ||
        587
      ),

    user:
      process.env.SMTP_USER ||
      '',

    password:
      process.env.SMTP_PASS ||
      '',
  },


  // ==========================================================
  // CONTACTO
  // ==========================================================

  contact: {
    to:
      process.env.CONTACT_TO ||
      '',
  },
};
