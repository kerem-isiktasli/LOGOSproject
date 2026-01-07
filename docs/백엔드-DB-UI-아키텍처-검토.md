# LOGOS 백엔드-DB-UI 아키텍처 검토

## 실리콘밸리 SaaS 아키텍처 벤치마크

### 2025년 업계 표준 스택

| 레이어 | 업계 표준 | LOGOS 현재 | 평가 |
|--------|----------|------------|------|
| **Frontend** | Next.js + React 19 | React 19 + Vite | ✅ 적합 |
| **Styling** | Tailwind CSS v4 + shadcn | CSS Variables + Custom | ⚠️ 개선 필요 |
| **State** | Zustand / Jotai / TanStack Query | Context API + Custom hooks | ⚠️ 개선 가능 |
| **Backend** | Node.js + Express / NestJS | Electron Main Process | ✅ 적합 (데스크톱) |
| **ORM** | Prisma | Prisma | ✅ 업계 표준 |
| **Database** | PostgreSQL (SaaS) / SQLite (Local) | SQLite | ✅ 데스크톱에 적합 |
| **API Layer** | REST / tRPC / GraphQL | IPC (Electron) | ✅ 적합 |

### 업계 아키텍처 원칙 vs LOGOS

| 원칙 | 업계 베스트 프랙티스 | LOGOS 현황 | 갭 분석 |
|------|---------------------|------------|---------|
| **Headless Architecture** | Frontend-Backend 완전 분리 | IPC 기반 분리 | ✅ 충족 |
| **Data Flow** | 단방향 데이터 흐름 | Context + Hooks | ⚠️ 체계화 필요 |
| **Observability** | 로깅, 모니터링, 트레이싱 | 기본 console.log | ❌ 부재 |
| **Security-First** | Zero Trust, E2E 암호화 | 로컬 SQLite | ✅ 로컬 앱에 적합 |

---

## Prisma 스키마 → UI 매핑 분석

### 철학적 프레임워크 적용

하이데거의 **도구 존재론** + 터프티의 **정보 시각화 원리** 기반 분석:

```
손안의 존재 (Ready-to-hand): 사용자가 의식하지 않고 사용하는 도구
눈앞의 존재 (Present-at-hand): 주의 깊은 관찰과 조작이 필요한 대상
```

---

## 1. User & GoalSpec 엔티티

### 스키마 구조
```prisma
model User {
  thetaGlobal, thetaPhonology, thetaMorphology,
  thetaLexical, thetaSyntactic, thetaPragmatic
}

model GoalSpec {
  domain, modality, genre, purpose, benchmark, deadline
  completionPercent
}
```

### 시각적 동형성 (Visual Isomorphism)

| 데이터 위계 | UI 매핑 | 철학적 근거 |
|------------|---------|-------------|
| User → Goals (1:N) | **사이드바 Goal Selector** | 부모가 컨테이너, 자식이 드롭다운 |
| θ by Component (6개) | **레이더 차트** | 6차원 데이터 → 6각형 공간 투사 |
| Goal 진행률 | **원형 프로그레스** | 완료율 = 채워진 원 (자연스러운 메타포) |

**구현 지침:**
```
레이더 차트 축 배치:
- 12시: θ_Global (전체 능력)
- 2시: θ_Phonology
- 4시: θ_Morphology
- 6시: θ_Lexical
- 8시: θ_Syntactic
- 10시: θ_Pragmatic

이유: 시계 방향으로 언어 캐스케이드 순서 (PHON→MORPH→LEX→SYNT→PRAG)
```

### 어포던스 및 메타포

| 기능 | 메타포 | 시각적 무게감 |
|------|--------|--------------|
| Goal 생성 | 씨앗 심기 → 성장 | Primary Button (높음) |
| Goal 선택 | 문 열기 → 진입 | 드롭다운 (중간) |
| Goal 완료 | 꽃 피움 → 수확 | 축하 애니메이션 (피크) |

### 상태 투사

```typescript
// Goal 상태별 시각적 피드백
const goalStateColors = {
  new: 'hsl(var(--color-neutral-400))',      // 회색 - 시작 전
  active: 'hsl(var(--color-primary))',        // 파랑 - 진행 중
  paused: 'hsl(var(--color-warning))',        // 주황 - 일시정지
  completed: 'hsl(var(--color-success))',     // 녹색 - 완료
};
```

### 설계적 은폐

| 숨길 데이터 | 이유 | 대안 표현 |
|------------|------|----------|
| User.id | UUID는 의미 없음 | 사용자 이름 |
| Goal.id | 내부 식별자 | 목표 이름 + 언어 |
| θ 원시값 (-3~+3) | 숫자는 직관적이지 않음 | CEFR 레벨 (A1~C2) |

