# Agent Hooks Service

> **Code**: `src/main/services/agent-hooks.service.ts`
> **Tier**: 2 (Service Layer)

---

## 목적

IPC 핸들러에 통합 가능한 자동 에이전트 트리거 훅 제공. IPC 작업과 에이전트 조정 사이의 브릿지.

---

## Domain-Layer Mapping

```typescript
// lines 75-83
DOMAIN_LAYER_MAP: Record<DomainType, Layer[]> = {
  goal: ['ipc', 'db'],
  object: ['ipc', 'db', 'core'],
  session: ['ipc', 'db', 'core'],
  claude: ['ipc', 'service'],
  queue: ['ipc', 'core'],
  analytics: ['ipc', 'db', 'core'],
  agent: ['ipc', 'service']
};
```

---

## Hook Functions

### preOperationHook

```typescript
// lines 115-143
preOperationHook(context: HookContext): HookResult
```

작업 전 에이전트 트리거 감지:
- 레이어 결정
- 보안 민감도 체크
- 외부 API 필요 여부

### postOperationHook

```typescript
// lines 148-179
postOperationHook(context, success, result): HookResult
```

작업 후 결과 처리:
- 실패시 병목으로 등록
- 에러 유형 추론

### errorHook

```typescript
// lines 184-207
errorHook(domain, operation, location, error): HookResult
```

에러 발생시:
- 병목 유형 추론
- 영향받는 에이전트 결정
- 우선순위 'immediate'로 설정

---

## Error Type Inference

```typescript
// lines 216-242
function inferBottleneckType(error: Error): BottleneckType {
  const message = error.message.toLowerCase();

  if (message.includes('not found')) return 'missing_spec';
  if (message.includes('conflict')) return 'conflicting_docs';
  if (message.includes('algorithm')) return 'missing_algorithm';
  if (message.includes('dependency')) return 'dependency_issue';
  if (message.includes('integration')) return 'integration_failure';
  if (message.includes('security')) return 'security_concern';
  if (message.includes('performance')) return 'performance_issue';

  return 'integration_failure';  // default
}
```

---

## withAgentHooks Wrapper

```typescript
// lines 280-340
function withAgentHooks<TRequest, TResponse>(
  domain: DomainType,
  operation: OperationType,
  location: string,
  handler: (request) => Promise<Result>
): WrappedHandler
```

**사용 예시**:
```typescript
const wrappedHandler = withAgentHooks(
  'goal',
  'create',
  'src/main/handlers/goal.ipc.ts',
  originalHandler
);
```

**동작**:
1. `preOperationHook` 호출
2. 원래 핸들러 실행
3. 성공/실패에 따라 `postOperationHook` 또는 `errorHook`
4. 트리거 로깅

---

## Convenience Functions

```typescript
// lines 345-367
triggerDocumentation(filePath): AgentTrigger[]
triggerSecurityReview(filePath): AgentTrigger[]
```

수동으로 특정 에이전트 트리거 요청.

---

## 의존 관계

```
agent-hooks.service.ts
  │
  ├──> agent-trigger.service.ts (트리거 로직)
  │
  └──> 소비자:
       └── IPC handlers (래퍼 적용)
```
