BEGIN;

-- Prevent companies from being created, updated, or deleted while memberships
-- are copied and the legacy columns are removed.
LOCK TABLE "public"."Company" IN ACCESS EXCLUSIVE MODE;

-- CreateTable
CREATE TABLE "public"."BaseCompany" (
    "baseId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" TEXT DEFAULT 'Novo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BaseCompany_pkey" PRIMARY KEY ("baseId","companyId")
);

-- CreateIndex
CREATE INDEX "BaseCompany_companyId_idx" ON "public"."BaseCompany"("companyId");

-- AddForeignKey
ALTER TABLE "public"."BaseCompany" ADD CONSTRAINT "BaseCompany_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "public"."Base"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BaseCompany" ADD CONSTRAINT "BaseCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve every existing company-base relationship before removing the direct relation.
INSERT INTO "public"."BaseCompany" (
    "baseId",
    "companyId",
    "status",
    "createdAt",
    "updatedAt"
)
SELECT
    "baseId",
    "id",
    "status",
    "createdAt",
    "updatedAt"
FROM "public"."Company";

-- Abort the transaction before dropping legacy columns if the backfill is incomplete
-- or if any copied membership differs from its source company.
DO $$
DECLARE
    company_count BIGINT;
    company_with_base_count BIGINT;
    membership_count BIGINT;
    missing_membership_count BIGINT;
    duplicate_membership_count BIGINT;
    orphan_membership_count BIGINT;
    mismatched_membership_count BIGINT;
BEGIN
    SELECT COUNT(*), COUNT("baseId")
    INTO company_count, company_with_base_count
    FROM "public"."Company";

    SELECT COUNT(*)
    INTO membership_count
    FROM "public"."BaseCompany";

    SELECT COUNT(*)
    INTO missing_membership_count
    FROM "public"."Company" AS company
    LEFT JOIN "public"."BaseCompany" AS membership
        ON membership."companyId" = company."id"
        AND membership."baseId" = company."baseId"
    WHERE membership."companyId" IS NULL;

    SELECT COUNT(*)
    INTO duplicate_membership_count
    FROM (
        SELECT "baseId", "companyId"
        FROM "public"."BaseCompany"
        GROUP BY "baseId", "companyId"
        HAVING COUNT(*) > 1
    ) AS duplicate_memberships;

    SELECT COUNT(*)
    INTO orphan_membership_count
    FROM "public"."BaseCompany" AS membership
    LEFT JOIN "public"."Base" AS base
        ON base."id" = membership."baseId"
    LEFT JOIN "public"."Company" AS company
        ON company."id" = membership."companyId"
    WHERE base."id" IS NULL OR company."id" IS NULL;

    SELECT COUNT(*)
    INTO mismatched_membership_count
    FROM "public"."Company" AS company
    JOIN "public"."BaseCompany" AS membership
        ON membership."companyId" = company."id"
        AND membership."baseId" = company."baseId"
    WHERE membership."status" IS DISTINCT FROM company."status"
        OR membership."createdAt" IS DISTINCT FROM company."createdAt"
        OR membership."updatedAt" IS DISTINCT FROM company."updatedAt";

    IF company_count <> company_with_base_count THEN
        RAISE EXCEPTION
            'Company backfill aborted: % companies exist but only % have baseId',
            company_count,
            company_with_base_count;
    END IF;

    IF company_with_base_count <> membership_count THEN
        RAISE EXCEPTION
            'Company backfill aborted: % source links and % memberships',
            company_with_base_count,
            membership_count;
    END IF;

    IF missing_membership_count > 0 THEN
        RAISE EXCEPTION
            'Company backfill aborted: % memberships are missing',
            missing_membership_count;
    END IF;

    IF duplicate_membership_count > 0 THEN
        RAISE EXCEPTION
            'Company backfill aborted: % duplicate memberships found',
            duplicate_membership_count;
    END IF;

    IF orphan_membership_count > 0 THEN
        RAISE EXCEPTION
            'Company backfill aborted: % orphan memberships found',
            orphan_membership_count;
    END IF;

    IF mismatched_membership_count > 0 THEN
        RAISE EXCEPTION
            'Company backfill aborted: % memberships differ from source data',
            mismatched_membership_count;
    END IF;
END;
$$;

-- DropForeignKey
ALTER TABLE "public"."Company" DROP CONSTRAINT "Company_baseId_fkey";

-- DropIndex
DROP INDEX "public"."Company_baseId_idx";

-- AlterTable
ALTER TABLE "public"."Company"
DROP COLUMN "baseId",
DROP COLUMN "status";

COMMIT;
