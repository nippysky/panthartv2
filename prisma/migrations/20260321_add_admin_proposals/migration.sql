-- CreateEnum
CREATE TYPE "AdminProposalArea" AS ENUM ('WARPOOL');

-- CreateEnum
CREATE TYPE "AdminProposalKind" AS ENUM ('CONFIG', 'RECOVERY');

-- CreateEnum
CREATE TYPE "AdminProposalStatus" AS ENUM ('DRAFT', 'READY', 'SUBMITTED', 'APPROVED', 'EXECUTED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "AdminProposalActionStatus" AS ENUM ('PENDING', 'SUBMITTED', 'EXECUTED', 'FAILED');

-- CreateTable
CREATE TABLE "AdminProposal" (
    "id" TEXT NOT NULL,
    "area" "AdminProposalArea" NOT NULL,
    "kind" "AdminProposalKind" NOT NULL,
    "title" TEXT NOT NULL,
    "slug" CITEXT,
    "summary" TEXT,
    "description" TEXT,
    "safeId" TEXT,
    "safeContract" CITEXT,
    "chainId" INTEGER,
    "createdByUserId" TEXT,
    "createdByAddress" CITEXT,
    "lastEditedByUserId" TEXT,
    "lastEditedByAddress" CITEXT,
    "basedOnConfigVersion" BIGINT,
    "runtimeReferenceId" TEXT,
    "status" "AdminProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "actionCount" INTEGER NOT NULL DEFAULT 0,
    "submittedMultisigTxId" TEXT,
    "submittedMultisigNonce" INTEGER,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "snapshotJson" JSONB,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminProposalAction" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "label" TEXT,
    "summary" TEXT,
    "target" CITEXT NOT NULL,
    "valueWei" DECIMAL(78,0) NOT NULL DEFAULT 0,
    "tokenAddress" CITEXT,
    "dataHex" TEXT NOT NULL,
    "functionName" TEXT,
    "argsJson" JSONB,
    "status" "AdminProposalActionStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminProposalAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminProposalEvent" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorAddress" CITEXT,
    "type" TEXT NOT NULL,
    "note" TEXT,
    "payloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminProposalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminProposal_area_kind_status_createdAt_idx" ON "AdminProposal"("area", "kind", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AdminProposal_safeContract_status_createdAt_idx" ON "AdminProposal"("safeContract", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AdminProposal_createdByAddress_createdAt_idx" ON "AdminProposal"("createdByAddress", "createdAt");

-- CreateIndex
CREATE INDEX "AdminProposal_submittedMultisigNonce_idx" ON "AdminProposal"("submittedMultisigNonce");

-- CreateIndex
CREATE INDEX "AdminProposalAction_proposalId_status_orderIndex_idx" ON "AdminProposalAction"("proposalId", "status", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "uq_admin_proposal_action_order" ON "AdminProposalAction"("proposalId", "orderIndex");

-- CreateIndex
CREATE INDEX "AdminProposalEvent_proposalId_createdAt_idx" ON "AdminProposalEvent"("proposalId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminProposalEvent_actorAddress_createdAt_idx" ON "AdminProposalEvent"("actorAddress", "createdAt");

-- AddForeignKey
ALTER TABLE "AdminProposal" ADD CONSTRAINT "AdminProposal_safeId_fkey" FOREIGN KEY ("safeId") REFERENCES "MultisigSafe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminProposal" ADD CONSTRAINT "AdminProposal_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminProposal" ADD CONSTRAINT "AdminProposal_lastEditedByUserId_fkey" FOREIGN KEY ("lastEditedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminProposal" ADD CONSTRAINT "AdminProposal_submittedMultisigTxId_fkey" FOREIGN KEY ("submittedMultisigTxId") REFERENCES "MultisigTx"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminProposalAction" ADD CONSTRAINT "AdminProposalAction_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "AdminProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminProposalEvent" ADD CONSTRAINT "AdminProposalEvent_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "AdminProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminProposalEvent" ADD CONSTRAINT "AdminProposalEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

