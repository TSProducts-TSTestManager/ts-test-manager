import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { shallow } from 'zustand/shallow';
import toast from 'react-hot-toast';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTestManagerStore, mapTicketResponse } from '../../store/testManagerStore';
import EmptyProjectState from '../../components/testManager/EmptyProjectState';
import TicketModal from '../../components/testManager/TicketModal';
import TicketFiltersSheet from '../../components/testManager/TicketFiltersSheet';
import TicketDetailView from './components/TicketDetailView';
import KanbanBoard from '../../components/testManager/KanbanBoard';
import {
    Ticket,
    TicketStatus,
    TicketPriority,
    TicketSeverity,
    FailureType,
} from '../../types/testManager';
import {
    Bug,
    Loader2,
    ChevronRight,
    X,
    Check,
    ChevronDown,
    Filter,
    LayoutList,
    SquareKanban,
    ArrowUp,
    ArrowDown,
    ArrowUpDown,
    Archive,
    ArchiveRestore,
    Search,
    Download,
} from 'lucide-react';
import IdDisplay from '../../components/testManager/IdDisplay';
import { exportTicketsToXLSX } from '../../utils/exportTickets';
import { CreateTicketRequest, UpdateTicketRequest, TicketListResponse } from '../../types/api/testManager.api';
import { useProjectWriteAccess } from '../../utils/projectPermissions';
import { ticketApi } from '../../services/ticketApi';
import { testRunApi } from '../../services/testRunApi';
import { useRealtimeTickets } from '../../hooks/useRealtimeTickets';
import { getTagColor } from '../../utils/tagColors';
import {
    getTicketStatusColor,
    getTicketPriorityColor,
    getTicketSeverityColor,
    getFailureTypeColor,
} from '../../utils/ticketColors';

const TICKETS_PAGE_SIZE = 30;

type TicketSortField =
    | 'createdAt'
    | 'updatedAt'
    | 'title'
    | 'status'
    | 'priority'
    | 'severity'
    | 'displayId'
    | 'team'
    | 'assignedTo';

const DATE_SORT_FIELDS: TicketSortField[] = ['createdAt', 'updatedAt'];

const getTicketPriorityBarColor = (priority: TicketPriority): string => {
    switch (priority) {
        case TicketPriority.Critical: return 'bg-red-500';
        case TicketPriority.High: return 'bg-orange-500';
        case TicketPriority.Medium: return 'bg-yellow-500';
        case TicketPriority.Low: return 'bg-blue-500';
        default: return 'bg-gray-400';
    }
};

