-- Keep the API credential that authenticated each programmatic SMS request.
-- Existing messages remain NULL because their originating credential cannot be
-- determined safely after the fact.
ALTER TABLE "Message" ADD COLUMN "api_key_id" INTEGER;

CREATE INDEX "Message_api_key_id_idx" ON "Message"("api_key_id");

ALTER TABLE "Message"
ADD CONSTRAINT "Message_api_key_id_fkey"
FOREIGN KEY ("api_key_id") REFERENCES "ApiKey"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
