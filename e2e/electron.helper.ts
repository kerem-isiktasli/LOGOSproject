/**
 * Electron Test Helper for Playwright
 *
 * Provides utilities for launching and controlling the Electron app
 * during E2E testing.
 */

import { _electron as electron, ElectronApplication, Page } from 'playwright';
import * as path from 'path';

export interface ElectronTestContext {
  app: ElectronApplication;
  window: Page;
}

/**
 * Launch the LOGOS Electron application for testing
 */
export async function launchApp(): Promise<ElectronTestContext> {
  // Path to the main entry point
  const mainPath = path.join(__dirname, '..', 'out', 'main', 'index.js');

  // Launch Electron with the app
  const app = await electron.launch({
    args: [mainPath],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      // Use a test database
      DATABASE_URL: 'file:./test.db',
    },
  });

  // Wait for the first window
  const window = await app.firstWindow();

  // Wait for the app to be ready
  await window.waitForLoadState('domcontentloaded');

  return { app, window };
}

/**
 * Close the Electron application
 */
export async function closeApp(context: ElectronTestContext): Promise<void> {
  await context.app.close();
}

/**
 * Wait for the app to be fully loaded
 */
export async function waitForAppReady(window: Page): Promise<void> {
  // Wait for React to mount
  await window.waitForSelector('[data-testid="app-root"], #root', {
    state: 'visible',
    timeout: 30000,
  });
}

/**
 * Navigate to a specific route in the app
 */
export async function navigateTo(window: Page, route: string): Promise<void> {
  await window.evaluate((path) => {
    // Use React Router to navigate
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, route);
}

/**
 * Get the current route
 */
export async function getCurrentRoute(window: Page): Promise<string> {
  return await window.evaluate(() => window.location.pathname);
}

/**
 * Check if the logos API is available
 */
export async function isLogosAPIAvailable(window: Page): Promise<boolean> {
  return await window.evaluate(() => {
    return typeof (window as any).logos !== 'undefined';
  });
}

/**
 * Create a test goal through the UI
 */
export async function createTestGoal(
  window: Page,
  name: string,
  targetLanguage: string = 'English',
  nativeLanguage: string = 'Korean'
): Promise<void> {
  // Click create goal button
  await window.click('[data-testid="create-goal-button"]');

  // Fill in the form
  await window.fill('[data-testid="goal-name-input"]', name);
  await window.selectOption('[data-testid="target-language-select"]', targetLanguage);
  await window.selectOption('[data-testid="native-language-select"]', nativeLanguage);

  // Submit
  await window.click('[data-testid="submit-goal-button"]');

  // Wait for goal to be created
  await window.waitForSelector(`text=${name}`, { timeout: 10000 });
}

/**
 * Delete all test data
 */
export async function cleanupTestData(window: Page): Promise<void> {
  await window.evaluate(async () => {
    const logos = (window as any).logos;
    if (logos?.goal?.list) {
      const goals = await logos.goal.list();
      for (const goal of goals) {
        await logos.goal.delete(goal.id, true);
      }
    }
  });
}
