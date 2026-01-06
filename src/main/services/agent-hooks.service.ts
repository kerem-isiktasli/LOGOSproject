/**
 * Agent Hooks Service
 *
 * Provides automatic agent trigger hooks that can be integrated into IPC handlers.
 * This bridges the gap between IPC operations and agent coordination.
 *
 * @see DEVELOPMENT-PROTOCOL.md Agent Coordination Protocol
 * @see AGENT-MANIFEST.md Bottleneck Detection Protocol
 */

import {
  getAgentTriggerService,
  detectAgentTriggers,
  registerBottleneck,
  type TriggerContext,
  type DevelopmentBottleneck,
  type AgentTrigger,
  type AgentType,
  type BottleneckType,
} from './agent-trigger.service';

// ============================================================================
// Types
// ============================================================================

/**
 * Operation type for automatic agent detection.
 */
export type OperationType =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'import'
  | 'search'
  | 'generate'
  | 'analyze'
  | 'session_start'
  | 'session_end'
  | 'submit_response';

/**
 * Domain category for IPC operations.
 */
export type DomainType = 'goal' | 'object' | 'session' | 'claude' | 'queue' | 'analytics' | 'agent';

/**
 * Hook context for automatic agent detection.
 */
export interface HookContext {
  domain: DomainType;
  operation: OperationType;
  location: string;
  securitySensitive?: boolean;
  externalApi?: boolean;
  error?: Error;
}

/**
 * Hook result with trigger recommendations.
 */
export interface HookResult {
  triggers: AgentTrigger[];
  shouldNotify: boolean;
  priority: 'immediate' | 'soon' | 'when_available';
}

// ============================================================================
// Layer Detection
// ============================================================================

/**
 * Map domain to architectural layers.
 */
const DOMAIN_LAYER_MAP: Record<DomainType, ('ui' | 'ipc' | 'db' | 'core' | 'service')[]> = {
  goal: ['ipc', 'db'],
  object: ['ipc', 'db', 'core'],
  session: ['ipc', 'db', 'core'],
  claude: ['ipc', 'service'],
  queue: ['ipc', 'core'],
  analytics: ['ipc', 'db', 'core'],
  agent: ['ipc', 'service'],
};

/**
 * Map operation type to security sensitivity.
 */
const SECURITY_SENSITIVE_OPERATIONS: OperationType[] = [
  'create',
  'update',
  'delete',
  'import',
];

/**
 * Map operation type to external API requirement.
 */
const EXTERNAL_API_OPERATIONS: Record<DomainType, OperationType[]> = {
  claude: ['generate', 'analyze'],
  goal: [],
  object: [],
  session: [],
  queue: [],
  analytics: [],
  agent: [],
};

// ============================================================================
// Hook Functions
// ============================================================================

/**
 * Pre-operation hook: detect which agents should be triggered before an operation.
 */
export function preOperationHook(context: HookContext): HookResult {
  const layers = DOMAIN_LAYER_MAP[context.domain] || ['ipc'];
  const isSecuritySensitive =
    context.securitySensitive ??
    SECURITY_SENSITIVE_OPERATIONS.includes(context.operation);
  const isExternalApi =
    context.externalApi ??
    (EXTERNAL_API_OPERATIONS[context.domain] || []).includes(context.operation);

  const triggerContext: TriggerContext = {
    operation: `${context.domain}:${context.operation}`,
    location: [context.location],
    layers,
    securitySensitive: isSecuritySensitive,
    externalApi: isExternalApi,
  };

  const triggers = detectAgentTriggers(triggerContext);

  // Determine if we should notify based on priority
  const hasImmediate = triggers.some(t => t.priority === 'immediate');
  const hasSoon = triggers.some(t => t.priority === 'soon');

  return {
    triggers,
    shouldNotify: hasImmediate || hasSoon,
    priority: hasImmediate ? 'immediate' : hasSoon ? 'soon' : 'when_available',
  };
}

/**
 * Post-operation hook: handle operation results and detect bottlenecks.
 */
export function postOperationHook(
  context: HookContext,
  success: boolean,
  result?: unknown
): HookResult {
  // If operation failed, register as potential bottleneck
  if (!success && context.error) {
    const bottleneck: DevelopmentBottleneck = {
      type: inferBottleneckType(context.error),
      location: context.location,
      blockedBy: context.error.message,
      proposedFix: `Review ${context.domain}:${context.operation} implementation`,
      affectedAgents: inferAffectedAgents(context),
      severity: 'medium',
      detectedAt: new Date(),
    };

    const triggers = registerBottleneck(bottleneck);

    return {
      triggers,
      shouldNotify: true,
      priority: 'immediate',
    };
  }

  return {
    triggers: [],
    shouldNotify: false,
    priority: 'when_available',
  };
}

/**
 * Error hook: register error as bottleneck and trigger appropriate agents.
 */
