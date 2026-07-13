import 'dotenv/config';

export const env = {
  port: Number(process.env.PORT || 4000),
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3307),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME || 'rrhh_system',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'CHANGE_ME',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },
  qr: {
    ttlMinutes: Number(process.env.QR_TTL_MINUTES || 2),
  },
  mongo: {
    uri: process.env.MONGO_URI || '',
    database: process.env.MONGO_DB || 'RRHH',
  },
  uploads: {
    publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:4000',
  },
};