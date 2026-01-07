# LOGOS 구현 계획 2025

## 학술적 기반 및 코드베이스 Alignment

### 연구 기반 요약

| 기능 영역 | 학술 기반 | 핵심 참조 |
|-----------|----------|-----------|
| 사용자-객체 관계 그래프 | Knowledge Tracing, DKT | Piech et al. (2015), DyGKT (2024) |
| G2P-IRT 연동 | Multidimensional IRT, MIRT | AISTATS 2024, EDM 2022 |
| 동적 코퍼스 소싱 | Dynamic Corpora, NLP APIs | COCA, OPUS, spaCy |
| 다중 커리큘럼 관리 | Multi-Objective Optimization | Pareto Active Learning, ICLR 2023 |
| 온보딩 UX | Cognitive Load Theory | Sweller (1988), NN/g |

---

## 우선순위 결정 (Impact × Feasibility)

### Priority 1: 사용자-객체 관계 그래프 (User-Object Relationship Graph)
**Impact**: 높음 - 모든 다른 기능의 기초 데이터
**Feasibility**: 높음 - 기존 MasteryState, Response 확장

### Priority 2: G2P-IRT 완전 연동 (G2P-IRT Full Integration)
**Impact**: 높음 - 발음 학습 개인화 핵심
**Feasibility**: 높음 - G2P와 IRT 모듈 이미 존재

### Priority 3: 다중 커리큘럼 동시 관리 (Multi-Curriculum Management)
**Impact**: 중간 - 고급 사용자 대상
**Feasibility**: 중간 - DB 스키마 변경 필요

### Priority 4: 동적 외부 코퍼스 소싱 (Dynamic Corpus Sourcing)
**Impact**: 중간 - 콘텐츠 품질 향상
**Feasibility**: 낮음 - 외부 API 의존성

### Priority 5: 온보딩 UX 개선 (Onboarding UX Enhancement)
**Impact**: 높음 - 초기 사용자 retention
**Feasibility**: 중간 - UI/UX 변경 필요

---

## Priority 1: 사용자-객체 관계 그래프

### 학술 기반
- **Deep Knowledge Tracing (DKT)**: Piech et al., 2015 - LSTM으로 학생 지식 상태 추적
- **DyGKT**: Dynamic Graph Learning for Knowledge Tracing (2024) - 학생-질문-개념 관계의 동적 그래프
- **Knowledge Relation Rank**: PMC 2023 - Heterogeneous learning interaction modeling

### 현재 코드베이스 상태
```
MasteryState {
  stage, fsrs*, cueFreeAccuracy, cueAssistedAccuracy, exposureCount
}
Response {
  taskType, taskFormat, modality, correct, responseTimeMs, cueLevel
}
```

### 추가 필요 데이터
1. **조우 컨텍스트 (Encounter Context)**
   - 어떤 태스크 유형에서 조우했는지
   - 어떤 모달리티로 조우했는지
   - 조우 시 난이도 조건

2. **해석/창출 비율 (Interpretation/Production Ratio)**
   - Recognition tasks (해석): MCQ, matching, listening comprehension
   - Production tasks (창출): free response, speaking, writing

3. **모달리티별 성공률**
   - Visual, Auditory, Mixed 별도 추적

4. **사용공간 연결 (Usage Space Connection)**
   - 어떤 도메인 컨텍스트에서 사용되었는지
   - 어떤 장르에서 조우했는지

### 구현 설계

