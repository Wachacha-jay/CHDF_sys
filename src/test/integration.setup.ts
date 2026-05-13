import '@testing-library/jest-dom';
import { beforeAll, afterEach, afterAll } from 'vitest';

// Integration test setup for real database connections
// This file is used for tests that need to interact with actual Supabase

// Set up test environment variables
process.env.VITE_SUPABASE_URL = process.env.TEST_SUPABASE_URL || 'https://test-project.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY || 'test-anon-key';

// Mock IntersectionObserver for integration tests
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver for integration tests
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock window.matchMedia for integration tests
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

// Mock react-hot-toast for integration tests
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

// Clean up function for integration tests
export const cleanupTestData = async () => {
  // This function can be used to clean up test data after integration tests
  // Implementation depends on your test database setup
  console.log('Cleaning up test data...');
};

// Setup function for integration tests
export const setupTestData = async () => {
  // This function can be used to set up test data before integration tests
  // Implementation depends on your test database setup
  console.log('Setting up test data...');
};

beforeAll(async () => {
  await setupTestData();
});

afterEach(async () => {
  // Clean up after each test
  await cleanupTestData();
});

afterAll(async () => {
  // Final cleanup
  await cleanupTestData();
}); 