/**
 * Agent IPC Handlers
 *
 * Handles all agent-related IPC communication including:
 * - Trigger detection
 * - Bottleneck registration
 * - Agent coordination
 * - Meta-agent-builder invocation
 *
 * @see DEVELOPMENT-PROTOCOL.md Agent Coordination Protocol
 * @see AGENT-MANIFEST.md Bottleneck Detection Protocol
 */

import { registerHandler, success, error, validateNonEmpty } from './contracts';
import {
  getAgentTriggerService,
  type TriggerContext,
  type DevelopmentBottleneck,
  type AgentType,
  type BottleneckType,
} from '../services/agent-trigger.service';

// ============================================================================
// Handler Registration
// ============================================================================

/**
 * Register all agent-related IPC handlers.
 */
export function registerAgentHandlers(): void {
  // Detect which agents should be triggered for given context
  registerHandler('agent:detectTriggers', async (_event, request) => {
    const { operation, location, layers, issues, securitySensitive, externalApi } = request as {
      operation: string;
      location: string[];
      layers: ('ui' | 'ipc' | 'db' | 'core' | 'service')[];
      issues?: string[];
      securitySensitive?: boolean;
      externalApi?: boolean;
    };

    const operationError = validateNonEmpty(operation, 'operation');
    if (operationError) return error(operationError);

    if (!Array.isArray(location) || location.length === 0) {
      return error('location must be a non-empty array');
    }

    if (!Array.isArray(layers) || layers.length === 0) {
      return error('layers must be a non-empty array');
    }

    try {
      const context: TriggerContext = {
        operation,
        location,
        layers,
        issues,
        securitySensitive,
        externalApi,
      };

      const service = getAgentTriggerService();
      const triggers = service.detectTriggers(context);

      return success({
        triggers: triggers.map(t => ({
          agent: t.agent,
          reason: t.reason,
          priority: t.priority,
        })),
        count: triggers.length,
      });
    } catch (err) {
      console.error('Failed to detect agent triggers:', err);
      return error(err instanceof Error ? err.message : 'Failed to detect agent triggers');
    }
  });

  // Register a development bottleneck
  registerHandler('agent:registerBottleneck', async (_event, request) => {
    const { type, location, blockedBy, proposedFix, affectedAgents, severity } = request as {
      type: BottleneckType;
      location: string;
      blockedBy: string;
      proposedFix: string;
      affectedAgents?: AgentType[];
      severity?: 'low' | 'medium' | 'high' | 'critical';
    };

    const typeError = validateNonEmpty(type, 'type');
    if (typeError) return error(typeError);

    const locationError = validateNonEmpty(location, 'location');
    if (locationError) return error(locationError);

    const blockedByError = validateNonEmpty(blockedBy, 'blockedBy');
    if (blockedByError) return error(blockedByError);

    const proposedFixError = validateNonEmpty(proposedFix, 'proposedFix');
    if (proposedFixError) return error(proposedFixError);

    try {
      const bottleneck: DevelopmentBottleneck = {
        type,
        location,
        blockedBy,
        proposedFix,
        affectedAgents: affectedAgents || [],
        severity: severity || 'medium',
        detectedAt: new Date(),
      };

      const service = getAgentTriggerService();
      const triggers = service.registerBottleneck(bottleneck);

      // Check if meta-agent-builder was triggered
      const metaAgentTriggered = triggers.some(t => t.agent === 'meta-agent-builder');

      return success({
        triggers: triggers.map(t => ({
          agent: t.agent,
          reason: t.reason,
          priority: t.priority,
        })),
        metaAgentTriggered,
        bottleneckRegistered: true,
      });
    } catch (err) {
      console.error('Failed to register bottleneck:', err);
      return error(err instanceof Error ? err.message : 'Failed to register bottleneck');
    }
  });

  // Get all active bottlenecks
  registerHandler('agent:getBottlenecks', async (_event, _request) => {
    try {
      const service = getAgentTriggerService();
      const bottlenecks = service.getActiveBottlenecks();

      return success({
        bottlenecks: bottlenecks.map((b, index) => ({
          index,
          type: b.type,
          location: b.location,
          blockedBy: b.blockedBy,
          proposedFix: b.proposedFix,
          severity: b.severity,
          detectedAt: b.detectedAt.toISOString(),
        })),
        count: bottlenecks.length,
      });
    } catch (err) {
      console.error('Failed to get bottlenecks:', err);
      return error(err instanceof Error ? err.message : 'Failed to get bottlenecks');
    }
  });

  // Resolve (remove) a bottleneck
  registerHandler('agent:resolveBottleneck', async (_event, request) => {
    const { index } = request as { index: number };

    if (typeof index !== 'number' || index < 0) {
      return error('index must be a non-negative number');
    }

    try {
      const service = getAgentTriggerService();
      service.resolveBottleneck(index);

      return success({
        resolved: true,
        remainingCount: service.getActiveBottlenecks().length,
      });
    } catch (err) {
      console.error('Failed to resolve bottleneck:', err);
      return error(err instanceof Error ? err.message : 'Failed to resolve bottleneck');
    }
  });

  // Get trigger history
  registerHandler('agent:getTriggerHistory', async (_event, _request) => {
    try {
      const service = getAgentTriggerService();
      const history = service.getTriggerHistory();

      return success({
        history: history.map(t => ({
          agent: t.agent,
          reason: t.reason,
          priority: t.priority,
          context: t.context,
        })),
        count: history.length,
      });
    } catch (err) {
      console.error('Failed to get trigger history:', err);
      return error(err instanceof Error ? err.message : 'Failed to get trigger history');
    }
  });

  // Generate agent specification (for meta-agent-builder)
  registerHandler('agent:generateSpec', async (_event, request) => {
    const { bottleneckIndex } = request as { bottleneckIndex: number };

    if (typeof bottleneckIndex !== 'number' || bottleneckIndex < 0) {
      return error('bottleneckIndex must be a non-negative number');
    }

    try {
      const service = getAgentTriggerService();
      const bottlenecks = service.getActiveBottlenecks();

      if (bottleneckIndex >= bottlenecks.length) {
        return error('Bottleneck index out of range');
      }

      const spec = service.generateAgentSpec(bottlenecks[bottleneckIndex]);

      return success({
        spec,
        bottleneck: {
          type: bottlenecks[bottleneckIndex].type,
          location: bottlenecks[bottleneckIndex].location,
        },
      });
    } catch (err) {
      console.error('Failed to generate agent spec:', err);
      return error(err instanceof Error ? err.message : 'Failed to generate agent spec');
    }
  });

  // Clear trigger history
  registerHandler('agent:clearHistory', async (_event, _request) => {
    try {
      const service = getAgentTriggerService();
      service.clearHistory();

      return success({ cleared: true });
    } catch (err) {
      console.error('Failed to clear history:', err);
      return error(err instanceof Error ? err.message : 'Failed to clear history');
    }
  });
}

/**
 * Unregister agent handlers.
 */
export function unregisterAgentHandlers(): void {
  const { unregisterHandler } = require('./contracts');
  unregisterHandler('agent:detectTriggers');
  unregisterHandler('agent:registerBottleneck');
  unregisterHandler('agent:getBottlenecks');
  unregisterHandler('agent:resolveBottleneck');
  unregisterHandler('agent:getTriggerHistory');
  unregisterHandler('agent:generateSpec');
  unregisterHandler('agent:clearHistory');
}
