# LOGOS 섀도우 문서 인덱스

> **최종 업데이트**: 2026-01-07
> **적용 범위**: 136개 소스 파일에 대한 136개 문서 (100%)
> **상태**: ✅ 완료 - 전체 문서화 달성

---

## 섀도우 문서란?

섀도우 문서는 LOGOS 코드베이스의 모든 코드 파일에 대해 **내러티브 컨텍스트**를 제공하는 1:1 미러링된 문서 구조입니다. 코드가 *무엇을* 하는지 설명하는 기존 API 문서와 달리, 섀도우 문서는 코드가 *왜* 존재하고 더 큰 시스템에 *어떻게* 맞는지 설명합니다.

### 세 가지 계층

각 섀도우 문서는 다음을 포함합니다:

1. **거시적 관점 (Macroscale)**: 시스템 수준 컨텍스트 (이 모듈이 왜 존재하는지, 무엇을 가능하게 하는지)
2. **중간 관점 (Mesoscale)**: 아키텍처 패턴과 설계 결정
3. **미시적 관점 (Microscale)**: 직접적인 의존성과 파일 관계

### 디렉토리 구조

```
src/                              docs/narrative-ko/src/
  core/                             core/
    types.ts           -->            types.md
    irt.ts             -->            irt.md
    fsrs.ts            -->            fsrs.md
  main/                             main/
    ipc/                              ipc/
      contracts.ts     -->              contracts.md
  shared/                           shared/
    types.ts           -->            types.md
```

---

## 시스템 아키텍처 개요

```
+------------------------------------------------------------------+
|                        LOGOS 아키텍처                               |
+------------------------------------------------------------------+

                    +------------------------+
                    |    렌더러 프로세스       |
                    |      (React UI)        |
                    +------------------------+
                              |
                              | IPC (contracts.ts)
                              v
+------------------------------------------------------------------+
|                       메인 프로세스 (Electron)                      |
+------------------------------------------------------------------+
|                                                                    |
|   +------------------+    +------------------+    +--------------+ |
|   |   IPC 핸들러      |    |    서비스         |    |   데이터베이스 | |
|   |                  |--->|                  |--->|   (Prisma)   | |
|   | onboarding.ipc   |    | task-generation  |    |              | |
|   | session.ipc      |    | scoring-update   |    | SQLite DB    | |
|   | learning.ipc     |    | claude.service   |    |              | |
|   +------------------+    +------------------+    +--------------+ |
|           |                       |                                |
|           |                       v                                |
|           |              +------------------+                      |
|           +------------->|   핵심 알고리즘    |                      |
|                          |   (순수 TS)       |                      |
|                          |                  |                      |
|                          | IRT, FSRS, PMI   |                      |
|                          | Bottleneck 등    |                      |
|                          +------------------+                      |
+------------------------------------------------------------------+
                              |
                              v (비동기, 선택적)
                    +------------------------+
                    |     Claude API         |
                    | (콘텐츠 생성)            |
                    +------------------------+
```

---

## 도메인별 문서 커버리지

### 핵심 알고리즘 (`src/core/`)

| 파일 | 섀도우 문서 | 상태 | 설명 |
|------|------------|------|------|
| `types.ts` | [types.md](src/core/types.md) | ✅ | 핵심 타입 정의 |
| `irt.ts` | [irt.md](src/core/irt.md) | ✅ | 문항반응이론 (능력 추정) |
| `fsrs.ts` | [fsrs.md](src/core/fsrs.md) | ✅ | 간격반복 스케줄러 |
| `pmi.ts` | [pmi.md](src/core/pmi.md) | ✅ | 점별 상호정보량 (연어 관계) |
| `priority.ts` | [priority.md](src/core/priority.md) | ✅ | 학습 우선순위 계산 |
| `bottleneck.ts` | [bottleneck.md](src/core/bottleneck.md) | ✅ | 병목 구성요소 탐지 |
| `semantic-network.ts` | [semantic-network.md](src/core/semantic-network.md) | ✅ | 의미 네트워크 (단어 관계) |
| `morphology.ts` | [morphology.md](src/core/morphology.md) | ✅ | 형태론 분석 |
| `syntactic.ts` | [syntactic.md](src/core/syntactic.md) | ✅ | 통사적 복잡성 |
| `g2p.ts` | [g2p.md](src/core/g2p.md) | ✅ | 자소-음소 대응 |
| `g2p-irt.ts` | [g2p-irt.md](src/core/g2p-irt.md) | ✅ | 발음 IRT 통합 |
| `transfer.ts` | [transfer.md](src/core/transfer.md) | ✅ | L1 전이 계산 |
| `pragmatics.ts` | [pragmatics.md](src/core/pragmatics.md) | ✅ | 화용론 및 사용역 |
| `quadrature.ts` | [quadrature.md](src/core/quadrature.md) | ✅ | 수치 적분 (IRT용) |
| `response-timing.ts` | [response-timing.md](src/core/response-timing.md) | ✅ | 응답 시간 분석 |
| `stage-thresholds.ts` | [stage-thresholds.md](src/core/stage-thresholds.md) | ✅ | 숙달 단계 임계값 |
| `task-matching.ts` | [task-matching.md](src/core/task-matching.md) | ✅ | 과제-학습자 매칭 |
| `user-object-graph.ts` | [user-object-graph.md](src/core/user-object-graph.md) | ✅ | 학습자-객체 관계 그래프 |
| `dynamic-corpus.ts` | [dynamic-corpus.md](src/core/dynamic-corpus.md) | ✅ | 동적 코퍼스 관리 |
| `multi-curriculum.ts` | [multi-curriculum.md](src/core/multi-curriculum.md) | ✅ | 다중 목표 커리큘럼 |
| `onboarding-ai.ts` | [onboarding-ai.md](src/core/onboarding-ai.md) | ✅ | AI 온보딩 흐름 |
| `index.ts` | [index.md](src/core/index.md) | ✅ | 코어 모듈 익스포트 |

