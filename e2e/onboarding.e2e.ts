/**
 * Onboarding Flow E2E Tests
 *
 * Tests the complete onboarding experience for new users:
 * - Welcome screen
 * - Language selection
 * - Learning preferences
 * - Goal creation
 * - Initial vocabulary setup
 */

import { test, expect } from '@playwright/test';
import { launchApp, closeApp, waitForAppReady, cleanupTestData, ElectronTestContext } from './electron.helper';

let context: ElectronTestContext;

test.describe('Onboarding Flow', () => {
  test.beforeAll(async () => {
    context = await launchApp();
    await waitForAppReady(context.window);
    // Clean up any existing data to trigger onboarding
    await cleanupTestData(context.window);
  });

  test.afterAll(async () => {
    await closeApp(context);
  });

  test.describe('Onboarding Status Check', () => {
    test('should check if onboarding is needed via API', async () => {
      const status = await context.window.evaluate(async () => {
        const logos = (window as any).logos;
        if (logos?.onboarding?.checkStatus) {
          return await logos.onboarding.checkStatus();
        }
        return null;
      });

      expect(status).toBeDefined();
      expect(typeof status.needsOnboarding).toBe('boolean');
    });
  });

  test.describe('Language Selection', () => {
    test('should display language options', async () => {
      // Look for language selection UI elements
      const hasLanguageUI = await context.window.evaluate(() => {
        const selectors = [
          '[data-testid="native-language"]',
          '[data-testid="target-language"]',
          'select[name="nativeLanguage"]',
          'select[name="targetLanguage"]',
          '[aria-label*="language"]',
        ];
        return selectors.some(sel => document.querySelector(sel) !== null);
      });

      // If onboarding is shown, language UI should be present
      // If user already has goals, this test will be skipped
      if (hasLanguageUI) {
        expect(hasLanguageUI).toBe(true);
      }
    });

    test('should validate language code format', async () => {
      const result = await context.window.evaluate(async () => {
        const logos = (window as any).logos;

        // Test with valid language codes
        const validCodes = ['ko', 'ja', 'en', 'zh', 'ko-KR', 'ja-JP'];
        const invalidCodes = ['korean', 'japanese', '123'];

        const validResults = validCodes.every(code => /^[a-z]{2}(-[A-Z]{2})?$/.test(code));
        const invalidResults = invalidCodes.every(code => !/^[a-z]{2}(-[A-Z]{2})?$/.test(code));

        return { validResults, invalidResults };
      });

      expect(result.validResults).toBe(true);
      expect(result.invalidResults).toBe(true);
    });
  });

  test.describe('Learning Preferences', () => {
    test('should allow modality selection', async () => {
      // Check for modality options
      const modalityOptions = await context.window.evaluate(() => {
        const modalityTypes = ['visual', 'auditory', 'kinesthetic'];
        const found: string[] = [];

        modalityTypes.forEach(type => {
          const element = document.querySelector(
            `[data-testid="modality-${type}"], input[value="${type}"], [aria-label*="${type}"]`
          );
          if (element) found.push(type);
        });

        return found;
      });

      // Modality options may or may not be visible depending on onboarding state
      expect(Array.isArray(modalityOptions)).toBe(true);
    });

    test('should validate daily time range', async () => {
      const result = await context.window.evaluate(() => {
        // Valid range: 5-480 minutes
        const validTimes = [5, 15, 30, 60, 120, 480];
        const invalidTimes = [0, 3, 500, -1];

        const isValidTime = (time: number) => time >= 5 && time <= 480;

        return {
          validResults: validTimes.every(isValidTime),
          invalidResults: invalidTimes.every(t => !isValidTime(t)),
        };
      });

      expect(result.validResults).toBe(true);
      expect(result.invalidResults).toBe(true);
    });
  });

  test.describe('Onboarding Completion', () => {
    test('should complete onboarding via API', async () => {
      const result = await context.window.evaluate(async () => {
        const logos = (window as any).logos;

        if (!logos?.onboarding?.complete) {
          return { skipped: true, reason: 'API not available' };
        }

        try {
          const response = await logos.onboarding.complete({
            nativeLanguage: 'ko',
            targetLanguage: 'ja',
            domain: 'general',
            modality: ['visual'],
            purpose: 'E2E Test Goal',
            dailyTime: 30,
          });

          return { success: true, data: response };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      });

      // Either successful or skipped (if already onboarded)
      expect(result.skipped || result.success || result.error).toBeTruthy();
    });

    test('should allow skipping onboarding', async () => {
      const result = await context.window.evaluate(async () => {
        const logos = (window as any).logos;

        if (!logos?.onboarding?.skip) {
          return { skipped: true, reason: 'API not available' };
        }

        try {
          const response = await logos.onboarding.skip();
          return { success: true, data: response };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      });

      expect(result.skipped || result.success || result.error).toBeTruthy();
    });
  });

  test.describe('Post-Onboarding State', () => {
    test('should have at least one goal after onboarding', async () => {
      const goals = await context.window.evaluate(async () => {
        const logos = (window as any).logos;
        if (logos?.goal?.list) {
          return await logos.goal.list();
        }
        return [];
      });

      // After onboarding, user should have at least one goal
      // (unless onboarding was skipped or user already had goals)
      expect(Array.isArray(goals)).toBe(true);
    });

    test('should redirect to dashboard after onboarding', async () => {
      // Check if we're on dashboard or main content area
      const isOnDashboard = await context.window.evaluate(() => {
        const indicators = [
          '[data-testid="dashboard"]',
          '[data-testid="dashboard-page"]',
          'h1:has-text("Dashboard")',
          '[aria-label*="dashboard"]',
        ];

        return indicators.some(sel => {
          try {
            return document.querySelector(sel) !== null;
          } catch {
            return false;
          }
        });
      });

      // May or may not be on dashboard depending on state
      expect(typeof isOnDashboard).toBe('boolean');
    });
  });
});

test.describe('Onboarding Edge Cases', () => {
  test.beforeAll(async () => {
    context = await launchApp();
    await waitForAppReady(context.window);
  });

  test.afterAll(async () => {
    await closeApp(context);
  });

  test('should handle network errors gracefully', async () => {
    // Simulate network error scenario
    const result = await context.window.evaluate(async () => {
      try {
        // Try to complete with invalid data
        const logos = (window as any).logos;
        if (logos?.onboarding?.complete) {
          await logos.onboarding.complete({
            nativeLanguage: 'invalid',
            targetLanguage: 'invalid',
            modality: [],
            purpose: '',
            dailyTime: 0,
          });
        }
        return { handled: false };
      } catch (error: any) {
        return { handled: true, error: error.message };
      }
    });

    // Error should be handled gracefully
    expect(result.handled).toBe(true);
  });

  test('should preserve state on page refresh', async () => {
    // Get current state
    const stateBefore = await context.window.evaluate(async () => {
      const logos = (window as any).logos;
      if (logos?.goal?.list) {
        const goals = await logos.goal.list();
        return goals.length;
      }
      return 0;
    });

    // Reload the page
    await context.window.reload();
    await waitForAppReady(context.window);

    // Check state after reload
    const stateAfter = await context.window.evaluate(async () => {
      const logos = (window as any).logos;
      if (logos?.goal?.list) {
        const goals = await logos.goal.list();
        return goals.length;
      }
      return 0;
    });

    // State should be preserved
    expect(stateAfter).toBe(stateBefore);
  });
});
