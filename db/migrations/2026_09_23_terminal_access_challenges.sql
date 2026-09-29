CREATE TABLE IF NOT EXISTS terminal_access_challenges (
  challenge_id CHAR(64) NOT NULL,

  terminal_id CHAR(64) NOT NULL,


  session_proof_hmac CHAR(64) NOT NULL,

  status
    ENUM(
      'pending',
      'approved',
      'rejected',
      'consumed'
    )
    NOT NULL
    DEFAULT 'pending',

  decision_admin_user_id INT(11) DEFAULT NULL,

  request_ip_hash CHAR(64) DEFAULT NULL,

  expires_at DATETIME NOT NULL,

  decided_at DATETIME DEFAULT NULL,

  used_at DATETIME DEFAULT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (challenge_id),

  KEY idx_terminal_access_terminal_created (
    terminal_id,
    created_at
  ),

  KEY idx_terminal_access_status_created (
    status,
    created_at
  ),

  KEY idx_terminal_access_expiry (
    expires_at
  ),

  KEY idx_terminal_access_ip_created (
    request_ip_hash,
    created_at
  ),

  KEY idx_terminal_access_admin_decided (
    decision_admin_user_id,
    decided_at
  ),

  CONSTRAINT fk_terminal_access_decision_admin
    FOREIGN KEY (decision_admin_user_id)
    REFERENCES usuarios (id)
    ON DELETE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
