BEGIN;

-- CreateEnum
CREATE TYPE "public"."ImportJobStatus" AS ENUM ('PREPARING', 'READY', 'PROCESSING', 'PAUSED', 'COMPLETED');

-- CreateTable
CREATE TABLE "public"."ImportJob" (
    "id" TEXT NOT NULL,
    "baseId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "status" "public"."ImportJobStatus" NOT NULL DEFAULT 'PREPARING',
    "totalRows" INTEGER NOT NULL,
    "eligibleRows" INTEGER NOT NULL,
    "stagedRows" INTEGER NOT NULL DEFAULT 0,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "invalidIgnored" INTEGER NOT NULL,
    "duplicatesIgnored" INTEGER NOT NULL,
    "emptyRowsIgnored" INTEGER NOT NULL,
    "companiesCreated" INTEGER NOT NULL DEFAULT 0,
    "existingCompaniesReused" INTEGER NOT NULL DEFAULT 0,
    "linksCreated" INTEGER NOT NULL DEFAULT 0,
    "alreadyInBase" INTEGER NOT NULL DEFAULT 0,
    "conflictsPreserved" INTEGER NOT NULL DEFAULT 0,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ImportJobRow" (
    "jobId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "cnpj" TEXT NOT NULL,
    "corporateName" TEXT NOT NULL,
    "tradeName" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "ImportJobRow_pkey" PRIMARY KEY ("jobId","rowNumber")
);

-- CreateIndex
CREATE INDEX "ImportJob_baseId_fileHash_idx" ON "public"."ImportJob"("baseId", "fileHash");

-- CreateIndex
CREATE INDEX "ImportJob_status_updatedAt_idx" ON "public"."ImportJob"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImportJobRow_jobId_cnpj_key" ON "public"."ImportJobRow"("jobId", "cnpj");

-- CreateIndex
CREATE INDEX "ImportJobRow_jobId_processedAt_rowNumber_idx" ON "public"."ImportJobRow"("jobId", "processedAt", "rowNumber");

-- AddForeignKey
ALTER TABLE "public"."ImportJob" ADD CONSTRAINT "ImportJob_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "public"."Base"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImportJobRow" ADD CONSTRAINT "ImportJobRow_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "public"."ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
