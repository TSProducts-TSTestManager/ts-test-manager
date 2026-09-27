import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Header from '../components/Header';
import { useAuthStore } from '../store/authStore';
import { User } from '../types/user.types';

vi.mock('zustand/middleware', async () => {
  const actual = await vi.importActual<typeof import('zustand/middleware')>('zustand/middleware');

  return {
    ...actual,
    persist: ((stateCreator: unknown) => stateCreator) as typeof actual.persist,
  };
});

const buildUser = (overrides: Partial<User> = {}): User => ({
  _id: 'user-1',
  email: 'user@example.com',
  name: 'Pankaj Kumar',
  isVerified: true,
  lastLogin: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const renderHeader = () => render(<Header toggleSidebar={vi.fn()} />);

// With no session the name and the role label both fall back to "User", so a
// page-wide text query is ambiguous. Assert on the role label itself.
const roleLabel = () => screen.getByTestId('header-role-label');

describe('Header role label', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: null });
  });

  it('labels a member session as Member, never as Admin', () => {
    useAuthStore.setState({ user: buildUser({ role: 'member', clientId: 'client-1' }) });

    renderHeader();

    expect(roleLabel()).toHaveTextContent('Member');
    expect(roleLabel()).not.toHaveTextContent('Admin');
  });

  it('labels a viewer session as Viewer', () => {
    useAuthStore.setState({ user: buildUser({ role: 'viewer', clientId: 'client-1' }) });

    renderHeader();

    expect(roleLabel()).toHaveTextContent('Viewer');
    expect(roleLabel()).not.toHaveTextContent('Admin');
  });

  it('labels a client admin as Client Admin', () => {
    useAuthStore.setState({ user: buildUser({ role: 'client_admin', clientId: 'client-1' }) });

    renderHeader();

    expect(roleLabel()).toHaveTextContent('Client Admin');
  });

  it('labels a super admin as Super Admin', () => {
    useAuthStore.setState({ user: buildUser({ role: 'super_admin' }) });

    renderHeader();

    expect(roleLabel()).toHaveTextContent('Super Admin');
  });

  it('falls back to User when no session is loaded', () => {
    renderHeader();

    expect(roleLabel()).toHaveTextContent('User');
    expect(roleLabel()).not.toHaveTextContent('Admin');
  });
});
