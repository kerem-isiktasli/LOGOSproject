# LOGOS 100% 완성 계획

> **목표**: 모든 검증 영역을 100%로 끌어올리기
> **현재 상태**: 80% → **목표**: 100%
> **작성일**: 2026-01-06

---

## 영역별 현재 → 목표

| 영역 | 현재 | 목표 | Gap |
|------|------|------|-----|
| 핵심 알고리즘 | 95% | 100% | +5% |
| 서비스 레이어 | 88% | 100% | +12% |
| IPC 레이어 | 82% | 100% | +18% |
| 데이터베이스 스키마 | 86% | 100% | +14% |
| UI/렌더러 | 72% | 100% | +28% |
| 테스트 커버리지 | 55% | 100% | +45% |

---

## Phase 1: 핵심 알고리즘 95% → 100%

### 1.1 3PL 추측 파라미터 추가
**파일**: `src/core/irt.ts`, `prisma/schema.prisma`

```typescript
// irt.ts에 추가
interface Item3PL {
  a: number;  // discrimination (현재 있음)
  b: number;  // difficulty (현재 있음)
  c: number;  // guessing (추가 필요)
}

function probability3PL(theta: number, item: Item3PL): number {
  return item.c + (1 - item.c) / (1 + Math.exp(-item.a * (theta - item.b)));
}
```

**작업 항목**:
- [ ] `irt.ts`에 3PL 확률 함수 추가
- [ ] `irt.ts`에 3PL용 MLE 추정 추가
- [ ] `schema.prisma`에 `guessingC Float @default(0.25)` 필드 추가
- [ ] 마이그레이션 실행
- [ ] 테스트 케이스 추가

### 1.2 θ 캘리브레이션 범위 문서화
**파일**: `docs/ALGORITHMIC-FOUNDATIONS.md`

```markdown
## θ Range Rationale
- 표준 IRT: [-3, 3]
- LOGOS 구현: [-4, 4]
- 근거: 극단적 학습자 수용, 초기 불확실성 허용
```

**예상 작업량**: 8시간

---

## Phase 2: 서비스 레이어 88% → 100%

### 2.1 트랜잭션 추가
**파일**: `src/main/services/scoring-update.service.ts`

```typescript
// Before (현재)
await updateMasteryState(objectId, newState);
await updateThetaEstimate(userId, newTheta);
await recordResponse(sessionId, response);

// After (수정)
await prisma.$transaction(async (tx) => {
  await tx.masteryState.update({ ... });
  await tx.thetaSnapshot.create({ ... });
  await tx.response.create({ ... });
});
```

**작업 항목**:
- [ ] `scoring-update.service.ts` 전체 트랜잭션 래핑
- [ ] `state-priority.service.ts` 벌크 업데이트 트랜잭션화
- [ ] 롤백 테스트 케이스 작성

### 2.2 메모리 캐시 만료 메커니즘
**파일**: `src/main/services/task-generation.service.ts`

```typescript
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  accessCount: number;
}

class TaskCache {
  private cache = new Map<string, CacheEntry<GeneratedTask>>();
  private maxSize = 1000;
  private defaultTTL = 30 * 60 * 1000; // 30분

  set(key: string, value: GeneratedTask, ttl = this.defaultTTL): void {
    this.evictExpired();
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
      accessCount: 0,
    });
  }

  get(key: string): GeneratedTask | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    entry.accessCount++;
    return entry.value;
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) this.cache.delete(key);
    }
  }

  private evictLRU(): void {
    let minAccess = Infinity;
    let minKey = '';
    for (const [key, entry] of this.cache) {
      if (entry.accessCount < minAccess) {
        minAccess = entry.accessCount;
        minKey = key;
      }
    }
    if (minKey) this.cache.delete(minKey);
  }
}
```

### 2.3 에러 복구 및 재시도 로직
**파일**: `src/main/services/corpus-pipeline.service.ts`

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number; backoff: number } = { maxRetries: 3, backoff: 1000 }
): Promise<T> {
  let lastError: Error;
  for (let i = 0; i <= options.maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < options.maxRetries) {
        await sleep(options.backoff * Math.pow(2, i));
      }
    }
  }
  throw lastError!;
}
```

### 2.4 성능 최적화
**파일**: 여러 서비스 파일

```typescript
// 배치 처리 최적화
async function batchProcess<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize = 50
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }
  return results;
}
```

**예상 작업량**: 16시간

---

## Phase 3: IPC 레이어 82% → 100%

### 3.1 입력값 검증 강화
**파일**: `src/main/ipc/learning.ipc.ts`, `src/main/ipc/session.ipc.ts` 등

```typescript
import { z } from 'zod';

