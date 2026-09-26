import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Clock,
    Download,
    FileText,
    Loader2,
    Play,
    Ticket as TicketIcon,
} from 'lucide-react';
import { reportingApi } from '../../services/reportingApi';
import { useAuthStore } from '../../store/authStore';
import { testRunApi } from '../../services/testRunApi';
import { DetailedRunReport, RunTimelineAction, TestRunStatus } from '../../types/testManager';
import { getRunItemStatusBadgeColor, getRunStatusColor } from '../testManager/components/testRunUtils';
import {
    getFailureTypeColor,
    getTicketPriorityColor,
    getTicketSeverityColor,
    getTicketStatusColor,
} from '../../utils/ticketColors';
import { exportRunReportToExcel, exportRunReportToPDF } from '../../utils/exportRunReport';
import ReportIdentityBar from '../../components/testManager/ReportIdentityBar';
import IdDisplay from '../../components/testManager/IdDisplay';
import toast from 'react-hot-toast';

interface SingleRunReportTabProps {
    projectId: string;
    projectName?: string;
    startDate?: string;
    endDate?: string;
    groupId?: string;
    tags?: string[];
    /** Restrict the selectable runs to those that produced tickets */
    onlyRunsWithTickets?: boolean;
    onOpenRun: (runId: string) => void;
}

const formatDateTime = (value?: Date | string | null): string => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

