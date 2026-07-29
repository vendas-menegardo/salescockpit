BEGIN;

CREATE TYPE "CompanyChangeOrigin" AS ENUM ('MANUAL', 'PROVIDER');
CREATE TYPE "EnrichmentJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "CompanyDataChange" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "origin" "CompanyChangeOrigin" NOT NULL DEFAULT 'MANUAL',
    "provider" TEXT,
    "changedFields" JSONB NOT NULL,
    "completenessBefore" INTEGER NOT NULL,
    "completenessAfter" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyDataChange_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnrichmentJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "EnrichmentJobStatus" NOT NULL DEFAULT 'PENDING',
    "filters" JSONB,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnrichmentJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnrichmentJobItem" (
    "jobId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" "EnrichmentJobStatus" NOT NULL DEFAULT 'PENDING',
    "preview" JSONB,
    "appliedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnrichmentJobItem_pkey" PRIMARY KEY ("jobId", "companyId")
);

CREATE INDEX "CompanyDataChange_companyId_createdAt_idx" ON "CompanyDataChange"("companyId", "createdAt");
CREATE INDEX "CompanyDataChange_userId_createdAt_idx" ON "CompanyDataChange"("userId", "createdAt");
CREATE INDEX "CompanyDataChange_origin_createdAt_idx" ON "CompanyDataChange"("origin", "createdAt");
CREATE INDEX "EnrichmentJob_userId_createdAt_idx" ON "EnrichmentJob"("userId", "createdAt");
CREATE INDEX "EnrichmentJob_status_updatedAt_idx" ON "EnrichmentJob"("status", "updatedAt");
CREATE INDEX "EnrichmentJobItem_companyId_status_idx" ON "EnrichmentJobItem"("companyId", "status");
CREATE INDEX "EnrichmentJobItem_jobId_status_idx" ON "EnrichmentJobItem"("jobId", "status");

ALTER TABLE "CompanyDataChange"
ADD CONSTRAINT "CompanyDataChange_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CompanyDataChange"
ADD CONSTRAINT "CompanyDataChange_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EnrichmentJob"
ADD CONSTRAINT "EnrichmentJob_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EnrichmentJobItem"
ADD CONSTRAINT "EnrichmentJobItem_jobId_fkey"
FOREIGN KEY ("jobId") REFERENCES "EnrichmentJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EnrichmentJobItem"
ADD CONSTRAINT "EnrichmentJobItem_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
