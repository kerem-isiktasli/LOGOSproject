-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nativeLanguage" TEXT NOT NULL,
    "targetLanguage" TEXT NOT NULL,
    "thetaGlobal" REAL NOT NULL DEFAULT 0,
    "thetaPhonology" REAL NOT NULL DEFAULT 0,
    "thetaMorphology" REAL NOT NULL DEFAULT 0,
    "thetaLexical" REAL NOT NULL DEFAULT 0,
    "thetaSyntactic" REAL NOT NULL DEFAULT 0,
    "thetaPragmatic" REAL NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "GoalSpec" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "domain" TEXT NOT NULL,
    "modality" TEXT NOT NULL,
    "genre" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "benchmark" TEXT,
    "deadline" DATETIME,
    "completionPercent" REAL NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,
    CONSTRAINT "GoalSpec_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LanguageObject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentJson" TEXT,
    "frequency" REAL NOT NULL,
    "relationalDensity" REAL NOT NULL,
    "contextualContribution" REAL NOT NULL,
    "domainDistribution" TEXT,
    "morphologicalScore" REAL,
    "phonologicalDifficulty" REAL,
    "pragmaticScore" REAL,
    "syntacticComplexity" REAL,
    "priority" REAL NOT NULL DEFAULT 0,
    "irtDifficulty" REAL NOT NULL DEFAULT 0,
    "irtDiscrimination" REAL NOT NULL DEFAULT 1,
    "irtGuessing" REAL NOT NULL DEFAULT 0.25,
    "goalId" TEXT NOT NULL,
    CONSTRAINT "LanguageObject_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "GoalSpec" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Collocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "word1Id" TEXT NOT NULL,
    "word2Id" TEXT NOT NULL,
    "pmi" REAL NOT NULL,
    "npmi" REAL NOT NULL,
    "cooccurrence" INTEGER NOT NULL,
    "significance" REAL NOT NULL,
    CONSTRAINT "Collocation_word1Id_fkey" FOREIGN KEY ("word1Id") REFERENCES "LanguageObject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Collocation_word2Id_fkey" FOREIGN KEY ("word2Id") REFERENCES "LanguageObject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MasteryState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stage" INTEGER NOT NULL DEFAULT 0,
    "fsrsDifficulty" REAL NOT NULL DEFAULT 5,
    "fsrsStability" REAL NOT NULL DEFAULT 0,
    "fsrsLastReview" DATETIME,
    "fsrsNextReview" DATETIME,
    "fsrsReps" INTEGER NOT NULL DEFAULT 0,
    "fsrsLapses" INTEGER NOT NULL DEFAULT 0,
    "fsrsState" TEXT NOT NULL DEFAULT 'new',
    "cueFreeAccuracy" REAL NOT NULL DEFAULT 0,
    "cueAssistedAccuracy" REAL NOT NULL DEFAULT 0,
    "exposureCount" INTEGER NOT NULL DEFAULT 0,
    "nextReview" DATETIME,
    "lastReviewedAt" DATETIME,
    "priority" REAL NOT NULL DEFAULT 0,
    "objectId" TEXT NOT NULL,
    CONSTRAINT "MasteryState_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "LanguageObject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StageTransition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "masteryStateId" TEXT NOT NULL,
    "fromStage" INTEGER NOT NULL,
    "toStage" INTEGER NOT NULL,
    "trigger" TEXT NOT NULL,
    "cueFreeAccuracyAtTransition" REAL NOT NULL,
    "cueAssistedAccuracyAtTransition" REAL NOT NULL,
    "exposureCountAtTransition" INTEGER NOT NULL,
    "metadata" TEXT,
    CONSTRAINT "StageTransition_masteryStateId_fkey" FOREIGN KEY ("masteryStateId") REFERENCES "MasteryState" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "mode" TEXT NOT NULL,
    "itemsPracticed" INTEGER NOT NULL DEFAULT 0,
    "stageTransitions" INTEGER NOT NULL DEFAULT 0,
    "fluencyTaskCount" INTEGER NOT NULL DEFAULT 0,
    "versatilityTaskCount" INTEGER NOT NULL DEFAULT 0,
    "responseCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Session_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "GoalSpec" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Response" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taskType" TEXT NOT NULL,
    "taskFormat" TEXT NOT NULL,
    "modality" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "responseTimeMs" INTEGER NOT NULL,
    "cueLevel" INTEGER NOT NULL DEFAULT 0,
    "response" TEXT,
    "expected" TEXT,
    "responseContent" TEXT,
    "expectedContent" TEXT,
    "irtThetaContribution" REAL,
    "sessionId" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    CONSTRAINT "Response_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Response_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "LanguageObject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ThetaSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "thetaGlobal" REAL NOT NULL,
    "thetaPhonology" REAL NOT NULL,
    "thetaMorphology" REAL NOT NULL,
    "thetaLexical" REAL NOT NULL,
    "thetaSyntactic" REAL NOT NULL,
    "thetaPragmatic" REAL NOT NULL,
    "seGlobal" REAL NOT NULL,
    "sessionId" TEXT NOT NULL,
    CONSTRAINT "ThetaSnapshot_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CachedTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "objectId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "taskFormat" TEXT NOT NULL,
    "taskContent" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ErrorAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responseId" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "errorType" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "correction" TEXT NOT NULL,
    "similarErrors" TEXT,
    "confidence" REAL NOT NULL DEFAULT 0.8,
    "source" TEXT NOT NULL DEFAULT 'claude',
    "objectId" TEXT NOT NULL,
    CONSTRAINT "ErrorAnalysis_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "LanguageObject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComponentErrorStats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "updatedAt" DATETIME NOT NULL,
    "component" TEXT NOT NULL,
    "totalErrors" INTEGER NOT NULL DEFAULT 0,
    "recentErrors" INTEGER NOT NULL DEFAULT 0,
    "errorRate" REAL NOT NULL DEFAULT 0,
    "trend" REAL NOT NULL DEFAULT 0,
    "recommendation" TEXT,
    "userId" TEXT NOT NULL,
    "goalId" TEXT,
    CONSTRAINT "ComponentErrorStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OfflineQueueItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "error" TEXT,
    "result" TEXT
);

