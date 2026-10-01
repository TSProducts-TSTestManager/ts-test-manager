import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import toast from 'react-hot-toast';
import { shallow } from 'zustand/shallow';
import { useTestManagerStore } from '../../store/testManagerStore';
import EmptyProjectState from '../../components/testManager/EmptyProjectState';
import ContextBreadcrumb from '../../components/testManager/ContextBreadcrumb';
import ConfirmationModal from '../../components/testManager/ConfirmationModal';
import {
    TestRunListItem,
    RunItemStatus,
    TestRun,
    TestRunGroup,
    CustomFieldDefinition,
    TestRunStatus,
} from '../../types/testManager';
import { CreateTicketRequest } from '../../types/api/testManager.api';
import { testRunApi } from '../../services/testRunApi';
import { useRealtimeTestRuns } from '../../hooks/useRealtimeTestRuns';
import { useProjectSettings } from '../../hooks/useTestManagerSelectors';
import { useProjectWriteAccess } from '../../utils/projectPermissions';
import {
    Play,
    Clock,
    CheckCircle,
    Trash2,
    Copy,
    ChevronRight,
    ChevronDown,
    Filter,
    Check,
    Layers,
    Menu,
    Edit2,
    Loader2,
    Share2,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Table2,
    LayoutDashboard,
    Search,
    X,
    Ticket,
} from 'lucide-react';
import IdDisplay from '../../components/testManager/IdDisplay';
import CreateGroupModal from './components/CreateGroupModal';
import RunGroupsSidebar from '../../components/testManager/RunGroupsSidebar';
import CreateRunModal from './components/CreateRunModal';
import EditTestRunModal from './components/EditTestRunModal';
import ExecuteRunModal from './components/ExecuteRunModal';
import RunDetailView from './components/RunDetailView';
import { getRunStatusColor, generateSuiteTitle } from './components/testRunUtils';

const RUNS_PAGE_SIZE = 40;

const mapRunResponseToListItem = (run: TestRun): TestRunListItem => ({
    id: run.id,
    displayId: run.displayId,
    title: run.title,
    description: run.description,
    projectId: run.projectId,
    suiteId: run.suiteId,
    suiteName: run.suiteName,
    status: run.status,
    environment: run.environment,
    team: run.team,
    buildVersion: run.buildVersion,
    tags: run.tags,
    itemCount: run.items.length,
    createdBy: run.createdBy,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    resultsSummary: run.resultsSummary,
    groupId: run.groupId,
    ticketCount: run.ticketCount,
    ticketResolutionRate: run.ticketResolutionRate,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
});


