import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Award,
    Download,
    FileText,
    Loader2,
    Minus,
    Table2,
    Ticket as TicketIcon,
    TrendingDown,
    TrendingUp,
} from 'lucide-react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { reportingApi } from '../../services/reportingApi';
import { useAuthStore } from '../../store/authStore';
import { TestRunTrendPoint, TestRunTrendReport } from '../../types/testManager';
import { exportRunTrendsToExcel, exportRunTrendsToPDF } from '../../utils/exportRunTrends';
import ReportIdentityBar from '../../components/testManager/ReportIdentityBar';
import IdDisplay from '../../components/testManager/IdDisplay';
import toast from 'react-hot-toast';

interface RunTrendOverviewTabProps {
    projectId: string;
    projectName?: string;
    startDate?: string;
    endDate?: string;
    groupId?: string;
    tags?: string[];
    onOpenRun: (runId: string) => void;
}

const formatDuration = (seconds: number): string => {
    if (!seconds || seconds <= 0) return '—';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const rest = Math.round(seconds % 60);
    return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`;
};

/** X-axis label: the sequential Run ID, falling back to a short title. */
const pointLabel = (point: TestRunTrendPoint): string =>
    point.displayId || `#${point.sequence}`;

/** One titled card — the building block of the 4-block layout. */
const Block: React.FC<{
    title: string;
    icon: React.ReactNode;
    subtitle?: string;
    action?: React.ReactNode;
    children: React.ReactNode;
}> = ({ title, icon, subtitle, action, children }) => (
    <section className="flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
        <header className="flex items-center gap-2 px-4 pt-3 pb-2">
            <span className="text-gray-400 dark:text-gray-500">{icon}</span>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                {title}
            </h4>
            {subtitle && (
                <span className="hidden sm:inline text-[11px] text-gray-400 dark:text-gray-500 truncate">
                    {subtitle}
                </span>
            )}
            {action && <div className="ml-auto">{action}</div>}
        </header>
        <div className="flex-1 min-h-0 px-2 pb-3">{children}</div>
    </section>
);

const Metric: React.FC<{
    label: string;
    value: React.ReactNode;
    tone?: string;
}> = ({ label, value, tone = 'text-gray-900 dark:text-gray-100' }) => (
    <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 truncate">
            {label}
        </p>
        <p className={`text-base font-semibold leading-tight truncate ${tone}`}>{value}</p>
    </div>
);

const RunTrendOverviewTab: React.FC<RunTrendOverviewTabProps> = ({
    projectId,
    projectName,
    startDate,
    endDate,
    groupId,
    tags,
    onOpenRun,
}) => {
    const [report, setReport] = useState<TestRunTrendReport | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState<'pdf' | 'excel' | null>(null);

    const currentUser = useAuthStore((state) => state.user);
    const reportMeta = useMemo(
        () => ({ author: { name: currentUser?.name, email: currentUser?.email } }),
        [currentUser?.name, currentUser?.email]
    );

    useEffect(() => {
        if (!projectId) return;
        let cancelled = false;

        const load = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const data = await reportingApi.getTestRunTrends(projectId, {
                    startDate,
                    endDate,
                    groupId,
                    tags: tags && tags.length > 0 ? tags : undefined,
                });
                if (!cancelled) setReport(data);
            } catch (err) {
                if (!cancelled) {
                    setReport(null);
                    setError((err as Error)?.message || 'Failed to load run trends');
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [projectId, startDate, endDate, groupId, tags]);

    const points = useMemo(() => report?.points ?? [], [report]);

    /** Chart-ready series: label + the metrics we plot. */
    const series = useMemo(
        () =>
            points.map((p) => ({
                label: pointLabel(p),
                passRate: p.passRate,
                passed: p.passed,
                failed: p.failed,
                blocked: p.blocked,
                skipped: p.skipped,
                durationMinutes: Math.round((p.duration / 60) * 10) / 10,
                ticketCount: p.ticketCount,
                ticketResolutionRate: p.ticketResolutionRate,
            })),
        [points]
    );

    const handleExportPdf = useCallback(() => {
        if (!report) return;
        setIsExporting('pdf');
        try {
            exportRunTrendsToPDF(report, reportMeta);
        } catch (err) {
            toast.error((err as Error)?.message || 'Failed to export PDF report');
        } finally {
            setIsExporting(null);
        }
    }, [report, reportMeta]);

    const handleExportExcel = useCallback(async () => {
        if (!report) return;
        setIsExporting('excel');
        try {
            const filename = await exportRunTrendsToExcel(report, reportMeta);
            toast.success(`Downloaded ${filename}`);
        } catch (err) {
            toast.error((err as Error)?.message || 'Failed to export Excel report');
        } finally {
            setIsExporting(null);
        }
    }, [report, reportMeta]);

    if (!projectId) return null;

    const summary = report?.summary;
    const trendMeta =
        summary?.trendDirection === 'improving'
            ? {
                  Icon: TrendingUp,
                  tone: 'text-green-600 dark:text-green-400',
                  bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
                  label: 'Improving',
              }
            : summary?.trendDirection === 'declining'
              ? {
                    Icon: TrendingDown,
                    tone: 'text-red-600 dark:text-red-400',
                    bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
                    label: 'Declining',
                }
              : {
                    Icon: Minus,
                    tone: 'text-gray-500 dark:text-gray-400',
                    bg: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
                    label: 'Stable',
                };

    const exportButton = (kind: 'pdf' | 'excel', label: string, icon: React.ReactNode) => (
        <button
            onClick={kind === 'pdf' ? handleExportPdf : handleExportExcel}
            disabled={!report || isExporting !== null}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-[11px] font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {isExporting === kind ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
                icon
            )}
            {label}
        </button>
    );

    return (
        <div className="flex flex-col gap-3">
            {/* Compact toolbar */}
            <header className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                            Trend Overview
                        </h3>
                        {report && (
                            <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                {report.points.length} run(s) · oldest → newest
                            </span>
                        )}
                        {summary && points.length > 0 && points.length < 3 && (
                            <span
                                className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                                title="Trend direction needs at least 3 completed runs"
                            >
                                needs 3+ runs
                            </span>
                        )}
                    </div>
                    <ReportIdentityBar
                        projectName={report?.projectName || projectName}
                        clientName={report?.clientName}
                        authorName={reportMeta.author.name}
                        authorEmail={reportMeta.author.email}
                    />
                </div>
                <div className="flex items-center gap-1.5">
                    {exportButton('pdf', 'PDF', <FileText className="w-3.5 h-3.5" />)}
                    {exportButton('excel', 'Excel', <Download className="w-3.5 h-3.5" />)}
                </div>
            </header>

            {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                    <Minus className="w-4 h-4" />
                    {error}
                </div>
            )}

            {isLoading && (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-16">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading run trends...
                </div>
            )}

            {!isLoading && report && points.length === 0 && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-16 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        No test runs in the selected range.
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Widen the date range or clear the group/tag filters.
                    </p>
                </div>
            )}

            {!isLoading && summary && points.length > 0 && (
                <>
                    {/* ---- 4 blocks: 2x2 on wide screens, no page scroll ---- */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {/* Block 1 — Performance summary */}
                        <Block
                            title="Performance Summary"
                            icon={<TrendingUp className="w-3.5 h-3.5" />}
                            subtitle={`${summary.totalRuns} runs`}
                        >
                            <div className="h-full flex flex-col gap-3 px-2">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2.5">
                                    <Metric
                                        label="Avg Pass Rate"
                                        value={`${summary.averagePassRate}%`}
                                        tone="text-green-600 dark:text-green-400"
                                    />
                                    <Metric
                                        label="Trend"
                                        value={
                                            <span
                                                className={`inline-flex items-center gap-1 ${trendMeta.tone}`}
                                            >
                                                <trendMeta.Icon className="w-4 h-4" />
                                                {trendMeta.label}
                                                {summary.changePercentage !== 0 && (
                                                    <span className="text-[11px] font-medium">
                                                        {summary.changePercentage > 0 ? '+' : ''}
                                                        {summary.changePercentage}
                                                    </span>
                                                )}
                                            </span>
                                        }
                                    />
                                    <Metric
                                        label="Avg Duration"
                                        value={formatDuration(summary.averageDuration)}
                                    />
                                    <Metric
                                        label="Tickets Raised"
                                        value={summary.totalTickets}
                                        tone="text-purple-600 dark:text-purple-400"
                                    />
                                    <Metric
                                        label="Ticket Resolution"
                                        value={
                                            summary.totalTickets > 0
                                                ? `${summary.averageTicketResolutionRate}%`
                                                : '—'
                                        }
                                        tone="text-blue-600 dark:text-blue-400"
                                    />
                                    <Metric
                                        label="Runs With Tickets"
                                        value={`${summary.runsWithTickets}/${summary.totalRuns}`}
                                        tone="text-gray-600 dark:text-gray-300"
                                    />
                                </div>

                                {/* Best / worst strip */}
                                <div className="mt-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {summary.bestRun && (
                                        <RunPill
                                            tone="good"
                                            label="Best"
                                            point={summary.bestRun}
                                            onOpenRun={onOpenRun}
                                        />
                                    )}
                                    {summary.worstRun &&
                                        summary.worstRun.runId !== summary.bestRun?.runId && (
                                            <RunPill
                                                tone="bad"
                                                label="Worst"
                                                point={summary.worstRun}
                                                onOpenRun={onOpenRun}
                                            />
                                        )}
                                    {!summary.bestRun && (
                                        <p className="text-[11px] text-gray-400 dark:text-gray-500">
                                            No scored runs yet.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </Block>

                        {/* Block 2 — Pass rate per run */}
                        <Block
                            title="Pass Rate per Run"
                            icon={<TrendingUp className="w-3.5 h-3.5" />}
                            subtitle="Execution quality trend"
                        >
                            <ResponsiveContainer width="100%" height={188}>
                                <LineChart data={series} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={44} />
                                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" width={46} />
                                    <Tooltip
                                        formatter={(value) => [`${Number(value)}%`, 'Pass rate']}
                                        labelFormatter={(label) => `Run ${String(label)}`}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="passRate"
                                        stroke="#10B981"
                                        strokeWidth={2}
                                        dot={{ r: 2.5 }}
                                        activeDot={{ r: 5 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </Block>

                        {/* Block 3 — Results breakdown per run */}
                        <Block
                            title="Results Breakdown"
                            icon={<Table2 className="w-3.5 h-3.5" />}
                            subtitle="Passed / Failed / Blocked / Skipped"
                        >
                            <ResponsiveContainer width="100%" height={188}>
                                <BarChart data={series} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={44} />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={46} />
                                    <Tooltip />
                                    <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10 }} />
                                    <Bar dataKey="passed" name="Passed" stackId="a" fill="#10B981" />
                                    <Bar dataKey="failed" name="Failed" stackId="a" fill="#EF4444" />
                                    <Bar dataKey="blocked" name="Blocked" stackId="a" fill="#F59E0B" />
                                    <Bar dataKey="skipped" name="Skipped" stackId="a" fill="#9CA3AF" radius={[3, 3, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </Block>

                        {/* Block 4 — Tickets per run */}
                        <Block
                            title="Tickets per Run"
                            icon={<TicketIcon className="w-3.5 h-3.5" />}
                            subtitle="Raised vs resolution %"
                        >
                            <ResponsiveContainer width="100%" height={188}>
                                <LineChart data={series} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={44} />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} yAxisId="left" width={40} />
                                    <YAxis
                                        allowDecimals={false}
                                        tick={{ fontSize: 10 }}
                                        yAxisId="right"
                                        orientation="right"
                                        domain={[0, 100]}
                                        unit="%"
                                        width={40}
                                    />
                                    <Tooltip />
                                    <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10 }} />
                                    <Line
                                        yAxisId="left"
                                        type="monotone"
                                        dataKey="ticketCount"
                                        name="Tickets"
                                        stroke="#8B5CF6"
                                        strokeWidth={2}
                                        dot={{ r: 2.5 }}
                                    />
                                    <Line
                                        yAxisId="right"
                                        type="monotone"
                                        dataKey="ticketResolutionRate"
                                        name="Resolution %"
                                        stroke="#14B8A6"
                                        strokeWidth={2}
                                        strokeDasharray="4 3"
                                        dot={{ r: 2 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </Block>
                    </div>

                </>
            )}
        </div>
    );
};

const RunPill: React.FC<{
    tone: 'good' | 'bad';
    label: string;
    point: TestRunTrendPoint;
    onOpenRun: (runId: string) => void;
}> = ({ tone, label, point, onOpenRun }) => (
    <div
        className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 min-w-0 ${
            tone === 'good'
                ? 'border-green-200 dark:border-green-900/40 bg-green-50/60 dark:bg-green-900/10'
                : 'border-red-200 dark:border-red-900/40 bg-red-50/60 dark:bg-red-900/10'
        }`}
    >
        <Award
            className={`w-3.5 h-3.5 flex-shrink-0 ${
                tone === 'good'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
            }`}
        />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex-shrink-0">
            {label}
        </span>
        <IdDisplay
            id={point.displayId || point.runId}
            className="text-[10px] px-1 py-0.5 rounded bg-white dark:bg-gray-800 flex-shrink-0"
        />
        <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
            {point.title}
        </span>
        <span
            className={`ml-auto text-sm font-semibold flex-shrink-0 ${
                tone === 'good'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
            }`}
        >
            {point.passRate}%
        </span>
        <button
            onClick={() => onOpenRun(point.runId)}
            className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex-shrink-0"
        >
            Open
        </button>
    </div>
);

export default RunTrendOverviewTab;
