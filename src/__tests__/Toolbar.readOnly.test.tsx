import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Toolbar from '../components/testManager/Toolbar';
import { useTestManagerStore } from '../store/testManagerStore';
import { useAuthStore } from '../store/authStore';
import { Project, ViewMode } from '../types/testManager';
import { User } from '../types/user.types';

vi.mock('zustand/middleware', async () => {
  const actual = await vi.importActual<typeof import('zustand/middleware')>('zustand/middleware');

  return {
    ...actual,
    persist: ((stateCreator: unknown) => stateCreator) as typeof actual.persist,
  };
});

const buildProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'proj-1',
  name: 'Checkout',
  description: '',
  color: '#3B82F6',
  ownerId: 'owner-1',
  members: [],
  stats: { suites: 0, cases: 0, members: 1 },
  clientId: 'client-1',
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const buildUser = (overrides: Partial<User> = {}): User => ({
  _id: 'user-1',
  email: 'user@example.com',
  name: 'User One',
  isVerified: true,
  lastLogin: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const renderToolbar = (viewMode: ViewMode = 'cases') =>
  render(
    <Toolbar
      viewMode={viewMode}
      setViewMode={vi.fn()}
      onNew={vi.fn()}
      onNewCase={vi.fn()}
      activeProject="proj-1"
    />
  );

describe('Toolbar read-only badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: null });
    useTestManagerStore.setState({ projects: [], error: null });
  });

  it('shows the badge and disables the New button for a project viewer', () => {
    useAuthStore.setState({
      user: buildUser({ role: 'member', clientId: 'client-1' }),
    });
    useTestManagerStore.setState({
      projects: [buildProject({
        members: [{ id: 'user-1', name: 'User One', email: 'user@example.com', role: 'viewer' }],
      })],
    });

    renderToolbar();

    expect(screen.getByText('Read-only')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Case/ })).toBeDisabled();
  });

  it('hides the badge and keeps the New button for an editor', () => {
    useAuthStore.setState({
      user: buildUser({ role: 'member', clientId: 'client-1' }),
    });
    useTestManagerStore.setState({
      projects: [buildProject({
        members: [{ id: 'user-1', name: 'User One', email: 'user@example.com', role: 'editor' }],
      })],
    });

    renderToolbar();

    expect(screen.queryByText('Read-only')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Case/ })).toBeEnabled();
  });

  it('keeps the New button available on the projects view', () => {
    useAuthStore.setState({
      user: buildUser({ role: 'member', clientId: 'client-1' }),
    });
    useTestManagerStore.setState({
      projects: [buildProject({
        members: [{ id: 'user-1', name: 'User One', email: 'user@example.com', role: 'viewer' }],
      })],
    });

    renderToolbar('projects');

    expect(screen.queryByText('Read-only')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Project/ })).toBeEnabled();
  });
});
