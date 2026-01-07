# 백엔드-UI 통합 계획

## 1. Backend API 구조 분석

### 1.1 `window.logos` API 구조

```typescript
interface LogosAPI {
  goal: GoalAPI;           // 목표 관리
  object: ObjectAPI;       // 학습 객체 관리
  session: SessionAPI;     // 세션 관리
  queue: QueueAPI;         // 학습 큐
  mastery: MasteryAPI;     // 마스터리 추적
  analytics: AnalyticsAPI; // 분석
  profile: ProfileAPI;     // 사용자 프로필
  claude: ClaudeAPI;       // Claude AI 통합
  corpus: CorpusAPI;       // 코퍼스 소스
  sync: SyncAPI;           // 오프라인 동기화
  onboarding: OnboardingAPI; // 온보딩
  app: AppAPI;             // 앱 정보
}
```

---

## 2. UI 컴포넌트 ↔ Backend API 매핑

### 2.1 AbilityRadarChart (IRT Theta 시각화)

**필요 데이터:**
- 5개 언어 컴포넌트별 theta 값 (-3 ~ +3)
- 컴포넌트: PHON, MORPH, LEX, SYNT, PRAG

**Backend API:**
```typescript
// 방법 1: profile API (현재 미구현 - fallback 있음)
window.logos.profile.get()
// 반환: User { theta: UserThetaProfile }

// UserThetaProfile 구조:
{
  thetaGlobal: number;
  thetaPhonology: number;
  thetaMorphology: number;
  thetaLexical: number;
  thetaSyntactic: number;
  thetaPragmatic: number;
}

// 방법 2: analytics:get-progress (대안)
window.logos.analytics.getProgress(goalId, timeRange)
// 반환: { byComponent: Record<ComponentType, { theta, itemCount, accuracy }> }
```

**데이터 변환:**
```typescript
const mapThetaToRadarData = (theta: UserThetaProfile) => [
  { component: 'phonology', theta: theta.thetaPhonology, label: 'Phonology' },
  { component: 'morphology', theta: theta.thetaMorphology, label: 'Morphology' },
  { component: 'lexical', theta: theta.thetaLexical, label: 'Lexical' },
  { component: 'syntactic', theta: theta.thetaSyntactic, label: 'Syntax' },
  { component: 'pragmatic', theta: theta.thetaPragmatic, label: 'Pragmatics' },
];
```

---

### 2.2 MasteryPipeline (5단계 마스터리 시각화)

**필요 데이터:**
- 5단계별 학습 항목 수 분포 (stage 0-4)
- 평균 보존율

**Backend API:**
```typescript
// 방법 1: mastery.getStats
window.logos.mastery.getStats(goalId)
// 반환: { distribution: Record<MasteryStage, number>, averageRetention: number }

// 방법 2: analytics:get-progress
window.logos.analytics.getProgress(goalId)
// 반환: {
//   stageDistribution: [number, number, number, number, number],
//   masteredCount: number,
//   learningCount: number,
//   newCount: number
// }
```

**데이터 변환:**
```typescript
const mapToMasteryPipelineData = (stats: { distribution: Record<number, number> }) => [
  { stage: 0, label: 'Unknown', count: stats.distribution[0] || 0 },
  { stage: 1, label: 'Recognition', count: stats.distribution[1] || 0 },
  { stage: 2, label: 'Recall', count: stats.distribution[2] || 0 },
  { stage: 3, label: 'Production', count: stats.distribution[3] || 0 },
  { stage: 4, label: 'Automatic', count: stats.distribution[4] || 0 },
];
```

---

### 2.3 FSRSCalendar (GitHub 스타일 히트맵)

**필요 데이터:**
- 과거: 날짜별 리뷰 수 (reviewCount)
- 미래: 날짜별 예정 리뷰 수 (dueCount)
- 새로 학습한 항목 수 (newCount)

**Backend API:**
```typescript
// 세션 히스토리에서 일별 집계
window.logos.session.getHistory(goalId, { limit: 100 })
// 반환: SessionSummary[]
// SessionSummary: { id, startedAt, endedAt, itemsPracticed, accuracy, ... }

// 또는 analytics 사용
window.logos.analytics.getSessionStats(goalId, days)
// 반환: { totalSessions, totalTimeMinutes, currentStreak, ... }

// Due items는 queue에서 계산
window.logos.queue.build(goalId)
// 반환: LearningQueueItem[] with nextReview dates
```

**데이터 변환 (세션 히스토리 기반):**
```typescript
const buildCalendarData = async (goalId: string, days: number): Promise<DayData[]> => {
  const sessions = await window.logos.session.getHistory(goalId, { limit: 200 });
  const queue = await window.logos.queue.build(goalId, { sessionSize: 500 });

  // 날짜별 집계
  const dayMap = new Map<string, DayData>();

  // 과거 세션 집계
  for (const session of sessions) {
    const dateStr = session.startedAt.toISOString().split('T')[0];
    const existing = dayMap.get(dateStr) || { date: dateStr, reviewCount: 0, dueCount: 0 };
    existing.reviewCount += session.itemsPracticed;
    dayMap.set(dateStr, existing);
  }

  // 미래 예정 집계
  const today = new Date();
  for (const item of queue) {
    if (item.nextReview && item.nextReview > today) {
      const dateStr = item.nextReview.toISOString().split('T')[0];
      const existing = dayMap.get(dateStr) || { date: dateStr, reviewCount: 0, dueCount: 0 };
      existing.dueCount++;
      dayMap.set(dateStr, existing);
    }
  }

  return Array.from(dayMap.values());
};
```

