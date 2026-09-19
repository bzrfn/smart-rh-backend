CREATE TABLE IF NOT EXISTS admin_invitations (
  invitation_id CHAR(64) NOT NULL,
  token_hmac CHAR(64) NOT NULL,

  sponsor_admin_id INT(11) NOT NULL,
  sponsor_session_version INT UNSIGNED NOT NULL,

  invite_email VARCHAR(191) NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,

  telefono VARCHAR(30) DEFAULT NULL,
  direccion VARCHAR(500) DEFAULT NULL,
  fecha_ingreso DATE DEFAULT NULL,

  dias_vacaciones_disponibles
    INT UNSIGNED NOT NULL DEFAULT 12,

  request_ip_hash CHAR(64) DEFAULT NULL,

  expires_at DATETIME NOT NULL,

  accepted_at DATETIME DEFAULT NULL,
  accepted_user_id INT(11) DEFAULT NULL,

  revoked_at DATETIME DEFAULT NULL,

  created_at TIMESTAMP
    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (invitation_id),

  KEY idx_admin_invite_email_created (
    invite_email,
    created_at
  ),

  KEY idx_admin_invite_sponsor_created (
    sponsor_admin_id,
    created_at
  ),

  KEY idx_admin_invite_expiry (
    expires_at
  ),

  KEY idx_admin_invite_accepted (
    accepted_at
  ),

  KEY idx_admin_invite_revoked (
    revoked_at
  ),

  KEY idx_admin_invite_ip_created (
    request_ip_hash,
    created_at
  ),

  CONSTRAINT fk_admin_invite_sponsor
    FOREIGN KEY (sponsor_admin_id)
    REFERENCES usuarios (id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_admin_invite_accepted_user
    FOREIGN KEY (accepted_user_id)
    REFERENCES usuarios (id)
    ON DELETE SET NULL

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
