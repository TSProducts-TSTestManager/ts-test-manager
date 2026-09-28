import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    BarChart3,
    CheckCircle2,
    Clock,
    Loader2,
    Play,
    Ticket as TicketIcon,
} from 'lucide-react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { reportingApi } from '../../services/reportingApi';
import { testRunApi } from '../../services/testRunApi';
import {
    FailedCasesWithoutTicketsReport,
    RunComparisonItem,
    RunTicketComparisonReport,
    TestRunStatus,
} from '../../types/testManager';
import { getRunStatusColor } from '../testManager/components/testRunUtils';
import IdDisplay from '../../components/testManager/IdDisplay';

interface TestRunAnalyticsTabProps {
    projectId: string;
    projectName?: string;
    /** Reuse the Analytics page date range so both tabs stay in sync */
    startDate?: string;
    endDate?: string;
    groupId?: string;
    tags?: string[];
    /** Restrict the selectable runs to those that produced tickets */
    onlyRunsWithTickets?: boolean;
    onOpenRun: (runId: string) => void;
}

const MAX_COMPARABLE_RUNS = 10;

const formatDate = (value?: Date | string | null): string => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

const formatDuration = (seconds: number): string => {
    if (!seconds || seconds <= 0) return '—';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remaining = Math.round(seconds % 60);
    return remaining > 0 ? `${minutes}m ${remaining}s` : `${minutes}m`;
};

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#6B7280'];

interface RunOption {
    id: string;
    displayId?: string;
    title: string;
    status: TestRunStatus;
    completedAt?: string;
    ticketCount: number;
}

