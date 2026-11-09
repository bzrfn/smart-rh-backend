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


## Corrección de cuentas existentes

Reenviar invitación también está disponible para cuentas activas ya registradas, sin depender de una fila de invitación pendiente. El endpoint administrativo busca al destinatario por su id real, fija correo y rol desde la base y vincula el enlace al id y versión de sesión. Enviar no cambia contraseña, rol, perfil ni registros laborales. Al aceptar el enlace, se establece la contraseña elegida por el destinatario, se confirma el correo, se renueva la sesión y se conserva el mismo usuario. Los enlaces anteriores se revocan. Se rechazan cuentas desactivadas o cuyo correo, rol o versión de sesión cambió.

## Invitaciones con perfil completado por la persona

Crear una invitación nueva requiere únicamente `correo`, `tipo_cuenta` (`admin` o `empleado`) y `fecha_ingreso` válida. El servidor fija 12 días iniciales e ignora datos personales y saldos enviados por el emisor. `profile_completion_required=1` identifica el flujo nuevo; la migración aditiva conserva 0 para enlaces anteriores.

La página pública verifica el enlace mediante POST `/auth/invitations/inspect`; solo un token válido, no vencido y vinculado al rol y sesión del patrocinador puede obtener los datos asignados. Correo, rol, ingreso y vacaciones son de solo lectura. La persona completa nombre, apellidos, teléfono y dirección y establece su contraseña. POST `/accept` valida y crea el usuario con esos datos dentro de la transacción que consume la invitación. El correo queda verificado por la posesión del enlace. No se asignan contraseñas desde administración.

Enlaces anteriores y recuperación de cuentas existentes conservan su comportamiento y sus saldos. Reenviar un enlace del flujo nuevo mantiene la exigencia de completar el perfil e invalida el enlace anterior. Los errores no se interpretan como éxito; el formulario conserva sus datos y solo se cierra al confirmar la operación.

Referencias: se mantiene el diseño existente SMART RH (tokens de tema, controles, modal y confirmaciones) y las pautas de formularios accesibles: etiquetas, autocompletado, envío por teclado, campos bloqueados durante el guardado y estados anunciados. No se añaden componentes gráficos ajenos al portal. La investigación externa no estuvo disponible; se usó el producto existente como referencia principal.

Validación: pruebas unitarias del servidor, pruebas React del formulario mínimo y la activación, TypeScript, build y pruebas del despliegue. La prueba SQL real en tablas desechables cubre la creación de empleado y administrador, perfil obligatorio, asignación de 12 días, inmunidad a cambios de campos asignados, inspección del enlace, reenvío, uso único y cuentas existentes sin duplicados. No envía SMTP real ni crea usuarios reales. La validación autenticada final se realiza después del despliegue.

## Corregir el correo y cancelar pendientes

POST `/:id/correct-email` sustituye una invitación pendiente por un token nuevo con el correo corregido. Conserva rol, fecha de ingreso y política de perfil/vacaciones. Los correos anterior y nuevo se bloquean en orden estable; no se retira la invitación anterior si el destinatario ya pertenece a un usuario u otra invitación pendiente. Se rechazan enlaces aceptados/sustituidos y enlaces de recuperación ligados a una cuenta existente. La corrección de un correo distinto es inmediata; el reenvío al mismo destinatario conserva su espera habitual. Si falla la inserción, la transacción conserva el enlace original. Si falla SMTP después del commit, se conserva el correo corregido con un envío recuperable.

POST `/:id/cancel` invalida todas las generaciones pendientes del mismo correo para que no reaparezcan versiones antiguas. Mantiene el historial revocado y no modifica ni elimina cuentas. Ambas rutas requieren administrador vigente. Las filas pendientes muestran Editar invitación y Cancelar invitación junto a Reenviar. Se reutilizan la tabla y modales existentes de SMART RH: un campo de correo, rol/ingreso de solo lectura, confirmación de cancelación, bloqueo durante la operación y estados de éxito/error.

Las pruebas locales cubren autorización, conflicto sin revocación, identidad inmutable, transacción, envío fallido y confirmaciones React. El probe SQL aislado comprueba enlace anterior inválido, aceptación del destinatario correcto, conflictos con usuarios y pendientes, cancelación de generaciones antiguas, correcciones simultáneas y fallo SMTP recuperable. No envía correo real. Validar el flujo autenticado tras el despliegue.
