import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE_FORBIDDEN_ERROR, READ_ONLY_ERROR, useTestManagerStore } from '../store/testManagerStore';
import { useAuthStore } from '../store/authStore';
import * as testManagerApi from '../services/testManagerApi';
import * as ticketApi from '../services/ticketApi';
import { Project } from '../types/testManager';
import { User } from '../types/user.types';

vi.mock('zustand/middleware', async () => {
  const actual = await vi.importActual<typeof import('zustand/middleware')>('zustand/middleware');

  return {
    ...actual,
    persist: ((stateCreator: unknown) => stateCreator) as typeof actual.persist,
  };
});

vi.mock('../services/testManagerApi', () => ({
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  restoreProject: vi.fn(),
  purgeProject: vi.fn(),
  getProject: vi.fn(),
  createTestSuite: vi.fn(),
  updateTestSuite: vi.fn(),
  deleteTestSuite: vi.fn(),
  createTestCase: vi.fn(),
  updateTestCase: vi.fn(),
  cloneTestCase: vi.fn(),
  deleteTestCase: vi.fn(),
  bulkUpdateStatus: vi.fn(),
  bulkDeleteTestCases: vi.fn(),
  updateProjectSettings: vi.fn(),
  assignProjectMembers: vi.fn(),
  updateProjectMemberRole: vi.fn(),
  removeProjectMember: vi.fn(),
}));

vi.mock('../services/ticketApi', () => ({
  createTicket: vi.fn(),
  updateTicket: vi.fn(),
  deleteTicket: vi.fn(),
}));

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

const projectResponse = () => ({
  id: 'proj-1',
  name: 'Checkout',
  description: '',
  color: '#3B82F6',
  ownerId: 'owner-1',
  members: [],
  stats: { suites: 0, cases: 0, members: 1 },
  clientId: 'client-1',
  updatedAt: new Date().toISOString(),
});

