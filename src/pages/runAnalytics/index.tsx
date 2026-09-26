import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { BarChart3, FileText, LayoutGrid, Table2, TrendingUp } from 'lucide-react';
import { useTestManagerStore } from '../../store/testManagerStore';
import { testRunApi } from '../../services/testRunApi';
import { TestRunGroup } from '../../types/testManager';
import EmptyProjectState from '../../components/testManager/EmptyProjectState';
import ContextBreadcrumb from '../../components/testManager/ContextBreadcrumb';
import TagInput from '../../components/testManager/TagInput';
import RunComparisonTab from './RunComparisonTab';
import RunTrendOverviewTab from './RunTrendOverviewTab';
import RunDataTab from './RunDataTab';
import SingleRunReportTab from './SingleRunReportTab';

type SubTab = 'trend' | 'data' | 'singleRun' | 'comparison';

type DateRangePreset = '7d' | '30d' | '90d' | 'all' | 'custom';

const SUB_TABS: Array<{
    key: SubTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
}> = [
    { key: 'trend', label: 'Trend Overview', icon: TrendingUp },
    { key: 'data', label: 'Run Data', icon: Table2 },
    { key: 'singleRun', label: 'Single Run Report', icon: FileText },
    { key: 'comparison', label: 'Run Comparison', icon: LayoutGrid },
];

