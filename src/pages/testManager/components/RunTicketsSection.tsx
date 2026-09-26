import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Clock,
    Loader2,
    Ticket as TicketIcon,
    User,
} from 'lucide-react';
import { reportingApi } from '../../../services/reportingApi';
import {
    DetailedRunReport,
    LinkedTicket,
    RunTicketSummary,
    TicketStatus,
} from '../../../types/testManager';
import {
    getFailureTypeColor,
    getTicketPriorityColor,
    getTicketSeverityColor,
    getTicketStatusColor,
} from '../../../utils/ticketColors';
import IdDisplay from '../../../components/testManager/IdDisplay';

interface RunTicketsSectionProps {
    runId: string;
    /** Pre-known count so the header can render before the fetch resolves */
    ticketCount?: number;
}

const SUMMARY_TILES: Array<{
    key: keyof RunTicketSummary | 'unassigned' | 'avgTtr';
    label: string;
    tone: string;
}> = [
    { key: 'total', label: 'Total', tone: 'text-gray-900 dark:text-gray-100' },
    { key: 'resolutionRate', label: 'Resolved %', tone: 'text-green-600 dark:text-green-400' },
    { key: 'reproducedCount', label: 'Reproduced', tone: 'text-blue-600 dark:text-blue-400' },
    { key: 'returnedCount', label: 'Returned', tone: 'text-amber-600 dark:text-amber-400' },
    { key: 'unassigned', label: 'Unassigned', tone: 'text-gray-500 dark:text-gray-400' },
    { key: 'avgTtr', label: 'Avg TTR (h)', tone: 'text-purple-600 dark:text-purple-400' },
];

const formatDateTime = (value?: Date | string | null): string => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString();
};

/**
 * Expandable "Tickets" section for a test run: summary KPIs, every ticket
 * raised from the run (grouped by run item) and the unticketed failures.
 */
const RunTicketsSection: React.FC<RunTicketsSectionProps> = ({ runId, ticketCount }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [report, setReport] = useState<DetailedRunReport | null>(null);

    const load = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await reportingApi.getDetailedRunReport(runId);
            setReport(data);
        } catch (err) {
            setError((err as Error)?.message || 'Failed to load run tickets');
        } finally {
            setIsLoading(false);
        }
    }, [runId]);

    // Lazy load the first time the section is opened
    useEffect(() => {
        if (isOpen && !report && !isLoading) {
            void load();
        }
        // Re-fetch when the run changes
    }, [isOpen, runId]); // eslint-disable-line react-hooks/exhaustive-deps

    const summary = report?.ticketSummary;
    const tickets = report?.tickets ?? [];
    const unticketedFailures = useMemo(
        () =>
            (report?.items ?? []).filter(
                (item) =>
                    item.status === 'Failed' && (item.linkedTickets?.length ?? 0) === 0
            ),
        [report]
    );

    const totalTickets = summary?.total ?? ticketCount ?? 0;

    return (
        <div className="border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className="w-full flex items-center gap-2 px-3 sm:px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                aria-expanded={isOpen}
            >
                {isOpen ? (
                    <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                )}
                <TicketIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Tickets
                </span>
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-semibold rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {totalTickets}
                </span>
                {summary && summary.returnedCount > 0 && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="w-3 h-3" />
                        {summary.returnedCount} returned
                    </span>
                )}
                {unticketedFailures.length > 0 && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400">
                        <AlertTriangle className="w-3 h-3" />
                        {unticketedFailures.length} failed without ticket
                    </span>
                )}
                {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400 ml-auto" />}
            </button>

            {isOpen && (
                <div className="px-3 sm:px-4 pb-4 space-y-4 max-h-[50vh] overflow-y-auto">
                    {error && (
                        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                            <AlertTriangle className="w-4 h-4" />
                            {error}
                            <button
                                onClick={() => void load()}
                                className="underline text-xs ml-1"
                            >
                                Retry
                            </button>
                        </div>
                    )}

                    {!report && isLoading && (
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-4">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading run tickets...
                        </div>
                    )}

                    {report && tickets.length === 0 && unticketedFailures.length === 0 && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
                            No tickets were raised from this run.
                        </p>
                    )}

                    {/* Summary tiles */}
                    {summary && (
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            {SUMMARY_TILES.map(({ key, label, tone }) => {
                                const value =
                                    key === 'unassigned'
                                        ? summary.ticketsUnassigned
                                        : key === 'avgTtr'
                                          ? summary.avgTimeToReproduceHours ?? '—'
                                          : (summary[key] as number);
                                return (
                                    <div
                                        key={key}
                                        className="rounded-lg border border-gray-100 dark:border-gray-700 px-2 py-2"
                                    >
                                        <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                            {label}
                                        </p>
                                        <p className={`text-sm font-semibold ${tone}`}>{value}</p>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Tickets grouped by run item */}
                    {tickets.length > 0 && (
                        <div className="space-y-3">
                            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Tickets ({tickets.length})
                            </h4>
                            {tickets.map((ticket) => (
                                <RunTicketRow
                                    key={ticket.ticketId}
                                    ticket={ticket}
                                />
                            ))}
                        </div>
                    )}

                    {/* Failures with no ticket */}
                    {unticketedFailures.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
                                Failed without a ticket ({unticketedFailures.length})
                            </h4>
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
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const RunTicketRow: React.FC<{ ticket: LinkedTicket }> = ({ ticket }) => (
    <div className="rounded-lg border border-gray-100 dark:border-gray-700 px-3 py-2 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
            <IdDisplay
                id={ticket.displayId || ticket.ticketId}
                className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded"
            />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {ticket.title}
            </span>
            <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium ${getTicketStatusColor(
                    ticket.status as TicketStatus
                )}`}
            >
                {ticket.status}
            </span>
            <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium ${getTicketPriorityColor(
                    ticket.priority as never
                )}`}
            >
                {ticket.priority}
            </span>
            <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium ${getTicketSeverityColor(
                    ticket.severity as never
                )}`}
            >
                {ticket.severity}
            </span>
            {ticket.failureType && (
                <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium ${getFailureTypeColor(
                        ticket.failureType as never
                    )}`}
                >
                    {ticket.failureType}
                </span>
            )}
        </div>
        <div className="flex items-center gap-3 flex-wrap text-[11px] text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1">
                <User className="w-3 h-3" />
                {ticket.assignedTo?.name || 'Unassigned'}
            </span>
            <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDateTime(ticket.createdAt)}
            </span>
            {ticket.firstReproducedAt && (
                <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                    <CheckCircle2 className="w-3 h-3" />
                    Reproduced
                </span>
            )}
            {ticket.returnedCount > 0 && (
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="w-3 h-3" />
                    Returned {ticket.returnedCount}×
                    {ticket.lastReturnReason ? ` (${ticket.lastReturnReason})` : ''}
                </span>
            )}
        </div>
    </div>
);

export default RunTicketsSection;