// 스키마 정의
const QueueGetSchema = z.object({
  goalId: z.string().uuid(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

const SessionStartSchema = z.object({
  goalId: z.string().uuid(),
  mode: z.enum(['normal', 'fluency', 'review']),
  targetDuration: z.number().int().min(60).max(7200).optional(),
});

// 핸들러에서 사용
ipcMain.handle('queue:get', async (event, data: unknown) => {
  const parsed = QueueGetSchema.safeParse(data);
  if (!parsed.success) {
    return error(`Invalid input: ${parsed.error.message}`);
  }
  const { goalId, limit, offset } = parsed.data;
  // ... 기존 로직
});
```

**작업 항목**:
- [ ] Zod 스키마 정의 (`src/shared/schemas/`)
- [ ] 모든 IPC 핸들러에 검증 적용
- [ ] 검증 실패 시 명확한 에러 메시지

### 3.2 타입 안전성 강화
**파일**: 모든 IPC 핸들러

```typescript
// Before
const item = data as QueueItemResponse;  // 위험

// After
function assertQueueItem(data: unknown): asserts data is QueueItemResponse {
  if (!data || typeof data !== 'object') {
    throw new TypeError('Expected QueueItemResponse object');
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.id !== 'string') {
    throw new TypeError('QueueItemResponse.id must be string');
  }
  // ... 모든 필드 검증
}
```

### 3.3 타임아웃 및 취소 처리
**파일**: `src/main/ipc/claude.ipc.ts`

```typescript
import { AbortController } from 'node-abort-controller';

async function callClaudeWithTimeout(
  prompt: string,
  timeoutMs = 30000
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: prompt }],
      signal: controller.signal,
    });
    return response.content[0].text;
  } finally {
    clearTimeout(timeout);
  }
}
```

### 3.4 Rate Limiting
**파일**: `src/main/ipc/claude.ipc.ts`

```typescript
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second

  constructor(maxTokens = 10, refillRate = 1) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens < 1) {
      const waitTime = (1 - this.tokens) / this.refillRate * 1000;
      await sleep(waitTime);
      this.refill();
    }
    this.tokens--;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}
```

### 3.5 서비스 레이어 완전 연결
**파일**: `src/main/ipc/learning.ipc.ts`

```typescript
// task-generation.service 연결
import { getOrGenerateTask } from '../services/task-generation.service';

ipcMain.handle('queue:get', async (event, data) => {
  // ... 검증 후
  const queueItems = await getQueueForSession(goalId, limit);

  // 각 아이템에 태스크 생성
  const itemsWithTasks = await Promise.all(
    queueItems.map(async (item) => {
      const task = await getOrGenerateTask(item, { fluencyRatio: 0.3 });
      return { ...item, task };
    })
  );

  return success(itemsWithTasks);
});
```

**예상 작업량**: 20시간

---

## Phase 4: 데이터베이스 스키마 86% → 100%

### 4.1 누락 필드 추가
**파일**: `prisma/schema.prisma`

```prisma
model LanguageObject {
  // 기존 필드들...

  // 3PL 추측 파라미터 추가
  guessingC     Float    @default(0.25)
}

model StageTransition {
  id            String   @id @default(uuid())
  masteryStateId String
  masteryState  MasteryState @relation(fields: [masteryStateId], references: [id])
  fromStage     Int
  toStage       Int
  trigger       String   // "correct_streak" | "time_decay" | "manual"
  timestamp     DateTime @default(now())
  metadata      Json?

  @@index([masteryStateId])
  @@index([timestamp])
}

model MasteryState {
  // 기존 필드들...

  // Stage 전이 로그 관계 추가
  transitions   StageTransition[]
}
```

### 4.2 인덱스 최적화
**파일**: `prisma/schema.prisma`

```prisma
model ThetaSnapshot {
  // 기존 필드들...

  @@index([userId, sessionId])
  @@index([userId, createdAt])
  @@index([sessionId, createdAt])
}

model Response {
  // 기존 필드들...

  @@index([sessionId, timestamp])
  @@index([languageObjectId, isCorrect])
}
```

### 4.3 Modality 필드 정규화
**파일**: `prisma/schema.prisma`

```prisma
// Option A: Enum 배열 (PostgreSQL만 지원)
enum Modality {
  VISUAL
  AUDITORY
  KINESTHETIC
}

