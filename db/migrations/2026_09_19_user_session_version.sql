ALTER TABLE usuarios
  ADD COLUMN session_version
    INT UNSIGNED
    NOT NULL
    DEFAULT 1
    AFTER es_cuenta_sistema;
