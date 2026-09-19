-- CreateTable
CREATE TABLE "compatibility_experiments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "policyName" TEXT NOT NULL DEFAULT 'statistical-default',
    "baselineSubmissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compatibility_experiments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compatibility_runs" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "submissionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "compatibility_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "compatibility_experiments_userId_createdAt_idx" ON "compatibility_experiments"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "compatibility_experiments_problemId_idx" ON "compatibility_experiments"("problemId");

-- CreateIndex
CREATE INDEX "compatibility_runs_experimentId_createdAt_idx" ON "compatibility_runs"("experimentId", "createdAt");

-- CreateIndex
CREATE INDEX "compatibility_runs_environmentId_idx" ON "compatibility_runs"("environmentId");

-- AddForeignKey
ALTER TABLE "compatibility_experiments" ADD CONSTRAINT "compatibility_experiments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compatibility_experiments" ADD CONSTRAINT "compatibility_experiments_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compatibility_runs" ADD CONSTRAINT "compatibility_runs_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "compatibility_experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