const TestRunsPage: React.FC = () => {
    const {
        activeProject,
        testCases,
        testSuites,
        setRunDetailViewOpen,
        fetchTestCasesByProject,
        fetchTestSuites,
        setActiveProject,
        searchQuery,
        setSearchQuery,
        clearSearchQuery,
        createTicket,
        setRefreshTestRunsCallback,
    } = useTestManagerStore(
        (state) => ({
            activeProject: state.activeProject,
            testCases: state.testCases,
            testSuites: state.testSuites,
            setRunDetailViewOpen: state.setRunDetailViewOpen,
            fetchTestCasesByProject: state.fetchTestCasesByProject,
            fetchTestSuites: state.fetchTestSuites,
            setActiveProject: state.setActiveProject,
            searchQuery: state.searchQuery,
            setSearchQuery: state.setSearchQuery,
            clearSearchQuery: state.clearSearchQuery,
            createTicket: state.createTicket,
            setRefreshTestRunsCallback: state.setRefreshTestRunsCallback,
        }),
        shallow
    );
    const [searchParams, setSearchParams] = useSearchParams();
    const projectSettings = useProjectSettings(activeProject || '');
    const canWrite = useProjectWriteAccess(activeProject);
    const readOnlyToast = () => toast.error('You have read-only access to this project');
    const customFieldDefinitions: CustomFieldDefinition[] = (projectSettings?.testCases?.customFields || []).filter((f: CustomFieldDefinition) => !f.deleted);
    const [testRuns, setTestRunsState] = useState<TestRunListItem[]>([]);
    /**
     * Mirror of the run list for the socket handlers.
     *
     * Those callbacks run outside React, so they read this instead of waiting
     * for a render. Every write to the list goes through `setTestRuns` below,
     * which is what keeps it honest.
     */
    const testRunsRef = useRef<TestRunListItem[]>(testRuns);
    const setTestRuns = useCallback<React.Dispatch<React.SetStateAction<TestRunListItem[]>>>((action) => {
        setTestRunsState((previous) => {
            const next = typeof action === 'function'
                ? (action as (previous: TestRunListItem[]) => TestRunListItem[])(previous)
                : action;
            testRunsRef.current = next;
            return next;
        });
    }, []);
    const [testRunGroups, setTestRunGroups] = useState<TestRunGroup[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMoreRuns, setHasMoreRuns] = useState(false);
    const [runsOffset, setRunsOffset] = useState(0);
    const [runsTotal, setRunsTotal] = useState(0);
    /**
     * Move the loaded count and the server total together.
     *
     * Adjusting only one of them is what made the "Loaded X / Y" readout drift
     * away from what the list actually held after a create, clone or delete.
     */
    const noteRunAdded = useCallback(() => {
        setRunsOffset((previous) => previous + 1);
        setRunsTotal((previous) => previous + 1);
    }, []);
    const noteRunRemoved = useCallback(() => {
        setRunsOffset((previous) => Math.max(previous - 1, 0));
        setRunsTotal((previous) => Math.max(previous - 1, 0));
    }, []);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<TestRunGroup | undefined>(undefined);
    const [preselectedCaseIds, setPreselectedCaseIds] = useState<string[]>([]);
    const [executeRun, setExecuteRun] = useState<TestRun | null>(null);
    const [isExecuteModalOpen, setIsExecuteModalOpen] = useState(false);
    const [detailRun, setDetailRun] = useState<TestRun | null>(null);
    const [detailRunId, setDetailRunId] = useState<string | null>(null);
    const [executeStartIndex, setExecuteStartIndex] = useState(0);
    const [executeItemOrder, setExecuteItemOrder] = useState<number[] | undefined>(undefined);
    const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
    const [selectedRunStatusFilter, setSelectedRunStatusFilter] = useState<TestRunStatus | 'all'>('all');
    const [runSortField, setRunSortField] = useState<'createdAt' | 'title' | 'status' | 'displayId' | 'suiteName' | 'environment' | 'team' | 'buildVersion'>('createdAt');
    const [runSortDir, setRunSortDir] = useState<'asc' | 'desc'>('desc');
    const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
    const [hasTicketsFilter, setHasTicketsFilter] = useState<'all' | 'yes' | 'no'>('all');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Debounce search query from store
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery.trim());
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Every run list input the server filters and sorts on, as one memo so the
    // loader re-runs only when a value actually changes. Filtering here used to
    // run against the loaded page only, so a status or group filter could never
    // find a match past page one.
    const runListParams = useMemo<
        Omit<Parameters<typeof testRunApi.getTestRunsPaginated>[1], 'limit' | 'offset'>
    >(
        () => ({
            search: debouncedSearch || undefined,
            sortField: runSortField,
            sortDir: runSortDir,
            status: selectedRunStatusFilter === 'all' ? undefined : [selectedRunStatusFilter],
            // 'ungrouped' maps to the API's explicit "no group" sentinel.
            groupId: selectedGroupFilter === 'all'
                ? undefined
                : selectedGroupFilter === 'ungrouped'
                ? 'none'
                : selectedGroupFilter,
            // The list's group picker means "this group and everything under it".
            groupSubtree:
                selectedGroupFilter !== 'all' && selectedGroupFilter !== 'ungrouped'
                    ? true
                    : undefined,
            hasTickets: hasTicketsFilter === 'all' ? undefined : hasTicketsFilter === 'yes',
        }),
        [debouncedSearch, hasTicketsFilter, runSortDir, runSortField, selectedGroupFilter, selectedRunStatusFilter]
    );

    /**
     * Whether the list is every run in the project.
     *
     * The server narrows it otherwise, and the client cannot reproduce that
     * narrowing (ticket counts live in another collection, group filters walk a
     * tree), so a realtime create is only trusted while nothing is filtering.
     */
    const isUnfilteredView = useMemo(
        () =>
            !debouncedSearch &&
            selectedRunStatusFilter === 'all' &&
            selectedGroupFilter === 'all' &&
            hasTicketsFilter === 'all',
        [debouncedSearch, hasTicketsFilter, selectedGroupFilter, selectedRunStatusFilter]
    );

    const handleRunSort = useCallback((field: typeof runSortField) => {
        if (runSortField === field) {
            setRunSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setRunSortField(field);
        // Default sort direction: dates descending, text ascending
        const dateFields = ['createdAt'];
        setRunSortDir(dateFields.includes(field) ? 'desc' : 'asc');
    }, [runSortField]);

    const renderRunSortableHeader = (label: string, field: typeof runSortField, extraClass = '') => (
        <th
            onClick={() => handleRunSort(field)}
            title={`Sort by ${label}`}
            className={`text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 ${extraClass}`}
        >
            <span className="inline-flex items-center gap-1">
                {label}
                {runSortField === field ? (
                    runSortDir === 'asc'
                        ? <ArrowUp size={12} className="text-blue-500" />
                        : <ArrowDown size={12} className="text-blue-500" />
                ) : (
                    <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-60" />
                )}
            </span>
        </th>
    );
    const [isRunStatusFilterOpen, setIsRunStatusFilterOpen] = useState(false);
    const runStatusFilterRef = useRef<HTMLDivElement>(null);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
    const [isDeleteGroupModalOpen, setIsDeleteGroupModalOpen] = useState(false);
    const [editingRun, setEditingRun] = useState<TestRunListItem | null>(null);
    const [isEditRunModalOpen, setIsEditRunModalOpen] = useState(false);
    const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
    const [createModalInitialTitle, setCreateModalInitialTitle] = useState('');
    const runsListContainerRef = useRef<HTMLDivElement>(null);
    const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
    const detailLookupsLoadedForRunIdRef = useRef<string | null>(null);
    const detailRequestSequenceRef = useRef(0);

    // Ref to hold suite ID from URL params, resolved once test cases are loaded
    const pendingSuiteIdRef = useRef<string | null>(null);
    const pendingSuiteNameRef = useRef<string | null>(null);
    const processedUrlRef = useRef(false);

    useEffect(() => {
        clearSearchQuery();
        return () => clearSearchQuery();
    }, [clearSearchQuery]);

    useEffect(() => {
        setRunDetailViewOpen(Boolean(detailRunId));

        return () => {
            setRunDetailViewOpen(false);
        };
    }, [detailRunId, setRunDetailViewOpen]);

    // Handle URL params: openCreate=true&suiteId=...&suiteName=...&projectId=...
    useEffect(() => {
        if (processedUrlRef.current) return;
        const openCreate = searchParams.get('openCreate');
        const suiteId = searchParams.get('suiteId');
        const suiteName = searchParams.get('suiteName');
        const projectId = searchParams.get('projectId');

        if (openCreate !== 'true') return;
        processedUrlRef.current = true;

        if (projectId && projectId !== activeProject) {
            setActiveProject(projectId);
        }

        if (suiteId) {
            pendingSuiteIdRef.current = suiteId;
            pendingSuiteNameRef.current = suiteName;
        } else {
            setPreselectedCaseIds([]);
            setIsCreateModalOpen(true);
        }

        // Clear URL params
        setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    // Handle runStatus URL parameter for deep links (e.g. from the dashboard)
    useEffect(() => {
        const runStatusParam = searchParams.get('runStatus');

        if (!runStatusParam) return;

        if ((Object.values(TestRunStatus) as string[]).includes(runStatusParam)) {
            setSelectedRunStatusFilter(runStatusParam as TestRunStatus);
        }

        const next = new URLSearchParams(searchParams);
        next.delete('runStatus');
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams]);

    // Close the run status filter dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (runStatusFilterRef.current && !runStatusFilterRef.current.contains(event.target as Node)) {
                setIsRunStatusFilterOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Once test cases are loaded, resolve the pending suite selection and open modal
    useEffect(() => {
        if (!pendingSuiteIdRef.current || testCases.length === 0) return;
        const suiteId = pendingSuiteIdRef.current;
        const suiteName = pendingSuiteNameRef.current;
        pendingSuiteIdRef.current = null;
        pendingSuiteNameRef.current = null;
        const ids = testCases.filter(tc => tc.suiteId === suiteId).map(tc => tc.id);
        setPreselectedCaseIds(ids);
        if (suiteName) {
            setCreateModalInitialTitle(generateSuiteTitle(suiteName));
        }
        setIsCreateModalOpen(true);
    }, [testCases]);

    // Real-time updates
    useRealtimeTestRuns({
        projectId: activeProject,
        setTestRuns,
        setExecuteRun,
        runsRef: testRunsRef,
        isUnfilteredView,
        onRunAdded: noteRunAdded,
        onRunRemoved: noteRunRemoved,
    });

    const location = useLocation();

    // Handle navigation state for opening new run modal
    useEffect(() => {
        if (location.state?.openNewRun) {
            setPreselectedCaseIds([]);
            setIsCreateModalOpen(true);
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    // Fetch test runs when project changes
    const fetchRuns = useCallback(async (reset = true, offsetValue = 0) => {
        if (!activeProject) return;
        if (reset) {
            setIsLoading(true);
        } else {
            setIsLoadingMore(true);
        }
        try {
            const nextOffset = reset ? 0 : offsetValue;
            const result = await testRunApi.getTestRunsPaginated(activeProject, {
                limit: RUNS_PAGE_SIZE,
                offset: nextOffset,
                ...runListParams,
            });

            setTestRuns((previous) => {
                const incomingRuns = result.items as unknown as TestRunListItem[];
                if (reset) {
                    return incomingRuns;
                }

                const existingIds = new Set(previous.map((run) => run.id));
                const dedupedIncoming = incomingRuns.filter((run) => !existingIds.has(run.id));
                return [...previous, ...dedupedIncoming];
            });

            const loadedCount = result.items.length;
            const totalLoaded = nextOffset + loadedCount;
            setRunsOffset(totalLoaded);
            setRunsTotal(result.meta.total);
            setHasMoreRuns(result.meta.hasMore && totalLoaded < result.meta.total);
        } catch (error: unknown) {
            toast.error((error as Error).message || 'Failed to load test runs');
        } finally {
            if (reset) {
                setIsLoading(false);
            } else {
                setIsLoadingMore(false);
            }
        }
    }, [activeProject, runListParams, setTestRuns]);

    const closeDetailView = useCallback(() => {        detailRequestSequenceRef.current += 1;
        setDetailRunId(null);
        setDetailRun(null);
        setExecuteRun(null);
        setIsExecuteModalOpen(false);
        setExecuteItemOrder(undefined);
        fetchRuns();
    }, [fetchRuns]);

    const loadDetailRun = useCallback(async (
        runId: string,
        options?: {
            itemId?: string | null;
            caseId?: string | null;
            errorMessage?: string;
        }
    ) => {
        const requestSequence = detailRequestSequenceRef.current + 1;
        detailRequestSequenceRef.current = requestSequence;

        setDetailRunId(runId);
        setDetailRun(null);

        try {
            const run = await testRunApi.getTestRun(runId);
            if (detailRequestSequenceRef.current !== requestSequence) {
                return;
            }

            const typedRun = run as unknown as TestRun;
            setDetailRun(typedRun);

            const targetItemIndex = typedRun.items.findIndex(
                (item) => item.id === options?.itemId || item.caseId === options?.itemId || item.caseId === options?.caseId
            );

            if (targetItemIndex >= 0) {
                setExecuteRun(typedRun);
                setExecuteStartIndex(targetItemIndex);
                setExecuteItemOrder(undefined);
                setIsExecuteModalOpen(true);
            }
        } catch (error: unknown) {
            if (detailRequestSequenceRef.current !== requestSequence) {
                return;
            }

            setDetailRunId(null);
            setDetailRun(null);
            toast.error((error as Error).message || options?.errorMessage || 'Failed to load run');
        }
    }, []);

    // Handle deep-link to a specific test run via ?runId= query param
    // Read from window.location directly to avoid React Router searchParams interference
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const runId = params.get('runId');
        const itemId = params.get('itemId');
        const caseId = params.get('caseId');
        if (!runId) return;

        // Clean the URL immediately so it doesn't re-trigger on refresh
        const url = new URL(window.location.href);
        url.searchParams.delete('runId');
        window.history.replaceState({}, '', url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : ''));

        void loadDetailRun(runId, {
            itemId,
            caseId,
            errorMessage: 'Could not load the linked test run',
        });
    }, [loadDetailRun]);

    /**
     * Refresh: re-read the run list from the server, plus the open run's detail
     * when one is showing, so item results and the status badge are current.
     *
     * Declared here rather than beside fetchRuns because it needs loadDetailRun.
     */
    const handleRefresh = useCallback(async () => {
        await fetchRuns(true, 0);
        if (detailRunId) {
            await loadDetailRun(detailRunId);
        }
        toast.success('Reloaded test runs from server');
    }, [fetchRuns, detailRunId, loadDetailRun]);

    // Expose the refresh to the toolbar in the layout.
    useEffect(() => {
        setRefreshTestRunsCallback(handleRefresh);
        return () => setRefreshTestRunsCallback(null);
    }, [setRefreshTestRunsCallback, handleRefresh]);

    // Fetch test run groups
    const fetchGroups = useCallback(async () => {
        if (!activeProject) return;
        try {
            const groups = await testRunApi.getTestRunGroups(activeProject);
            setTestRunGroups(groups.map(g => ({
                id: g.id,
                name: g.name,
                description: g.description,
                projectId: g.projectId,
                parentId: g.parentId,
                color: g.color,
                createdBy: g.createdBy,
                createdAt: g.createdAt,
                updatedAt: g.updatedAt,
            })));
        } catch (error: unknown) {
            console.error('Failed to fetch groups:', error);
        }
    }, [activeProject]);

    // Fetch tag suggestions
    const fetchTags = useCallback(async () => {
        if (!activeProject) return;
        try {
            const tags = await testRunApi.getTagsByProject(activeProject);
            setTagSuggestions(tags);
        } catch (error: unknown) {
            console.error('Failed to fetch tags:', error);
        }
    }, [activeProject]);

    // Reload the list whenever the sort changes
    useEffect(() => {
        fetchRuns(true);
    }, [fetchRuns]);

    useEffect(() => {
        fetchGroups();
        fetchTags();
    }, [fetchGroups, fetchTags]);

    const handleLoadMoreRuns = useCallback(() => {
        if (!hasMoreRuns || isLoadingMore || isLoading) return;
        fetchRuns(false, runsOffset);
    }, [fetchRuns, hasMoreRuns, isLoadingMore, isLoading, runsOffset]);

    useEffect(() => {
        if (!hasMoreRuns || isLoading || isLoadingMore) {
            return;
        }

        const sentinel = loadMoreSentinelRef.current;
        if (!sentinel) {
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                const first = entries[0];
                if (first?.isIntersecting) {
                    handleLoadMoreRuns();
                }
            },
            {
                root: runsListContainerRef.current,
                rootMargin: '200px 0px',
                threshold: 0,
            }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [handleLoadMoreRuns, hasMoreRuns, isLoading, isLoadingMore]);

    // Fetch test cases and suites only when run creation/editing flows need them
    useEffect(() => {
        const shouldLoadCaseSelectionData =
            !!activeProject &&
            (
                isCreateModalOpen ||
                isEditRunModalOpen ||
                searchParams.get('openCreate') === 'true'
            );

        if (shouldLoadCaseSelectionData && activeProject) {
            fetchTestCasesByProject(activeProject);
            fetchTestSuites(activeProject);
        }
    }, [
        activeProject,
        isCreateModalOpen,
        isEditRunModalOpen,
        searchParams,
        fetchTestCasesByProject,
        fetchTestSuites,
    ]);

    useEffect(() => {
        if (!detailRun) {
            detailLookupsLoadedForRunIdRef.current = null;
            return;
        }

        if (detailLookupsLoadedForRunIdRef.current === detailRun.id) {
            return;
        }

        detailLookupsLoadedForRunIdRef.current = detailRun.id;
        void fetchTestCasesByProject(detailRun.projectId);
        void fetchTestSuites(detailRun.projectId);
    }, [detailRun, fetchTestCasesByProject, fetchTestSuites]);

    const handleCreateRun = async (title: string, description: string, caseIds: string[], groupId?: string, tags?: string[], environment?: string, team?: string, buildVersion?: string) => {
        if (!canWrite) { readOnlyToast(); return; }
        if (!activeProject) return;
        const createdRun = await testRunApi.createTestRun(activeProject, {
            title,
            description,
            testCaseIds: caseIds,
            groupId,
            tags,
            environment,
            team,
            buildVersion,
        });
        toast.success('Test run created!');
        const listItem = mapRunResponseToListItem(createdRun as unknown as TestRun);
        setTestRuns((previous) => {
            if (previous.some((run) => run.id === listItem.id)) {
                return previous;
            }
            return [listItem, ...previous];
        });
        noteRunAdded();
        fetchTags();
    };

    const handleCreateGroup = async (name: string, description: string, color: string, parentId?: string | null) => {
        if (!canWrite) { readOnlyToast(); throw new Error('You have read-only access to this project'); }
        if (!activeProject) return;
        try {
            await testRunApi.createTestRunGroup(activeProject, { name, description, parentId, color });
            toast.success('Group created!');
            fetchGroups();
        } catch (error: unknown) {
            toast.error((error as Error).message || 'Failed to create group');
            throw error;
        }
    };

    const handleUpdateGroup = async (name: string, description: string, color: string, parentId?: string | null) => {
        if (!canWrite) { readOnlyToast(); throw new Error('You have read-only access to this project'); }
        if (!editingGroup) return;
        try {
            await testRunApi.updateTestRunGroup(editingGroup.id, { name, description, parentId, color });
            toast.success('Group updated!');
            fetchGroups();
            setEditingGroup(undefined);
            setIsCreateGroupModalOpen(false);
        } catch (error: unknown) {
            toast.error((error as Error).message || 'Failed to update group');
            throw error;
        }
    };

    const handleDeleteGroup = (groupId: string) => {
        if (!canWrite) { readOnlyToast(); return; }
        setDeleteGroupId(groupId);
        setIsDeleteGroupModalOpen(true);
    };

    const confirmDeleteGroup = async () => {
        if (!canWrite) { readOnlyToast(); return; }
        if (!deleteGroupId) return;
        try {
            await testRunApi.deleteTestRunGroup(deleteGroupId);
            toast.success('Group deleted');
            if (selectedGroupFilter === deleteGroupId) {
                setSelectedGroupFilter('all');
            }
            fetchGroups();
        } catch (error: unknown) {
            toast.error((error as Error).message || 'Failed to delete group');
        } finally {
            setIsDeleteGroupModalOpen(false);
            setDeleteGroupId(null);
        }
    };

    const handleDeleteRun = async (runId: string) => {
        if (!canWrite) { readOnlyToast(); return; }
        if (!confirm('Are you sure you want to delete this test run?')) return;
        try {
            await testRunApi.deleteTestRun(runId);
            toast.success('Test run deleted');
            setTestRuns((previous) => previous.filter((run) => run.id !== runId));
            noteRunRemoved();
        } catch (error: unknown) {
            toast.error((error as Error).message || 'Failed to delete');
        }
    };

    const handleCloneRun = async (runId: string) => {
        if (!canWrite) { readOnlyToast(); return; }
        try {
            const clonedRun = await testRunApi.cloneTestRun(runId);
            toast.success('Test run cloned');
            const listItem = mapRunResponseToListItem(clonedRun as unknown as TestRun);
            setTestRuns((previous) => {
                if (previous.some((run) => run.id === listItem.id)) {
                    return previous;
                }
                return [listItem, ...previous];
            });
            noteRunAdded();
        } catch (error: unknown) {
            toast.error((error as Error).message || 'Failed to clone');
        }
    };

    const handleEditRun = (run: TestRunListItem) => {
        if (!canWrite) { readOnlyToast(); return; }
        setEditingRun(run);
        setIsEditRunModalOpen(true);
    };

    const handleShareRun = async (e: React.MouseEvent, runId: string) => {
        e.stopPropagation();
        const shareUrl = `${window.location.origin}/test-manager/runs?runId=${runId}`;
        try {
            await navigator.clipboard.writeText(shareUrl);
            toast.success('Link copied to clipboard');
        } catch (err) {
            console.error('Failed to copy link: ', err);
            toast.error('Failed to copy link');
        }
    };

    const handleUpdateRun = async (runId: string, data: { title: string; groupId: string | null; tags: string[]; environment?: string; team?: string; buildVersion?: string; additionalTestCaseIds?: string[] }) => {
        if (!canWrite) { readOnlyToast(); throw new Error('You have read-only access to this project'); }
        try {
            await testRunApi.updateTestRun(runId, {
                title: data.title,
                groupId: data.groupId,
                tags: data.tags,
                environment: data.environment,
                team: data.team,
                buildVersion: data.buildVersion,
                additionalTestCaseIds: data.additionalTestCaseIds,
            });
            toast.success('Test run updated');
            setTestRuns((previous) => previous.map((run) => (
                run.id === runId
                    ? {
                        ...run,
                        title: data.title,
                        groupId: data.groupId || undefined,
                        tags: data.tags,
                        environment: data.environment,
                        team: data.team,
                        buildVersion: data.buildVersion,
                        updatedAt: new Date().toISOString(),
                    }
                    : run
            )));
            fetchTags();
        } catch (error: unknown) {
            toast.error((error as Error).message || 'Failed to update test run');
            throw error;
        }
    };

    const handleExecuteRun = async (runId: string) => {
        await loadDetailRun(runId);
    };

    const handleOpenExecuteFromDetail = (itemIndex: number, itemOrder?: number[]) => {
        if (!detailRun) return;
        if (!canWrite) { readOnlyToast(); return; }
        setExecuteRun(detailRun);
        setExecuteStartIndex(itemIndex);
        setExecuteItemOrder(itemOrder);
        setIsExecuteModalOpen(true);
    };

    const handleUpdateRunItem = async (itemId: string, status: RunItemStatus, actualResult?: string) => {
        if (!canWrite) { readOnlyToast(); return; }
        const currentRun = executeRun || detailRun;
        if (!currentRun) return;
        const updated = await testRunApi.updateRunItem(currentRun.id, itemId, {
            status,
            actualResult,
        });
        const typedUpdated = updated as unknown as TestRun;
        if (executeRun) setExecuteRun(typedUpdated);
        setDetailRun(typedUpdated);
    };

    const handleDetailUpdateItem = async (itemId: string, status: RunItemStatus, actualResult?: string) => {
        if (!canWrite) { readOnlyToast(); return; }
        if (!detailRun) return;
        const updated = await testRunApi.updateRunItem(detailRun.id, itemId, {
            status,
            actualResult,
        });
        const typedUpdated = updated as unknown as TestRun;
        setDetailRun(typedUpdated);
    };

    const handleCompleteRun = async () => {
        if (!canWrite) { readOnlyToast(); return; }
        const currentRun = executeRun || detailRun;
        if (!currentRun) return;
        await testRunApi.completeTestRun(currentRun.id);
        // Refresh the detail view
        if (detailRun) {
            try {
                const refreshed = await testRunApi.getTestRun(detailRun.id);
                setDetailRun(refreshed as unknown as TestRun);
            } catch {
                // If refresh fails, just close
            }
        }
        fetchRuns(true);
    };

    const handleCreateBugFromRun = useCallback(async (data: CreateTicketRequest) => {
        if (!canWrite) {
            toast.error('You have read-only access to this project');
            throw new Error('You have read-only access to this project');
        }
        if (!activeProject) {
            throw new Error('No active project selected');
        }
        await createTicket(activeProject, data);
    }, [activeProject, canWrite, createTicket]);

    const runTeamSuggestions = useMemo(() => {
        const teamSet = new Set<string>();
        testRuns.forEach((run) => {
            if (run.team) teamSet.add(run.team);
        });
        return Array.from(teamSet).sort();
    }, [testRuns]);

    // Search, group, status and ticket filters are all applied by the server, so
    // the loaded rows are already the matches. The group subtree, the "ungrouped"
    // case and the has-tickets counts are resolved in the query, which is what
    // makes a filter able to see past the rows already in memory.
    const filteredRuns = testRuns;

    const isDetailLoading = Boolean(detailRunId) && (!detailRun || detailRun.id !== detailRunId);

    // If a run is selected for detail view, show it regardless of activeProject state
    if (detailRunId) {
        return (
            <>
                {isDetailLoading ? (
                    <div className="flex flex-col h-auto sm:h-full bg-white dark:bg-gray-900">
                        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 sm:sticky sm:top-0 sm:z-20">
                            <button
                                onClick={closeDetailView}
                                className="inline-flex items-center justify-center rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                                aria-label="Back to test runs"
                            >
                                <ChevronRight className="h-5 w-5 rotate-180" />
                            </button>
                            <div>
                                <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">Loading test run</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Fetching run details...</p>
                            </div>
                        </div>

                        <div className="flex flex-1 items-center justify-center px-6 py-16">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    </div>
                ) : detailRun ? (
                    <RunDetailView
                        testRun={detailRun}
                        searchQuery={searchQuery}
                        onBack={closeDetailView}
                        onUpdateItem={handleDetailUpdateItem}
                        onComplete={handleCompleteRun}
                        onOpenExecute={handleOpenExecuteFromDetail}
                        availableTestCases={testCases}
                        availableSuites={testSuites}
                        customFieldDefinitions={customFieldDefinitions}
                    />
                ) : null}

                {/* Execute Run Modal (from detail view) */}
                <ExecuteRunModal
                    isOpen={isExecuteModalOpen}
                    onClose={() => {
                        setIsExecuteModalOpen(false);
                        setExecuteRun(null);
                        setExecuteItemOrder(undefined);
                    }}
                    testRun={executeRun}
                    onUpdateItem={handleUpdateRunItem}
                    onComplete={handleCompleteRun}
                    onCreateTicket={handleCreateBugFromRun}
                    startIndex={executeStartIndex}
                    itemOrder={executeItemOrder}
                    availableTestCases={testCases}
                    availableSuites={testSuites}
                    customFieldDefinitions={customFieldDefinitions}
                />
            </>
        );
    }

    if (!activeProject) {
        return (
            <EmptyProjectState
                title="No Project Selected"
                description="Please select a project to view and manage test runs"
            />
        );
    }

    return (
        <div className="flex flex-col h-auto sm:h-full bg-white dark:bg-gray-900">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 sm:sticky sm:top-0 sm:z-20">
                <div className="flex items-center gap-2">
                    {/* Mobile Menu Toggle */}
                    <button
                        onClick={() => setIsMobileSidebarOpen(true)}
                        className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg md:hidden"
                        title="Open Run Groups"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <ContextBreadcrumb showSuiteSelector={false} className="border-b-0" />
                </div>
            </div>

            {/* Mobile Sidebar Overlay */}
            {isMobileSidebarOpen && (
                <div className="fixed inset-0 z-40 md:hidden">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50 transition-opacity"
                        onClick={() => setIsMobileSidebarOpen(false)}
                    />
                    {/* Drawer */}
                    <div className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-white dark:bg-gray-900 shadow-xl transform transition-transform">
                        <RunGroupsSidebar
                            groups={testRunGroups}
                            selectedFilter={selectedGroupFilter}
                            onSelectFilter={setSelectedGroupFilter}
                            onCreateGroup={() => {
                                setEditingGroup(undefined);
                                setIsCreateGroupModalOpen(true);
                            }}
                            onEditGroup={(group) => {
                                setEditingGroup(group);
                                setIsCreateGroupModalOpen(true);
                            }}
                            onDeleteGroup={handleDeleteGroup}
                            isMobile={true}
                            onClose={() => setIsMobileSidebarOpen(false)}
                        />
                    </div>
                </div>
            )}

            {/* Main Content with Sidebar */}
            <div className="flex-1 flex sm:overflow-hidden">
                {/* Desktop Groups Sidebar */}
                <div className="hidden md:block h-full">
                    <RunGroupsSidebar
                        groups={testRunGroups}
                        selectedFilter={selectedGroupFilter}
                        onSelectFilter={setSelectedGroupFilter}
                        onCreateGroup={() => {
                            setEditingGroup(undefined);
                            setIsCreateGroupModalOpen(true);
                        }}
                        onEditGroup={(group) => {
                            setEditingGroup(group);
                            setIsCreateGroupModalOpen(true);
                        }}
                        onDeleteGroup={handleDeleteGroup}
                    />
                </div>

                {/* Test Runs List */}
                <div ref={runsListContainerRef} className="flex-1 sm:overflow-auto p-4 bg-gray-50/50 dark:bg-gray-900">
                    {/* Runs toolbar */}
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        <div className="relative" ref={runStatusFilterRef}>
                            <button
                                onClick={() => setIsRunStatusFilterOpen(!isRunStatusFilterOpen)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                                <Filter size={13} />
                                <span className="hidden sm:inline">Status:</span>
                                <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium border ${selectedRunStatusFilter === 'all' ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600' : getRunStatusColor(selectedRunStatusFilter)}`}>
                                    {selectedRunStatusFilter === 'all' ? 'All' : selectedRunStatusFilter}
                                </span>
                                <ChevronDown size={12} className={`text-gray-400 transition-transform ${isRunStatusFilterOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isRunStatusFilterOpen && (
                                <div className="absolute top-full mt-2 left-0 z-30 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg w-52 overflow-hidden">
                                    <p className="px-3 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">Run Status</p>
                                    <button
                                        onClick={() => {
                                            setSelectedRunStatusFilter('all');
                                            setIsRunStatusFilterOpen(false);
                                        }}
                                        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        <span>All statuses</span>
                                        {selectedRunStatusFilter === 'all' && <Check size={14} className="text-system-blue" />}
                                    </button>
                                    {(Object.values(TestRunStatus) as TestRunStatus[]).map((status) => (
                                        <button
                                            key={status}
                                            onClick={() => {
                                                setSelectedRunStatusFilter(status);
                                                setIsRunStatusFilterOpen(false);
                                            }}
                                            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                        >
                                            <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium border ${getRunStatusColor(status)}`}>{status}</span>
                                            {selectedRunStatusFilter === status && <Check size={14} className="text-system-blue" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {selectedRunStatusFilter !== 'all' && (
                            <button
                                onClick={() => setSelectedRunStatusFilter('all')}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                                Clear
                            </button>
                        )}
                        {/* Has tickets toggle */}
                        <div className="flex items-center p-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex-shrink-0">
                            {([
                                { key: 'all', label: 'All' },
                                { key: 'yes', label: 'With tickets' },
                                { key: 'no', label: 'No tickets' },
                            ] as const).map((opt) => (
                                <button
                                    key={opt.key}
                                    onClick={() => setHasTicketsFilter(opt.key)}
                                    className={`h-7 px-2.5 rounded-md text-xs font-medium transition-colors ${
                                        hasTicketsFilter === opt.key
                                            ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                    }`}
                                    title={`Show ${opt.label.toLowerCase()}`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        {/* Search input */}
                        <div className="relative flex-shrink-0 w-full sm:w-64 md:w-80">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by Run ID, Title, Suite, Env, Team, Build..."
                                aria-label="Search test runs"
                                className="w-full h-8 pl-8 pr-7 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                    aria-label="Clear search"
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                        {/* Sort control */}
                        <label className="flex items-center gap-1.5 ml-auto text-sm text-gray-500 dark:text-gray-400">
                            <ArrowUpDown size={13} />
                            <span className="hidden sm:inline">Sort</span>
                            <select
                                value={`${runSortField}:${runSortDir}`}
                                onChange={(event) => {
                                    const [field, dir] = event.target.value.split(':') as [
                                        typeof runSortField,
                                        'asc' | 'desc',
                                    ];
                                    setRunSortField(field);
                                    setRunSortDir(dir);
                                }}
                                className="h-8 pl-2 pr-7 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                            >
                                <option value="createdAt:desc">Newest first</option>
                                <option value="createdAt:asc">Oldest first</option>
                                <option value="title:asc">Title A - Z</option>
                                <option value="title:desc">Title Z - A</option>
                                <option value="displayId:asc">Run ID (asc)</option>
                                <option value="displayId:desc">Run ID (desc)</option>
                                <option value="status:asc">Status A - Z</option>
                                <option value="status:desc">Status Z - A</option>
                            </select>
                        </label>

                        {/* View mode toggle */}
                        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex-shrink-0">
                            <button
                                onClick={() => setViewMode('card')}
                                className={`flex items-center justify-center h-7 w-7 rounded-md transition-colors ${
                                    viewMode === 'card'
                                        ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                }`}
                                title="Card view"
                                aria-label="Switch to card view"
                            >
                                <LayoutDashboard size={14} />
                            </button>
                            <button
                                onClick={() => setViewMode('table')}
                                className={`flex items-center justify-center h-7 w-7 rounded-md transition-colors ${
                                    viewMode === 'table'
                                        ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                }`}
                                title="Table view"
                                aria-label="Switch to table view"
                            >
                                <Table2 size={14} />
                            </button>
                        </div>
                    </div>
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : filteredRuns.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                            <Play className="w-12 h-12 mb-4 text-gray-300 dark:text-gray-600" />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">No Test Runs Found</h3>
                            <p className="text-sm">
                                {searchQuery.trim()
                                    ? 'No test runs match your search.'
                                    : selectedGroupFilter !== 'all'
                                    ? "No test runs in this group."
                                    : selectedRunStatusFilter !== 'all'
                                    ? `No test runs with status "${selectedRunStatusFilter}".`
                                    : "Create a test run to start executing your test cases"}
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Card View */}
                            {viewMode === 'card' && (
                                <div className="grid gap-4">
                                    {filteredRuns.map((run) => {
                                        const executedCount = run.resultsSummary.passed + run.resultsSummary.failed;
                                        const computedPassRate = executedCount > 0
                                            ? Math.round((run.resultsSummary.passed / executedCount) * 100)
                                            : 0;

                                        return (
                                        <div
                                            key={run.id}
                                            className="group bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-4 hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] dark:hover:shadow-none transition-shadow cursor-pointer"
                                            onClick={() => handleExecuteRun(run.id)}
                                        >
                                            <div className="flex items-start justify-between gap-2 mb-3">
                                                <div className="min-w-0">
                                                    <div className="flex items-center flex-wrap gap-2 mb-1">
                                                        <IdDisplay
                                                            id={run.displayId || run.id}
                                                            className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 rounded-md"
                                                        />
                                                        <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">{run.title}</h3>
                                                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getRunStatusColor(run.status)}`}>
                                                            {run.status}
                                                        </span>
                                                {run.groupId && (
                                                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                                                        {testRunGroups.find(g => g.id === run.groupId)?.name || 'Group'}
                                                    </span>
                                                )}
                                                {(run.ticketCount ?? 0) > 0 && (
                                                    <span
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-800"
                                                        title={`${run.ticketCount} ticket(s) raised from this run`}
                                                    >
                                                        <Ticket size={11} />
                                                        {run.ticketCount}
                                                        {run.ticketResolutionRate !== undefined && run.ticketResolutionRate > 0 && (
                                                            <span className="text-red-500 dark:text-red-400">
                                                                · {run.ticketResolutionRate}% resolved
                                                            </span>
                                                        )}
                                                    </span>
                                                )}
                                                        {run.tags && run.tags.length > 0 && run.tags.map((tag) => (
                                                            <span
                                                                key={tag}
                                                                className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-800"
                                                            >
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="w-3.5 h-3.5" />
                                                            {new Date(run.createdAt).toLocaleDateString()}
                                                        </span>
                                                        {run.suiteName && (
                                                            <span className="flex items-center gap-1">
                                                                <Layers className="w-3.5 h-3.5" />
                                                                {run.suiteName}
                                                            </span>
                                                        )}
                                                        <span className="flex items-center gap-1">
                                                            <CheckCircle className="w-3.5 h-3.5" />
                                                            {computedPassRate}% Pass Rate
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                                                    <button
                                                        onClick={(e) => handleShareRun(e, run.id)}
                                                        className="p-1.5 sm:p-2 text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                                        title="Copy link to Test Run"
                                                        aria-label="Copy link to test run"
                                                    >
                                                        <Share2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleEditRun(run);
                                                        }}
                                                        className="p-1.5 sm:p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30"
                                                        title="Edit Run"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleCloneRun(run.id);
                                                        }}
                                                        className="p-1.5 sm:p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30"
                                                        title="Clone Run"
                                                    >
                                                        <Copy className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteRun(run.id);
                                                        }}
                                                        className="p-1.5 sm:p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30"
                                                        title="Delete Run"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                    <ChevronRight className="hidden sm:block w-5 h-5 text-gray-300 dark:text-gray-600" />
                                                </div>
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex">
                                                {run.resultsSummary.passed > 0 && (
                                                    <div
                                                        className="bg-green-500"
                                                        style={{
                                                            width: `${(run.resultsSummary.passed / run.resultsSummary.total) * 100}%`,
                                                        }}
                                                    />
                                                )}
                                                {run.resultsSummary.failed > 0 && (
                                                    <div
                                                        className="bg-red-500"
                                                        style={{
                                                            width: `${(run.resultsSummary.failed / run.resultsSummary.total) * 100}%`,
                                                        }}
                                                    />
                                                )}
                                                {run.resultsSummary.blocked > 0 && (
                                                    <div
                                                        className="bg-yellow-500"
                                                        style={{
                                                            width: `${(run.resultsSummary.blocked / run.resultsSummary.total) * 100}%`,
                                                        }}
                                                    />
                                                )}
                                                {run.resultsSummary.skipped > 0 && (
                                                    <div
                                                        className="bg-gray-400 dark:bg-gray-500"
                                                        style={{
                                                            width: `${(run.resultsSummary.skipped / run.resultsSummary.total) * 100}%`,
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                        );
                                    })}
                                    {hasMoreRuns && (
                                        <div ref={loadMoreSentinelRef} className="flex justify-center py-2">
                                            {isLoadingMore && (
                                                <div className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Loading more runs...
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="flex justify-end">
                                        <div className="text-xs text-gray-400 dark:text-gray-500">
                                            Loaded {Math.min(runsOffset, filteredRuns.length)} / {runsTotal || filteredRuns.length} runs
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Table View */}
                            {viewMode === 'table' && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-[0_1px_2px_rgba(0,0,0,0.02)] dark:shadow-none">
                                            <tr>
                                                {renderRunSortableHeader('Run ID', 'displayId', 'w-32')}
                                                {renderRunSortableHeader('Title', 'title', 'w-1/4')}
                                                {renderRunSortableHeader('Status', 'status', 'w-28')}
                                                {renderRunSortableHeader('Suite', 'suiteName', 'w-32')}
                                                {renderRunSortableHeader('Environment', 'environment', 'w-32')}
                                                {renderRunSortableHeader('Team', 'team', 'w-28')}
                                                {renderRunSortableHeader('Build', 'buildVersion', 'w-28')}
                                                {renderRunSortableHeader('Created', 'createdAt', 'w-32')}
                                                <th className="py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24 text-center">Tickets</th>
                                                <th className="py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-40">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-900">
                                            {filteredRuns.map((run) => {
                                                return (
                                                <tr key={run.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => handleExecuteRun(run.id)}>
                                                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100 font-mono">
                                                        <IdDisplay id={run.displayId || run.id} className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 rounded-md" />
                                                    </td>
                                                    <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-xs">{run.title}</td>
                                                    <td className="py-3 px-4 text-sm">
                                                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${getRunStatusColor(run.status)}`}>
                                                            {run.status}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">{run.suiteName || '—'}</td>
                                                    <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">{run.environment || '—'}</td>
                                                    <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">{run.team || '—'}</td>
                                                    <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">{run.buildVersion || '—'}</td>
                                                    <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{new Date(run.createdAt).toLocaleDateString()}</td>
                                                    <td className="py-3 px-4 text-sm text-center">
                                                        {(run.ticketCount ?? 0) > 0 ? (
                                                            <span
                                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-800"
                                                                title={`${run.ticketCount} ticket(s) · ${run.ticketResolutionRate ?? 0}% resolved`}
                                                            >
                                                                <Ticket size={11} />
                                                                {run.ticketCount}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-sm">
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleShareRun(e, run.id); }}
                                                                className="text-blue-600 dark:text-blue-400 hover:underline text-xs font-medium"
                                                                title="Share"
                                                            >
                                                                <Share2 className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleEditRun(run); }}
                                                                className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline text-xs font-medium"
                                                                title="Edit"
                                                            >
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleCloneRun(run.id); }}
                                                                className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline text-xs font-medium"
                                                                title="Clone"
                                                            >
                                                                <Copy className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteRun(run.id); }}
                                                                className="text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:underline text-xs font-medium"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleExecuteRun(run.id); }}
                                                                className="text-green-600 dark:text-green-400 hover:underline text-xs font-medium"
                                                                title="Execute"
                                                            >
                                                                <Play className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Create Run Modal */}
            <CreateRunModal
                isOpen={isCreateModalOpen}
                onClose={() => {
                    setIsCreateModalOpen(false);
                    setPreselectedCaseIds([]);
                    setCreateModalInitialTitle('');
                }}
                onSubmit={handleCreateRun}
                testCases={testCases}
                testSuites={testSuites}
                testRunGroups={testRunGroups}
                tagSuggestions={tagSuggestions}
                initialTitle={createModalInitialTitle}
                initialGroupId={selectedGroupFilter !== 'all' && selectedGroupFilter !== 'ungrouped' ? selectedGroupFilter : undefined}
                initialSelectedCaseIds={preselectedCaseIds}
                teamSuggestions={runTeamSuggestions}
            />

            {/* Create/Edit Group Modal */}
            <CreateGroupModal
                isOpen={isCreateGroupModalOpen}
                onClose={() => {
                    setIsCreateGroupModalOpen(false);
                    setEditingGroup(undefined);
                }}
                onSubmit={editingGroup ? handleUpdateGroup : handleCreateGroup}
                initialData={editingGroup}
                allGroups={testRunGroups}
                mode={editingGroup ? 'edit' : 'create'}
            />

            {/* Delete Group Confirmation Modal */}
            <ConfirmationModal
                isOpen={isDeleteGroupModalOpen}
                onClose={() => {
                    setIsDeleteGroupModalOpen(false);
                    setDeleteGroupId(null);
                }}
                onConfirm={confirmDeleteGroup}
                title="Delete Run Group"
                message="Are you sure you want to delete this group? Test runs in this group will not be deleted but will be ungrouped."
                confirmText="Delete"
                isDestructive={true}
            />

            {/* Edit Test Run Modal */}
            <EditTestRunModal
                isOpen={isEditRunModalOpen}
                onClose={() => {
                    setIsEditRunModalOpen(false);
                    setEditingRun(null);
                }}
                testRun={editingRun}
                testRunGroups={testRunGroups}
                testCases={testCases}
                testSuites={testSuites}
                onSubmit={handleUpdateRun}
                tagSuggestions={tagSuggestions}
            />
        </div>
    );
};

export default TestRunsPage;
