-- CreateEnum
CREATE TYPE "WarpoolContractKind" AS ENUM ('CONFIG', 'CORE', 'LENS');

-- CreateEnum
CREATE TYPE "WarpoolQueueSlug" AS ENUM ('FORGE_SAFEGUARD', 'LEGION_SAFEGUARD', 'LEGION_VAULTBOUND', 'CROWN_VAULTBOUND');

-- CreateEnum
CREATE TYPE "WarpoolPoolStatus" AS ENUM ('OPEN', 'LOCKED', 'BATTLE_READY', 'SETTLING', 'SETTLED', 'CLOSED', 'EXPIRED_REFUNDED');

-- CreateEnum
CREATE TYPE "WarpoolEntryStatus" AS ENUM ('JOINED', 'REFUNDED', 'SELECTED', 'SETTLED', 'CAPTURED', 'RETURNED');

-- CreateEnum
CREATE TYPE "WarpoolReservationStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WarpoolRelicType" AS ENUM ('NONE', 'DISCOUNT', 'GOD');

-- CreateEnum
CREATE TYPE "WarpoolActivityType" AS ENUM ('POOL_OPENED', 'POOL_LOCKED', 'POOL_BATTLE_READY', 'POOL_SETTLED', 'POOL_REOPENED', 'POOL_EXPIRED_REFUNDED', 'RESERVATION_CREATED', 'RESERVATION_CONSUMED', 'RESERVATION_EXPIRED', 'ENTRY_JOINED', 'ENTRY_SELECTED', 'ENTRY_REFUNDED', 'ENTRY_CAPTURED', 'ENTRY_RETURNED', 'PRIZE_PAID', 'RELIC_RETURNED');

-- CreateEnum
CREATE TYPE "WarpoolCaptureStatus" AS ENUM ('HELD', 'QUEUED_FOR_RELIST', 'RELISTED', 'RELEASED');

