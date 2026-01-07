# agent.ipc.ts — Agent Coordination and Bottleneck Management

## Why This Exists

LOGOS employs a multi-agent development architecture where specialized agents handle different aspects of the codebase. This IPC module provides the communication bridge that allows the renderer process to interact with the agent trigger service, enabling dynamic agent coordination, bottleneck detection, and even the spawning of new specialized agents via the meta-agent-builder pattern. Without this, the self-improving agent ecosystem would have no way to receive UI-driven context or report development blockers back to the orchestration layer.

## Key Concepts

- **TriggerContext**: Encapsulates the operation being performed, file locations touched, architectural layers involved, and optional flags for security sensitivity or external API usage. This context drives which agents get activated.

- **DevelopmentBottleneck**: A structured representation of a development blocker, including its type (e.g., `missing_spec`, `integration_failure`, `security_concern`), location, what it's blocked by, and a proposed fix. Bottlenecks accumulate and can trigger the meta-agent-builder when patterns emerge.

- **AgentType / BottleneckType**: Typed enumerations that constrain the system to known agent specializations and bottleneck categories, preventing typos and enabling type-safe orchestration.

- **Meta-Agent-Builder Pattern**: When the same bottleneck type appears repeatedly or no existing agent can handle a gap, the system can generate a specification for a new agent. This is self-evolving architecture.

- **Trigger History**: A log of all agent triggers, enabling analysis of which agents are most frequently needed and helping identify patterns in development workflow.

## Design Decisions

**Bottleneck-Driven Agent Spawning**: Rather than pre-defining all possible agents, the system learns from repeated failures. If `integration_failure` bottlenecks keep appearing in a specific location, the meta-agent-builder can be triggered to propose a new specialist. This is a bet on emergent specialization over upfront design.

**Severity Levels**: Bottlenecks carry severity (`low`, `medium`, `high`, `critical`) allowing prioritization. This prevents minor issues from triggering heavy-weight responses while ensuring critical blockers get immediate attention.

**ID-Based Bottleneck Resolution**: Bottlenecks are identified by a composite key (`type-location` or just `location`), which is pragmatic but creates ambiguity if the same location has multiple bottleneck types. A future revision might use proper UUIDs.

**Service Singleton Pattern**: The `getAgentTriggerService()` function returns a singleton, ensuring consistent state across all IPC invocations. This matters because trigger history and active bottlenecks are stateful.

## Integration Points

**Upstream Dependencies**:
- `./contracts`: Provides `registerHandler`, `success`, `error`, `validateNonEmpty` for consistent IPC patterns
- `../services/agent-trigger.service`: The actual business logic for trigger detection, bottleneck management, and spec generation

**Downstream Consumers**:
- Renderer process UI components that display bottlenecks, allow manual agent triggering, or show trigger history
- Development tooling that might programmatically register bottlenecks (e.g., test runners, CI/CD hooks)
- The meta-agent-builder system, which consumes generated specs to create new agents

**Sibling IPC Modules**:
- Works alongside `session.ipc.ts`, `goal.ipc.ts`, etc., but operates at a meta-level (about development process, not learning content)

**Handler Channels**:
| Channel | Purpose |
|---------|---------|
| `agent:detectTriggers` | Given context, returns which agents should be activated |
| `agent:registerBottleneck` | Records a development blocker and returns triggered agents |
| `agent:getBottlenecks` | Lists all active unresolved bottlenecks |
| `agent:resolveBottleneck` | Marks a bottleneck as resolved |
| `agent:getTriggerHistory` | Returns log of all past triggers |
| `agent:generateSpec` | Creates agent specification from a bottleneck (meta-agent-builder) |
| `agent:clearHistory` | Resets trigger history for fresh analysis |
