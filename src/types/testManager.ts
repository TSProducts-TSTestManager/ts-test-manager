
export enum Priority {
    Low = 'Low',
    Medium = 'Medium',
    High = 'High',
    Critical = 'Critical'
}

export enum Status {
    Draft = 'Draft',
    InReview = 'In Review',
    Ready = 'Ready',
    Updated = 'Updated',
    Archived = 'Archived',
}

export enum TestRunStatus {
    Draft = 'Draft',
    InProgress = 'In Progress',
    Completed = 'Completed',
    Abandoned = 'Abandoned'
}

export enum RunItemStatus {
    NotRun = 'Not Run',
    ReadyForTesting = 'Ready for Testing',
    InProgress = 'In Progress',
    Passed = 'Passed',
    Failed = 'Failed',
    Blocked = 'Blocked',
    Skipped = 'Skipped',
    OutOfScope = 'Out of Scope',
}

export interface Tester {
    id: string;
    name: string;
    avatar: string;
}

export interface TestStep {
    id: string;
    action: string;
    expectedResult: string;
}

export type ProjectMemberRole = 'lead' | 'editor' | 'viewer';

export interface ProjectMember {
    id: string;
    name: string;
    email: string;
    /** Project-level role (Lead / Editor / Viewer). Missing on legacy payloads. */
    role?: ProjectMemberRole;
    /** false = deactivated client user; kept in the project for history/attribution */
    active?: boolean;
    isOwner?: boolean;
}

/** Client user that can be assigned to a project (never created at project level) */
export interface ProjectMemberCandidate {
    id: string;
    name: string;
    email: string;
    clientRole: string;
    active: boolean;
    assigned: boolean;
}

export interface CustomFieldOption {
    id: string;
    label: string;
}

export interface CustomFieldDefinition {
    id: string;
    key?: string;
    label: string;
    type: 'text' | 'long_text' | 'dropdown' | 'wysiwyg';
    required?: boolean;
    options?: CustomFieldOption[];
    defaultValue?: string;
    showOnTableByDefault?: boolean;
    order?: number;
    deleted?: boolean;
    deletedAt?: string;
}

export interface HiddenDefaultFields {
    area?: boolean;
    testDescription?: boolean;
    stepsContent?: boolean;
    expectedResult?: boolean;
    comments?: boolean;
    priority?: boolean;
    status?: boolean;
    assignedTester?: boolean;
}

export interface HiddenDefaultColumns {
    id?: boolean;
    title?: boolean;
    priority?: boolean;
    status?: boolean;
    createdAt?: boolean;
    lastModified?: boolean;
    assignedTester?: boolean;
}

export interface VideoEvidenceSettings {
    enabled: boolean;
    publicLinks: boolean;
}

export interface ProjectSettings {
    testCases?: {
        hiddenDefaultFields?: HiddenDefaultFields;
        table?: {
            hiddenDefaultColumns?: HiddenDefaultColumns;
            visibleCustomFieldIds?: string[];
        };
        customFields?: CustomFieldDefinition[];
    };
    videoEvidence?: VideoEvidenceSettings;
}

export interface DriveConnection {
    connected: boolean;
    googleEmail?: string;
    connectedAt?: string;
}

export interface VideoEvidence {
    id: string;
    projectId: string;
    ticketId?: string;
    testRunId?: string;
    testRunItemId?: string;
    provider: string;
    driveFileId: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    webViewLink?: string;
    uploadedBy: {
        id: string;
        name: string;
    };
    createdAt: string;
}

export interface DriveUploadSession {
    sessionUri: string;
    accessToken: string;
    expiresIn: number;
}

export interface Project {
    id: string;
    displayId?: string;
    seq?: number;
    clientId?: string;
    name: string;
    description: string;
    color: string;
    ownerId: string;
    members: ProjectMember[];
    stats: {
        suites: number;
        cases: number;
        members: number;
        bugs?: number;
        openBugs?: number;
    };
    jira?: {
        enabled: boolean;
        domain: string;
        projectKey: string;
        defaultIssueType?: string;
    };
    updatedAt: string;
    settings?: ProjectSettings;
}

export interface TestSuite {
    id: string;
    displayId?: string;
    projectId: string;
    clientId?: string;
    name: string;
    description?: string;
    tags?: string[];
    caseCount?: number;
    createdAt: string;
    updatedAt: string;
}

