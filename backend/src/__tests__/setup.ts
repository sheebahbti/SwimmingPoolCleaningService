import 'dotenv/config';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing';

// Increase test timeout for integration tests
// Jest global is available in test environment
(global as unknown as { jest: { setTimeout: (ms: number) => void } }).jest?.setTimeout?.(30000);

// Global test utilities
export const testConfig = {
  jwtSecret: process.env.JWT_SECRET,
  testUserPassword: 'password123',
};
