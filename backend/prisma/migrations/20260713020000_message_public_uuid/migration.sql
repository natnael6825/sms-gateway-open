-- Keep the integer primary key for the trusted dashboard/device protocol while
-- exposing a non-sequential identifier to API clients. gen_random_uuid() is a
-- core function in the supported PostgreSQL versions, so no extension or
-- elevated database permission is required. Because it is volatile, PostgreSQL
-- evaluates it separately for every existing row during this safe backfill.
BEGIN;

ALTER TABLE "Message"
ADD COLUMN "public_id" UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX "Message_public_id_key" ON "Message"("public_id");

COMMIT;
