# LOGOS UI 리모델링 계획

## 디자인 철학 원칙

### 🎯 핵심 방향

| 원칙 | 설명 | 금지 사항 |
|------|------|----------|
| **Professional Tone** | 성인 학습자를 위한 진지하고 신뢰감 있는 UI | 유아적/캐주얼/게이미피케이션 과잉 |
| **Minimal but Symbolic** | 군더더기 없지만 필요한 심볼은 명확히 표현 | 장식적 요소, 불필요한 시각적 노이즈 |
| **Unified Theme** | 아이콘, 색상, 애니메이션의 일관된 언어 | 스타일 혼재, 임시방편 디자인 |
| **Semantic Icons** | 기호가 의미를 명확히 전달 | 모호한 아이콘, 과도한 라벨 |

### 🎨 시각적 톤 가이드

```
목표: Notion + Linear + Stripe의 교집합
- 색상: 모노크롬 기반 + 1-2개 액센트 컬러
- 타이포그래피: 깔끔한 산세리프, 계층 명확
- 공간: 넉넉한 여백, 호흡하는 레이아웃
- 아이콘: Lucide/Phosphor 스타일의 일관된 선 두께
- 애니메이션: 미묘하고 기능적인 전환 (과하지 않게)
```

### 🚫 피해야 할 패턴

| 패턴 | 문제점 | 대안 |
|------|--------|------|
| 과도한 게이미피케이션 | 학습을 게임으로 격하 | 데이터 중심 진행 표시 |
| 화려한 그라데이션 | 주의 분산, 가독성 저하 | 단색 또는 미묘한 그라데이션 |
| 둥근 캐릭터/마스코트 | 유아적 인상 | 추상적 데이터 시각화 |
| 뱃지/스티커 과잉 | 저렴한 느낌 | 숫자와 그래프로 성취 표현 |
| 과도한 파티클 애니메이션 | 산만함 | 목적 있는 미세 전환 |

### ✅ 추구하는 미학

```
IBM Carbon Design / Vercel Geist / Linear App 참조:

1. 정보 밀도: 필요한 정보를 효율적으로 배치
2. 시각적 계층: 타이포그래피 크기/굵기로 계층 구분
3. 의도적 색상: 색상은 상태/액션 표시용으로만 사용
4. 기능적 애니메이션: 상태 전환을 명확히 하는 애니메이션만
5. 일관된 아이콘 언어: 동일 의미 = 동일 아이콘
```

---

## 통합 테마 시스템

### 색상 팔레트 (Semantic Colors)

```css
/* 기본 색상 - 모노크롬 기반 */
--color-bg-primary: #0a0a0b;        /* 배경 */
--color-bg-secondary: #141415;      /* 카드, 패널 */
--color-bg-tertiary: #1e1e20;       /* 호버, 선택 */

--color-text-primary: #fafafa;      /* 주요 텍스트 */
--color-text-secondary: #a1a1aa;    /* 보조 텍스트 */
--color-text-muted: #52525b;        /* 비활성 텍스트 */

--color-border-default: #27272a;    /* 기본 테두리 */
--color-border-subtle: #1c1c1f;     /* 미묘한 구분 */

/* 시맨틱 액센트 - 의미 전달용 */
--color-success: #22c55e;           /* 정답, 완료, 상승 */
--color-error: #ef4444;             /* 오답, 경고, 하락 */
--color-warning: #f59e0b;           /* 주의, 대기 */
--color-info: #3b82f6;              /* 정보, 링크, 액션 */

/* 마스터리 단계 색상 */
--color-stage-unknown: #3f3f46;     /* Stage 0: Unknown */
--color-stage-recognition: #6366f1; /* Stage 1: Recognition */
--color-stage-recall: #8b5cf6;      /* Stage 2: Recall */
--color-stage-production: #a855f7;  /* Stage 3: Production */
--color-stage-automatic: #22c55e;   /* Stage 4: Automatic */

/* 언어 컴포넌트 색상 */
--color-phonology: #06b6d4;         /* 음운론 */
--color-morphology: #8b5cf6;        /* 형태론 */
--color-lexical: #f59e0b;           /* 어휘 */
--color-syntactic: #ef4444;         /* 통사론 */
--color-pragmatic: #22c55e;         /* 화용론 */
```

