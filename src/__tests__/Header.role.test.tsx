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

describe('Header role label', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: null });
  });

  it('labels a member session as Member, never as Admin', () => {
    useAuthStore.setState({ user: buildUser({ role: 'member', clientId: 'client-1' }) });

    renderHeader();

    expect(screen.getByText('Member')).toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('labels a viewer session as Viewer', () => {
    useAuthStore.setState({ user: buildUser({ role: 'viewer', clientId: 'client-1' }) });

    renderHeader();

    expect(screen.getByText('Viewer')).toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('labels a client admin as Client Admin', () => {
    useAuthStore.setState({ user: buildUser({ role: 'client_admin', clientId: 'client-1' }) });

    renderHeader();

    expect(screen.getByText('Client Admin')).toBeInTheDocument();
  });

  it('labels a super admin as Super Admin', () => {
    useAuthStore.setState({ user: buildUser({ role: 'super_admin' }) });

    renderHeader();

    expect(screen.getByText('Super Admin')).toBeInTheDocument();
  });

  it('falls back to User when no session is loaded', () => {
    renderHeader();

    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });
});
