-- Additive migration; legacy invitation roles stay unknown until an administrator selects one.
ALTER TABLE admin_invitations ADD COLUMN IF NOT EXISTS account_type ENUM('admin', 'empleado') DEFAULT NULL;
ALTER TABLE admin_invitations ADD COLUMN IF NOT EXISTS delivery_failed_at DATETIME DEFAULT NULL;
