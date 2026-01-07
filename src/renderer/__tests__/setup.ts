/**
 * UI Test Setup
 *
 * Configuration for React Testing Library with Vitest.
 */

import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock window.logos API
(window as any).logos = {
  goal: {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 'test-goal' }),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  object: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    import: vi.fn().mockResolvedValue({}),
  },
  queue: {
    build: vi.fn().mockResolvedValue([]),
    getNext: vi.fn().mockResolvedValue(null),
  },
  session: {
    start: vi.fn().mockResolvedValue({ id: 'test-session' }),
    end: vi.fn().mockResolvedValue({}),
    recordResponse: vi.fn().mockResolvedValue({}),
    getHistory: vi.fn().mockResolvedValue([]),
  },
  analytics: {
    getProgress: vi.fn().mockResolvedValue(null),
    getBottlenecks: vi.fn().mockResolvedValue(null),
    getSessionStats: vi.fn().mockResolvedValue(null),
  },
  mastery: {
    get: vi.fn().mockResolvedValue(null),
    getStats: vi.fn().mockResolvedValue(null),
  },
  claude: {
    generateContent: vi.fn().mockResolvedValue({}),
    analyzeError: vi.fn().mockResolvedValue({}),
    getHint: vi.fn().mockResolvedValue({}),
  },
  onboarding: {
    checkStatus: vi.fn().mockResolvedValue({ needsOnboarding: false, hasUser: true, hasGoals: true }),
    complete: vi.fn().mockResolvedValue({ userId: 'user1', goalId: 'goal1' }),
    skip: vi.fn().mockResolvedValue({}),
  },
};

// Suppress console errors in tests
vi.spyOn(console, 'error').mockImplementation(() => {});
