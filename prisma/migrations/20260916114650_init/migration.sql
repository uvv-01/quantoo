-- CreateEnum
CREATE TYPE "ProblemDifficulty" AS ENUM ('BEGINNER', 'EASY', 'MEDIUM', 'HARD', 'EXPERT');

-- CreateEnum
CREATE TYPE "ProblemStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProgressStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'ATTEMPTED', 'SOLVED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('PROBLEM_ATTEMPT', 'PROBLEM_SOLVED', 'PROBLEM_VIEWED', 'PROJECT_CREATED', 'PROJECT_UPDATED', 'DAILY_CHALLENGE_ATTEMPT', 'LEARNING_TOPIC_STARTED', 'LEARNING_TOPIC_COMPLETED');

-- CreateEnum
CREATE TYPE "TestSpecType" AS ENUM ('STRUCTURAL', 'FUNCTIONAL', 'STATE', 'DISTRIBUTION', 'UNITARY', 'OBSERVABLE', 'ENTANGLEMENT', 'STATISTICAL', 'RESOURCE');

-- CreateEnum
CREATE TYPE "ProblemRelationType" AS ENUM ('PREREQUISITE', 'RELATED', 'NEXT', 'SAME_CONCEPT');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'TIMED_OUT', 'RESOURCE_LIMIT');

