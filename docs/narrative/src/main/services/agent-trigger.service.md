# Agent Trigger Service

> **Code**: `src/main/services/agent-trigger.service.ts`
> **Tier**: 2 (Service Layer)

---

## 목적

개발 병목 감지와 에이전트 자동 활성화. Bottleneck Detection Protocol 구현.

**핵심 기능**:
- 맥락 기반 트리거 감지 (레이어, 파일 패턴)
- 병목 등록 및 에이전트 매핑
- Meta-Agent 생성 조건 판단

---

## Trigger Detection Rules

### Layer-Agent Mapping

```typescript
// lines 106-112
LAYER_AGENT_MAP: Record<string, AgentType[]> = {
  ui: ['frontend-specialist'],
  ipc: ['api-specialist'],
  db: ['database-specialist'],
  core: ['api-specialist', 'database-specialist'],
  service: ['api-specialist', 'mcp-specialist']
};
```

### File Pattern Mapping

```typescript
// lines 117-124
FILE_PATTERN_AGENT_MAP = [
  { pattern: /\.tsx?$/, agents: ['frontend-specialist'] },
  { pattern: /\.ipc\.ts$/, agents: ['api-specialist'] },
  { pattern: /schema\.prisma|\.db\.ts|db\//, agents: ['database-specialist'] },
  { pattern: /claude|anthropic|api/i, agents: ['api-specialist', 'mcp-specialist'] },
  { pattern: /auth|token|key|secret|password/i, agents: ['security-specialist'] },
  { pattern: /\.md$/, agents: ['documentation-specialist'] }
];
```

### Bottleneck-Agent Mapping

```typescript
// lines 129-139
BOTTLENECK_AGENT_MAP: Record<BottleneckType, AgentType[]> = {
  missing_spec: ['documentation-specialist', 'meta-agent-builder'],
  conflicting_docs: ['documentation-specialist'],
  missing_algorithm: ['api-specialist', 'database-specialist'],
  dependency_issue: ['mcp-specialist', 'debug-git-specialist'],
  integration_failure: ['api-specialist', 'debug-git-specialist'],
  missing_agent_specialization: ['meta-agent-builder'],
  security_concern: ['security-specialist'],
  performance_issue: ['agent-optimizer'],
  documentation_gap: ['documentation-specialist']
};
```

---

## AgentTriggerService 클래스

### detectTriggers(context)

```typescript
// lines 155-221
detectTriggers(context: TriggerContext): AgentTrigger[]
```

트리거 감지 순서:
1. **레이어 기반**: 작업 중인 아키텍처 레이어
2. **파일 패턴 기반**: 파일 경로 패턴 매칭
3. **보안 민감도**: securitySensitive = true
4. **외부 API**: externalApi = true
5. **문서화 필요**: 코드 변경시 항상

### registerBottleneck(bottleneck)

```typescript
// lines 226-266
registerBottleneck(bottleneck: DevelopmentBottleneck): AgentTrigger[]
```

병목 등록 후 적절한 에이전트 트리거 반환.

### Meta-Agent 생성 조건

```typescript
// lines 275-297
shouldTriggerMetaAgent(bottleneck): boolean {
  // 1. 명시적 요청
  if (bottleneck.type === 'missing_agent_specialization') return true;

  // 2. 동일 병목 3회 이상 반복
  if (sameTypeCount >= 3) return true;

  // 3. 매핑된 에이전트 없음
  if (!mappedAgents || mappedAgents.length === 0) return true;
}
```

---

## Priority System

```typescript
type Priority = 'immediate' | 'soon' | 'when_available';
```

| Severity | Priority | 조건 |
|----------|----------|------|
| critical | immediate | 보안 문제, 빌드 실패 |
| high | immediate | 블로킹 이슈 |
| medium | soon | 기능 저하 |
| low | when_available | 개선 사항 |

---

## Agent Creation Spec

```typescript
// lines 302-316
generateAgentSpec(bottleneck): AgentCreationSpec {
  return {
    name: `${bottleneck.blockedBy}-specialist`,
    specialization: bottleneck.blockedBy,
    tools: inferRequiredTools(bottleneck),
    triggerConditions: [...],
    responsibilities: [...]
  };
}
```

---

## 의존 관계

```
agent-trigger.service.ts
  │
  ├──> DEVELOPMENT-PROTOCOL.md (에이전트 정의)
  │
  ├──> AGENT-MANIFEST.md (병목 프로토콜)
  │
  └──> 소비자:
       ├── agent-hooks.service.ts (IPC 통합)
       └── 개발 워크플로우 (수동 호출)
```
