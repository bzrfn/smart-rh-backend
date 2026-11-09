ALTER TABLE admin_invitations
  ADD COLUMN IF NOT EXISTS profile_completion_required TINYINT(1) NOT NULL DEFAULT 0;
