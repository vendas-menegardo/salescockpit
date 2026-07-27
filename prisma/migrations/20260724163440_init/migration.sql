-- CreateTable
CREATE TABLE "public"."Base" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "segment" TEXT,
    "state" TEXT,
    "city" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "companiesCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Base_pkey" PRIMARY KEY ("id")
);
