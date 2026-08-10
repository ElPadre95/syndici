-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('fr', 'ar', 'en', 'nl', 'es', 'de');

-- CreateEnum
CREATE TYPE "OrgKind" AS ENUM ('COMPANY', 'INDEPENDENT');

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('OWNER_ADMIN', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ENDED');

-- CreateEnum
CREATE TYPE "MandateStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'ENDED');

-- CreateEnum
CREATE TYPE "ResidenceType" AS ENUM ('IMMEUBLE', 'VILLA', 'MIXTE');

-- CreateEnum
CREATE TYPE "LotType" AS ENUM ('APPARTEMENT', 'VILLA');

-- CreateEnum
CREATE TYPE "AttachmentRole" AS ENUM ('OWNER', 'TENANT');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('STARTER', 'PRO', 'ENTREPRISE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('ESPECES', 'CARTE', 'VIREMENT');

-- CreateEnum
CREATE TYPE "ChargeStatus" AS ENUM ('UPCOMING', 'PAID', 'PARTIAL', 'LATE');

-- CreateEnum
CREATE TYPE "NumberSeries" AS ENUM ('RECU', 'JUSTIFICATIF');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('NOUVEAU', 'EN_COURS', 'RESOLU');

-- CreateEnum
CREATE TYPE "IncidentUrgency" AS ENUM ('NORMALE', 'IMPORTANTE', 'URGENTE');

-- CreateEnum
CREATE TYPE "IncidentUpdateKind" AS ENUM ('COMMENT', 'STATUS_CHANGE', 'CONTACT');

-- CreateEnum
CREATE TYPE "VoteStatus" AS ENUM ('OUVERT', 'CLOS');

-- CreateEnum
CREATE TYPE "DocumentScope" AS ENUM ('PRIVE', 'PARTAGE', 'INTERNE');

-- CreateEnum
CREATE TYPE "DocumentOrigin" AS ENUM ('GERANT', 'RESIDENT');

-- CreateEnum
CREATE TYPE "AnnouncementType" AS ENUM ('INFORMATION', 'TRAVAUX', 'URGENT', 'REUNION', 'TERMINE');

-- CreateEnum
CREATE TYPE "AnnouncementAudience" AS ENUM ('ALL', 'OWNERS', 'TENANTS');

-- CreateEnum
CREATE TYPE "ContractFrequency" AS ENUM ('MENSUEL', 'TRIMESTRIEL', 'SEMESTRIEL', 'ANNUEL');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "SettlementProvider" AS ENUM ('MANUAL', 'BANK_TRANSFER', 'CMI', 'PAYZONE', 'STRIPE', 'OTHER');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'USED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MessageSide" AS ENUM ('GERANT', 'RESIDENT');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "OrgKind" NOT NULL DEFAULT 'COMPANY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "nationality" TEXT,
    "preferredLocale" "Locale" NOT NULL DEFAULT 'fr',
    "authUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'STAFF',
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Residence" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "type" "ResidenceType" NOT NULL DEFAULT 'IMMEUBLE',
    "plan" "Plan" NOT NULL DEFAULT 'STARTER',
    "reportedBalanceMinor" INTEGER NOT NULL DEFAULT 0,
    "defaultChargeApptMinor" INTEGER NOT NULL DEFAULT 0,
    "defaultChargeVillaMinor" INTEGER NOT NULL DEFAULT 0,
    "dueDayOfMonth" INTEGER NOT NULL DEFAULT 1,
    "autoReminder" BOOLEAN NOT NULL DEFAULT true,
    "autoLateFee" BOOLEAN NOT NULL DEFAULT false,
    "autoSmsReminder" BOOLEAN NOT NULL DEFAULT false,
    "autoMonthlyReport" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Residence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mandate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "residenceId" TEXT NOT NULL,
    "status" "MandateStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mandate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lot" (
    "id" TEXT NOT NULL,
    "residenceId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "type" "LotType" NOT NULL DEFAULT 'APPARTEMENT',
    "floor" TEXT,
    "quotePart" INTEGER NOT NULL DEFAULT 1,
    "monthlyChargeMinor" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LotAttachment" (
    "id" TEXT NOT NULL,
    "residenceId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "role" "AttachmentRole" NOT NULL,
    "isChargePayer" BOOLEAN NOT NULL DEFAULT false,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LotAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargeCall" (
    "id" TEXT NOT NULL,
    "residenceId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "externalRef" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChargeCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "residenceId" TEXT NOT NULL,
    "lotId" TEXT,
    "payerPersonId" TEXT,
    "recordedByPersonId" TEXT,
    "method" "PaymentMethod" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "reversesPaymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "residenceId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "chargeCallId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NumberSequence" (
    "residenceId" TEXT NOT NULL,
    "exercice" INTEGER NOT NULL,
    "series" "NumberSeries" NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "NumberSequence_pkey" PRIMARY KEY ("residenceId","exercice","series")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "residenceId" TEXT NOT NULL,
    "exercice" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "number" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "lotId" TEXT,
    "amountMinor" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "residenceId" TEXT,
    "provider" "SettlementProvider" NOT NULL DEFAULT 'MANUAL',
    "merchantId" TEXT,
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettlementAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "residenceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "residenceId" TEXT NOT NULL,
    "categoryId" TEXT,
    "description" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "spentOn" DATE NOT NULL,
    "supplierName" TEXT,
    "exercice" INTEGER,
    "voucherSequence" INTEGER,
    "voucherNumber" TEXT,
    "justificatifId" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierContract" (
    "id" TEXT NOT NULL,
    "residenceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "supplierName" TEXT,
    "amountMinor" INTEGER,
    "startDate" DATE,
    "endDate" DATE NOT NULL,
    "frequency" "ContractFrequency" NOT NULL DEFAULT 'ANNUEL',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "residenceId" TEXT NOT NULL,
    "lotId" TEXT,
    "reportedByPersonId" TEXT,
    "category" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "urgency" "IncidentUrgency" NOT NULL DEFAULT 'NORMALE',
    "status" "IncidentStatus" NOT NULL DEFAULT 'NOUVEAU',
    "photoId" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentUpdate" (
    "id" TEXT NOT NULL,
    "residenceId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "authorPersonId" TEXT,
    "kind" "IncidentUpdateKind" NOT NULL DEFAULT 'COMMENT',
    "message" TEXT,
    "oldStatus" "IncidentStatus",
    "newStatus" "IncidentStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "residenceId" TEXT NOT NULL,
    "type" "AnnouncementType" NOT NULL DEFAULT 'INFORMATION',
    "audience" "AnnouncementAudience" NOT NULL DEFAULT 'ALL',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "publishedByPersonId" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voteId" TEXT,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "residenceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "deadline" DATE,
    "status" "VoteStatus" NOT NULL DEFAULT 'OUVERT',
    "createdByPersonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoteOption" (
    "id" TEXT NOT NULL,
    "residenceId" TEXT NOT NULL,
    "voteId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VoteOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ballot" (
    "id" TEXT NOT NULL,
    "residenceId" TEXT NOT NULL,
    "voteId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "voteOptionId" TEXT NOT NULL,
    "castByPersonId" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "castAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ballot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileAsset" (
    "id" TEXT NOT NULL,
    "residenceId" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "originalName" TEXT,
    "uploadedByPersonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "residenceId" TEXT NOT NULL,
    "lotId" TEXT,
    "personId" TEXT,
    "fileAssetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "DocumentScope" NOT NULL DEFAULT 'PARTAGE',
    "origin" "DocumentOrigin" NOT NULL DEFAULT 'RESIDENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "residenceId" TEXT NOT NULL,
    "lotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "residenceId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderPersonId" TEXT,
    "senderSide" "MessageSide" NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderRule" (
    "id" TEXT NOT NULL,
    "residenceId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "overdueThresholdDays" INTEGER NOT NULL DEFAULT 3,
    "minDaysBetweenReminders" INTEGER NOT NULL DEFAULT 4,
    "concernedStatuses" "ChargeStatus"[] DEFAULT ARRAY['PARTIAL', 'LATE']::"ChargeStatus"[],
    "lateFeeThresholdDays" INTEGER NOT NULL DEFAULT 10,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "residenceId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "recipientPersonId" TEXT,
    "reminderRuleId" TEXT,
    "chargeCallId" TEXT,
    "channel" "ReminderChannel" NOT NULL DEFAULT 'WHATSAPP',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentByPersonId" TEXT,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvitationCode" (
    "id" TEXT NOT NULL,
    "residenceId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "role" "AttachmentRole" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "createdByPersonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvitationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "residenceId" TEXT,
    "actorPersonId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Person_authUserId_key" ON "Person"("authUserId");

-- CreateIndex
CREATE INDEX "Person_email_idx" ON "Person"("email");

-- CreateIndex
CREATE INDEX "Membership_personId_idx" ON "Membership"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_organizationId_personId_key" ON "Membership"("organizationId", "personId");

-- CreateIndex
CREATE INDEX "Mandate_organizationId_idx" ON "Mandate"("organizationId");

-- CreateIndex
CREATE INDEX "Mandate_residenceId_idx" ON "Mandate"("residenceId");

-- CreateIndex
CREATE INDEX "Lot_residenceId_idx" ON "Lot"("residenceId");

-- CreateIndex
CREATE UNIQUE INDEX "Lot_residenceId_reference_key" ON "Lot"("residenceId", "reference");

-- CreateIndex
CREATE INDEX "LotAttachment_residenceId_idx" ON "LotAttachment"("residenceId");

-- CreateIndex
CREATE INDEX "LotAttachment_lotId_idx" ON "LotAttachment"("lotId");

-- CreateIndex
CREATE INDEX "LotAttachment_personId_idx" ON "LotAttachment"("personId");

-- CreateIndex
CREATE INDEX "ChargeCall_residenceId_idx" ON "ChargeCall"("residenceId");

-- CreateIndex
CREATE UNIQUE INDEX "ChargeCall_lotId_periodYear_periodMonth_key" ON "ChargeCall"("lotId", "periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "Payment_residenceId_idx" ON "Payment"("residenceId");

-- CreateIndex
CREATE INDEX "Payment_lotId_idx" ON "Payment"("lotId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_residenceId_idx" ON "PaymentAllocation"("residenceId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_paymentId_idx" ON "PaymentAllocation"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_chargeCallId_idx" ON "PaymentAllocation"("chargeCallId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_paymentId_key" ON "Receipt"("paymentId");

-- CreateIndex
CREATE INDEX "Receipt_residenceId_idx" ON "Receipt"("residenceId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_residenceId_exercice_sequence_key" ON "Receipt"("residenceId", "exercice", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_residenceId_number_key" ON "Receipt"("residenceId", "number");

-- CreateIndex
CREATE INDEX "SettlementAccount_organizationId_idx" ON "SettlementAccount"("organizationId");

-- CreateIndex
CREATE INDEX "SettlementAccount_residenceId_idx" ON "SettlementAccount"("residenceId");

-- CreateIndex
CREATE INDEX "ExpenseCategory_residenceId_idx" ON "ExpenseCategory"("residenceId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_residenceId_label_key" ON "ExpenseCategory"("residenceId", "label");

-- CreateIndex
CREATE INDEX "Expense_residenceId_idx" ON "Expense"("residenceId");

-- CreateIndex
CREATE INDEX "Expense_categoryId_idx" ON "Expense"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_residenceId_voucherNumber_key" ON "Expense"("residenceId", "voucherNumber");

-- CreateIndex
CREATE INDEX "SupplierContract_residenceId_idx" ON "SupplierContract"("residenceId");

-- CreateIndex
CREATE INDEX "Incident_residenceId_idx" ON "Incident"("residenceId");

-- CreateIndex
CREATE INDEX "Incident_lotId_idx" ON "Incident"("lotId");

-- CreateIndex
CREATE INDEX "IncidentUpdate_residenceId_idx" ON "IncidentUpdate"("residenceId");

-- CreateIndex
CREATE INDEX "IncidentUpdate_incidentId_idx" ON "IncidentUpdate"("incidentId");

-- CreateIndex
CREATE INDEX "Announcement_residenceId_idx" ON "Announcement"("residenceId");

-- CreateIndex
CREATE INDEX "Vote_residenceId_idx" ON "Vote"("residenceId");

-- CreateIndex
CREATE INDEX "VoteOption_residenceId_idx" ON "VoteOption"("residenceId");

-- CreateIndex
CREATE INDEX "VoteOption_voteId_idx" ON "VoteOption"("voteId");

-- CreateIndex
CREATE INDEX "Ballot_residenceId_idx" ON "Ballot"("residenceId");

-- CreateIndex
CREATE INDEX "Ballot_voteId_idx" ON "Ballot"("voteId");

-- CreateIndex
CREATE UNIQUE INDEX "Ballot_voteId_lotId_key" ON "Ballot"("voteId", "lotId");

-- CreateIndex
CREATE INDEX "FileAsset_residenceId_idx" ON "FileAsset"("residenceId");

-- CreateIndex
CREATE INDEX "Document_residenceId_idx" ON "Document"("residenceId");

-- CreateIndex
CREATE INDEX "Document_lotId_idx" ON "Document"("lotId");

-- CreateIndex
CREATE INDEX "Conversation_residenceId_idx" ON "Conversation"("residenceId");

-- CreateIndex
CREATE INDEX "Message_residenceId_idx" ON "Message"("residenceId");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "ReminderRule_residenceId_idx" ON "ReminderRule"("residenceId");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderRule_residenceId_version_key" ON "ReminderRule"("residenceId", "version");

-- CreateIndex
CREATE INDEX "Reminder_residenceId_idx" ON "Reminder"("residenceId");

-- CreateIndex
CREATE INDEX "Reminder_lotId_idx" ON "Reminder"("lotId");

-- CreateIndex
CREATE UNIQUE INDEX "InvitationCode_codeHash_key" ON "InvitationCode"("codeHash");

-- CreateIndex
CREATE INDEX "InvitationCode_residenceId_idx" ON "InvitationCode"("residenceId");

-- CreateIndex
CREATE INDEX "InvitationCode_lotId_idx" ON "InvitationCode"("lotId");

-- CreateIndex
CREATE INDEX "AuditLog_residenceId_idx" ON "AuditLog"("residenceId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mandate" ADD CONSTRAINT "Mandate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mandate" ADD CONSTRAINT "Mandate_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotAttachment" ADD CONSTRAINT "LotAttachment_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotAttachment" ADD CONSTRAINT "LotAttachment_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotAttachment" ADD CONSTRAINT "LotAttachment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeCall" ADD CONSTRAINT "ChargeCall_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeCall" ADD CONSTRAINT "ChargeCall_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_payerPersonId_fkey" FOREIGN KEY ("payerPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedByPersonId_fkey" FOREIGN KEY ("recordedByPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reversesPaymentId_fkey" FOREIGN KEY ("reversesPaymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_chargeCallId_fkey" FOREIGN KEY ("chargeCallId") REFERENCES "ChargeCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NumberSequence" ADD CONSTRAINT "NumberSequence_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementAccount" ADD CONSTRAINT "SettlementAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementAccount" ADD CONSTRAINT "SettlementAccount_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_justificatifId_fkey" FOREIGN KEY ("justificatifId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierContract" ADD CONSTRAINT "SupplierContract_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentUpdate" ADD CONSTRAINT "IncidentUpdate_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentUpdate" ADD CONSTRAINT "IncidentUpdate_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_voteId_fkey" FOREIGN KEY ("voteId") REFERENCES "Vote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteOption" ADD CONSTRAINT "VoteOption_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteOption" ADD CONSTRAINT "VoteOption_voteId_fkey" FOREIGN KEY ("voteId") REFERENCES "Vote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ballot" ADD CONSTRAINT "Ballot_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ballot" ADD CONSTRAINT "Ballot_voteId_fkey" FOREIGN KEY ("voteId") REFERENCES "Vote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ballot" ADD CONSTRAINT "Ballot_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ballot" ADD CONSTRAINT "Ballot_voteOptionId_fkey" FOREIGN KEY ("voteOptionId") REFERENCES "VoteOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ballot" ADD CONSTRAINT "Ballot_castByPersonId_fkey" FOREIGN KEY ("castByPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderRule" ADD CONSTRAINT "ReminderRule_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_reminderRuleId_fkey" FOREIGN KEY ("reminderRuleId") REFERENCES "ReminderRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_chargeCallId_fkey" FOREIGN KEY ("chargeCallId") REFERENCES "ChargeCall"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationCode" ADD CONSTRAINT "InvitationCode_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationCode" ADD CONSTRAINT "InvitationCode_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationCode" ADD CONSTRAINT "InvitationCode_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Invariants ajoutés manuellement (non exprimables dans le schéma Prisma)
-- ============================================================================

-- Un seul rattachement ACTIF par (lot, rôle) : un propriétaire actif ET un
-- locataire actif au plus, par lot. (endDate IS NULL = actif)
CREATE UNIQUE INDEX "uniq_active_attachment_per_lot_role"
  ON "LotAttachment" ("lotId", "role")
  WHERE "endDate" IS NULL;

-- Un seul redevable des charges ACTIF par lot.
CREATE UNIQUE INDEX "uniq_active_charge_payer_per_lot"
  ON "LotAttachment" ("lotId")
  WHERE "isChargePayer" = true AND "endDate" IS NULL;

-- Une seule résidence ne peut avoir qu'UN mandat ACTIF à la fois (historique conservé).
CREATE UNIQUE INDEX "uniq_active_mandate_per_residence"
  ON "Mandate" ("residenceId")
  WHERE "status" = 'ACTIVE';

-- Argent : montants cohérents (centimes).
ALTER TABLE "Payment"           ADD CONSTRAINT "payment_amount_nonzero"  CHECK ("amountMinor" <> 0);
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "alloc_amount_nonzero"    CHECK ("amountMinor" <> 0);
ALTER TABLE "ChargeCall"        ADD CONSTRAINT "chargecall_amount_nonneg" CHECK ("amountMinor" >= 0);
ALTER TABLE "ChargeCall"        ADD CONSTRAINT "chargecall_month_valid"  CHECK ("periodMonth" BETWEEN 1 AND 12);
ALTER TABLE "Expense"           ADD CONSTRAINT "expense_amount_nonneg"   CHECK ("amountMinor" >= 0);
ALTER TABLE "Lot"               ADD CONSTRAINT "lot_quotepart_nonneg"    CHECK ("quotePart" >= 0);
ALTER TABLE "Lot"               ADD CONSTRAINT "lot_charge_nonneg"       CHECK ("monthlyChargeMinor" >= 0);
ALTER TABLE "Receipt"           ADD CONSTRAINT "receipt_sequence_pos"    CHECK ("sequence" >= 1);

-- Un compte de règlement est rattaché à EXACTEMENT une organisation OU une résidence.
ALTER TABLE "SettlementAccount" ADD CONSTRAINT "settlement_owner_xor"
  CHECK (("organizationId" IS NOT NULL) <> ("residenceId" IS NOT NULL));