### 아이콘 시스템 (Lucide Icons 기반)

```
일관된 아이콘 매핑:

[학습 상태]
○ CircleDashed    - 미학습 (Unknown)
◐ CircleHalf      - 인식 단계 (Recognition)
◑ CircleDot       - 회상 단계 (Recall)
● Circle          - 생산 단계 (Production)
✓ CheckCircle     - 자동화 (Automatic)

[액션]
▶ Play            - 학습 시작
⏸ Pause           - 일시정지
↻ RotateCcw       - 다시 시도
→ ArrowRight      - 다음
← ArrowLeft       - 이전

[데이터/분석]
📊 BarChart3       - 통계/분석
📈 TrendingUp      - 상승 추세
📉 TrendingDown    - 하락 추세
🎯 Target          - 목표/정확도
⚡ Zap             - 속도/응답시간

[언어 컴포넌트]
🔊 Volume2         - 음운론 (Phonology)
🧩 Puzzle          - 형태론 (Morphology)
📖 BookOpen        - 어휘 (Lexical)
🔗 Link            - 통사론 (Syntactic)
💬 MessageCircle   - 화용론 (Pragmatic)

[시스템]
⚙ Settings        - 설정
👤 User            - 사용자
📅 Calendar        - 일정
🔔 Bell            - 알림
⌨ Keyboard        - 단축키
```

### 애니메이션 가이드라인

```typescript
// 기본 전환 - 모든 상태 변화에 적용
const baseTransition = {
  duration: 0.15,
  ease: [0.4, 0, 0.2, 1]  // ease-out
};

// 진입 애니메이션 - 모달, 패널, 카드
const enterTransition = {
  duration: 0.2,
  ease: [0, 0, 0.2, 1]
};

// 강조 애니메이션 - 정답/오답 피드백
const emphasisTransition = {
  duration: 0.3,
  ease: [0.34, 1.56, 0.64, 1]  // spring-like
};

// 금지: 파티클, 반짝임, 바운스, 1초 이상 애니메이션
```

### 타이포그래피 계층

```css
/* 제목 계층 */
--font-size-h1: 1.875rem;  /* 30px - 페이지 제목 */
--font-size-h2: 1.5rem;    /* 24px - 섹션 제목 */
--font-size-h3: 1.25rem;   /* 20px - 카드 제목 */
--font-size-h4: 1.125rem;  /* 18px - 소제목 */

/* 본문 계층 */
--font-size-body: 1rem;    /* 16px - 기본 텍스트 */
--font-size-small: 0.875rem; /* 14px - 보조 텍스트 */
--font-size-xs: 0.75rem;   /* 12px - 캡션, 라벨 */

/* 굵기 */
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;

/* 행간 */
--line-height-tight: 1.25;
--line-height-normal: 1.5;
--line-height-relaxed: 1.75;
```

---

## 현재 상태 분석

### ✅ 잘 구축된 부분

| 영역 | 현재 상태 | 평가 |
|------|----------|------|
| **디자인 토큰** | CSS 변수 기반 완전한 시스템 | ⭐⭐⭐⭐⭐ |
| **Liquid Glass 스타일** | backdrop-filter, blur, 반투명 구현 완료 | ⭐⭐⭐⭐ |
| **컴포넌트 구조** | Glass 기반 Card, Button, Input, Badge, Progress | ⭐⭐⭐⭐ |
| **레이아웃 시스템** | AppShell, Sidebar, 반응형 지원 | ⭐⭐⭐⭐ |
| **다크 모드** | CSS 변수 기반 테마 전환 | ⭐⭐⭐⭐ |
| **접근성** | focus-visible, 키보드 단축키 | ⭐⭐⭐ |