-- CreateTable
CREATE TABLE "UserObjectRelationship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "strength" REAL NOT NULL DEFAULT 0,
    "encounterCount" INTEGER NOT NULL DEFAULT 0,
    "lastEncounter" DATETIME,
    "firstEncounter" DATETIME,
    "successRate" REAL NOT NULL DEFAULT 0,
    "avgResponseTime" INTEGER NOT NULL DEFAULT 0,
    "activationLevel" REAL NOT NULL DEFAULT 0,
    "decayRate" REAL NOT NULL DEFAULT 0.1
);

-- CreateTable
CREATE TABLE "ObjectConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceObjectId" TEXT NOT NULL,
    "targetObjectId" TEXT NOT NULL,
    "connectionType" TEXT NOT NULL,
    "weight" REAL NOT NULL DEFAULT 0.5,
    "bidirectional" BOOLEAN NOT NULL DEFAULT true,
    "cooccurrenceCount" INTEGER NOT NULL DEFAULT 0,
    "pmi" REAL NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "SpreadingActivationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "sourceObjectId" TEXT NOT NULL,
    "initialActivation" REAL NOT NULL,
    "decayFactor" REAL NOT NULL,
    "spreadDepth" INTEGER NOT NULL,
    "activatedObjects" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "G2PThetaProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "thetaPhonological" REAL NOT NULL DEFAULT 0,
    "thetaAlphabetic" REAL NOT NULL DEFAULT 0,
    "thetaSyllable" REAL NOT NULL DEFAULT 0,
    "thetaWord" REAL NOT NULL DEFAULT 0,
    "thetaSupra" REAL NOT NULL DEFAULT 0,
    "thetaReading" REAL NOT NULL DEFAULT 0,
    "thetaWriting" REAL NOT NULL DEFAULT 0,
    "thetaListening" REAL NOT NULL DEFAULT 0,
    "thetaSpeaking" REAL NOT NULL DEFAULT 0,
    "sePhonological" REAL NOT NULL DEFAULT 1,
    "seAlphabetic" REAL NOT NULL DEFAULT 1,
    "seSyllable" REAL NOT NULL DEFAULT 1,
    "seWord" REAL NOT NULL DEFAULT 1,
    "seSupra" REAL NOT NULL DEFAULT 1,
    "responseCounts" TEXT NOT NULL DEFAULT '{}'
);

-- CreateTable
CREATE TABLE "G2PItemParameter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "pattern" TEXT NOT NULL,
    "patternType" TEXT NOT NULL,
    "difficulty" REAL NOT NULL DEFAULT 0,
    "discrimination" REAL NOT NULL DEFAULT 1,
    "targetLayer" TEXT NOT NULL,
    "frequency" REAL NOT NULL DEFAULT 0,
    "regularity" REAL NOT NULL DEFAULT 1,
    "l1Adjustments" TEXT NOT NULL DEFAULT '{}'
);

