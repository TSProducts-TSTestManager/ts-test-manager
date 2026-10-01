import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router';
import { shallow } from 'zustand/shallow';
import toast from 'react-hot-toast';
import { useTestManagerStore } from '../../store/testManagerStore';
import { useRealtimeTestCases } from '../../hooks/useRealtimeTestCases';
import EmptyProjectState from '../../components/testManager/EmptyProjectState';
import TestSuiteList from '../../components/testManager/TestSuiteList';
import TestSuiteCreateModal from '../../components/testManager/TestSuiteCreateModal';
import TestSuiteEditModal from '../../components/testManager/TestSuiteEditModal';
import SuiteMoveModal from '../../components/testManager/SuiteMoveModal';
import SuiteTree, { SuiteTreeActionButton } from '../../components/testManager/SuiteTree';
import ConfirmationModal from '../../components/testManager/ConfirmationModal';
import ContextBreadcrumb from '../../components/testManager/ContextBreadcrumb';
import ProjectPresenceIndicator from '../../components/testManager/ProjectPresenceIndicator';
import TagInput from '../../components/testManager/TagInput';
import { getTagColor } from '../../utils/tagColors';
import { buildSuiteTree, subtreeSuiteIds, suitePathLabel } from '../../utils/suiteTree';
import { TestSuite, ArchiveScope } from '../../types/testManager';
import { useProjectPresence } from '../../hooks/useProjectPresence';
import { useProjectWriteAccess } from '../../utils/projectPermissions';
import { Tag, X, ChevronDown, Check, FolderPlus, FolderInput, Pencil, Trash2, Archive as ArchiveIcon } from 'lucide-react';

const getSuiteTagFilterStorageKey = (projectId: string) => `testSuitesTagFilter:${projectId}`;

type StoredSuiteTagFilter = {
    selectedTags: string[];
    includeNoTags: boolean;
};

