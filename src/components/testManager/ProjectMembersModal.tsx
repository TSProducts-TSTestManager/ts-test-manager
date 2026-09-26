import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Crown, UserPlus, Trash2, Loader2, Search, ShieldCheck } from 'lucide-react';
import { useTestManagerStore } from '../../store/testManagerStore';
import { listMemberCandidates } from '../../services/testManagerApi';
import { ProjectMemberCandidate, ProjectMemberRole } from '../../types/testManager';

interface Props {
    projectId: string;
    currentUserId: string;
    /** Role of the signed-in user (client_admin / super_admin can manage too) */
    currentUserRole?: string;
    /** Client the signed-in user belongs to (used for the client_admin gate) */
    currentClientId?: string | null;
    onClose: () => void;
}

const ROLE_OPTIONS: { value: ProjectMemberRole; label: string; hint: string }[] = [
    { value: 'lead', label: 'Lead', hint: 'Full control, can manage members' },
    { value: 'editor', label: 'Editor', hint: 'Create and edit work items' },
    { value: 'viewer', label: 'Viewer', hint: 'Read-only access' },
];

const roleBadgeClass = (role?: ProjectMemberRole) =>
    role === 'lead'
        ? 'text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30'
        : role === 'viewer'
          ? 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50'
          : 'text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30';