-- CreateTable
CREATE TABLE "G2PResponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "patternId" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "responseTimeMs" INTEGER NOT NULL,
    "modality" TEXT NOT NULL,
    "targetLayer" TEXT NOT NULL,
    "wordContext" TEXT,
    "taskType" TEXT NOT NULL,
    "priorTheta" REAL NOT NULL,
    "posteriorTheta" REAL NOT NULL,
    "information" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "CurriculumGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "targetTheta" REAL NOT NULL DEFAULT 2.0,
    "currentTheta" REAL NOT NULL DEFAULT 0,
    "deadline" DATETIME,
    "weight" REAL NOT NULL DEFAULT 1.0,
    "totalObjects" INTEGER NOT NULL DEFAULT 0,
    "masteredObjects" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "modalities" TEXT NOT NULL DEFAULT '["reading"]',
    "goalSpecId" TEXT
);

-- CreateTable
CREATE TABLE "TimeAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "goalId" TEXT NOT NULL,
    "sessionDate" DATETIME NOT NULL,
    "allocatedMinutes" INTEGER NOT NULL,
    "actualMinutes" INTEGER NOT NULL DEFAULT 0,
    "paretoRank" INTEGER NOT NULL DEFAULT 0,
    "utilityScore" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "TimeAllocation_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "CurriculumGoal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SharedObjectGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "objectId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "relevance" REAL NOT NULL DEFAULT 1.0,
    "transferWeight" REAL NOT NULL DEFAULT 0.5,
    CONSTRAINT "SharedObjectGoal_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "CurriculumGoal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ParetoSolution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "sessionDate" DATETIME NOT NULL,
    "allocation" TEXT NOT NULL,
    "paretoRank" INTEGER NOT NULL,
    "dominated" BOOLEAN NOT NULL DEFAULT false,
    "objectiveScores" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "CorpusSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "endpoint" TEXT,
    "domains" TEXT NOT NULL,
    "languages" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "requiresAuth" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 60,
    "lastQueryAt" DATETIME
);

-- CreateTable
CREATE TABLE "CorpusQuery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "targetLevel" REAL NOT NULL,
    "queryType" TEXT NOT NULL,
    "filters" TEXT,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    CONSTRAINT "CorpusQuery_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CorpusSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CorpusCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "sourceId" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "targetLevel" REAL NOT NULL,
    "itemCount" INTEGER NOT NULL,
    CONSTRAINT "CorpusCache_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CorpusSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExtractedVocabulary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceId" TEXT,
    "sourceName" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "definition" TEXT,
    "examples" TEXT,
    "estimatedDifficulty" REAL NOT NULL,
    "frequencyRank" INTEGER,
    "domainRelevance" REAL NOT NULL DEFAULT 1.0,
    "termFrequency" INTEGER NOT NULL DEFAULT 1,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isImported" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "OnboardingSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT,
    "currentStepId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "originalInput" TEXT,
    "parsedGoal" TEXT,
    "completedSteps" TEXT NOT NULL DEFAULT '[]',
    "skippedSteps" TEXT NOT NULL DEFAULT '[]',
    "responses" TEXT NOT NULL DEFAULT '{}',
    "finalGoalConfig" TEXT
);

-- CreateTable
CREATE TABLE "OnboardingStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionId" TEXT NOT NULL,
    "stepType" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "cognitiveLoad" TEXT NOT NULL DEFAULT 'low',
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "content" TEXT NOT NULL,
    "validation" TEXT,
    "response" TEXT,
    "completedAt" DATETIME,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "OnboardingStep_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "OnboardingSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ParsedGoalHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "naturalLanguageInput" TEXT NOT NULL,
    "parsedResult" TEXT NOT NULL,
    "overallConfidence" REAL NOT NULL,
    "domainConfidence" REAL NOT NULL,
    "timelineConfidence" REAL NOT NULL,
    "modalityConfidence" REAL NOT NULL,
    "isValid" BOOLEAN NOT NULL,
    "validationErrors" TEXT,
    "wasAccepted" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "ClarifyingQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parsedGoalId" TEXT,
    "targetField" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "response" TEXT,
    "respondedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "GoalSpec_userId_isActive_idx" ON "GoalSpec"("userId", "isActive");

-- CreateIndex
CREATE INDEX "LanguageObject_goalId_type_idx" ON "LanguageObject"("goalId", "type");

