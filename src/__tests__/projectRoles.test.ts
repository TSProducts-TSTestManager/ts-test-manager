import { describe, expect, it } from 'vitest';
import { canDeleteProject, canWriteProject, getProjectRole } from '../utils/projectRoles';
import { Project } from '../types/testManager';

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

describe('canDeleteProject', () => {
  it('allows only a client_admin of the project\'s own client', () => {
    const project = buildProject();

    expect(canDeleteProject(project, { _id: 'u-1', role: 'client_admin', clientId: 'client-1' })).toBe(true);
    expect(canDeleteProject(project, { _id: 'u-1', role: 'client_admin', clientId: 'client-2' })).toBe(false);
    expect(canDeleteProject(project, { _id: 'u-1', role: 'client_admin' })).toBe(false);
    expect(canDeleteProject(project, { _id: 'u-1', role: 'member', clientId: 'client-1' })).toBe(false);
    expect(canDeleteProject(project, { _id: 'u-1', role: 'super_admin' })).toBe(false);
  });

  it('refuses the project owner even though they can write', () => {
    const project = buildProject({ ownerId: 'u-1' });
    const owner = { _id: 'u-1', role: 'member', clientId: 'client-1' };

    // The owner is a `lead` inside the project and may edit it…
    expect(getProjectRole(project, owner)).toBe('lead');
    expect(canWriteProject(project, owner)).toBe(true);
    // …but deleting it is a client-admin action.
    expect(canDeleteProject(project, owner)).toBe(false);
  });

  it('refuses a project that has no clientId, which no client admin can own', () => {
    const legacy = buildProject({ clientId: undefined });
    expect(canDeleteProject(legacy, { _id: 'u-1', role: 'client_admin', clientId: 'client-1' })).toBe(false);
  });

  it('refuses when there is no project or no signed-in user', () => {
    expect(canDeleteProject(undefined, { _id: 'u-1', role: 'client_admin', clientId: 'client-1' })).toBe(false);
    expect(canDeleteProject(buildProject(), null)).toBe(false);
  });

  it('does not depend on membership, so it still works for a project the admin is not in', () => {
    // A client_admin administers their whole client, not only the projects they
    // were added to.
    const project = buildProject({ members: [] });
    expect(canDeleteProject(project, { _id: 'u-1', role: 'client_admin', clientId: 'client-1' })).toBe(true);
  });
});