---

## 2. LanguageObject 엔티티 (z(w) Vector)

### 스키마 구조
```prisma
model LanguageObject {
  type: 'LEX' | 'MORPH' | 'G2P' | 'SYNT' | 'PRAG'
  content: String

  // z(w) 7-element vector
  frequency, relationalDensity, contextualContribution,
  morphologicalScore, phonologicalDifficulty,
  pragmaticScore, syntacticComplexity

  // IRT parameters
  irtDifficulty, irtDiscrimination
  priority
}
```

### 시각적 동형성

| 데이터 | 현재 UI | 목표 UI | 동형성 원리 |
|--------|---------|---------|------------|
| z(w) 7차원 벡터 | 없음 | **병렬 좌표 차트** | 다차원 → 평행선 |
| type 분류 | 배지 텍스트 | **아이콘 + 색상** | 카테고리 → 시각적 구분 |
| priority 순위 | 없음 | **큐 시각화** | 순서 → 수직 스택 |
| IRT 파라미터 | 없음 | **난이도 히트맵** | 연속값 → 색상 그라데이션 |

**병렬 좌표 차트 설계:**
```
축 배치 (왼→오른):
freq → relDens → morph → phon → prag → synt → context

이유:
- 좌측: 코퍼스 기반 (frequency, relational density)
- 중앙: 언어학적 (morphological, phonological, pragmatic, syntactic)
- 우측: 맥락적 (contextual contribution)
```

### 어포던스 및 메타포

| 기능 | 물리적 메타포 | 시각적 표현 |
|------|--------------|------------|
| 단어 학습 | 씨앗 → 나무 성장 | 5단계 아이콘 변화 |
| 연어 관계 | 자석 인력 | 연결선 두께 = PMI 강도 |
| 우선순위 | 대기열 | 카드 스택 (위 = 우선) |

**마스터리 단계 아이콘 메타포:**
```
Stage 0 (Unknown):    ○ 빈 원 - 씨앗
Stage 1 (Recognition): ◐ 반원 - 싹
Stage 2 (Recall):      ◑ 3/4원 - 줄기
Stage 3 (Production):  ● 채워진 원 - 꽃봉오리
Stage 4 (Automatic):   ✿ 꽃 - 만개
```

### 상태 투사

```typescript
// z(w) 벡터 시각화 색상
const zVectorColors = {
  frequency: '#3B82F6',        // 파랑 - 빈도
  relationalDensity: '#8B5CF6', // 보라 - 관계
  morphological: '#10B981',     // 청록 - 형태
  phonological: '#F59E0B',      // 주황 - 음운
  pragmatic: '#EC4899',         // 분홍 - 화용
  syntactic: '#6366F1',         // 인디고 - 통사
  contextual: '#14B8A6',        // 틸 - 맥락
};
```

### 설계적 은폐

| 숨길 데이터 | 이유 | 대안 표현 |
|------------|------|----------|
| irtDiscrimination | 전문 용어 | "측정 정밀도" 바 |
| contentJson | 원시 JSON | 파싱된 시각 요소 |
| priority 계산식 | 복잡한 수식 | "학습 추천" 순위 |
| domainDistribution JSON | 복잡한 구조 | 도메인 태그 배지 |

**데이터-잉크 비율 최적화:**
```
현재: 7개 숫자 표시 (과잉 정보)
목표:
- 기본 뷰: 단어 + 마스터리 아이콘 + 타입 배지
- 확장 뷰: 호버 시 z(w) 미니 차트 표시
- 상세 뷰: 클릭 시 전체 프로파일 모달
```

---

## 3. MasteryState 엔티티 (FSRS)

### 스키마 구조
```prisma
model MasteryState {
  stage: 0-4
  fsrsDifficulty, fsrsStability, fsrsLastReview,
  fsrsReps, fsrsLapses, fsrsState
  cueFreeAccuracy, cueAssistedAccuracy
  nextReview, priority
}
```

### 시각적 동형성

| 데이터 | UI 매핑 | 동형성 원리 |
|--------|---------|------------|
| stage 0-4 | **5단계 파이프라인** | 이산값 → 이산 노드 |
| fsrsStability | **메모리 강도 게이지** | 연속값 → 채워진 바 |
| nextReview | **캘린더 셀** | 날짜 → 그리드 위치 |
| cueFree vs cueAssisted | **이중 바 차트** | 비교 → 병렬 배치 |

