/**
 * Agent Trigger Service
 *
 * Provides automatic agent trigger detection and activation logic.
 * Implements the missing link between bottleneck detection and agent invocation.
 *
 * @see DEVELOPMENT-PROTOCOL.md Agent Coordination Protocol
 * @see AGENT-MANIFEST.md Bottleneck Detection Protocol
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Development bottleneck types that can trigger agent activation.
 * @see AGENT-MANIFEST.md lines 106-108
 */
export type BottleneckType =
  | 'missing_spec'
  | 'conflicting_docs'
  | 'missing_algorithm'
  | 'dependency_issue'
  | 'integration_failure'
  | 'missing_agent_specialization'
  | 'security_concern'
  | 'performance_issue'
  | 'documentation_gap';

/**
 * Available agent types in the LOGOS system.
 * @see DEVELOPMENT-PROTOCOL.md lines 577-602
 */
export type AgentType =
  | 'frontend-specialist'
  | 'api-specialist'
  | 'database-specialist'
  | 'documentation-specialist'
  | 'security-specialist'
  | 'debug-git-specialist'
  | 'mcp-specialist'
  | 'agent-optimizer'
  | 'meta-agent-builder';

/**
 * Context for trigger detection.
 */
export interface TriggerContext {
  /** Current operation being performed */
  operation: string;
  /** Files or components involved */
  location: string[];
  /** Layer(s) affected: 'ui' | 'ipc' | 'db' | 'core' | 'service' */
  layers: ('ui' | 'ipc' | 'db' | 'core' | 'service')[];
  /** Any detected issues or anomalies */
  issues?: string[];
  /** Is this a security-sensitive operation? */
  securitySensitive?: boolean;
  /** Is external API involved? */
  externalApi?: boolean;
}

/**
 * Development bottleneck structure.
 * @see AGENT-MANIFEST.md lines 105-113
 */