const TestRunAnalyticsPage: React.FC = () => {
    const { activeProject, projects } = useTestManagerStore();
    const navigate = useNavigate();

    const [subTab, setSubTab] = useState<SubTab>('trend');

    // ---- Own filter state (independent of the Analytics page) ----
    const [dateRange, setDateRange] = useState<DateRangePreset>('90d');
    const [customRange, setCustomRange] = useState({
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0],
    });
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
    const [runGroups, setRunGroups] = useState<TestRunGroup[]>([]);
    const [onlyRunsWithTickets, setOnlyRunsWithTickets] = useState(false);

    const currentProject = projects.find((p) => p.id === activeProject);
    const projectName = currentProject?.name;

    // Resolve the preset into concrete ISO bounds
    const resolvedRange = useMemo(() => {
        if (dateRange === 'custom') {
            return {
                startDate: new Date(customRange.start).toISOString(),
                endDate: new Date(`${customRange.end}T23:59:59`).toISOString(),
            };
        }
        const end = new Date();
        if (dateRange === 'all') {
            return { startDate: undefined, endDate: end.toISOString() };
        }
        const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
        const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
        return { startDate: start.toISOString(), endDate: end.toISOString() };
    }, [dateRange, customRange]);

    // Load group + tag filter options
    useEffect(() => {
        if (!activeProject) return;
        let cancelled = false;

        testRunApi
            .getTestRunGroups(activeProject)
            .then((groups) => {
                if (!cancelled) setRunGroups(groups);
            })
            .catch(() => {});

        testRunApi
            .getTagsByProject(activeProject)
            .then((tags) => {
                if (!cancelled) setTagSuggestions(tags);
            })
            .catch(() => {});

        return () => {
            cancelled = true;
        };
    }, [activeProject]);

    const handleOpenRun = useCallback(
        (runId: string) => {
            navigate(`/test-manager/runs?runId=${encodeURIComponent(runId)}`);
        },
        [navigate]
    );

    if (!activeProject) {
        return (
            <EmptyProjectState
                title="No Project Selected"
                description="Please select a project to view test run analytics"
            />
        );
    }

    return (
        <div className="flex flex-col h-auto md:h-full bg-white dark:bg-gray-900">
            {/* Header */}
            <div className="px-4 md:px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <ContextBreadcrumb
                    showSuiteSelector={false}
                    className="min-h-0 flex-1 min-w-0 border-b-0 px-0 py-0 sm:px-0"
                />
                <div className="flex items-center gap-2 mt-2">
                    <BarChart3 className="w-5 h-5 text-blue-500" />
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Test Run Analytics
                    </h1>
                    {projectName && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            — {projectName}
                        </span>
                    )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Track run-over-run trends, scan the sortable run data, download a
                    full report for any single run, or compare runs side by side.
                </p>
            </div>

            {/* Filters */}
            <div className="px-4 md:px-6 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Date range */}
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                        {(['7d', '30d', '90d', 'all', 'custom'] as const).map((range) => (
                            <button
                                key={range}
                                onClick={() => setDateRange(range)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                    dateRange === range
                                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                                }`}
                            >
                                {range === 'all' ? 'All' : range === 'custom' ? 'Custom' : range}
                            </button>
                        ))}
                    </div>

                    {dateRange === 'custom' && (
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={customRange.start}
                                max={customRange.end}
                                onChange={(e) =>
                                    setCustomRange({ ...customRange, start: e.target.value })
                                }
                                className="text-xs border border-gray-300 dark:border-gray-700 rounded-md px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                            <span className="text-gray-400 text-xs">to</span>
                            <input
                                type="date"
                                value={customRange.end}
                                min={customRange.start}
                                max={new Date().toISOString().split('T')[0]}
                                onChange={(e) =>
                                    setCustomRange({ ...customRange, end: e.target.value })
                                }
                                className="text-xs border border-gray-300 dark:border-gray-700 rounded-md px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                        </div>
                    )}

                    {/* Run group */}
                    <select
                        value={selectedGroupId}
                        onChange={(e) => setSelectedGroupId(e.target.value)}
                        className="text-xs border border-gray-300 dark:border-gray-700 rounded-md px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                        <option value="">All Run Groups</option>
                        {runGroups.map((group) => (
                            <option key={group.id} value={group.id}>
                                {group.name}
                            </option>
                        ))}
                    </select>

                    {/* Tags */}
                    <div className="min-w-[180px] max-w-xs flex-1">
                        <TagInput
                            tags={selectedTags}
                            suggestions={tagSuggestions}
                            onChange={setSelectedTags}
                            placeholder="Filter by tags"
                        />
                    </div>

                    {/* Runs with tickets only */}
                    <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={onlyRunsWithTickets}
                            onChange={(e) => setOnlyRunsWithTickets(e.target.checked)}
                            className="rounded border-gray-300 dark:border-gray-600"
                        />
                        With tickets only
                    </label>

                    {(selectedGroupId ||
                        selectedTags.length > 0 ||
                        onlyRunsWithTickets ||
                        dateRange !== '90d') && (
                        <button
                            onClick={() => {
                                setSelectedGroupId('');
                                setSelectedTags([]);
                                setOnlyRunsWithTickets(false);
                                setDateRange('90d');
                            }}
                            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
                        >
                            Reset filters
                        </button>
                    )}
                </div>
            </div>

            {/* Sub-tabs */}
            <div className="px-4 md:px-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <div className="flex gap-4 overflow-x-auto">
                    {SUB_TABS.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setSubTab(tab.key)}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                                subTab === tab.key
                                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                            }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content — only the active tab mounts, so no wasted fetching */}
            <div className="flex-1 sm:overflow-auto p-4 md:p-6">
                {subTab === 'trend' && (
                    <RunTrendOverviewTab
                        projectId={activeProject}
                        projectName={projectName}
                        startDate={resolvedRange.startDate}
                        endDate={resolvedRange.endDate}
                        groupId={selectedGroupId || undefined}
                        tags={selectedTags}
                        onOpenRun={handleOpenRun}
                    />
                )}
                {subTab === 'data' && (
                    <RunDataTab
                        projectId={activeProject}
                        projectName={projectName}
                        startDate={resolvedRange.startDate}
                        endDate={resolvedRange.endDate}
                        groupId={selectedGroupId || undefined}
                        tags={selectedTags}
                        onOpenRun={handleOpenRun}
                    />
                )}
                {subTab === 'singleRun' && (
                    <SingleRunReportTab
                        projectId={activeProject}
                        projectName={projectName}
                        startDate={resolvedRange.startDate}
                        endDate={resolvedRange.endDate}
                        groupId={selectedGroupId || undefined}
                        tags={selectedTags}
                        onlyRunsWithTickets={onlyRunsWithTickets}
                        onOpenRun={handleOpenRun}
                    />
                )}
                {subTab === 'comparison' && (
                    <RunComparisonTab
                        projectId={activeProject}
                        projectName={projectName}
                        startDate={resolvedRange.startDate}
                        endDate={resolvedRange.endDate}
                        groupId={selectedGroupId || undefined}
                        tags={selectedTags}
                        onlyRunsWithTickets={onlyRunsWithTickets}
                        onOpenRun={handleOpenRun}
                    />
                )}
            </div>
        </div>
    );
};

export default TestRunAnalyticsPage;