export interface HistoryEntry {
    id: string;
    timestamp: string;
    user: Tester;
    snapshot: Partial<TestCase>;
    changedFields: string[];
}

export interface TestCase {
    id: string;
    displayId?: string;
    clientId?: string;
    title: string;
    priority: Priority;
    status: Status; // Unified status
    createdAt: string;
    lastModified: string;
    assignedTester: Tester;
    steps: TestStep[];
    stepsContent?: string;
    suite: string;
    suiteId?: string;
    area?: string;
    expectedResult?: string;
    testDescription?: string;
    comments?: string;
    customFields?: Record<string, string>;
    history?: HistoryEntry[];
    projectId: string;
    order?: number;
}

// Test Run Types
export interface CaseSnapshot {
    title: string;
    priority?: string;
    suiteId?: string;
    suiteName?: string;
    area?: string;
    expectedResult?: string;
    testDescription?: string;
    stepsContent?: string;
    status?: string;
    comments?: string;
    customFields?: Record<string, string>;
}

export interface RunItem {
    id: string;
    caseId: string;
    caseSnapshot: CaseSnapshot;
    order: number;
    status: RunItemStatus;
    assignedTo?: Tester;
    actualResult?: string;
    attachments?: string[];
    timeSpent?: number;
    executedAt?: string;
    executedBy?: Tester;
}

export interface ResultsSummary {
    total: number;
    passed: number;
    failed: number;
    blocked: number;
    skipped: number;
    notRun: number;
    passRate: number;
    totalTimeSpent: number;
}

export interface TestRun {
    id: string;
    displayId?: string;
    title: string;
    description?: string;
    projectId: string;
    suiteId?: string;
    suiteName?: string;
    status: TestRunStatus;
    environment?: string;
    team?: string;
    buildVersion?: string;
    tags?: string[];
    items: RunItem[];
    createdBy: Tester;
    startedAt?: string;
    completedAt?: string;
    resultsSummary: ResultsSummary;
    groupId?: string;
    /** Non-archived tickets raised from this run */
    ticketCount?: number;
    /** % of those tickets that are Resolved or Closed */
    ticketResolutionRate?: number;
    createdAt: string;
    updatedAt: string;
}

export interface TestRunListItem {
    id: string;
    displayId?: string;
    title: string;
    description?: string;
    projectId: string;
    suiteId?: string;
    suiteName?: string;
    status: TestRunStatus;
    environment?: string;
    team?: string;
    buildVersion?: string;
    tags?: string[];
    itemCount: number;
    createdBy: Tester;
    startedAt?: string;
    completedAt?: string;
    resultsSummary: ResultsSummary;
    groupId?: string;
    /** Non-archived tickets raised from this run */
    ticketCount?: number;
    /** % of those tickets that are Resolved or Closed */
    ticketResolutionRate?: number;
    createdAt: string;
    updatedAt: string;
}

export interface TestRunGroup {
    id: string;
    name: string;
    description?: string;
    projectId: string;
    parentId?: string | null;
    color?: string;
    createdBy: Tester;
    createdAt: string;
    updatedAt: string;
}

// ===== Reporting Types =====

export interface ReportFilterParams {
    startDate?: string;
    endDate?: string;
    suiteId?: string;
    groupId?: string;
    environment?: string;
    tags?: string[];
    status?: TestRunStatus;
}

export interface TrendReportParams extends ReportFilterParams {
    groupBy: 'day' | 'week' | 'month';
}

export interface ProjectSummaryReport {
    projectId: string;
    dateRange: {
        startDate: string;
        endDate: string;
    };
    totalRuns: number;
    completedRuns: number;
    inProgressRuns: number;
    draftRuns: number;
    abandonedRuns: number;
    overallStats: {
        totalTests: number;
        totalPassed: number;
        totalFailed: number;
        totalBlocked: number;
        totalSkipped: number;
        totalNotRun: number;
        averagePassRate: number;
        averageDuration: number;
    };
    suiteBreakdown: SuiteBreakdownItem[];
    groupBreakdown: GroupBreakdownItem[];
    recentActivity: RecentActivityItem[];
}

