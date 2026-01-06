# LOGOS 제품 사양서

> **LOGOS**: 전문 영어 학습을 위한 AI 기반 적응형 언어 학습 데스크톱 애플리케이션

---

## 목차

1. [제품 개요](#1-제품-개요)
2. [대상 사용자](#2-대상-사용자)
3. [핵심 기능](#3-핵심-기능)
4. [학습 모델](#4-학습-모델)
5. [과제 유형](#5-과제-유형)
6. [AI 통합](#6-ai-통합)
7. [데이터 모델](#7-데이터-모델)
8. [시스템 아키텍처](#8-시스템-아키텍처)
9. [사용자 흐름](#9-사용자-흐름)
10. [오프라인 기능](#10-오프라인-기능)

---

## 1. 제품 개요

### LOGOS란?

LOGOS는 **전문직 영어 학습자를 위한 지능형 데스크톱 학습 애플리케이션**입니다. 최신 적응형 학습 과학과 AI 기술을 결합하여 의료, 법률, 비즈니스, 학술 분야의 영어 습득을 3-5배 가속화합니다.

### 핵심 가치

| 특징 | 설명 |
|------|------|
| **적응형 난이도** | 학습자의 실력에 맞춰 과제 난이도를 자동 조절 |
| **최적 복습 타이밍** | 망각 직전에 복습을 예약하여 학습 효율 극대화 |
| **우선순위 학습** | 가장 유용한 단어부터 학습 (빈도 + 연결성 + 중요도) |
| **AI 콘텐츠 생성** | Claude AI가 맞춤형 연습 문제 자동 생성 |
| **오프라인 지원** | 인터넷 없이도 학습 가능 |

### 기술 스택

```
프론트엔드: React 18 + TypeScript + Tailwind CSS
데스크톱:   Electron 28
데이터베이스: SQLite + Prisma ORM
AI:        Anthropic Claude API
빌드:      Electron Vite
```

---

## 2. 대상 사용자

### 주요 타겟

1. **의료 전문가**
   - CELBAN (캐나다 간호사 영어 시험) 준비
   - USMLE Step 2 CK 의료 영어
   - 의료 용어 및 환자 커뮤니케이션

2. **법률 전문가**
   - 법률 영어 용어
   - 계약서 및 법적 문서 작성
   - 국제 법률 업무

3. **비즈니스 전문가**
   - 비즈니스 영어 회화
   - 프레젠테이션 및 보고서
   - 국제 협상 영어

4. **학술 연구자**
   - 학술 논문 작성
   - IELTS / TOEFL 준비
   - 학회 발표 영어

### 사용자 특성

- ✅ 명확한 학습 목표 (자격증, 시험, 업무)
- ✅ 제한된 학습 시간 (바쁜 전문직)
- ✅ 높은 동기 (경력 발전)
- ✅ 데이터 프라이버시 중시 (로컬 저장)

---

## 3. 핵심 기능

### 3.1 학습 목표 관리

사용자가 다차원적인 학습 목표를 설정합니다:

```
목표 설정 항목:
├── 도메인: 의료 / 법률 / 비즈니스 / 학술
├── 모달리티: 읽기 / 듣기 / 쓰기 / 말하기 (복수 선택)
├── 장르: 보고서 / 대화 / 발표 / 시험
├── 목적: 자격증 / 직업 발전 / 학술
├── 벤치마크: CELBAN / IELTS / TOEFL / USMLE
└── 마감일: 선택적 목표 완료일
```

### 3.2 적응형 학습 세션

**3가지 학습 모드:**

| 모드 | 목적 | 특징 |
|------|------|------|
| **학습 (Learning)** | 새로운 어휘 도입 | 높은 힌트 제공, 낮은 난이도 |
| **훈련 (Training)** | 학습 강화 | 중간 힌트, 다양한 과제 |
| **평가 (Evaluation)** | 실력 측정 | 힌트 없음, 전체 난이도 |

### 3.3 5단계 숙달 시스템

```
Stage 0: 미학습 (Unknown)
    ↓  50% 정확도 달성
Stage 1: 인식 (Recognition)
    ↓  60% 정확도 + 2회 노출
Stage 2: 회상 (Recall)
    ↓  75% 정확도 + 7일 안정성
Stage 3: 생산 (Production)
    ↓  90% 정확도 + 30일 안정성
Stage 4: 자동화 (Automatic)
```

### 3.4 병목 현상 감지

학습 장벽의 근본 원인을 자동으로 식별합니다:

```
언어 구성요소 캐스케이드:
음운론(PHON) → 형태론(MORPH) → 어휘(LEX) → 통사론(SYNT) → 화용론(PRAG)

예: 발음 오류 → 형태소 인식 실패 → 어휘 생산 불가
```

**감지 시 조치:**
1. 사용자에게 병목 알림
2. 근본 원인 구성요소에 집중하도록 과제 조정
3. 난이도 하향 조정
4. 특화된 연습 콘텐츠 생성

### 3.5 분석 및 대시보드

```
제공 분석:
├── 전체 진행 상황 (숙달 단계별 비율)
├── 정확도 추이 (시간별 그래프)
├── 학습 시간 (분, 연속 학습일)
├── 구성요소별 능력 (PHON/MORPH/LEX/SYNT/PRAG)
├── 병목 분석 및 권장사항
└── 세션 기록 (상세 응답 로그)
```

---

## 4. 학습 모델

### 4.1 FSRS (Free Spaced Repetition Scheduler)

**개념:** 망각 직전에 복습을 예약하여 최소 반복으로 최대 기억 유지

```typescript
// 각 학습 항목별 파라미터
interface FSRSCard {
  difficulty: number;    // 1-10, 기억 난이도
  stability: number;     // 90% 유지까지 일수
  retrievability: number; // 현재 예상 기억률 (0-1)
  state: 'new' | 'learning' | 'review' | 'relearning';
}
```

**사용자 평가 (1-4점):**
- **1 (Again)**: 잊음 → 난이도↑, 안정성↓
- **2 (Hard)**: 겨우 기억 → 중간 조정
- **3 (Good)**: 기억함 → 안정성↑
- **4 (Easy)**: 쉬움 → 장기 간격

### 4.2 IRT (Item Response Theory)

**개념:** 학습자 능력과 항목 난이도를 정밀하게 측정

```
θ (theta): 학습자 능력 파라미터 (-3 ~ +3)
├── 전체 능력 (global)
├── 음운론 능력 (PHON)
├── 형태론 능력 (MORPH)
├── 어휘 능력 (LEX)
├── 통사론 능력 (SYNT)
└── 화용론 능력 (PRAG)
```

**항목 선택 원리:**
- 학습자 능력(θ) 근처 난이도의 항목 선택
- Fisher Information 최대화로 안정적 측정
- 새 항목과 복습 항목 균형

### 4.3 FRE 우선순위 모델

**공식:** `Priority = (F + R + E) / Cost`

| 요소 | 설명 | 가중치 |
|------|------|--------|
| **F (Frequency)** | 코퍼스에서 단어 출현 빈도 | 40% |
| **R (Relational)** | 다른 단어와의 연결성 (PMI 기반) | 30% |
| **E (Engagement)** | 도메인별 의미 중요도 | 30% |

**비용 요소:**
- IRT 난이도 (높을수록 학습 비용↑)
- L1 전이 (동족어는 쉬움)
- 이미 받은 노출 횟수

---

## 5. 과제 유형

### 5.1 15가지 핵심 과제 유형

#### 수용적 과제 (이해)
| 유형 | 설명 |
|------|------|
| 객관식 (MCQ) | 3-4개 선택지에서 정답 선택 |
| 매칭 | 두 열의 항목 연결 |
| 빈칸 채우기 | 문맥 힌트와 함께 빈칸 완성 |
| 참/거짓 | 이해도 확인 |

#### 생산적 과제 (생성)
| 유형 | 설명 |
|------|------|
| 자유 응답 | 개방형 답변 |
| 문장 작성 | 단어를 사용한 문장 생성 |
| 받아쓰기 | 오디오 전사 |
| 타이핑 | 실시간 문자 검증 |

#### 변환적 과제 (조작)
| 유형 | 설명 |
|------|------|
| 번역 | 목표어 ↔ 모국어 변환 |
| 바꿔 말하기 | 다른 단어로 재표현 |
| 레지스터 전환 | 격식/비격식 변환 |
| 문장 조합/분리 | 구조 재편성 |

#### 분석적 과제 (인식)
| 유형 | 설명 |
|------|------|
| 오류 수정 | 실수 식별 및 수정 |
| 연어 판단 | 단어 조합 완성 |
| 단어 형성 | 어근에서 단어 구성 |

### 5.2 과제 형식

| 형식 | 입력 | 출력 | 적합한 용도 |
|------|------|------|------------|
| **MCQ** | 문제 + 4개 선택지 | 1개 선택 | 인식, 이해 |
| **Fill Blank** | 빈칸 문장 | 답변 입력 | 어휘, 문법 |
| **Matching** | 2열 | 쌍 연결 | 정의, 동의어 |
| **Typing** | 실시간 입력 | 단어 입력 | 철자, 유창성 |
| **Free Response** | 개방형 질문 | 답변 입력 | 생산, 창의성 |

### 5.3 타이핑 과제 (실시간 피드백)

```
특징:
├── 문자별 실시간 검증
├── 올바른 문자: 녹색 표시
├── 틀린 문자: 빨간색 + 물결 밑줄
├── 남은 문자: 밑줄 플레이스홀더
├── 진행률 표시 (X/Y 문자)
└── 정확도 퍼센트 표시
```

---

## 6. AI 통합

### 6.1 Claude API 활용

LOGOS는 Anthropic의 Claude AI를 4가지 핵심 영역에 활용합니다:

#### 1. 콘텐츠 생성
```
용도: 어휘 항목에 대한 연습 문제 생성
├── 문맥 인식 (도메인 특화)
├── 모달리티 적합 (시각/청각)
└── 난이도 조절
```

#### 2. 오류 분석
```
용도: 학습자 오류를 언어 구성요소로 분류
├── PHON: 발음 오류
├── MORPH: 형태 오류 (활용, 어형 변화)
├── LEX: 어휘 오류 (단어 선택)
├── SYNT: 통사 오류 (문장 구조)
└── PRAG: 화용 오류 (레지스터, 적절성)
```

#### 3. 힌트 생성
```
3단계 스캐폴딩:
├── Level 1 (최소): 첫 글자, 카테고리
├── Level 2 (중간): 정의, 부분 단어
└── Level 3 (전체): 번역, 완전한 힌트
```

#### 4. 어휘 추출
```
용도: 사용자 업로드 문서에서 어휘 추출
├── PDF 파싱
├── DOCX 파싱
├── 빈도 분석
└── 도메인 분류
```

### 6.2 False Friends (거짓 동족어) 데이터베이스

**개념:** 모국어와 비슷해 보이지만 의미가 다른 영어 단어

**지원 언어:** 스페인어, 포르투갈어, 프랑스어, 독일어, 이탈리아어, 일본어, 중국어

**예시 (스페인어 화자용):**

| 영어 단어 | 스페인어 유사 단어 | 실제 스페인어 의미 |
|----------|------------------|-----------------|
| embarrassed | embarazada | 임신한 |
| library | librería | 서점 |
| fabric | fábrica | 공장 |
| actual | actualmente | 현재 |
| exit | éxito | 성공 |

**활용:** MCQ 오답 선택지로 사용하여 학습 효과 극대화

---

## 7. 데이터 모델

### 7.1 핵심 엔티티

#### User (사용자)
```typescript
{
  id: string;              // UUID
  nativeLanguage: string;  // 모국어 (ko, es, etc.)
  targetLanguage: string;  // 목표어 (en)

  // 능력 추정치
  thetaGlobal: number;     // 전체 능력 (-3~+3)
  thetaPhonology: number;  // 음운론 능력
  thetaMorphology: number; // 형태론 능력
  thetaLexical: number;    // 어휘 능력
  thetaSyntactic: number;  // 통사론 능력
  thetaPragmatic: number;  // 화용론 능력
}
```

#### GoalSpec (학습 목표)
```typescript
{
  id: string;
  userId: string;

  domain: string;      // medical, legal, business, academic
  modality: string[];  // reading, listening, writing, speaking
  genre: string;       // report, conversation, presentation
  purpose: string;     // certification, professional
  benchmark?: string;  // CELBAN, IELTS, TOEFL
  deadline?: Date;

  completionPercent: number;  // 0-100
  isActive: boolean;
}
```

#### LanguageObject (학습 항목)
```typescript
{
  id: string;
  goalId: string;

  type: string;    // LEX, MORPH, G2P, SYNT, PRAG
  content: string; // 실제 단어/패턴

  // FRE 메트릭 (0-1)
  frequency: number;           // 빈도
  relationalDensity: number;   // 연결성
  contextualContribution: number; // 중요도

  // IRT 파라미터
  irtDifficulty: number;      // 난이도 (-3~+3)
  irtDiscrimination: number;  // 변별력 (0.5~2.5)

  priority: number;  // 계산된 우선순위
}
```

#### MasteryState (숙달 상태)
```typescript
{
  objectId: string;

  stage: number;  // 0-4

  // FSRS 스케줄링
  fsrsDifficulty: number;  // 1-10
  fsrsStability: number;   // 일수
  fsrsReps: number;        // 복습 횟수
  fsrsLapses: number;      // 실패 횟수

  // 정확도 추적
  cueFreeAccuracy: number;     // 힌트 없이 정확도
  cueAssistedAccuracy: number; // 힌트 있을 때 정확도
  exposureCount: number;       // 연습 횟수

  nextReview: Date;  // 다음 복습 예정일
}
```

#### Session (학습 세션)
```typescript
{
  id: string;
  userId: string;
  goalId: string;

  startedAt: Date;
  endedAt?: Date;
  mode: 'learning' | 'training' | 'evaluation';

  itemsPracticed: number;
  stageTransitions: number;
}
```

#### Response (응답 기록)
```typescript
{
  id: string;
  sessionId: string;
  objectId: string;

  taskType: string;   // recognition, recall, production
  taskFormat: string; // mcq, fill_blank, typing

  correct: boolean;
  responseTimeMs: number;
  cueLevel: number;  // 0-3
}
```

### 7.2 데이터 관계도

```
User (1)
  └─── goals: GoalSpec[] (N)
         └─── language_objects: LanguageObject[] (N)
                └─── mastery_state: MasteryState (1)
                └─── responses: Response[] (N)
         └─── sessions: Session[] (N)
                └─── responses: Response[] (N)
```

---

## 8. 시스템 아키텍처

### 8.1 고수준 아키텍처

```
┌────────────────────────────────────┐
│     렌더러 프로세스 (React)         │
│  - UI 페이지 (대시보드, 세션)       │
│  - 컴포넌트 (Glass 디자인)          │
│  - 훅 (useLogos)                   │
└────────────┬───────────────────────┘
             │ IPC (비동기 메시지)
             ▼
┌────────────────────────────────────┐
│     메인 프로세스 (Node.js)         │
│  - IPC 핸들러                      │
│  - 비즈니스 로직 서비스             │
│  - 코어 알고리즘                   │
│  - 데이터베이스 접근               │
└────────────┬───────────────────────┘
             │ SQL
             ▼
┌────────────────────────────────────┐
│     SQLite 데이터베이스 (로컬)      │
│  - 사용자, 목표, 학습 객체          │
│  - 숙달 상태, 세션, 응답           │
└────────────────────────────────────┘
             │ HTTPS
             ▼
┌────────────────────────────────────┐
│     Anthropic Claude API          │
│  - 과제 생성                       │
│  - 오류 분석                       │
│  - 힌트 생성                       │
└────────────────────────────────────┘
```

### 8.2 레이어 아키텍처

#### Layer 0: 코어 알고리즘 (`src/core/`)
**순수 TypeScript 함수** (부작용 없음)

| 파일 | 기능 |
|------|------|
| `irt.ts` | 능력 추정 (1PL/2PL/3PL 모델) |
| `fsrs.ts` | 간격 반복 스케줄링 |
| `pmi.ts` | 점별 상호정보 (단어 연관성) |
| `priority.ts` | FRE 기반 우선순위 계산 |
| `bottleneck.ts` | 오류 캐스케이드 감지 |
| `morphology.ts` | 단어 구조 분석 |
| `g2p.ts` | 문자-음소 변환 |

#### Layer 1: 서비스 (`src/main/services/`)
**비즈니스 로직 오케스트레이션**

```
3계층 학습 파이프라인:
1. state-priority.service.ts  → 학습 큐 구축
2. task-generation.service.ts → 과제 형식 선택
3. scoring-update.service.ts  → 응답 처리, 숙달 업데이트
```

#### Layer 2: IPC 핸들러 (`src/main/ipc/`)
**렌더러 ↔ 메인 프로세스 브릿지**

| 핸들러 | 기능 |
|--------|------|
| `goal.ipc.ts` | 목표 CRUD 작업 |
| `session.ipc.ts` | 학습 세션 관리 |
| `learning.ipc.ts` | 큐 및 숙달 작업 |
| `claude.ipc.ts` | AI 콘텐츠 생성 |
| `sync.ipc.ts` | 오프라인 동기화 |
| `onboarding.ipc.ts` | 온보딩 흐름 |

#### Layer 3: UI (`src/renderer/`)
**React 컴포넌트 및 페이지**

```
src/renderer/
├── pages/          # 라우트 레벨 컴포넌트
├── components/     # 재사용 가능 UI (Glass 디자인)
├── hooks/          # 커스텀 훅 (useLogos)
├── context/        # React 컨텍스트
└── App.tsx         # 루트 컴포넌트
```

### 8.3 IPC 통신 패턴

```typescript
// 렌더러에서 IPC 호출
const response = await window.logos.session.start(goalId, 'learning', 30);

// 메인 프로세스에서 처리
registerHandler('session:start', async (request) => {
  const task = await generateFirstTask(request.goalId);
  return { sessionId, firstTask: task, queueLength };
});
```

**IPC 채널 (40개 이상):**
- 목표: GOAL_CREATE, GOAL_UPDATE, GOAL_DELETE
- 세션: SESSION_START, SESSION_END, SESSION_SUBMIT
- 분석: ANALYTICS_GET_PROGRESS, ANALYTICS_GET_BOTTLENECKS
- AI: CLAUDE_GENERATE_TASK, CLAUDE_EVALUATE_RESPONSE

---

## 9. 사용자 흐름

### 9.1 온보딩 (첫 실행)

```
1. 앱 실행
   └── 사용자 존재 확인 → 없으면 온보딩 위자드 표시

2. 온보딩 위자드 (다단계 폼)

   Step 1: 언어 선택
   ├── 모국어 (드롭다운)
   ├── 목표어 (드롭다운)
   └── 다음

   Step 2: 목표 정의
   ├── 도메인 (medical/legal/business/academic)
   ├── 모달리티 (체크박스: reading/listening/writing/speaking)
   ├── 장르 (드롭다운)
   ├── 목적 (드롭다운)
   └── 다음

   Step 3: 벤치마크 & 기간
   ├── 목표 벤치마크 (CELBAN/IELTS/TOEFL)
   ├── 마감일 (날짜 선택기)
   ├── 일일 학습 시간 (슬라이더)
   └── 목표 생성

3. 첫 어휘 채우기
   └── 대시보드로 이동, "세션 시작" 버튼 표시
```

### 9.2 학습 세션 흐름

```
1. 사용자가 "세션 시작" 클릭
   └── IPC: session:start (goalId, mode, duration)

2. 메인 프로세스 (Layer 1: 상태 우선순위)
   ├── 사용자 theta 상태 가져오기
   ├── 학습 큐 구축 (복습 예정 + 새 항목)
   ├── 병목 감지
   └── 우선순위 정렬 (FRE + 긴급도 + 병목 부스트)

3. 메인 프로세스 (Layer 2: 과제 생성)
   ├── 대상 객체 선택 (큐 헤드)
   ├── 형식 결정 (단계 적합)
   ├── 모달리티 선택
   ├── 힌트 수준 결정
   └── 콘텐츠 생성 (캐시/Claude/템플릿)

4. 사용자에게 과제 표시 (React)
   ├── QuestionCard 컴포넌트
   ├── 문제, 선택지, 힌트 버튼 표시
   └── 응답 타이머 시작

5. 사용자 응답
   └── 제출 → IPC: session:submit-response

6. 메인 프로세스 (Layer 3: 채점 업데이트)
   ├── 정확도 평가
   ├── IRT theta 업데이트
   ├── FSRS 카드 업데이트
   ├── 숙달 단계 전환 확인
   └── 다음 과제 가져오기

7. 피드백 표시
   ├── 정답/오답
   ├── 획득 포인트
   ├── 단계 전환 (있으면)
   └── 다음 복습 날짜

8. 세션 완료까지 4-7 반복
   └── 요약 표시: 연습 항목 수, 정확도, 시간
```

### 9.3 학습 모드별 설정

| 모드 | 힌트 수준 | 난이도 | 신규/복습 비율 | 권장 시간 |
|------|----------|--------|---------------|----------|
| 학습 | 높음 (3) | 낮음 | 80/20 | 30분+ |
| 훈련 | 중간 (1-2) | 중간 | 40/60 | 20-30분 |
| 평가 | 없음 (0) | 전체 | 0/100 | 10-15분 |

---

## 10. 오프라인 기능

### 10.1 오프라인 큐 시스템

```typescript
// 오프라인 큐 항목 유형
type QueueItemType =
  | 'task_generation'      // 연습 문제 생성
  | 'error_analysis'       // 오류 분석
  | 'content_generation'   // 힌트/설명 생성
  | 'vocabulary_extraction'; // 문서에서 어휘 추출

// 상태 생명주기
pending → processing → completed
                    → failed (오류 포함)
```

### 10.2 오프라인 동작

**API 불가능 시:**
1. 요청을 오프라인 큐에 저장
2. 캐시에서 제공 (가능한 경우)
3. 템플릿 기반 생성으로 폴백
4. 연결 복원 시 재시도

**템플릿 폴백 예시:**
```typescript
// MCQ 템플릿 생성
function generateMCQTemplate(word: string, stage: number) {
  return {
    prompt: `"${word}"의 의미는?`,
    correctAnswer: getDictionary(word),
    distractors: selectPlausible(word, stage),
    hints: getDefaultHints(word, stage)
  };
}
```

### 10.3 동기화 추적

```typescript
// 동기화 상태 정보
interface SyncStatus {
  online: boolean;           // 현재 온라인 여부
  pendingItems: number;      // 대기 중인 항목 수
  processingItems: number;   // 처리 중인 항목 수
  failedItems: number;       // 실패한 항목 수
  lastSync: Date | null;     // 마지막 동기화 시간
  lastSyncSuccess: boolean;  // 마지막 동기화 성공 여부
  lastSyncItemCount: number; // 마지막 동기화 항목 수
}
```

---

## 부록

### A. 코퍼스 소스

LOGOS는 다양한 소스에서 어휘를 추출합니다:

| 소스 | 유형 | 설명 |
|------|------|------|
| Wikipedia | API | 도메인별 위키백과 문서 |
| Wiktionary | API | 단어 정의 및 카테고리 |
| PubMed | API | 의료 논문 초록 |
| 사용자 업로드 | 파일 | PDF, DOCX, TXT 문서 |
| Claude | AI | AI 생성 어휘 |

### B. 지원 문서 형식

| 형식 | MIME 타입 | 지원 수준 |
|------|----------|----------|
| 텍스트 | text/plain | 완전 지원 |
| 마크다운 | text/markdown | 완전 지원 |
| HTML | text/html | 태그 제거 |
| PDF | application/pdf | 기본 텍스트 추출 |
| DOCX | application/vnd.openxmlformats-* | XML 텍스트 추출 |
| RTF | application/rtf | 제어 문자 제거 |

### C. 용어 사전

| 용어 | 한국어 | 설명 |
|------|--------|------|
| IRT | 항목반응이론 | 능력-난이도 매칭 |
| FSRS | 자유 간격 반복 스케줄러 | 복습 최적화 |
| PMI | 점별 상호정보 | 단어 연관성 측정 |
| Theta (θ) | 세타 | 학습자 능력 파라미터 |
| Bottleneck | 병목 | 학습 장벽 근본 원인 |
| False Friends | 거짓 동족어 | 유사하지만 다른 의미의 단어 |
| Scaffolding | 스캐폴딩 | 점진적 힌트 제공 |

---

**문서 생성일:** 2026-01-05
**LOGOS 버전:** 0.1.0
**언어:** 한국어 (Korean)
