-- CreateTable
CREATE TABLE "semantic_baselines" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "policyName" TEXT NOT NULL DEFAULT 'statistical-default',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "semantic_baselines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semantic_comparisons" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recordAId" TEXT NOT NULL,
    "recordBId" TEXT NOT NULL,
    "policyName" TEXT NOT NULL,
    "overallStatus" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "semantic_comparisons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semantic_reproductions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originalSubmissionId" TEXT NOT NULL,
    "reproductionSubmissionId" TEXT NOT NULL,
    "policyName" TEXT NOT NULL,
    "overallStatus" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "semantic_reproductions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "semantic_baselines_problemId_idx" ON "semantic_baselines"("problemId");

-- CreateIndex
CREATE INDEX "semantic_baselines_submissionId_idx" ON "semantic_baselines"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "semantic_baselines_userId_problemId_key" ON "semantic_baselines"("userId", "problemId");

-- CreateIndex
CREATE INDEX "semantic_comparisons_userId_createdAt_idx" ON "semantic_comparisons"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "semantic_comparisons_recordAId_idx" ON "semantic_comparisons"("recordAId");

-- CreateIndex
CREATE INDEX "semantic_comparisons_recordBId_idx" ON "semantic_comparisons"("recordBId");

-- CreateIndex
CREATE INDEX "semantic_reproductions_userId_createdAt_idx" ON "semantic_reproductions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "semantic_reproductions_originalSubmissionId_idx" ON "semantic_reproductions"("originalSubmissionId");

-- AddForeignKey
ALTER TABLE "semantic_baselines" ADD CONSTRAINT "semantic_baselines_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semantic_baselines" ADD CONSTRAINT "semantic_baselines_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semantic_baselines" ADD CONSTRAINT "semantic_baselines_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semantic_comparisons" ADD CONSTRAINT "semantic_comparisons_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semantic_reproductions" ADD CONSTRAINT "semantic_reproductions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
