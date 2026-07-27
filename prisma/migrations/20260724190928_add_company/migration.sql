/*
  Warnings:

  - You are about to drop the column `address` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `contactRole` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `whatsapp` on the `Company` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."Company_segment_idx";

-- DropIndex
DROP INDEX "public"."Company_state_idx";

-- AlterTable
ALTER TABLE "public"."Company" DROP COLUMN "address",
DROP COLUMN "contactRole",
DROP COLUMN "isActive",
DROP COLUMN "notes",
DROP COLUMN "whatsapp",
ADD COLUMN     "status" TEXT DEFAULT 'Novo';

-- CreateIndex
CREATE INDEX "Company_cnpj_idx" ON "public"."Company"("cnpj");
