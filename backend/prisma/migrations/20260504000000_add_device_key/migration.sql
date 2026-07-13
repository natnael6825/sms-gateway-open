-- AlterTable: add device_key column to User (nullable, unique)
ALTER TABLE "User" ADD COLUMN "device_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_device_key_key" ON "User"("device_key");