-- CreateEnum
CREATE TYPE "WarpoolRelistStatus" AS ENUM ('NONE', 'QUEUED', 'LISTED', 'SOLD', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "WarpoolBattleStatus" AS ENUM ('PENDING', 'COMPUTED', 'SUBMITTED', 'SETTLED', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PendingChainActionType" ADD VALUE 'WARPOOL_RESERVATION_EXPIRE';
ALTER TYPE "PendingChainActionType" ADD VALUE 'WARPOOL_POOL_PROCESS_EXPIRED';
ALTER TYPE "PendingChainActionType" ADD VALUE 'WARPOOL_POOL_MARK_BATTLE_READY';
ALTER TYPE "PendingChainActionType" ADD VALUE 'WARPOOL_POOL_SETTLE';
ALTER TYPE "PendingChainActionType" ADD VALUE 'WARPOOL_CAPTURE_RELIST';

-- CreateTable
CREATE TABLE "WarpoolContract" (
    "id" TEXT NOT NULL,
    "kind" "WarpoolContractKind" NOT NULL,
    "address" CITEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "label" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarpoolContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarpoolQueueConfig" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "queueKey" CITEXT NOT NULL,
    "slug" "WarpoolQueueSlug" NOT NULL,
    "tier" INTEGER NOT NULL,
    "mode" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "singleEntryPerWallet" BOOLEAN NOT NULL DEFAULT true,
    "targetSize" INTEGER NOT NULL,
    "minStartSize" INTEGER NOT NULL,
    "openDurationSeconds" INTEGER NOT NULL,
    "stakeAmountRaw" DECIMAL(78,0) NOT NULL,
    "platformFeeBps" INTEGER NOT NULL,
    "firstPlaceBps" INTEGER NOT NULL,
    "secondPlaceBps" INTEGER NOT NULL,
    "thirdPlaceBps" INTEGER NOT NULL,
    "configVersion" BIGINT NOT NULL,
    "sourceContract" CITEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarpoolQueueConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarpoolGlobalConfigSnapshot" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "configContract" CITEXT NOT NULL,
    "configVersion" BIGINT NOT NULL,
    "comradesCollection" CITEXT,
    "relicsCollection" CITEXT,
    "dcntToken" CITEXT,
    "treasury" CITEXT,
    "workerOperator" CITEXT,
    "entriesPaused" BOOLEAN NOT NULL DEFAULT false,
    "reservationsPaused" BOOLEAN NOT NULL DEFAULT false,
    "settlementsPaused" BOOLEAN NOT NULL DEFAULT false,
    "relicsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "fatigueEnabled" BOOLEAN NOT NULL DEFAULT true,
    "token11FeeShareEnabled" BOOLEAN NOT NULL DEFAULT true,
    "token11FeeShareBps" INTEGER NOT NULL DEFAULT 0,
    "relicMinDiscountBps" INTEGER,
    "relicMaxDiscountBps" INTEGER,
    "discountSeatCap" INTEGER,
    "token11SeatCap" INTEGER,
    "reservationTtlSeconds" INTEGER,
    "fatigueMaxConsecutive" INTEGER,
    "fatigueCooldownSeconds" INTEGER,
    "roundsPerMatch" INTEGER,
    "traitPowerMin" INTEGER,
    "traitPowerMax" INTEGER,
    "roundVarianceMax" INTEGER,
    "microMomentumMax" INTEGER,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarpoolGlobalConfigSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarpoolPool" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "coreContract" CITEXT NOT NULL,
    "poolIdOnChain" BIGINT NOT NULL,
    "queueKey" CITEXT NOT NULL,
    "queueSlug" "WarpoolQueueSlug",
    "configVersion" BIGINT NOT NULL,
    "state" "WarpoolPoolStatus" NOT NULL,
    "tier" INTEGER NOT NULL,
    "mode" INTEGER NOT NULL,
    "singleEntryPerWallet" BOOLEAN NOT NULL,
    "targetSize" INTEGER NOT NULL,
    "minStartSize" INTEGER NOT NULL,
    "entrantCount" INTEGER NOT NULL DEFAULT 0,
    "runnableSize" INTEGER NOT NULL DEFAULT 0,
    "stakeAmountRaw" DECIMAL(78,0) NOT NULL,
    "platformFeeBps" INTEGER NOT NULL,
    "firstPlaceBps" INTEGER NOT NULL,
    "secondPlaceBps" INTEGER NOT NULL,
    "thirdPlaceBps" INTEGER NOT NULL,
    "relicMinDiscountBps" INTEGER,
    "relicMaxDiscountBps" INTEGER,
    "discountSeatCap" INTEGER NOT NULL DEFAULT 0,
    "token11SeatCap" INTEGER NOT NULL DEFAULT 0,
    "token11FeeShareBps" INTEGER NOT NULL DEFAULT 0,
    "discountSeatsUsed" INTEGER NOT NULL DEFAULT 0,
    "discountSeatsReserved" INTEGER NOT NULL DEFAULT 0,
    "token11SeatsUsed" INTEGER NOT NULL DEFAULT 0,
    "comradesCollection" CITEXT NOT NULL,
    "relicsCollection" CITEXT,
    "dcntToken" CITEXT NOT NULL,
    "treasury" CITEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lockedAt" TIMESTAMP(3),
    "battleReadyAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "expiredRefundedAt" TIMESTAMP(3),
    "seedBlockNumber" INTEGER,
    "openTxHash" TEXT,
    "lockTxHash" TEXT,
    "settleTxHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarpoolPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarpoolEntry" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "coreContract" CITEXT NOT NULL,
    "entryIdOnChain" BIGINT NOT NULL,
    "poolId" TEXT NOT NULL,
    "userId" TEXT,
    "userAddress" CITEXT NOT NULL,
    "nftId" TEXT,
    "comradeContract" CITEXT NOT NULL,
    "comradeTokenId" TEXT NOT NULL,
    "relicContract" CITEXT,
    "relicTokenId" TEXT,
    "relicType" "WarpoolRelicType" NOT NULL DEFAULT 'NONE',
    "status" "WarpoolEntryStatus" NOT NULL,
    "placement" INTEGER,
    "selectedForBattle" BOOLEAN NOT NULL DEFAULT false,
    "relicDiscountBps" INTEGER,
    "baseStakeAmountRaw" DECIMAL(78,0) NOT NULL,
    "paidStakeAmountRaw" DECIMAL(78,0) NOT NULL,
    "refundedStakeAmountRaw" DECIMAL(78,0),
    "prizeAmountRaw" DECIMAL(78,0),
    "joinedAt" TIMESTAMP(3) NOT NULL,
    "joinedTxHash" TEXT,
    "reservationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarpoolEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarpoolReservation" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "coreContract" CITEXT NOT NULL,
    "reservationIdOnChain" BIGINT NOT NULL,
    "poolId" TEXT NOT NULL,
    "userId" TEXT,
    "userAddress" CITEXT NOT NULL,
    "nftId" TEXT,
    "comradeContract" CITEXT NOT NULL,
    "comradeTokenId" TEXT NOT NULL,
    "relicContract" CITEXT NOT NULL,
    "relicTokenId" TEXT NOT NULL,
    "status" "WarpoolReservationStatus" NOT NULL,
    "discountBps" INTEGER,
    "createdAtOnChain" TIMESTAMP(3) NOT NULL,
    "expiresAtOnChain" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "createdTxHash" TEXT,
    "resolvedTxHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarpoolReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarpoolBattle" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "status" "WarpoolBattleStatus" NOT NULL DEFAULT 'PENDING',
    "bracketSeed" CITEXT,
    "firstEntryId" TEXT,
    "secondEntryId" TEXT,
    "thirdEntryId" TEXT,
    "totalStakeRaw" DECIMAL(78,0),
    "prizePoolRaw" DECIMAL(78,0),
    "platformFeeRaw" DECIMAL(78,0),
    "computedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "settlementTxHash" TEXT,
    "rawOutcome" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarpoolBattle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarpoolBattleMatch" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "matchNumber" INTEGER NOT NULL,
    "slotAEntryId" TEXT,
    "slotBEntryId" TEXT,
    "winnerEntryId" TEXT,
    "loserEntryId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rawResult" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarpoolBattleMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarpoolCapture" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "nftId" TEXT,
    "contract" CITEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "originalOwnerId" TEXT,
    "originalOwnerAddress" CITEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "status" "WarpoolCaptureStatus" NOT NULL DEFAULT 'HELD',
    "relistStatus" "WarpoolRelistStatus" NOT NULL DEFAULT 'NONE',
    "relistListingId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarpoolCapture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarpoolActivity" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "coreContract" CITEXT NOT NULL,
    "poolId" TEXT,
    "entryId" TEXT,
    "reservationId" TEXT,
    "userId" TEXT,
    "userAddress" CITEXT,
    "nftId" TEXT,
    "type" "WarpoolActivityType" NOT NULL,
    "txHash" CITEXT,
    "logIndex" INTEGER,
    "blockNumber" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarpoolActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WarpoolContract_address_key" ON "WarpoolContract"("address");

-- CreateIndex
CREATE INDEX "WarpoolContract_active_kind_idx" ON "WarpoolContract"("active", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "uq_warpool_contract_chain_kind" ON "WarpoolContract"("chainId", "kind");

-- CreateIndex
CREATE INDEX "WarpoolQueueConfig_chainId_slug_syncedAt_idx" ON "WarpoolQueueConfig"("chainId", "slug", "syncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "uq_warpool_queue_version" ON "WarpoolQueueConfig"("chainId", "queueKey", "configVersion");

-- CreateIndex
CREATE UNIQUE INDEX "uq_warpool_slug_version" ON "WarpoolQueueConfig"("chainId", "slug", "configVersion");

-- CreateIndex
CREATE INDEX "WarpoolGlobalConfigSnapshot_chainId_syncedAt_idx" ON "WarpoolGlobalConfigSnapshot"("chainId", "syncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "uq_warpool_global_config_version" ON "WarpoolGlobalConfigSnapshot"("chainId", "configContract", "configVersion");

-- CreateIndex
CREATE INDEX "WarpoolPool_queueKey_state_idx" ON "WarpoolPool"("queueKey", "state");

-- CreateIndex
CREATE INDEX "WarpoolPool_queueSlug_state_expiresAt_idx" ON "WarpoolPool"("queueSlug", "state", "expiresAt");

-- CreateIndex
CREATE INDEX "WarpoolPool_state_expiresAt_idx" ON "WarpoolPool"("state", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "uq_warpool_pool_chain" ON "WarpoolPool"("chainId", "coreContract", "poolIdOnChain");

-- CreateIndex
CREATE UNIQUE INDEX "WarpoolEntry_reservationId_key" ON "WarpoolEntry"("reservationId");

-- CreateIndex
CREATE INDEX "WarpoolEntry_poolId_status_idx" ON "WarpoolEntry"("poolId", "status");

-- CreateIndex
CREATE INDEX "WarpoolEntry_userAddress_joinedAt_idx" ON "WarpoolEntry"("userAddress", "joinedAt");

-- CreateIndex
CREATE INDEX "WarpoolEntry_comradeContract_comradeTokenId_idx" ON "WarpoolEntry"("comradeContract", "comradeTokenId");

-- CreateIndex
CREATE INDEX "WarpoolEntry_nftId_idx" ON "WarpoolEntry"("nftId");

-- CreateIndex
CREATE UNIQUE INDEX "uq_warpool_entry_chain" ON "WarpoolEntry"("chainId", "coreContract", "entryIdOnChain");

-- CreateIndex
CREATE INDEX "WarpoolReservation_poolId_status_expiresAtOnChain_idx" ON "WarpoolReservation"("poolId", "status", "expiresAtOnChain");

-- CreateIndex
CREATE INDEX "WarpoolReservation_userAddress_status_idx" ON "WarpoolReservation"("userAddress", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_warpool_reservation_chain" ON "WarpoolReservation"("chainId", "coreContract", "reservationIdOnChain");

-- CreateIndex
CREATE UNIQUE INDEX "WarpoolBattle_poolId_key" ON "WarpoolBattle"("poolId");

-- CreateIndex
CREATE INDEX "WarpoolBattle_status_updatedAt_idx" ON "WarpoolBattle"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "WarpoolBattleMatch_battleId_roundNumber_idx" ON "WarpoolBattleMatch"("battleId", "roundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "uq_warpool_match_round_number" ON "WarpoolBattleMatch"("battleId", "roundNumber", "matchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WarpoolCapture_entryId_key" ON "WarpoolCapture"("entryId");

-- CreateIndex
CREATE INDEX "WarpoolCapture_status_relistStatus_idx" ON "WarpoolCapture"("status", "relistStatus");

-- CreateIndex
CREATE INDEX "WarpoolCapture_contract_tokenId_idx" ON "WarpoolCapture"("contract", "tokenId");

-- CreateIndex
CREATE UNIQUE INDEX "uq_warpool_capture_asset_time" ON "WarpoolCapture"("contract", "tokenId", "capturedAt");

-- CreateIndex
CREATE INDEX "WarpoolActivity_poolId_timestamp_idx" ON "WarpoolActivity"("poolId", "timestamp");

-- CreateIndex
CREATE INDEX "WarpoolActivity_userAddress_timestamp_idx" ON "WarpoolActivity"("userAddress", "timestamp");

-- CreateIndex
CREATE INDEX "WarpoolActivity_type_timestamp_idx" ON "WarpoolActivity"("type", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "uq_warpool_activity_log" ON "WarpoolActivity"("txHash", "logIndex");

-- AddForeignKey
ALTER TABLE "WarpoolEntry" ADD CONSTRAINT "WarpoolEntry_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "WarpoolPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarpoolEntry" ADD CONSTRAINT "WarpoolEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarpoolEntry" ADD CONSTRAINT "WarpoolEntry_nftId_fkey" FOREIGN KEY ("nftId") REFERENCES "NFT"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarpoolEntry" ADD CONSTRAINT "WarpoolEntry_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "WarpoolReservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarpoolReservation" ADD CONSTRAINT "WarpoolReservation_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "WarpoolPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarpoolReservation" ADD CONSTRAINT "WarpoolReservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarpoolReservation" ADD CONSTRAINT "WarpoolReservation_nftId_fkey" FOREIGN KEY ("nftId") REFERENCES "NFT"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarpoolBattle" ADD CONSTRAINT "WarpoolBattle_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "WarpoolPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarpoolBattleMatch" ADD CONSTRAINT "WarpoolBattleMatch_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "WarpoolBattle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarpoolCapture" ADD CONSTRAINT "WarpoolCapture_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "WarpoolEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarpoolCapture" ADD CONSTRAINT "WarpoolCapture_nftId_fkey" FOREIGN KEY ("nftId") REFERENCES "NFT"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarpoolCapture" ADD CONSTRAINT "WarpoolCapture_originalOwnerId_fkey" FOREIGN KEY ("originalOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarpoolCapture" ADD CONSTRAINT "WarpoolCapture_relistListingId_fkey" FOREIGN KEY ("relistListingId") REFERENCES "MarketplaceListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarpoolActivity" ADD CONSTRAINT "WarpoolActivity_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "WarpoolPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarpoolActivity" ADD CONSTRAINT "WarpoolActivity_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "WarpoolEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarpoolActivity" ADD CONSTRAINT "WarpoolActivity_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "WarpoolReservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarpoolActivity" ADD CONSTRAINT "WarpoolActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarpoolActivity" ADD CONSTRAINT "WarpoolActivity_nftId_fkey" FOREIGN KEY ("nftId") REFERENCES "NFT"("id") ON DELETE SET NULL ON UPDATE CASCADE;