const ProjectMembersModal: React.FC<Props> = ({
    projectId,
    currentUserId,
    currentUserRole,
    currentClientId,
    onClose,
}) => {
    const { projects, addProjectMember, removeProjectMember, updateMemberRole, fetchProjects } =
        useTestManagerStore();

    // Get fresh project data from store
    const project = projects.find((p) => p.id === projectId);

    const [candidates, setCandidates] = useState<ProjectMemberCandidate[]>([]);
    const [candidatesLoaded, setCandidatesLoaded] = useState(false);
    const [candidatesError, setCandidatesError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [roleToAdd, setRoleToAdd] = useState<ProjectMemberRole>('editor');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const isOwner = project?.ownerId === currentUserId;
    const canManage =
        !!isOwner ||
        currentUserRole === 'super_admin' ||
        (currentUserRole === 'client_admin' &&
            !!project?.clientId &&
            !!currentClientId &&
            project.clientId === currentClientId);

    const loadCandidates = useCallback(async () => {
        try {
            setCandidatesError(null);
            const list = await listMemberCandidates(projectId);
            setCandidates(list);
        } catch (err: unknown) {
            setCandidatesError((err as Error)?.message || 'Could not load users');
            setCandidates([]);
        } finally {
            setCandidatesLoaded(true);
        }
    }, [projectId]);

    // Load assignable users (project's client users) when the picker is shown
    useEffect(() => {
        if (canManage) {
            void loadCandidates();
        }
    }, [canManage, loadCandidates]);

    const flashSuccess = (message: string) => {
        setSuccessMessage(message);
        setTimeout(() => setSuccessMessage(null), 3000);
    };

    // Close the modal if the project disappeared from the store
    useEffect(() => {
        if (!project) {
            onClose();
        }
    }, [project, onClose]);

    const filteredCandidates = useMemo(() => {
        const q = search.trim().toLowerCase();
        const list = candidates.filter((c) => !c.assigned);
        if (!q) return list;
        return list.filter(
            (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
        );
    }, [candidates, search]);

    if (!project) {
        return null;
    }

    const visibleCandidates = filteredCandidates.filter((c) => c.active);

    const toggleCandidate = (id: string) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
        setError(null);
    };

    const handleAssign = async () => {
        if (selectedIds.length === 0) {
            setError('Select at least one user to assign');
            return;
        }
        setIsSubmitting(true);
        setError(null);
        try {
            await addProjectMember(project.id, selectedIds, roleToAdd);
            await fetchProjects();
            setSelectedIds([]);
            setSearch('');
            flashSuccess(
                `${selectedIds.length} user${selectedIds.length > 1 ? 's' : ''} assigned as ${ROLE_OPTIONS.find((r) => r.value === roleToAdd)?.label}`
            );
            // Refresh the picker so assigned users drop out of the list
            await loadCandidates();
        } catch (err: unknown) {
            setError((err as Error)?.message || 'Failed to assign users');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        setBusyMemberId(memberId);
        setError(null);
        try {
            await removeProjectMember(project.id, memberId);
            await fetchProjects();
            flashSuccess('Member removed');
            await loadCandidates();
        } catch (err: unknown) {
            setError((err as Error)?.message || 'Failed to remove member');
        } finally {
            setBusyMemberId(null);
        }
    };

    const handleChangeRole = async (memberId: string, role: ProjectMemberRole) => {
        setBusyMemberId(memberId);
        setError(null);
        try {
            await updateMemberRole(project.id, memberId, role);
            await fetchProjects();
            flashSuccess('Role updated');
        } catch (err: unknown) {
            setError((err as Error)?.message || 'Failed to update role');
        } finally {
            setBusyMemberId(null);
        }
    };

    const ownerMember = project.members.find((m) => m.id === project.ownerId);
    const otherMembers = project.members.filter((m) => m.id !== project.ownerId);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full h-full sm:h-auto sm:max-w-lg bg-white dark:bg-gray-800 sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-[scaleIn_0.12s_ease-out]">
                {/* Header */}
                <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Manage Members</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{project.name}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-white dark:bg-gray-800">
                    {/* Error/Success Messages */}
                    {error && (
                        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 p-3 rounded-lg flex items-start gap-2">
                            <span className="flex-1">{error}</span>
                            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 dark:hover:text-red-300">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                    {successMessage && (
                        <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 p-3 rounded-lg">
                            {successMessage}
                        </div>
                    )}

                    {/* Assign picker - owner / client_admin / super_admin only */}
                    {canManage && (
                        <div className="space-y-3">
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                                Add existing users
                            </label>

                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search users by name or email"
                                    className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-300 dark:focus:border-blue-500 focus:ring-0 outline-none text-sm placeholder-gray-400 dark:placeholder-gray-500"
                                />
                            </div>

                            <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                                {!candidatesLoaded ? (
                                    <div className="flex items-center justify-center gap-2 p-4 text-sm text-gray-500 dark:text-gray-400">
                                        <Loader2 className="h-4 w-4 animate-spin" /> Loading users…
                                    </div>
                                ) : candidatesError ? (
                                    <div className="p-3 text-sm text-red-600 dark:text-red-400">{candidatesError}</div>
                                ) : visibleCandidates.length === 0 ? (
                                    <div className="p-4 text-sm text-gray-400 dark:text-gray-500 text-center">
                                        {candidates.filter((c) => c.assigned).length > 0
                                            ? 'Everyone is already assigned to this project.'
                                            : 'No users available in this client.'}
                                    </div>
                                ) : (
                                    visibleCandidates.map((c) => (
                                        <label
                                            key={c.id}
                                            className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(c.id)}
                                                onChange={() => toggleCandidate(c.id)}
                                                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-sm font-medium text-gray-900 dark:text-white truncate">
                                                    {c.name}
                                                </span>
                                                <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">
                                                    {c.email}
                                                </span>
                                            </span>
                                            <span className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                                {c.clientRole.replace('_', ' ')}
                                            </span>
                                        </label>
                                    ))
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <select
                                    value={roleToAdd}
                                    onChange={(e) => setRoleToAdd(e.target.value as ProjectMemberRole)}
                                    className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-300 dark:focus:border-blue-500"
                                    title={ROLE_OPTIONS.find((r) => r.value === roleToAdd)?.hint}
                                >
                                    {ROLE_OPTIONS.map((r) => (
                                        <option key={r.value} value={r.value}>
                                            {r.label} — {r.hint}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={handleAssign}
                                    disabled={isSubmitting || selectedIds.length === 0}
                                    className="px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                                >
                                    {isSubmitting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <UserPlus className="h-4 w-4" />
                                    )}
                                    Assign{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
                                </button>
                            </div>
                        </div>
                    )}

                    {!canManage && (
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                            Only the project owner and client admins can change members.
                        </p>
                    )}

                    {/* Members List */}
                    <div className="space-y-2">
                        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            Members ({project.members.length})
                        </h4>

                        {/* Owner - Always show first */}
                        <div className="flex items-center justify-between gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-lg">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="h-9 w-9 rounded-full bg-amber-500 flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                                    {ownerMember?.name?.charAt(0).toUpperCase() || 'O'}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-gray-900 dark:text-white text-sm truncate">
                                            {ownerMember?.name || 'Owner'}
                                        </span>
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                                            <Crown className="h-3 w-3" />
                                            Owner
                                        </span>
                                        {ownerMember && ownerMember.active === false && (
                                            <span className="px-2 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 rounded-full">
                                                Inactive
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                        {ownerMember?.email || 'Project owner'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Other Members (non-owners) */}
                        {otherMembers.map((member) => (
                            <div
                                key={member.id}
                                className="flex items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div
                                        className={`h-9 w-9 rounded-full flex items-center justify-center text-white font-medium text-sm flex-shrink-0 ${
                                            member.active === false
                                                ? 'bg-gray-400 dark:bg-gray-600'
                                                : 'bg-blue-500'
                                        }`}
                                    >
                                        {member.name?.charAt(0).toUpperCase() || member.email?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                                                {member.name}
                                            </p>
                                            <span
                                                className={`px-2 py-0.5 text-xs font-medium rounded-full ${roleBadgeClass(member.role)}`}
                                            >
                                                {member.role === 'lead' ? 'Lead' : member.role === 'viewer' ? 'Viewer' : 'Editor'}
                                            </span>
                                            {member.active === false && (
                                                <span className="px-2 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 rounded-full">
                                                    Inactive
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                            {member.email}
                                        </p>
                                    </div>
                                </div>

                                {/* Role + remove controls - owner / client_admin only */}
                                {canManage && (
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <select
                                            value={member.role || 'editor'}
                                            onChange={(e) =>
                                                handleChangeRole(member.id, e.target.value as ProjectMemberRole)
                                            }
                                            disabled={busyMemberId === member.id}
                                            className="px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 outline-none focus:border-blue-300 dark:focus:border-blue-500 disabled:opacity-50"
                                            title="Project role"
                                        >
                                            {ROLE_OPTIONS.map((r) => (
                                                <option key={r.value} value={r.value}>
                                                    {r.label}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={() => handleRemoveMember(member.id)}
                                            disabled={busyMemberId === member.id}
                                            className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                                            title="Remove from project"
                                        >
                                            {busyMemberId === member.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-4 w-4" />
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}

                        {otherMembers.length === 0 && (
                            <div className="text-center py-6 text-gray-400 dark:text-gray-500 text-sm">
                                <p>
                                    {canManage
                                        ? 'No other members yet. Assign users above to collaborate.'
                                        : 'No other members yet.'}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Roles legend */}
                    <div className="flex items-start gap-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700 pt-3">
                        <ShieldCheck className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>
                            {ROLE_OPTIONS.map((r) => `${r.label}: ${r.hint}`).join(' · ')}
                        </span>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProjectMembersModal;