export interface SuiteBreakdownItem {
    suiteId: string;
    suiteName: string;
    totalRuns: number;
    averagePassRate: number;
    totalTests: number;
    totalPassed: number;
    totalFailed: number;
    averageDuration: number;
}

export interface GroupBreakdownItem {
    groupId: string;
    groupName: string;
    groupColor: string;
    totalRuns: number;
    averagePassRate: number;
    totalTests: number;
}

export interface RecentActivityItem {
    runId: string;
    title: string;
    status: TestRunStatus;
    completedAt: Date | null;
    passRate: number;
    duration: number;
}

export interface TrendReport {
    projectId: string;
    dateRange: {
        startDate: string;
        endDate: string;
    };
    groupBy: 'day' | 'week' | 'month';
    dataPoints: TrendDataPoint[];
    summary: {
        totalRuns: number;
        averagePassRate: number;
        trendDirection: 'improving' | 'declining' | 'stable';
        changePercentage: number;
    };
}

export interface TrendDataPoint {
    period: string;
    periodLabel: string;
    runsCompleted: number;
    totalTests: number;
    passed: number;
    failed: number;
    blocked: number;
    skipped: number;
    passRate: number;
    averageDuration: number;
}

export interface SuiteComparisonReport {
    projectId: string;
    dateRange: {
        startDate: string;
        endDate: string;
    };
    suites: SuiteComparisonItem[];
}

export interface SuiteComparisonItem {
    suiteId: string;
    suiteName: string;
    totalRuns: number;
    totalTests: number;
    passed: number;
    failed: number;
    blocked: number;
    skipped: number;
    passRate: number;
    averageDuration: number;
    trend: 'improving' | 'declining' | 'stable';
    failureRate: number;
}

export interface TestCaseHealthReport {
    projectId: string;
    dateRange: {
        startDate: string;
        endDate: string;
    };
    failedRunCases: FailedRunCaseItem[];
    flakyTests: FlakyTestItem[];
    neverExecutedTests: NeverExecutedTestItem[];
    mostFailingTests: MostFailingTestItem[];
    summary: {
        totalUniqueCases: number;
        flakyCount: number;
        neverExecutedCount: number;
        highFailureCount: number;
    };
}

export interface FailedRunCaseItem {
    runId: string;
    runName: string;
    itemId: string;
    caseId: string;
    testCaseName: string;
    testSuite: string;
    area: string;
    failedAt: Date | null;
}

export interface FlakyTestItem {
    caseId: string;
    title: string;
    suite: string;
    executionCount: number;
    passCount: number;
    failCount: number;
    flakyScore: number;
    recentResults: RunItemStatus[];
}

export interface NeverExecutedTestItem {
    caseId: string;
    title: string;
    suite: string;
    createdAt: Date;
    daysSinceCreation: number;
}

export interface MostFailingTestItem {
    caseId: string;
    title: string;
    suite: string;
    executionCount: number;
    failCount: number;
    failureRate: number;
    lastFailedAt: Date | null;
}

export interface DetailedRunReport {
    runId: string;
    displayId?: string;
    title: string;
    description: string;
    status: TestRunStatus;
    createdAt: Date;
    completedAt: Date | null;
    createdBy: string;
    suite: {
        id: string;
        name: string;
    } | null;
    /** Project the run's suite belongs to (resolved for report headers) */
    project: {
        id: string;
        name: string;
    } | null;
    /** Client that owns the project (resolved for report headers) */
    client: {
        id: string;
        name: string;
    } | null;
    group: {
        id: string;
        name: string;
        color: string;
    } | null;
    environment: string;
    team?: string;
    buildVersion?: string;
    tags: string[];
    duration: number;
    statistics: {
        total: number;
        passed: number;
        failed: number;
        blocked: number;
        skipped: number;
        notRun: number;
        passRate: number;
    };
    items: DetailedRunItem[];
    timeline: RunTimelineEntry[];
    /** Every non-archived ticket raised from this run */
    tickets: LinkedTicket[];
    ticketSummary: RunTicketSummary;
}

export interface DetailedRunItem {
    itemId: string;
    caseId: string;
    title: string;
    status: RunItemStatus;
    executedBy: string | null;
    executedAt: Date | null;
    timeSpent: number;
    actualResult: string;
    suiteName?: string;
    area?: string;
    priority?: string;
    /** Tickets raised from this specific run item */
    linkedTickets: LinkedTicket[];
}

