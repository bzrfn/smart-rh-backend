# Renovación de credenciales de RDS

## Incidente y causa

El 7 de noviembre de 2026, la aplicación tenía una contraseña SQL cargada antes de la rotación administrada de RDS. `/health` respondía 200 mientras MySQL devolvía `ER_ACCESS_DENIED_ERROR`. El diagnóstico verificó que un reinicio recargaba la contraseña y restablecía la conexión.

## Comportamiento

`DB_SECRET_ARN` activa la renovación de credenciales. En EC2, `databaseSecretLoader` usa AWS CLI con la cadena de credenciales del entorno y el perfil IAM existente; solicita únicamente `GetSecretValue` de `AWSCURRENT`. El valor permanece en memoria. No hay credenciales en argumentos de comandos, mensajes de error o archivos del paquete.

El pool conserva las conexiones existentes, consulta el secreto cuando se utiliza después de 60 segundos y fuerza una renovación si una nueva conexión falla por autenticación. Las solicitudes concurrentes comparten la renovación. Cada pool reemplazado se cierra después de liberar todas sus conexiones prestadas, incluidas las que pertenecen a transacciones activas.

El reintento ocurre únicamente al adquirir la conexión. Una consulta o transacción ya enviada a MySQL no se repite. Un fallo al leer o validar el secreto conserva el pool anterior; una conexión que no pueda recuperarse devuelve un error controlado 503. Hay una espera de tres segundos entre renovaciones forzadas fallidas para evitar solicitudes repetidas a Secrets Manager.

Sin `DB_SECRET_ARN`, se mantiene el pool convencional para desarrollo local. No se agregan dependencias npm.

## Disponibilidad

- `/health`: vida del proceso HTTP; no acredita el estado de las bases de datos.
- `/ready`: consulta SQL de lectura y ping de Mongo configurado; devuelve 200 únicamente si ambas comprobaciones tienen éxito y 503 si fallan o exceden cinco segundos. Las comprobaciones concurrentes comparten una sonda pendiente.

El monitoreo funcional debe utilizar `/ready`. Este cambio no instala alarmas externas ni reinicios periódicos.

## Aplicación

El paquete para Mac abre un PR desde `fix/rotacion-credenciales-rds`, prueba y compila. Una vez integrado, genera un ZIP de AWS con el SHA real del merge y los hashes anteriores y posteriores de los módulos que cambia.

`desplegar_aws.py` obtiene el ARN del secreto administrado de `smarth-rh-mariadb` en `us-east-1`, cuenta `682530816594`, y transfiere el paquete por SSM a `i-017f10e3aa6972721`. El valor del secreto no pasa por CloudShell.

Antes de activar, `rotation_probe.mjs` prueba las credenciales actuales con el rol IAM, asigna una contraseña deliberadamente incorrecta solo al proceso de validación y verifica la recuperación de una consulta `SELECT 1`. Comprueba una transacción de lectura con rollback, Mongo y el controlador de disponibilidad. No rota, restablece ni deshabilita la contraseña real; no inserta registros de negocio.

El aplicador instala la referencia al secreto en `/etc/systemd/system/smarth-backend.service.d/20-rds-secret-refresh.conf`. Respalda los módulos, el marcador específico y el drop-in anterior antes de un único reinicio de activación. Verifica las variables realmente heredadas por el proceso y `/ready`. Ante un fallo restaura los archivos y el drop-in anteriores y arranca el servicio previo. Si no puede recuperar el servicio lo informa expresamente.

`DEPLOYED_RDS_ROTATION_COMMIT` identifica esta actualización. Los marcadores anteriores y la configuración SMTP permanecen intactos. Si existen módulos o configuraciones distintos de las versiones esperadas, el aplicador se detiene.

## Validación

```bash
npm ci --no-audit --no-fund
npm run test:unit
python3 -m unittest discover -s ops/rds-rotation/tests -v
npm run build
```

Las pruebas automatizadas simulan la rotación, concurrencia, transacciones, fallos de SQL después del envío, indisponibilidad de Secrets Manager, protección de secretos y disponibilidad real. Las pruebas de despliegue comprueban que una validación fallida no detenga el servicio, la recuperación ante fallos de activación, restauración del drop-in y preservación de los módulos y configuración anteriores.

Las pruebas locales no acreditan un despliegue en AWS. El reporte de aplicación y la verificación desde el portal completan la aceptación en producción. No se necesita provocar una nueva rotación real para validar este cambio.