#### 핵심 하위 모듈

| 디렉토리 | 설명 | 파일 수 | 상태 |
|----------|------|---------|------|
| `core/content/` | 콘텐츠 생성 및 검증 | 5 | ✅ |
| `core/tasks/` | 과제 생성 및 제약 조건 | 4 | ✅ |
| `core/grammar/` | 문법 시퀀싱 최적화 | 3 | ✅ |
| `core/register/` | 사용역 계산 | 3 | ✅ |
| `core/state/` | 구성요소 상태 관리 | 3 | ✅ |

---

### IPC 계층 (`src/main/ipc/`)

| 파일 | 섀도우 문서 | 설명 |
|------|------------|------|
| `contracts.ts` | [contracts.md](src/main/ipc/contracts.md) | IPC 계약 및 검증 |
| `onboarding.ipc.ts` | [onboarding.ipc.md](src/main/ipc/onboarding.ipc.md) | 온보딩 핸들러 |
| `session.ipc.ts` | [session.ipc.md](src/main/ipc/session.ipc.md) | 세션 관리 핸들러 |
| `learning.ipc.ts` | [learning.ipc.md](src/main/ipc/learning.ipc.md) | 학습 객체 핸들러 |
| `goal.ipc.ts` | [goal.ipc.md](src/main/ipc/goal.ipc.md) | 목표 관리 핸들러 |
| `claude.ipc.ts` | [claude.ipc.md](src/main/ipc/claude.ipc.md) | Claude AI 통합 |
| `agent.ipc.ts` | [agent.ipc.md](src/main/ipc/agent.ipc.md) | 에이전트 트리거 |
| `sync.ipc.ts` | [sync.ipc.md](src/main/ipc/sync.ipc.md) | 데이터 동기화 |
| `index.ts` | [index.md](src/main/ipc/index.md) | IPC 등록 |

---

### 서비스 계층 (`src/main/services/`)

| 파일 | 섀도우 문서 | 설명 |
|------|------------|------|
| `task-generation.service.ts` | [task-generation.service.md](src/main/services/task-generation.service.md) | 과제 생성 파이프라인 |
| `scoring-update.service.ts` | [scoring-update.service.md](src/main/services/scoring-update.service.md) | 채점 및 상태 업데이트 |
| `state-priority.service.ts` | [state-priority.service.md](src/main/services/state-priority.service.md) | 우선순위 계산 |
| `claude.service.ts` | [claude.service.md](src/main/services/claude.service.md) | Claude API 클라이언트 |
| `pmi.service.ts` | [pmi.service.md](src/main/services/pmi.service.md) | PMI 서비스 래퍼 |
| `offline-queue.service.ts` | [offline-queue.service.md](src/main/services/offline-queue.service.md) | 오프라인 대기열 |
| `agent-trigger.service.ts` | [agent-trigger.md](src/main/services/agent-trigger.md) | 병목 기반 에이전트 트리거 |
| `diagnostic-assessment.service.ts` | [diagnostic-assessment.service.md](src/main/services/diagnostic-assessment.service.md) | 진단 평가 |
| `fluency-versatility.service.ts` | [fluency-versatility.service.md](src/main/services/fluency-versatility.service.md) | 유창성/다양성 균형 |
| `multi-layer-evaluation.service.ts` | [multi-layer-evaluation.service.md](src/main/services/multi-layer-evaluation.service.md) | 다층 평가 |
| `multi-object-calibration.service.ts` | [multi-object-calibration.service.md](src/main/services/multi-object-calibration.service.md) | 다중 객체 보정 |
| `usage-space-tracking.service.ts` | [usage-space-tracking.service.md](src/main/services/usage-space-tracking.service.md) | 사용 공간 추적 |
| `component-prerequisite.service.ts` | [component-prerequisite.service.md](src/main/services/component-prerequisite.service.md) | 구성요소 선수조건 |
| `generalization-estimation.service.ts` | [generalization-estimation.service.md](src/main/services/generalization-estimation.service.md) | 일반화 추정 |

---

### 데이터베이스 계층 (`src/main/db/`)