#### 새로운 Prisma 모델
```prisma
model ObjectEncounter {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())

  // Encounter context
  taskType       String  // recognition, recall, production
  taskFormat     String  // mcq, fill_blank, free_response
  modality       String  // visual, auditory, mixed
  domain         String  // medical, legal, business
  genre          String? // report, conversation

  // Outcome
  successful     Boolean
  responseTimeMs Int
  cueLevel       Int

  // IRT context at time of encounter
  userTheta      Float
  itemDifficulty Float

  objectId String
  object   LanguageObject @relation(fields: [objectId], references: [id])

  userId   String

  @@index([objectId, taskType])
  @@index([objectId, modality])
  @@index([userId, createdAt])
}

model ObjectRelationshipStats {
  id        String   @id @default(uuid())
  updatedAt DateTime @updatedAt

  // Encounter counts
  totalEncounters        Int @default(0)
  recognitionEncounters  Int @default(0)
  productionEncounters   Int @default(0)

  // Modality breakdown
  visualEncounters       Int @default(0)
  auditoryEncounters     Int @default(0)
  mixedEncounters        Int @default(0)

  // Success rates
  recognitionSuccessRate Float @default(0)
  productionSuccessRate  Float @default(0)
  visualSuccessRate      Float @default(0)
  auditorySuccessRate    Float @default(0)

  // Interpretation/Production ratio
  interpretationRatio    Float @default(0.5) // 0=all production, 1=all interpretation

  // Domain exposure
  domainExposure         String? // JSON: {"medical": 10, "legal": 5}

  // Learning cost estimate
  estimatedLearningCost  Float @default(1.0)

  // Derived effects (cascade impact)
  derivedEffectScore     Float @default(0)

  objectId String @unique
  object   LanguageObject @relation(fields: [objectId], references: [id])

  userId   String

  @@index([userId, totalEncounters])
}
```

#### Core Module: user-object-graph.ts
```typescript
/**
 * User-Object Relationship Graph Module
 *
 * Based on:
 * - DKT (Piech et al., 2015): LSTM-based knowledge state tracking
 * - DyGKT (2024): Dynamic graph learning for knowledge tracing
 * - Knowledge Relation Rank (2023): Heterogeneous learning interaction
 */

export interface EncounterContext {
  taskCategory: 'interpretation' | 'production';
  taskType: TaskType;
  taskFormat: TaskFormat;
  modality: TaskModality;
  domain: string;
  genre?: string;
  userTheta: number;
  itemDifficulty: number;
}

export interface ObjectRelationshipProfile {
  objectId: string;

  // Encounter statistics
  totalEncounters: number;
  encountersByCategory: {
    interpretation: number;
    production: number;
  };
  encountersByModality: {
    visual: number;
    auditory: number;
    mixed: number;
  };

  // Success rates
  successRates: {
    overall: number;
    interpretation: number;
    production: number;
    byModality: Record<TaskModality, number>;
  };

  // Ratios
  interpretationProductionRatio: number; // >0.5 = more interpretation
  modalityBalance: number; // 0-1, higher = more balanced

  // Domain exposure distribution
  domainExposure: Record<string, number>;

  // Learning economics
  estimatedLearningCost: number;
  derivedEffectScore: number; // cascade benefit to related objects

  // Temporal patterns
  lastEncounter: Date | null;
  averageInterEncounterInterval: number; // days

  // Strength indicators
  knowledgeStrength: number; // 0-1, composite metric
  retrievalFluency: number;  // based on response times
}

// Core functions
export function recordEncounter(
  objectId: string,
  userId: string,
  context: EncounterContext,
  outcome: { successful: boolean; responseTimeMs: number; cueLevel: number }
): ObjectEncounter;

export function getRelationshipProfile(
  objectId: string,
  userId: string
): ObjectRelationshipProfile;

export function calculateInterpretationProductionRatio(
  encounters: ObjectEncounter[]
): number;

export function calculateModalityBalance(
  encounters: ObjectEncounter[]
): number;

export function estimateLearningCost(
  profile: ObjectRelationshipProfile,
  baseIrtDifficulty: number
): number;

export function calculateDerivedEffect(
  objectId: string,
  relatedObjects: string[],
  transferCoefficients: Record<string, number>
): number;

export function buildUserObjectGraph(
  userId: string,
  objectIds: string[]
): UserObjectGraph;

export function visualizeRelationshipData(
  profile: ObjectRelationshipProfile
): VisualizationData;
```

---

## Priority 2: G2P-IRT 완전 연동

### 학술 기반
- **Multidimensional IRT (MIRT)**: 다차원 능력 추정
- **Format-aware IRT** (EDM 2022): 태스크 형식에 따른 난이도 분리
- **Context-dependent difficulty**: 컨텍스트별 난이도 파라미터