### ⚠️ 개선 필요 영역

| 영역 | 문제점 | 우선순위 |
|------|--------|----------|
| **데이터 시각화** | 기본 차트만 존재, IRT/FSRS 시각화 부재 | 🔴 높음 |
| **마이크로 인터랙션** | 애니메이션 부족, 정적인 느낌 | 🔴 높음 |
| **백엔드 연동 UI** | z(w) 벡터, 병목 분석 등 미표현 | 🔴 높음 |
| **학습 세션 UX** | 과제 유형별 특화 UI 부재 | 🟡 중간 |
| **온보딩 플로우** | 기본 위자드만 존재 | 🟡 중간 |
| **알림/피드백 시스템** | Toast/Snackbar 미구현 | 🟡 중간 |

---

## 업계 벤치마크 분석

### 참조 대상 앱 (프로페셔널 톤)

| 앱 | 디자인 철학 | LOGOS에 적용할 점 |
|----|------------|-------------------|
| **Linear** | 미니멀, 키보드 중심, 데이터 밀도 | 단축키 시스템, 정보 계층, 빠른 네비게이션 |
| **Notion** | 블록 기반, 깔끔한 타이포그래피 | 콘텐츠 중심 레이아웃, 유연한 구조 |
| **Anki** | 데이터 중심, 기능 우선 | SRS 통계, 간격 시각화, 효율성 |
| **Babbel** | 성인 타겟, 미니멀 | 집중 학습 모드, 깔끔한 진행 표시 |

### 참조하지 않을 앱

| 앱 | 이유 |
|----|------|
| **Duolingo** | 과도한 게이미피케이션, 유아적 캐릭터, 색상 과잉 |
| **Memrise** | 밈 기반 학습, 비전문적 톤 |
| **Mondly** | 게이미피케이션 과잉, 산만한 UI |

### SaaS Dashboard 베스트 프랙티스

1. **시각적 계층** - 크기, 색상, 배치로 KPI 강조
2. **점진적 공개** - 인지 과부하 방지
3. **사용자 정의** - 위젯 추가/제거/재배치
4. **일관성** - 통일된 색상, 타이포그래피, 아이콘
5. **성능** - 빠른 로딩, lazy loading

### Apple Liquid Glass (2025)

```
특징:
- 실시간 렌더링
- 물리적 깊이감
- 빛/움직임에 반응
- 적응형 투명도
- 접근성 고대비 모드
```

**현재 LOGOS는 기본적인 glassmorphism만 구현 → Apple의 동적 Liquid Glass로 업그레이드 필요**

---

## 백엔드 데이터 모델 → UI 매핑

### 1. IRT (Item Response Theory)

```
데이터: θ (theta), a (discrimination), b (difficulty)
```

| 데이터 | 현재 UI | 목표 UI |
|--------|---------|---------|
| θ by Component | 텍스트 수치 | **레이더 차트** + CEFR 레벨 시각화 |
| Item Difficulty | 없음 | **열 지도** - 난이도 분포 |
| Information Function | 없음 | **곡선 차트** - 측정 정밀도 시각화 |

**컴포넌트 필요:**
- `AbilityRadarChart` - PHON/MORPH/LEX/SYNT/PRAG 레이더
- `DifficultyHeatmap` - 난이도 분포 시각화
- `IRTCurveChart` - 정보 함수 곡선

### 2. FSRS (Free Spaced Repetition Scheduler)

```
데이터: stability, difficulty, due_date, retrievability
```

| 데이터 | 현재 UI | 목표 UI |
|--------|---------|---------|
| Due Count | 숫자 표시 | **캘린더 히트맵** + 예측 시각화 |
| Stability | 없음 | **메모리 강도 게이지** |
| Review Schedule | 없음 | **타임라인 뷰** |

**컴포넌트 필요:**
- `FSRSCalendar` - 리뷰 일정 캘린더 (GitHub 스타일)
- `StabilityGauge` - 기억 안정성 원형 게이지
- `ReviewTimeline` - 예정 리뷰 타임라인

