import { useAuthStore } from '../store/authStore';
import { useTestManagerStore } from '../store/testManagerStore';
import { ProjectMemberRole } from '../types/testManager';
import { PermissionUser, canWriteProject, getProjectRole } from './projectRoles';

// Pure role helpers live in `projectRoles.ts` (no store imports) so the store
// itself can import them without creating an import cycle.
export { canWriteProject, getProjectRole };
export type { PermissionUser };

/**
 * Write access for the active project.
 *
 * Fails **open** while the project is still loading (unknown locally) so a
 * slow fetch never blocks legitimate editors — the backend `requireProjectWrite`
 * guard is the enforcement point. Returns `false` when there is no project
 * context, or when the loaded project shows the user is a viewer / non-member.
 */
export const useProjectWriteAccess = (projectId?: string | null): boolean => {
    const user = useAuthStore((s) => s.user);
    const project = useTestManagerStore((s) =>
        projectId ? s.projects.find((p) => p.id === projectId) : undefined
    );
    if (!projectId) return false;
    if (!project) return true;
    return canWriteProject(project, user);
};

/** Role inside the active project (for badges / read-only banners). */
export const useProjectRole = (projectId?: string | null): ProjectMemberRole | null => {
    const user = useAuthStore((s) => s.user);
    const project = useTestManagerStore((s) =>
        projectId ? s.projects.find((p) => p.id === projectId) : undefined
    );
    return getProjectRole(project, user);
};