### 현재 G2P 구조
```typescript
G2PDifficulty {
  difficultyScore: number;      // 0-1
  irregularPatterns: [...]
  potentialMispronunciations: [...]
}

G2PHierarchicalProfile {
  alphabetic: { units, mastery, difficulties }
  syllable: { units, mastery, difficulties }
  word: { units, mastery, sightWordCount }
}
```

### 문제점
1. G2P difficultyScore가 IRT b 파라미터와 분리됨
2. 컨텍스트별 난이도 분화 없음 (같은 단어도 reading vs speaking 난이도 다름)
3. G2P 레이어별 IRT theta 없음

### 구현 설계

#### 새로운 타입
```typescript
/**
 * Context-Dependent IRT Parameters for G2P
 *
 * Based on Format-aware IRT (EDM 2022)
 */
export interface ContextualG2PDifficulty {
  // Base difficulty from G2P analysis
  baseDifficulty: number;

  // Context-specific difficulty adjustments
  contextualDifficulties: {
    // By modality
    reading: number;      // Visual recognition
    listening: number;    // Auditory recognition
    speaking: number;     // Production
    writing: number;      // Spelling production

    // By task type
    recognition: number;  // Receptive tasks
    production: number;   // Productive tasks

    // By speed requirement
    untimed: number;      // Accuracy focus
    timed: number;        // Fluency focus
  };

  // G2P layer-specific difficulties
  layerDifficulties: {
    alphabetic: number;   // Grapheme-phoneme mapping
    syllable: number;     // Syllable pattern recognition
    word: number;         // Whole word recognition
  };

  // L1-specific adjustments
  l1Adjustments: Record<string, number>;
}

export interface G2PIRTParameters {
  // Standard IRT parameters
  difficulty: number;     // b parameter (logit scale)
  discrimination: number; // a parameter
  guessing: number;       // c parameter (for MCQ)

  // Contextual modifiers
  contextModifiers: ContextualG2PDifficulty;

  // Layer-specific theta requirements
  layerThetas: {
    alphabetic: number;   // Minimum theta for alphabetic mastery
    syllable: number;     // Minimum theta for syllable mastery
    word: number;         // Minimum theta for word mastery
  };
}

/**
 * User's G2P ability profile with layer-specific thetas
 */
export interface G2PThetaProfile {
  // Overall phonological theta
  thetaPhonological: number;

  // Layer-specific thetas
  thetaAlphabetic: number;
  thetaSyllable: number;
  thetaWord: number;

  // Context-specific thetas
  thetaReading: number;
  thetaListening: number;
  thetaSpeaking: number;
  thetaWriting: number;

  // Standard errors
  sePhonological: number;
  seAlphabetic: number;
  seSyllable: number;
  seWord: number;
}
```

#### Core Module Extension: g2p-irt.ts
```typescript
/**
 * G2P-IRT Integration Module
 *
 * Connects G2P difficulty analysis to IRT ability estimation
 */

// Convert G2P difficulty to IRT b parameter
export function g2pDifficultyToIRT(
  g2pDifficulty: G2PDifficulty,
  context: {
    modality: TaskModality;
    taskType: TaskType;
    isTimed: boolean;
    userL1: string;
  }
): number;

// Get contextual difficulty for specific task
export function getContextualDifficulty(
  params: G2PIRTParameters,
  context: {
    modality: TaskModality;
    taskType: TaskType;
    layer: 'alphabetic' | 'syllable' | 'word';
    userL1: string;
  }
): number;

// Estimate layer-specific theta from responses
export function estimateG2PLayerTheta(
  responses: G2PResponse[],
  items: G2PIRTParameters[],
  layer: 'alphabetic' | 'syllable' | 'word'
): ThetaEstimate;

// Update full G2P theta profile
export function updateG2PThetaProfile(
  currentProfile: G2PThetaProfile,
  newResponse: G2PResponse,
  itemParams: G2PIRTParameters
): G2PThetaProfile;

// Select optimal G2P item based on layer readiness
export function selectG2PItem(
  candidateItems: G2PIRTParameters[],
  userProfile: G2PThetaProfile,
  targetLayer: 'alphabetic' | 'syllable' | 'word' | 'auto'
): G2PIRTParameters;

// Calculate probability with context adjustment
export function probabilityG2P(
  userProfile: G2PThetaProfile,
  itemParams: G2PIRTParameters,
  context: TaskContext
): number;
```