// ===== Run ↔ Ticket Analytics =====

export interface LinkedTicket {
    ticketId: string;
    displayId?: string;
    title: string;
    status: TicketStatus;
    priority: TicketPriority;
    severity: TicketSeverity;
    failureType?: FailureType;
    team?: string;
    assignedTo?: { id: string; name: string } | null;
    relatedRunItemId?: string;
    createdAt: Date;
    updatedAt: Date;
    firstReproducedAt: Date | null;
    returnedCount: number;
    lastReturnReason?: ReturnReason;
}

export interface RunTicketSummary {
    total: number;
    byStatus: Record<string, number>;
    byFailureType: Record<string, number>;
    bySeverity: Record<string, number>;
    byPriority: Record<string, number>;
    /** % of tickets in Resolved or Closed */
    resolutionRate: number;
    /** % of tickets reproduced at least once */
    reproductionRate: number;
    reproducedCount: number;
    ticketsWithNoRepro: number;
    ticketsUnassigned: number;
    avgTimeToReproduceHours: number | null;
    returnedCount: number;
    returnedRate: number;
}

export type RunTimelineAction =
    | 'created'
    | 'started'
    | 'item_executed'
    | 'completed'
    | 'abandoned'
    | 'ticket_created'
    | 'ticket_reproduced'
    | 'ticket_status_changed'
    | 'ticket_resolved'
    | 'ticket_returned'
    | 'ticket_archived';

export interface RunTimelineEntry {
    timestamp: Date;
    action: RunTimelineAction;
    user: string;
    details: string;
    ticketId?: string;
    ticketDisplayId?: string;
    statusChange?: { from: TicketStatus; to: TicketStatus };
}

export interface RunComparisonItem {
    runId: string;
    displayId?: string;
    title: string;
    status: TestRunStatus;
    environment: string;
    team?: string;
    buildVersion?: string;
    completedAt: Date | null;
    statistics: {
        total: number;
        passed: number;
        failed: number;
        blocked: number;
        skipped: number;
        notRun: number;
        passRate: number;
    };
    duration: number;
    ticketSummary: RunTicketSummary;
    failedCasesWithoutTickets: number;
}

export interface RunTicketComparisonReport {
    projectId: string;
    runs: RunComparisonItem[];
    totals: {
        runs: number;
        tickets: number;
        passed: number;
        failed: number;
        blocked: number;
        skipped: number;
        notRun: number;
        passRate: number;
        duration: number;
        ticketsResolved: number;
        ticketResolutionRate: number;
        failedCasesWithoutTickets: number;
    };
}

export interface FailedCaseWithoutTicketItem {
    runId: string;
    runDisplayId?: string;
    runTitle: string;
    itemId: string;
    caseId: string;
    caseTitle: string;
    suiteName?: string;
    area?: string;
    status: RunItemStatus;
    executedBy: string | null;
    executedAt: Date | null;
    timeSpent: number;
}

export interface FailedCasesWithoutTicketsReport {
    runIds: string[];
    items: FailedCaseWithoutTicketItem[];
    summary: {
        totalFailedCases: number;
        failedCasesWithTickets: number;
        failedCasesWithoutTickets: number;
        /** % of failed cases that were ticketed */
        ticketedRate: number;
    };
}

// ===== Per-Run Trend (chronological, one point per test run) =====

export interface TestRunTrendPoint {
    runId: string;
    displayId?: string;
    title: string;
    status: TestRunStatus;
    /** 1-based chronological index (oldest = 1) */
    sequence: number;
    completedAt: Date | string | null;
    environment: string;
    team?: string;
    buildVersion?: string;
    total: number;
    passed: number;
    failed: number;
    blocked: number;
    skipped: number;
    notRun: number;
    passRate: number;
    /** seconds */
    duration: number;
    ticketCount: number;
    ticketResolvedCount: number;
    ticketResolutionRate: number;
}

export interface TestRunTrendReport {
    projectId: string;
    projectName: string;
    clientName: string;
    dateRange: { startDate: string; endDate: string };
    /** Oldest → newest */
    points: TestRunTrendPoint[];
    summary: {
        totalRuns: number;
        averagePassRate: number;
        trendDirection: 'improving' | 'declining' | 'stable';
        /** avg pass rate of newest third minus oldest third (percentage points) */
        changePercentage: number;
        averageDuration: number;
        durationChangePercentage: number;
        totalTickets: number;
        averageTicketResolutionRate: number;
        bestRun: TestRunTrendPoint | null;
        worstRun: TestRunTrendPoint | null;
        runsWithTickets: number;
        runsWithoutTickets: number;
    };
}

