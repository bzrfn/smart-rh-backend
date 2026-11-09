# Usuarios e invitaciones

Despliegue condicionado a prueba aislada de invitaciones y eliminación administrativa, con respaldo de código y reversión ante errores de publicación. Conserva rotación RDS, configuración SMTP y acceso administrativo.

La prueba de eliminación usa tres tablas `smarth_probe_delete_*`, una colección temporal en Mongo y almacenamiento simulado. El adaptador restringe catálogo y consultas SQL a esas tablas; no elimina cuentas de producción ni envía correos reales. Verifica respaldo, claves foráneas, confirmación, cuenta propia y conservación de datos ajenos. Se ejecuta antes de instalar módulos.

## Eliminación desde Usuarios

Solo administradores autenticados pueden usar POST `/users/:id/permanent-deletion`, enviando `confirmEmail`. Requiere cuenta inactiva y coincidencia del correo. Bloquea cuenta propia, ID 1, correo del administrador principal y último administrador activo. La ruta DELETE anterior conserva su contrato de desactivación para compatibilidad.

Se respaldan los registros SQL afectados, documentos Mongo BSON y archivos privados en `<backend>/private-backups/user-deletions/<operationId>` (directorio 0700, archivos 0600). No se exponen por `/uploads`. Se eliminan descendientes antes que padres, sin deshabilitar claves foráneas. Las revisiones realizadas por la cuenta se archivan; las asistencias de otros usuarios se conservan. Relaciones ambiguas o volumen superior al límite detienen la operación antes de borrar. El respaldo contiene datos privados: conservarlo con los respaldos operativos y restringir acceso.

SQL se revierte y Mongo se restaura si falla antes de intentar commit. Una confirmación SQL incierta genera 503 con identificador y exige revisar el diario; no se restaura Mongo de forma especulativa. Después del commit, un fallo de archivos devuelve `cleanupPending` y conserva `files-pending`; el portal lo informa, sin afirmar limpieza completa. Revisar el manifiesto privado y los hashes antes de completar o recuperar manualmente. La recuperación no es una opción del portal.

El respaldo EBS local debe incluirse en la política de snapshots de la instancia. No se copia información de usuarios al bucket web.

## Verificación visual

Tras publicar: revisar claro/oscuro y móvil, modal de corrección sin etiquetas encimadas, aceptación con CTA principal, un menú de acciones por fila y ausencia de reenvío para cuentas aceptadas. La prueba autenticada final se hace con una cuenta de prueba; el despliegue no elimina cuentas reales.