#### DB Schema Addition
```prisma
model G2PLayerTheta {
  id        String   @id @default(uuid())
  updatedAt DateTime @updatedAt

  // Layer-specific thetas
  thetaAlphabetic Float @default(0)
  thetaSyllable   Float @default(0)
  thetaWord       Float @default(0)

  // Context-specific thetas
  thetaReading    Float @default(0)
  thetaListening  Float @default(0)
  thetaSpeaking   Float @default(0)
  thetaWriting    Float @default(0)

  // Standard errors
  seAlphabetic    Float @default(1)
  seSyllable      Float @default(1)
  seWord          Float @default(1)

  userId String @unique

  @@index([userId])
}
```

---

## Priority 3: 다중 커리큘럼 동시 관리

### 학술 기반
- **Multi-Objective Optimization (MOO)**: Pareto optimality
- **Cross-Course Learning Path Planning**: IRT + knowledge graph integration
- **Curriculum-Oriented Multi-goal Agent**: Adaptive learning with multiple targets

### 현재 상태
- GoalSpec 모델 존재하지만 단일 활성 목표 가정
- LanguageObject가 단일 GoalSpec에 연결됨
- 공통 객체 재사용 없음

### 구현 설계

#### 스키마 변경
```prisma
// 공통 어휘 풀 (Goal-independent)
model SharedLanguageObject {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())

  // Content (normalized)
  content     String @unique
  type        String
  contentJson String?

  // Intrinsic properties (goal-independent)
  frequency            Float
  morphologicalScore   Float?
  phonologicalDifficulty Float?
  baseIrtDifficulty    Float @default(0)

  // Goal-specific instances
  goalInstances GoalLanguageObject[]

  @@index([content])
  @@index([type])
}

// Goal-specific instance
model GoalLanguageObject {
  id String @id @default(uuid())

  // Links
  sharedObjectId String
  sharedObject   SharedLanguageObject @relation(fields: [sharedObjectId], references: [id])

  goalId String
  goal   GoalSpec @relation(fields: [goalId], references: [id])

  // Goal-specific properties
  priority             Float @default(0)
  domainRelevance      Float @default(0)
  contextualContribution Float @default(0)
  pragmaticScore       Float?
  syntacticComplexity  Float?

  // Goal-specific IRT
  irtDifficulty        Float @default(0)
  irtDiscrimination    Float @default(1)

  masteryState MasteryState?

  @@unique([sharedObjectId, goalId])
  @@index([goalId, priority])
}

// Multi-goal session
model MultiGoalSession {
  id        String   @id @default(uuid())
  startedAt DateTime @default(now())

  userId String

  // Active goals in this session
  activeGoalIds String // JSON array

  // Time allocation
  goalTimeAllocation String // JSON: {"goalId1": 0.5, "goalId2": 0.3, ...}

  // Pareto optimization state
  paretoFrontier String? // JSON: current non-dominated solutions

  @@index([userId, startedAt])
}
```

#### Core Module: multi-curriculum.ts
```typescript
/**
 * Multi-Curriculum Management Module
 *
 * Based on:
 * - Multi-Objective Optimization (ICLR 2023)
 * - Pareto Active Learning
 * - Cross-Course Learning Path Planning
 */

export interface CurriculumGoal {
  id: string;
  domain: string;
  targetTheta: number;
  deadline?: Date;
  weight: number; // User-assigned importance
}

export interface ParetoSolution {
  goalAllocations: Record<string, number>; // goalId -> time fraction
  expectedProgress: Record<string, number>; // goalId -> progress rate
  isDominated: boolean;
}

export interface SharedObjectBenefit {
  objectId: string;
  benefitingGoals: string[];
  totalBenefit: number; // Sum of benefits across goals
  synergyBonus: number; // Extra benefit from multi-goal relevance
}

// Multi-goal optimization
export function computeParetoFrontier(
  goals: CurriculumGoal[],
  availableTime: number,
  userThetas: Record<string, number>
): ParetoSolution[];

export function selectParetoOptimalAllocation(
  frontier: ParetoSolution[],
  userPreference: 'balanced' | 'deadline_focused' | 'progress_focused'
): ParetoSolution;

// Shared object management
export function findSharedObjects(
  goals: CurriculumGoal[]
): SharedObjectBenefit[];

export function prioritizeWithMultiGoalBenefit(
  objects: SharedObjectBenefit[],
  activeGoals: CurriculumGoal[]
): PrioritizedObject[];

// Session planning
export function planMultiGoalSession(
  goals: CurriculumGoal[],
  sessionDuration: number,
  userState: UserState
): MultiGoalSessionPlan;

export function balanceGoalProgress(
  currentProgress: Record<string, number>,
  targets: Record<string, number>,
  weights: Record<string, number>
): Record<string, number>; // Recommended time allocation
```

