-- CreateEnum
CREATE TYPE "ContactInvalidReason" AS ENUM ('WRONG_NUMBER', 'NONEXISTENT', 'INVALID_EMAIL', 'OTHER');

-- CreateEnum
CREATE TYPE "ContactEventType" AS ENUM ('CREATED', 'UPDATED', 'PRIMARY_CHANGED', 'VALIDATED', 'INVALIDATED', 'ARCHIVED', 'RESTORED');

-- CreateEnum
CREATE TYPE "CompanyQualification" AS ENUM ('EM_OPERACAO', 'ATUALIZAR_CONTATO', 'CONGELADA', 'PERDIDA', 'INAPTA');

-- CreateEnum
CREATE TYPE "MembershipChangeType" AS ENUM ('QUALIFICATION_CHANGED', 'STAGE_CHANGED', 'CONTACT_UPDATE_RECOMMENDED');

-- AlterEnum
ALTER TYPE "InteractionResult" ADD VALUE 'ATENDEU';
ALTER TYPE "InteractionResult" ADD VALUE 'NUMERO_ERRADO';
ALTER TYPE "InteractionResult" ADD VALUE 'NUMERO_INEXISTENTE';
ALTER TYPE "InteractionResult" ADD VALUE 'EMAIL_PREPARADO';
ALTER TYPE "InteractionResult" ADD VALUE 'EMAIL_ENVIADO';
ALTER TYPE "InteractionResult" ADD VALUE 'EMAIL_RESPOSTA';
ALTER TYPE "InteractionResult" ADD VALUE 'WHATSAPP_PREPARADO';
ALTER TYPE "InteractionResult" ADD VALUE 'WHATSAPP_ENVIADO';

-- AlterTable
ALTER TABLE "BaseCompany"
ADD COLUMN "qualification" "CompanyQualification",
ADD COLUMN "qualificationReason" TEXT;

-- AlterTable
ALTER TABLE "CompanyContact"
ADD COLUMN "originalValue" TEXT,
ADD COLUMN "canonicalValue" TEXT,
ADD COLUMN "isWhatsapp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "invalidReason" "ContactInvalidReason",
ADD COLUMN "invalidatedAt" TIMESTAMP(3),
ADD COLUMN "invalidatedByUserId" TEXT,
ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "archivedByUserId" TEXT;

-- CreateTable
CREATE TABLE "CompanyContactEvent" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "type" "ContactEventType" NOT NULL,
    "reason" TEXT,
    "previousState" JSONB,
    "nextState" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyContactEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InteractionCorrection" (
    "id" TEXT NOT NULL,
    "interactionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "previousResult" "InteractionResult",
    "correctedResult" "InteractionResult" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InteractionCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaseCompanyChange" (
    "id" TEXT NOT NULL,
    "baseId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "type" "MembershipChangeType" NOT NULL,
    "reason" TEXT,
    "previousState" JSONB,
    "nextState" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BaseCompanyChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyContact_companyId_canonicalValue_idx" ON "CompanyContact"("companyId", "canonicalValue");
CREATE INDEX "CompanyContact_companyId_archivedAt_idx" ON "CompanyContact"("companyId", "archivedAt");
CREATE INDEX "CompanyContact_invalidatedByUserId_idx" ON "CompanyContact"("invalidatedByUserId");
CREATE INDEX "CompanyContact_archivedByUserId_idx" ON "CompanyContact"("archivedByUserId");
CREATE INDEX "CompanyContactEvent_contactId_createdAt_idx" ON "CompanyContactEvent"("contactId", "createdAt");
CREATE INDEX "CompanyContactEvent_companyId_createdAt_idx" ON "CompanyContactEvent"("companyId", "createdAt");
CREATE INDEX "CompanyContactEvent_userId_createdAt_idx" ON "CompanyContactEvent"("userId", "createdAt");
CREATE INDEX "InteractionCorrection_interactionId_createdAt_idx" ON "InteractionCorrection"("interactionId", "createdAt");
CREATE INDEX "InteractionCorrection_userId_createdAt_idx" ON "InteractionCorrection"("userId", "createdAt");
CREATE INDEX "BaseCompanyChange_baseId_companyId_createdAt_idx" ON "BaseCompanyChange"("baseId", "companyId", "createdAt");
CREATE INDEX "BaseCompanyChange_userId_createdAt_idx" ON "BaseCompanyChange"("userId", "createdAt");

-- Active contacts may only have one canonical phone or email per company.
CREATE UNIQUE INDEX "CompanyContact_active_phone_canonical_key"
ON "CompanyContact"("companyId", "canonicalValue")
WHERE "archivedAt" IS NULL
  AND "canonicalValue" IS NOT NULL
  AND "type" IN ('PHONE', 'WHATSAPP');

CREATE UNIQUE INDEX "CompanyContact_active_email_canonical_key"
ON "CompanyContact"("companyId", "canonicalValue")
WHERE "archivedAt" IS NULL
  AND "canonicalValue" IS NOT NULL
  AND "type" = 'EMAIL';

-- A company can have only one active primary phone and one active primary email.
CREATE UNIQUE INDEX "CompanyContact_active_primary_phone_key"
ON "CompanyContact"("companyId")
WHERE "archivedAt" IS NULL
  AND "isPrimary" = true
  AND "type" IN ('PHONE', 'WHATSAPP');

CREATE UNIQUE INDEX "CompanyContact_active_primary_email_key"
ON "CompanyContact"("companyId")
WHERE "archivedAt" IS NULL
  AND "isPrimary" = true
  AND "type" = 'EMAIL';

-- AddForeignKey
ALTER TABLE "CompanyContact" ADD CONSTRAINT "CompanyContact_invalidatedByUserId_fkey" FOREIGN KEY ("invalidatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompanyContact" ADD CONSTRAINT "CompanyContact_archivedByUserId_fkey" FOREIGN KEY ("archivedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompanyContactEvent" ADD CONSTRAINT "CompanyContactEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CompanyContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyContactEvent" ADD CONSTRAINT "CompanyContactEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyContactEvent" ADD CONSTRAINT "CompanyContactEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InteractionCorrection" ADD CONSTRAINT "InteractionCorrection_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "SalesInteraction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InteractionCorrection" ADD CONSTRAINT "InteractionCorrection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BaseCompanyChange" ADD CONSTRAINT "BaseCompanyChange_baseId_companyId_fkey" FOREIGN KEY ("baseId", "companyId") REFERENCES "BaseCompany"("baseId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BaseCompanyChange" ADD CONSTRAINT "BaseCompanyChange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