export interface DevelopmentBottleneck {
  type: BottleneckType;
  location: string;
  blockedBy: string;
  proposedFix: string;
  affectedAgents: AgentType[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  detectedAt: Date;
}

/**
 * Agent trigger recommendation.
 */
export interface AgentTrigger {
  agent: AgentType;
  reason: string;
  priority: 'immediate' | 'soon' | 'when_available';
  context: TriggerContext;
  bottleneck?: DevelopmentBottleneck;
}

/**
 * Agent creation specification for meta-agent-builder.
 */
export interface AgentCreationSpec {
  name: string;
  specialization: string;
  tools: string[];
  triggerConditions: string[];
  responsibilities: string[];
}

// ============================================================================
// Trigger Detection Rules
// ============================================================================

/**
 * Layer-to-agent mapping for automatic detection.
 */
const LAYER_AGENT_MAP: Record<string, AgentType[]> = {
  ui: ['frontend-specialist'],
  ipc: ['api-specialist'],
  db: ['database-specialist'],
  core: ['api-specialist', 'database-specialist'],
  service: ['api-specialist', 'mcp-specialist'],
};

/**
 * File pattern to agent mapping.
 */
const FILE_PATTERN_AGENT_MAP: Array<{ pattern: RegExp; agents: AgentType[] }> = [
  { pattern: /\.tsx?$/, agents: ['frontend-specialist'] },
  { pattern: /\.ipc\.ts$/, agents: ['api-specialist'] },
  { pattern: /schema\.prisma|\.db\.ts|db\//, agents: ['database-specialist'] },
  { pattern: /claude|anthropic|api/i, agents: ['api-specialist', 'mcp-specialist'] },
  { pattern: /auth|token|key|secret|password/i, agents: ['security-specialist'] },
  { pattern: /\.md$/, agents: ['documentation-specialist'] },
];

/**
 * Bottleneck type to primary agent mapping.
 */
const BOTTLENECK_AGENT_MAP: Record<BottleneckType, AgentType[]> = {
  missing_spec: ['documentation-specialist', 'meta-agent-builder'],
  conflicting_docs: ['documentation-specialist'],
  missing_algorithm: ['api-specialist', 'database-specialist'],
  dependency_issue: ['mcp-specialist', 'debug-git-specialist'],
  integration_failure: ['api-specialist', 'debug-git-specialist'],
  missing_agent_specialization: ['meta-agent-builder'],
  security_concern: ['security-specialist'],
  performance_issue: ['agent-optimizer'],
  documentation_gap: ['documentation-specialist'],
};

// ============================================================================
// Agent Trigger Service
// ============================================================================

/**
 * Service for detecting and managing agent triggers.
 */
export class AgentTriggerService {
  private activeBottlenecks: DevelopmentBottleneck[] = [];
  private triggerHistory: AgentTrigger[] = [];

  /**
   * Analyze context and determine which agents should be triggered.
   */
  detectTriggers(context: TriggerContext): AgentTrigger[] {
    const triggers: AgentTrigger[] = [];

    // 1. Layer-based triggers
    for (const layer of context.layers) {
      const agents = LAYER_AGENT_MAP[layer] || [];
      for (const agent of agents) {
        triggers.push({
          agent,
          reason: `Working on ${layer} layer`,
          priority: 'when_available',
          context,
        });
      }
    }

    // 2. File pattern-based triggers
    for (const location of context.location) {
      for (const { pattern, agents } of FILE_PATTERN_AGENT_MAP) {
        if (pattern.test(location)) {
          for (const agent of agents) {
            if (!triggers.some(t => t.agent === agent)) {
              triggers.push({
                agent,
                reason: `File pattern match: ${location}`,
                priority: 'when_available',
                context,
              });
            }
          }
        }
      }
    }

    // 3. Security-sensitive trigger
    if (context.securitySensitive) {
      triggers.push({
        agent: 'security-specialist',
        reason: 'Security-sensitive operation detected',
        priority: 'immediate',
        context,
      });
    }

    // 4. External API trigger
    if (context.externalApi) {
      triggers.push({
        agent: 'mcp-specialist',
        reason: 'External API integration detected',
        priority: 'soon',
        context,
      });
    }

    // 5. Always trigger documentation for code changes
    if (context.layers.some(l => ['ui', 'ipc', 'db', 'core', 'service'].includes(l))) {
      triggers.push({
        agent: 'documentation-specialist',
        reason: 'Code change requires shadow documentation',
        priority: 'soon',
        context,
      });
    }

    // Deduplicate and prioritize
    return this.deduplicateAndPrioritize(triggers);
  }

  /**
   * Register a development bottleneck and get recommended agents.
   */
  registerBottleneck(bottleneck: DevelopmentBottleneck): AgentTrigger[] {
    this.activeBottlenecks.push(bottleneck);

    const agents = BOTTLENECK_AGENT_MAP[bottleneck.type] || [];
    const triggers: AgentTrigger[] = [];

    for (const agent of agents) {
      const trigger: AgentTrigger = {
        agent,
        reason: `Bottleneck: ${bottleneck.type} - ${bottleneck.blockedBy}`,
        priority: this.severityToPriority(bottleneck.severity),
        context: {
          operation: 'bottleneck_resolution',
          location: [bottleneck.location],
          layers: [],
          issues: [bottleneck.proposedFix],
        },
        bottleneck,
      };
      triggers.push(trigger);
      this.triggerHistory.push(trigger);
    }

    // Check if meta-agent-builder should be triggered
    if (this.shouldTriggerMetaAgent(bottleneck)) {
      triggers.push({
        agent: 'meta-agent-builder',
        reason: `Gap detected: existing agents cannot handle ${bottleneck.type}`,
        priority: 'immediate',
        context: {
          operation: 'agent_creation',
          location: [bottleneck.location],
          layers: [],
          issues: [bottleneck.blockedBy],
        },
        bottleneck,
      });
    }

    return triggers;
  }

  /**
   * Determine if meta-agent-builder should be triggered.
   * Conditions:
   * 1. Bottleneck type is 'missing_agent_specialization'
   * 2. No existing agent can handle the bottleneck
   * 3. Same type of bottleneck has occurred 3+ times
   */
  private shouldTriggerMetaAgent(bottleneck: DevelopmentBottleneck): boolean {
    // Explicit trigger
    if (bottleneck.type === 'missing_agent_specialization') {
      return true;
    }

    // Check for repeated bottlenecks of same type
    const sameTypeCount = this.activeBottlenecks.filter(
      b => b.type === bottleneck.type && b.blockedBy === bottleneck.blockedBy
    ).length;

    if (sameTypeCount >= 3) {
      return true;
    }

    // Check if no agent is mapped to this bottleneck type
    const mappedAgents = BOTTLENECK_AGENT_MAP[bottleneck.type];
    if (!mappedAgents || mappedAgents.length === 0) {
      return true;
    }

    return false;
  }

  /**
   * Generate specification for a new agent when meta-agent-builder is triggered.
   */
  generateAgentSpec(bottleneck: DevelopmentBottleneck): AgentCreationSpec {
    return {
      name: `${bottleneck.blockedBy.toLowerCase().replace(/\s+/g, '-')}-specialist`,
      specialization: bottleneck.blockedBy,
      tools: this.inferRequiredTools(bottleneck),
      triggerConditions: [
        `Bottleneck type: ${bottleneck.type}`,
        `Location pattern: ${bottleneck.location}`,
      ],
      responsibilities: [
        bottleneck.proposedFix,
        `Handle ${bottleneck.type} issues in ${bottleneck.location}`,
      ],
    };
  }

  /**
   * Infer required tools based on bottleneck characteristics.
   */
  private inferRequiredTools(bottleneck: DevelopmentBottleneck): string[] {
    const tools: string[] = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'];

    if (bottleneck.location.includes('api') || bottleneck.location.includes('service')) {
      tools.push('WebFetch', 'WebSearch');
    }

    return tools;
  }

  /**
   * Convert severity to priority.
   */
  private severityToPriority(severity: DevelopmentBottleneck['severity']): AgentTrigger['priority'] {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'immediate';
      case 'medium':
        return 'soon';
      case 'low':
      default:
        return 'when_available';
    }
  }

  /**
   * Deduplicate triggers and sort by priority.
   */
  private deduplicateAndPrioritize(triggers: AgentTrigger[]): AgentTrigger[] {
    const seen = new Map<AgentType, AgentTrigger>();

    for (const trigger of triggers) {
      const existing = seen.get(trigger.agent);
      if (!existing || this.isHigherPriority(trigger.priority, existing.priority)) {
        seen.set(trigger.agent, trigger);
      }
    }

    const priorityOrder = { immediate: 0, soon: 1, when_available: 2 };
    return Array.from(seen.values()).sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    );
  }

