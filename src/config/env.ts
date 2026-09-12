import 'dotenv/config';

type StorageDriver = 'local' | 's3';

const storageDriver: StorageDriver =
  String(process.env.STORAGE_DRIVER || 'local').toLowerCase() === 's3'
    ? 's3'
    : 'local';

export const env = {
  // ==========================================================
  // SERVIDOR
  // ==========================================================

  port: Number(process.env.PORT || 4000),

  // ==========================================================
  // BASE DE DATOS SQL
  //
  // Local:
  // MariaDB -> 127.0.0.1:3307
  //
  // AWS:
  // RDS MariaDB -> puerto 3306
  // ==========================================================

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3307),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME || 'rrhh_system',
  },

  // ==========================================================
  // JWT
  // ==========================================================

  jwt: {
    secret: process.env.JWT_SECRET || 'CHANGE_ME',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },

  // ==========================================================
  // QR
  // ==========================================================

  qr: {
    ttlMinutes: Number(process.env.QR_TTL_MINUTES || 2),
  },

  // ==========================================================
  // MONGODB
  // ==========================================================

  mongo: {
    uri: process.env.MONGO_URI || '',
    database: process.env.MONGO_DB || 'RRHH',
  },

  // ==========================================================
  // ARCHIVOS / UPLOADS
  // ==========================================================

  uploads: {
    publicBaseUrl:
      process.env.PUBLIC_BASE_URL || 'http://localhost:4000',
  },

  // ==========================================================
  // STORAGE
  //
  // local:
  //   uploads/
  //
  // s3:
  //   bucket privado de documentos SMART RH
  // ==========================================================

  storage: {
    driver: storageDriver,

    region:
      process.env.AWS_REGION ||
      process.env.AWS_DEFAULT_REGION ||
      'us-east-1',

    bucket: process.env.S3_DOCUMENTS_BUCKET || '',
  },

  // ==========================================================
  // CORS
  // ==========================================================

  cors: {
    origin: process.env.CORS_ORIGIN || '',
  },

  // ==========================================================
  // SMTP
  // ==========================================================

  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASS || '',
  },

  // ==========================================================
  // CONTACTO
  // ==========================================================

  contact: {
    to: process.env.CONTACT_TO || '',
  },
};