-- CreateIndex
CREATE INDEX "LanguageObject_goalId_priority_idx" ON "LanguageObject"("goalId", "priority" DESC);

-- CreateIndex
CREATE INDEX "LanguageObject_goalId_morphologicalScore_idx" ON "LanguageObject"("goalId", "morphologicalScore");

-- CreateIndex
CREATE INDEX "LanguageObject_goalId_phonologicalDifficulty_idx" ON "LanguageObject"("goalId", "phonologicalDifficulty");

-- CreateIndex
CREATE INDEX "LanguageObject_goalId_syntacticComplexity_idx" ON "LanguageObject"("goalId", "syntacticComplexity");

-- CreateIndex
CREATE UNIQUE INDEX "LanguageObject_goalId_content_key" ON "LanguageObject"("goalId", "content");

-- CreateIndex
CREATE INDEX "Collocation_word1Id_idx" ON "Collocation"("word1Id");

-- CreateIndex
CREATE INDEX "Collocation_word2Id_idx" ON "Collocation"("word2Id");

-- CreateIndex
CREATE UNIQUE INDEX "Collocation_word1Id_word2Id_key" ON "Collocation"("word1Id", "word2Id");

-- CreateIndex
CREATE UNIQUE INDEX "MasteryState_objectId_key" ON "MasteryState"("objectId");

-- CreateIndex
CREATE INDEX "MasteryState_nextReview_idx" ON "MasteryState"("nextReview");

-- CreateIndex
CREATE INDEX "MasteryState_priority_idx" ON "MasteryState"("priority" DESC);

-- CreateIndex
CREATE INDEX "StageTransition_masteryStateId_idx" ON "StageTransition"("masteryStateId");

-- CreateIndex
CREATE INDEX "StageTransition_createdAt_idx" ON "StageTransition"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "StageTransition_fromStage_toStage_idx" ON "StageTransition"("fromStage", "toStage");