export function errorHook(
  domain: DomainType,
  operation: OperationType,
  location: string,
  error: Error
): HookResult {
  const bottleneck: DevelopmentBottleneck = {
    type: inferBottleneckType(error),
    location,
    blockedBy: error.message,
    proposedFix: `Debug and fix ${domain}:${operation} error`,
    affectedAgents: inferAffectedAgentsFromDomain(domain),
    severity: 'high',
    detectedAt: new Date(),
  };

  const triggers = registerBottleneck(bottleneck);

  return {
    triggers,
    shouldNotify: true,
    priority: 'immediate',
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Infer bottleneck type from error.
 */
function inferBottleneckType(error: Error): BottleneckType {
  const message = error.message.toLowerCase();

  if (message.includes('not found') || message.includes('missing')) {
    return 'missing_spec';
  }
  if (message.includes('conflict') || message.includes('duplicate')) {
    return 'conflicting_docs';
  }
  if (message.includes('algorithm') || message.includes('compute') || message.includes('calculate')) {
    return 'missing_algorithm';
  }
  if (message.includes('dependency') || message.includes('import') || message.includes('module')) {
    return 'dependency_issue';
  }
  if (message.includes('integration') || message.includes('connect') || message.includes('api')) {
    return 'integration_failure';
  }
  if (message.includes('security') || message.includes('auth') || message.includes('permission')) {
    return 'security_concern';
  }
  if (message.includes('slow') || message.includes('timeout') || message.includes('performance')) {
    return 'performance_issue';
  }

  return 'integration_failure';
}

/**
 * Infer affected agents from context.
 */
function inferAffectedAgents(context: HookContext): AgentType[] {
  return inferAffectedAgentsFromDomain(context.domain);
}

/**
 * Infer affected agents from domain.
 */
function inferAffectedAgentsFromDomain(domain: DomainType): AgentType[] {
  switch (domain) {
    case 'goal':
    case 'object':
    case 'queue':
      return ['database-specialist', 'api-specialist'];
    case 'session':
    case 'analytics':
      return ['database-specialist', 'api-specialist', 'frontend-specialist'];
    case 'claude':
      return ['api-specialist', 'mcp-specialist'];
    case 'agent':
      return ['agent-optimizer', 'meta-agent-builder'];
    default:
      return ['api-specialist'];
  }
}

// ============================================================================
// Convenience Wrappers
// ============================================================================

/**
 * Wrap an IPC handler with automatic agent hooks.
 * This provides automatic agent trigger detection without modifying handler logic.
 */
export function withAgentHooks<TRequest, TResponse>(
  domain: DomainType,
  operation: OperationType,
  location: string,
  handler: (request: TRequest) => Promise<{ success: boolean; data?: TResponse; error?: string }>
): (request: TRequest) => Promise<{ success: boolean; data?: TResponse; error?: string }> {
  return async (request: TRequest) => {
    const hookContext: HookContext = { domain, operation, location };

    // Pre-operation hook (detect triggers)
    const preResult = preOperationHook(hookContext);

    // Log if immediate triggers detected
    if (preResult.shouldNotify && preResult.priority === 'immediate') {
      console.log(
        `[AgentHook] Immediate triggers for ${domain}:${operation}:`,
        preResult.triggers.map(t => t.agent)
      );
    }

    try {
      // Execute handler
      const result = await handler(request);

      // Post-operation hook
      const postResult = postOperationHook(
        hookContext,
        result.success,
        result.data
      );

      // Log bottlenecks if detected
      if (postResult.shouldNotify) {
        console.log(
          `[AgentHook] Bottleneck detected for ${domain}:${operation}:`,
          postResult.triggers.map(t => `${t.agent}: ${t.reason}`)
        );
      }

      return result;
    } catch (error) {
      // Error hook
      const errorResult = errorHook(
        domain,
        operation,
        location,
        error as Error
      );

      console.error(
        `[AgentHook] Error in ${domain}:${operation}:`,
        errorResult.triggers.map(t => `${t.agent}: ${t.reason}`)
      );

      return {
        success: false,
        error: (error as Error).message,
      };
    }
  };
}

/**
 * Manually trigger documentation agent for a file.
 */
export function triggerDocumentation(filePath: string): AgentTrigger[] {
  const context: TriggerContext = {
    operation: 'documentation_required',
    location: [filePath],
    layers: ['ipc'],
  };

  return detectAgentTriggers(context);
}

/**
 * Manually trigger security review for a file.
 */
export function triggerSecurityReview(filePath: string): AgentTrigger[] {
  const context: TriggerContext = {
    operation: 'security_review_required',
    location: [filePath],
    layers: ['ipc', 'service'],
    securitySensitive: true,
  };

  return detectAgentTriggers(context);
}

// ============================================================================
// Export Service Access
// ============================================================================

export { getAgentTriggerService, detectAgentTriggers, registerBottleneck };
export type { TriggerContext, DevelopmentBottleneck, AgentTrigger, AgentType, BottleneckType };