**FSRS 캘린더 설계 (GitHub Contribution 스타일):**
```
색상 강도 = 예정 리뷰 수
□ 0개
░ 1-5개
▒ 6-15개
▓ 16-30개
█ 31+개

배치: 7열(요일) × N행(주)
호버: 해당 날짜 리뷰 예정 단어 목록
```

### 어포던스 및 메타포

| 기능 | 메타포 | 시각적 무게감 |
|------|--------|--------------|
| 리뷰 시작 | 물 주기 → 식물 성장 | Primary CTA |
| 스킵 | 건너뛰기 → 뒤로 밀기 | Ghost Button |
| 마스터리 전환 | 변태 → 진화 | 축하 애니메이션 |

**스캐폴딩 갭 시각화:**
```
┌─────────────────────────────────────┐
│  Cue-Free    ████████░░░░  72%     │
│  With Cues   ████████████░  91%    │
│                                     │
│  Gap: 19% ← Focus on independent   │
│            recall exercises        │
└─────────────────────────────────────┘
```

### 상태 투사

```typescript
// FSRS 상태별 UI 피드백
const fsrsStateUI = {
  new: {
    icon: '🌱',
    label: 'New',
    color: 'gray',
    action: 'Start learning'
  },
  learning: {
    icon: '📚',
    label: 'Learning',
    color: 'blue',
    action: 'Continue practice'
  },
  review: {
    icon: '🔄',
    label: 'Review',
    color: 'amber',
    action: 'Time to review!'
  },
  relearning: {
    icon: '🔧',
    label: 'Relearning',
    color: 'orange',
    action: 'Needs reinforcement'
  }
};
```

### 설계적 은폐

| 숨길 데이터 | 이유 | 대안 표현 |
|------------|------|----------|
| fsrsDifficulty 원시값 | 0-10 스케일 불명확 | "쉬움/보통/어려움" 태그 |
| fsrsReps, fsrsLapses | 내부 카운터 | "N번 복습됨" |
| priority 계산값 | 알고리즘 결과 | "지금 복습" 배지 |

---

## 4. Session & Response 엔티티

### 스키마 구조
```prisma
model Session {
  mode: 'learning' | 'training' | 'evaluation'
  itemsPracticed, stageTransitions,
  fluencyTaskCount, versatilityTaskCount
}

model Response {
  taskType, taskFormat, modality
  correct, responseTimeMs, cueLevel
}
```

### 시각적 동형성

| 데이터 | UI 매핑 | 동형성 원리 |
|--------|---------|------------|
| Session 타임라인 | **수평 타임라인** | 시간 → 수평축 |
| Response 정오답 | **체크/엑스 아이콘** | 이진값 → 명확한 시각 기호 |
| responseTimeMs | **속도 게이지** | 연속값 → 컬러 그라데이션 |
| cueLevel 0-3 | **힌트 계단** | 이산 레벨 → 계단 UI |

**세션 진행 시각화:**
```
┌────────────────────────────────────────────────┐
│  Session Progress                              │
│  ═══════════════════●━━━━━━━━━━━━━━━━━━━━━━━  │
│                    12/20                       │
│                                                │
│  ✓ ✓ ✓ ✗ ✓ ✓ ✓ ✓ ✓ ✗ ✓ ✓ ● ○ ○ ○ ○ ○ ○ ○   │
│                                                │
│  Accuracy: 83%  |  Avg Time: 2.3s            │
└────────────────────────────────────────────────┘
```

### 어포던스 및 메타포

| 기능 | 메타포 | 시각적 표현 |
|------|--------|------------|
| 세션 시작 | 경주 시작 → 출발선 | "Start" 버튼 + 카운트다운 |
| 정답 | 성공 → 체크 | ✓ + 녹색 플래시 + 떨림 |
| 오답 | 실패 → 배움 기회 | ✗ + 빨강 + 정답 공개 |
| 힌트 사용 | 도움 요청 → 열쇠 | 💡 아이콘 + 점진적 공개 |

### 상태 투사

```typescript
// 마이크로 인터랙션 정의
const feedbackAnimations = {
  correct: {
    scale: [1, 1.1, 1],
    backgroundColor: ['transparent', '#d4edda', 'transparent'],
    duration: 400
  },
  incorrect: {
    x: [-5, 5, -5, 5, 0],
    duration: 300
  },
  timeout: {
    opacity: [1, 0.5, 1],
    duration: 1000,
    repeat: Infinity
  }
};
```

### 설계적 은폐

| 숨길 데이터 | 이유 | 대안 표현 |
|------------|------|----------|
| Response.id | UUID 불필요 | 세션 내 순번 |
| irtThetaContribution | 전문 용어 | "능력 변화" 화살표 |
| responseContent 원시값 | 디버그 용 | 오답 시에만 비교 표시 |

