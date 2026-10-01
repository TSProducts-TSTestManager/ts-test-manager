import { createWithEqualityFn } from 'zustand/traditional';
import { persist } from 'zustand/middleware';
import { ViewMode, TestCase, Project, TestSuite, Priority, Status, TestType, Tester, ProjectMemberRole, HistoryEntry, ProjectSettings, Ticket, TicketStatus as TicketStatusEnum, TicketPriority as TicketPriorityEnum, TicketSeverity as TicketSeverityEnum, TicketAttachment, ReturnReason as ReturnReasonEnum, FailureType as FailureTypeEnum, ArchiveScope } from '../types/testManager';
import * as testManagerApi from '../services/testManagerApi';
import * as ticketApi from '../services/ticketApi';
import { useAuthStore } from './authStore';
import { canWriteProject, canDeleteProject } from '../utils/projectRoles';
import { subtreeSuiteIds } from '../utils/suiteTree';
import {
    ProjectResponse,
    TestSuiteResponse,
    TestCaseResponse,
    CreateProjectRequest,
    UpdateProjectRequest,
    CreateTestSuiteRequest,
    UpdateTestSuiteRequest,
    MoveTestSuiteRequest,
    CreateTestCaseRequest,
    UpdateTestCaseRequest,
    TicketListResponse,
    CreateTicketRequest,
    UpdateTicketRequest,
} from '../types/api/testManager.api';

// Request deduplication to prevent duplicate concurrent API calls
const pendingRequests = new Map<string, Promise<unknown>>();

const deduplicateRequest = async <T>(
    key: string,
    requestFn: () => Promise<T>
): Promise<T> => {
    if (pendingRequests.has(key)) {
        return pendingRequests.get(key) as Promise<T>;
    }
    const promise = requestFn().finally(() => pendingRequests.delete(key));
    pendingRequests.set(key, promise);
    return promise;
};

export const READ_ONLY_ERROR = 'You have read-only access to this project';

/**
 * Client-side guard for store write actions. Throws (and records `error` state)
 * when the signed-in user is a viewer / non-member of the project.
 *
 * Deliberately **fails open** when the project id is missing or the project is
 * not loaded locally: the backend `requireProjectWrite` middleware is the real
 * enforcement point, and a false positive here would block legitimate editors.
 */
const assertCanWriteProject = (projectId?: string | null): void => {
    if (!projectId) return;
    const project = useTestManagerStore.getState().projects.find((p) => p.id === projectId);
    if (!project) return;
    const user = useAuthStore.getState().user;
    if (!canWriteProject(project, user)) {
        useTestManagerStore.setState({ error: READ_ONLY_ERROR });
        throw new Error(READ_ONLY_ERROR);
    }
};

const DELETE_FORBIDDEN_ERROR =
    'Only a client admin of this project can delete it';

export { DELETE_FORBIDDEN_ERROR };

/**
 * Project delete / restore / purge is a client-admin action, not a write.
 * Checked here as well as in the UI so no caller can reach the endpoint and
 * discover the rule from a 403.
 */
const assertCanDeleteProject = (projectId: string): void => {
    const project = useTestManagerStore.getState().projects.find((p) => p.id === projectId);
    if (!project) return;
    if (!canDeleteProject(project, useAuthStore.getState().user)) {
        useTestManagerStore.setState({ error: DELETE_FORBIDDEN_ERROR });
        throw new Error(DELETE_FORBIDDEN_ERROR);
    }
};

const assertCanWriteSuite = (suiteId?: string | null): void => {    assertCanWriteProject(
        useTestManagerStore.getState().testSuites.find((s) => s.id === suiteId)?.projectId
    );
};

const assertCanWriteCase = (caseId?: string | null): void => {
    assertCanWriteProject(
        useTestManagerStore.getState().testCases.find((c) => c.id === caseId)?.projectId
    );
};

/** Resolves the distinct projects behind a bulk selection, then checks each. */
const assertCanWriteCases = (ids: string[]): void => {
    const state = useTestManagerStore.getState();
    const projectIds = new Set<string>();
    for (const id of ids) {
        const testCase = state.testCases.find((c) => c.id === id);
        if (testCase?.projectId) projectIds.add(testCase.projectId);
    }
    for (const projectId of projectIds) assertCanWriteProject(projectId);
};

export interface TestCaseFilters {
    status: Status[];
    priority: Priority[];
    /** Empty = no test-type filter. Cases with no testType are matched by 'unset'. */
    testType: (TestType | 'unset')[];
    dateRange: {
        start: string | null;
        end: string | null;
    };
    createdAtRange: {
        start: string | null;
        end: string | null;
    };
}

const initialFilters: TestCaseFilters = {
    status: [],
    priority: [],
    testType: [],
    dateRange: { start: null, end: null },
    createdAtRange: { start: null, end: null },
};

// Helper to convert API response to frontend types
export const mapProjectResponse = (p: ProjectResponse): Project => ({
    id: p.id,
    displayId: p.displayId,
    seq: p.seq,
    clientId: p.clientId,
    name: p.name,
    description: p.description || '',
    color: p.color,
    ownerId: p.ownerId,
    deleted: p.deleted === true,
    deletedAt: p.deletedAt ?? null,
    members: p.members,
    stats: p.stats,
    jira: p.jira,
    updatedAt: p.updatedAt,
});

export const mapTestCaseResponse = (tc: TestCaseResponse): TestCase => ({
    id: tc.id,
    displayId: tc.displayId,
    title: tc.title,
    priority: tc.priority as Priority,
    status: tc.status as Status,
    testType: tc.testType as TestType | undefined,
    createdAt: tc.createdAt,
    lastModified: tc.lastModified,
    assignedTester: tc.assignedTester as Tester,
    steps: [], // Not used anymore, stepsContent is used
    stepsContent: tc.stepsContent,
    suite: tc.suite,
    suiteId: tc.suiteId,
    area: tc.area,
    expectedResult: tc.expectedResult,
    testDescription: tc.testDescription,
    comments: tc.comments,
    customFields: tc.customFields,
    history: tc.history?.map(h => ({
        id: h.id,
        timestamp: h.timestamp,
        user: h.user as Tester,
        snapshot: h.snapshot as Partial<TestCase>,
        changedFields: h.changedFields,
    })) as HistoryEntry[],
    projectId: tc.projectId,
    order: tc.order,
    archived: tc.archived === true,
    archivedAt: tc.archivedAt ?? null,
});

const mapTestSuiteResponse = (s: TestSuiteResponse): TestSuite => ({
    id: s.id,
    displayId: s.displayId,
    name: s.name,
    description: s.description,
    tags: s.tags || [],
    projectId: s.projectId,
    caseCount: s.caseCount,
    totalCaseCount: s.totalCaseCount ?? s.caseCount,
    parentId: s.parentId ?? null,
    depth: s.depth ?? 0,
    isFolder: s.isFolder === true,
    archived: s.archived === true,
    archivedAt: s.archivedAt ?? null,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
});

