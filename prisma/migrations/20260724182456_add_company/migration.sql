-- CreateTable
CREATE TABLE "public"."Company" (
    "id" TEXT NOT NULL,
    "baseId" TEXT NOT NULL,
    "corporateName" TEXT NOT NULL,
    "tradeName" TEXT,
    "cnpj" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "website" TEXT,
    "segment" TEXT,
    "state" TEXT,
    "city" TEXT,
    "address" TEXT,
    "contactName" TEXT,
    "contactRole" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_cnpj_key" ON "public"."Company"("cnpj");

-- CreateIndex
CREATE INDEX "Company_baseId_idx" ON "public"."Company"("baseId");

-- CreateIndex
CREATE INDEX "Company_city_idx" ON "public"."Company"("city");

-- CreateIndex
CREATE INDEX "Company_state_idx" ON "public"."Company"("state");

-- CreateIndex
CREATE INDEX "Company_segment_idx" ON "public"."Company"("segment");

-- AddForeignKey
ALTER TABLE "public"."Company" ADD CONSTRAINT "Company_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "public"."Base"("id") ON DELETE CASCADE ON UPDATE CASCADE;