---

## 5. ErrorAnalysis & ComponentErrorStats

### 스키마 구조
```prisma
model ErrorAnalysis {
  component: 'PHON' | 'MORPH' | 'LEX' | 'SYNT' | 'PRAG'
  errorType, explanation, correction
  similarErrors: JSON
}

model ComponentErrorStats {
  component, totalErrors, recentErrors,
  errorRate, trend, recommendation
}
```

### 시각적 동형성

| 데이터 | UI 매핑 | 동형성 원리 |
|--------|---------|------------|
| 5개 컴포넌트 에러율 | **캐스케이드 다이어그램** | 흐름 → 노드 연결선 |
| errorRate by component | **히트맵 행** | 강도 → 색상 농도 |
| trend | **화살표 방향** | 증감 → 상/하 방향 |
| recommendation | **액션 카드** | 텍스트 → 카드 CTA |

**언어 캐스케이드 병목 시각화:**
```
┌─────────────────────────────────────────────────┐
│           BOTTLENECK ANALYSIS                   │
│                                                 │
│   PHON ──→ MORPH ──→ LEX ──→ SYNT ──→ PRAG    │
│    ○        ⚠️        ○       ○       ○        │
│   3%       42%       8%      5%      2%        │
│                                                 │
│   ⚠️ Morphology is blocking your progress      │
│   Recommendation: Focus on word formation      │
└─────────────────────────────────────────────────┘

범례:
○ = 정상 (< 15% 에러율)
⚠️ = 주의 (15-30% 에러율)
🔴 = 병목 (> 30% 에러율)
```

### 어포던스 및 메타포

| 기능 | 메타포 | 시각적 표현 |
|------|--------|------------|
| 병목 식별 | 막힌 파이프 → 수리 | 빨간 노드 + 파동 효과 |
| 오류 분석 보기 | 현미경 → 확대 | 클릭 → 상세 모달 |
| 개선 추천 | 의사 처방 → 치료 | 처방전 스타일 카드 |

### 상태 투사

```typescript
// 병목 컴포넌트 시각적 강조
const bottleneckHighlight = {
  idle: {
    boxShadow: 'none'
  },
  warning: {
    boxShadow: '0 0 0 2px hsl(var(--color-warning))',
    animation: 'pulse 2s infinite'
  },
  critical: {
    boxShadow: '0 0 0 4px hsl(var(--color-danger))',
    animation: 'pulse 1s infinite'
  }
};
```

### 설계적 은폐

| 숨길 데이터 | 이유 | 대안 표현 |
|------------|------|----------|
| totalErrors 원시값 | 숫자 과부하 | "많음/보통/적음" |
| similarErrors JSON | 복잡한 구조 | "유사 오류 N개" 링크 |
| confidence 값 | 기술적 수치 | 숨김 (내부용) |
| source | 내부 분류 | 숨김 |

---

## 아키텍처 갭 분석 요약

### ✅ 잘 매칭된 영역

| 영역 | 백엔드 | UI | 평가 |
|------|--------|-----|------|
| User-Goal 관계 | 1:N Relation | 사이드바 드롭다운 | ✅ 동형 |
| 마스터리 5단계 | stage 0-4 | 배지/파이프라인 | ✅ 동형 |
| 세션-응답 관계 | 1:N Relation | 타임라인 | ✅ 동형 |

### ⚠️ 개선 필요 영역

| 영역 | 백엔드 | 현재 UI | 필요한 UI |
|------|--------|---------|----------|
| θ by Component | 6개 Float | 텍스트 수치 | **레이더 차트** |
| z(w) 벡터 | 7개 Float | 없음 | **병렬 좌표** |
| FSRS 스케줄 | nextReview DateTime | 숫자 | **캘린더 히트맵** |
| 병목 분석 | ComponentErrorStats | 기본 카드 | **캐스케이드 다이어그램** |
| Collocation 관계 | N:M Relation | 기본 그래프 | **Force-directed 클러스터** |

### ❌ 누락된 영역

| 백엔드 데이터 | UI 표현 | 필요한 컴포넌트 |
|--------------|---------|----------------|
| IRT 정보 함수 | 없음 | `IRTInformationCurve` |
| PMI/NPMI 값 | 없음 | `CollocationStrengthIndicator` |
| ThetaSnapshot 히스토리 | 없음 | `AbilityProgressChart` |
| OfflineQueue 상태 | 없음 | `SyncStatusIndicator` |

---

## 실리콘밸리 수준 구현 권장사항

### 1. 데이터 흐름 아키텍처