export const mapTicketResponse = (t: TicketListResponse): Ticket => ({
    id: t.id,
    displayId: t.displayId,
    title: t.title,
    description: t.description,
    projectId: t.projectId,
    archived: t.archived === true,
    archivedAt: t.archivedAt,
    status: t.status as TicketStatusEnum,
    priority: t.priority as unknown as TicketPriorityEnum,
    severity: t.severity as unknown as TicketSeverityEnum,
    assignedTo: t.assignedTo as Tester | undefined,
    createdBy: t.createdBy as Tester,
    relatedRunId: t.relatedRunId,
    relatedRunItemId: t.relatedRunItemId,
    failureType: t.failureType as FailureTypeEnum | undefined,
    team: t.team,
    environment: t.environment,
    buildVersion: t.buildVersion,
    failureAt: t.failureAt,
    firstReproducedAt: t.firstReproducedAt,
    returnedCount: t.returnedCount ?? 0,
    lastReturnedAt: t.lastReturnedAt,
    lastReturnReason: t.lastReturnReason as ReturnReasonEnum | undefined,
    divergence: t.divergence,
    attachments: (t.attachments as TicketAttachment[] | undefined) ?? [],
    tags: t.tags || [],
    jiraIssueKey: t.jiraIssueKey ?? null,
    jiraUrl: t.jiraUrl ?? null,
    jiraStatus: t.jiraStatus ?? null,
    jiraLastSyncAt: t.jiraLastSyncAt ?? null,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
});

const PROJECTS_PAGE_SIZE = 20;

const UNKNOWN_TESTER: Tester = {
    id: 'unknown',
    name: 'Unassigned',
    avatar: '',
};

interface TestManagerStore {
    // State
    viewMode: ViewMode;
    isRunDetailViewOpen: boolean;
    activeSuite: string | null;
    activeSuiteId: string | null;
    activeProject: string | null;
    activeArea: string | null;
    activeTestCaseId: string | null;
    testCases: TestCase[];
    projects: Project[];
    testSuites: TestSuite[];
    isLoading: boolean;
    error: string | null;
    projectSettings: Record<string, ProjectSettings>;

    // Filter State
    isFilterModalOpen: boolean;
    filters: TestCaseFilters;

    // View actions
    setViewMode: (mode: ViewMode) => void;
    setRunDetailViewOpen: (isOpen: boolean) => void;
    setActiveSuite: (suite: string | null) => void;
    setActiveSuiteId: (suiteId: string | null) => void;
    setActiveTestCaseId: (testCaseId: string | null) => void;
    setActiveProject: (projectId: string | null) => void;
    setActiveArea: (area: string | null) => void;
    setActiveSuiteWithId: (suiteId: string, suiteName: string) => void;
    clearActiveContext: () => void;
    clearError: () => void;

    // Filter Actions
    setFilters: (filters: Partial<TestCaseFilters>) => void;
    toggleFilterModal: (isOpen?: boolean) => void;
    clearFilters: () => void;

    // Search State
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    clearSearchQuery: () => void;

    // Export callback
    onExportTestCases: (() => void) | null;
    setExportTestCasesCallback: (callback: (() => void) | null) => void;

    // Import callback
    onImportTestCases: (() => void) | null;
    setImportTestCasesCallback: (callback: (() => void) | null) => void;

    /**
     * Registered by the Test Cases page so the shared toolbar (which lives in
     * the layout) can ask the current view to re-read from the server.
     */
    onRefreshTestCases: (() => Promise<void>) | null;
    setRefreshTestCasesCallback: (callback: (() => Promise<void>) | null) => void;

    /** Registered by the Test Runs page for the toolbar's Refresh. */
    onRefreshTestRuns: (() => Promise<void>) | null;
    setRefreshTestRunsCallback: (callback: (() => Promise<void>) | null) => void;

    /** Registered by the Tickets page; also re-syncs JIRA statuses. */
    onRefreshTickets: (() => Promise<void>) | null;
    setRefreshTicketsCallback: (callback: (() => Promise<void>) | null) => void;

    // Project pagination state
    projectsHasMore: boolean;
    projectsOffset: number;
    projectsTotal: number;
    isProjectsLoadingMore: boolean;
    /**
     * Server-side search term for the project list.
     *
     * Kept apart from the global `searchQuery` because other pages use that for
     * their own filtering, and a project fetch triggered from one of them must
     * not silently inherit their search text.
     */
    projectsSearch: string;
    setProjectsSearch: (search: string) => void;
    /**
     * Show soft-deleted projects instead of live ones. Only a client admin ever
     * gets rows back; for any other role the backend ignores the flag.
     */
    projectsShowDeleted: boolean;
    setProjectsShowDeleted: (show: boolean) => void;

    // Project actions
    fetchProjects: () => Promise<void>;
    fetchMoreProjects: () => Promise<void>;
    /** Load a single project (with members) when it is not in the loaded list */
    ensureProjectLoaded: (projectId: string) => Promise<void>;
    createProject: (data: CreateProjectRequest) => Promise<Project>;
    updateProject: (id: string, data: UpdateProjectRequest) => Promise<Project>;
    /** Soft-delete a project. Client admin of the project's client only. */
    deleteProject: (id: string) => Promise<void>;
    /** Bring a soft-deleted project back. Client admin of its client only. */
    restoreProject: (id: string) => Promise<Project>;
    /** Irreversibly remove a project and its content. Client admin only. */
    purgeProject: (id: string) => Promise<void>;
    addProjectMember: (projectId: string, userIds: string[], role?: ProjectMemberRole) => Promise<Project>;
    removeProjectMember: (projectId: string, memberId: string) => Promise<Project>;
    updateMemberRole: (projectId: string, memberId: string, role: ProjectMemberRole) => Promise<Project>;
    
    // Project Settings actions
    fetchProjectSettings: (projectId: string) => Promise<ProjectSettings>;
    updateProjectSettings: (projectId: string, settings: ProjectSettings) => Promise<ProjectSettings>;
    getProjectSettings: (projectId: string) => ProjectSettings;

    // Test Suite actions
    fetchTestSuites: (projectId: string, scope?: ArchiveScope) => Promise<void>;
    createTestSuite: (projectId: string, data: CreateTestSuiteRequest) => Promise<TestSuite>;
    updateTestSuite: (id: string, data: UpdateTestSuiteRequest) => Promise<TestSuite>;
    moveTestSuite: (id: string, data: MoveTestSuiteRequest) => Promise<TestSuite>;
    deleteTestSuite: (id: string) => Promise<void>;
    archiveTestSuite: (id: string) => Promise<void>;
    restoreTestSuite: (id: string) => Promise<void>;

    // Test Case actions
    fetchTestCases: (suiteId: string, scope?: ArchiveScope) => Promise<void>;
    fetchTestCasesByProject: (projectId: string, scope?: ArchiveScope) => Promise<void>;
    createTestCase: (suiteId: string, data: CreateTestCaseRequest) => Promise<TestCase>;
    updateTestCase: (id: string, data: UpdateTestCaseRequest) => Promise<TestCase>;
    cloneTestCase: (id: string) => Promise<TestCase>;
    deleteTestCase: (id: string) => Promise<void>;
    archiveTestCase: (id: string) => Promise<void>;
    restoreTestCase: (id: string) => Promise<void>;
    bulkArchiveTestCases: (ids: string[], archived: boolean) => Promise<void>;
    bulkUpdateStatus: (ids: string[], status: Status) => Promise<void>;

