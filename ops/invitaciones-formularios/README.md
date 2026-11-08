# Invitaciones pendientes y confirmaciones de formularios

La búsqueda de Usuarios combina cuentas existentes con invitaciones no aceptadas. Reenviar genera un identificador y token nuevos, conserva el destinatario y rol, revoca el enlace previo y no crea una cuenta hasta la aceptación. El servidor vuelve a validar rol administrativo, estado, sesión del patrocinador y aceptación concurrente bajo la misma exclusión por correo. Espera mínima: 60 segundos entre envíos de la misma invitación. Las filas anteriores a esta migración no persistían rol: requieren elección administrativa explícita, sin asignar administrador por defecto.

Una falla SMTP marca el envío como no confirmado y conserva la opción de reintentar. No se cambia el transporte, remitente ni credenciales. Un correo aceptado por SMTP no garantiza llegada a bandeja principal. Una cuenta ya activada no es una invitación pendiente, incluso si luego se desactivó.

La migración agrega `account_type` y `delivery_failed_at`, ambas anulables. No modifica usuarios ni permisos existentes. La lista administrativa omite tokens y HMAC.

## Despliegue

El aplicador Mac genera el paquete AWS exclusivamente desde los árboles probados e integrados por PR. CloudShell valida cuenta, instancia, CloudFront, hash de módulos y dependencias. Antes de detener el servicio, aplica las dos columnas compatibles y prueba el servicio/repositorio reales sobre copias desechables de las tablas. Solo lee roles reales; no envía correos ni crea usuarios de negocio. Las tablas de prueba se eliminan al terminar. Una interrupción abrupta de EC2 podría dejar tablas con prefijo `smarth_probe_`; revisar el reporte antes de eliminarlas.

Se guardan respaldos de los módulos reemplazados y marcador. Ante una falla de readiness tras activación se restauran. Las columnas adicionales permanecen porque son compatibles con el código anterior. No modifica backend.conf, start-backend.sh, el drop-in de rotación RDS, IAM ni módulos de Max.

S3 publica recursos nuevos antes de index.html mediante escrituras condicionales; conserva recursos previos y respaldo del HTML, invalida CloudFront y verifica el índice público. Si falla la publicación web, el backend nuevo se mantiene compatible con el portal anterior.

## Formularios

Portal: avisos visibles sobre modales, éxito solo tras confirmación del servidor, errores persistentes descartables, foco controlado, Escape/cancelación bloqueados durante guardado. Soporte e Incapacidades cierran su detalle; Contratos y Nómina cierran edición y ocultan alta guardada; Usuarios cierra invitación/edición/reenvío. Formularios de página mantienen el contexto y muestran resultado; los pasos de autenticación y el chat conservan su secuencia. Una recarga fallida después de guardar se informa como fallo de actualización del listado, no como rechazo del cambio.

La app móvil incluye confirmación estricta de mutaciones y consulta/reenvío de pendientes. Requiere compilación y publicación de la versión 1.0.1 en las tiendas; el despliegue web/backend no actualiza el binario instalado.

## Evidencia

Pruebas automatizadas de autorización, enlaces reemplazados, bloqueo por aceptación concurrente, espera entre envíos, aislamiento y fallos SMTP. Pruebas React de búsqueda, reenvío, errores con datos conservados, cierre de Soporte, contratos y nómina, respuestas HTTP 200 con ok:false y navegación por teclado. Pruebas Python de publicación condicional, respaldo y restauración. La prueba SQL real se ejecuta en EC2 como condición del despliegue; no se presenta como ejecutada en el entorno de desarrollo.

Referencia visual: diseño existente de SMART RH, tarjetas y controles azul/cian/verde, variables de tema y modal compartido. Cambios limitados a estado de operación, jerarquía del aviso, contraste heredado, foco y tamaño adaptable. La comprobación en navegador real no está disponible en el entorno de preparación; validar claro/oscuro y pantalla estrecha en el portal tras despliegue.