-- CreateIndex
CREATE INDEX "Session_userId_startedAt_idx" ON "Session"("userId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "Response_sessionId_idx" ON "Response"("sessionId");

-- CreateIndex
CREATE INDEX "Response_objectId_createdAt_idx" ON "Response"("objectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ThetaSnapshot_sessionId_idx" ON "ThetaSnapshot"("sessionId");

-- CreateIndex
CREATE INDEX "CachedTask_expiresAt_idx" ON "CachedTask"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CachedTask_objectId_taskType_taskFormat_key" ON "CachedTask"("objectId", "taskType", "taskFormat");

-- CreateIndex
CREATE UNIQUE INDEX "ErrorAnalysis_responseId_key" ON "ErrorAnalysis"("responseId");

-- CreateIndex
CREATE INDEX "ErrorAnalysis_objectId_component_idx" ON "ErrorAnalysis"("objectId", "component");

-- CreateIndex
CREATE INDEX "ErrorAnalysis_component_createdAt_idx" ON "ErrorAnalysis"("component", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ComponentErrorStats_userId_errorRate_idx" ON "ComponentErrorStats"("userId", "errorRate" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ComponentErrorStats_userId_component_goalId_key" ON "ComponentErrorStats"("userId", "component", "goalId");

-- CreateIndex
CREATE INDEX "OfflineQueueItem_status_createdAt_idx" ON "OfflineQueueItem"("status", "createdAt");

-- CreateIndex
CREATE INDEX "OfflineQueueItem_type_status_idx" ON "OfflineQueueItem"("type", "status");

-- CreateIndex
CREATE INDEX "UserObjectRelationship_userId_relationshipType_idx" ON "UserObjectRelationship"("userId", "relationshipType");

-- CreateIndex
CREATE INDEX "UserObjectRelationship_userId_strength_idx" ON "UserObjectRelationship"("userId", "strength" DESC);

-- CreateIndex
CREATE INDEX "UserObjectRelationship_userId_lastEncounter_idx" ON "UserObjectRelationship"("userId", "lastEncounter");

-- CreateIndex
CREATE UNIQUE INDEX "UserObjectRelationship_userId_objectId_key" ON "UserObjectRelationship"("userId", "objectId");

-- CreateIndex
CREATE INDEX "ObjectConnection_sourceObjectId_idx" ON "ObjectConnection"("sourceObjectId");

-- CreateIndex
CREATE INDEX "ObjectConnection_targetObjectId_idx" ON "ObjectConnection"("targetObjectId");

-- CreateIndex
CREATE INDEX "ObjectConnection_connectionType_idx" ON "ObjectConnection"("connectionType");

-- CreateIndex
CREATE UNIQUE INDEX "ObjectConnection_sourceObjectId_targetObjectId_connectionType_key" ON "ObjectConnection"("sourceObjectId", "targetObjectId", "connectionType");

-- CreateIndex
CREATE INDEX "SpreadingActivationLog_userId_createdAt_idx" ON "SpreadingActivationLog"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "G2PThetaProfile_userId_key" ON "G2PThetaProfile"("userId");

-- CreateIndex
CREATE INDEX "G2PThetaProfile_thetaPhonological_idx" ON "G2PThetaProfile"("thetaPhonological");

-- CreateIndex
CREATE INDEX "G2PItemParameter_targetLayer_idx" ON "G2PItemParameter"("targetLayer");

-- CreateIndex
CREATE INDEX "G2PItemParameter_difficulty_idx" ON "G2PItemParameter"("difficulty");

-- CreateIndex
CREATE UNIQUE INDEX "G2PItemParameter_pattern_patternType_key" ON "G2PItemParameter"("pattern", "patternType");

-- CreateIndex
CREATE INDEX "G2PResponse_userId_createdAt_idx" ON "G2PResponse"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "G2PResponse_patternId_idx" ON "G2PResponse"("patternId");

-- CreateIndex
CREATE INDEX "G2PResponse_userId_modality_idx" ON "G2PResponse"("userId", "modality");

-- CreateIndex
CREATE INDEX "CurriculumGoal_userId_isActive_idx" ON "CurriculumGoal"("userId", "isActive");

-- CreateIndex
CREATE INDEX "CurriculumGoal_userId_deadline_idx" ON "CurriculumGoal"("userId", "deadline");

-- CreateIndex
CREATE INDEX "TimeAllocation_goalId_sessionDate_idx" ON "TimeAllocation"("goalId", "sessionDate");

-- CreateIndex
CREATE INDEX "SharedObjectGoal_objectId_idx" ON "SharedObjectGoal"("objectId");

-- CreateIndex
CREATE UNIQUE INDEX "SharedObjectGoal_objectId_goalId_key" ON "SharedObjectGoal"("objectId", "goalId");

-- CreateIndex
CREATE INDEX "ParetoSolution_userId_sessionDate_idx" ON "ParetoSolution"("userId", "sessionDate");

-- CreateIndex
CREATE UNIQUE INDEX "CorpusSource_name_key" ON "CorpusSource"("name");

-- CreateIndex
CREATE INDEX "CorpusSource_isAvailable_priority_idx" ON "CorpusSource"("isAvailable", "priority" DESC);

-- CreateIndex
CREATE INDEX "CorpusQuery_sourceId_createdAt_idx" ON "CorpusQuery"("sourceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "CorpusQuery_domain_targetLevel_idx" ON "CorpusQuery"("domain", "targetLevel");

-- CreateIndex
CREATE UNIQUE INDEX "CorpusCache_cacheKey_key" ON "CorpusCache"("cacheKey");

-- CreateIndex
CREATE INDEX "CorpusCache_cacheKey_idx" ON "CorpusCache"("cacheKey");

-- CreateIndex
CREATE INDEX "CorpusCache_expiresAt_idx" ON "CorpusCache"("expiresAt");

-- CreateIndex
CREATE INDEX "CorpusCache_domain_targetLevel_idx" ON "CorpusCache"("domain", "targetLevel");

-- CreateIndex
CREATE INDEX "ExtractedVocabulary_domain_estimatedDifficulty_idx" ON "ExtractedVocabulary"("domain", "estimatedDifficulty");

-- CreateIndex
CREATE INDEX "ExtractedVocabulary_isImported_idx" ON "ExtractedVocabulary"("isImported");

-- CreateIndex
CREATE UNIQUE INDEX "ExtractedVocabulary_term_domain_key" ON "ExtractedVocabulary"("term", "domain");

-- CreateIndex
CREATE INDEX "OnboardingSession_userId_idx" ON "OnboardingSession"("userId");

-- CreateIndex
CREATE INDEX "OnboardingSession_status_idx" ON "OnboardingSession"("status");

-- CreateIndex
CREATE INDEX "OnboardingStep_sessionId_stepOrder_idx" ON "OnboardingStep"("sessionId", "stepOrder");

-- CreateIndex
CREATE INDEX "ParsedGoalHistory_userId_createdAt_idx" ON "ParsedGoalHistory"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ClarifyingQuestion_parsedGoalId_idx" ON "ClarifyingQuestion"("parsedGoalId");
