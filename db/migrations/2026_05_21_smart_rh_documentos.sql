ALTER TABLE usuarios
  ADD COLUMN foto_perfil_url VARCHAR(255) NULL,
  ADD COLUMN credencial_url VARCHAR(255) NULL;

ALTER TABLE contratos
  ADD COLUMN contrato_pdf_url VARCHAR(255) NULL;