### 3. z(w) Vector (FRE Priority)

```
데이터: frequency, relational_density, engagement,
       morphological, phonological, pragmatic, syntactic
```

| 데이터 | 현재 UI | 목표 UI |
|--------|---------|---------|
| z Vector | 없음 | **다차원 시각화** - 단어별 특성 |
| Priority Score | 없음 | **우선순위 큐** - 학습 대기열 |

**컴포넌트 필요:**
- `ZVectorVisualization` - 7차원 벡터 시각화
- `PriorityQueue` - 학습 우선순위 목록

### 4. 5-Stage Mastery System

```
단계: Unknown → Recognition → Recall → Production → Automatic
```

| 데이터 | 현재 UI | 목표 UI |
|--------|---------|---------|
| Stage Distribution | 숫자 + 배지 | **단계별 진행 파이프라인** |
| Stage Progression | 없음 | **애니메이션 전환** |

**컴포넌트 필요:**
- `MasteryPipeline` - 5단계 파이프라인 시각화
- `MasteryTransition` - 단계 전환 애니메이션

### 5. Bottleneck Detection

```
데이터: component, error_rate, confidence, recommendation
```

| 데이터 | 현재 UI | 목표 UI |
|--------|---------|---------|
| Primary Bottleneck | 기본 카드 | **언어 캐스케이드 다이어그램** |
| Error Pattern | 없음 | **산키 다이어그램** - 오류 흐름 |

**컴포넌트 필요:**
- `CascadeDiagram` - PHON→MORPH→LEX→SYNT→PRAG 흐름
- `ErrorSankeyChart` - 오류 원인 추적 시각화

---

## UI 리모델링 단계별 계획

### Phase 1: 기반 강화 (필수)

#### 1.1 컴포넌트 라이브러리 업그레이드

**현재:** 순수 CSS + 인라인 스타일
**목표:** shadcn/ui + Radix UI 기반

```
설치할 의존성:
- @radix-ui/react-* (primitives)
- tailwindcss v4
- framer-motion (애니메이션)
- recharts 또는 visx (차트)
- react-hook-form + zod (폼 검증)
```

**파일 구조 변경:**
```
src/renderer/
├── components/
│   ├── ui/           # 기본 컴포넌트 (현재)
│   ├── charts/       # 데이터 시각화 (NEW)
│   ├── feedback/     # Toast, Alert, Modal (NEW)
│   └── learning/     # 학습 특화 컴포넌트 (NEW)
```

#### 1.2 애니메이션 시스템

**Framer Motion 통합:**
```typescript
// 예시: Liquid Glass 동적 효과
const liquidGlassVariants = {
  initial: { opacity: 0, scale: 0.96, y: 10 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 30
    }
  },
  exit: { opacity: 0, scale: 0.96, y: -10 }
};
```

### Phase 2: 데이터 시각화 (핵심)

#### 2.1 Analytics Dashboard 리디자인

**현재 문제:**
- 기본 숫자/배지만 표시
- IRT theta 값이 단순 텍스트

**목표 디자인:**