    // Selection State
    isSelectionMode: boolean;
    selectedTestCaseIds: string[];

    // Selection Actions
    setSelectionMode: (enabled: boolean) => void;
    toggleTestCaseSelection: (id: string) => void;
    selectAllTestCases: (ids: string[]) => void;
    clearSelection: () => void;
    bulkDeleteTestCases: (ids: string[]) => Promise<void>;

    // Legacy local state actions (for optimistic updates)
    // Support both direct values and functional updaters for proper deduplication
    setTestCases: (casesOrUpdater: TestCase[] | ((current: TestCase[]) => TestCase[])) => void;
    setTestSuites: (suitesOrUpdater: TestSuite[] | ((current: TestSuite[]) => TestSuite[])) => void;
    addTestCase: (testCase: TestCase) => void;
    updateTestCaseLocal: (testCase: TestCase) => void;
    deleteTestCaseLocal: (id: string) => void;
    updateProjectLocal: (project: Project) => void;
    updateProjectSettingsLocal: (projectId: string, settings: ProjectSettings) => void;
    deleteProjectLocal: (projectId: string) => void;
    setProjects: (projects: Project[]) => void;
    addProject: (project: Project) => void;

    // Ticket State
    tickets: Ticket[];
    ticketsTotal: number;
    isTicketDetailViewOpen: boolean;
    activeTicket: Ticket | null;
    ticketView: 'list' | 'kanban';

    // Ticket Actions
    fetchTickets: (projectId: string) => Promise<void>;
    createTicket: (projectId: string, data: CreateTicketRequest) => Promise<Ticket>;
    updateTicket: (projectId: string, id: string, data: UpdateTicketRequest) => Promise<Ticket>;
    updateTicketStatus: (projectId: string, id: string, status: TicketStatusEnum) => Promise<Ticket>;
    markTicketReproduced: (projectId: string, id: string) => Promise<Ticket>;
    returnTicketForInfo: (projectId: string, id: string, reason: ReturnReasonEnum) => Promise<Ticket>;
    deleteTicket: (projectId: string, id: string) => Promise<void>;
    archiveTicket: (projectId: string, id: string) => Promise<Ticket>;
    restoreTicket: (projectId: string, id: string) => Promise<Ticket>;
    setTicketView: (view: 'list' | 'kanban') => void;
    setActiveTicket: (ticket: Ticket | null) => void;
    setTicketDetailViewOpen: (isOpen: boolean) => void;
    setTicketsTotal: (total: number) => void;
    applyRemoteTicketCreate: (ticket: Ticket) => void;
    applyRemoteTicketUpdate: (ticket: Ticket) => void;
    removeTicketLocal: (ticketId: string) => void;
}

