# Generalization Estimation Service

> **Code**: `src/main/services/generalization-estimation.service.ts`
> **Tier**: 2 (Service Layer)

---

## 목적

학습된 맥락에서 미학습 맥락으로의 전이 가능성 추정. Usage Space 전체가 조합적으로 방대하므로 대표 샘플에서 전체 커버리지 추정.

**핵심 알고리즘**:
- Transfer Distance 계산 (맥락 간 유사도)
- Transfer Probability 추정 (전이 성공 확률)
- Representative Sample 선택 (일반화 극대화)
- Coverage Estimation (전체 사용 공간 추정)

---

## 이론적 기반

### Transfer Distance (Thorndike, 1901)

```
Distance = 1 - Similarity

Similarity = |SharedFeatures| / |TotalFeatures|
```

**동일 요소 이론**: 두 맥락 간 공유 요소가 많을수록 전이가 용이.

| Feature | 공유시 전이 용이 |
|---------|------------------|
| domain | 같은 영역 (medical-medical) |
| register | 같은 격식 (formal-formal) |
| modality | 같은 양상 (spoken-spoken) |
| genre | 같은 장르 (consultation-consultation) |

### Transfer Probability (Perkins & Salomon, 1992)

```typescript
// lines 153-193
baseProbability = Math.exp(-decayConstant * distance);  // k = 2
automationBoost = sourceAutomationLevel * 0.3;
transferProbability = min(1, baseProbability + automationBoost);
```

**전이 유형**:
| 유형 | Distance | 확률 | 특성 |
|------|----------|------|------|
| Near Transfer | ≤ 0.5 | ~60% | 자동 전이 가능 |
| Far Transfer | > 0.5 | ~13% | 명시적 브릿징 필요 |

---

## Representative Sample Selection

### 선택 기준 (lines 234-302)

```typescript
totalScore =
  goalAlignmentScore × strategy.goalWeight +
  diversityScore × strategy.diversityWeight +
  transferPotentialScore × strategy.transferWeight;
```

| 점수 | 계산 방법 | 목적 |
|------|----------|------|
| Goal Alignment | 목표 맥락과의 유사도 | 목표 달성 |
| Diversity | 기존 커버리지와의 거리 | 중복 방지 |
| Transfer Potential | 다른 미커버 맥락 도달 가능성 | 효율 극대화 |

### 컴포넌트별 전략

```typescript
// from types.ts COMPONENT_SAMPLING_STRATEGIES
PHON:  { goalWeight: 0.3, diversityWeight: 0.2, transferWeight: 0.5, minSamples: 5 }
MORPH: { goalWeight: 0.4, diversityWeight: 0.2, transferWeight: 0.4, minSamples: 4 }
LEX:   { goalWeight: 0.5, diversityWeight: 0.3, transferWeight: 0.2, minSamples: 8 }
SYNT:  { goalWeight: 0.4, diversityWeight: 0.3, transferWeight: 0.3, minSamples: 6 }
PRAG:  { goalWeight: 0.6, diversityWeight: 0.2, transferWeight: 0.2, minSamples: 10 }
```

**논리**: PHON은 전이율 높아 적은 샘플로 일반화, PRAG는 전이율 낮아 많은 샘플 필요.

---

## 컴포넌트별 일반화 패턴

### PHON (lines 569-606)

```typescript
positionTransferRate = 0.7;  // 위치 간 70% 전이
confidence = 0.8;            // 높은 확신도
```

음운 규칙은 추상적이어서 위치에 관계없이 일반화.

### MORPH (lines 608-644)

```typescript
productivityRate = 0.6;  // Carlisle (2000) 기반
confidence = 0.75;
```

접사는 새로운 어근에 생산적으로 적용 가능.

### LEX (lines 646-683)

```typescript
nearTransferCoverage = (1 - directCoverage) × 0.25;  // 낮은 전이
farTransferCoverage = 0.05;
confidence = 0.7;
```

어휘는 맥락 특수적, 연어 관계가 전이 제한.

### SYNT (lines 685-722)

```typescript
nearTransferCoverage = (1 - directCoverage) × 0.35;  // 중간 전이
confidence = 0.7;
```

문법 패턴은 어느 정도 추상화 가능하나 장르 의존성 존재.

### PRAG (lines 724-767)

```typescript
nearTransferCoverage = (1 - directCoverage) × 0.2;  // 최저 전이
farTransferCoverage = 0.02;
confidence = 0.6;
```

화용은 고도로 맥락 의존적, 대화 상대/상황에 따라 완전히 다름.

---

## Coverage Breakdown 구조

```typescript
interface CoverageBreakdown {
  directCoverage: number;        // 실제 훈련된 맥락
  nearTransferCoverage: number;  // 근전이로 추론된 커버리지
  farTransferCoverage: number;   // 원전이로 추론된 커버리지
  totalEstimatedCoverage: number;
  confidence: number;            // 추정 신뢰도
}
```

---

## Minimum Sample Calculation (Power Law)

```typescript
// lines 866-897
additionalSamples = ceil(coverageGap × baseMinimum × 2 × transferMultiplier);

transferMultiplier = {
  PHON: 0.7,   // 높은 전이 = 적은 샘플
  MORPH: 0.8,
  LEX: 1.2,    // 낮은 전이 = 많은 샘플
  SYNT: 1.0,
  PRAG: 1.4    // 최저 전이 = 가장 많은 샘플
};
```

**Power Law of Practice** (Newell & Rosenbloom, 1981): 수행 능력은 연습량의 거듭제곱 함수로 향상.

---

## 의존 관계

```
generalization-estimation.service.ts
  │
  ├──> usage-space-tracking.service.ts (STANDARD_CONTEXTS, getObjectUsageSpace)
  │
  ├──> types.ts (COMPONENT_SAMPLING_STRATEGIES)
  │
  └──> 소비자:
       ├── task-composition.service (맥락 선택)
       └── usage-space-tracking.service (추천 맥락 계산)
```
