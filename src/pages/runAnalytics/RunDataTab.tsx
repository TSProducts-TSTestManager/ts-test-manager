import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, Download, FileText, Loader2, Play } from 'lucide-react';
import { reportingApi } from '../../services/reportingApi';
import { useAuthStore } from '../../store/authStore';
import { TestRunTrendPoint, TestRunTrendReport } from '../../types/testManager';
import { getRunStatusColor } from '../testManager/components/testRunUtils';
import { exportRunTrendsToExcel, exportRunTrendsToPDF } from '../../utils/exportRunTrends';
import ReportIdentityBar from '../../components/testManager/ReportIdentityBar';
import IdDisplay from '../../components/testManager/IdDisplay';
import toast from 'react-hot-toast';

interface RunDataTabProps {
    projectId: string;
    projectName?: string;
    startDate?: string;
    endDate?: string;
    groupId?: string;
    tags?: string[];
    onOpenRun: (runId: string) => void;
}

type SortKey =
    | 'sequence'
    | 'title'
    | 'total'
    | 'passed'
    | 'failed'
    | 'passRate'
    | 'duration'
    | 'ticketCount'
    | 'ticketResolutionRate';

const COLUMNS: Array<{ key: SortKey; label: string; align?: 'right'; sortable: boolean }> = [
    { key: 'sequence', label: '#', align: 'right', sortable: true },
    { key: 'title', label: 'Run', sortable: true },
    { key: 'total', label: 'Total', align: 'right', sortable: true },
    { key: 'passed', label: 'Passed', align: 'right', sortable: true },
    { key: 'failed', label: 'Failed', align: 'right', sortable: true },
    { key: 'passRate', label: 'Pass Rate', align: 'right', sortable: true },
    { key: 'duration', label: 'Duration', align: 'right', sortable: true },
    { key: 'ticketCount', label: 'Tickets', align: 'right', sortable: true },
    { key: 'ticketResolutionRate', label: 'Resolved %', align: 'right', sortable: true },
];

