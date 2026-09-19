-- AlterTable
ALTER TABLE "compatibility_experiments" ADD COLUMN     "report" JSONB,
ADD COLUMN     "seed" INTEGER,
ADD COLUMN     "shots" INTEGER,
ALTER COLUMN "baselineSubmissionId" DROP NOT NULL;
