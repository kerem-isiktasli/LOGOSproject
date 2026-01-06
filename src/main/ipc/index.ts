/**
 * IPC Handler Index
 *
 * Central registration point for all IPC handlers.
 * Called from main process during app initialization.
 */

import { registerGoalHandlers, unregisterGoalHandlers } from './goal.ipc';
import { registerLearningHandlers, unregisterLearningHandlers } from './learning.ipc';
import { registerSessionHandlers, unregisterSessionHandlers } from './session.ipc';
import { registerClaudeHandlers, unregisterClaudeHandlers } from './claude.ipc';
import { registerAgentHandlers, unregisterAgentHandlers } from './agent.ipc';
import { registerSyncHandlers, unregisterSyncHandlers } from './sync.ipc';
import { registerOnboardingHandlers, unregisterOnboardingHandlers } from './onboarding.ipc';

/**
 * Register all IPC handlers.
 * Call this during main process initialization.
 */
export function registerAllHandlers(): void {
  console.log('[IPC] Registering all handlers...');

  registerGoalHandlers();
  console.log('[IPC] Goal handlers registered');

  registerLearningHandlers();
  console.log('[IPC] Learning handlers registered');

  registerSessionHandlers();
  console.log('[IPC] Session handlers registered');

  registerClaudeHandlers();
  console.log('[IPC] Claude handlers registered');

  registerAgentHandlers();
  console.log('[IPC] Agent handlers registered');

  registerSyncHandlers();
  console.log('[IPC] Sync handlers registered');

  registerOnboardingHandlers();
  console.log('[IPC] Onboarding handlers registered');

  console.log('[IPC] All handlers registered successfully');
}

/**
 * Unregister all IPC handlers.
 * Call this during app shutdown or for testing cleanup.
 */
export function unregisterAllHandlers(): void {
  console.log('[IPC] Unregistering all handlers...');

  unregisterGoalHandlers();
  unregisterLearningHandlers();
  unregisterSessionHandlers();
  unregisterClaudeHandlers();
  unregisterAgentHandlers();
  unregisterSyncHandlers();
  unregisterOnboardingHandlers();

  console.log('[IPC] All handlers unregistered');
}

// Re-export for direct access
export { registerGoalHandlers, unregisterGoalHandlers } from './goal.ipc';
export { registerLearningHandlers, unregisterLearningHandlers } from './learning.ipc';
export { registerSessionHandlers, unregisterSessionHandlers } from './session.ipc';
export { registerClaudeHandlers, unregisterClaudeHandlers } from './claude.ipc';
export { registerAgentHandlers, unregisterAgentHandlers } from './agent.ipc';
export { registerSyncHandlers, unregisterSyncHandlers } from './sync.ipc';
export { registerOnboardingHandlers, unregisterOnboardingHandlers } from './onboarding.ipc';
export * from './contracts';
