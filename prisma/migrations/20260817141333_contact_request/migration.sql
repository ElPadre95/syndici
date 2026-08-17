-- CreateEnum
CREATE TYPE "ContactRole" AS ENUM ('SYNDIC_PRO', 'SYNDIC_BENEVOLE', 'PROPRIETAIRE');

-- CreateTable
CREATE TABLE "ContactRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "city" TEXT,
    "residences" INTEGER,
    "lots" INTEGER,
    "role" "ContactRole" NOT NULL,
    "message" TEXT,
    "locale" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "handled" BOOLEAN NOT NULL DEFAULT false,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactRequest_handled_createdAt_idx" ON "ContactRequest"("handled", "createdAt");