const TestSuitesPage: React.FC = () => {
    const { activeProject, testCases, testSuites, projects, setActiveSuiteWithId, fetchTestCases, fetchTestCasesByProject, fetchTestSuites, fetchProjects, updateTestSuite, deleteTestSuite, archiveTestSuite, restoreTestSuite, setActiveProject, setActiveArea, clearFilters, searchQuery, clearSearchQuery } = useTestManagerStore(
        (state) => ({
            activeProject: state.activeProject,
            testCases: state.testCases,
            testSuites: state.testSuites,
            projects: state.projects,
            setActiveSuiteWithId: state.setActiveSuiteWithId,
            fetchTestCases: state.fetchTestCases,
            fetchTestCasesByProject: state.fetchTestCasesByProject,
            fetchTestSuites: state.fetchTestSuites,
            fetchProjects: state.fetchProjects,
            updateTestSuite: state.updateTestSuite,
            deleteTestSuite: state.deleteTestSuite,
            archiveTestSuite: state.archiveTestSuite,
            restoreTestSuite: state.restoreTestSuite,
            setActiveProject: state.setActiveProject,
            setActiveArea: state.setActiveArea,
            clearFilters: state.clearFilters,
            searchQuery: state.searchQuery,
            clearSearchQuery: state.clearSearchQuery,
        }),
        shallow
    );
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Enable real-time updates for test suites
    useRealtimeTestCases({
        projectId: activeProject,
    });

    // Track users present in the same project
    const { projectUsers } = useProjectPresence({
        projectId: activeProject,
    });

    const canWrite = useProjectWriteAccess(activeProject);
    const readOnlyToast = () => toast.error('You have read-only access to this project');

    // Track processed projectId to prevent double loading
    const processedProjectIdRef = useRef<string | null>(null);

    const [isSuitesLoading, setIsSuitesLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createParentId, setCreateParentId] = useState<string | null>(null);
    const [suiteToEdit, setSuiteToEdit] = useState<TestSuite | null>(null);
    const [suiteToMove, setSuiteToMove] = useState<TestSuite | null>(null);
    const [suiteToDelete, setSuiteToDelete] = useState<TestSuite | null>(null);
    const [suiteToArchive, setSuiteToArchive] = useState<TestSuite | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);
    // Which slice of the list to show. Archived suites are hidden unless the
    // user explicitly switches to them, and the two views need separate
    // fetches because the server filters on the flag.
    const [suiteScope, setSuiteScope] = useState<ArchiveScope>('active');
    const [selectedSuiteIds, setSelectedSuiteIds] = useState<string[]>([]);
    const [bulkTags, setBulkTags] = useState<string[]>([]);
    const [isBulkUpdatingTags, setIsBulkUpdatingTags] = useState(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);

    // Tag filter state
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [includeNoTags, setIncludeNoTags] = useState(false);
    const [tagFilterOpen, setTagFilterOpen] = useState(false);
    const tagFilterRef = useRef<HTMLDivElement>(null);

    // Restore tag filter state per project
    useEffect(() => {
        if (!activeProject || typeof window === 'undefined') {
            setSelectedTags([]);
            setIncludeNoTags(false);
            return;
        }

        try {
            const rawValue = localStorage.getItem(getSuiteTagFilterStorageKey(activeProject));
            if (!rawValue) {
                setSelectedTags([]);
                setIncludeNoTags(false);
                return;
            }

            const parsed = JSON.parse(rawValue) as Partial<StoredSuiteTagFilter>;
            setSelectedTags(Array.isArray(parsed.selectedTags) ? parsed.selectedTags.filter((tag): tag is string => typeof tag === 'string') : []);
            setIncludeNoTags(typeof parsed.includeNoTags === 'boolean' ? parsed.includeNoTags : false);
        } catch (error) {
            console.error('Failed to restore suite tag filters from localStorage:', error);
            setSelectedTags([]);
            setIncludeNoTags(false);
        }
    }, [activeProject]);

    // Persist tag filter state per project
    useEffect(() => {
        if (!activeProject || typeof window === 'undefined') {
            return;
        }

        const payload: StoredSuiteTagFilter = {
            selectedTags,
            includeNoTags,
        };

        localStorage.setItem(getSuiteTagFilterStorageKey(activeProject), JSON.stringify(payload));
    }, [activeProject, selectedTags, includeNoTags]);

    // Close tag filter dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (tagFilterRef.current && !tagFilterRef.current.contains(e.target as Node)) {
                setTagFilterOpen(false);
            }
        };
        if (tagFilterOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [tagFilterOpen]);

    const [viewMode, setViewMode] = useState<'card' | 'table'>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('suiteViewMode');
            return saved === 'table' ? 'table' : 'card';
        }
        return 'card';
    });

    const handleViewModeToggle = () => {
        const newMode = viewMode === 'card' ? 'table' : 'card';
        setViewMode(newMode);
        localStorage.setItem('suiteViewMode', newMode);
    };

    // Ensure projects are loaded when this page is visited directly (only if not already loaded)
    useEffect(() => {
        if (projects.length === 0) {
            fetchProjects();
        }
    }, [projects.length, fetchProjects]);

    // Clear search query when entering and leaving the page
    useEffect(() => {
        clearSearchQuery(); // Clear search when entering the page
        return () => clearSearchQuery(); // Clear search when leaving
    }, [clearSearchQuery]);

    // Handle projectId URL parameter for direct links to a project
    useEffect(() => {
        const projectId = searchParams.get('projectId');

        if (!projectId || processedProjectIdRef.current === projectId) {
            return;
        }

        // Mark as processed immediately
        processedProjectIdRef.current = projectId;

        // Use timeout to ensure store actions are processed correctly if needed
        setActiveProject(projectId);

        // Clear the URL parameter
        setSearchParams({}, { replace: true });

        // Show success toast (only once)
        toast.success('Project context loaded');

    }, [searchParams, setSearchParams, setActiveProject]);

    // Fetch test suites and test cases when project is active
    // Prioritize loading suites first for faster initial display
    useEffect(() => {
        // Prevent race condition: if there is a projectId in the URL that differs from activeProject,
        // do not fetch data for the old project. Let the URL handler update the project first.
        const urlProjectId = searchParams.get('projectId');
        if (urlProjectId && urlProjectId !== activeProject) {
            return;
        }

        if (activeProject) {
            setIsSuitesLoading(true);
            // Fetch suites and test cases in parallel for stats. Cases follow the
            // same scope so the per-suite progress bars describe the same slice
            // of work the list is showing.
            Promise.all([
                fetchTestSuites(activeProject, suiteScope),
                fetchTestCasesByProject(activeProject, suiteScope),
            ]).finally(() => {
                setIsSuitesLoading(false);
            });
        } else {
            setIsSuitesLoading(false);
        }
    }, [activeProject, suiteScope, fetchTestSuites, fetchTestCasesByProject, searchParams]);

    // Switching views invalidates any selection made in the other one.
    useEffect(() => {
        setSelectedSuiteIds([]);
    }, [suiteScope]);

    // Filter test cases by active project
    const projectTestCases = useMemo(() => (
        activeProject
            ? testCases.filter(tc => tc.projectId === activeProject)
            : []
    ), [activeProject, testCases]);

    const availableTestSuites = useMemo<TestSuite[]>(() => {
        if (testSuites.length > 0) {
            return testSuites;
        }

        return Array.from(new Set(projectTestCases.map((testCase) => testCase.suite)))
            .sort()
            .map((name) => ({
                id: name,
                name,
                projectId: activeProject ?? '',
                description: '',
                tags: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }));
    }, [activeProject, projectTestCases, testSuites]);

    const normalizedSearchQuery = searchQuery.trim().toLowerCase();

    // Filter test suites based on search query
    const filteredTestSuites = availableTestSuites.filter(suite => {
        const matchesSearch =
            normalizedSearchQuery.length === 0 ||
            suite.name.toLowerCase().includes(normalizedSearchQuery) ||
            (suite.description && suite.description.toLowerCase().includes(normalizedSearchQuery));
        const suiteHasNoTags = !suite.tags || suite.tags.length === 0;
        const matchesSelectedTags =
            selectedTags.length === 0 ||
            selectedTags.every(t => suite.tags?.includes(t));
        const matchesTags = includeNoTags
            ? (selectedTags.length === 0 ? suiteHasNoTags : (matchesSelectedTags || suiteHasNoTags))
            : matchesSelectedTags;
        return matchesSearch && matchesTags;
    });

    // Folder tree (left pane) and the subtree the list on the right shows.
    const [treeSelectedId, setTreeSelectedId] = useState<string | null>(null);
    const [expandedTreeIds, setExpandedTreeIds] = useState<Set<string>>(new Set());

    // The tree honours the same search/tag filters as the list, so a suite that
    // is filtered out of the results is not still visible in the navigation.
    // A child whose parent is filtered out is shown as a root node instead.
    const suiteTree = useMemo(() => buildSuiteTree(filteredTestSuites), [filteredTestSuites]);

    // Selecting a folder scopes the right-hand list to that node and everything
    // beneath it, matching how the case list behaves for the same folder.
    const scopedSuiteIds = useMemo(
        () => (treeSelectedId ? new Set(subtreeSuiteIds(testSuites, treeSelectedId)) : null),
        [testSuites, treeSelectedId]
    );

    const visibleTestSuites = useMemo(
        () =>
            scopedSuiteIds
                ? filteredTestSuites.filter((suite) => scopedSuiteIds.has(suite.id))
                : filteredTestSuites,
        [filteredTestSuites, scopedSuiteIds]
    );

    const toggleTreeExpand = (suiteId: string) => {
        setExpandedTreeIds((prev) => {
            const next = new Set(prev);
            if (next.has(suiteId)) next.delete(suiteId);
            else next.add(suiteId);
            return next;
        });
    };

    const handleCreateInside = (parentId: string | null) => {
        if (!canWrite) { readOnlyToast(); return; }
        setCreateParentId(parentId);
        setIsCreateOpen(true);
    };

    // Open the selected node so the list below the tree is visible.
    useEffect(() => {
        if (!treeSelectedId) return;
        setExpandedTreeIds((prev) => new Set(prev).add(treeSelectedId));
    }, [treeSelectedId]);

    // Gather all distinct tags from all suites in this project
    const allTags = Array.from(
        new Set(testSuites.flatMap(s => s.tags || []))
    ).sort();    const hasSuitesWithNoTags = testSuites.some(s => !s.tags || s.tags.length === 0);
    const activeTagFilterCount = selectedTags.length + (includeNoTags ? 1 : 0);
    const hasActiveSuiteFilters = normalizedSearchQuery.length > 0 || activeTagFilterCount > 0;
    const suiteListEmptyState = filteredTestSuites.length === 0 && hasActiveSuiteFilters
        ? {
            title: 'No Test Suites Found',
            description: normalizedSearchQuery.length > 0
                ? 'No test suites match your search or filters.'
                : 'No test suites match the selected filters.',
        }
        : suiteScope === 'archived' && testSuites.length === 0
            ? {
                title: 'No Archived Test Suites',
                description: 'Test suites you archive will appear here so you can restore them later.',
            }
            : undefined;

    const selectedSuites = testSuites.filter((suite) => selectedSuiteIds.includes(suite.id));

    const toggleSuiteSelection = (suiteId: string) => {
        setSelectedSuiteIds((prev) =>
            prev.includes(suiteId)
                ? prev.filter((id) => id !== suiteId)
                : [...prev, suiteId]
        );
    };

    const handleSelectAllVisibleSuites = (checked: boolean, visibleSuiteIds: string[]) => {
        if (checked) {
            setSelectedSuiteIds((prev) => Array.from(new Set([...prev, ...visibleSuiteIds])));
            return;
        }
        setSelectedSuiteIds((prev) => prev.filter((id) => !visibleSuiteIds.includes(id)));
    };

    const handleBulkAddTags = async () => {
        if (!canWrite) { readOnlyToast(); return; }
        if (selectedSuiteIds.length === 0 || bulkTags.length === 0) return;

        setIsBulkUpdatingTags(true);
        try {
            const updates = selectedSuites.map((suite) => {
                const mergedTags = Array.from(new Set([...(suite.tags || []), ...bulkTags]));
                return updateTestSuite(suite.id, { tags: mergedTags });
            });

            const results = await Promise.allSettled(updates);
            const successful = results.filter((result) => result.status === 'fulfilled').length;
            const failed = results.length - successful;

            if (successful > 0) {
                toast.success(`Added tags to ${successful} suite${successful > 1 ? 's' : ''}`);
            }

            if (failed > 0) {
                toast.error(`Failed to update ${failed} suite${failed > 1 ? 's' : ''}`);
            }

            if (activeProject) {
                await fetchTestSuites(activeProject);
            }

            if (failed === 0) {
                setBulkTags([]);
                setSelectedSuiteIds([]);
            }
        } catch (error: unknown) {
            console.error('Failed to bulk add tags:', error);
            toast.error((error as Error)?.message || 'Failed to add tags to selected suites');
        } finally {
            setIsBulkUpdatingTags(false);
        }
    };

    const confirmBulkDeleteSuites = async () => {
        if (!canWrite) { readOnlyToast(); return; }
        if (selectedSuiteIds.length === 0) return;

        setIsBulkDeleting(true);
        try {
            const deletes = selectedSuiteIds.map((suiteId) => deleteTestSuite(suiteId));
            const results = await Promise.allSettled(deletes);
            const successful = results.filter((result) => result.status === 'fulfilled').length;
            const failed = results.length - successful;

            if (successful > 0) {
                toast.success(`Deleted ${successful} suite${successful > 1 ? 's' : ''}`);
            }

            if (failed > 0) {
                toast.error(`Failed to delete ${failed} suite${failed > 1 ? 's' : ''}`);
            }

            if (activeProject) {
                await fetchTestSuites(activeProject);
            }

            if (failed === 0) {
                setSelectedSuiteIds([]);
                setIsBulkDeleteConfirmOpen(false);
            }
        } catch (error: unknown) {
            console.error('Failed to bulk delete suites:', error);
            toast.error((error as Error)?.message || 'Failed to delete selected suites');
        } finally {
            setIsBulkDeleting(false);
        }
    };

    useEffect(() => {
        setSelectedSuiteIds((prev) => prev.filter((id) => testSuites.some((suite) => suite.id === id)));
    }, [testSuites]);

    useEffect(() => {
        setSelectedSuiteIds([]);
        setBulkTags([]);
    }, [activeProject]);

    const handleSuiteClick = (suiteName: string, suiteId?: string) => {
        if (suiteId) {
            // Set both suite id and name in the store for proper context
            setActiveSuiteWithId(suiteId, suiteName);
            // Reset filters when selecting a suite
            clearFilters();
            // Reset area filter when selecting a suite
            setActiveArea(null);
            // Fetch test cases for this suite before navigating, matching the
            // scope we are viewing so an archived suite lands on archived cases.
            fetchTestCases(suiteId, suiteScope);
        }
        // Carry the scope across so the cases page opens on the matching list.
        navigate(
            suiteScope === 'archived'
                ? `/test-manager/cases?scope=archived${suiteId ? `&suiteId=${encodeURIComponent(suiteId)}` : ''}`
                : '/test-manager/cases'
        );
    };

    const handleCreateSuite = () => {
        if (!canWrite) { readOnlyToast(); return; }
        setIsCreateOpen(true);
    };

    const handleEditSuite = (suite: TestSuite) => {
        if (!canWrite) { readOnlyToast(); return; }
        setSuiteToEdit(suite);
    };

    const handleDeleteSuite = (suite: TestSuite) => {
        if (!canWrite) { readOnlyToast(); return; }
        setSuiteToDelete(suite);
    };

    const handleArchiveSuite = (suite: TestSuite) => {
        if (!canWrite) { readOnlyToast(); return; }
        setSuiteToArchive(suite);
    };

    const handleRestoreSuite = async (suite: TestSuite) => {
        if (!canWrite) { readOnlyToast(); return; }
        try {
            await restoreTestSuite(suite.id);
            toast.success(`Test suite "${suite.name}" restored`);
            if (activeProject) {
                await Promise.all([
                    fetchTestSuites(activeProject, suiteScope),
                    fetchTestCasesByProject(activeProject, suiteScope),
                ]);
            }
        } catch (error: unknown) {
            console.error('Failed to restore suite:', error);
            toast.error((error as Error)?.message || 'Failed to restore test suite');
        }
    };

    const confirmArchiveSuite = async () => {
        if (!canWrite) { readOnlyToast(); return; }
        if (!suiteToArchive) return;

        const suiteName = suiteToArchive.name;
        const caseCount = suiteToArchive.caseCount ?? 0;
        setIsArchiving(true);
        try {
            await archiveTestSuite(suiteToArchive.id);
            setSuiteToArchive(null);
            toast.success(
                caseCount > 0
                    ? `Archived "${suiteName}" and its ${caseCount} test case${caseCount > 1 ? 's' : ''}`
                    : `Archived "${suiteName}"`
            );
            if (activeProject) {
                await Promise.all([
                    fetchTestSuites(activeProject, suiteScope),
                    fetchTestCasesByProject(activeProject, suiteScope),
                ]);
            }
        } catch (error: unknown) {
            console.error('Failed to archive suite:', error);
            toast.error((error as Error)?.message || 'Failed to archive test suite');
        } finally {
            setIsArchiving(false);
        }
    };

    const confirmDeleteSuite = async () => {
        if (!canWrite) { readOnlyToast(); return; }
        if (!suiteToDelete) return;

        const suiteName = suiteToDelete.name;
        setIsDeleting(true);
        try {
            await deleteTestSuite(suiteToDelete.id);
            setSuiteToDelete(null);
            toast.success(`Test suite "${suiteName}" deleted successfully`);
            // Refresh suites after deletion
            if (activeProject) {
                await fetchTestSuites(activeProject);
            }
        } catch (error: unknown) {
            console.error('Failed to delete suite:', error);
            toast.error((error as Error)?.message || 'Failed to delete test suite');
        } finally {
            setIsDeleting(false);
        }
    };

    const location = useLocation();

    useEffect(() => {
        try {
            const open = (location.state as { openNewSuite?: boolean } | null)?.openNewSuite;
            if (open) {
                // clear navigation state first
                navigate(location.pathname, { replace: true, state: {} });
                if (canWrite) {
                    setIsCreateOpen(true);
                } else {
                    readOnlyToast();
                }
            }
        } catch {
            // ignore
        }
    }, [canWrite, location, navigate]);

    if (!activeProject) {
        return (
            <EmptyProjectState
                title="No Project Selected"
                description="Please select a project to view and manage test suites"
            />
        );
    }

    // Show loading spinner only while suites are loading (not waiting for cases)
    if (isSuitesLoading) {
        return (
            <div className="flex flex-col h-auto sm:h-full bg-white dark:bg-gray-900">
                <div className="bg-white dark:bg-gray-900 sm:sticky sm:top-0 sm:z-20">
                    <ContextBreadcrumb
                        showSuiteSelector={false}
                        viewToggle={{ mode: viewMode, onToggle: handleViewModeToggle }}
                    />
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-auto sm:h-full bg-white dark:bg-gray-900">
            {/* Context Breadcrumb - project only, no suite selector */}
            <div className="bg-white dark:bg-gray-900 sm:sticky sm:top-0 sm:z-20">
                <ContextBreadcrumb
                    showSuiteSelector={false}
                    viewToggle={{ mode: viewMode, onToggle: handleViewModeToggle }}
                    rightContent={activeProject ? <ProjectPresenceIndicator users={projectUsers} maxDisplay={4} /> : undefined}
                    beforeToggle={(
                        <>
                            <div className="inline-flex items-center rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 p-0.5 shadow-sm dark:shadow-none">
                                {(['active', 'archived'] as const).map((scope) => (
                                    <button
                                        key={scope}
                                        onClick={() => setSuiteScope(scope)}
                                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                                            suiteScope === scope
                                                ? 'bg-blue-600 text-white'
                                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                                        }`}
                                    >
                                        {scope === 'active' ? 'Active' : 'Archived'}
                                    </button>
                                ))}
                            </div>
                            {allTags.length > 0 || hasSuitesWithNoTags ? (
                                <div className="relative" ref={tagFilterRef}>
                                    <button
                                onClick={() => setTagFilterOpen(!tagFilterOpen)}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border rounded-lg transition-colors shadow-sm dark:shadow-none ${
                                    activeTagFilterCount > 0
                                        ? 'border-blue-400 dark:border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                                }`}
                            >
                                <Tag size={14} />
                                <span className="hidden sm:inline">Tags</span>
                                {activeTagFilterCount > 0 && (
                                    <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold bg-blue-500 text-white rounded-full">
                                        {activeTagFilterCount}
                                    </span>
                                )}
                                <ChevronDown size={13} className={`text-gray-400 transition-transform ${tagFilterOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {tagFilterOpen && (
                                <div className="absolute top-full left-0 mt-1 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 py-1 z-50">
                                    <div className="px-3 py-2 border-b border-gray-50 dark:border-gray-700 flex items-center justify-between">
                                        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Filter by Tags</p>
                                        {activeTagFilterCount > 0 && (
                                            <button
                                                onClick={() => {
                                                    setSelectedTags([]);
                                                    setIncludeNoTags(false);
                                                }}
                                                className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                                            >
                                                <X size={11} /> Clear
                                            </button>
                                        )}
                                    </div>
                                    <div className="max-h-52 overflow-y-auto">
                                        {hasSuitesWithNoTags && (
                                            <button
                                                onClick={() => setIncludeNoTags(prev => !prev)}
                                                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                                                    includeNoTags
                                                        ? 'bg-blue-50 dark:bg-blue-900/30'
                                                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                                                }`}
                                            >
                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                                                    No Tags
                                                </span>
                                                {includeNoTags && (
                                                    <Check size={12} className="ml-auto text-blue-500 dark:text-blue-400 flex-shrink-0" />
                                                )}
                                            </button>
                                        )}
                                        {allTags.map(tag => (
                                            <button
                                                key={tag}
                                                onClick={() =>
                                                    setSelectedTags(prev =>
                                                        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                                                    )
                                                }
                                                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                                                    selectedTags.includes(tag)
                                                        ? 'bg-blue-50 dark:bg-blue-900/30'
                                                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                                                }`}
                                            >
                                                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium ${getTagColor(tag)}`}>
                                                    <Tag className="h-2.5 w-2.5 opacity-70" />
                                                    {tag}
                                                </span>
                                                {selectedTags.includes(tag) && (
                                                    <Check size={12} className="ml-auto text-blue-500 dark:text-blue-400 flex-shrink-0" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                                </div>
                            ) : null}
                        </>
                    )}
                />
            </div>

            <div className="flex-1 sm:overflow-auto">
                {selectedSuiteIds.length > 0 && (
                    <div className="mx-4 mt-4 sm:mx-6 px-4 py-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex items-center gap-2 text-sm font-medium text-blue-800 dark:text-blue-200">
                                <span>{selectedSuiteIds.length} suite{selectedSuiteIds.length > 1 ? 's' : ''} selected</span>
                                <button
                                    onClick={() => setSelectedSuiteIds([])}
                                    className="text-xs px-2 py-1 rounded-md border border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                >
                                    Clear selection
                                </button>
                            </div>

                            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
                                <div className="min-w-[220px] lg:w-72">
                                    <TagInput
                                        tags={bulkTags}
                                        onChange={setBulkTags}
                                        suggestions={allTags}
                                        placeholder="Add tags to selected suites"
                                    />
                                </div>
                                <button
                                    onClick={handleBulkAddTags}
                                    disabled={bulkTags.length === 0 || isBulkUpdatingTags}
                                    className="px-3 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {isBulkUpdatingTags ? 'Applying...' : 'Add Tags'}
                                </button>
                                <button
                                    onClick={() => setIsBulkDeleteConfirmOpen(true)}
                                    disabled={isBulkDeleting}
                                    className="px-3 py-2 text-sm font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Delete Selected
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <TestSuiteCreateModal
                    isOpen={isCreateOpen}
                    onClose={() => {
                        setIsCreateOpen(false);
                        setCreateParentId(null);
                    }}
                    projectId={activeProject}
                    defaultParentId={createParentId}
                />

                <TestSuiteEditModal
                    isOpen={!!suiteToEdit}
                    onClose={() => setSuiteToEdit(null)}
                    suite={suiteToEdit}
                    projectId={activeProject}
                />

                <SuiteMoveModal
                    isOpen={!!suiteToMove}
                    onClose={() => setSuiteToMove(null)}
                    suite={suiteToMove}
                    projectId={activeProject}
                />

                <ConfirmationModal
                    isOpen={!!suiteToDelete}
                    onClose={() => setSuiteToDelete(null)}
                    onConfirm={confirmDeleteSuite}
                    title="Delete Test Suite"
                    message={`Are you sure you want to delete "${suiteToDelete?.name}"? This will permanently remove all test cases in this suite.`}
                    confirmText="Delete Suite"
                    isDestructive={true}
                    isLoading={isDeleting}
                />

                <ConfirmationModal
                    isOpen={isBulkDeleteConfirmOpen}
                    onClose={() => setIsBulkDeleteConfirmOpen(false)}
                    onConfirm={confirmBulkDeleteSuites}
                    title="Delete Selected Test Suites"
                    message={`Are you sure you want to delete ${selectedSuiteIds.length} selected suite${selectedSuiteIds.length > 1 ? 's' : ''}? This will permanently remove all test cases in those suites.`}
                    confirmText="Delete Selected"
                    isDestructive={true}
                    isLoading={isBulkDeleting}
                    requireConfirmationText="delete"
                />

                <ConfirmationModal
                    isOpen={!!suiteToArchive}
                    onClose={() => setSuiteToArchive(null)}
                    onConfirm={confirmArchiveSuite}
                    title="Archive Test Suite"
                    message={
                        (suiteToArchive?.caseCount ?? 0) > 0
                            ? `Archiving "${suiteToArchive?.name}" also archives its ${suiteToArchive?.caseCount} test case${(suiteToArchive?.caseCount ?? 0) > 1 ? 's' : ''}. They will be hidden from test runs and analytics. You can restore the suite and its cases at any time.`
                            : `Archiving "${suiteToArchive?.name}" will hide it from the active list. You can restore it at any time.`
                    }
                    confirmText="Archive Suite"
                    isDestructive={true}
                    isLoading={isArchiving}
                />

                <div className="flex-1 flex overflow-hidden min-h-0">
                    {/* Folder tree */}
                    {/*
                      Hidden on narrow screens: the tree plus the app sidebar
                      would leave the suite list with almost no width. The
                      breadcrumb dropdown still lists every folder by path.
                    */}
                    <aside className="hidden lg:flex w-72 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-col">
                        <div className="px-3 pt-3 pb-2 flex items-center justify-between">
                            <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                Folders
                            </h3>
                            <SuiteTreeActionButton
                                label="New top-level folder"
                                onClick={() => handleCreateInside(null)}
                            >
                                <FolderPlus className="w-4 h-4" />
                            </SuiteTreeActionButton>
                        </div>
                        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
                            <button
                                onClick={() => setTreeSelectedId(null)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                                    treeSelectedId === null
                                        ? 'bg-white dark:bg-gray-800 font-medium text-gray-900 dark:text-gray-100 shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                            >
                                All folders
                            </button>
                            {suiteTree.length > 0 ? (
                                <SuiteTree
                                    nodes={suiteTree}
                                    activeSuiteId={treeSelectedId}
                                    onSelect={setTreeSelectedId}
                                    expandedIds={expandedTreeIds}
                                    onToggleExpand={toggleTreeExpand}
                                    renderActions={(node) => (
                                        <>
                                            <SuiteTreeActionButton
                                                label={`New folder inside ${node.suite.name}`}
                                                onClick={() => handleCreateInside(node.suite.id)}
                                            >
                                                <FolderPlus className="w-3.5 h-3.5" />
                                            </SuiteTreeActionButton>
                                            <SuiteTreeActionButton
                                                label={`Move ${node.suite.name}`}
                                                onClick={() => {
                                                    if (!canWrite) { readOnlyToast(); return; }
                                                    setSuiteToMove(node.suite);
                                                }}
                                            >
                                                <FolderInput className="w-3.5 h-3.5" />
                                            </SuiteTreeActionButton>
                                            <SuiteTreeActionButton
                                                label={`Rename ${node.suite.name}`}
                                                onClick={() => {
                                                    if (!canWrite) { readOnlyToast(); return; }
                                                    setSuiteToEdit(node.suite);
                                                }}
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </SuiteTreeActionButton>
                                            <SuiteTreeActionButton
                                                label={`Archive ${node.suite.name}`}
                                                onClick={() => {
                                                    if (!canWrite) { readOnlyToast(); return; }
                                                    setSuiteToArchive(node.suite);
                                                }}
                                            >
                                                <ArchiveIcon className="w-3.5 h-3.5" />
                                            </SuiteTreeActionButton>
                                            <SuiteTreeActionButton
                                                label={`Delete ${node.suite.name}`}
                                                danger
                                                onClick={() => {
                                                    if (!canWrite) { readOnlyToast(); return; }
                                                    setSuiteToDelete(node.suite);
                                                }}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </SuiteTreeActionButton>
                                        </>
                                    )}
                                />
                            ) : (
                                <p className="px-3 py-4 text-center text-xs text-gray-400 dark:text-gray-500">
                                    No folders yet
                                </p>
                            )}
                        </div>
                        {treeSelectedId && (
                            <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 truncate">
                                Showing {visibleTestSuites.length} of {filteredTestSuites.length} in{' '}
                                {suitePathLabel(testSuites, treeSelectedId)}
                            </div>
                        )}
                    </aside>

                    {/* Suite list */}
                    <div className="flex-1 overflow-auto">
                        <TestSuiteList
                            testCases={projectTestCases}
                            testSuites={visibleTestSuites}
                            onSuiteClick={handleSuiteClick}
                            onCreate={handleCreateSuite}
                            onEdit={handleEditSuite}
                            onDelete={handleDeleteSuite}
                            onArchive={handleArchiveSuite}
                            onRestore={handleRestoreSuite}
                            viewMode={viewMode}
                            onViewModeToggle={handleViewModeToggle}
                            selectedSuiteIds={selectedSuiteIds}
                            onToggleSuiteSelection={toggleSuiteSelection}
                            onSelectAllSuites={handleSelectAllVisibleSuites}
                            allowDerivedFallback={false}
                            emptyState={suiteListEmptyState}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TestSuitesPage;