// ===== Ticket Types =====

export enum TicketStatus {
    Open = 'Open',
    InProgress = 'In Progress',
    Resolved = 'Resolved',
    Closed = 'Closed',
    Reopened = 'Reopened',
}

export enum TicketPriority {
    Low = 'Low',
    Medium = 'Medium',
    High = 'High',
    Critical = 'Critical',
}

export enum TicketSeverity {
    Trivial = 'Trivial',
    Minor = 'Minor',
    Major = 'Major',
    Critical = 'Critical',
    Blocker = 'Blocker',
}

export enum FailureType {
    Functional = 'Functional',
    UIUX = 'UI/UX',
    Integration = 'Integration',
    DataAPI = 'Data/API',
    EnvironmentSetup = 'Environment/Setup',
    FlakyIntermittent = 'Flaky/Intermittent',
    Performance = 'Performance',
    Security = 'Security',
    Other = 'Other',
}

export enum ReturnReason {
    MissingSteps = 'Missing steps',
    MissingExpectedActual = 'Missing expected vs actual',
    MissingEnvironmentBuild = 'Missing environment/build',
    MissingAttachment = 'Missing attachment',
    NotReproducible = 'Not reproducible',
    Other = 'Other',
}

export interface TicketAttachment {
    url: string;
    filename: string;
    fileSize: number;
    contentType: string;
}

export interface DivergenceField {
    field: string;
    snapshotValue?: string;
    liveValue?: string;
}

export interface TicketDivergence {
    hasDiverged: boolean;
    sourceCaseDeleted: boolean;
    caseId?: string;
    changedFields: DivergenceField[];
}

export interface Ticket {
    id: string;
    displayId?: string;
    clientId?: string;
    archived?: boolean;
    archivedAt?: string;
    title: string;
    description?: string;
    projectId: string;
    status: TicketStatus;
    priority: TicketPriority;
    severity: TicketSeverity;
    assignedTo?: Tester;
    createdBy: Tester;
    relatedRunId?: string;
    relatedRunItemId?: string;
    failureType?: FailureType;
    team?: string;
    environment?: string;
    buildVersion?: string;
    failureAt?: string;
    firstReproducedAt?: string;
    returnedCount?: number;
    lastReturnedAt?: string;
    lastReturnReason?: ReturnReason;
    divergence?: TicketDivergence;
    attachments: TicketAttachment[];
    tags: string[];
    jiraIssueKey?: string | null;
    jiraUrl?: string | null;
    jiraStatus?: string | null;
    createdAt: string;
    updatedAt: string;
}

// ===== Ticket Triage Metrics Types =====

export interface TicketTriageSegment {
    key: string;
    label: string;
    ticketsCreated: number;
    ticketsReproduced: number;
    reproductionRate: number;
    timeToReproduceMedianHours: number | null;
    timeToReproduceAvgHours: number | null;
    timeToReproduceP75Hours: number | null;
    returnedCount: number;
    returnedRate: number;
}

export interface TicketReturnReasonStat {
    reason: ReturnReason;
    count: number;
}

export interface TicketTriageDataPoint {
    period: string;
    periodLabel: string;
    ticketsCreated: number;
    ticketsReproduced: number;
    ticketsReturned: number;
}

export interface TicketMetricsReport {
    projectId: string;
    dateRange: {
        startDate: string;
        endDate: string;
    };
    kpis: {
        ticketsCreated: number;
        ticketsReproduced: number;
        reproductionRate: number;
        timeToReproduceMedianHours: number | null;
        timeToReproduceAvgHours: number | null;
        timeToReproduceP75Hours: number | null;
        ticketsReturned: number;
        returnedRate: number;
    };
    byFailureType: TicketTriageSegment[];
    byTeam: TicketTriageSegment[];
    returnsByReason: TicketReturnReasonStat[];
    trend: TicketTriageDataPoint[];
}

export type ViewMode = 'projects' | 'cases' | 'suites' | 'runs' | 'tickets';
