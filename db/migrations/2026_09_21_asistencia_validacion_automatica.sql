-- ============================================================
-- SMART RH
-- Cambio #3 — Validacion automatica de asistencia
--
-- IMPORTANTE:
-- Este archivo define la estructura necesaria.
-- Su existencia NO significa que haya sido ejecutado.
-- ============================================================


-- ============================================================
-- 1. ASISTENCIAS
--
-- Se conserva compatibilidad con los estados historicos:
--   pendiente
--   aprobada
--   rechazada
--
-- Se agrega:
--   INVALIDA_PENDIENTE_REVISION
--
-- Las columnas de duracion son NULL para no reinterpretar
-- registros historicos previos a esta funcionalidad.
-- ============================================================

ALTER TABLE asistencias
  MODIFY COLUMN estado
    ENUM(
      'pendiente',
      'aprobada',
      'rechazada',
      'INVALIDA_PENDIENTE_REVISION'
    )
    NULL
    DEFAULT 'pendiente',

  ADD COLUMN IF NOT EXISTS
    duracion_minima_aplicada_minutos
      INT UNSIGNED NULL
      AFTER estado,

  ADD COLUMN IF NOT EXISTS
    duracion_registrada_segundos
      INT UNSIGNED NULL
      AFTER duracion_minima_aplicada_minutos;


-- ============================================================
-- 2. CONFIGURACION DE ASISTENCIA
--
-- Se utiliza una configuracion singleton:
-- solamente existe el registro id = 1.
--
-- Esto evita tener varias politicas activas simultaneamente.
--
-- El valor puede modificarse posteriormente sin cambiar
-- codigo ni reconstruir el backend.
-- ============================================================

CREATE TABLE IF NOT EXISTS asistencia_configuracion (
  id TINYINT UNSIGNED NOT NULL,

  duracion_minima_minutos
    INT UNSIGNED NOT NULL,

  activa
    TINYINT(1) NOT NULL
    DEFAULT 1,

  actualizado_por
    INT(11) NULL,

  created_at
    TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  updated_at
    TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  CONSTRAINT chk_asistencia_config_id
    CHECK (id = 1),

  CONSTRAINT chk_asistencia_config_duracion
    CHECK (duracion_minima_minutos > 0),

  CONSTRAINT chk_asistencia_config_activa
    CHECK (activa IN (0, 1)),

  CONSTRAINT fk_asistencia_config_admin
    FOREIGN KEY (actualizado_por)
    REFERENCES usuarios (id)
    ON DELETE SET NULL

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Politica configurable para validacion automatica de asistencia';


-- Politica inicial del Cambio #3:
-- 2 minutos.
--
-- ON DUPLICATE KEY UPDATE evita reemplazar una configuracion
-- previamente establecida si la migracion se vuelve a revisar
-- o ejecutar de forma controlada.

INSERT INTO asistencia_configuracion (
  id,
  duracion_minima_minutos,
  activa
)
VALUES (
  1,
  2,
  1
)
ON DUPLICATE KEY UPDATE
  id = id;


-- ============================================================
-- 3. HISTORIAL SQL DE REVISION ADMINISTRATIVA
--
-- MongoDB continua como bitacora complementaria.
--
-- Esta tabla es la fuente durable de las decisiones tomadas
-- sobre una asistencia que requiere revision.
-- ============================================================

CREATE TABLE IF NOT EXISTS asistencia_revisiones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  asistencia_id
    INT(11) NOT NULL,

  admin_usuario_id
    INT(11) NOT NULL,

  accion
    ENUM(
      'APROBAR',
      'RECHAZAR',
      'JUSTIFICAR',
      'CORREGIR'
    )
    NOT NULL,

  motivo
    TEXT NULL,

  estado_anterior
    ENUM(
      'pendiente',
      'aprobada',
      'rechazada',
      'INVALIDA_PENDIENTE_REVISION'
    )
    NOT NULL,

  estado_nuevo
    ENUM(
      'pendiente',
      'aprobada',
      'rechazada',
      'INVALIDA_PENDIENTE_REVISION'
    )
    NOT NULL,

  hora_entrada_anterior
    TIME NULL,

  hora_salida_anterior
    TIME NULL,

  hora_entrada_nueva
    TIME NULL,

  hora_salida_nueva
    TIME NULL,

  created_at
    TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  KEY idx_asistencia_revision_asistencia (
    asistencia_id,
    created_at
  ),

  KEY idx_asistencia_revision_admin (
    admin_usuario_id,
    created_at
  ),

  KEY idx_asistencia_revision_accion (
    accion,
    created_at
  ),

  CONSTRAINT fk_asistencia_revision_asistencia
    FOREIGN KEY (asistencia_id)
    REFERENCES asistencias (id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_asistencia_revision_admin
    FOREIGN KEY (admin_usuario_id)
    REFERENCES usuarios (id)
    ON DELETE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Historial durable de revisiones administrativas de asistencia';
