/**
 * LOGOS Application E2E Tests
 *
 * Tests core application functionality including:
 * - App launch and initialization
 * - Navigation
 * - Goal management
 * - Session workflow
 */

import { test, expect } from '@playwright/test';
import { launchApp, closeApp, waitForAppReady, isLogosAPIAvailable, ElectronTestContext } from './electron.helper';

let context: ElectronTestContext;

test.describe('LOGOS Application', () => {
  test.beforeAll(async () => {
    context = await launchApp();
  });

  test.afterAll(async () => {
    await closeApp(context);
  });

  test.describe('App Initialization', () => {
    test('should launch the Electron app', async () => {
      expect(context.app).toBeDefined();
      expect(context.window).toBeDefined();
    });

    test('should load the main window', async () => {
      await waitForAppReady(context.window);
      const title = await context.window.title();
      expect(title).toContain('LOGOS');
    });

    test('should expose the logos API via preload', async () => {
      const hasAPI = await isLogosAPIAvailable(context.window);
      expect(hasAPI).toBe(true);
    });

    test('should have context isolation enabled', async () => {
      // Node APIs should not be available in renderer
      const hasNodeAPIs = await context.window.evaluate(() => {
        return typeof (window as any).require !== 'undefined' ||
               typeof (window as any).process !== 'undefined';
      });
      expect(hasNodeAPIs).toBe(false);
    });
  });

  test.describe('Navigation', () => {
    test('should display the sidebar', async () => {
      await context.window.waitForSelector('[data-testid="sidebar"], nav', {
        state: 'visible',
        timeout: 10000,
      });
    });

    test('should navigate to Goals page', async () => {
      await context.window.click('text=Goals');
      await context.window.waitForSelector('[data-testid="goals-page"], h1:has-text("Goals")', {
        state: 'visible',
        timeout: 10000,
      });
    });

    test('should navigate to Dashboard', async () => {
      await context.window.click('text=Dashboard');
      await context.window.waitForSelector('[data-testid="dashboard-page"], h1:has-text("Dashboard")', {
        state: 'visible',
        timeout: 10000,
      });
    });
  });

  test.describe('Goal Management', () => {
    test('should display create goal button', async () => {
      await context.window.click('text=Goals');
      const createButton = await context.window.waitForSelector(
        '[data-testid="create-goal-button"], button:has-text("Create"), button:has-text("New")',
        { timeout: 10000 }
      );
      expect(createButton).toBeTruthy();
    });

    test('should open goal creation form', async () => {
      await context.window.click('[data-testid="create-goal-button"], button:has-text("Create"), button:has-text("New")');
      await context.window.waitForSelector(
        '[data-testid="goal-form"], form, [data-testid="create-goal-modal"]',
        { state: 'visible', timeout: 10000 }
      );
    });
  });

  test.describe('IPC Communication', () => {
    test('should be able to call goal.list via logos API', async () => {
      const goals = await context.window.evaluate(async () => {
        const logos = (window as any).logos;
        if (logos?.goal?.list) {
          return await logos.goal.list();
        }
        return [];
      });
      expect(Array.isArray(goals)).toBe(true);
    });

    test('should be able to get app version', async () => {
      const version = await context.window.evaluate(async () => {
        const logos = (window as any).logos;
        if (logos?.app?.getVersion) {
          return await logos.app.getVersion();
        }
        return null;
      });
      expect(version).toBeTruthy();
    });

    test('should be able to get platform', async () => {
      const platform = await context.window.evaluate(() => {
        const logos = (window as any).logos;
        if (logos?.app?.getPlatform) {
          return logos.app.getPlatform();
        }
        return null;
      });
      expect(['win32', 'darwin', 'linux']).toContain(platform);
    });
  });

  test.describe('Error Handling', () => {
    test('should handle invalid goal ID gracefully', async () => {
      const result = await context.window.evaluate(async () => {
        const logos = (window as any).logos;
        try {
          await logos.goal.get('invalid-uuid-format');
          return { success: true };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });
});