```
┌─────────────────────────────────────────────────────────┐
│                   ABILITY OVERVIEW                      │
│  ┌─────────────┐  ┌─────────────────────────────────┐  │
│  │   RADAR     │  │     MASTERY PIPELINE            │  │
│  │   CHART     │  │  [●]→[●]→[●]→[○]→[○]           │  │
│  │  PHON/MORPH │  │   523  142   89   24    0      │  │
│  │  /LEX/SYNT  │  │ Unknown→Recog→Recall→Prod→Auto │  │
│  └─────────────┘  └─────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│                BOTTLENECK ANALYSIS                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │  PHON ──┬─→ MORPH ──┬─→ LEX ──→ SYNT ──→ PRAG  │   │
│  │    │    │           ⚠️ 42%                       │   │
│  │    └────┴─────────────────────────────────────  │   │
│  │  Your morphological processing needs work       │   │
│  └─────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│                 FSRS CALENDAR                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Mon Tue Wed Thu Fri Sat Sun                    │   │
│  │  [░] [▓] [▓] [░] [▓] [░] [░]  ← Review load     │   │
│  │  [▓] [▓] [░] [░] [▓] [░] [░]                    │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

#### 2.2 세션 뷰 리디자인

**과제 유형별 특화 UI:**

| 과제 유형 | 현재 | 목표 UI |
|----------|------|---------|
| MCQ | 기본 버튼 | 카드형 + 선택 애니메이션 |
| Fill Blank | 기본 input | 컨텍스트 하이라이트 + 자동완성 |
| Typing | 기본 input | 실시간 문자별 피드백 (✓ 있음, 개선 필요) |
| Dictation | 없음 | 오디오 파형 + 타이핑 |
| Register Shift | 없음 | 포멀리티 스케일 슬라이더 |

### Phase 3: 마이크로 인터랙션

#### 3.1 상태 전환 애니메이션

```typescript
// 정답 시 피드백
const correctFeedback = {
  initial: { scale: 1 },
  animate: {
    scale: [1, 1.1, 1],
    backgroundColor: ['#fff', '#d4edda', '#fff']
  }
};

// 마스터리 단계 상승
const masteryLevelUp = {
  initial: { y: 0, opacity: 1 },
  levelUp: {
    y: [-20, 0],
    scale: [1, 1.3, 1],
    opacity: [1, 1, 1]
  }
};
```

#### 3.2 Liquid Glass 동적 효과

```css
/* 마우스 움직임에 반응하는 specular highlight */
.liquid-glass-dynamic {
  --mouse-x: 50%;
  --mouse-y: 50%;
  background:
    radial-gradient(
      circle at var(--mouse-x) var(--mouse-y),
      hsl(0 0% 100% / 0.3) 0%,
      transparent 50%
    ),
    hsl(var(--glass-tint-light) / 0.7);
}
```

### Phase 4: 고급 시각화

#### 4.1 네트워크 그래프 개선

**현재:** D3 기반 기본 그래프
**목표:**
- Force-directed layout with clusters
- 마스터리 단계별 노드 색상
- 호버 시 관련 연결 하이라이트
- 줌/팬 제스처 지원

#### 4.2 학습 이력 타임라인

```
Timeline Component:
┌────────────────────────────────────────┐
│  Today        Yesterday     3 days ago │
│    ↓              ↓             ↓      │
│  ┌──┐          ┌──┐          ┌──┐     │
│  │85%│         │72%│         │68%│     │
│  │acc│         │acc│         │acc│     │
│  └──┘          └──┘          └──┘     │
│  25 items     18 items     32 items   │
└────────────────────────────────────────┘
```

---

## 파일별 수정 계획

### 신규 생성 파일

```
src/renderer/
├── components/
│   ├── charts/
│   │   ├── AbilityRadarChart.tsx       # IRT theta 레이더
│   │   ├── MasteryPipeline.tsx         # 5단계 파이프라인
│   │   ├── FSRSCalendar.tsx            # 리뷰 캘린더
│   │   ├── CascadeDiagram.tsx          # 언어 캐스케이드
│   │   ├── ZVectorVisualization.tsx    # z(w) 벡터 시각화
│   │   └── ErrorSankeyChart.tsx        # 오류 흐름 산키
│   │
│   ├── feedback/
│   │   ├── Toast.tsx                   # 알림 토스트
│   │   ├── ConfirmDialog.tsx           # 확인 다이얼로그
│   │   └── SuccessAnimation.tsx        # 성공 애니메이션
│   │
│   └── learning/
│       ├── DictationTask.tsx           # 받아쓰기 과제
│       ├── RegisterShiftTask.tsx       # 레지스터 전환 과제
│       └── TimedChallenge.tsx          # 시간제한 챌린지
│
├── hooks/
│   ├── useMousePosition.ts             # 마우스 위치 추적
│   └── useLiquidGlass.ts               # 동적 유리 효과
│
└── styles/
    ├── animations.css                  # 애니메이션 정의
    └── liquid-glass-advanced.css       # 고급 유리 효과
