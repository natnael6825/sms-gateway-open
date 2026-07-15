-- Persist the assignment order so every dispatch-ready phone receives one message
-- per round, even across backend restarts.
ALTER TABLE "Device"
ADD COLUMN "last_assigned_at" TIMESTAMP(3),
ADD COLUMN "last_polled_at" TIMESTAMP(3);

CREATE INDEX "Device_user_id_last_assigned_at_idx"
ON "Device"("user_id", "last_assigned_at");

CREATE INDEX "Device_user_id_last_polled_at_idx"
ON "Device"("user_id", "last_polled_at");

-- Support FIFO row locking without scanning another owner's queue.
CREATE INDEX "Message_user_id_status_created_at_id_idx"
ON "Message"("user_id", "status", "created_at", "id");
