# SMART RH - Cambios aplicados

## Backend
- Arquitectura híbrida preparada: MySQL como núcleo transaccional y MongoDB para auditoría/documentos generados.
- Nueva conexión MongoDB con `mongoose` en `src/config/mongo/mongo.connection.ts`.
- Nuevas variables `.env`: `MONGO_URI`, `MONGO_DB`, `PUBLIC_BASE_URL`.
- Storage local `/uploads` con carpetas: `profiles`, `contratos`, `credenciales`, `documentos`.
- Nueva ruta estática `/uploads` para visualizar archivos generados.
- Nuevo módulo `auditoria` en MongoDB.
- Nuevo módulo `documentos`:
  - `PATCH /documentos/usuarios/:usuarioId/foto-perfil`
  - `POST /documentos/usuarios/:usuarioId/contrato-pdf`
  - `POST /documentos/usuarios/:usuarioId/credencial-pdf`
- Generación de PDF simple sin dependencia extra para contrato y credencial.
- Migración SQL agregada para columnas:
  - `usuarios.foto_perfil_url`
  - `usuarios.credencial_url`
  - `contratos.contrato_pdf_url`
- Migración MongoDB con colecciones e índices iniciales.

## Web Portal
- Nueva sección `Documentación`.
- Gestión de foto de perfil desde portal web.
- Generación de contrato PDF.
- Generación de credencial PDF.
- Dashboard con indicadores de arquitectura híbrida, documentación automática y tema.
- Tema claro/oscuro persistente con `localStorage`.
- Estilos empresariales adicionales para expediente digital.

## Mobile App
- Nueva pantalla `Credencial digital`.
- Nueva pantalla `Documentos`.
- Accesos nuevos desde Home.
- Preparación visual para credencial del empleado.
- Botones para generar credencial y contrato PDF contra el backend.
- Opción visual de aspecto claro/oscuro preparada en Home.

## Comandos sugeridos

### Backend
```bash
cd rrhh-backend
npm install
npm run build
npm run dev
```

Ejecutar SQL:
```bash
mysql -u root -p rrhh_system < db/migrations/2026_05_21_smart_rh_documentos.sql
```

Ejecutar Mongo:
```bash
mongosh < mongo/migrations/init_smart_rh_mongo.js
```

### Web
```bash
cd rrhh-web-portal
npm install
npm run dev
```

### Mobile
```bash
cd "rrhh-mobile-app 3"
npm install
npx expo start
```
