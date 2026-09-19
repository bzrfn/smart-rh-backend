CREATE TABLE IF NOT EXISTS login_2fa_challenges (
  challenge_id CHAR(64) NOT NULL,

  user_id INT(11) NOT NULL,

  session_version INT UNSIGNED NOT NULL,

  code_hmac CHAR(64) NOT NULL,

  request_ip_hash CHAR(64) DEFAULT NULL,

  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,

  max_attempts TINYINT UNSIGNED NOT NULL DEFAULT 5,

  expires_at DATETIME NOT NULL,

  used_at DATETIME DEFAULT NULL,

  last_attempt_at DATETIME DEFAULT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (
    challenge_id
  ),

  KEY idx_login_2fa_user_created (
    user_id,
    created_at
  ),

  KEY idx_login_2fa_expiry (
    expires_at
  ),

  KEY idx_login_2fa_used (
    used_at
  ),

  KEY idx_login_2fa_ip_created (
    request_ip_hash,
    created_at
  ),

  CONSTRAINT fk_login_2fa_user
    FOREIGN KEY (
      user_id
    )
    REFERENCES usuarios (
      id
    )
    ON DELETE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
