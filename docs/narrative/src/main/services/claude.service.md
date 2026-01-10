# Claude API Service

> **Code**: `src/main/services/claude.service.ts`
> **Tier**: 2 (Service Layer)

---

## 목적

Claude API와의 모든 상호작용을 처리. 콘텐츠 생성, 오류 분석, 적응형 힌트 제공.

**주요 기능**:
- 온라인 모드: 전체 Claude API 통합
- 오프라인 폴백: API 불가시 템플릿 기반 생성
- 응답 캐싱: 반복 요청에 대한 API 호출 감소
- 우아한 성능 저하: API 오류시 자동 폴백

---

## 핵심 기능

### 콘텐츠 생성

| 함수 | 용도 |
|------|------|
| `generateContent(request)` | 연습문제, 설명, 예문 생성 |
| `generateExercise(content, config)` | 맞춤형 연습문제 생성 |
| `generateExplanation(content, config)` | 문법/어휘 설명 생성 |

### 오류 분석

| 함수 | 용도 |
|------|------|
| `analyzeError(request)` | 학습자 오류 분석 및 분류 |
| `categorizeError(response, expected)` | PHON/MORPH/LEX/SYNT/PRAG 분류 |

### 힌트 생성

| 함수 | 용도 |
|------|------|
| `generateHint(request)` | 레벨별 적응형 힌트 생성 |

---

## 캐시 시스템

### ContentCache 클래스 (lines 93-150)

```typescript
class ContentCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private defaultTTL: number = 30 * 60 * 1000;  // 30분

  generateKey(prefix: string, params: Record<string, unknown>): string;
  get<T>(key: string): T | null;
  set<T>(key: string, data: T, ttl?: number): void;
  clear(): void;
}
```

**캐시 전략**:
- TTL 기반 만료
- 요청 파라미터 기반 키 생성
- 자동 만료 항목 정리

---

## 의존 관계

```
claude.service.ts
  │
  ├──> @anthropic-ai/sdk (Claude API SDK)
  │
  ├──> offline-queue.service.ts (오프라인 큐잉)
  │
  └──> 소비자:
       ├── task-generation.service (콘텐츠 생성)
       ├── scoring-update.service (오류 분석)
       └── IPC handlers (힌트 요청)
```

---

## 오프라인 폴백

API 불가시 템플릿 기반 콘텐츠 생성:

| 요청 유형 | 폴백 동작 |
|----------|----------|
| exercise | 사전 정의 템플릿 사용 |
| explanation | 기본 문법 규칙 반환 |
| hint | 점진적 공개 패턴 사용 |
| error_analysis | 레벤슈타인 기반 분류 |