model GoalSpec {
  modalities Modality[]
}

// Option B: 관계 테이블 (SQLite 호환)
model GoalModality {
  id        String   @id @default(uuid())
  goalId    String
  goal      GoalSpec @relation(fields: [goalId], references: [id])
  modality  String   // "visual" | "auditory" | "kinesthetic"

  @@unique([goalId, modality])
}
```

### 4.4 데이터 무결성 제약조건
**파일**: `prisma/schema.prisma`

```prisma
model MasteryState {
  stage             Int      @default(0)
  cueFreeAccuracy   Float    @default(0)
  cueAssistedAccuracy Float  @default(0)

  // 제약조건 (Prisma는 CHECK 미지원, 앱 레벨에서 검증)
  // stage: 0-4
  // accuracy: 0-1
}
```

**앱 레벨 검증 추가**:
```typescript
// src/main/db/validators.ts
export function validateMasteryState(state: Partial<MasteryState>): void {
  if (state.stage !== undefined && (state.stage < 0 || state.stage > 4)) {
    throw new Error('stage must be 0-4');
  }
  if (state.cueFreeAccuracy !== undefined &&
      (state.cueFreeAccuracy < 0 || state.cueFreeAccuracy > 1)) {
    throw new Error('cueFreeAccuracy must be 0-1');
  }
}
```

**예상 작업량**: 12시간

---

## Phase 5: UI/렌더러 72% → 100%

### 5.1 서버 태스크 스펙 사용
**파일**: `src/renderer/pages/SessionPage.tsx`

```typescript
// Before: 클라이언트에서 하드코딩된 태스크 생성
const transformQueueToTasks = (items: QueueItemResponse[]): Task[] => {
  return items.map((item, index) => ({
    format: index % 3 === 0 ? 'mcq' : 'fill',  // 하드코딩 제거
    // ...
  }));
};