---

### 2.4 CascadeDiagram (언어 처리 병목 시각화)

**필요 데이터:**
- 컴포넌트별 오류율 (errorRate: 0-1)
- 컴포넌트별 신뢰도 (confidence: 0-1)
- 분석된 항목 수 (itemCount)
- 병목 지점 여부 (isBottleneck)

**Backend API:**
```typescript
// 방법 1: analytics.getBottlenecks
window.logos.analytics.getBottlenecks(goalId, minResponses)
// 반환: BottleneckAnalysis {
//   primaryBottleneck: ComponentType | null,
//   confidence: number,
//   evidence: BottleneckEvidence[],
//   recommendation: string
// }

// BottleneckEvidence 구조:
{
  componentType: 'PHON' | 'MORPH' | 'LEX' | 'SYNT' | 'PRAG',
  errorRate: number,        // 0-1
  errorPatterns: string[],
  cooccurringErrors: ComponentType[],
  improvement: number       // 개선 추세
}

// 방법 2: claude.getBottlenecks (AI 분석)
window.logos.claude.getBottlenecks(goalId, limit)
// 반환: { bottlenecks: ComponentBottleneck[], primaryBottleneck: ComponentBottleneck | null }
```

**데이터 변환:**
```typescript
const mapToCascadeData = (analysis: BottleneckAnalysis): ComponentData[] => {
  const componentOrder: ComponentData['component'][] = [
    'phonology', 'morphology', 'lexical', 'syntactic', 'pragmatic'
  ];

  const typeMapping: Record<string, ComponentData['component']> = {
    'PHON': 'phonology',
    'MORPH': 'morphology',
    'LEX': 'lexical',
    'SYNT': 'syntactic',
    'PRAG': 'pragmatic'
  };

  return componentOrder.map(comp => {
    const evidence = analysis.evidence.find(
      e => typeMapping[e.componentType] === comp
    );

    return {
      component: comp,
      errorRate: evidence?.errorRate ?? 0,
      confidence: analysis.confidence,
      itemCount: 0, // evidence에서 계산 필요
      isBottleneck: typeMapping[analysis.primaryBottleneck || ''] === comp
    };
  });
};
```

---

### 2.5 Toast (알림 시스템)

**연결 이벤트:**
- 세션 완료 알림
- 마일스톤 달성 알림
- 스트릭 업데이트 알림
- 오프라인/온라인 상태 변경

**Backend API (이벤트 기반):**
```typescript
// IPC Events (메인 → 렌더러 푸시)
const IPC_EVENTS = {
  SESSION_COMPLETED: 'event:session:completed',
  GOAL_MILESTONE: 'event:notification:goal-milestone',
  STREAK_UPDATE: 'event:notification:streak-update',
  OFFLINE_MODE_CHANGE: 'event:system:offline-mode',
};
```

---

## 3. 페이지별 API 호출 계획

### 3.1 AnalyticsPage

```typescript
// 데이터 페칭
const loadAnalyticsData = async (goalId: string) => {
  const [progress, bottlenecks, sessionStats, masteryStats] = await Promise.all([
    window.logos.analytics.getProgress(goalId, 'month'),
    window.logos.analytics.getBottlenecks(goalId, 20),
    window.logos.analytics.getSessionStats(goalId, 30),
    window.logos.mastery.getStats(goalId),
  ]);

  return { progress, bottlenecks, sessionStats, masteryStats };
};
```

### 3.2 DashboardPage

```typescript
const loadDashboardData = async (goalId: string) => {
  const [progress, queue, sessions] = await Promise.all([
    window.logos.analytics.getProgress(goalId, 'week'),
    window.logos.queue.build(goalId, { sessionSize: 10 }),
    window.logos.session.getHistory(goalId, { limit: 5 }),
  ]);

  return { progress, queue, sessions };
};
```

---

## 4. 구현 순서

### Phase 1: 데이터 레이어
1. ✅ Backend API 구조 분석 완료
2. 🔄 API 타입 정의 확인
3. ⏳ 데이터 변환 유틸리티 함수 작성

### Phase 2: AnalyticsPage 통합
1. AbilityRadarChart ← profile.get() 또는 analytics.getProgress()
2. MasteryPipeline ← mastery.getStats()
3. CascadeDiagram ← analytics.getBottlenecks()
4. FSRSCalendar ← session.getHistory() + queue.build()

### Phase 3: DashboardPage 통합
1. 진행률 카드 ← analytics.getProgress()
2. 학습 큐 미리보기 ← queue.build()
3. 최근 세션 ← session.getHistory()

### Phase 4: 실시간 업데이트
1. Toast 시스템 ← IPC Events 연결
2. 세션 완료 후 자동 새로고침
3. 오프라인 상태 표시

---

## 5. 주의사항

### 5.1 존재하지 않는 API
- `window.logos.user` - **존재하지 않음** → `window.logos.profile` 사용
- `window.logos.analytics.getReviewHistory()` - **존재하지 않음** → `session.getHistory()` 사용

### 5.2 Fallback 처리
```typescript
// profile API는 fallback이 구현되어 있음
profile: {
  get: () =>
    invoke('profile:get', {}).catch(() => ({
      id: 'default',
      email: 'default@logos.local',
      name: 'Default User',
    })),
}
```

### 5.3 에러 처리
모든 API 호출은 try-catch로 감싸고, 에러 시 Toast로 사용자에게 알림.
