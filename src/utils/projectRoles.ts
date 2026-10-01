import { Project, ProjectMemberRole } from '../types/testManager';

export type PermissionUser = {
    _id: string;
    role?: string;
    clientId?: string | null;
} | null;

/**
 * The signed-in user's role inside a project.
 * Returns `null` when they are not a member (and not owner / admin).
 * Mirrors the backend `requireProjectWrite` rules.
 */
export const getProjectRole = (
    project: Project | undefined,
    user: PermissionUser
): ProjectMemberRole | null => {
    if (!project || !user) return null;
    if (user.role === 'super_admin') return 'lead';
    if (
        user.role === 'client_admin' &&
        project.clientId &&
        user.clientId &&
        String(project.clientId) === String(user.clientId)
    ) {
        return 'lead';
    }
    if (project.ownerId === user._id) return 'lead';
    const member = project.members?.find((m) => m.id === user._id);
    if (!member) return null;
    return member.role || 'editor';
};

/** Can this user modify the project (create / edit / delete)? Viewers cannot. */
export const canWriteProject = (project: Project | undefined, user: PermissionUser): boolean => {
    const role = getProjectRole(project, user);
    return role !== null && role !== 'viewer';
};

/**
 * Can this user delete / restore / permanently delete the project?
 *
 * The business rule is narrower than `canWriteProject`: only a `client_admin` of
 * the project's *own* client may remove a project for that client. Owners,
 * leads, editors and super_admins cannot, so the Delete action has to be hidden
 * for them rather than left to fail on the server.
 *
 * A project with no `clientId` cannot be tied to a client admin, so it is not
 * deletable through this rule — same answer the backend gives.
 */
export const canDeleteProject = (project: Project | undefined, user: PermissionUser): boolean => {
    if (!project || !user) return false;
    if (user.role !== 'client_admin') return false;
    if (!project.clientId || !user.clientId) return false;
    return String(project.clientId) === String(user.clientId);
};