const TicketsPage: React.FC = () => {
    const {
        activeProject,
        tickets,
        isLoading,
        createTicket,
        updateTicket,
        setActiveTicket,
        activeTicket,
        setTicketDetailViewOpen,
        setActiveProject,
        projects,
        ticketsTotal,
        setTicketsTotal,
        ticketView,
        setTicketView,
        updateTicketStatus,
        archiveTicket,
        restoreTicket,
        searchQuery,
        setSearchQuery,
        ensureProjectLoaded,
    } = useTestManagerStore(
        (state) => ({
            activeProject: state.activeProject,
            tickets: state.tickets,
            isLoading: state.isLoading,
            createTicket: state.createTicket,
            updateTicket: state.updateTicket,
            setActiveTicket: state.setActiveTicket,
            activeTicket: state.activeTicket,
            setTicketDetailViewOpen: state.setTicketDetailViewOpen,
            setActiveProject: state.setActiveProject,
            projects: state.projects,
            ticketsTotal: state.ticketsTotal,
            setTicketsTotal: state.setTicketsTotal,
            ticketView: state.ticketView,
            setTicketView: state.setTicketView,
            updateTicketStatus: state.updateTicketStatus,
            archiveTicket: state.archiveTicket,
            restoreTicket: state.restoreTicket,
            searchQuery: state.searchQuery,
            setSearchQuery: state.setSearchQuery,
            ensureProjectLoaded: state.ensureProjectLoaded,
        }),
        shallow
    );

    // Live collaboration: sync ticket changes across users in real time
    useRealtimeTickets({ projectId: activeProject });

    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const processedTicketIdRef = useRef<string | null>(null);
    const [testRunOptions, setTestRunOptions] = useState<{ id: string; title: string }[]>([]);

    // Quick filter state
    const [selectedStatusFilters, setSelectedStatusFilters] = useState<TicketStatus[]>([]);
    const [selectedPriorityFilters, setSelectedPriorityFilters] = useState<TicketPriority[]>([]);
    const [selectedSeverityFilters, setSelectedSeverityFilters] = useState<TicketSeverity[]>([]);
    const [selectedFailureTypeFilter, setSelectedFailureTypeFilter] = useState<FailureType | null>(null);
    const [selectedTeamFilter, setSelectedTeamFilter] = useState<string | null>(null);
    const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
    const [isPriorityFilterOpen, setIsPriorityFilterOpen] = useState(false);
    const [isSeverityFilterOpen, setIsSeverityFilterOpen] = useState(false);
    const [isFailureTypeFilterOpen, setIsFailureTypeFilterOpen] = useState(false);
    const [isTeamFilterOpen, setIsTeamFilterOpen] = useState(false);
    const [isMobileFilterSheetOpen, setIsMobileFilterSheetOpen] = useState(false);
    const filterDropdownRef = useRef<HTMLDivElement>(null);

    // Pagination state
    const [ticketsOffset, setTicketsOffset] = useState(0);
    const [ticketsHasMore, setTicketsHasMore] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // Table scope (active / archived) + server-side sort
    const [ticketScope, setTicketScope] = useState<'active' | 'archived'>('active');
    const [isExporting, setIsExporting] = useState(false);
    const [sortField, setSortField] = useState<TicketSortField>('createdAt');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    // Debounce the global header search before hitting the API
    const [debouncedSearch, setDebouncedSearch] = useState('');
    useEffect(() => {
        const handle = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
        return () => clearTimeout(handle);
    }, [searchQuery]);

    const handleSort = useCallback((field: TicketSortField) => {
        if (sortField === field) {
            setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setSortField(field);
        setSortDir(DATE_SORT_FIELDS.includes(field) ? 'desc' : 'asc');
    }, [sortField]);

    const renderSortableHeader = (label: string, field: TicketSortField, extraClass = '') => (
        <th
            onClick={() => handleSort(field)}
            title={`Sort by ${label}`}
            className={`text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none group hover:text-gray-700 dark:hover:text-gray-200 ${extraClass}`}
        >
            <span className="inline-flex items-center gap-1">
                {label}
                {sortField === field ? (
                    sortDir === 'asc'
                        ? <ArrowUp size={12} className="text-blue-500" />
                        : <ArrowDown size={12} className="text-blue-500" />
                ) : (
                    <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-60" />
                )}
            </span>
        </th>
    );

    const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
    const listContainerRef = useRef<HTMLDivElement>(null);
    const ticketsHasMoreRef = useRef(ticketsHasMore);
    const isLoadingMoreRef = useRef(isLoadingMore);
    const isLoadingRef = useRef(isLoading);
    const ticketsOffsetRef = useRef(ticketsOffset);
    ticketsHasMoreRef.current = ticketsHasMore;
    isLoadingMoreRef.current = isLoadingMore;
    isLoadingRef.current = isLoading;
    ticketsOffsetRef.current = ticketsOffset;

    const currentProject = projects.find((p) => p.id === activeProject);
    const projectMembers = currentProject?.members || [];
    // Project role guard: viewers are read-only (mirrors backend requireProjectWrite)
    const canWrite = useProjectWriteAccess(activeProject);

    // The assignee dropdown needs the active project's members. After a hard
    // refresh / deep link the project list is empty, so load that project on demand.
    useEffect(() => {
        if (activeProject && !projects.some((p) => p.id === activeProject)) {
            ensureProjectLoaded(activeProject);
        }
    }, [activeProject, projects, ensureProjectLoaded]);

    // Compute all unique tags from all tickets for auto-suggestions
    const allTags = useMemo(() => {
        const tagSet = new Set<string>();
        tickets.forEach((t) => t.tags.forEach((tag) => tagSet.add(tag)));
        return Array.from(tagSet).sort();
    }, [tickets]);

    // Client-side filtered tickets based on quick filters (shared by the table and the Excel export)
    const applyTicketFilters = useCallback((rows: Ticket[]) => {
        let result = rows;
        if (selectedStatusFilters.length > 0) {
            result = result.filter((t) => selectedStatusFilters.includes(t.status));
        }
        if (selectedPriorityFilters.length > 0) {
            result = result.filter((t) => selectedPriorityFilters.includes(t.priority));
        }
        if (selectedSeverityFilters.length > 0) {
            result = result.filter((t) => selectedSeverityFilters.includes(t.severity));
        }
        if (selectedFailureTypeFilter) {
            result = result.filter((t) => t.failureType === selectedFailureTypeFilter);
        }
        if (selectedTeamFilter) {
            result = result.filter((t) => t.team === selectedTeamFilter);
        }
        return result;
    }, [selectedStatusFilters, selectedPriorityFilters, selectedSeverityFilters, selectedFailureTypeFilter, selectedTeamFilter]);

    const filteredTickets = useMemo(
        () => applyTicketFilters(tickets),
        [tickets, applyTicketFilters]
    );

    // All unique teams for the team filter dropdown
    const allTeams = useMemo(() => {
        const teamSet = new Set<string>();
        tickets.forEach((t) => {
            if (t.team) teamSet.add(t.team);
        });
        return Array.from(teamSet).sort();
    }, [tickets]);

    // Virtualization setup
    const ROW_HEIGHT_ESTIMATE = 60;
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const [containerHeight, setContainerHeight] = useState(600);

    // Dynamically size the virtual container to fill available space
    useEffect(() => {
        const el = tableScrollRef.current;
        if (!el) return;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const h = entry.contentRect.height;
                if (h > 0) setContainerHeight(h);
            }
        });
        // Observe the parent so the scroll container can stretch to fill it
        if (el.parentElement) observer.observe(el.parentElement);
        return () => observer.disconnect();
    }, []);

    const rowVirtualizer = useVirtualizer({
        count: filteredTickets.length,
        getScrollElement: () => tableScrollRef.current,
        estimateSize: () => ROW_HEIGHT_ESTIMATE,
        overscan: 5,
    });

    // Trigger re-measurement when the dataset changes (e.g. real-time socket updates)
    const previousDataLength = useRef(filteredTickets.length);
    const measureRafId = useRef<number>(0);
    useEffect(() => {
        if (filteredTickets.length !== previousDataLength.current) {
            previousDataLength.current = filteredTickets.length;
            measureRafId.current = requestAnimationFrame(() => {
                rowVirtualizer.measure();
            });
        }
        return () => {
            if (measureRafId.current) {
                cancelAnimationFrame(measureRafId.current);
            }
        };
    }, [filteredTickets.length, rowVirtualizer]);

    const hasActiveFilters = selectedStatusFilters.length > 0 || selectedPriorityFilters.length > 0 || selectedSeverityFilters.length > 0 || !!selectedFailureTypeFilter || !!selectedTeamFilter || !!searchQuery.trim();

    const handleApplyFilters = useCallback((
        status: TicketStatus[],
        priority: TicketPriority[],
        severity: TicketSeverity[],
        failureType: FailureType | null,
        team: string | null,
    ) => {
        setSelectedStatusFilters(status);
        setSelectedPriorityFilters(priority);
        setSelectedSeverityFilters(severity);
        setSelectedFailureTypeFilter(failureType);
        setSelectedTeamFilter(team);
    }, []);

    // Export every ticket matching the active search/scope/quick filters — not just
    // the rows already loaded by the infinite-scroll list.
    const handleExportTickets = useCallback(async () => {
        if (!activeProject || isExporting) return;
        setIsExporting(true);
        try {
            const EXPORT_PAGE_SIZE = 200; // matches the backend limit cap
            const MAX_EXPORT_ROWS = 10000;
            const rows: Ticket[] = [];
            let offset = 0;
            let hasMore = true;

            while (hasMore && rows.length < MAX_EXPORT_ROWS) {
                const result = await ticketApi.getTicketsPaginated(activeProject, {
                    limit: EXPORT_PAGE_SIZE,
                    offset,
                    search: debouncedSearch || undefined,
                    sortField,
                    sortDir,
                    archived: ticketScope === 'archived' ? ('true' as const) : undefined,
                });
                const items = result.items.map(mapTicketResponse);
                rows.push(...items);
                offset += items.length;
                hasMore = result.meta.hasMore && items.length > 0 && offset < result.meta.total;
            }

            const exportable = applyTicketFilters(rows);
            exportTicketsToXLSX(exportable, {
                projectName: currentProject?.name,
                scope: ticketScope,
            });
            toast.success(
                `Exported ${exportable.length} ticket${exportable.length === 1 ? '' : 's'} to Excel`
            );
        } catch (error: unknown) {
            toast.error((error as Error).message || 'Failed to export tickets');
        } finally {
            setIsExporting(false);
        }
    }, [activeProject, isExporting, debouncedSearch, sortField, sortDir, ticketScope, currentProject, applyTicketFilters]);

    // Check for URL state to open create modal
    useEffect(() => {
        if (location.state && (location.state as { openNewTicket?: boolean }).openNewTicket) {
            setIsCreateModalOpen(true);
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    // Handle ticketId URL parameter for direct links
    useEffect(() => {
        const ticketId = searchParams.get('ticketId');

        if (!ticketId || processedTicketIdRef.current === ticketId) {
            return;
        }

        processedTicketIdRef.current = ticketId;

        const loadTicketFromUrl = async () => {
            try {
                const ticketResponse = await ticketApi.getTicketById(ticketId);
                const mappedTicket = mapTicketResponse(ticketResponse as TicketListResponse);

                if (ticketResponse.projectId) {
                    setActiveProject(ticketResponse.projectId);
                }

                setActiveTicket(mappedTicket);
                setTicketDetailViewOpen(true);

                setSearchParams({}, { replace: true });
            } catch (error) {
                console.error('Failed to load ticket from URL:', error);
                toast.error('Failed to load ticket. It may not exist or you may not have access.');
                setSearchParams({}, { replace: true });
            }
        };

        loadTicketFromUrl();
    }, [searchParams, setSearchParams, setActiveProject, setActiveTicket, setTicketDetailViewOpen]);

    // Handle failureType/team URL parameters for deep links from analytics
    useEffect(() => {
        const failureTypeParam = searchParams.get('failureType');
        const teamParam = searchParams.get('team');

        const next = new URLSearchParams(searchParams);

        if (failureTypeParam && (Object.values(FailureType) as string[]).includes(failureTypeParam)) {
            setSelectedFailureTypeFilter(failureTypeParam as FailureType);
            next.delete('failureType');
        }

        if (teamParam) {
            setSelectedTeamFilter(teamParam);
            next.delete('team');
        }

        if (next.toString() !== searchParams.toString()) {
            setSearchParams(next, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    // Handle status URL parameter for deep links (e.g. from the dashboard) — comma-separated multi-status
    useEffect(() => {
        const statusParam = searchParams.get('status');

        if (!statusParam) return;

        const statuses = statusParam
            .split(',')
            .filter((value): value is TicketStatus =>
                (Object.values(TicketStatus) as string[]).includes(value)
            );

        if (statuses.length > 0) {
            setSelectedStatusFilters(statuses);
        }

        const next = new URLSearchParams(searchParams);
        next.delete('status');
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams]);

    // Fetch tickets (paginated) when project or query params change
    const loadTickets = useCallback(async (reset = true, offsetValue = 0) => {
        if (!activeProject) return;
        const queryParams = {
            limit: TICKETS_PAGE_SIZE,
            search: debouncedSearch || undefined,
            sortField,
            sortDir,
            archived: ticketScope === 'archived' ? ('true' as const) : undefined,
        };
        if (reset) {
            useTestManagerStore.setState({ isLoading: true, error: null });
            try {
                const result = await ticketApi.getTicketsPaginated(activeProject, {
                    ...queryParams,
                    offset: 0,
                });
                useTestManagerStore.setState({
                    tickets: result.items.map(mapTicketResponse),
                    isLoading: false,
                });
                setTicketsTotal(result.meta.total);
                setTicketsOffset(result.items.length);
                setTicketsHasMore(result.meta.hasMore && result.items.length < result.meta.total);
            } catch (error: unknown) {
                useTestManagerStore.setState({
                    error: (error as Error).message,
                    isLoading: false,
                });
            }
        } else {
            setIsLoadingMore(true);
            try {
                const result = await ticketApi.getTicketsPaginated(activeProject, {
                    ...queryParams,
                    offset: offsetValue,
                });

                const currentTickets = useTestManagerStore.getState().tickets;
                const existingIds = new Set(currentTickets.map((t) => t.id));
                const incomingItems = result.items.filter((t) => !existingIds.has(t.id));
                if (incomingItems.length > 0) {
                    useTestManagerStore.setState((state) => ({
                        tickets: [...state.tickets, ...incomingItems.map(mapTicketResponse)],
                    }));
                }

                const totalLoaded = offsetValue + result.items.length;
                setTicketsOffset(totalLoaded);
                setTicketsTotal(result.meta.total);
                setTicketsHasMore(result.meta.hasMore && totalLoaded < result.meta.total);
            } catch (error: unknown) {
                toast.error((error as Error).message || 'Failed to load tickets');
            } finally {
                setIsLoadingMore(false);
            }
        }
    }, [activeProject, setTicketsTotal, debouncedSearch, sortField, sortDir, ticketScope]);

    const loadTicketsRef = useRef(loadTickets);
    loadTicketsRef.current = loadTickets;

    // Fetch tickets whenever the project or the query params change
    useEffect(() => {
        if (activeProject) {
            loadTickets(true);
        }
    }, [activeProject, loadTickets]);

    // Fetch test runs for the create modal dropdown when the project changes
    useEffect(() => {
        if (!activeProject) return;
        testRunApi.getTestRuns(activeProject)
            .then((runs) => setTestRunOptions(runs.map((r) => ({ id: r.id, title: r.title }))))
            .catch(() => {});
    }, [activeProject]);

    // Stable ref-based load-more handler — avoids recreating the IntersectionObserver
    // on every pagination load, preventing disconnect/reconnect churn.
    const handleLoadMoreTickets = useCallback(() => {
        if (!ticketsHasMoreRef.current || isLoadingMoreRef.current || isLoadingRef.current) return;
        loadTicketsRef.current(false, ticketsOffsetRef.current);
    }, []);

    // IntersectionObserver for infinite scroll
    useEffect(() => {
        if (!ticketsHasMore || isLoading || isLoadingMore) {
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
                    handleLoadMoreTickets();
                }
            },
            {
                root: listContainerRef.current,
                rootMargin: '200px 0px',
                threshold: 0,
            }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [ticketsHasMore, isLoading, isLoadingMore, handleLoadMoreTickets]);

    // Close filter dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
                setIsStatusFilterOpen(false);
                setIsPriorityFilterOpen(false);
                setIsSeverityFilterOpen(false);
                setIsFailureTypeFilterOpen(false);
                setIsTeamFilterOpen(false);
            }
        };

        if (isStatusFilterOpen || isPriorityFilterOpen || isSeverityFilterOpen || isFailureTypeFilterOpen || isTeamFilterOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isStatusFilterOpen, isPriorityFilterOpen, isSeverityFilterOpen, isFailureTypeFilterOpen, isTeamFilterOpen]);

    const handleCreateTicket = useCallback(async (data: {
        title: string;
        description?: string;
        priority: TicketPriority;
        severity: TicketSeverity;
        status?: TicketStatus;
        failureType?: FailureType;
        team?: string;
        assignedToId?: string | null;
        relatedRunId?: string;
        tags?: string[];
    }) => {
        if (!activeProject) return;
        if (!canWrite) {
            toast.error('You have read-only access to this project');
            return;
        }
        const request: CreateTicketRequest = {
            title: data.title,
            description: data.description,
            priority: data.priority,
            severity: data.severity,
            failureType: data.failureType,
            team: data.team,
            assignedToId: data.assignedToId || undefined,
            relatedRunId: data.relatedRunId,
            tags: data.tags,
        };
        await createTicket(activeProject, request);
        toast.success('Ticket created successfully');
    }, [activeProject, canWrite, createTicket]);

    const handleUpdateTicket = useCallback(async (data: {
        title?: string;
        description?: string;
        status?: TicketStatus;
        priority?: TicketPriority;
        severity?: TicketSeverity;
        failureType?: FailureType;
        team?: string;
        assignedToId?: string | null;
        relatedRunId?: string;
        tags?: string[];
    }) => {
        if (!activeProject || !activeTicket) return;
        if (!canWrite) {
            toast.error('You have read-only access to this project');
            return;
        }
        const request: UpdateTicketRequest = {
            title: data.title,
            description: data.description,
            status: data.status,
            priority: data.priority,
            severity: data.severity,
            failureType: data.failureType,
            team: data.team,
            assignedToId: data.assignedToId,
            relatedRunId: data.relatedRunId,
            tags: data.tags,
        };
        await updateTicket(activeProject, activeTicket.id, request);
        toast.success('Ticket updated');
    }, [activeProject, activeTicket, canWrite, updateTicket]);

    const handleArchiveTicket = useCallback(async () => {
        if (!activeProject || !activeTicket) return;
        if (!canWrite) {
            toast.error('You have read-only access to this project');
            return;
        }
        try {
            await archiveTicket(activeProject, activeTicket.id);
            setActiveTicket(null);
            setTicketDetailViewOpen(false);
            toast.success('Ticket archived');
            loadTicketsRef.current(true);
        } catch (error: unknown) {
            toast.error((error as Error).message || 'Failed to archive ticket');
        }
    }, [activeProject, activeTicket, canWrite, archiveTicket, setActiveTicket, setTicketDetailViewOpen]);

    const handleRestoreTicket = useCallback(async () => {
        if (!activeProject || !activeTicket) return;
        if (!canWrite) {
            toast.error('You have read-only access to this project');
            return;
        }
        try {
            await restoreTicket(activeProject, activeTicket.id);
            setActiveTicket(null);
            setTicketDetailViewOpen(false);
            toast.success('Ticket restored');
            loadTicketsRef.current(true);
        } catch (error: unknown) {
            toast.error((error as Error).message || 'Failed to restore ticket');
        }
    }, [activeProject, activeTicket, canWrite, restoreTicket, setActiveTicket, setTicketDetailViewOpen]);

    const openTicketDetail = useCallback(async (ticket: Ticket) => {
        setActiveTicket(ticket);
        setTicketDetailViewOpen(true);
        try {
            const detailResponse = await ticketApi.getTicketById(ticket.id);
            const mappedTicket = mapTicketResponse(detailResponse as TicketListResponse);
            setActiveTicket(mappedTicket);
        } catch (error) {
            console.error('Failed to load ticket detail:', error);
        }
    }, [setActiveTicket, setTicketDetailViewOpen]);

    const handleStatusChange = useCallback(async (ticketId: string, status: TicketStatus) => {
        if (!activeProject) return;
        if (!canWrite) {
            toast.error('You have read-only access to this project');
            return;
        }
        try {
            await updateTicketStatus(activeProject, ticketId, status);
            toast.success(`Ticket moved to ${status}`);
        } catch {
            toast.error('Failed to update ticket status');
        }
    }, [activeProject, canWrite, updateTicketStatus]);

    const closeTicketDetail = useCallback(() => {
        setActiveTicket(null);
        setTicketDetailViewOpen(false);
    }, [setActiveTicket, setTicketDetailViewOpen]);

    // No project selected
    if (!activeProject) {
        return (
            <EmptyProjectState
                title="No Project Selected"
                description="Please select a project to view and manage tickets"
            />
        );
    }

    return (
        <div className="flex flex-col h-auto md:h-full bg-white dark:bg-gray-900">
            {/* Header area with quick filters */}
            <div className="flex flex-wrap items-center justify-between gap-2 md:gap-3 px-3 md:px-6 py-3 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 md:sticky md:top-0 md:z-20">
                <div className="flex items-center gap-3 min-w-0 flex-1 md:flex-none">
                    <div className="flex items-center gap-2 min-w-0">
                        <Bug size={18} className="text-red-500 flex-shrink-0" />
                        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {ticketScope === 'archived' ? 'Archived Tickets' : 'Tickets'} ({ticketsTotal || tickets.length})
                        </h2>
                    </div>

                    {/* Desktop filter dropdowns */}
                    <div ref={filterDropdownRef} className="hidden md:flex items-center gap-2">
                    {/* Status Filter */}
                    <div className="relative">
                        <button
                            onClick={() => {
                                setIsStatusFilterOpen(!isStatusFilterOpen);
                                setIsPriorityFilterOpen(false);
                                setIsSeverityFilterOpen(false);
                            }}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border rounded-lg transition-colors ${
                                selectedStatusFilters.length > 0
                                    ? 'border-blue-400 dark:border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                            }`}
                        >
                            <Filter size={13} />
                            Status
                            {selectedStatusFilters.length > 0 && (
                                <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold bg-blue-500 text-white rounded-full">
                                    {selectedStatusFilters.length}
                                </span>
                            )}
                            <ChevronDown size={12} className={`text-gray-400 transition-transform ${isStatusFilterOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isStatusFilterOpen && (
                            <div className="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 py-1 z-50">
                                <div className="px-3 py-2 border-b border-gray-50 dark:border-gray-700">
                                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Status</p>
                                </div>
                                <div className="max-h-52 overflow-y-auto">
                                    {Object.values(TicketStatus).map((status) => (
                                        <button
                                            key={status}
                                            onClick={() =>
                                                setSelectedStatusFilters((prev) =>
                                                    prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
                                                )
                                            }
                                            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                                                selectedStatusFilters.includes(status)
                                                    ? 'bg-blue-50 dark:bg-blue-900/30'
                                                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                                            }`}
                                        >
                                            <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${getTicketStatusColor(status)}`}>
                                                {status}
                                            </span>
                                            {selectedStatusFilters.includes(status) && (
                                                <Check size={12} className="ml-auto text-blue-500 dark:text-blue-400 flex-shrink-0" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Priority Filter */}
                    <div className="relative">
                        <button
                            onClick={() => {
                                setIsPriorityFilterOpen(!isPriorityFilterOpen);
                                setIsStatusFilterOpen(false);
                                setIsSeverityFilterOpen(false);
                            }}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border rounded-lg transition-colors ${
                                selectedPriorityFilters.length > 0
                                    ? 'border-blue-400 dark:border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                            }`}
                        >
                            <Filter size={13} />
                            Priority
                            {selectedPriorityFilters.length > 0 && (
                                <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold bg-blue-500 text-white rounded-full">
                                    {selectedPriorityFilters.length}
                                </span>
                            )}
                            <ChevronDown size={12} className={`text-gray-400 transition-transform ${isPriorityFilterOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isPriorityFilterOpen && (
                            <div className="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 py-1 z-50">
                                <div className="px-3 py-2 border-b border-gray-50 dark:border-gray-700">
                                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Priority</p>
                                </div>
                                <div className="max-h-52 overflow-y-auto">
                                    {Object.values(TicketPriority).map((priority) => (
                                        <button
                                            key={priority}
                                            onClick={() =>
                                                setSelectedPriorityFilters((prev) =>
                                                    prev.includes(priority) ? prev.filter((p) => p !== priority) : [...prev, priority]
                                                )
                                            }
                                            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                                                selectedPriorityFilters.includes(priority)
                                                    ? 'bg-blue-50 dark:bg-blue-900/30'
                                                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                                            }`}
                                        >
                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${getTicketPriorityColor(priority)}`}>
                                                {priority}
                                            </span>
                                            {selectedPriorityFilters.includes(priority) && (
                                                <Check size={12} className="ml-auto text-blue-500 dark:text-blue-400 flex-shrink-0" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Severity Filter */}
                    <div className="relative">
                        <button
                            onClick={() => {
                                setIsSeverityFilterOpen(!isSeverityFilterOpen);
                                setIsStatusFilterOpen(false);
                                setIsPriorityFilterOpen(false);
                            }}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border rounded-lg transition-colors ${
                                selectedSeverityFilters.length > 0
                                    ? 'border-blue-400 dark:border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                            }`}
                        >
                            <Filter size={13} />
                            Severity
                            {selectedSeverityFilters.length > 0 && (
                                <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold bg-blue-500 text-white rounded-full">
                                    {selectedSeverityFilters.length}
                                </span>
                            )}
                            <ChevronDown size={12} className={`text-gray-400 transition-transform ${isSeverityFilterOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isSeverityFilterOpen && (
                            <div className="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 py-1 z-50">
                                <div className="px-3 py-2 border-b border-gray-50 dark:border-gray-700">
                                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Severity</p>
                                </div>
                                <div className="max-h-52 overflow-y-auto">
                                    {Object.values(TicketSeverity).map((severity) => (
                                        <button
                                            key={severity}
                                            onClick={() =>
                                                setSelectedSeverityFilters((prev) =>
                                                    prev.includes(severity) ? prev.filter((s) => s !== severity) : [...prev, severity]
                                                )
                                            }
                                            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                                                selectedSeverityFilters.includes(severity)
                                                    ? 'bg-blue-50 dark:bg-blue-900/30'
                                                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                                            }`}
                                        >
                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${getTicketSeverityColor(severity)}`}>
                                                {severity}
                                            </span>
                                            {selectedSeverityFilters.includes(severity) && (
                                                <Check size={12} className="ml-auto text-blue-500 dark:text-blue-400 flex-shrink-0" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Failure Type Filter */}
                    <div className="relative">
                        <button
                            onClick={() => {
                                setIsFailureTypeFilterOpen(!isFailureTypeFilterOpen);
                                setIsStatusFilterOpen(false);
                                setIsPriorityFilterOpen(false);
                                setIsSeverityFilterOpen(false);
                                setIsTeamFilterOpen(false);
                            }}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border rounded-lg transition-colors ${
                                selectedFailureTypeFilter
                                    ? 'border-blue-400 dark:border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                            }`}
                        >
                            <Filter size={13} />
                            Type
                            {selectedFailureTypeFilter && (
                                <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold bg-blue-500 text-white rounded-full">
                                    {1}
                                </span>
                            )}
                            <ChevronDown size={12} className={`text-gray-400 transition-transform ${isFailureTypeFilterOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isFailureTypeFilterOpen && (
                            <div className="absolute top-full right-0 mt-1 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 py-1 z-50">
                                <div className="px-3 py-2 border-b border-gray-50 dark:border-gray-700">
                                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Failure Type</p>
                                </div>
                                <button
                                    onClick={() => setSelectedFailureTypeFilter(null)}
                                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                                        !selectedFailureTypeFilter ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                                    }`}
                                >
                                    <span className="text-gray-500 dark:text-gray-400">All types</span>
                                    {!selectedFailureTypeFilter && <Check size={12} className="ml-auto text-blue-500 dark:text-blue-400 flex-shrink-0" />}
                                </button>
                                <div className="max-h-52 overflow-y-auto">
                                    {Object.values(FailureType).map((failureType) => (
                                        <button
                                            key={failureType}
                                            onClick={() => setSelectedFailureTypeFilter(failureType === selectedFailureTypeFilter ? null : failureType)}
                                            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                                                selectedFailureTypeFilter === failureType
                                                    ? 'bg-blue-50 dark:bg-blue-900/30'
                                                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                                            }`}
                                        >
                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${getFailureTypeColor(failureType)}`}>
                                                {failureType}
                                            </span>
                                            {selectedFailureTypeFilter === failureType && (
                                                <Check size={12} className="ml-auto text-blue-500 dark:text-blue-400 flex-shrink-0" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Team Filter */}
                    <div className="relative">
                        <button
                            onClick={() => {
                                setIsTeamFilterOpen(!isTeamFilterOpen);
                                setIsStatusFilterOpen(false);
                                setIsPriorityFilterOpen(false);
                                setIsSeverityFilterOpen(false);
                                setIsFailureTypeFilterOpen(false);
                            }}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border rounded-lg transition-colors ${
                                selectedTeamFilter
                                    ? 'border-blue-400 dark:border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                            }`}
                        >
                            <Filter size={13} />
                            Team
                            {selectedTeamFilter && (
                                <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold bg-blue-500 text-white rounded-full">
                                    {1}
                                </span>
                            )}
                            <ChevronDown size={12} className={`text-gray-400 transition-transform ${isTeamFilterOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isTeamFilterOpen && (
                            <div className="absolute top-full right-0 mt-1 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 py-1 z-50">
                                <div className="px-3 py-2 border-b border-gray-50 dark:border-gray-700">
                                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Team</p>
                                </div>
                                <button
                                    onClick={() => setSelectedTeamFilter(null)}
                                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                                        !selectedTeamFilter ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                                    }`}
                                >
                                    <span className="text-gray-500 dark:text-gray-400">All teams</span>
                                    {!selectedTeamFilter && <Check size={12} className="ml-auto text-blue-500 dark:text-blue-400 flex-shrink-0" />}
                                </button>
                                <div className="max-h-52 overflow-y-auto">
                                    {allTeams.length === 0 && (
                                        <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">No teams yet</p>
                                    )}
                                    {allTeams.map((team) => (
                                        <button
                                            key={team}
                                            onClick={() => setSelectedTeamFilter(team === selectedTeamFilter ? null : team)}
                                            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                                                selectedTeamFilter === team ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                                            }`}
                                        >
                                            <span className="text-gray-700 dark:text-gray-200">{team}</span>
                                            {selectedTeamFilter === team && (
                                                <Check size={12} className="ml-auto text-blue-500 dark:text-blue-400 flex-shrink-0" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Clear filters */}
                    {hasActiveFilters && (
                        <button
                            onClick={() => {
                                setSelectedStatusFilters([]);
                                setSelectedPriorityFilters([]);
                                setSelectedSeverityFilters([]);
                                setSelectedFailureTypeFilter(null);
                                setSelectedTeamFilter(null);
                                setSearchQuery('');
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                            title="Clear all filters"
                        >
                            <X size={13} />
                            Clear
                        </button>
                    )}
                    </div>
                </div>

                {/* Table search */}
                <div className="relative flex-shrink-0 w-full sm:w-56">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search tickets by ID, title, tag..."
                        aria-label="Search tickets"
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

                {/* Scope toggle: active / archived */}
                <div className="flex items-center p-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <button
                        onClick={() => setTicketScope('active')}
                        className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium transition-colors ${
                            ticketScope === 'active'
                                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                        title="Show active tickets"
                    >
                        <ArchiveRestore size={13} />
                        Active
                    </button>
                    <button
                        onClick={() => setTicketScope('archived')}
                        className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium transition-colors ${
                            ticketScope === 'archived'
                                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                        title="Show archived tickets"
                    >
                        <Archive size={13} />
                        Archived
                    </button>
                </div>

                {/* View toggle: list / kanban */}
                <div className="flex items-center gap-1 p-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <button
                        onClick={() => setTicketView('list')}
                        className={`flex items-center justify-center h-7 w-7 rounded-md transition-colors ${
                            ticketView === 'list'
                                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                        title="List view"
                        aria-label="Switch to list view"
                    >
                        <LayoutList size={14} />
                    </button>
                    <button
                        onClick={() => setTicketView('kanban')}
                        className={`flex items-center justify-center h-7 w-7 rounded-md transition-colors ${
                            ticketView === 'kanban'
                                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                        title="Kanban board"
                        aria-label="Switch to kanban board"
                    >
                        <SquareKanban size={14} />
                    </button>
                </div>

                {/* Export the filtered ticket list to Excel */}
                <button
                    onClick={handleExportTickets}
                    disabled={isExporting}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-lg transition-colors flex-shrink-0 disabled:opacity-60 disabled:cursor-wait"
                    title="Export all tickets matching the current filters to Excel"
                >
                    {isExporting ? (
                        <Loader2 size={13} className="animate-spin" />
                    ) : (
                        <Download size={13} />
                    )}
                    {isExporting ? 'Exporting…' : 'Export Excel'}
                </button>

                {/* Mobile Filters button */}
                <button
                    onClick={() => setIsMobileFilterSheetOpen(true)}
                    className={`md:hidden flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors flex-shrink-0 ${
                        hasActiveFilters
                            ? 'border-blue-400 dark:border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                    aria-label="Open ticket filters"
                >
                    <Filter size={13} />
                    Filters
                    {hasActiveFilters && (
                        <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold bg-blue-500 text-white rounded-full">
                            {selectedStatusFilters.length + selectedPriorityFilters.length + selectedSeverityFilters.length + (selectedFailureTypeFilter ? 1 : 0) + (selectedTeamFilter ? 1 : 0)}
                        </span>
                    )}
                </button>
            </div>

            {/* Loading state */}
            {isLoading && tickets.length === 0 && (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="animate-spin text-gray-400" size={32} />
                </div>
            )}

            {/* Empty state - no tickets at all / no search results */}
            {!isLoading && tickets.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <Bug size={48} className="text-gray-300 dark:text-gray-600 mb-4" />
                    <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
                        {searchQuery.trim()
                            ? 'No tickets match your search'
                            : ticketScope === 'archived'
                            ? 'No archived tickets'
                            : 'No tickets yet'}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mb-4 max-w-sm">
                        {searchQuery.trim()
                            ? `Nothing found for "${searchQuery.trim()}". Try a ticket ID, title, or tag.`
                            : ticketScope === 'archived'
                            ? 'Tickets you archive will be listed here and can be restored at any time.'
                            : 'Create your first ticket to track bugs, issues, or tasks for this project.'}
                    </p>
                    {searchQuery.trim() ? (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <X size={16} />
                            Clear Search
                        </button>
                    ) : ticketScope === 'active' && (
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            disabled={!canWrite}
                            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={canWrite ? undefined : 'You have read-only access to this project'}
                        >
                            Create Ticket
                        </button>
                    )}
                </div>
            )}

            {/* Empty state - no tickets match filters */}
            {!isLoading && tickets.length > 0 && filteredTickets.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <Filter size={40} className="text-gray-300 dark:text-gray-600 mb-4" />
                    <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">No tickets match filters</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mb-4 max-w-sm">
                        Try adjusting or clearing your filters to see all tickets.
                    </p>
                    <button
                        onClick={() => {
                            setSelectedStatusFilters([]);
                            setSelectedPriorityFilters([]);
                            setSelectedSeverityFilters([]);
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <X size={16} />
                        Clear Filters
                    </button>
                </div>
            )}

            {/* Ticket list - Kanban board */}
            {filteredTickets.length > 0 && ticketView === 'kanban' && (
                <div className="flex-1 min-h-0 flex flex-col">
                    <div className="flex-1 min-h-0 overflow-hidden">
                        <KanbanBoard
                            tickets={filteredTickets}
                            onOpenTicket={openTicketDetail}
                            onStatusChange={handleStatusChange}
                            onLoadMore={handleLoadMoreTickets}
                            hasMore={ticketsHasMore}
                            isLoadingMore={isLoadingMore}
                        />
                    </div>

                    {/* Status text */}
                    <div className="flex justify-end px-4 md:px-6 py-1.5">
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                            {hasActiveFilters ? (
                                <>Showing {filteredTickets.length} of {tickets.length} tickets</>
                            ) : (
                                <>Loaded {Math.min(ticketsOffset, tickets.length)} / {ticketsTotal || tickets.length} tickets</>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Ticket list */}
            {filteredTickets.length > 0 && ticketView === 'list' && (
                <div ref={listContainerRef} className="flex-1 overflow-auto">
                    {/* Desktop table */}
                    <div
                        ref={tableScrollRef}
                        className="hidden md:block"
                        style={{ height: containerHeight, overflowY: 'auto' }}
                    >
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-100 dark:border-gray-700 sticky top-0 z-10 bg-white dark:bg-gray-900">
                                {renderSortableHeader('Ticket ID', 'displayId')}
                                {renderSortableHeader('Title', 'title', 'px-6')}
                                {renderSortableHeader('Status', 'status')}
                                {renderSortableHeader('Priority', 'priority')}
                                {renderSortableHeader('Severity', 'severity')}
                                {renderSortableHeader('Assigned To', 'assignedTo')}
                                {renderSortableHeader('Created', 'createdAt')}
                                <th className="w-10 px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Spacer row for virtual scroll offset above visible rows */}
                            {rowVirtualizer.getVirtualItems().length > 0 && (
                                <tr aria-hidden="true">
                                    <td style={{ height: rowVirtualizer.getVirtualItems()[0]?.start ?? 0, padding: 0, border: 'none' }} />
                                </tr>
                            )}
                            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                const ticket = filteredTickets[virtualRow.index];
                                if (!ticket) return null;
                                return (
                                <tr
                                    key={ticket.id}
                                    onClick={() => openTicketDetail(ticket)}
                                    className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                                >
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <IdDisplay
                                            id={ticket.displayId || ticket.id}
                                            className="text-xs text-gray-600 dark:text-gray-300"
                                        />
                                        {ticket.archived && (
                                            <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                                                Archived
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-3">
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-2">
                                                <Bug size={14} className="text-red-400 flex-shrink-0" />
                                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-xs">
                                                    {ticket.title}
                                                </span>
                                            </div>
                                            {ticket.tags.length > 0 && (
                                                <div className="flex items-center gap-1 ml-6">
                                                    {ticket.tags.slice(0, 3).map((tag) => (
                                                        <span
                                                            key={tag}
                                                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${getTagColor(tag)}`}
                                                        >
                                                            {tag}
                                                        </span>
                                                    ))}
                                                    {ticket.tags.length > 3 && (
                                                        <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-0.5">
                                                            +{ticket.tags.length - 3}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            {(ticket.failureType || ticket.team || ticket.firstReproducedAt || (ticket.returnedCount ?? 0) > 0) && (
                                                <div className="flex items-center gap-1 ml-6 mt-0.5 flex-wrap">
                                                    {ticket.failureType && (
                                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${getFailureTypeColor(ticket.failureType)}`}>
                                                            {ticket.failureType}
                                                        </span>
                                                    )}
                                                    {ticket.team && (
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                                            {ticket.team}
                                                        </span>
                                                    )}
                                                    {ticket.firstReproducedAt && (
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                                                            Reproduced
                                                        </span>
                                                    )}
                                                    {(ticket.returnedCount ?? 0) > 0 && (
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                                                            Returned ×{ticket.returnedCount}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTicketStatusColor(ticket.status)}`}>
                                            {ticket.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getTicketPriorityColor(ticket.priority)}`}>
                                            {ticket.priority}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getTicketSeverityColor(ticket.severity)}`}>
                                            {ticket.severity}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {ticket.assignedTo ? (
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-[100px]">
                                                    {ticket.assignedTo.name}
                                                </span>
                                                <img
                                                    src={ticket.assignedTo.avatar}
                                                    alt={ticket.assignedTo.name}
                                                    className="h-6 w-6 rounded-full border border-gray-200 dark:border-gray-600"
                                                />
                                            </div>
                                        ) : (
                                            <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="text-sm text-gray-600 dark:text-gray-400">
                                            {new Date(ticket.createdAt).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                            })}
                                        </div>
                                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                            {new Date(ticket.createdAt).toLocaleTimeString('en-US', {
                                                hour: 'numeric',
                                                minute: '2-digit',
                                                hour12: true
                                            })}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <ChevronRight size={14} className="text-gray-400" />
                                    </td>
                                </tr>
                                );
                            })}
                            {(() => {
                                const visibleRows = rowVirtualizer.getVirtualItems();
                                const lastVisibleRow = visibleRows[visibleRows.length - 1];
                                const bottomPad = lastVisibleRow
                                    ? rowVirtualizer.getTotalSize() - lastVisibleRow.end
                                    : 0;
                                return bottomPad > 0 ? (
                                    <tr aria-hidden="true">
                                        <td style={{ height: bottomPad, padding: 0, border: 'none' }} />
                                    </tr>
                                ) : null;
                            })()}
                        </tbody>
                    </table>
                    </div>

                    {/* Mobile ticket cards */}
                    <div className="md:hidden px-2 pt-2 pb-1">
                        {filteredTickets.map((ticket) => (
                            <div
                                key={ticket.id}
                                onClick={() => openTicketDetail(ticket)}
                                className="relative mac-card overflow-hidden cursor-pointer transition-all active:scale-[0.98] mb-3"
                            >
                                {/* Priority Color Bar */}
                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${getTicketPriorityBarColor(ticket.priority)}`} />

                                <div className="p-4 pl-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            {/* Top Row: Status, Priority, Severity */}
                                            <div className="flex items-center flex-wrap gap-1.5 mb-2">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTicketStatusColor(ticket.status)}`}>
                                                    {ticket.status}
                                                </span>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getTicketPriorityColor(ticket.priority)}`}>
                                                    {ticket.priority}
                                                </span>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getTicketSeverityColor(ticket.severity)}`}>
                                                    {ticket.severity}
                                                </span>
                                                {ticket.failureType && (
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getFailureTypeColor(ticket.failureType)}`}>
                                                        {ticket.failureType}
                                                    </span>
                                                )}
                                                {ticket.firstReproducedAt && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                                                        Reproduced
                                                    </span>
                                                )}
                                                {(ticket.returnedCount ?? 0) > 0 && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                                                        Returned ×{ticket.returnedCount}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Ticket ID + Title */}
                                            <div className="flex items-center gap-2 mb-1">
                                                <IdDisplay
                                                    id={ticket.displayId || ticket.id}
                                                    className="text-[11px] text-gray-500 dark:text-gray-400"
                                                />
                                                {ticket.archived && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                                                        Archived
                                                    </span>
                                                )}
                                            </div>
                                            <h4 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 leading-snug line-clamp-2">
                                                {ticket.title}
                                            </h4>

                                            {/* Tags */}
                                            {ticket.tags.length > 0 && (
                                                <div className="flex items-center gap-1 mt-2">
                                                    {ticket.tags.slice(0, 3).map((tag) => (
                                                        <span
                                                            key={tag}
                                                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${getTagColor(tag)}`}
                                                        >
                                                            {tag}
                                                        </span>
                                                    ))}
                                                    {ticket.tags.length > 3 && (
                                                        <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                                            +{ticket.tags.length - 3}
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Footer: Assignee & Date */}
                                            <div className="mt-4 flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    {ticket.assignedTo ? (
                                                        <>
                                                            <img
                                                                src={ticket.assignedTo.avatar}
                                                                alt={ticket.assignedTo.name}
                                                                className="h-5 w-5 rounded-full border border-gray-200 dark:border-gray-700 flex-shrink-0"
                                                            />
                                                            <span className="text-xs text-gray-600 dark:text-gray-400 font-medium truncate">
                                                                {ticket.assignedTo.name}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span className="text-xs text-gray-400 dark:text-gray-500">Unassigned</span>
                                                    )}
                                                </div>
                                                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-tight flex-shrink-0">
                                                    {new Date(ticket.createdAt).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                    })}
                                                </span>
                                            </div>
                                        </div>

                                        <ChevronRight className="h-5 w-5 text-gray-300 dark:text-gray-600 flex-shrink-0 mt-1" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Load more sentinel */}
                    {ticketsHasMore && (
                        <div ref={loadMoreSentinelRef} className="flex justify-center py-2">
                            {isLoadingMore && (
                                <div className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Loading more tickets...
                                </div>
                            )}
                        </div>
                    )}

                    {/* Status text */}
                    <div className="flex justify-end px-4 md:px-0">
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                            {hasActiveFilters ? (
                                <>Showing {filteredTickets.length} of {tickets.length} tickets</>
                            ) : (
                                <>Loaded {Math.min(ticketsOffset, tickets.length)} / {ticketsTotal || tickets.length} tickets</>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Create Ticket Modal */}
            <TicketModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSubmit={handleCreateTicket}
                    projectMembers={projectMembers.map((m) => ({ id: m.id, name: m.name, email: m.email, active: m.active }))}
                testRuns={testRunOptions}
                tagSuggestions={allTags}
            />

            {/* Mobile Filter Sheet */}
            <TicketFiltersSheet
                isOpen={isMobileFilterSheetOpen}
                onClose={() => setIsMobileFilterSheetOpen(false)}
                selectedStatus={selectedStatusFilters}
                selectedPriority={selectedPriorityFilters}
                selectedSeverity={selectedSeverityFilters}
                selectedFailureType={selectedFailureTypeFilter}
                selectedTeam={selectedTeamFilter}
                teams={allTeams}
                onApply={handleApplyFilters}
            />

            {/* Ticket Detail View */}
            {activeTicket && (
                <TicketDetailView
                    ticket={activeTicket}
                    onClose={closeTicketDetail}
                    onUpdate={handleUpdateTicket}
                    onArchive={handleArchiveTicket}
                    onRestore={handleRestoreTicket}
                projectMembers={projectMembers.map((m) => ({ id: m.id, name: m.name, email: m.email, active: m.active }))}
                    testRuns={testRunOptions}
                    tagSuggestions={allTags}
                />
            )}
        </div>
    );
};

export default TicketsPage;
