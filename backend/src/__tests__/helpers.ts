import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

// Simple ID counter for mocks
let mockIdCounter = 1;
const getNextId = () => mockIdCounter++;

// Mock user data factory
export const createMockUser = (overrides: Record<string, unknown> = {}) => ({
  id: getNextId(),
  email: `user${mockIdCounter}@test.com`,
  name: `Test User ${mockIdCounter}`,
  phone: `555-000${mockIdCounter}`,
  role: 'CUSTOMER' as const,
  password: '$2b$10$test-hashed-password', // Pre-hashed for tests
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockPool = (userId: number, overrides: Record<string, unknown> = {}) => ({
  id: getNextId(),
  userId,
  name: `Test Pool ${mockIdCounter}`,
  address: `${mockIdCounter} Test Street, Dallas, TX`,
  size: 'MEDIUM',
  type: 'INGROUND',
  notes: 'Test pool notes',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockSchedule = (poolId: number, technicianId: number, overrides: Record<string, unknown> = {}) => ({
  id: getNextId(),
  poolId,
  technicianId,
  customerId: 1,
  scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
  status: 'SCHEDULED' as const,
  notes: 'Test schedule notes',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockInvoice = (userId: number, scheduleId: number, overrides: Record<string, unknown> = {}) => ({
  id: getNextId(),
  userId,
  scheduleId,
  amount: 150,
  status: 'PENDING' as const,
  dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks from now
  paidAt: null,
  stripePaymentIntentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Generate a valid JWT token for testing
export const generateTestToken = (user: { id: number; role: string }) => {
  return jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET || 'test-jwt-secret-for-testing',
    { expiresIn: '1h' }
  );
};

// Hash a password for test data
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
};

// Create test users with different roles
export const testUsers = {
  admin: createMockUser({ id: 1, email: 'admin@test.com', role: 'ADMIN' }),
  technician: createMockUser({ id: 2, email: 'tech@test.com', role: 'TECHNICIAN' }),
  customer: createMockUser({ id: 3, email: 'customer@test.com', role: 'CUSTOMER' }),
};

// Generate tokens for test users
export const testTokens = {
  admin: generateTestToken(testUsers.admin),
  technician: generateTestToken(testUsers.technician),
  customer: generateTestToken(testUsers.customer),
};