---

## Priority 4: 동적 외부 코퍼스 소싱

### 학술 기반
- **Dynamic Corpora**: Real-time content sourcing
- **COCA, OPUS**: Large-scale corpus resources
- **Domain-specific NLP**: Specialized vocabulary extraction

### 현재 상태
- DOMAIN_TEXT_TYPE_STATISTICS: 정적 데이터
- External API 연동 없음

### 구현 설계

#### Core Module: dynamic-corpus.ts
```typescript
/**
 * Dynamic Corpus Sourcing Module
 *
 * Runtime integration with external corpus APIs
 */

export interface CorpusSource {
  id: string;
  name: string;
  type: 'api' | 'file' | 'streaming';
  domains: string[];
  languages: string[];
  rateLimit?: number; // requests per minute
}

export interface CorpusQuery {
  domain: string;
  genre?: string;
  minFrequency?: number;
  maxDifficulty?: number;
  targetCount: number;
}

export interface CorpusResult {
  source: string;
  items: ExtractedItem[];
  metadata: {
    queryTime: number;
    totalAvailable: number;
    domainCoverage: number;
  };
}

export interface ExtractedItem {
  content: string;
  frequency: number;
  domain: string;
  context: string[];
  collocations: string[];
}

// Available sources (configurable)
export const CORPUS_SOURCES: CorpusSource[] = [
  {
    id: 'coca',
    name: 'Corpus of Contemporary American English',
    type: 'api',
    domains: ['general', 'academic', 'news', 'fiction'],
    languages: ['en']
  },
  {
    id: 'opus',
    name: 'OPUS Parallel Corpus',
    type: 'api',
    domains: ['general', 'legal', 'medical'],
    languages: ['en', 'ko', 'ja', 'zh']
  }
];

// Core functions
export function queryCorpus(
  query: CorpusQuery,
  sources?: string[]
): Promise<CorpusResult[]>;

export function extractDomainVocabulary(
  domain: string,
  targetCount: number,
  userLevel: number
): Promise<ExtractedItem[]>;

export function updateDomainStatistics(
  domain: string,
  newData: CorpusResult
): DomainTextTypeStatistics;

export function cacheCorpusResults(
  results: CorpusResult[],
  ttl: number
): void;

export function getDomainTextTypeStatistics(
  domain: string,
  useDynamic: boolean
): Promise<DomainTextTypeStatistics>;
```

---

## Priority 5: 온보딩 UX 개선

### 학술 기반
- **Cognitive Load Theory** (Sweller, 1988): Intrinsic, extraneous, germane load
- **Progressive Disclosure**: Show only what's needed
- **Hick's Law**: Minimize choices to reduce decision time

### 설계 원칙
1. **최소 인지 부담**: 한 화면에 하나의 결정만
2. **점진적 공개**: 필수 정보만 먼저, 나머지는 나중에
3. **자연어 입력**: 구조화된 선택 대신 자유 텍스트
4. **AI 해석**: 자연어를 구조화된 목표로 변환

### 구현 설계

