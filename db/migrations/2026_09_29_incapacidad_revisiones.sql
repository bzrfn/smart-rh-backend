-- ============================================================
-- SMART RH
-- HISTORIAL DURABLE DE REVISION DE INCAPACIDADES
--
-- La decisión administrativa se conserva junto con un
-- snapshot mínimo del resultado automático disponible
-- en el instante de la revisión.
--
-- Debe ejecutarse después de 2026_09_28_incapacidades_inteligentes.sql.
-- ============================================================

CREATE TABLE IF NOT EXISTS incapacidad_revisiones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  incapacidad_id INT NOT NULL,

  admin_usuario_id INT NOT NULL,

  accion ENUM(
    'APROBAR',
    'RECHAZAR'
  ) NOT NULL,

  estado_anterior ENUM(
    'pendiente',
    'aprobada',
    'rechazada'
  ) NOT NULL,

  estado_nuevo ENUM(
    'aprobada',
    'rechazada'
  ) NOT NULL,

  observaciones_admin VARCHAR(1000) NULL,

  analisis_disponible TINYINT(1) NOT NULL DEFAULT 0,

  analisis_id BIGINT UNSIGNED NULL,

  estado_analisis_snapshot ENUM(
    'pendiente',
    'completado',
    'requiere_revision',
    'error'
  ) NULL,

  estado_estructura_snapshot ENUM(
    'valido',
    'requiere_revision',
    'invalido'
  ) NULL,

  puntaje_estructura_snapshot DECIMAL(5,4) NULL,

  duplicado_detectado_snapshot TINYINT(1) NULL,

  duplicado_de_incapacidad_id_snapshot INT NULL,

  proveedor_analisis_snapshot VARCHAR(120) NULL,

  version_analisis_snapshot VARCHAR(80) NULL,

  decidido_at DATETIME NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  created_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  KEY idx_incap_revision_incapacidad (
    incapacidad_id,
    decidido_at
  ),

  KEY idx_incap_revision_admin (
    admin_usuario_id,
    decidido_at
  ),

  KEY idx_incap_revision_accion (
    accion,
    decidido_at
  ),

  KEY idx_incap_revision_analisis (
    analisis_id
  ),

  CONSTRAINT fk_incap_revision_incapacidad
    FOREIGN KEY (incapacidad_id)
    REFERENCES incapacidades (id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_incap_revision_admin
    FOREIGN KEY (admin_usuario_id)
    REFERENCES usuarios (id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_incap_revision_analisis
    FOREIGN KEY (analisis_id)
    REFERENCES incapacidad_analisis (id)
    ON DELETE SET NULL

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Historial durable de decisiones administrativas de incapacidades';