**현재:**
```
[Prisma DB] → [IPC Handler] → [Context API] → [Component]
                    ↓
              직접 호출, 캐싱 없음
```

**권장 (TanStack Query 패턴):**
```
[Prisma DB] → [IPC Handler] → [Query Client] → [Custom Hooks] → [Component]
                                    ↓
                              자동 캐싱, 리페칭, 옵티미스틱 업데이트
```

**구현 예시:**
```typescript
// hooks/useLanguageObjects.ts
export function useLanguageObjects(goalId: string) {
  return useQuery({
    queryKey: ['objects', goalId],
    queryFn: () => window.logos.objects.list(goalId),
    staleTime: 5 * 60 * 1000, // 5분 캐시
    select: (data) => transformObjectsForUI(data), // UI용 변환
  });
}
```

### 2. 컴포넌트 아키텍처

**Atomic Design 패턴:**
```
src/renderer/components/
├── atoms/           # 기본 요소 (Button, Badge, Input)
├── molecules/       # 조합 (SearchInput, StatCard)
├── organisms/       # 복합 (ProgressDashboard, SessionCard)
├── templates/       # 레이아웃 (DashboardTemplate)
└── pages/           # 페이지 (DashboardPage)
```

### 3. 상태 관리 개선

**권장 구조:**
```typescript
// stores/sessionStore.ts (Zustand)
interface SessionState {
  currentTask: Task | null;
  responses: Response[];
  phase: 'question' | 'feedback' | 'complete';

  // Actions
  submitResponse: (answer: string) => Promise<void>;
  nextTask: () => void;
  requestHint: () => Promise<string>;
}
```

### 4. 실시간 피드백 시스템

**WebSocket-like 패턴 (Electron IPC):**
```typescript
// 백그라운드 프로세스 → UI 푸시
ipcMain.on('sync:progress', (event, data) => {
  mainWindow.webContents.send('sync:progress', data);
});

// UI에서 구독
useEffect(() => {
  const unsubscribe = window.logos.sync.onProgress((progress) => {
    setSyncProgress(progress);
  });
  return unsubscribe;
}, []);
```

---

## 최종 권장 구현 순서

### Phase 1: 기반 (2주)
1. TanStack Query 통합
2. Zustand 상태 관리
3. Toast/Notification 시스템

### Phase 2: 핵심 시각화 (3주)
1. AbilityRadarChart (θ by Component)
2. MasteryPipeline (5단계)
3. FSRSCalendar (리뷰 스케줄)

### Phase 3: 고급 시각화 (2주)
1. CascadeDiagram (병목 분석)
2. ZVectorVisualization (단어 특성)
3. NetworkGraph 개선 (Collocation)

### Phase 4: 마이크로 인터랙션 (2주)
1. Framer Motion 통합
2. 동적 Liquid Glass 효과
3. 피드백 애니메이션

---

## 결론

LOGOS의 백엔드-DB 구조는 **실리콘밸리 수준의 복잡한 학습 모델**을 잘 반영하고 있습니다:

- ✅ Prisma 스키마가 IRT, FSRS, z(w) 벡터 등 학술적 모델을 정확히 캡처
- ✅ 관계형 구조가 User→Goal→Object→Response 계층을 명확히 표현
- ✅ 인덱스 설계가 쿼리 최적화를 고려

**그러나 UI가 이 복잡성을 충분히 표현하지 못하고 있습니다:**

- ❌ 7차원 z(w) 벡터가 UI에 미표현
- ❌ IRT 정보 함수, 난이도 분포 미시각화
- ❌ FSRS 스케줄이 단순 숫자로만 표시
- ❌ 병목 분석이 텍스트 위주

**철학적 관점에서:**
- 현재 UI는 "눈앞의 존재"로서 데이터를 나열하지만
- 목표는 "손안의 존재"로서 학습자가 의식하지 않고 최적 학습 경로를 따르게 하는 것

위 리모델링 계획을 따르면 **백엔드의 복잡한 알고리즘이 직관적인 시각화로 번역**되어, 진정한 "도구 존재론"적 UI를 구현할 수 있습니다.

---

## 참고 자료

- [Silicon Valley SaaS Architecture Guide 2025](https://www.decipherzone.com/blog-detail/saas-architecture-cto-guide)
- [SaaS Application Architecture Best Practices](https://acropolium.com/blog/saas-app-architecture-2022-overview/)
- [Tech Stack for SaaS in 2025](https://www.raftlabs.com/blog/how-to-choose-the-tech-stack-for-your-saas-app/)
- [SaaS Integration Best Practices](https://blog.skyvia.com/saas-integration-best-practices/)
