# Component Prerequisite Service

> **Code**: `src/main/services/component-prerequisite.service.ts`
> **Tier**: 2 (Service Layer)

---

## 목적

컴포넌트 전제조건 체인 관리. 언어 컴포넌트 간 계층적 의존성 (PHON → MORPH → LEX → SYNT → PRAG) 추적.

**핵심 원리**: 하위 컴포넌트가 자동화(threshold stability 도달)되어야 상위 컴포넌트 학습 효과적.

---

## 이론적 기반

### Processability Theory (Pienemann, 1998, 2005)

언어 처리 절차는 계층적으로 발달. 하위 절차 없이 상위 절차 불가.

```
PHON → MORPH → LEX → SYNT → PRAG
(발음)  (형태)   (어휘)  (통사)  (화용)
```

### Skill Acquisition Theory / ACT-R (Anderson, 1982, 1993)

기술 습득의 3단계:
1. **Cognitive**: 선언적 지식
2. **Associative**: 절차화 시작
3. **Autonomous**: 자동화 완료

하위 컴포넌트의 자동화가 상위 컴포넌트의 인지 자원을 확보.

### Levelt's Speech Production Model (1999)

발화 산출은 개념화 → 형식화 → 조음의 순서. 각 단계는 이전 단계의 출력에 의존.

---

## Component Hierarchy

```typescript
// lines 133-144
COMPONENT_ORDER: ComponentCode[] = ['PHON', 'MORPH', 'LEX', 'SYNT', 'PRAG'];

COMPONENT_SUPPORTS: Record<ComponentCode, ComponentCode[]> = {
  PHON: ['MORPH', 'LEX'],
  MORPH: ['LEX', 'SYNT'],
  LEX: ['SYNT', 'PRAG'],
  SYNT: ['PRAG'],
  PRAG: []
};
```

| 컴포넌트 | 전제조건 | 지원 대상 |
|---------|---------|----------|
| PHON | 없음 | MORPH, LEX |
| MORPH | PHON | LEX, SYNT |
| LEX | PHON, MORPH | SYNT, PRAG |
| SYNT | MORPH, LEX | PRAG |
| PRAG | LEX, SYNT | 없음 |

---

## Automation Level Calculation

```typescript
// lines 194-259
normalizedStability = min(fsrsStability / 30, 1);  // 30일 = 1.0

// 컴포넌트 자동화 판정
isAutomated = automationRatio >= 0.7 && normalizedAutomation >= requiredThreshold;
```

| 컴포넌트 | Automation Threshold | 의미 |
|---------|---------------------|------|
| PHON | 0.3 | 10일 안정성 |
| MORPH | 0.4 | 12일 안정성 |
| LEX | 0.5 | 15일 안정성 |
| SYNT | 0.6 | 18일 안정성 |
| PRAG | 0.7 | 21일 안정성 |

---

## Prerequisite Status Check

```typescript
// lines 150-190
interface PrerequisiteStatus {
  component: ComponentCode;
  allSatisfied: boolean;
  prerequisites: Array<{
    component: ComponentCode;
    requiredThreshold: number;
    currentAutomation: number;
    isSatisfied: boolean;
  }>;
  blockingComponents: ComponentCode[];
}
```

### Unlock Status

| 상태 | 조건 | Readiness Score |
|------|------|-----------------|
| fully_unlocked | 모든 전제조건 충족 | 0.7 - 1.0 |
| partially_unlocked | 일부 전제조건 충족 | 0.3 - 0.7 |
| locked | 전제조건 미충족 | 0 |

---

## Learning Strategy Determination

```typescript
// lines 551-631
interface ObjectLearningStrategy {
  objectId: string;
  componentType: ComponentCode;
  currentGoal: 'stabilization' | 'expansion';
  goalReason: LearningGoalReason;
  prerequisiteStatus: PrerequisiteStatus;
  automationLevel: number;
  automationThreshold: number;
  usageSpaceCoverage: number;
  supportsComponents: ComponentCode[];
  priority: number;
}
```

### Priority 계산

```typescript
if (!prerequisiteStatus.allSatisfied) {
  priority = 30;  // 전제조건 미충족 - 낮은 우선순위
} else if (automationLevel < automationThreshold) {
  priority = 70 + (1 - automationLevel) × 30;  // 자동화 필요 - 높은 우선순위
} else if (supportsComponents.length > 0) {
  priority = 50;  // 상위 컴포넌트 지원 - 중간 우선순위
} else {
  priority = 40;  // 확장 준비 완료
}
```

---

## Component Recommendations

```typescript
// lines 360-416
interface ComponentRecommendation {
  component: ComponentCode;
  priority: number;
  focusType: 'stabilize' | 'expand' | 'introduce';
  reason: string;
  targetObjectIds: string[];
}
```

| Focus Type | 조건 | 행동 |
|------------|------|------|
| introduce | objectCount === 0 | 첫 항목 도입 |
| stabilize | !isAutomated | 안정화 훈련 |
| expand | isAutomated | Usage Space 확장 |

---

## Support Score Calculation

```typescript
// lines 462-542
// 객체가 상위 컴포넌트를 얼마나 지원하는지 계산
contributionScore = normalizedAutomation / prereqConfig.automationThreshold;
```

**용도**: 하위 컴포넌트 객체의 학습 우선순위 결정시, 상위 컴포넌트 unlock에 기여하는 정도 반영.

---

## 의존 관계

```
component-prerequisite.service.ts
  │
  ├──> types.ts (COMPONENT_PREREQUISITES)
  │
  ├──> prisma.ts (DB 접근)
  │
  └──> 소비자:
       ├── state-priority.service (우선순위 계산)
       ├── task-generation.service (학습 전략)
       └── IPC handlers (잠금 해제 상태 표시)
```
