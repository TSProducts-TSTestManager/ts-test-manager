import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import ProjectList from '../../components/testManager/ProjectList';
import ProjectCreateModal from '../../components/testManager/ProjectCreateModal';
import ProjectEditModal from '../../components/testManager/ProjectEditModal';
import ProjectSettingsModal from '../../components/testManager/ProjectSettingsModal';
import ConfirmationModal from '../../components/testManager/ConfirmationModal';
import { useTestManagerStore } from '../../store/testManagerStore';
import { useAuthStore } from '../../store/authStore';
import { Project } from '../../types/testManager';

const ProjectsPage: React.FC = () => {
    const { projects, fetchProjects, fetchMoreProjects, setActiveProject, searchQuery, setSearchQuery, clearSearchQuery, deleteProject, restoreProject, purgeProject, projectsHasMore, isProjectsLoadingMore, projectsOffset, projectsTotal, setProjectsSearch, projectsShowDeleted, setProjectsShowDeleted } = useTestManagerStore();
    const navigate = useNavigate();
    const location = useLocation();
    const user = useAuthStore((state) => state.user);
    // The deleted-projects view is a client-admin tool: the backend returns
    // nothing for anyone else, so the toggle is not even offered to them.
    const mayManageDeleted = user?.role === 'client_admin' && !!user?.clientId;

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
    const [projectToSettings, setProjectToSettings] = useState<Project | null>(null);
    const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
    const [projectToRestore, setProjectToRestore] = useState<Project | null>(null);
    const [projectToPurge, setProjectToPurge] = useState<Project | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    // Only the very first load: the list renders a spinner instead of the
    // "No projects yet" empty state until the fetch settles.
    const [isProjectsLoading, setIsProjectsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'card' | 'table'>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('projectViewMode');
            return saved === 'table' ? 'table' : 'card';
        }
        return 'card';
    });
    const sentinelRef = useRef<HTMLDivElement>(null);

    // Debounce the shared header search so a keystroke does not fire a request
    // each time.
    const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
    useEffect(() => {
        const handle = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
        return () => clearTimeout(handle);
    }, [searchQuery]);

    const handleViewModeToggle = () => {
        const newMode = viewMode === 'card' ? 'table' : 'card';
        setViewMode(newMode);
        localStorage.setItem('projectViewMode', newMode);
    };

    // Start from a clean list each time the page is entered, and leave the
    // store's search empty on exit so a fetch triggered elsewhere is not
    // silently narrowed by this page's text.
    useEffect(() => {
        clearSearchQuery();
        setProjectsSearch('');
        let active = true;
        setIsProjectsLoading(true);
        // fetchProjects never rejects (it stores the error), so this only
        // resolves — `.finally` keeps the spinner honest either way.
        fetchProjects().finally(() => {
            if (active) setIsProjectsLoading(false);
        });
        return () => {
            active = false;
            clearSearchQuery();
            setProjectsSearch('');
        };
    }, [clearSearchQuery, fetchProjects, setProjectsSearch]);

    // Push the debounced search into the store and reload, so a match on
    // project #400 is found instead of only whatever is already in memory.
    // The first run is skipped because the mount effect above already fetched.
    const isFirstSearchRun = useRef(true);
    useEffect(() => {
        if (isFirstSearchRun.current) {
            isFirstSearchRun.current = false;
            return;
        }
        setProjectsSearch(debouncedSearch);
        fetchProjects();
    }, [debouncedSearch, fetchProjects, setProjectsSearch]);

    // Switching between live and deleted reloads the list from the server: the
    // two sets are disjoint, so paging state from the previous view is wrong.
    const isFirstDeletedViewRun = useRef(true);
    useEffect(() => {
        if (isFirstDeletedViewRun.current) {
            isFirstDeletedViewRun.current = false;
            return;
        }
        setIsProjectsLoading(true);
        fetchProjects().finally(() => setIsProjectsLoading(false));
    }, [projectsShowDeleted, fetchProjects]);

    // Open the create modal if navigation state requested it (from toolbar)
    useEffect(() => {
        try {
            const open = (location.state as { openNew?: boolean } | null)?.openNew;
            if (open) {
                setIsCreateOpen(true);
                // Clear the navigation state so it doesn't reopen on refresh/back
                navigate(location.pathname, { replace: true, state: {} });
            }
        } catch {
            // ignore
        }
    }, [location, navigate]);

    const handleProjectClick = (projectId: string) => {
        // Set the active project and navigate to suites
        setActiveProject(projectId);
        navigate('/test-manager/suites');
    };

    const handleCreateProject = async () => {
        // open the modal to create a project
        setIsCreateOpen(true);
    };

    const handleEditProject = (project: Project) => {
        setProjectToEdit(project);
    };

    const handleProjectSettings = (project: Project) => {
        setProjectToSettings(project);
    };

    const handleDeleteProject = (project: Project) => {
        setProjectToDelete(project);
    };

    const handleRestoreProject = (project: Project) => {
        setProjectToRestore(project);
    };

    const handlePurgeProject = (project: Project) => {
        setProjectToPurge(project);
    };

    // Deleting a project hides it from every role, including the members who
    // worked in it, and the same client admin can bring it back — so this is a
    // plain confirmation, not a typed one.
    const confirmDeleteProject = async () => {
        if (!projectToDelete) return;

        const projectName = projectToDelete.name;
        setIsDeleting(true);
        try {
            await deleteProject(projectToDelete.id);
            setProjectToDelete(null);
            toast.success(`Project "${projectName}" deleted`);
        } catch (error: unknown) {
            console.error('Failed to delete project:', error);
            toast.error((error as Error)?.message || 'Failed to delete project');
        } finally {
            setIsDeleting(false);
        }
    };

    const confirmRestoreProject = async () => {
        if (!projectToRestore) return;

        const projectName = projectToRestore.name;
        setIsDeleting(true);
        try {
            await restoreProject(projectToRestore.id);
            setProjectToRestore(null);
            toast.success(`Project "${projectName}" restored`);
        } catch (error: unknown) {
            console.error('Failed to restore project:', error);
            toast.error((error as Error)?.message || 'Failed to restore project');
        } finally {
            setIsDeleting(false);
        }
    };

    const confirmPurgeProject = async () => {
        if (!projectToPurge) return;

        const projectName = projectToPurge.name;
        setIsDeleting(true);
        try {
            await purgeProject(projectToPurge.id);
            setProjectToPurge(null);
            toast.success(`Project "${projectName}" permanently deleted`);
        } catch (error: unknown) {
            console.error('Failed to permanently delete project:', error);
            toast.error((error as Error)?.message || 'Failed to delete project permanently');
        } finally {
            setIsDeleting(false);
        }
    };

    // The server matches on name, description, displayId and JIRA key, so the
    // loaded rows are the results. Filtering again here would only ever narrow
    // what a single page returned.
    const filteredProjects = projects;

    // Infinite scroll: load more projects when sentinel is visible
    const handleLoadMore = useCallback(() => {
        if (!projectsHasMore || isProjectsLoadingMore) return;
        fetchMoreProjects();
    }, [fetchMoreProjects, projectsHasMore, isProjectsLoadingMore]);

    useEffect(() => {
        if (!projectsHasMore || isProjectsLoadingMore) return;

        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const first = entries[0];
                if (first?.isIntersecting) {
                    handleLoadMore();
                }
            },
            {
                root: null,
                rootMargin: '200px 0px',
                threshold: 0,
            }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [handleLoadMore, projectsHasMore, isProjectsLoadingMore]);

    return (
        <div className="flex flex-col h-auto sm:h-full bg-white dark:bg-gray-900">
            <ProjectCreateModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
            
            <ProjectEditModal 
                isOpen={!!projectToEdit} 
                onClose={() => setProjectToEdit(null)} 
                project={projectToEdit} 
            />

            <ProjectSettingsModal
                isOpen={!!projectToSettings}
                onClose={() => setProjectToSettings(null)}
                project={projectToSettings}
            />
            
            <ConfirmationModal
                isOpen={!!projectToDelete}
                onClose={() => setProjectToDelete(null)}
                onConfirm={confirmDeleteProject}
                title="Delete Project"
                message={`Delete "${projectToDelete?.name}"? The project and everything in it — test suites, test cases, runs and tickets — will be hidden from everyone on this client. A client admin can restore it later.`}
                confirmText="Delete Project"
                isDestructive={true}
                isLoading={isDeleting}
            />

            <ConfirmationModal
                isOpen={!!projectToRestore}
                onClose={() => setProjectToRestore(null)}
                onConfirm={confirmRestoreProject}
                title="Restore Project"
                message={`Restore "${projectToRestore?.name}"? Its test suites, test cases, runs and tickets become available again. Content that was archived before the project was deleted stays archived.`}
                confirmText="Restore Project"
                isDestructive={false}
                isLoading={isDeleting}
            />

            <ConfirmationModal
                isOpen={!!projectToPurge}
                onClose={() => setProjectToPurge(null)}
                onConfirm={confirmPurgeProject}
                title="Delete Permanently"
                message={`This permanently deletes "${projectToPurge?.name}" and all of its test suites, test cases, runs, run groups, tickets and evidence. This cannot be undone.`}
                confirmText="Delete Permanently"
                isDestructive={true}
                isLoading={isDeleting}
                requireConfirmationText="delete"
            />
            
            {mayManageDeleted && (
                <div className="flex justify-end px-4 pt-3">
                    <button
                        onClick={() => setProjectsShowDeleted(!projectsShowDeleted)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                            projectsShowDeleted
                                ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                    >
                        {projectsShowDeleted ? 'Show active projects' : 'Show deleted projects'}
                    </button>
                </div>
            )}

            <ProjectList
                projects={filteredProjects}
                isLoading={isProjectsLoading}
                onProjectClick={handleProjectClick}
                onCreate={handleCreateProject}
                onEdit={handleEditProject}
                onSettings={handleProjectSettings}
                onDelete={handleDeleteProject}
                onRestore={handleRestoreProject}
                onPurge={handlePurgeProject}
                viewMode={viewMode}
                onViewModeToggle={handleViewModeToggle}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
            />

            {/* Load-more sentinel is not tied to a view mode: the table view
                paginates exactly like the card grid does. */}
            {projectsHasMore && (
                <div ref={sentinelRef} className="flex justify-center py-4">
                    {isProjectsLoadingMore && (
                        <div className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading more projects...
                        </div>
                    )}
                </div>
            )}
            {projectsTotal > 0 && (
                <div className="text-center text-xs text-gray-400 dark:text-gray-500 pb-4">
                    Loaded {Math.min(projectsOffset, filteredProjects.length)} / {projectsTotal} projects
                </div>
            )}
        </div>
    );
};

export default ProjectsPage;