describe('testManagerStore write guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTestManagerStore.setState({
      projects: [],
      testSuites: [],
      testCases: [],
      isLoading: false,
      error: null,
    });
    useAuthStore.setState({ user: null });
    vi.mocked(testManagerApi.updateProject).mockResolvedValue(projectResponse() as never);
    vi.mocked(testManagerApi.deleteProject).mockResolvedValue(undefined as never);
    vi.mocked(testManagerApi.createTestSuite).mockResolvedValue({
      id: 'suite-1',
      name: 'Auth',
      projectId: 'proj-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as never);
    vi.mocked(testManagerApi.updateProjectSettings).mockResolvedValue({
      testCases: { customFields: [], table: { visibleCustomFieldIds: [] } },
    } as never);
  });

  it('blocks a viewer from updating the project', async () => {
    useAuthStore.setState({
      user: buildUser({ role: 'member', clientId: 'client-1' }),
    });
    useTestManagerStore.setState({
      projects: [buildProject({
        members: [{ id: 'user-1', name: 'User One', email: 'user@example.com', role: 'viewer' }],
      })],
    });

    await expect(
      useTestManagerStore.getState().updateProject('proj-1', { name: 'Renamed' })
    ).rejects.toThrow(READ_ONLY_ERROR);

    expect(testManagerApi.updateProject).not.toHaveBeenCalled();
    expect(useTestManagerStore.getState().error).toBe(READ_ONLY_ERROR);
  });

  it('blocks a viewer from creating content', async () => {
    useAuthStore.setState({
      user: buildUser({ role: 'member', clientId: 'client-1' }),
    });
    useTestManagerStore.setState({
      projects: [buildProject({
        members: [{ id: 'user-1', name: 'User One', email: 'user@example.com', role: 'viewer' }],
      })],
    });

    await expect(
      useTestManagerStore.getState().createTestSuite('proj-1', { name: 'Auth' })
    ).rejects.toThrow(READ_ONLY_ERROR);
    await expect(
      useTestManagerStore.getState().updateProjectSettings('proj-1', {} as never)
    ).rejects.toThrow(READ_ONLY_ERROR);

    expect(testManagerApi.createTestSuite).not.toHaveBeenCalled();
    expect(testManagerApi.updateProjectSettings).not.toHaveBeenCalled();
  });

  it('allows an editor member to update the project', async () => {
    useAuthStore.setState({
      user: buildUser({ role: 'member', clientId: 'client-1' }),
    });
    useTestManagerStore.setState({
      projects: [buildProject({
        members: [{ id: 'user-1', name: 'User One', email: 'user@example.com', role: 'editor' }],
      })],
    });

    await useTestManagerStore.getState().updateProject('proj-1', { name: 'Renamed' });

    expect(testManagerApi.updateProject).toHaveBeenCalledTimes(1);
    expect(useTestManagerStore.getState().error).toBeNull();
  });

  it('no longer lets the project owner delete the project', async () => {
    useAuthStore.setState({
      user: buildUser({ role: 'member', clientId: 'client-1' }),
    });
    useTestManagerStore.setState({ projects: [buildProject({ ownerId: 'user-1' })] });

    // Deleting a project is a client-admin action, so the project owner — who
    // is a `lead` and can edit everything else in it — is refused.
    await expect(
      useTestManagerStore.getState().deleteProject('proj-1')
    ).rejects.toThrow(DELETE_FORBIDDEN_ERROR);

    expect(testManagerApi.deleteProject).not.toHaveBeenCalled();
  });

  it('blocks a client_admin of another client from deleting the project', async () => {
    useAuthStore.setState({
      user: buildUser({ role: 'client_admin', clientId: 'client-2' }),
    });
    useTestManagerStore.setState({ projects: [buildProject()] });

    await expect(
      useTestManagerStore.getState().deleteProject('proj-1')
    ).rejects.toThrow(DELETE_FORBIDDEN_ERROR);

    expect(testManagerApi.deleteProject).not.toHaveBeenCalled();
  });

  it('allows a same-client client_admin to delete the project', async () => {
    useAuthStore.setState({
      user: buildUser({ role: 'client_admin', clientId: 'client-1' }),
    });
    useTestManagerStore.setState({ projects: [buildProject()] });

    await useTestManagerStore.getState().deleteProject('proj-1');

    expect(testManagerApi.deleteProject).toHaveBeenCalledWith('proj-1');
  });

  it('lets a same-client client_admin restore a deleted project back into the list', async () => {
    useAuthStore.setState({
      user: buildUser({ role: 'client_admin', clientId: 'client-1' }),
    });
    useTestManagerStore.setState({ projects: [buildProject()] });
    vi.mocked(testManagerApi.restoreProject).mockResolvedValue(undefined as never);
    vi.mocked(testManagerApi.getProject).mockResolvedValue({
      ...projectResponse(),
      deleted: false,
    } as never);

    const restored = await useTestManagerStore.getState().restoreProject('proj-1');

    expect(testManagerApi.restoreProject).toHaveBeenCalledWith('proj-1');
    expect(restored.deleted).toBe(false);
    expect(useTestManagerStore.getState().projects.map((p) => p.id)).toContain('proj-1');
  });

  it('requires the same client-admin role to restore or permanently delete', async () => {
    useAuthStore.setState({
      user: buildUser({ role: 'member', clientId: 'client-1' }),
    });
    useTestManagerStore.setState({ projects: [buildProject({ ownerId: 'user-1' })] });

    await expect(
      useTestManagerStore.getState().restoreProject('proj-1')
    ).rejects.toThrow(DELETE_FORBIDDEN_ERROR);
    await expect(
      useTestManagerStore.getState().purgeProject('proj-1')
    ).rejects.toThrow(DELETE_FORBIDDEN_ERROR);

    expect(testManagerApi.restoreProject).not.toHaveBeenCalled();
    expect(testManagerApi.purgeProject).not.toHaveBeenCalled();
  });

  it('rolls the list back when a permanent delete fails', async () => {
    useAuthStore.setState({
      user: buildUser({ role: 'client_admin', clientId: 'client-1' }),
    });
    useTestManagerStore.setState({ projects: [buildProject()] });
    vi.mocked(testManagerApi.purgeProject).mockRejectedValue(new Error('nope') as never);

    await expect(useTestManagerStore.getState().purgeProject('proj-1')).rejects.toThrow('nope');

    // The optimistic removal must not leave the project missing from the list.
    expect(useTestManagerStore.getState().projects.map((p) => p.id)).toEqual(['proj-1']);
    expect(useTestManagerStore.getState().error).toBe('nope');
  });

  it('allows a same-client client_admin (lead) to create a suite', async () => {
    useAuthStore.setState({
      user: buildUser({ role: 'client_admin', clientId: 'client-1' }),
    });
    useTestManagerStore.setState({ projects: [buildProject()] });

    await useTestManagerStore.getState().createTestSuite('proj-1', { name: 'Auth' });

    expect(testManagerApi.createTestSuite).toHaveBeenCalledTimes(1);
  });

  it('blocks ticket writes for a viewer of the project', async () => {
    useAuthStore.setState({
      user: buildUser({ role: 'member', clientId: 'client-1' }),
    });
    useTestManagerStore.setState({
      projects: [buildProject({
        members: [{ id: 'user-1', name: 'User One', email: 'user@example.com', role: 'viewer' }],
      })],
    });

    await expect(
      useTestManagerStore.getState().createTicket('proj-1', {} as never)
    ).rejects.toThrow(READ_ONLY_ERROR);

    expect(ticketApi.createTicket).not.toHaveBeenCalled();
  });

  it('fails open when the project is not loaded locally (backend still enforces)', async () => {
    useAuthStore.setState({
      user: buildUser({ role: 'member', clientId: 'client-1' }),
    });

    await useTestManagerStore.getState().updateProject('proj-unknown', { name: 'Renamed' });

    expect(testManagerApi.updateProject).toHaveBeenCalledTimes(1);
  });

  it('blocks bulk case writes when any selected case belongs to a view-only project', async () => {
    useAuthStore.setState({
      user: buildUser({ role: 'member', clientId: 'client-1' }),
    });
    useTestManagerStore.setState({
      projects: [buildProject({
        members: [{ id: 'user-1', name: 'User One', email: 'user@example.com', role: 'viewer' }],
      })],
      testCases: [
        {
          id: 'tc-1',
          title: 'Case',
          priority: 'High' as never,
          status: 'Draft' as never,
          createdAt: '2026-01-01T00:00:00.000Z',
          lastModified: '2026-01-01T00:00:00.000Z',
          assignedTester: { id: 'u-1', name: 'QA', avatar: '' },
          steps: [],
          suite: 'Auth',
          suiteId: 'suite-1',
          history: [],
          projectId: 'proj-1',
        },
      ] as never,
    });

    await expect(
      useTestManagerStore.getState().bulkDeleteTestCases(['tc-1'])
    ).rejects.toThrow(READ_ONLY_ERROR);

    expect(testManagerApi.bulkDeleteTestCases).not.toHaveBeenCalled();
  });
});
