BEGIN;

-- CreateEnum
CREATE TYPE "CommercialStage" AS ENUM ('NOVA', 'EM_TENTATIVA', 'CONTATO_REALIZADO', 'QUALIFICADA', 'REUNIAO_AGENDADA', 'REUNIAO_REALIZADA', 'GANHA', 'PERDIDA', 'CONGELADA', 'DESCARTADA');

-- CreateEnum
CREATE TYPE "InteractionChannel" AS ENUM ('CALL', 'WHATSAPP', 'EMAIL', 'INSTAGRAM', 'OTHER');

-- CreateEnum
CREATE TYPE "InteractionOrigin" AS ENUM ('MANUAL', 'API4COM');

-- CreateEnum
CREATE TYPE "InteractionResult" AS ENUM ('SEM_RESPOSTA', 'OCUPADO', 'CAIXA_POSTAL', 'NUMERO_INVALIDO', 'ERRO_TECNICO', 'PESSOA_ERRADA', 'RECEPCAO', 'RESPONSAVEL_INDISPONIVEL', 'SOLICITOU_RETORNO', 'FALOU_COM_RESPONSAVEL', 'SEM_INTERESSE', 'EMPRESA_INADEQUADA', 'EMPRESA_QUALIFICADA', 'REUNIAO_AGENDADA');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('PHONE', 'WHATSAPP', 'EMAIL', 'WEBSITE', 'INSTAGRAM', 'OTHER');

-- CreateEnum
CREATE TYPE "ContactValidity" AS ENUM ('UNKNOWN', 'VALID', 'INVALID');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "api4ComExtension" TEXT;

-- AlterTable
ALTER TABLE "Base" ADD COLUMN "operationScript" TEXT;

-- AlterTable
ALTER TABLE "Company"
ADD COLUMN "registrationStatus" TEXT,
ADD COLUMN "legalNature" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "district" TEXT,
ADD COLUMN "postalCode" TEXT,
ADD COLUMN "notes" TEXT;

-- AlterTable
ALTER TABLE "BaseCompany"
ADD COLUMN "stage" "CommercialStage" NOT NULL DEFAULT 'NOVA',
ADD COLUMN "assignedUserId" TEXT,
ADD COLUMN "lastInteractionAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CompanyContact" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "ContactType" NOT NULL,
    "value" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "responsibleName" TEXT,
    "role" TEXT,
    "source" TEXT,
    "validity" "ContactValidity" NOT NULL DEFAULT 'UNKNOWN',
    "validatedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompanyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesInteraction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "baseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactId" TEXT,
    "channel" "InteractionChannel" NOT NULL DEFAULT 'CALL',
    "contactUsed" TEXT,
    "result" "InteractionResult",
    "notes" TEXT,
    "previousStage" "CommercialStage" NOT NULL,
    "nextStage" "CommercialStage" NOT NULL,
    "origin" "InteractionOrigin" NOT NULL DEFAULT 'MANUAL',
    "externalCallId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "dispositionKey" TEXT,
    "startedAt" TIMESTAMP(3),
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "hangupCause" TEXT,
    "recordingUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SalesInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUpTask" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "baseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "interactionId" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FollowUpTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationCursor" (
    "userId" TEXT NOT NULL,
    "baseId" TEXT NOT NULL,
    "currentCompanyId" TEXT,
    "previousCompanyId" TEXT,
    "view" TEXT NOT NULL DEFAULT 'not-worked',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OperationCursor_pkey" PRIMARY KEY ("userId","baseId")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyContact_companyId_type_value_key" ON "CompanyContact"("companyId", "type", "value");
CREATE INDEX "CompanyContact_companyId_isPrimary_idx" ON "CompanyContact"("companyId", "isPrimary");
CREATE INDEX "CompanyContact_createdByUserId_idx" ON "CompanyContact"("createdByUserId");
CREATE UNIQUE INDEX "SalesInteraction_externalCallId_key" ON "SalesInteraction"("externalCallId");
CREATE UNIQUE INDEX "SalesInteraction_idempotencyKey_key" ON "SalesInteraction"("idempotencyKey");
CREATE UNIQUE INDEX "SalesInteraction_dispositionKey_key" ON "SalesInteraction"("dispositionKey");
CREATE INDEX "SalesInteraction_companyId_createdAt_idx" ON "SalesInteraction"("companyId", "createdAt");
CREATE INDEX "SalesInteraction_baseId_createdAt_idx" ON "SalesInteraction"("baseId", "createdAt");
CREATE INDEX "SalesInteraction_userId_createdAt_idx" ON "SalesInteraction"("userId", "createdAt");
CREATE INDEX "FollowUpTask_userId_status_dueAt_idx" ON "FollowUpTask"("userId", "status", "dueAt");
CREATE INDEX "FollowUpTask_baseId_status_dueAt_idx" ON "FollowUpTask"("baseId", "status", "dueAt");
CREATE INDEX "FollowUpTask_companyId_createdAt_idx" ON "FollowUpTask"("companyId", "createdAt");
CREATE INDEX "OperationCursor_currentCompanyId_idx" ON "OperationCursor"("currentCompanyId");
CREATE INDEX "BaseCompany_baseId_stage_lastInteractionAt_idx" ON "BaseCompany"("baseId", "stage", "lastInteractionAt");
CREATE INDEX "BaseCompany_assignedUserId_idx" ON "BaseCompany"("assignedUserId");

-- AddForeignKey
ALTER TABLE "BaseCompany" ADD CONSTRAINT "BaseCompany_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompanyContact" ADD CONSTRAINT "CompanyContact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyContact" ADD CONSTRAINT "CompanyContact_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesInteraction" ADD CONSTRAINT "SalesInteraction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesInteraction" ADD CONSTRAINT "SalesInteraction_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "Base"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesInteraction" ADD CONSTRAINT "SalesInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesInteraction" ADD CONSTRAINT "SalesInteraction_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CompanyContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "Base"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "SalesInteraction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OperationCursor" ADD CONSTRAINT "OperationCursor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OperationCursor" ADD CONSTRAINT "OperationCursor_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "Base"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OperationCursor" ADD CONSTRAINT "OperationCursor_currentCompanyId_fkey" FOREIGN KEY ("currentCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