const formatDuration = (seconds?: number | null): string => {
    if (!seconds || seconds <= 0) return '—';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const rest = Math.round(seconds % 60);
    return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`;
};

const TIMELINE_TONE: Record<RunTimelineAction, string> = {
    created: 'bg-gray-400',
    started: 'bg-blue-500',
    item_executed: 'bg-blue-400',
    completed: 'bg-green-500',
    abandoned: 'bg-red-500',
    ticket_created: 'bg-purple-500',
    ticket_reproduced: 'bg-teal-500',
    ticket_status_changed: 'bg-indigo-500',
    ticket_resolved: 'bg-green-600',
    ticket_returned: 'bg-amber-500',
    ticket_archived: 'bg-gray-500',
};

const TIMELINE_LABEL: Record<RunTimelineAction, string> = {
    created: 'Run created',
    started: 'Execution started',
    item_executed: 'Item executed',
    completed: 'Run completed',
    abandoned: 'Run abandoned',
    ticket_created: 'Ticket created',
    ticket_reproduced: 'Ticket reproduced',
    ticket_status_changed: 'Ticket status changed',
    ticket_resolved: 'Ticket resolved',
    ticket_returned: 'Ticket returned',
    ticket_archived: 'Ticket archived',
};

interface RunOption {
    id: string;
    displayId?: string;
    title: string;
    status: TestRunStatus;
    ticketCount: number;
}

/**
 * "Single Run Report" sub-tab: pick one test run, see its full analytics
 * report on screen, and download it as PDF or Excel.
 */
const SingleRunReportTab: React.FC<SingleRunReportTabProps> = ({
    projectId,
    projectName,
    startDate,
    endDate,
    groupId,
    tags,
    onlyRunsWithTickets,
    onOpenRun,
}) => {
    const [runs, setRuns] = useState<RunOption[]>([]);
    const [isLoadingRuns, setIsLoadingRuns] = useState(false);
    const [selectedRunId, setSelectedRunId] = useState<string>('');
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);
    const [report, setReport] = useState<DetailedRunReport | null>(null);
    const [isLoadingReport, setIsLoadingReport] = useState(false);
    const [reportError, setReportError] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState<'pdf' | 'excel' | null>(null);

    const currentUser = useAuthStore((state) => state.user);
    const reportMeta = useMemo(
        () => ({ author: { name: currentUser?.name, email: currentUser?.email } }),
        [currentUser?.name, currentUser?.email]
    );
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        items: true,
        tickets: true,
        unticketed: true,
        timeline: false,
    });

    // Load the project's runs for the picker
    useEffect(() => {
        if (!projectId) return;
        let cancelled = false;

        const load = async () => {
            setIsLoadingRuns(true);
            try {
                const result = await testRunApi.getTestRunsPaginated(projectId, {
                    limit: 40,
                    offset: 0,
                });
                if (cancelled) return;

                const start = startDate ? new Date(startDate).getTime() : null;
                const end = endDate ? new Date(endDate).getTime() : null;
                const wantedTags = (tags ?? []).map((t) => t.toLowerCase());

                const options: RunOption[] = result.items
                    .filter((run) => {
                        if (groupId && run.groupId !== groupId) return false;
                        if (onlyRunsWithTickets && (run.ticketCount ?? 0) === 0) return false;
                        if (wantedTags.length > 0) {
                            const runTags = (run.tags ?? []).map((t) => t.toLowerCase());
                            if (!wantedTags.some((t) => runTags.includes(t))) return false;
                        }
                        const stamp = run.completedAt
                            ? new Date(run.completedAt).getTime()
                            : new Date(run.createdAt).getTime();
                        if (start !== null && stamp < start) return false;
                        if (end !== null && stamp > end + 24 * 60 * 60 * 1000 - 1) return false;
                        return true;
                    })
                    .map((run) => ({
                        id: run.id,
                        displayId: run.displayId,
                        title: run.title,
                        status: run.status,
                        ticketCount: run.ticketCount ?? 0,
                    }));
                setRuns(options);
                setSelectedRunId((prev) => prev || options[0]?.id || '');
            } catch (err) {
                if (!cancelled) {
                    toast.error((err as Error)?.message || 'Failed to load test runs');
                }
            } finally {
                if (!cancelled) setIsLoadingRuns(false);
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [projectId, startDate, endDate, groupId, tags, onlyRunsWithTickets]);

    // Fetch the detailed report for the selected run
    useEffect(() => {
        if (!selectedRunId) {
            setReport(null);
            return;
        }
        let cancelled = false;

        const load = async () => {
            setIsLoadingReport(true);
            setReportError(null);
            try {
                const data = await reportingApi.getDetailedRunReport(selectedRunId);
                if (!cancelled) setReport(data);
            } catch (err) {
                if (!cancelled) {
                    setReport(null);
                    setReportError((err as Error)?.message || 'Failed to load run report');
                }
            } finally {
                if (!cancelled) setIsLoadingReport(false);
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [selectedRunId]);

    const selectedRun = useMemo(
        () => runs.find((r) => r.id === selectedRunId),
        [runs, selectedRunId]
    );

    const toggleSection = useCallback((key: string) => {
        setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const unticketedFailures = useMemo(
        () =>
            (report?.items ?? []).filter(
                (item) => item.status === 'Failed' && (item.linkedTickets?.length ?? 0) === 0
            ),
        [report]
    );

    const handleExportExcel = async () => {
        if (!report) return;
        setIsExporting('excel');
        try {
            const filename = await exportRunReportToExcel(report, reportMeta);
            toast.success(`Downloaded ${filename}`);
        } catch (err) {
            toast.error((err as Error)?.message || 'Failed to export Excel report');
        } finally {
            setIsExporting(null);
        }
    };

    const handleExportPdf = () => {
        if (!report) return;
        setIsExporting('pdf');
        try {
            exportRunReportToPDF(report, reportMeta);
        } catch (err) {
            toast.error((err as Error)?.message || 'Failed to export PDF report');
        } finally {
            setIsExporting(null);
        }
    };

    if (!projectId) return null;

    return (
        <div className="space-y-4">
            {/* Controls */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[240px]">
                    <button
                        type="button"
                        onClick={() => setIsSelectorOpen((prev) => !prev)}
                        disabled={isLoadingRuns || runs.length === 0}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <Play className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        {isLoadingRuns ? (
                            <span className="text-gray-400">Loading runs…</span>
                        ) : runs.length === 0 ? (
                            <span className="text-gray-400">No test runs available</span>
                        ) : selectedRun ? (
                            <>
                                <IdDisplay
                                    id={selectedRun.displayId || selectedRun.id}
                                    className="text-[10px] px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700"
                                />
                                <span className="flex-1 truncate text-gray-900 dark:text-gray-100">
                                    {selectedRun.title}
                                </span>
                                {selectedRun.ticketCount > 0 && (
                                    <span className="inline-flex items-center gap-1 text-xs text-red-500">
                                        <TicketIcon className="w-3 h-3" />
                                        {selectedRun.ticketCount}
                                    </span>
                                )}
                            </>
                        ) : (
                            <span className="text-gray-400">Select a test run</span>
                        )}
                        <ChevronDown
                            className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${
                                isSelectorOpen ? 'rotate-180' : ''
                            }`}
                        />
                    </button>

                    {isSelectorOpen && runs.length > 0 && (
                        <>
                            <div
                                className="fixed inset-0 z-10"
                                onClick={() => setIsSelectorOpen(false)}
                            />
                            <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
                                {runs.map((run) => (
                                    <button
                                        key={run.id}
                                        onClick={() => {
                                            setSelectedRunId(run.id);
                                            setIsSelectorOpen(false);
                                        }}
                                        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                                            run.id === selectedRunId
                                                ? 'bg-blue-50 dark:bg-blue-900/20'
                                                : ''
                                        }`}
                                    >
                                        <IdDisplay
                                            id={run.displayId || run.id}
                                            className="text-[10px] px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 flex-shrink-0"
                                        />
                                        <span className="flex-1 truncate text-gray-700 dark:text-gray-300">
                                            {run.title}
                                        </span>
                                        {run.ticketCount > 0 && (
                                            <span className="inline-flex items-center gap-1 text-xs text-red-500">
                                                <TicketIcon className="w-3 h-3" />
                                                {run.ticketCount}
                                            </span>
                                        )}
                                        <span
                                            className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium border flex-shrink-0 ${getRunStatusColor(
                                                run.status
                                            )}`}
                                        >
                                            {run.status}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExportPdf}
                        disabled={!report || isExporting !== null}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isExporting === 'pdf' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <FileText className="w-4 h-4" />
                        )}
                        PDF
                    </button>
                    <button
                        onClick={handleExportExcel}
                        disabled={!report || isExporting !== null}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isExporting === 'excel' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Download className="w-4 h-4" />
                        )}
                        Excel
                    </button>
                    {report && (
                        <button
                            onClick={() => onOpenRun(report.runId)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                        >
                            <Play className="w-4 h-4" />
                            Open run
                        </button>
                    )}
                </div>
            </div>

            {reportError && (
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                    {reportError}
                </div>
            )}

            {isLoadingReport && (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-6 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Building report…
                </div>
            )}

            {/* Report body */}
            {report && !isLoadingReport && (
                <div className="space-y-4">
                    {/* Run header */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <IdDisplay
                                        id={report.displayId || report.runId}
                                        className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded"
                                    />
                                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                                        {report.title}
                                    </h3>
                                    <span
                                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${getRunStatusColor(
                                            report.status
                                        )}`}
                                    >
                                        {report.status}
                                    </span>
                                </div>
                                {report.description && (
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        {report.description}
                                    </p>
                                )}
                                <ReportIdentityBar
                                    className="mt-2"
                                    projectName={projectName}
                                    clientName={report.client?.name}
                                    authorName={reportMeta.author.name}
                                    authorEmail={reportMeta.author.email}
                                />
                                <div className="flex items-center gap-3 flex-wrap mt-2 text-xs text-gray-500 dark:text-gray-400">
                                    <span>Run created by {report.createdBy}</span>
                                    <span>Created {formatDateTime(report.createdAt)}</span>
                                    {report.completedAt && (
                                        <span>Completed {formatDateTime(report.completedAt)}</span>
                                    )}
                                    <span className="inline-flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {formatDuration(report.duration)}
                                    </span>
                                    {report.suite && <span>Suite: {report.suite.name}</span>}
                                    {report.group && <span>Group: {report.group.name}</span>}
                                    {report.environment && (
                                        <span>Env: {report.environment}</span>
                                    )}
                                    {report.team && <span>Team: {report.team}</span>}
                                    {report.buildVersion && (
                                        <span>Build: {report.buildVersion}</span>
                                    )}
                                    {report.tags?.length > 0 && (
                                        <span>Tags: {report.tags.join(', ')}</span>
                                    )}
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
                                    {report.statistics.passRate}%
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">pass rate</p>
                            </div>
                        </div>

                        {/* Status distribution bar */}
                        <div className="mt-3 h-2 flex rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
                            {(
                                [
                                    ['passed', report.statistics.passed, 'bg-green-500'],
                                    ['failed', report.statistics.failed, 'bg-red-500'],
                                    ['blocked', report.statistics.blocked, 'bg-orange-500'],
                                    ['skipped', report.statistics.skipped, 'bg-gray-400'],
                                    ['notRun', report.statistics.notRun, 'bg-blue-300'],
                                ] as const
                            ).map(([key, value, color]) =>
                                report.statistics.total > 0 && value > 0 ? (
                                    <div
                                        key={key}
                                        className={color}
                                        style={{
                                            width: `${(value / report.statistics.total) * 100}%`,
                                        }}
                                        title={`${key}: ${value}`}
                                    />
                                ) : null
                            )}
                        </div>
                        <div className="mt-2 flex items-center gap-3 flex-wrap text-[11px] text-gray-500 dark:text-gray-400">
                            <span className="text-green-600 dark:text-green-400">
                                ● {report.statistics.passed} passed
                            </span>
                            <span className="text-red-600 dark:text-red-400">
                                ● {report.statistics.failed} failed
                            </span>
                            <span className="text-orange-600 dark:text-orange-400">
                                ● {report.statistics.blocked} blocked
                            </span>
                            <span className="text-gray-500">
                                ● {report.statistics.skipped} skipped
                            </span>
                            <span className="text-blue-500">
                                ● {report.statistics.notRun} not run
                            </span>
                            <span>of {report.statistics.total} total</span>
                        </div>
                    </div>

                    {/* Ticket summary */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <TicketIcon className="w-4 h-4 text-red-500" />
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                Ticket Summary
                            </h4>
                            {report.ticketSummary.returnedCount > 0 && (
                                <span className="text-xs text-amber-600 dark:text-amber-400">
                                    {report.ticketSummary.returnedCount} returned
                                </span>
                            )}
                        </div>
                        <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
                            <MetricTile
                                label="Total"
                                value={report.ticketSummary.total}
                                tone="text-gray-900 dark:text-gray-100"
                            />
                            <MetricTile
                                label="Resolved %"
                                value={`${report.ticketSummary.resolutionRate}%`}
                                tone="text-green-600 dark:text-green-400"
                            />
                            <MetricTile
                                label="Reproduced"
                                value={report.ticketSummary.reproducedCount}
                                tone="text-blue-600 dark:text-blue-400"
                            />
                            <MetricTile
                                label="Not reproduced"
                                value={report.ticketSummary.ticketsWithNoRepro}
                                tone="text-gray-500 dark:text-gray-400"
                            />
                            <MetricTile
                                label="Unassigned"
                                value={report.ticketSummary.ticketsUnassigned}
                                tone="text-gray-500 dark:text-gray-400"
                            />
                            <MetricTile
                                label="Avg TTR"
                                value={
                                    report.ticketSummary.avgTimeToReproduceHours !== null
                                        ? `${report.ticketSummary.avgTimeToReproduceHours}h`
                                        : '—'
                                }
                                tone="text-purple-600 dark:text-purple-400"
                            />
                        </div>

                        {Object.keys(report.ticketSummary.byStatus ?? {}).length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {Object.entries(report.ticketSummary.byStatus).map(
                                    ([status, count]) => (
                                        <span
                                            key={status}
                                            className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium ${getTicketStatusColor(
                                                status as never
                                            )}`}
                                        >
                                            {status}: {count}
                                        </span>
                                    )
                                )}
                            </div>
                        )}
                    </div>

                    {/* Test items */}
                    <ReportSection
                        title={`Test Items (${report.items.length})`}
                        isOpen={openSections.items}
                        onToggle={() => toggleSection('items')}
                    >
                        <div className="overflow-x-auto max-h-96 overflow-y-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-800/60 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2 font-medium">#</th>
                                        <th className="px-3 py-2 font-medium">Test case</th>
                                        <th className="px-3 py-2 font-medium">Suite</th>
                                        <th className="px-3 py-2 font-medium">Status</th>
                                        <th className="px-3 py-2 font-medium">Executed by</th>
                                        <th className="px-3 py-2 font-medium">Time</th>
                                        <th className="px-3 py-2 font-medium">Tickets</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {report.items.map((item, index) => (
                                        <tr
                                            key={item.itemId}
                                            className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                        >
                                            <td className="px-3 py-1.5 text-gray-400 dark:text-gray-500">
                                                {index + 1}
                                            </td>
                                            <td className="px-3 py-1.5 text-gray-900 dark:text-gray-100">
                                                {item.title}
                                            </td>
                                            <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400">
                                                {item.suiteName || '—'}
                                            </td>
                                            <td className="px-3 py-1.5">
                                                <span
                                                    className={`inline-flex px-1.5 py-0.5 rounded-full text-[11px] font-medium ${getRunItemStatusBadgeColor(
                                                        item.status
                                                    )}`}
                                                >
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400">
                                                {item.executedBy || '—'}
                                            </td>
                                            <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                {formatDuration(item.timeSpent)}
                                            </td>
                                            <td className="px-3 py-1.5">
                                                {item.linkedTickets?.length ? (
                                                    <span className="inline-flex flex-wrap gap-1">
                                                        {item.linkedTickets.map((t) => (
                                                            <IdDisplay
                                                                key={t.ticketId}
                                                                id={t.displayId || t.ticketId}
                                                                className="text-[10px] px-1 py-0.5 rounded bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300"
                                                            />
                                                        ))}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-300 dark:text-gray-600">
                                                        —
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </ReportSection>

                    {/* Tickets */}
                    <ReportSection
                        title={`Tickets (${report.tickets.length})`}
                        isOpen={openSections.tickets}
                        onToggle={() => toggleSection('tickets')}
                    >
                        {report.tickets.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
                                No tickets were raised from this run.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {report.tickets.map((ticket) => (
                                    <div
                                        key={ticket.ticketId}
                                        className="rounded-lg border border-gray-100 dark:border-gray-700 px-3 py-2 space-y-1"
                                    >
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <IdDisplay
                                                id={ticket.displayId || ticket.ticketId}
                                                className="text-[10px] px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700"
                                            />
                                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                {ticket.title}
                                            </span>
                                            <span
                                                className={`inline-flex px-1.5 py-0.5 rounded-full text-[11px] font-medium ${getTicketStatusColor(
                                                    ticket.status as never
                                                )}`}
                                            >
                                                {ticket.status}
                                            </span>
                                            <span
                                                className={`inline-flex px-1.5 py-0.5 rounded-full text-[11px] font-medium ${getTicketPriorityColor(
                                                    ticket.priority as never
                                                )}`}
                                            >
                                                {ticket.priority}
                                            </span>
                                            <span
                                                className={`inline-flex px-1.5 py-0.5 rounded-full text-[11px] font-medium ${getTicketSeverityColor(
                                                    ticket.severity as never
                                                )}`}
                                            >
                                                {ticket.severity}
                                            </span>
                                            {ticket.failureType && (
                                                <span
                                                    className={`inline-flex px-1.5 py-0.5 rounded-full text-[11px] font-medium ${getFailureTypeColor(
                                                        ticket.failureType as never
                                                    )}`}
                                                >
                                                    {ticket.failureType}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 flex-wrap text-[11px] text-gray-500 dark:text-gray-400">
                                            <span>
                                                {ticket.assignedTo?.name || 'Unassigned'}
                                            </span>
                                            <span>{formatDateTime(ticket.createdAt)}</span>
                                            {ticket.firstReproducedAt && (
                                                <span className="text-blue-600 dark:text-blue-400 inline-flex items-center gap-1">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    Reproduced
                                                </span>
                                            )}
                                            {ticket.returnedCount > 0 && (
                                                <span className="text-amber-600 dark:text-amber-400">
                                                    Returned {ticket.returnedCount}×
                                                    {ticket.lastReturnReason
                                                        ? ` (${ticket.lastReturnReason})`
                                                        : ''}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ReportSection>

                    {/* Unticketed failures */}
                    {unticketedFailures.length > 0 && (
                        <ReportSection
                            title={`Failed Without Ticket (${unticketedFailures.length})`}
                            isOpen={openSections.unticketed}
                            onToggle={() => toggleSection('unticketed')}
                            tone="danger"
                        >
                            <div className="space-y-1.5">
                                {unticketedFailures.map((item) => (
                                    <div
                                        key={item.itemId}
                                        className="flex items-center gap-2 rounded-lg border border-red-100 dark:border-red-900/40 bg-red-50/50 dark:bg-red-900/10 px-3 py-2"
                                    >
                                        <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                                        <span className="text-sm text-gray-800 dark:text-gray-200 truncate">
                                            {item.title}
                                        </span>
                                        {item.suiteName && (
                                            <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                                {item.suiteName}
                                            </span>
                                        )}
                                        <span className="text-[11px] text-gray-400 dark:text-gray-500 ml-auto whitespace-nowrap">
                                            {formatDateTime(item.executedAt)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </ReportSection>
                    )}

                    {/* Timeline */}
                    <ReportSection
                        title={`Timeline (${report.timeline.length})`}
                        isOpen={openSections.timeline}
                        onToggle={() => toggleSection('timeline')}
                    >
                        <ol className="relative border-l border-gray-200 dark:border-gray-700 ml-2 space-y-3">
                            {report.timeline.map((entry, index) => (
                                <li key={`${entry.timestamp}-${index}`} className="pl-4">
                                    <span
                                        className={`absolute -left-1 w-2 h-2 rounded-full mt-1.5 ${
                                            TIMELINE_TONE[entry.action] ?? 'bg-gray-400'
                                        }`}
                                    />
                                    <p className="text-sm text-gray-900 dark:text-gray-100">
                                        {TIMELINE_LABEL[entry.action] ?? entry.action}
                                        {entry.ticketDisplayId && (
                                            <IdDisplay
                                                id={entry.ticketDisplayId}
                                                className="ml-2 text-[10px] px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 align-middle"
                                            />
                                        )}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {entry.details}
                                    </p>
                                    <p className="text-[11px] text-gray-400 dark:text-gray-500">
                                        {formatDateTime(entry.timestamp)} · {entry.user}
                                        {entry.statusChange && (
                                            <span className="ml-1">
                                                ({entry.statusChange.from} → {entry.statusChange.to})
                                            </span>
                                        )}
                                    </p>
                                </li>
                            ))}
                        </ol>
                    </ReportSection>
                </div>
            )}
        </div>
    );
};

const MetricTile: React.FC<{ label: string; value: React.ReactNode; tone: string }> = ({
    label,
    value,
    tone,
}) => (
    <div className="rounded-lg border border-gray-100 dark:border-gray-700 px-2 py-2">
        <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {label}
        </p>
        <p className={`text-sm font-semibold ${tone}`}>{value}</p>
    </div>
);

const ReportSection: React.FC<{
    title: string;
    isOpen: boolean;
    onToggle: () => void;
    tone?: 'default' | 'danger';
    children: React.ReactNode;
}> = ({ title, isOpen, onToggle, tone = 'default', children }) => (
    <div
        className={`rounded-lg border bg-white dark:bg-gray-800 ${
            tone === 'danger'
                ? 'border-red-200 dark:border-red-900/40'
                : 'border-gray-200 dark:border-gray-700'
        }`}
    >
        <button
            type="button"
            onClick={onToggle}
            aria-expanded={isOpen}
            className="w-full flex items-center gap-2 px-4 py-3 text-left"
        >
            {isOpen ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
            <h4
                className={`text-sm font-semibold ${
                    tone === 'danger'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-gray-900 dark:text-gray-100'
                }`}
            >
                {title}
            </h4>
        </button>
        {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
);

export default SingleRunReportTab;