-- CreateEnum
CREATE TYPE "SecurityEventType" AS ENUM ('SIGNUP_SUCCESS', 'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGOUT', 'EMAIL_VERIFIED', 'VERIFICATION_REQUESTED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_SUCCESS', 'PASSWORD_CHANGED', 'SESSION_REVOKED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "passwordHash" TEXT NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" "SecurityEventType" NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT,
    "displayName" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concepts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "concepts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_topics" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_topic_concepts" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "learning_topic_concepts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_topic_problems" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "learning_topic_problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problems" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "difficulty" "ProblemDifficulty" NOT NULL,
    "status" "ProblemStatus" NOT NULL DEFAULT 'DRAFT',
    "estimatedMinutes" INTEGER,
    "prerequisites" TEXT,
    "learningObjectives" TEXT,
    "hints" JSONB,
    "solutionExplanation" JSONB,
    "testSpecification" JSONB,
    "requirements" JSONB,
    "expectedOutcome" JSONB,
    "starterCode" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problem_tags" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "problem_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problem_concepts" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,

    CONSTRAINT "problem_concepts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problem_relations" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "type" "ProblemRelationType" NOT NULL,

    CONSTRAINT "problem_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problem_versions" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "changelog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "problem_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "sourceCode" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'python',
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "passed" BOOLEAN,
    "judgeResult" JSONB,
    "executionResult" JSONB,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problem_drafts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "sourceCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "problem_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_problem_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "status" "ProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "bestTimeMs" INTEGER,
    "lastAttemptAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_problem_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_learning_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "status" "ProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "progressPct" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_learning_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_activities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "problemId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_challenges" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "problemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_challenge_submissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "solved" BOOLEAN NOT NULL DEFAULT false,
    "solveTime" INTEGER,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_challenge_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_tokenHash_idx" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_tokenHash_key" ON "email_verification_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "email_verification_tokens_userId_idx" ON "email_verification_tokens"("userId");

-- CreateIndex
CREATE INDEX "email_verification_tokens_tokenHash_idx" ON "email_verification_tokens"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE INDEX "password_reset_tokens_tokenHash_idx" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "security_events_userId_createdAt_idx" ON "security_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "security_events_type_idx" ON "security_events"("type");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_userId_key" ON "profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_username_key" ON "profiles"("username");

-- CreateIndex
CREATE UNIQUE INDEX "concepts_name_key" ON "concepts"("name");

-- CreateIndex
CREATE UNIQUE INDEX "concepts_slug_key" ON "concepts"("slug");

-- CreateIndex
CREATE INDEX "concepts_category_idx" ON "concepts"("category");

-- CreateIndex
CREATE INDEX "concepts_slug_idx" ON "concepts"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE INDEX "tags_slug_idx" ON "tags"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "learning_topics_slug_key" ON "learning_topics"("slug");

-- CreateIndex
CREATE INDEX "learning_topics_slug_idx" ON "learning_topics"("slug");

-- CreateIndex
CREATE INDEX "learning_topics_category_sortOrder_idx" ON "learning_topics"("category", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "learning_topic_concepts_topicId_conceptId_key" ON "learning_topic_concepts"("topicId", "conceptId");

-- CreateIndex
CREATE UNIQUE INDEX "learning_topic_problems_topicId_problemId_key" ON "learning_topic_problems"("topicId", "problemId");

-- CreateIndex
CREATE UNIQUE INDEX "problems_slug_key" ON "problems"("slug");

-- CreateIndex
CREATE INDEX "problems_difficulty_idx" ON "problems"("difficulty");

-- CreateIndex
CREATE INDEX "problems_status_idx" ON "problems"("status");

-- CreateIndex
CREATE INDEX "problems_status_difficulty_idx" ON "problems"("status", "difficulty");

-- CreateIndex
CREATE INDEX "problems_publishedAt_idx" ON "problems"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "problem_tags_problemId_tagId_key" ON "problem_tags"("problemId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "problem_concepts_problemId_conceptId_key" ON "problem_concepts"("problemId", "conceptId");

-- CreateIndex
CREATE INDEX "problem_relations_fromId_idx" ON "problem_relations"("fromId");

-- CreateIndex
CREATE INDEX "problem_relations_toId_idx" ON "problem_relations"("toId");

-- CreateIndex
CREATE UNIQUE INDEX "problem_relations_fromId_toId_type_key" ON "problem_relations"("fromId", "toId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "problem_versions_problemId_version_key" ON "problem_versions"("problemId", "version");

-- CreateIndex
CREATE INDEX "submissions_userId_createdAt_idx" ON "submissions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "submissions_problemId_createdAt_idx" ON "submissions"("problemId", "createdAt");

-- CreateIndex
CREATE INDEX "submissions_userId_problemId_createdAt_idx" ON "submissions"("userId", "problemId", "createdAt");

-- CreateIndex
CREATE INDEX "submissions_status_idx" ON "submissions"("status");

-- CreateIndex
CREATE INDEX "problem_drafts_userId_updatedAt_idx" ON "problem_drafts"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "problem_drafts_userId_problemId_key" ON "problem_drafts"("userId", "problemId");

-- CreateIndex
CREATE INDEX "user_problem_progress_userId_status_idx" ON "user_problem_progress"("userId", "status");

-- CreateIndex
CREATE INDEX "user_problem_progress_problemId_status_idx" ON "user_problem_progress"("problemId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "user_problem_progress_userId_problemId_key" ON "user_problem_progress"("userId", "problemId");

-- CreateIndex
CREATE INDEX "user_learning_progress_userId_idx" ON "user_learning_progress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_learning_progress_userId_topicId_key" ON "user_learning_progress"("userId", "topicId");

-- CreateIndex
CREATE INDEX "user_activities_userId_createdAt_idx" ON "user_activities"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "user_activities_problemId_idx" ON "user_activities"("problemId");

-- CreateIndex
CREATE UNIQUE INDEX "daily_challenges_date_key" ON "daily_challenges"("date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_challenge_submissions_userId_challengeId_key" ON "daily_challenge_submissions"("userId", "challengeId");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_topic_concepts" ADD CONSTRAINT "learning_topic_concepts_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "learning_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_topic_concepts" ADD CONSTRAINT "learning_topic_concepts_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "concepts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_topic_problems" ADD CONSTRAINT "learning_topic_problems_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "learning_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_topic_problems" ADD CONSTRAINT "learning_topic_problems_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_tags" ADD CONSTRAINT "problem_tags_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_tags" ADD CONSTRAINT "problem_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_concepts" ADD CONSTRAINT "problem_concepts_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_concepts" ADD CONSTRAINT "problem_concepts_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "concepts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_relations" ADD CONSTRAINT "problem_relations_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_relations" ADD CONSTRAINT "problem_relations_toId_fkey" FOREIGN KEY ("toId") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_versions" ADD CONSTRAINT "problem_versions_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_drafts" ADD CONSTRAINT "problem_drafts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_drafts" ADD CONSTRAINT "problem_drafts_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_problem_progress" ADD CONSTRAINT "user_problem_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_problem_progress" ADD CONSTRAINT "user_problem_progress_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_learning_progress" ADD CONSTRAINT "user_learning_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_learning_progress" ADD CONSTRAINT "user_learning_progress_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "learning_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_activities" ADD CONSTRAINT "user_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_activities" ADD CONSTRAINT "user_activities_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_challenge_submissions" ADD CONSTRAINT "daily_challenge_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_challenge_submissions" ADD CONSTRAINT "daily_challenge_submissions_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "daily_challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