const formatDuration = (seconds: number): string => {
    if (!seconds || seconds <= 0) return '—';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const rest = Math.round(seconds % 60);
    return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`;
};

const sortValue = (point: TestRunTrendPoint, key: SortKey): number | string => {
    switch (key) {
        case 'title':
            return point.title.toLowerCase();
        case 'sequence':
            return point.sequence;
        default:
            return (point[key] as number) ?? 0;
    }
};

/**
 * "Run Data" tab: the flat, sortable per-run table behind the trend charts.
 * Same data source as Trend Overview, presented for scanning rather than plotting.
 */
const RunDataTab: React.FC<RunDataTabProps> = ({
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
    const [sortKey, setSortKey] = useState<SortKey>('sequence');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

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
                    setError((err as Error)?.message || 'Failed to load run data');
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

    const rows = useMemo(() => {
        const points = report?.points ?? [];
        const direction = sortDir === 'asc' ? 1 : -1;
        return [...points].sort((a, b) => {
            const av = sortValue(a, sortKey);
            const bv = sortValue(b, sortKey);
            if (typeof av === 'string' || typeof bv === 'string') {
                return String(av).localeCompare(String(bv)) * direction;
            }
            return (av - bv) * direction;
        });
    }, [report, sortKey, sortDir]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setSortKey(key);
        setSortDir(key === 'sequence' || key === 'title' ? 'asc' : 'desc');
    };

    const handleExportPdf = () => {
        if (!report) return;
        setIsExporting('pdf');
        try {
            exportRunTrendsToPDF(report, reportMeta);
        } catch (err) {
            toast.error((err as Error)?.message || 'Failed to export PDF report');
        } finally {
            setIsExporting(null);
        }
    };

    const handleExportExcel = async () => {
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
    };

    if (!projectId) return null;

    const summary = report?.summary;

    return (
        <div className="flex flex-col gap-3">
            {/* Compact toolbar */}
            <header className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                            Run Data
                        </h3>
                        {report && (
                            <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                {report.points.length} run(s) · oldest → newest
                            </span>
                        )}
                        {summary && (
                            <span className="hidden sm:inline text-[11px] text-gray-400 dark:text-gray-500">
                                avg {summary.averagePassRate}% pass · {summary.totalTickets} ticket(s)
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
                    <button
                        onClick={handleExportPdf}
                        disabled={!report || isExporting !== null}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-[11px] font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isExporting === 'pdf' ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <FileText className="w-3.5 h-3.5" />
                        )}
                        PDF
                    </button>
                    <button
                        onClick={handleExportExcel}
                        disabled={!report || isExporting !== null}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-[11px] font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isExporting === 'excel' ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Download className="w-3.5 h-3.5" />
                        )}
                        Excel
                    </button>
                </div>
            </header>

            {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                    <Play className="w-4 h-4" />
                    {error}
                </div>
            )}

            {isLoading && (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-16">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading run data...
                </div>
            )}

            {!isLoading && report && rows.length === 0 && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-16 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        No test runs in the selected range.
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Widen the date range or clear the group/tag filters.
                    </p>
                </div>
            )}

            {!isLoading && rows.length > 0 && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
                    <div className="overflow-auto max-h-[calc(100vh-15rem)]">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-800/60 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 sticky top-0 z-10">
                                <tr>
                                    {COLUMNS.map((col) => (
                                        <th
                                            key={col.key}
                                            onClick={() => handleSort(col.key)}
                                            className={`px-3 py-2.5 font-medium cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 whitespace-nowrap ${
                                                col.align === 'right' ? 'text-right' : ''
                                            }`}
                                        >
                                            <span className="inline-flex items-center gap-1">
                                                {col.label}
                                                <ArrowUpDown
                                                    className={`w-3 h-3 ${
                                                        sortKey === col.key
                                                            ? 'text-blue-500'
                                                            : 'opacity-0 group-hover:opacity-60'
                                                    }`}
                                                />
                                            </span>
                                        </th>
                                    ))}
                                    <th className="px-3 py-2.5 font-medium" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {rows.map((p) => (
                                    <tr
                                        key={p.runId}
                                        className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                    >
                                        <td className="px-3 py-1.5 text-right text-gray-400 dark:text-gray-500">
                                            {p.sequence}
                                        </td>
                                        <td className="px-3 py-1.5">
                                            <div className="flex items-center gap-2">
                                                <IdDisplay
                                                    id={p.displayId || p.runId}
                                                    className="text-[10px] px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700"
                                                />
                                                <span className="text-gray-900 dark:text-gray-100 max-w-[180px] truncate">
                                                    {p.title}
                                                </span>
                                                <span
                                                    className={`inline-flex px-1.5 py-0.5 rounded-full text-[11px] font-medium border ${getRunStatusColor(
                                                        p.status
                                                    )}`}
                                                >
                                                    {p.status}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-1.5 text-right text-gray-500 dark:text-gray-400">
                                            {p.total}
                                        </td>
                                        <td className="px-3 py-1.5 text-right text-green-600 dark:text-green-400">
                                            {p.passed}
                                        </td>
                                        <td className="px-3 py-1.5 text-right text-red-600 dark:text-red-400">
                                            {p.failed}
                                        </td>
                                        <td className="px-3 py-1.5 text-right font-medium text-gray-900 dark:text-gray-100">
                                            {p.passRate}%
                                        </td>
                                        <td className="px-3 py-1.5 text-right text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                            {formatDuration(p.duration)}
                                        </td>
                                        <td className="px-3 py-1.5 text-right text-gray-500 dark:text-gray-400">
                                            {p.ticketCount}
                                        </td>
                                        <td className="px-3 py-1.5 text-right text-gray-500 dark:text-gray-400">
                                            {p.ticketCount > 0
                                                ? `${p.ticketResolutionRate}%`
                                                : '—'}
                                        </td>
                                        <td className="px-3 py-1.5 text-right">
                                            <button
                                                onClick={() => onOpenRun(p.runId)}
                                                className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                            >
                                                <Play className="w-3 h-3" />
                                                Open
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RunDataTab;
