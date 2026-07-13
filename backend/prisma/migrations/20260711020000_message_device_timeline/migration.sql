ALTER TABLE "Message" ADD COLUMN "device_id" INTEGER;
ALTER TABLE "Message" ADD COLUMN "send_started_at" TIMESTAMP(3);
ALTER TABLE "Message" ADD CONSTRAINT "Message_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Message_device_id_idx" ON "Message"("device_id");
