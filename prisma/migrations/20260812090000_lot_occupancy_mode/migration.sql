-- CreateEnum
CREATE TYPE "OccupancyMode" AS ENUM ('OWNER_OCCUPIED', 'RENTED', 'VACANT');

-- AlterTable
ALTER TABLE "Lot" ADD COLUMN     "occupancyMode" "OccupancyMode" NOT NULL DEFAULT 'VACANT';