// After: 서버에서 받은 태스크 스펙 사용
const transformQueueToTasks = (items: QueueItemWithTask[]): Task[] => {
  return items.map((item) => ({
    id: item.id,
    objectId: item.languageObjectId,
    word: item.word,
    format: item.task.format,           // 서버에서 결정
    difficulty: item.task.difficulty,   // 서버에서 결정
    cueLevel: item.task.cueLevel,       // 서버에서 결정
    prompt: item.task.prompt,           // 서버에서 생성
    options: item.task.options,         // 서버에서 생성
    hints: item.task.hints,             // 서버에서 생성
    expectedAnswer: item.task.expectedAnswer,
  }));
};
```

### 5.2 에러 복구 UI
**파일**: `src/renderer/components/feedback/ErrorBoundary.tsx`

```typescript
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class ErrorBoundary extends React.Component<Props, ErrorBoundaryState> {
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    // 에러 로깅
    console.error('UI Error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-container">
          <h2>문제가 발생했습니다</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={this.handleRetry}>다시 시도</button>
          <button onClick={() => window.location.reload()}>
            새로고침
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

### 5.3 네트워크 에러 처리
**파일**: `src/renderer/hooks/useLogos.ts`

```typescript
interface NetworkError {
  type: 'network' | 'timeout' | 'server';
  message: string;
  retryable: boolean;
}

function useAsyncWithRetry<T>(
  asyncFn: () => Promise<T>,
  deps: any[] = [],
  options: { maxRetries: number; retryDelay: number } = { maxRetries: 3, retryDelay: 1000 }
) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const [retryCount, setRetryCount] = useState(0);

  const execute = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    for (let i = 0; i <= options.maxRetries; i++) {
      try {
        const data = await asyncFn();
        setState({ data, loading: false, error: null });
        setRetryCount(0);
        return;
      } catch (error) {
        if (i === options.maxRetries) {
          setState({ data: null, loading: false, error: error as Error });
          setRetryCount(i);
        } else {
          await sleep(options.retryDelay * Math.pow(2, i));
        }
      }
    }
  }, [asyncFn, ...deps]);

  useEffect(() => { execute(); }, [execute]);

  return { ...state, retry: execute, retryCount };
}
```

### 5.4 상태 관리 개선
**파일**: `src/renderer/context/SessionContext.tsx` (새 파일)

```typescript
interface SessionState {
  status: 'idle' | 'loading' | 'active' | 'paused' | 'completed' | 'error';
  sessionId: string | null;
  tasks: Task[];
  currentTaskIndex: number;
  responses: Response[];
  startTime: number | null;
  error: Error | null;
}

type SessionAction =
  | { type: 'START_SESSION'; payload: { sessionId: string; tasks: Task[] } }
  | { type: 'SUBMIT_RESPONSE'; payload: Response }
  | { type: 'NEXT_TASK' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'COMPLETE' }
  | { type: 'ERROR'; payload: Error };

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'START_SESSION':
      return {
        ...state,
        status: 'active',
        sessionId: action.payload.sessionId,
        tasks: action.payload.tasks,
        currentTaskIndex: 0,
        startTime: Date.now(),
      };
    case 'SUBMIT_RESPONSE':
      return {
        ...state,
        responses: [...state.responses, action.payload],
      };
    case 'NEXT_TASK':
      const nextIndex = state.currentTaskIndex + 1;
      return {
        ...state,
        currentTaskIndex: nextIndex,
        status: nextIndex >= state.tasks.length ? 'completed' : 'active',
      };
    // ... 기타 액션들
  }
}
```

### 5.5 Stage 전이 애니메이션
**파일**: `src/renderer/components/feedback/StageTransition.tsx`

```typescript
import { motion, AnimatePresence } from 'framer-motion';

interface StageTransitionProps {
  fromStage: number;
  toStage: number;
  onComplete: () => void;
}

const stageNames = ['Unknown', 'Recognition', 'Recall', 'Production', 'Automatic'];
const stageColors = ['#9CA3AF', '#60A5FA', '#34D399', '#FBBF24', '#F472B6'];

export const StageTransition: React.FC<StageTransitionProps> = ({
  fromStage,
  toStage,
  onComplete,
}) => {
  return (
    <AnimatePresence onExitComplete={onComplete}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.2 }}
        className="stage-transition-overlay"
      >
        <motion.div
          initial={{ x: -50 }}
          animate={{ x: 50 }}
          transition={{ duration: 0.5 }}
        >
          <span style={{ color: stageColors[fromStage] }}>
            {stageNames[fromStage]}
          </span>
          <span className="arrow">→</span>
          <span style={{ color: stageColors[toStage] }}>
            {stageNames[toStage]}
          </span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          레벨 업! 🎉
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
```

### 5.6 접근성 (ARIA) 추가
**파일**: 모든 UI 컴포넌트

```typescript
// Button 컴포넌트
<button
  aria-label={ariaLabel}
  aria-pressed={isPressed}
  aria-disabled={disabled}
  role="button"
  tabIndex={disabled ? -1 : 0}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  }}
>
  {children}
</button>

// MCQ 옵션
<div role="radiogroup" aria-label="답변 선택">
  {options.map((option, index) => (
    <div
      key={index}
      role="radio"
      aria-checked={selected === index}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          setSelected(index);
        }
        if (e.key === 'ArrowDown') {
          // 다음 옵션으로 포커스
        }
      }}
    >
      {option}
    </div>
  ))}
</div>
```

### 5.7 키보드 내비게이션
**파일**: `src/renderer/hooks/useKeyboardNavigation.ts`

```typescript
export function useKeyboardNavigation(options: {
  onNext?: () => void;
  onPrevious?: () => void;
  onSubmit?: () => void;
  onCancel?: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 입력 필드에서는 비활성화
      if (e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
        case 'j':
          options.onNext?.();
          break;
        case 'ArrowLeft':
        case 'k':
          options.onPrevious?.();
          break;
        case 'Enter':
          options.onSubmit?.();
          break;
        case 'Escape':
          options.onCancel?.();
          break;
        case '1':
        case '2':
        case '3':
        case '4':
          // MCQ 빠른 선택
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [options]);
}
```

### 5.8 반응형 디자인 완성
**파일**: `src/renderer/styles/responsive.css`

```css
/* 모바일 (< 640px) */
@media (max-width: 639px) {
  .sidebar { display: none; }
  .mobile-nav { display: flex; }
  .task-card { padding: 1rem; }
  .mcq-options { flex-direction: column; }
}

/* 태블릿 (640px - 1024px) */
@media (min-width: 640px) and (max-width: 1023px) {
  .sidebar { width: 60px; }
  .sidebar-label { display: none; }
}

/* 데스크톱 (>= 1024px) */
@media (min-width: 1024px) {
  .sidebar { width: 240px; }
}
```

**예상 작업량**: 32시간

---

## Phase 6: 테스트 커버리지 55% → 100%

### 6.1 서비스 레이어 테스트
**파일**: `tests/services/`

```typescript
// task-generation.service.test.ts
describe('TaskGenerationService', () => {
  describe('selectTaskFormat', () => {
    it('should select MCQ for stage 0-1', async () => {
      const format = selectTaskFormat({ stage: 0 });
      expect(format).toBe('mcq');
    });

    it('should select fill-blank for stage 2', async () => {
      const format = selectTaskFormat({ stage: 2 });
      expect(format).toBe('fill');
    });

    it('should select production for stage 3-4', async () => {
      const format = selectTaskFormat({ stage: 4 });
      expect(format).toBe('production');
    });
  });

  describe('generateTask', () => {
    it('should generate task with correct difficulty', async () => {
      const task = await generateTask(mockQueueItem, mockConfig);
      expect(task.difficulty).toBeCloseTo(mockQueueItem.difficulty, 1);
    });

    it('should use cache for repeated requests', async () => {
      const task1 = await generateTask(mockQueueItem, mockConfig);
      const task2 = await generateTask(mockQueueItem, mockConfig);
      expect(task1).toBe(task2); // Same reference
    });
  });
});

// scoring-update.service.test.ts
describe('ScoringUpdateService', () => {
  describe('updateMasteryAfterResponse', () => {
    it('should transition stage on correct streak', async () => {
      const result = await updateMasteryAfterResponse({
        objectId: 'test',
        isCorrect: true,
        currentStreak: 4,
      });
      expect(result.stageChanged).toBe(true);
    });

    it('should use transaction for all updates', async () => {
      const txSpy = jest.spyOn(prisma, '$transaction');
      await updateMasteryAfterResponse(mockResponse);
      expect(txSpy).toHaveBeenCalled();
    });
  });
});
```

### 6.2 IPC 핸들러 테스트
**파일**: `tests/ipc/`

```typescript
// learning.ipc.test.ts
describe('Learning IPC Handlers', () => {
  describe('queue:get', () => {
    it('should validate input schema', async () => {
      const result = await invoke('queue:get', { goalId: 'invalid' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid input');
    });

    it('should return tasks with generated content', async () => {
      const result = await invoke('queue:get', {
        goalId: validGoalId,
        limit: 5
      });
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(5);
      expect(result.data[0].task).toBeDefined();
    });

    it('should respect limit bounds', async () => {
      const result = await invoke('queue:get', {
        goalId: validGoalId,
        limit: 1000  // Over max
      });
      expect(result.success).toBe(false);
    });
  });
});
```

### 6.3 UI 컴포넌트 테스트
**파일**: `tests/components/`

```typescript
// SessionPage.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

describe('SessionPage', () => {
  it('should display loading state initially', () => {
    render(<SessionPage />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should display task after loading', async () => {
    render(<SessionPage />);
    await waitFor(() => {
      expect(screen.getByTestId('task-card')).toBeInTheDocument();
    });
  });

  it('should submit response on answer selection', async () => {
    const onSubmit = jest.fn();
    render(<SessionPage onSubmitResponse={onSubmit} />);

    await waitFor(() => screen.getByTestId('mcq-option-0'));
    fireEvent.click(screen.getByTestId('mcq-option-0'));
    fireEvent.click(screen.getByText(/submit/i));

    expect(onSubmit).toHaveBeenCalled();
  });

  it('should handle keyboard navigation', async () => {
    render(<SessionPage />);
    await waitFor(() => screen.getByTestId('task-card'));

    fireEvent.keyDown(document, { key: '1' });
    expect(screen.getByTestId('mcq-option-0')).toHaveClass('selected');
  });
});
```

### 6.4 E2E 테스트
**파일**: `tests/e2e/`

```typescript
// onboarding-to-session.e2e.ts
import { test, expect } from '@playwright/test';

test.describe('Complete User Flow', () => {
  test('new user can complete onboarding and start session', async ({ page }) => {
    await page.goto('/');

    // Onboarding
    await expect(page.getByText(/welcome/i)).toBeVisible();
    await page.selectOption('[data-testid="native-language"]', 'ko');
    await page.selectOption('[data-testid="target-language"]', 'en');
    await page.fill('[data-testid="domain"]', 'Business English');
    await page.click('[data-testid="continue"]');

    // ... more steps
    await page.click('[data-testid="complete-onboarding"]');

    // Dashboard
    await expect(page.getByText(/dashboard/i)).toBeVisible();
    await expect(page.getByText(/start session/i)).toBeVisible();

    // Start session
    await page.click('[data-testid="start-session"]');
    await expect(page.getByTestId('task-card')).toBeVisible();

    // Complete a task
    await page.click('[data-testid="mcq-option-0"]');
    await page.click('[data-testid="submit"]');

    // Verify feedback shown
    await expect(page.getByTestId('feedback')).toBeVisible();
  });

  test('session progress is saved on unexpected close', async ({ page }) => {
    // Start session
    await page.goto('/session');
    await page.click('[data-testid="mcq-option-0"]');
    await page.click('[data-testid="submit"]');

    // Simulate crash
    await page.close();

    // Reopen
    await page.goto('/');

    // Should offer to resume
    await expect(page.getByText(/resume session/i)).toBeVisible();
  });
});
```

### 6.5 Content/Grammar/Tasks 모듈 테스트
**파일**: `tests/core/`

```typescript
// content-generator.test.ts
describe('ContentGenerator', () => {
  describe('generateContent', () => {
    it('should generate content matching spec', async () => {
      const spec: ContentSpec = {
        targetLength: 100,
        difficulty: 0.5,
        format: 'paragraph',
      };
      const content = await generateContent(spec);
      expect(content.length).toBeGreaterThan(50);
      expect(content.length).toBeLessThan(200);
    });
  });
});

// grammar-sequence-optimizer.test.ts
describe('GrammarSequenceOptimizer', () => {
  it('should order constructions by prerequisites', () => {
    const sequence = optimizeGrammarSequence(CORE_CONSTRUCTIONS);
    const simplePresent = sequence.findIndex(c => c.id === 'simple_present');
    const presentPerfect = sequence.findIndex(c => c.id === 'present_perfect');
    expect(simplePresent).toBeLessThan(presentPerfect);
  });
});

// distractor-generator.test.ts
describe('DistractorGenerator', () => {
  it('should generate plausible distractors', async () => {
    const distractors = await generateDistractors('ephemeral', 3);
    expect(distractors).toHaveLength(3);
    distractors.forEach(d => {
      expect(d).not.toBe('ephemeral');
      expect(d.length).toBeGreaterThan(0);
    });
  });
});
```

### 6.6 테스트 인프라 설정
**파일**: `jest.config.js`, `playwright.config.ts`

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  collectCoverage: true,
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};
```

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 2,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
  ],
});
```

**예상 작업량**: 40시간

---

## 종합 일정

| Phase | 작업 | 예상 시간 | 우선순위 |
|-------|------|----------|---------|
| Phase 1 | 핵심 알고리즘 완성 | 8시간 | P2 |
| Phase 2 | 서비스 레이어 완성 | 16시간 | P1 |
| Phase 3 | IPC 레이어 완성 | 20시간 | P1 |
| Phase 4 | DB 스키마 완성 | 12시간 | P2 |
| Phase 5 | UI/렌더러 완성 | 32시간 | P1 |
| Phase 6 | 테스트 커버리지 | 40시간 | P2 |
| **총계** | | **128시간** | |

---

## 권장 실행 순서

### Week 1: Critical Path (P1)
1. Phase 2.1: 트랜잭션 추가 (2시간)
2. Phase 3.5: 서비스 레이어 연결 (4시간)
3. Phase 5.1: 서버 태스크 스펙 사용 (4시간)
4. Phase 3.1: 입력값 검증 (4시간)

### Week 2: Major Improvements
5. Phase 5.2-5.4: 에러 처리 및 상태 관리 (16시간)
6. Phase 2.2-2.4: 캐시 및 성능 (8시간)

### Week 3: Schema & Algorithms
7. Phase 4: DB 스키마 완성 (12시간)
8. Phase 1: 알고리즘 완성 (8시간)

### Week 4: Testing
9. Phase 6.1-6.2: 서비스/IPC 테스트 (20시간)
10. Phase 6.3-6.4: UI/E2E 테스트 (20시간)

### Week 5: Polish
11. Phase 3.2-3.4: IPC 타입/Rate Limit (12시간)
12. Phase 5.5-5.8: 접근성/반응형 (16시간)

---

## 완료 후 기대 결과

| 영역 | Before | After |
|------|--------|-------|
| 핵심 알고리즘 | 95% | 100% |
| 서비스 레이어 | 88% | 100% |
| IPC 레이어 | 82% | 100% |
| 데이터베이스 스키마 | 86% | 100% |
| UI/렌더러 | 72% | 100% |
| 테스트 커버리지 | 55% | 100% |
| **종합** | **80%** | **100%** |

**Production-Ready 상태 달성** ✅

---

*계획 작성: 2026-01-06*
*예상 총 작업 시간: 128시간*
*권장 일정: 5주*
