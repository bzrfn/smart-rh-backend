-- SMART RH
-- Gestión de Incapacidades
--
-- IMPORTANTE:
-- Esta migración debe aplicarse exactamente una vez.
-- Antes de ejecutarla en cualquier ambiente se debe auditar
-- si la tabla incapacidades ya existe.
--
-- INC-1 únicamente crea este archivo.
-- NO se ejecuta en este checkpoint.

CREATE TABLE incapacidades (
  id INT NOT NULL AUTO_INCREMENT,

  usuario_id INT NOT NULL,

  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,

  dias_calculados INT NOT NULL,

  motivo VARCHAR(500) NOT NULL,

  estado ENUM(
    'pendiente',
    'aprobada',
    'rechazada'
  ) NOT NULL DEFAULT 'pendiente',

  comprobante_key VARCHAR(500) NULL,
  comprobante_nombre VARCHAR(255) NULL,
  comprobante_mime VARCHAR(100) NULL,
  comprobante_tamano INT UNSIGNED NULL,

  observaciones_admin VARCHAR(1000) NULL,

  revisado_por_admin_id INT NULL,
  revisado_at DATETIME NULL,

  created_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  updated_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  KEY idx_incapacidades_usuario (
    usuario_id
  ),

  KEY idx_incapacidades_estado (
    estado
  ),

  KEY idx_incapacidades_fechas (
    usuario_id,
    fecha_inicio,
    fecha_fin
  ),

  CONSTRAINT fk_incapacidades_usuario
    FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT fk_incapacidades_admin
    FOREIGN KEY (revisado_por_admin_id)
    REFERENCES usuarios(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
);