export const useTestManagerStore = createWithEqualityFn<TestManagerStore>()(
    persist(
        (set, get) => ({
            // Initial state
            viewMode: 'projects' as ViewMode,
            isRunDetailViewOpen: false,
            activeSuite: null as string | null,
            activeSuiteId: null as string | null,
            activeProject: null as string | null,
            activeArea: null as string | null,
            activeTestCaseId: null as string | null,
            testCases: [] as TestCase[],
            projects: [] as Project[],
    projectsHasMore: false,
    projectsOffset: 0,
    projectsTotal: 0,
    isProjectsLoadingMore: false,
    projectsSearch: '',
    setProjectsSearch: (search: string) => set({ projectsSearch: search }),
    projectsShowDeleted: false,
    setProjectsShowDeleted: (show: boolean) => set({ projectsShowDeleted: show }),
            testSuites: [] as TestSuite[],
            isLoading: false,
            error: null as string | null,
            projectSettings: {} as Record<string, ProjectSettings>,

            // Ticket State
            tickets: [] as Ticket[],
            ticketsTotal: 0,
            isTicketDetailViewOpen: false,
            activeTicket: null as Ticket | null,
            ticketView: 'list' as 'list' | 'kanban',

            // Filter State
            isFilterModalOpen: false,
            filters: initialFilters,

            // View actions
            setViewMode: (mode) => set({ viewMode: mode }),
            setRunDetailViewOpen: (isOpen) => set({ isRunDetailViewOpen: isOpen }),
            setActiveSuite: (suite) => set({ activeSuite: suite }),
            setActiveSuiteId: (suiteId) => set({ activeSuiteId: suiteId }),
            setActiveTestCaseId: (testCaseId) => set({ activeTestCaseId: testCaseId }),
            setActiveProject: (projectId) => set({ activeProject: projectId, testSuites: [], testCases: [], tickets: [], activeArea: null }),
            setActiveArea: (area) => set({ activeArea: area }),
            setActiveSuiteWithId: (suiteId, suiteName) => set({ activeSuiteId: suiteId, activeSuite: suiteName }),
            clearActiveContext: () => set({ activeSuite: null, activeSuiteId: null, activeProject: null, activeArea: null, activeTestCaseId: null }),
            clearError: () => set({ error: null }),

            // Filter Actions
            setFilters: (newFilters) => set((state) => ({
                filters: { ...state.filters, ...newFilters }
            })),
            toggleFilterModal: (isOpen) => set((state) => ({
                isFilterModalOpen: isOpen !== undefined ? isOpen : !state.isFilterModalOpen
            })),
            clearFilters: () => set({ filters: initialFilters }),

            // Search Actions
            searchQuery: '' as string,
            setSearchQuery: (query) => set({ searchQuery: query }),
            clearSearchQuery: () => set({ searchQuery: '' }),

            // Export callback
            onExportTestCases: null,
            setExportTestCasesCallback: (callback) => set({ onExportTestCases: callback }),

            // Import callback
    onImportTestCases: null,
    setImportTestCasesCallback: (callback) => set({ onImportTestCases: callback }),

    onRefreshTestCases: null,
    setRefreshTestCasesCallback: (callback) => set({ onRefreshTestCases: callback }),

    onRefreshTestRuns: null,
    setRefreshTestRunsCallback: (callback) => set({ onRefreshTestRuns: callback }),

    onRefreshTickets: null,
    setRefreshTicketsCallback: (callback) => set({ onRefreshTickets: callback }),

            // Selection Actions
            isSelectionMode: false,
            selectedTestCaseIds: [] as string[],
            setSelectionMode: (enabled) => set({ isSelectionMode: enabled, selectedTestCaseIds: [] }),
            toggleTestCaseSelection: (id) => set((state) => {
                const isSelected = state.selectedTestCaseIds.includes(id);
                return {
                    selectedTestCaseIds: isSelected
                        ? state.selectedTestCaseIds.filter(tid => tid !== id)
                        : [...state.selectedTestCaseIds, id]
                };
            }),
            selectAllTestCases: (ids) => set({ selectedTestCaseIds: ids }),
            clearSelection: () => set({ selectedTestCaseIds: [] }),
            bulkDeleteTestCases: async (ids) => {
                assertCanWriteCases(ids);
                set({ isLoading: true, error: null });
                try {
                    await testManagerApi.bulkDeleteTestCases(ids);
                    set((state) => ({
                        testCases: state.testCases.filter((tc) => !ids.includes(tc.id)),
                        selectedTestCaseIds: [],
                        isSelectionMode: false,
                        isLoading: false,
                    }));
                } catch (error: unknown) {
                    set({ error: (error as Error).message, isLoading: false });
                    throw error;
                }
            },

            // =========================================================================
            // PROJECT ACTIONS
            // =========================================================================
            fetchProjects: async () => {
                const search = get().projectsSearch.trim();
                const deleted = get().projectsShowDeleted;
                try {
                    const result = await deduplicateRequest(`projects:${deleted ? 'deleted' : 'live'}:${search}`, async () => {
                        set({ isLoading: true, error: null });
                        const response = await testManagerApi.getProjectsPaginated({
                            limit: PROJECTS_PAGE_SIZE,
                            offset: 0,
                            search: search || undefined,
                            deleted,
                        });
                        return {
                            items: response.items.map(mapProjectResponse),
                            meta: response.meta,
                        };
                    });
                    set({
                        projects: result.items,
                        projectsOffset: result.items.length,
                        projectsTotal: result.meta.total,
                        projectsHasMore: result.meta.hasMore,
                        isLoading: false,
                    });
                } catch (error: unknown) {
                    set({ error: (error as Error).message, isLoading: false });
                }
            },

            fetchMoreProjects: async () => {
                const { projectsHasMore, isProjectsLoadingMore, projectsOffset, projectsSearch, projectsShowDeleted } = get();
                if (!projectsHasMore || isProjectsLoadingMore) return;

                const search = projectsSearch.trim();
                set({ isProjectsLoadingMore: true });
                try {
                    const response = await testManagerApi.getProjectsPaginated({
                        limit: PROJECTS_PAGE_SIZE,
                        offset: projectsOffset,
                        search: search || undefined,
                        deleted: projectsShowDeleted,
                    });
                    const mapped = response.items.map(mapProjectResponse);

                    set((state) => {
                        const existingIds = new Set(state.projects.map((p) => p.id));
                        const dedupedIncoming = mapped.filter((p) => !existingIds.has(p.id));
                        const totalLoaded = state.projects.length + dedupedIncoming.length;
                        return {
                            projects: [...state.projects, ...dedupedIncoming],
                            projectsOffset: totalLoaded,
                            projectsTotal: response.meta.total,
                            projectsHasMore: response.meta.hasMore && totalLoaded < response.meta.total,
                            isProjectsLoadingMore: false,
                        };
                    });
                } catch (error: unknown) {
                    set({ error: (error as Error).message, isProjectsLoadingMore: false });
                }
            },

            ensureProjectLoaded: async (projectId) => {
                if (!projectId) return;
                if (get().projects.some((p) => p.id === projectId)) return;
                try {
                    const response = await testManagerApi.getProject(projectId);
                    const project = mapProjectResponse(response);
                    set((state) => ({
                        projects: state.projects.some((p) => p.id === project.id)
                            ? state.projects
                            : [project, ...state.projects],
                    }));
                } catch (error: unknown) {
                    set({ error: (error as Error).message });
                }
            },

            createProject: async (data) => {
                set({ isLoading: true, error: null });
                const previousProjects = get().projects;
                const optimisticProject: Project = {
                    id: `temp-project-${Date.now()}`,
                    name: data.name,
                    description: data.description || '',
                    color: data.color || '#3B82F6',
                    ownerId: '',
                    members: [],
                    stats: {
                        suites: 0,
                        cases: 0,
                        members: 1,
                    },
                    updatedAt: new Date().toISOString(),
                };

                set({ projects: [optimisticProject, ...previousProjects] });

                try {
                    const response = await testManagerApi.createProject(data);
                    const project = mapProjectResponse(response);
                    set((state) => ({
                        projects: state.projects.map((p) =>
                            p.id === optimisticProject.id ? project : p
                        ),
                        isLoading: false,
                    }));
                    return project;
                } catch (error: unknown) {
                    set({
                        projects: previousProjects,
                        error: (error as Error).message,
                        isLoading: false,
                    });
                    throw error;
                }
            },

            updateProject: async (id, data) => {
                assertCanWriteProject(id);
                set({ isLoading: true, error: null });
                const previousProjects = get().projects;
                set((state) => ({
                    projects: state.projects.map((p) =>
                        p.id === id
                            ? {
                                ...p,
                                ...data,
                                updatedAt: new Date().toISOString(),
                            }
                            : p
                    ),
                }));

                try {
                    const response = await testManagerApi.updateProject(id, data);
                    const project = mapProjectResponse(response);
                    set((state) => ({
                        projects: state.projects.map((p) => (p.id === id ? project : p)),
                        isLoading: false,
                    }));
                    return project;
                } catch (error: unknown) {
                    set({
                        projects: previousProjects,
                        error: (error as Error).message,
                        isLoading: false,
                    });
                    throw error;
                }
            },

            /**
             * Soft-delete a project (client admin of its client only).
             *
             * The project leaves the live list because the backend now hides it
             * from everyone, not because the data is gone — a client admin can
             * restore it from the Deleted view.
             */
            deleteProject: async (id) => {
                assertCanDeleteProject(id);
                set({ isLoading: true, error: null });
                const previousState = get();
                const wasActive = previousState.activeProject === id;
                set((state) => ({
                    projects: state.projects.filter((p) => p.id !== id),
                    activeProject: wasActive ? null : state.activeProject,
                    activeSuite: wasActive ? null : state.activeSuite,
                    activeSuiteId: wasActive ? null : state.activeSuiteId,
                    testSuites: wasActive ? [] : state.testSuites,
                    testCases: wasActive ? [] : state.testCases,
                }));

                try {
                    await testManagerApi.deleteProject(id);
                    set({ isLoading: false });
                } catch (error: unknown) {
                    set({
                        projects: previousState.projects,
                        activeProject: previousState.activeProject,
                        activeSuite: previousState.activeSuite,
                        activeSuiteId: previousState.activeSuiteId,
                        testSuites: previousState.testSuites,
                        testCases: previousState.testCases,
                        error: (error as Error).message,
                        isLoading: false,
                    });
                    throw error;
                }
            },

            /**
             * Restore a soft-deleted project, putting the whole project back
             * live. The project is not in `projects` (it was hidden), so the row
             * is fetched again rather than patched from the deleted copy.
             */
            restoreProject: async (id) => {
                assertCanDeleteProject(id);
                set({ isLoading: true, error: null });
                try {
                    await testManagerApi.restoreProject(id);
                    const response = await testManagerApi.getProject(id);
                    const project = mapProjectResponse(response);
                    set((state) => ({
                        projects: [project, ...state.projects.filter((p) => p.id !== id)],
                        isLoading: false,
                    }));
                    return project;
                } catch (error: unknown) {
                    set({ error: (error as Error).message, isLoading: false });
                    throw error;
                }
            },

            /**
             * Irreversibly remove a project and its content. Kept apart from
             * `deleteProject` so the destructive path is always explicit.
             */
            purgeProject: async (id) => {
                assertCanDeleteProject(id);
                set({ isLoading: true, error: null });
                const previousState = get();
                const wasActive = previousState.activeProject === id;
                set((state) => ({
                    projects: state.projects.filter((p) => p.id !== id),
                    activeProject: wasActive ? null : state.activeProject,
                    activeSuite: wasActive ? null : state.activeSuite,
                    activeSuiteId: wasActive ? null : state.activeSuiteId,
                    testSuites: wasActive ? [] : state.testSuites,
                    testCases: wasActive ? [] : state.testCases,
                }));

                try {
                    await testManagerApi.purgeProject(id);
                    set({ isLoading: false });
                } catch (error: unknown) {
                    set({
                        projects: previousState.projects,
                        activeProject: previousState.activeProject,
                        activeSuite: previousState.activeSuite,
                        activeSuiteId: previousState.activeSuiteId,
                        testSuites: previousState.testSuites,
                        testCases: previousState.testCases,
                        error: (error as Error).message,
                        isLoading: false,
                    });
                    throw error;
                }
            },

            addProjectMember: async (projectId, userIds, role) => {
                assertCanWriteProject(projectId);
                set({ isLoading: true, error: null });
                try {
                    const response = await testManagerApi.assignProjectMembers(projectId, { userIds, role });
                    const project = mapProjectResponse(response);
                    set((state) => ({
                        projects: state.projects.map((p) => (p.id === projectId ? project : p)),
                        isLoading: false,
                    }));
                    return project;
                } catch (error: unknown) {
                    set({ error: (error as Error).message, isLoading: false });
                    throw error;
                }
            },

            updateMemberRole: async (projectId, memberId, role) => {
                assertCanWriteProject(projectId);
                set({ isLoading: true, error: null });
                try {
                    const response = await testManagerApi.updateProjectMemberRole(projectId, memberId, role);
                    const project = mapProjectResponse(response);
                    set((state) => ({
                        projects: state.projects.map((p) => (p.id === projectId ? project : p)),
                        isLoading: false,
                    }));
                    return project;
                } catch (error: unknown) {
                    set({ error: (error as Error).message, isLoading: false });
                    throw error;
                }
            },

            removeProjectMember: async (projectId, memberId) => {
                assertCanWriteProject(projectId);
                set({ isLoading: true, error: null });
                try {
                    const response = await testManagerApi.removeProjectMember(projectId, memberId);
                    const project = mapProjectResponse(response);
                    set((state) => ({
                        projects: state.projects.map((p) => (p.id === projectId ? project : p)),
                        isLoading: false,
                    }));
                    return project;
                } catch (error: unknown) {
                    set({ error: (error as Error).message, isLoading: false });
                    throw error;
                }
            },

            // =========================================================================
            // PROJECT SETTINGS ACTIONS
            // =========================================================================
            fetchProjectSettings: async (projectId) => {
                try {
                    const settings = await deduplicateRequest(`projectSettings:${projectId}`, async () => {
                        const result = await testManagerApi.getProjectSettings(projectId);
                        set((state) => ({
                            projectSettings: { ...state.projectSettings, [projectId]: result }
                        }));
                        return result;
                    });
                    return settings;
                } catch (error: unknown) {
                    console.error('Error fetching project settings:', error);
                    throw error;
                }
            },

            updateProjectSettings: async (projectId, settings) => {
                assertCanWriteProject(projectId);
                try {
                    const updatedSettings = await testManagerApi.updateProjectSettings(projectId, settings);
                    set((state) => ({
                        projectSettings: { ...state.projectSettings, [projectId]: updatedSettings }
                    }));
                    return updatedSettings;
                } catch (error: unknown) {
                    console.error('Error updating project settings:', error);
                    throw error;
                }
            },

            getProjectSettings: (projectId: string) => {
                const state = get();
                return state.projectSettings[projectId] || { testCases: { customFields: [], table: { visibleCustomFieldIds: [] } } };
            },

            // =========================================================================
            // TEST SUITE ACTIONS
            // =========================================================================
            fetchTestSuites: async (projectId: string, scope?: ArchiveScope) => {
                try {
                    // The scope is part of the dedup key: switching to the
                    // archived view must not reuse the in-flight active fetch.
                    const testSuites = await deduplicateRequest(
                        `testSuites:${projectId}:${scope ?? 'active'}`,
                        async () => {
                            set({ isLoading: true, error: null });
                            const response = await testManagerApi.getTestSuites(projectId, { archived: scope });
                            return response.map(mapTestSuiteResponse);
                        }
                    );
                    set({ testSuites, isLoading: false });
                } catch (error: unknown) {
                    set({ error: (error as Error).message, isLoading: false });
                }
            },

            createTestSuite: async (projectId: string, data: CreateTestSuiteRequest) => {
                assertCanWriteProject(projectId);
                set({ isLoading: true, error: null });
                const previousSuites = get().testSuites;
                const nowIso = new Date().toISOString();
                const optimisticSuite: TestSuite = {
                    id: `temp-suite-${Date.now()}`,
                    name: data.name,
                    description: data.description,
                    tags: data.tags || [],
                    projectId,
                    parentId: data.parentId ?? null,
                    // The server owns the real depth; a temp row only needs to
                    // land in the right place in the tree while it is in flight.
                    depth: 0,
                    isFolder: data.isFolder === true,
                    caseCount: 0,
                    totalCaseCount: 0,
                    createdAt: nowIso,
                    updatedAt: nowIso,
                    archived: false,
                };

                set({ testSuites: [optimisticSuite, ...previousSuites] });

                try {
                    const response = await testManagerApi.createTestSuite(projectId, data);
                    const suite = mapTestSuiteResponse(response);
                    set((state) => ({
                        testSuites: state.testSuites.map((s) =>
                            s.id === optimisticSuite.id ? suite : s
                        ),
                        isLoading: false,
                    }));
                    return suite;
                } catch (error: unknown) {
                    set({
                        testSuites: previousSuites,
                        error: (error as Error).message,
                        isLoading: false,
                    });
                    throw error;
                }
            },

            updateTestSuite: async (id: string, data: UpdateTestSuiteRequest) => {
                assertCanWriteSuite(id);
                set({ isLoading: true, error: null });
                const previousSuites = get().testSuites;
                set((state) => ({
                    testSuites: state.testSuites.map((s) =>
                        s.id === id
                            ? {
                                ...s,
                                ...data,
                                updatedAt: new Date().toISOString(),
                            }
                            : s
                    ),
                }));

                try {
                    const response = await testManagerApi.updateTestSuite(id, data);
                    const suite = mapTestSuiteResponse(response);
                    set((state) => ({
                        testSuites: state.testSuites.map((s) => (s.id === id ? suite : s)),
                        isLoading: false,
                    }));
                    return suite;
                } catch (error: unknown) {
                    set({
                        testSuites: previousSuites,
                        error: (error as Error).message,
                        isLoading: false,
                    });
                    throw error;
                }
            },

            moveTestSuite: async (id: string, data: MoveTestSuiteRequest) => {
                assertCanWriteSuite(id);
                set({ isLoading: true, error: null });
                const previousSuites = get().testSuites;
                try {
                    const response = await testManagerApi.moveTestSuite(id, data);
                    const suite = mapTestSuiteResponse(response);
                    // A move re-bases every depth below the node, so the whole
                    // list is refreshed by the caller; the node itself is
                    // updated here so the tree does not wait for that round trip.
                    set((state) => ({
                        testSuites: state.testSuites.map((s) => (s.id === id ? suite : s)),
                        isLoading: false,
                    }));
                    return suite;
                } catch (error: unknown) {
                    set({
                        testSuites: previousSuites,
                        error: (error as Error).message,
                        isLoading: false,
                    });
                    throw error;
                }
            },

            deleteTestSuite: async (id: string) => {
                assertCanWriteSuite(id);
                set({ isLoading: true, error: null });
                const previousSuites = get().testSuites;
                const previousTestCases = get().testCases;
                // Deleting a folder deletes every folder beneath it, so the
                // optimistic removal has to cover the whole subtree.
                const doomed = new Set(subtreeSuiteIds(previousSuites, id));
                set((state) => ({
                    testSuites: state.testSuites.filter((s) => !doomed.has(s.id)),
                    testCases: state.testCases.filter((tc) => !tc.suiteId || !doomed.has(tc.suiteId)),
                    activeSuiteId: state.activeSuiteId && doomed.has(state.activeSuiteId) ? null : state.activeSuiteId,
                    activeSuite: state.activeSuiteId && doomed.has(state.activeSuiteId) ? null : state.activeSuite,
                }));

                try {
                    await testManagerApi.deleteTestSuite(id);
                    set({ isLoading: false });
                } catch (error: unknown) {
                    set({
                        testSuites: previousSuites,
                        testCases: previousTestCases,
                        error: (error as Error).message,
                        isLoading: false,
                    });
                    throw error;
                }
            },

            archiveTestSuite: async (id: string) => {
                assertCanWriteSuite(id);
                set({ isLoading: true, error: null });
                const previousSuites = get().testSuites;
                const previousTestCases = get().testCases;

                // Archiving a folder archives its sub-folders and every case
                // below it, so both lists drop the whole subtree optimistically.
                const doomed = new Set(subtreeSuiteIds(previousSuites, id));
                set((state) => ({
                    testSuites: state.testSuites.filter((s) => !doomed.has(s.id)),
                    testCases: state.testCases.filter((tc) => !tc.suiteId || !doomed.has(tc.suiteId)),
                    activeSuiteId: state.activeSuiteId && doomed.has(state.activeSuiteId) ? null : state.activeSuiteId,
                    activeSuite: state.activeSuiteId && doomed.has(state.activeSuiteId) ? null : state.activeSuite,
                    isLoading: false,
                }));

                try {
                    await testManagerApi.archiveTestSuite(id);
                } catch (error: unknown) {
                    set({
                        testSuites: previousSuites,
                        testCases: previousTestCases,
                        error: (error as Error).message,
                    });
                    throw error;
                }
            },

            restoreTestSuite: async (id: string) => {
                assertCanWriteSuite(id);
                set({ isLoading: true, error: null });
                const previousSuites = get().testSuites;

                try {
                    const response = await testManagerApi.restoreTestSuite(id);
                    const suite = mapTestSuiteResponse(response);
                    // A restored suite belongs in the active list; the archived
                    // view is refreshed separately by its own page effect.
                    set((state) => ({
                        testSuites: state.testSuites.some((s) => s.id === id)
                            ? state.testSuites.map((s) => (s.id === id ? suite : s))
                            : [suite, ...state.testSuites],
                        isLoading: false,
                    }));
                } catch (error: unknown) {
                    set({
                        testSuites: previousSuites,
                        error: (error as Error).message,
                        isLoading: false,
                    });
                    throw error;
                }
            },

            // =========================================================================
            // TEST CASE ACTIONS
            // =========================================================================
            fetchTestCases: async (suiteId: string, scope?: ArchiveScope) => {
                try {
                    const testCases = await deduplicateRequest(
                        `testCases:${suiteId}:${scope ?? 'active'}`,
                        async () => {
                            set({ isLoading: true, error: null });
                            const response = await testManagerApi.getTestCases(suiteId, { archived: scope });
                            return response.map(mapTestCaseResponse);
                        }
                    );
                    set({ testCases, isLoading: false });
                } catch (error: unknown) {
                    set({ error: (error as Error).message, isLoading: false });
                }
            },

            fetchTestCasesByProject: async (projectId: string, scope?: ArchiveScope) => {
                try {
                    const testCases = await deduplicateRequest(
                        `testCasesByProject:${projectId}:${scope ?? 'active'}`,
                        async () => {
                            set({ isLoading: true, error: null });
                            const response = await testManagerApi.getTestCasesByProject(projectId, { archived: scope });
                            return response.map(mapTestCaseResponse);
                        }
                    );
                    set({ testCases, isLoading: false });
                } catch (error: unknown) {
                    set({ error: (error as Error).message, isLoading: false });
                }
            },

            createTestCase: async (suiteId: string, data: CreateTestCaseRequest) => {
                assertCanWriteSuite(suiteId);
                set({ isLoading: true, error: null });
                const state = get();
                const previousTestCases = state.testCases;
                const suite = state.testSuites.find((s) => s.id === suiteId);
                const fallbackTester = state.testCases.find((tc) => tc.assignedTester)?.assignedTester || UNKNOWN_TESTER;
                const nowIso = new Date().toISOString();
                const optimisticTestCase: TestCase = {
                    id: `temp-testcase-${Date.now()}`,
                    title: data.title,
                    priority: (data.priority as Priority) || Priority.Medium,
                    status: (data.status as Status) || Status.Draft,
                    createdAt: nowIso,
                    lastModified: nowIso,
                    assignedTester: fallbackTester,
                    steps: [],
                    stepsContent: data.stepsContent,
                    suite: suite?.name || 'Unknown Suite',
                    suiteId,
                    area: data.area,
                    expectedResult: data.expectedResult,
                    testDescription: data.testDescription,
                    comments: data.comments,
                    customFields: data.customFields,
                    history: [],
                    projectId: suite?.projectId || state.activeProject || '',
                    order: state.testCases.length + 1,
                };

                set({
                    testCases: previousTestCases.some((tc) => tc.id === optimisticTestCase.id)
                        ? previousTestCases
                        : [optimisticTestCase, ...previousTestCases],
                });

                try {
                    const response = await testManagerApi.createTestCase(suiteId, data);
                    const testCase = mapTestCaseResponse(response);
                    set((state) => ({
                        testCases: state.testCases
                            .map((tc) => (tc.id === optimisticTestCase.id ? testCase : tc))
                            .filter((tc, index, arr) => arr.findIndex((item) => item.id === tc.id) === index),
                        isLoading: false,
                    }));
                    return testCase;
                } catch (error: unknown) {
                    set({
                        testCases: previousTestCases,
                        error: (error as Error).message,
                        isLoading: false,
                    });
                    throw error;
                }
            },

            updateTestCase: async (id: string, data: UpdateTestCaseRequest) => {
                assertCanWriteCase(id);
                set({ isLoading: true, error: null });
                const previousTestCases = get().testCases;
                set((state) => ({
                    testCases: state.testCases.map((tc) => {
                        if (tc.id !== id) {
                            return tc;
                        }

                        return {
                            ...tc,
                            ...(data.title !== undefined ? { title: data.title } : {}),
                            ...(data.priority !== undefined ? { priority: data.priority as Priority } : {}),
                            ...(data.status !== undefined ? { status: data.status as Status } : {}),
                            ...(data.area !== undefined ? { area: data.area } : {}),
                            ...(data.expectedResult !== undefined ? { expectedResult: data.expectedResult } : {}),
                            ...(data.testDescription !== undefined ? { testDescription: data.testDescription } : {}),
                            ...(data.stepsContent !== undefined ? { stepsContent: data.stepsContent } : {}),
                            ...(data.comments !== undefined ? { comments: data.comments } : {}),
                            ...(data.customFields !== undefined ? { customFields: data.customFields } : {}),
                            lastModified: new Date().toISOString(),
                        };
                    }),
                }));

                try {
                    const response = await testManagerApi.updateTestCase(id, data);
                    const testCase = mapTestCaseResponse(response);
                    set((state) => ({
                        testCases: state.testCases.map((tc) => (tc.id === id ? testCase : tc)),
                        isLoading: false,
                    }));
                    return testCase;
                } catch (error: unknown) {
                    set({
                        testCases: previousTestCases,
                        error: (error as Error).message,
                        isLoading: false,
                    });
                    throw error;
                }
            },

            cloneTestCase: async (id: string) => {
                assertCanWriteCase(id);
                set({ isLoading: true, error: null });
                try {
                    const response = await testManagerApi.cloneTestCase(id);
                    const clonedTestCase = mapTestCaseResponse(response);
                    set((state) => {
                        const originalIndex = state.testCases.findIndex(tc => tc.id === id);
                        const newTestCases = [...state.testCases];
                        newTestCases.splice(originalIndex + 1, 0, clonedTestCase);
                        return {
                            testCases: newTestCases,
                            isLoading: false,
                        };
                    });
                    return clonedTestCase;
                } catch (error: unknown) {
                    set({ error: (error as Error).message, isLoading: false });
                    throw error;
                }
            },

            deleteTestCase: async (id: string) => {
                assertCanWriteCase(id);
                set({ isLoading: true, error: null });
                const previousTestCases = get().testCases;
                set({
                    testCases: previousTestCases.filter((tc) => tc.id !== id),
                });

                try {
                    await testManagerApi.deleteTestCase(id);
                    set({ isLoading: false });
                } catch (error: unknown) {
                    set({
                        testCases: previousTestCases,
                        error: (error as Error).message,
                        isLoading: false,
                    });
                    throw error;
                }
            },

            archiveTestCase: async (id: string) => {
                assertCanWriteCase(id);
                set({ isLoading: true, error: null });
                const previousTestCases = get().testCases;
                set({ testCases: previousTestCases.filter((tc) => tc.id !== id) });

                try {
                    await testManagerApi.archiveTestCase(id);
                    set({ isLoading: false });
                } catch (error: unknown) {
                    set({
                        testCases: previousTestCases,
                        error: (error as Error).message,
                        isLoading: false,
                    });
                    throw error;
                }
            },

            restoreTestCase: async (id: string) => {
                assertCanWriteCase(id);
                set({ isLoading: true, error: null });
                const previousTestCases = get().testCases;

                try {
                    const response = await testManagerApi.restoreTestCase(id);
                    const testCase = mapTestCaseResponse(response);
                    set((state) => ({
                        testCases: state.testCases.some((tc) => tc.id === id)
                            ? state.testCases.map((tc) => (tc.id === id ? testCase : tc))
                            : [testCase, ...state.testCases],
                        isLoading: false,
                    }));
                } catch (error: unknown) {
                    set({
                        testCases: previousTestCases,
                        error: (error as Error).message,
                        isLoading: false,
                    });
                    throw error;
                }
            },

            bulkArchiveTestCases: async (ids: string[], archived: boolean) => {
                assertCanWriteCases(ids);
                set({ isLoading: true, error: null });
                const previousTestCases = get().testCases;
                // Optimistic: the selection leaves (or enters) the visible list
                // in one shot rather than awaiting a per-row refresh.
                set({
                    testCases: previousTestCases.filter((tc) =>
                        archived ? !ids.includes(tc.id) : true
                    ),
                });

                try {
                    await testManagerApi.bulkArchiveTestCases(ids, archived);
                    set({ isLoading: false });
                } catch (error: unknown) {
                    set({
                        testCases: previousTestCases,
                        error: (error as Error).message,
                        isLoading: false,
                    });
                    throw error;
                }
            },

            bulkUpdateStatus: async (ids: string[], status: Status) => {
                assertCanWriteCases(ids);
                set({ isLoading: true, error: null });
                try {
                    await testManagerApi.bulkUpdateStatus(ids, status);
                    set((state) => ({
                        testCases: state.testCases.map((tc) =>
                            ids.includes(tc.id) ? { ...tc, status } : tc
                        ),
                        isLoading: false,
                    }));
                } catch (error: unknown) {
                    set({ error: (error as Error).message, isLoading: false });
                    throw error;
                }
            },

            // =========================================================================
            // LOCAL STATE ACTIONS (for optimistic updates and legacy support)
            // =========================================================================
            setTestCases: (casesOrUpdater: TestCase[] | ((current: TestCase[]) => TestCase[])) => {
                if (typeof casesOrUpdater === 'function') {
                    set((state) => ({ testCases: casesOrUpdater(state.testCases) }));
                } else {
                    set({ testCases: casesOrUpdater });
                }
            },
            setTestSuites: (suitesOrUpdater: TestSuite[] | ((current: TestSuite[]) => TestSuite[])) => {
                if (typeof suitesOrUpdater === 'function') {
                    set((state) => ({ testSuites: suitesOrUpdater(state.testSuites) }));
                } else {
                    set({ testSuites: suitesOrUpdater });
                }
            },
            addTestCase: (testCase: TestCase) => set((state) => ({ testCases: [testCase, ...state.testCases] })),
            updateTestCaseLocal: (updatedCase: TestCase) => set((state) => ({
                testCases: state.testCases.map((c) => (c.id === updatedCase.id ? updatedCase : c)),
            })),
            deleteTestCaseLocal: (id: string) => set((state) => ({
                testCases: state.testCases.filter((c) => c.id !== id),
            })),
            updateProjectLocal: (project: Project) => set((state) => ({
                projects: state.projects.map((p) => (p.id === project.id ? project : p)),
            })),
            updateProjectSettingsLocal: (projectId: string, settings: ProjectSettings) => set((state) => ({
                projectSettings: { ...state.projectSettings, [projectId]: settings }
            })),
            deleteProjectLocal: (projectId: string) => set((state) => ({
                projects: state.projects.filter((p) => p.id !== projectId),
                // If deleted project was active, clear context
                activeProject: state.activeProject === projectId ? null : state.activeProject,
                activeSuite: state.activeProject === projectId ? null : state.activeSuite,
                activeSuiteId: state.activeProject === projectId ? null : state.activeSuiteId,
                testSuites: state.activeProject === projectId ? [] : state.testSuites,
                testCases: state.activeProject === projectId ? [] : state.testCases,
            })),
            setProjects: (projects: Project[]) => set({ projects }),
            addProject: (project: Project) => set((state) => ({ projects: [project, ...state.projects] })),

            // =========================================================================
            // TICKET ACTIONS
            // =========================================================================
            setActiveTicket: (ticket) => set({ activeTicket: ticket }),
            setTicketDetailViewOpen: (isOpen) => set({ isTicketDetailViewOpen: isOpen }),
            setTicketsTotal: (total) => set({ ticketsTotal: total }),
            fetchTickets: async (projectId) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await ticketApi.getTickets(projectId);
                    set({ tickets: response.map(mapTicketResponse), isLoading: false });
                } catch (error: unknown) {
                    set({ error: (error as Error).message, isLoading: false });
                }
            },
            createTicket: async (projectId, data) => {
                assertCanWriteProject(projectId);
                set({ isLoading: true, error: null });
                try {
                    const response = await ticketApi.createTicket(projectId, data);
                    const ticket = mapTicketResponse(response);
                    set((state) => ({
                        tickets: [ticket, ...state.tickets],
                        isLoading: false,
                    }));
                    return ticket;
                } catch (error: unknown) {
                    set({ error: (error as Error).message, isLoading: false });
                    throw error;
                }
            },
            updateTicket: async (projectId, id, data) => {
                assertCanWriteProject(projectId);
                set({ isLoading: true, error: null });
                try {
                    const response = await ticketApi.updateTicket(projectId, id, data);
                    const ticket = mapTicketResponse(response);
                    set((state) => ({
                        tickets: state.tickets.map((t) => (t.id === id ? ticket : t)),
                        activeTicket: state.activeTicket?.id === id ? ticket : state.activeTicket,
                        isLoading: false,
                    }));
                    return ticket;
                } catch (error: unknown) {
                    set({ error: (error as Error).message, isLoading: false });
                    throw error;
                }
            },
            // Delete = archive (soft delete). Tickets are never destroyed.
            deleteTicket: async (projectId, id) => {
                await get().archiveTicket(projectId, id);
            },
            archiveTicket: async (projectId, id) => {
                assertCanWriteProject(projectId);
                set({ isLoading: true, error: null });
                try {
                    const response = await ticketApi.archiveTicket(projectId, id);
                    const ticket = mapTicketResponse(response);
                    set((state) => ({
                        tickets: state.tickets.filter((t) => t.id !== id),
                        activeTicket: state.activeTicket?.id === id ? null : state.activeTicket,
                        isLoading: false,
                    }));
                    return ticket;
                } catch (error: unknown) {
                    set({ error: (error as Error).message, isLoading: false });
                    throw error;
                }
            },
            restoreTicket: async (projectId, id) => {
                assertCanWriteProject(projectId);
                set({ isLoading: true, error: null });
                try {
                    const response = await ticketApi.restoreTicket(projectId, id);
                    const ticket = mapTicketResponse(response);
                    set((state) => ({
                        tickets: state.tickets.filter((t) => t.id !== id),
                        activeTicket: state.activeTicket?.id === id ? null : state.activeTicket,
                        isLoading: false,
                    }));
                    return ticket;
                } catch (error: unknown) {
                    set({ error: (error as Error).message, isLoading: false });
                    throw error;
                }
            },
            updateTicketStatus: async (projectId, id, status) => {
                assertCanWriteProject(projectId);
                // Optimistic local update (no page spinner flash for drag-drop)
                const originalStatus = get().tickets.find((t) => t.id === id)?.status;
                set((state) => ({
                    tickets: state.tickets.map((t) =>
                        t.id === id ? { ...t, status } : t
                    ),
                }));
                try {
                    const response = await ticketApi.updateTicket(projectId, id, { status });
                    const ticket = mapTicketResponse(response);
                    set((state) => ({
                        tickets: state.tickets.map((t) => (t.id === id ? ticket : t)),
                        activeTicket: state.activeTicket?.id === id ? ticket : state.activeTicket,
                    }));
                    return ticket;
                } catch (error: unknown) {
                    // Roll back to the status the server still has
                    if (originalStatus) {
                        set((state) => ({
                            tickets: state.tickets.map((t) =>
                                t.id === id ? { ...t, status: originalStatus } : t
                            ),
                        }));
                    }
                    set({ error: (error as Error).message });
                    throw error;
                }
            },
            markTicketReproduced: async (projectId, id) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await ticketApi.markTicketReproduced(projectId, id);
                    const ticket: Ticket = {
                        ...mapTicketResponse(response),
                    };
                    set((state) => ({
                        tickets: state.tickets.map((t) => (t.id === id ? ticket : t)),
                        activeTicket: state.activeTicket?.id === id ? ticket : state.activeTicket,
                        isLoading: false,
                    }));
                    return ticket;
                } catch (error: unknown) {
                    set({ error: (error as Error).message, isLoading: false });
                    throw error;
                }
            },
            returnTicketForInfo: async (projectId, id, reason) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await ticketApi.returnTicketForInfo(projectId, id, reason);
                    const ticket: Ticket = {
                        ...mapTicketResponse(response),
                    };
                    set((state) => ({
                        tickets: state.tickets.map((t) => (t.id === id ? ticket : t)),
                        activeTicket: state.activeTicket?.id === id ? ticket : state.activeTicket,
                        isLoading: false,
                    }));
                    return ticket;
                } catch (error: unknown) {
                    set({ error: (error as Error).message, isLoading: false });
                    throw error;
                }
            },
            setTicketView: (view) => set({ ticketView: view }),
            // Realtime ticket sync (socket events) - local-only updates
            applyRemoteTicketCreate: (ticket) => set((state) => {
                const exists = state.tickets.some((t) => t.id === ticket.id);
                if (exists) return state;
                return {
                    tickets: [ticket, ...state.tickets],
                    ticketsTotal: state.ticketsTotal + 1,
                };
            }),
            applyRemoteTicketUpdate: (ticket) => set((state) => ({
                tickets: state.tickets.map((t) => (t.id === ticket.id ? ticket : t)),
                activeTicket: state.activeTicket?.id === ticket.id ? ticket : state.activeTicket,
            })),
            removeTicketLocal: (ticketId) => set((state) => ({
                tickets: state.tickets.filter((t) => t.id !== ticketId),
                activeTicket: state.activeTicket?.id === ticketId ? null : state.activeTicket,
                ticketsTotal: Math.max(0, state.ticketsTotal - 1),
            })),
        }),
        {
            name: 'test-manager-storage', // localStorage key
            partialize: (state) => ({
                // Only persist these specific fields - not the full data or loading states
                activeProject: state.activeProject,
                activeArea: state.activeArea,
                activeSuite: state.activeSuite,
                activeSuiteId: state.activeSuiteId,
                viewMode: state.viewMode,
                ticketView: state.ticketView,
            }),
        }
    ),
    Object.is
);
