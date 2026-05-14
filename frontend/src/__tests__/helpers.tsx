import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  route?: string;
}

// Custom render with providers
export function renderWithProviders(
  ui: ReactElement,
  { route = '/', ...options }: CustomRenderOptions = {}
) {
  window.history.pushState({}, 'Test page', route);

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <BrowserRouter>
        <AuthProvider>{children}</AuthProvider>
      </BrowserRouter>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...options }),
  };
}

// Mock user data
export const mockUsers = {
  admin: {
    id: 1,
    email: 'admin@test.com',
    name: 'Admin User',
    role: 'ADMIN' as const,
    phone: '555-0001',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  technician: {
    id: 2,
    email: 'tech@test.com',
    name: 'Tech User',
    role: 'TECHNICIAN' as const,
    phone: '555-0002',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  customer: {
    id: 3,
    email: 'customer@test.com',
    name: 'Customer User',
    role: 'CUSTOMER' as const,
    phone: '555-0003',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
};

// Mock API responses
export const mockApiResponses = {
  loginSuccess: {
    token: 'mock-jwt-token',
    user: mockUsers.customer,
  },
  registerSuccess: {
    ...mockUsers.customer,
    id: 4,
    email: 'newuser@test.com',
    name: 'New User',
  },
  pools: [
    {
      id: 1,
      name: 'Main Pool',
      address: '123 Main St',
      type: 'RESIDENTIAL',
      size: '20x40',
      depth: '4-8 ft',
      customerId: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  schedules: [
    {
      id: 1,
      poolId: 1,
      technicianId: 2,
      scheduledDate: new Date().toISOString(),
      status: 'SCHEDULED',
      notes: 'Regular cleaning',
      pool: { name: 'Main Pool', address: '123 Main St' },
      technician: { name: 'Tech User' },
    },
  ],
  invoices: [
    {
      id: 1,
      customerId: 3,
      amount: 150.0,
      status: 'PENDING',
      dueDate: new Date().toISOString(),
      scheduleId: 1,
    },
  ],
};
