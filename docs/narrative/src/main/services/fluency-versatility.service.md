# Fluency vs Versatility Balance Service

> **Code**: `src/main/services/fluency-versatility.service.ts`
> **Tier**: 2 (Service Layer)

---

## 목적

Phase 3.4 구현: 유창성-다양성 균형. 세션 비율 추적, 진행도 기반 조정, 적절한 과제 유형 생성.

**유창성**: 고-PMI 연어, 속도 중심 (bread and butter)
**다양성**: 저-PMI 조합, 창의적 확장 (bread and marmalade)

---

## 레벨별 기본 비율

```typescript
const LEVEL_RATIOS = {
  beginner:     { fluency: 0.8, versatility: 0.2 },
  intermediate: { fluency: 0.6, versatility: 0.4 },
  advanced:     { fluency: 0.4, versatility: 0.6 }
};
```

**논리**: 초보자는 자동화된 청크 구축 필요, 고급자는 유연한 사용 필요.

---

## 핵심 함수

### 비율 계산

| 함수 | 용도 |
|------|------|
| `calculateTargetRatio(userId, goalId)` | 목표 비율 계산 |
| `getSessionBalance(sessionId)` | 현재 세션 균형 조회 |
| `adjustRatioForProgress(ratio, stats)` | 진행도 기반 조정 |

### 과제 생성

| 함수 | 용도 |
|------|------|
| `generateFluencyTask(goalId)` | 고-PMI 속도 과제 생성 |
| `generateVersatilityTask(goalId)` | 저-PMI 창의 과제 생성 |
| `getNextTaskType(sessionId)` | 다음 과제 유형 결정 |

### 전환 분석

| 함수 | 용도 |
|------|------|
| `analyzeTransition(userId, goalId)` | 모드 전환 필요성 분석 |
| `checkHeadDomainCoverage(goalId)` | 핵심 영역 숙달도 체크 |

---

## 전환 조건

### 유창성 → 다양성 전환

```typescript
shouldShift =
  headDomainCoverage >= 0.8 &&    // 핵심 연어 80% 숙달
  fluencySpeed < 3000 &&           // 3초 내 응답
  productionImprovement > 0.1;     // 생산 개선 10%+
```

---

## 세션 균형 관리

```typescript
interface SessionBalance {
  targetRatio: { fluency: 0.6, versatility: 0.4 };
  currentRatio: { fluency: 0.7, versatility: 0.3 };
  fluencyTaskCount: 14;
  versatilityTaskCount: 6;
  recommendedNextType: 'versatility';  // 균형 회복
}
```

---

## 의존 관계

```
fluency-versatility.service.ts
  │
  ├──> collocation.repository.ts (PMI 데이터)
  │
  ├──> mastery.repository.ts (숙달 통계)
  │
  └──> 소비자:
       ├── task-generation.service (과제 유형 선택)
       └── session.repository (세션 균형 기록)
```
