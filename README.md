# rrhh-backend

```bash
cp .env.example .env
npm install
npm run dev
```

## Endpoints
- POST /auth/login
- GET /users (admin)
- POST /asistencia/qr (admin)
- POST /asistencia/scan (empleado/admin)
- GET /asistencia/pendientes (admin)
- PATCH /asistencia/:id/approve (admin)
