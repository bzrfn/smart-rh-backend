ALTER TABLE admin_invitations ADD COLUMN IF NOT EXISTS existing_user_id INT DEFAULT NULL;
ALTER TABLE admin_invitations ADD COLUMN IF NOT EXISTS existing_user_session_version INT DEFAULT NULL;