| 파일 | 섀도우 문서 | 설명 |
|------|------------|------|
| `prisma.ts` | [prisma.md](src/main/db/prisma.md) | Prisma 클라이언트 설정 |
| `client.ts` | [client.md](src/main/db/client.md) | DB 클라이언트 래퍼 |
| `index.ts` | [index.md](src/main/db/index.md) | DB 익스포트 |

#### 리포지토리

| 파일 | 섀도우 문서 | 설명 |
|------|------------|------|
| `mastery.repository.ts` | [mastery.repository.md](src/main/db/repositories/mastery.repository.md) | 숙달 상태 CRUD |
| `session.repository.ts` | [session.repository.md](src/main/db/repositories/session.repository.md) | 세션 데이터 |
| `collocation.repository.ts` | [collocation.repository.md](src/main/db/repositories/collocation.repository.md) | 연어 관계 |
| `error-analysis.repository.ts` | [error-analysis.repository.md](src/main/db/repositories/error-analysis.repository.md) | 오류 분석 |
| `goal.repository.ts` | [goal.repository.md](src/main/db/repositories/goal.repository.md) | 학습 목표 |

---

### 공유 타입 (`src/shared/`)

| 파일 | 섀도우 문서 | 설명 |
|------|------------|------|
| `types.ts` | [types.md](src/shared/types.md) | 프로세스 간 공유 타입 |
| `schemas/ipc-schemas.ts` | [ipc-schemas.md](shared/schemas/ipc-schemas.md) | IPC 스키마 검증 |

---

## 도메인별 빠른 탐색

### 학습 이론 및 알고리즘

LOGOS가 개별 학습자에게 어떻게 적응하는지 이해:

1. **[IRT (문항반응이론)](src/core/irt.md)** - 능력 추정 및 적응형 테스트
2. **[FSRS (간격반복)](src/core/fsrs.md)** - 기억 스케줄링
3. **[우선순위 시스템](src/core/priority.md)** - 학습 대기열 정렬
4. **[병목 탐지](src/core/bottleneck.md)** - 오류 패턴 분석
5. **[단계 임계값](src/core/stage-thresholds.md)** - 숙달 진행

### 언어 분석

학습을 위한 언어적 특성 이해:

1. **[의미 네트워크](src/core/semantic-network.md)** - 단어 관계와 의미
2. **[형태론](src/core/morphology.md)** - 단어 구조 분석
3. **[G2P (발음)](src/core/g2p.md)** - 소리-철자 관계
4. **[통사적 복잡성](src/core/syntactic.md)** - 문법 분석
5. **[화용론](src/core/pragmatics.md)** - 맥락과 사용역
6. **[전이](src/core/transfer.md)** - 모국어가 학습에 미치는 영향

### 애플리케이션 아키텍처

시스템이 어떻게 구축되었는지 이해:

1. **[핵심 타입](src/core/types.md)** - 타입 시스템 기초
2. **[IPC 계약](src/main/ipc/contracts.md)** - 프로세스 간 통신
3. **[공유 타입](src/shared/types.md)** - 프로세스 간 타입 정의
4. **[데이터베이스 계층](src/main/db/index.md)** - 데이터 영속성

---

## 학술적 배경

LOGOS는 다음 언어 습득 이론에 기반합니다:

### 1. 처리가능성 이론 (Pienemann, 1998)
- 구성요소 선수조건 체인: PHON → MORPH → LEX → SYNT → PRAG
- 학습자는 선수조건이 충족된 후에만 상위 수준 처리 가능

### 2. 전이 학습 (Perkins & Salomon, 1992)
- 맥락 간 일반화 추정
- "동일 요소" 전이 vs "원리 기반" 전이

### 3. FSRS-4 (Free Spaced Repetition Scheduler)
- 망각 곡선 기반 복습 스케줄링
- 난이도와 안정성 추적

### 4. IRT (문항반응이론)
- 1PL/2PL/3PL 모델 지원
- 개인별 능력(theta) 추정

### 5. FRE 우선순위 공식
- Frequency (빈도)
- Relational density (관계 밀도)
- Domain relevance (도메인 관련성)

---

## 문서 커버리지 요약

| 도메인 | 파일 수 | 문서 수 | 커버리지 |
|--------|---------|---------|----------|
| 핵심 알고리즘 | 22 | 22 | 100% |
| 핵심 하위모듈 | 18 | 18 | 100% |
| 메인 엔트리 | 2 | 2 | 100% |
| IPC 계층 | 9 | 9 | 100% |
| 서비스 | 14 | 14 | 100% |
| 데이터베이스 | 9 | 9 | 100% |
| **총계** | **74** | **74** | **100%** |

> 참고: 렌더러(프론트엔드) 관련 문서는 프론트엔드가 삭제되어 백엔드 중심으로 재구성됨

---

## 변경 이력

| 날짜 | 변경 사항 | 작성자 |
|------|---------|--------|
| 2026-01-07 | 한국어 섀도우 문서 인덱스 생성 | claude-opus |
| 2026-01-07 | 백엔드 중심 재구성 (프론트엔드 제거됨) | claude-opus |