const TestRunAnalyticsTab: React.FC<TestRunAnalyticsTabProps> = ({
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
    const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);
    const [comparison, setComparison] = useState<RunTicketComparisonReport | null>(null);
    const [unticketed, setUnticketed] = useState<FailedCasesWithoutTicketsReport | null>(null);
    const [isComparing, setIsComparing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load the project's runs, applying the same filters the Analytics page uses
    useEffect(() => {
        if (!projectId) return;
        let cancelled = false;

        const load = async () => {
            setIsLoadingRuns(true);
            setError(null);
            try {
                // Page through the project's runs rather than taking the first
                // 40: the date and tag filters below only run against what is
                // loaded, so a partial fetch silently hid older runs.
                type RunListItem = Awaited<ReturnType<typeof testRunApi.getTestRunsPaginated>>['items'][number];
                const allRuns: RunListItem[] = [];
                const PAGE_SIZE = 100;
                const MAX_RUNS = 5000;

                let offset = 0;
                let hasMore = true;
                while (hasMore && allRuns.length < MAX_RUNS) {
                    const result = await testRunApi.getTestRunsPaginated(projectId, {
                        limit: PAGE_SIZE,
                        offset,
                        groupId,
                        hasTickets: onlyRunsWithTickets ? true : undefined,
                    });
                    if (cancelled) return;

                    allRuns.push(...result.items);
                    offset += result.items.length;
                    hasMore =
                        result.meta.hasMore && result.items.length > 0 && offset < result.meta.total;
                }
                if (cancelled) return;

                const start = startDate ? new Date(startDate).getTime() : null;
                const end = endDate ? new Date(endDate).getTime() : null;
                const wantedTags = (tags ?? []).map((t) => t.toLowerCase());

                const options: RunOption[] = allRuns
                    .filter((run) => {
                        if (onlyRunsWithTickets && (run.ticketCount ?? 0) === 0) return false;
                        if (wantedTags.length > 0) {
                            const runTags = (run.tags ?? []).map((t) => t.toLowerCase());
                            if (!wantedTags.some((t) => runTags.includes(t))) return false;
                        }
                        // Runs are dated by completion when finished, else creation
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
                        completedAt: run.completedAt,
                        ticketCount: run.ticketCount ?? 0,
                    }));

                setRuns(options);
                // Preselect the most recent completed run so the tab is useful immediately
                const firstCompleted = options.find((r) => r.status === 'Completed') ?? options[0];
                setSelectedRunIds(firstCompleted ? [firstCompleted.id] : []);
            } catch (err) {
                if (!cancelled) {
                    setError((err as Error)?.message || 'Failed to load test runs');
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

    // Fetch comparison + unticketed failures whenever the selection changes
    useEffect(() => {
        if (!projectId || selectedRunIds.length === 0) {
            setComparison(null);
            setUnticketed(null);
            return;
        }

        let cancelled = false;
        const load = async () => {
            setIsComparing(true);
            setError(null);
            try {
                const [comparisonResult, unticketedResult] = await Promise.all([
                    reportingApi.getRunTicketComparison(projectId, selectedRunIds),
                    reportingApi.getFailedCasesWithoutTickets(projectId, selectedRunIds),
                ]);
                if (cancelled) return;
                setComparison(comparisonResult);
                setUnticketed(unticketedResult);
            } catch (err) {
                if (!cancelled) {
                    setError((err as Error)?.message || 'Failed to load run comparison');
                }
            } finally {
                if (!cancelled) setIsComparing(false);
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [projectId, selectedRunIds]);

    const toggleRun = useCallback((runId: string) => {
        setSelectedRunIds((prev) => {
            if (prev.includes(runId)) return prev.filter((id) => id !== runId);
            if (prev.length >= MAX_COMPARABLE_RUNS) return prev;
            return [...prev, runId];
        });
    }, []);

    // Aggregate ticket status across the selected runs (for the pie chart)
    const ticketStatusData = useMemo(() => {
        if (!comparison) return [];
        const totals = new Map<string, number>();
        for (const run of comparison.runs) {
            for (const [status, count] of Object.entries(run.ticketSummary.byStatus)) {
                totals.set(status, (totals.get(status) || 0) + count);
            }
        }
        return Array.from(totals.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [comparison]);

    // Aggregate tickets by failure type (for the bar chart)
    const failureTypeData = useMemo(() => {
        if (!comparison) return [];
        const totals = new Map<string, number>();
        for (const run of comparison.runs) {
            for (const [type, count] of Object.entries(run.ticketSummary.byFailureType)) {
                totals.set(type, (totals.get(type) || 0) + count);
            }
        }
        return Array.from(totals.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8);
    }, [comparison]);

    const passRateData = useMemo(() => {
        if (!comparison) return [];
        return comparison.runs.map((run) => ({
            name: run.displayId || run.title.slice(0, 18),
            passRate: run.statistics.passRate,
            tickets: run.ticketSummary.total,
        }));
    }, [comparison]);

    if (!projectId) return null;

    return (
        <div className="space-y-6">
            {/* Run selector */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            Test Runs
                            {projectName && (
                                <span className="ml-1.5 font-normal text-gray-500 dark:text-gray-400">
                                    — {projectName}
                                </span>
                            )}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Select up to {MAX_COMPARABLE_RUNS} runs to compare results and their
                            tickets
                            {startDate || endDate ? (
                                <span className="ml-1">
                                    ({formatDate(startDate)} – {formatDate(endDate)})
                                </span>
                            ) : null}
                        </p>
                    </div>
                    {selectedRunIds.length > 0 && (
                        <button
                            onClick={() => setSelectedRunIds([])}
                            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
                        >
                            Clear selection
                        </button>
                    )}
                </div>

                {isLoadingRuns ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-3">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading runs...
                    </div>
                ) : runs.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 py-3">
                        No test runs found for this project in the selected range.
                    </p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {runs.map((run) => {
                            const isSelected = selectedRunIds.includes(run.id);
                            const atLimit =
                                !isSelected && selectedRunIds.length >= MAX_COMPARABLE_RUNS;
                            return (
                                <button
                                    key={run.id}
                                    onClick={() => toggleRun(run.id)}
                                    disabled={atLimit}
                                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                        isSelected
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                                    }`}
                                    title={`${run.title} · ${formatDate(run.completedAt)}`}
                                >
                                    {run.ticketCount > 0 && (
                                        <TicketIcon className="w-3 h-3 text-red-500" />
                                    )}
                                    <IdDisplay
                                        id={run.displayId || run.id}
                                        className="text-[10px] px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700"
                                    />
                                    <span className="max-w-[120px] truncate">{run.title}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                    {error}
                </div>
            )}

            {isComparing && (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Building comparison...
                </div>
            )}

            {/* KPI cards */}
            {comparison && (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <KpiCard
                        label="Runs compared"
                        value={comparison.totals.runs}
                        icon={<BarChart3 className="w-4 h-4" />}
                        tone="text-gray-900 dark:text-gray-100"
                    />
                    <KpiCard
                        label="Pass rate"
                        value={`${comparison.totals.passRate}%`}
                        icon={<CheckCircle2 className="w-4 h-4" />}
                        tone="text-green-600 dark:text-green-400"
                    />
                    <KpiCard
                        label="Total duration"
                        value={formatDuration(comparison.totals.duration)}
                        icon={<Clock className="w-4 h-4" />}
                        tone="text-gray-900 dark:text-gray-100"
                    />
                    <KpiCard
                        label="Tickets raised"
                        value={comparison.totals.tickets}
                        icon={<TicketIcon className="w-4 h-4" />}
                        tone="text-red-600 dark:text-red-400"
                    />
                    <KpiCard
                        label="Ticket resolution"
                        value={`${comparison.totals.ticketResolutionRate}%`}
                        icon={<CheckCircle2 className="w-4 h-4" />}
                        tone="text-blue-600 dark:text-blue-400"
                    />
                </div>
            )}

            {/* Charts */}
            {comparison && (ticketStatusData.length > 0 || failureTypeData.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                            Ticket status
                        </h4>
                        {ticketStatusData.length === 0 ? (
                            <EmptyChart message="No tickets for the selected runs" />
                        ) : (
                            <ResponsiveContainer width="100%" height={220}>
                                <PieChart>
                                    <Pie
                                        data={ticketStatusData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={45}
                                        outerRadius={75}
                                        paddingAngle={2}
                                    >
                                        {ticketStatusData.map((entry, index) => (
                                            <Cell
                                                key={entry.name}
                                                fill={PIE_COLORS[index % PIE_COLORS.length]}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend
                                        verticalAlign="bottom"
                                        height={36}
                                        formatter={(value: unknown, entry: unknown) => {
                                            const name =
                                                (entry as { payload?: { name?: string } })?.payload
                                                    ?.name ?? String(value);
                                            return `${name}`;
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                            Tickets by failure type
                        </h4>
                        {failureTypeData.length === 0 ? (
                            <EmptyChart message="No failure type data" />
                        ) : (
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={failureTypeData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fontSize: 10 }}
                                        interval={0}
                                        angle={-20}
                                        textAnchor="end"
                                        height={50}
                                    />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                    <Tooltip />
                                    <Bar dataKey="value" fill="#EF4444" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                            Pass rate per run
                        </h4>
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={passRateData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Bar dataKey="passRate" fill="#10B981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Comparison table */}
            {comparison && comparison.runs.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            Run comparison
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-800/60 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                <tr>
                                    <th className="px-4 py-2 font-medium">Run</th>
                                    <th className="px-4 py-2 font-medium">Status</th>
                                    <th className="px-4 py-2 font-medium text-right">Total</th>
                                    <th className="px-4 py-2 font-medium text-right">Passed</th>
                                    <th className="px-4 py-2 font-medium text-right">Failed</th>
                                    <th className="px-4 py-2 font-medium text-right">Pass rate</th>
                                    <th className="px-4 py-2 font-medium text-right">Duration</th>
                                    <th className="px-4 py-2 font-medium text-right">Tickets</th>
                                    <th className="px-4 py-2 font-medium text-right">Resolved %</th>
                                    <th className="px-4 py-2 font-medium text-right">Failed w/o ticket</th>
                                    <th className="px-4 py-2 font-medium" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {comparison.runs.map((run) => (
                                    <ComparisonRow
                                        key={run.runId}
                                        run={run}
                                        onOpenRun={onOpenRun}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Unticketed failures */}
            {unticketed && unticketed.summary.failedCasesWithoutTickets > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-900/40 overflow-hidden">
                    <div className="px-4 py-3 border-b border-red-100 dark:border-red-900/40 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            Failed cases without a ticket
                        </h3>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            {unticketed.summary.failedCasesWithoutTickets} of{' '}
                            {unticketed.summary.totalFailedCases} failures (
                            {unticketed.summary.ticketedRate}% ticketed)
                        </span>
                    </div>
                    <div className="overflow-x-auto max-h-80 overflow-y-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-800/60 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2 font-medium">Test case</th>
                                    <th className="px-4 py-2 font-medium">Suite</th>
                                    <th className="px-4 py-2 font-medium">Area</th>
                                    <th className="px-4 py-2 font-medium">Run</th>
                                    <th className="px-4 py-2 font-medium">Executed by</th>
                                    <th className="px-4 py-2 font-medium">When</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {unticketed.items.map((item) => (
                                    <tr key={`${item.runId}-${item.itemId}`}>
                                        <td className="px-4 py-2 text-gray-900 dark:text-gray-100">
                                            {item.caseTitle}
                                        </td>
                                        <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                                            {item.suiteName || '—'}
                                        </td>
                                        <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                                            {item.area || '—'}
                                        </td>
                                        <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                                            {item.runDisplayId || item.runTitle}
                                        </td>
                                        <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                                            {item.executedBy || '—'}
                                        </td>
                                        <td className="px-4 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                            {formatDate(item.executedAt)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {!isLoadingRuns && runs.length > 0 && selectedRunIds.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
                    Select one or more runs above to see results and ticket analytics.
                </p>
            )}
        </div>
    );
};

const KpiCard: React.FC<{
    label: string;
    value: React.ReactNode;
    icon: React.ReactNode;
    tone: string;
}> = ({ label, value, icon, tone }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500">
            {icon}
            <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
        </div>
        <p className={`mt-1 text-xl font-semibold ${tone}`}>{value}</p>
    </div>
);

const ComparisonRow: React.FC<{
    run: RunComparisonItem;
    onOpenRun: (runId: string) => void;
}> = ({ run, onOpenRun }) => (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
        <td className="px-4 py-2">
            <div className="flex items-center gap-2">
                <IdDisplay
                    id={run.displayId || run.runId}
                    className="text-[10px] px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700"
                />
                <span className="text-gray-900 dark:text-gray-100 max-w-[180px] truncate">
                    {run.title}
                </span>
            </div>
        </td>
        <td className="px-4 py-2">
            <span
                className={`inline-flex px-1.5 py-0.5 rounded-full text-[11px] font-medium border ${getRunStatusColor(
                    run.status
                )}`}
            >
                {run.status}
            </span>
        </td>
        <td className="px-4 py-2 text-right text-gray-500 dark:text-gray-400">
            {run.statistics.total}
        </td>
        <td className="px-4 py-2 text-right text-green-600 dark:text-green-400">
            {run.statistics.passed}
        </td>
        <td className="px-4 py-2 text-right text-red-600 dark:text-red-400">
            {run.statistics.failed}
        </td>
        <td className="px-4 py-2 text-right font-medium text-gray-900 dark:text-gray-100">
            {run.statistics.passRate}%
        </td>
        <td className="px-4 py-2 text-right text-gray-500 dark:text-gray-400">
            {formatDuration(run.duration)}
        </td>
        <td className="px-4 py-2 text-right text-gray-500 dark:text-gray-400">
            {run.ticketSummary.total}
        </td>
        <td className="px-4 py-2 text-right text-gray-500 dark:text-gray-400">
            {run.ticketSummary.total > 0 ? `${run.ticketSummary.resolutionRate}%` : '—'}
        </td>
        <td className="px-4 py-2 text-right">
            {run.failedCasesWithoutTickets > 0 ? (
                                <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                                    <AlertTriangle className="w-3 h-3" />
                                    {run.failedCasesWithoutTickets}
                                </span>
                            ) : (
                                <span className="text-xs text-gray-300 dark:text-gray-600">0</span>
                            )}
        </td>
        <td className="px-4 py-2 text-right">
            <button
                onClick={() => onOpenRun(run.runId)}
                className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
                <Play className="w-3 h-3" />
                Open
            </button>
        </td>
    </tr>
);

const EmptyChart: React.FC<{ message: string }> = ({ message }) => (
    <div className="h-[220px] flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
        {message}
    </div>
);

export default TestRunAnalyticsTab;