#### 온보딩 흐름
```
Step 1: 언어 선택 (2 choices)
  "What language do you want to learn?"
  [English] [Other...]

Step 2: 목적 자연어 입력
  "Tell us about your learning goal in your own words"
  [Free text input]
  Example: "I want to pass IELTS for medical school in Canada"

Step 3: AI 해석 확인
  "Based on what you told us, here's your learning plan:"
  - Domain: Medical English
  - Benchmark: IELTS 7.0+
  - Focus: Academic reading & writing
  [Looks good!] [Let me adjust...]

Step 4: 간단한 레벨 체크 (optional)
  "Let's see where you're starting from"
  [5-10 adaptive questions]
```

#### Core Module: onboarding-ai.ts
```typescript
/**
 * AI-Powered Onboarding Module
 *
 * Converts natural language goals to structured learning plans
 */

export interface NaturalLanguageGoal {
  rawText: string;
  language: string;
}

export interface ParsedGoal {
  domain: string;
  modalities: TaskModality[];
  genre: string;
  purpose: string;
  benchmark?: string;
  deadline?: Date;
  confidence: number;
}

export interface OnboardingStep {
  id: string;
  type: 'choice' | 'text' | 'confirmation' | 'assessment';
  content: StepContent;
  cognitiveLoad: 'low' | 'medium' | 'high';
}

// Parse natural language goal
export function parseNaturalLanguageGoal(
  input: NaturalLanguageGoal
): Promise<ParsedGoal>;

// Generate clarifying questions if needed
export function generateClarifyingQuestions(
  parsed: ParsedGoal
): OnboardingStep[];

// Suggest corpus sourcing direction
export function suggestCorpusSourcing(
  goal: ParsedGoal
): CorpusSourcingPlan;

// Create minimal viable onboarding flow
export function createOnboardingFlow(
  userLanguage: string
): OnboardingStep[];

// Cognitive load estimation
export function estimateCognitiveLoad(
  step: OnboardingStep
): number;
```

---

## 구현 순서

### Phase 1: 기초 인프라 (Week 1-2)
1. ✅ ObjectEncounter, ObjectRelationshipStats 스키마 추가
2. ✅ user-object-graph.ts 코어 모듈 구현
3. ✅ 기존 Response 데이터를 Encounter로 마이그레이션

### Phase 2: G2P-IRT 연동 (Week 3-4)
1. ✅ G2PIRTParameters, G2PThetaProfile 타입 추가
2. ✅ g2p-irt.ts 모듈 구현
3. ✅ G2PLayerTheta 스키마 추가
4. ✅ 기존 G2P 분석에 IRT 연동

### Phase 3: 다중 커리큘럼 (Week 5-6)
1. SharedLanguageObject, GoalLanguageObject 스키마 추가
2. multi-curriculum.ts 모듈 구현
3. Pareto optimization 알고리즘 구현
4. UI 다중 목표 관리 추가

### Phase 4: 동적 소싱 + 온보딩 (Week 7-8)
1. dynamic-corpus.ts 구현 (API 연동)
2. onboarding-ai.ts 구현
3. 온보딩 UI 재설계
4. 통합 테스트

---

## 테스트 계획

각 모듈별 단위 테스트:
- user-object-graph.test.ts (40+ tests)
- g2p-irt.test.ts (30+ tests)
- multi-curriculum.test.ts (25+ tests)
- dynamic-corpus.test.ts (20+ tests)
- onboarding-ai.test.ts (15+ tests)

통합 테스트:
- Full learning session with relationship tracking
- G2P item selection with IRT parameters
- Multi-goal session planning
- End-to-end onboarding flow

---

## 참고문헌

1. Piech, C., et al. (2015). Deep Knowledge Tracing. NeurIPS.
2. DyGKT (2024). Dynamic Graph Learning for Knowledge Tracing. arXiv.
3. Ma, B., et al. (2025). Personalized Language Learning Using Spaced Repetition Scheduling. AIED.
4. Format-aware IRT (2022). Educational Data Mining Conference.
5. Multi-Objective Online Learning (2023). ICLR.
6. Sweller, J. (1988). Cognitive Load During Problem Solving. Cognitive Science.
7. Lu, X. (2010). Automatic Analysis of Syntactic Complexity. IJAL.
8. Miller, G.A. (1995). WordNet: A Lexical Database. Communications of the ACM.
