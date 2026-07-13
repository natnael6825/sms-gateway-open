-- Bring databases created by the original v2 migration in sync with the
-- current Device model. Defaults preserve existing paired-device rows.
ALTER TABLE "Device"
  ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL DEFAULT 'Unknown Device',
  ADD COLUMN IF NOT EXISTS "model" TEXT NOT NULL DEFAULT 'Unknown',
  ADD COLUMN IF NOT EXISTS "last_seen" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "is_connected" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "messages_sent" INTEGER NOT NULL DEFAULT 0;