  /**
   * Compare priorities.
   */
  private isHigherPriority(
    a: AgentTrigger['priority'],
    b: AgentTrigger['priority']
  ): boolean {
    const priorityOrder = { immediate: 0, soon: 1, when_available: 2 };
    return priorityOrder[a] < priorityOrder[b];
  }

  /**
   * Resolve a bottleneck (mark as handled).
   */
  resolveBottleneck(bottleneckIndex: number): void {
    if (bottleneckIndex >= 0 && bottleneckIndex < this.activeBottlenecks.length) {
      this.activeBottlenecks.splice(bottleneckIndex, 1);
    }
  }

  /**
   * Get all active bottlenecks.
   */
  getActiveBottlenecks(): DevelopmentBottleneck[] {
    return [...this.activeBottlenecks];
  }

  /**
   * Get trigger history.
   */
  getTriggerHistory(): AgentTrigger[] {
    return [...this.triggerHistory];
  }

  /**
   * Clear trigger history.
   */
  clearHistory(): void {
    this.triggerHistory = [];
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let agentTriggerService: AgentTriggerService | null = null;

/**
 * Get the agent trigger service singleton.
 */
export function getAgentTriggerService(): AgentTriggerService {
  if (!agentTriggerService) {
    agentTriggerService = new AgentTriggerService();
  }
  return agentTriggerService;
}

/**
 * Convenience function to detect triggers from context.
 */
export function detectAgentTriggers(context: TriggerContext): AgentTrigger[] {
  return getAgentTriggerService().detectTriggers(context);
}

/**
 * Convenience function to register a bottleneck.
 */
export function registerBottleneck(bottleneck: DevelopmentBottleneck): AgentTrigger[] {
  return getAgentTriggerService().registerBottleneck(bottleneck);
}