```

### 수정 필요 파일

| 파일 | 수정 내용 |
|------|----------|
| `ProgressDashboard.tsx` | 레이더 차트, 파이프라인 통합 |
| `SessionView.tsx` | 과제별 특화 UI, 애니메이션 |
| `NetworkGraph.tsx` | 클러스터링, 인터랙션 개선 |
| `FeedbackCard.tsx` | 성공/실패 애니메이션 |
| `design-tokens.css` | OKLCH 색상, 추가 토큰 |
| `glass.css` | 동적 Liquid Glass 효과 |

---

## 구현 우선순위

### 🔴 높음 (즉시)

1. **Framer Motion 통합** - 모든 전환에 애니메이션
2. **AbilityRadarChart** - IRT theta 시각화
3. **MasteryPipeline** - 5단계 진행 시각화
4. **Toast/Snackbar** - 피드백 시스템

### 🟡 중간 (다음 단계)

5. **FSRSCalendar** - 리뷰 일정 시각화
6. **CascadeDiagram** - 병목 분석 다이어그램
7. **동적 Liquid Glass** - 마우스 반응 효과
8. **과제별 특화 UI** - DictationTask, RegisterShiftTask

### 🟢 낮음 (향후)

9. **ZVectorVisualization** - 단어 특성 시각화
10. **ErrorSankeyChart** - 오류 흐름 분석
11. **고급 네트워크 그래프** - 클러스터링, 줌/팬

---

## 기술 스택 권장

### 필수 의존성

```json
{
  "dependencies": {
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-dropdown-menu": "^2.1.0",
    "@radix-ui/react-tooltip": "^1.1.0",
    "@radix-ui/react-progress": "^1.1.0",
    "framer-motion": "^11.0.0",
    "recharts": "^2.12.0",
    "react-hot-toast": "^2.4.1",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0"
  }
}
```

### 선택적 의존성

```json
{
  "devDependencies": {
    "@storybook/react": "^8.0.0",      // 컴포넌트 문서화
    "chromatic": "^11.0.0"              // 시각적 회귀 테스트
  }
}
```

---

## 참고 자료

### 벤치마크 소스

- [Apple Liquid Glass 소개](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/)
- [Glassmorphism in 2025](https://www.everydayux.net/glassmorphism-apple-liquid-glass-interface-design/)
- [SaaS Dashboard Design Best Practices](https://adamfard.com/blog/saas-dashboard-design)
- [shadcn/ui 공식 문서](https://ui.shadcn.com/)
- [ShadCN vs Radix vs Tailwind UI 비교](https://javascript.plainenglish.io/shadcn-ui-vs-radix-ui-vs-tailwind-ui-which-should-you-choose-in-2025-b8b4cadeaa25)
- [Best Shadcn UI Component Libraries 2025](https://www.devkit.best/blog/mdx/shadcn-ui-libraries-comparison-2025)
- [Duolingo vs Babbel UI 비교](https://www.babbel.com/compare-best-language-learning-apps)

---

## 요약

현재 LOGOS UI는 **기본적인 Liquid Glass 디자인 시스템이 잘 구축**되어 있지만, 다음 영역에서 업그레이드가 필요합니다:

1. **데이터 시각화** - IRT, FSRS, z(w) 벡터 등 백엔드 모델을 시각적으로 표현
2. **마이크로 인터랙션** - Framer Motion으로 모든 전환에 애니메이션 추가
3. **동적 Liquid Glass** - Apple 스타일의 빛/움직임 반응 효과
4. **학습 특화 UI** - 과제 유형별 최적화된 인터페이스

이 계획을 따르면 **3류 AI 생성 UI에서 프로덕션 수준 SaaS UI**로 전환할 수 있습니다.
