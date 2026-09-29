-- ============================================================
-- SMART RH
-- INCAPACIDADES INTELIGENTES
-- Fecha: 2026-09-28
-- ============================================================
--
-- IMPORTANTE:
-- Esta migración se prepara en código pero NO debe ejecutarse
-- automáticamente.
--
-- Objetivos:
-- 1. Persistir validación técnica del PDF.
-- 2. Guardar SHA-256 para detección de duplicados.
-- 3. Preparar extracción estructurada posterior.
-- 4. Preparar comparación automática empleado/documento.
-- 5. Mantener la decisión final en Recursos Humanos.
--
-- Privacidad:
-- NO se almacena aquí el texto OCR completo del documento.
-- NO se almacena el PDF dentro de esta tabla.
-- El PDF permanece en storage privado.
-- ============================================================


CREATE TABLE IF NOT EXISTS incapacidad_analisis (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  incapacidad_id INT NOT NULL,

  documento_sha256 CHAR(64) NOT NULL,

  tamano_bytes INT UNSIGNED NOT NULL,

  pdf_version VARCHAR(16) NULL,

  pdf_header_valido TINYINT(1) NOT NULL DEFAULT 0,

  pdf_eof_presente TINYINT(1) NOT NULL DEFAULT 0,

  pdf_marcador_encriptado TINYINT(1) NOT NULL DEFAULT 0,

  estado_estructura ENUM(
    'valido',
    'requiere_revision',
    'invalido'
  ) NOT NULL,

  puntaje_estructura DECIMAL(5,4) NOT NULL,

  duplicado_detectado TINYINT(1) NOT NULL DEFAULT 0,

  duplicado_de_incapacidad_id INT NULL,

  estado_analisis ENUM(
    'pendiente',
    'completado',
    'requiere_revision',
    'error'
  ) NOT NULL DEFAULT 'pendiente',

  proveedor_analisis VARCHAR(100)
    NOT NULL DEFAULT 'local-deterministico',

  version_analisis VARCHAR(50)
    NOT NULL DEFAULT '1',

  confianza_extraccion DECIMAL(5,4) NULL,

  campos_extraidos JSON NULL,

  diferencias_detectadas JSON NULL,

  codigo_error VARCHAR(100) NULL,

  analizado_at DATETIME NULL,

  created_at DATETIME
    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  updated_at DATETIME
    NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY uq_incapacidad_analisis_incapacidad (
    incapacidad_id
  ),

  KEY idx_incapacidad_analisis_sha256 (
    documento_sha256
  ),

  KEY idx_incapacidad_analisis_estado (
    estado_analisis
  ),

  KEY idx_incapacidad_analisis_duplicado (
    duplicado_de_incapacidad_id
  ),

  CONSTRAINT fk_incapacidad_analisis_incapacidad
    FOREIGN KEY (incapacidad_id)
    REFERENCES incapacidades(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_incapacidad_analisis_duplicado
    FOREIGN KEY (duplicado_de_incapacidad_id)
    REFERENCES incapacidades(id)
    ON DELETE SET NULL
)
ENGINE=InnoDB;
