import React, { useState, useEffect, useMemo } from 'react';
import { useTestManagerStore } from '../../store/testManagerStore';
import { getTestCasesByProject } from '../../services/testManagerApi';
import type { TestCaseResponse } from '../../types/api/testManager.api';
import { AutomationStatus, AutomationFixStatus } from '../../types/api/testManager.api';
import EmptyProjectState from '../../components/testManager/EmptyProjectState';
import ContextBreadcrumb from '../../components/testManager/ContextBreadcrumb';
import toast from 'react-hot-toast';
import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  Bot,
  CheckCircle2,
  Wrench,
  PlayCircle,
  Download,
  RefreshCw,
  FileSpreadsheet,
  Layers,
  Search
} from 'lucide-react';

const STATUS_COLORS = {
  Automated: '#10B981',
  Automatable: '#3B82F6',
  NotAutomatable: '#F59E0B',
  Created: '#8B5CF6',
  InProgress: '#3B82F6',
  Fixed: '#10B981',
  Fail: '#EF4444',
  ReadyForExecute: '#06B6D4',
  NotApplicable: '#9CA3AF'
};

const AutomationStatusPage: React.FC = () => {
  const { activeProject, projects, testSuites } = useTestManagerStore();
  const currentProject = projects.find((p) => p.id === activeProject);

  const [testCases, setTestCases] = useState<TestCaseResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [excludeArchived, setExcludeArchived] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedSuiteFilter, setSelectedSuiteFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [fixStatusFilter, setFixStatusFilter] = useState<string>('all');

  const fetchCases = async () => {
    if (!activeProject) return;
    setIsLoading(true);
    try {
      // Fetch all project cases respecting archive filter
      const cases = await getTestCasesByProject(activeProject, { archived: excludeArchived ? 'active' : 'archived' });
      setTestCases(cases);
    } catch (err: any) {
      toast.error('Failed to load automation status data: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, [activeProject, excludeArchived]);

  const [excludeUi, setExcludeUi] = useState<boolean>(true);

  // Active vs Filtered cases computation
  const filteredCases = useMemo(() => {
    return testCases.filter((tc) => {
      if (excludeArchived && tc.archived) return false;
      if (excludeUi && tc.testType === 'UI') return false;
      if (selectedSuiteFilter !== 'all' && tc.suiteId !== selectedSuiteFilter) return false;
      if (statusFilter !== 'all' && (tc.automationStatus || AutomationStatus.NotAutomatable) !== statusFilter) return false;
      if (fixStatusFilter !== 'all' && (tc.automationFixStatus || AutomationFixStatus.NotApplicable) !== fixStatusFilter) return false;
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const titleMatch = tc.title.toLowerCase().includes(query);
        const idMatch = (tc.displayId || tc.id).toLowerCase().includes(query);
        const suiteMatch = (tc.suite || '').toLowerCase().includes(query);
        if (!titleMatch && !idMatch && !suiteMatch) return false;
      }
      return true;
    });
  }, [testCases, excludeArchived, excludeUi, selectedSuiteFilter, statusFilter, fixStatusFilter, searchTerm]);

  // Metrics computation
  const metrics = useMemo(() => {
    const total = filteredCases.length;
    const automated = filteredCases.filter((c) => c.automationStatus === AutomationStatus.Automated).length;
    const automatable = filteredCases.filter((c) => c.automationStatus === AutomationStatus.Automatable).length;
    const notAutomatable = filteredCases.filter((c) => c.automationStatus === AutomationStatus.NotAutomatable || !c.automationStatus).length;

    const created = filteredCases.filter((c) => c.automationFixStatus === AutomationFixStatus.Created).length;
    const inProgress = filteredCases.filter((c) => c.automationFixStatus === AutomationFixStatus.InProgress).length;
    const fixed = filteredCases.filter((c) => c.automationFixStatus === AutomationFixStatus.Fixed).length;
    const fail = filteredCases.filter((c) => c.automationFixStatus === AutomationFixStatus.Fail).length;
    const readyForExecute = filteredCases.filter((c) => c.automationFixStatus === AutomationFixStatus.ReadyForExecute).length;
    const notApplicable = filteredCases.filter((c) => c.automationFixStatus === AutomationFixStatus.NotApplicable || !c.automationFixStatus).length;

    const automationCoverage = total > 0 ? ((automated / total) * 100).toFixed(1) : '0';

    return {
      total,
      automated,
      automatable,
      notAutomatable,
      created,
      inProgress,
      fixed,
      fail,
      readyForExecute,
      notApplicable,
      automationCoverage,
    };
  }, [filteredCases]);

  // Chart data formatting
  const statusPieData = useMemo(() => {
    return [
      { name: 'Automated', value: metrics.automated, color: STATUS_COLORS.Automated },
      { name: 'Automatable', value: metrics.automatable, color: STATUS_COLORS.Automatable },
      { name: 'Not Automatable', value: metrics.notAutomatable, color: STATUS_COLORS.NotAutomatable },
    ].filter((d) => d.value > 0);
  }, [metrics]);

  const fixStatusPieData = useMemo(() => {
    return [
      { name: 'Created', value: metrics.created, color: STATUS_COLORS.Created },
      { name: 'In Progress', value: metrics.inProgress, color: STATUS_COLORS.InProgress },
      { name: 'Fixed', value: metrics.fixed, color: STATUS_COLORS.Fixed },
      { name: 'Ready for Execute', value: metrics.readyForExecute, color: STATUS_COLORS.ReadyForExecute },
      { name: 'Fail', value: metrics.fail, color: STATUS_COLORS.Fail },
      { name: 'N/A', value: metrics.notApplicable, color: STATUS_COLORS.NotApplicable },
    ].filter((d) => d.value > 0);
  }, [metrics]);

  const suiteBreakdownData = useMemo(() => {
    const suiteMap: Record<string, { suiteName: string; automated: number; automatable: number; notAutomatable: number }> = {};
    filteredCases.forEach((tc) => {
      const sName = tc.suite || 'Unassigned Suite';
      if (!suiteMap[sName]) {
        suiteMap[sName] = { suiteName: sName, automated: 0, automatable: 0, notAutomatable: 0 };
      }
      if (tc.automationStatus === AutomationStatus.Automated) suiteMap[sName].automated++;
      else if (tc.automationStatus === AutomationStatus.Automatable) suiteMap[sName].automatable++;
      else suiteMap[sName].notAutomatable++;
    });
    return Object.values(suiteMap).slice(0, 10);
  }, [filteredCases]);

  // Export CSV handler
  const handleExportCSV = () => {
    if (!filteredCases.length) {
      toast.error('No test cases available to export');
      return;
    }

    const headers = [
      'Test Case ID',
      'Title',
      'Suite',
      'Priority',
      'Status',
      'Test Type',
      'Automation Status',
      'Automation Fix Status',
      'Last Automation Update',
      'Archived'
    ];

    const rows = filteredCases.map((tc) => [
      `"${tc.displayId || tc.id}"`,
      `"${tc.title.replace(/"/g, '""')}"`,
      `"${(tc.suite || '').replace(/"/g, '""')}"`,
      `"${tc.priority}"`,
      `"${tc.status}"`,
      `"${tc.testType || ''}"`,
      `"${tc.automationStatus || 'Not Automatable'}"`,
      `"${tc.automationFixStatus || 'Not Applicable'}"`,
      `"${tc.lastAutomationUpdateDate ? new Date(tc.lastAutomationUpdateDate).toLocaleString() : ''}"`,
      `"${tc.archived ? 'Yes' : 'No'}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${currentProject?.name || 'Project'}_Automation_Status_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filteredCases.length} test cases to CSV`);
  };

  if (!activeProject) {
    return <EmptyProjectState title="No Project Selected" description="Please select a project to view automation status and analytics." />;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Context Breadcrumb & Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <ContextBreadcrumb showSuiteSelector={false} />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mt-2">
            <Bot className="text-blue-600 dark:text-blue-400" size={28} />
            Test Automation Status & Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Real-time breakdown of automated test scripts, fix progress, and executable coverage.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
            <input
              type="checkbox"
              checked={excludeArchived}
              onChange={(e) => setExcludeArchived(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <span>Exclude Archived Cases</span>
          </label>

          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
            <input
              type="checkbox"
              checked={excludeUi}
              onChange={(e) => setExcludeUi(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <span>Exclude UI Cases</span>
          </label>

          <button
            onClick={fetchCases}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 shadow-sm transition-colors text-sm font-medium"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm font-medium text-sm transition-colors"
          >
            <Download size={16} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Test Cases */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Test Cases</span>
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <Layers size={20} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-gray-900 dark:text-white">{metrics.total}</span>
            <span className="text-xs text-gray-500">{excludeArchived ? 'Active cases' : 'All cases'}</span>
          </div>
          <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 flex justify-between">
            <span>Automated: <b>{metrics.automated}</b></span>
            <span>Coverage: <b className="text-emerald-600">{metrics.automationCoverage}%</b></span>
          </div>
        </div>

        {/* Card 2: Fully Automated */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Automated Cases</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">{metrics.automated}</span>
            <span className="text-xs text-emerald-600 font-semibold">{metrics.automationCoverage}% of total</span>
          </div>
          <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 flex justify-between">
            <span>Automatable: <b>{metrics.automatable}</b></span>
            <span>Not Automatable: <b>{metrics.notAutomatable}</b></span>
          </div>
        </div>

        {/* Card 3: Ready For Execution */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ready for Execution</span>
            <div className="p-2 bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-lg">
              <PlayCircle size={20} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-cyan-600 dark:text-cyan-400">{metrics.readyForExecute}</span>
            <span className="text-xs text-gray-500">Executable scripts</span>
          </div>
          <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 flex justify-between">
            <span>Created: <b>{metrics.created}</b></span>
            <span>Fixed: <b>{metrics.fixed}</b></span>
          </div>
        </div>

        {/* Card 4: In Progress & Fix Status */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Script Maintenance</span>
            <div className="p-2 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
              <Wrench size={20} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-purple-600 dark:text-purple-400">{metrics.created + metrics.inProgress}</span>
            <span className="text-xs text-purple-600 font-semibold">Active tasks</span>
          </div>
          <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 flex justify-between">
            <span>In Progress: <b>{metrics.inProgress}</b></span>
            <span className="text-rose-500 font-medium">Failed Fix: <b>{metrics.fail}</b></span>
          </div>
        </div>
      </div>

      {/* Analytics Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Automation Status Pie Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Bot size={18} className="text-blue-500" />
            Automation Status Breakdown
          </h2>
          <div className="h-64">
            {statusPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="value" label={({ name, percent }: { name?: string; percent?: number }) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`}>
                    {statusPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => [`${value} cases`, 'Count']} />
                  <Legend />
                </RechartsPie>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">No automation status data found</div>
            )}
          </div>
        </div>

        {/* Fix & Readiness Status Pie Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Wrench size={18} className="text-purple-500" />
            Script Fix & Readiness Progress
          </h2>
          <div className="h-64">
            {fixStatusPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie data={fixStatusPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="value" label={({ name, percent }: { name?: string; percent?: number }) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`}>
                    {fixStatusPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => [`${value} cases`, 'Count']} />
                  <Legend />
                </RechartsPie>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">No fix status data found</div>
            )}
          </div>
        </div>
      </div>

      {/* Bar Chart: Suite Coverage */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <FileSpreadsheet size={18} className="text-emerald-500" />
          Automation Coverage by Test Suite (Top 10)
        </h2>
        <div className="h-72">
          {suiteBreakdownData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={suiteBreakdownData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="suiteName" tick={{ fontSize: 12 }} interval={0} angle={-15} textAnchor="end" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="automated" name="Automated" fill={STATUS_COLORS.Automated} stackId="a" />
                <Bar dataKey="automatable" name="Automatable" fill={STATUS_COLORS.Automatable} stackId="a" />
                <Bar dataKey="notAutomatable" name="Not Automatable" fill={STATUS_COLORS.NotAutomatable} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">No suite data available</div>
          )}
        </div>
      </div>

      {/* Test Cases Automation Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {/* Table Filters Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-850/50 flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search by ID, title or suite..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
            {/* Filter by Suite */}
            <select
              value={selectedSuiteFilter}
              onChange={(e) => setSelectedSuiteFilter(e.target.value)}
              className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-gray-700 dark:text-gray-300"
            >
              <option value="all">All Suites</option>
              {testSuites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {/* Filter by Automation Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-gray-700 dark:text-gray-300"
            >
              <option value="all">All Automation Statuses</option>
              <option value={AutomationStatus.Automated}>Automated</option>
              <option value={AutomationStatus.Automatable}>Automatable</option>
              <option value={AutomationStatus.NotAutomatable}>Not Automatable</option>
            </select>

            {/* Filter by Fix Status */}
            <select
              value={fixStatusFilter}
              onChange={(e) => setFixStatusFilter(e.target.value)}
              className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-gray-700 dark:text-gray-300"
            >
              <option value="all">All Fix Statuses</option>
              <option value={AutomationFixStatus.Created}>Created</option>
              <option value={AutomationFixStatus.InProgress}>In Progress</option>
              <option value={AutomationFixStatus.Fixed}>Fixed</option>
              <option value={AutomationFixStatus.ReadyForExecute}>Ready for Execute</option>
              <option value={AutomationFixStatus.Fail}>Fail</option>
              <option value={AutomationFixStatus.NotApplicable}>Not Applicable</option>
            </select>
          </div>
        </div>

        {/* Detailed Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
            <thead className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 uppercase font-semibold border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3">Test ID</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Suite</th>
                <th className="px-4 py-3">Automation Status</th>
                <th className="px-4 py-3">Fix Status</th>
                <th className="px-4 py-3">Last Updated</th>
                <th className="px-4 py-3">Archived</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredCases.length > 0 ? (
                filteredCases.slice(0, 100).map((tc) => (
                  <tr key={tc.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-750/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                      {tc.displayId || tc.id.substring(0, 8)}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white max-w-md truncate">
                      {tc.title}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {tc.suite || 'Default Suite'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: `${STATUS_COLORS[tc.automationStatus as keyof typeof STATUS_COLORS] || '#9CA3AF'}20`,
                          color: STATUS_COLORS[tc.automationStatus as keyof typeof STATUS_COLORS] || '#9CA3AF'
                        }}
                      >
                        {tc.automationStatus || 'Not Automatable'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: `${STATUS_COLORS[tc.automationFixStatus as keyof typeof STATUS_COLORS] || '#9CA3AF'}20`,
                          color: STATUS_COLORS[tc.automationFixStatus as keyof typeof STATUS_COLORS] || '#9CA3AF'
                        }}
                      >
                        {tc.automationFixStatus || 'Not Applicable'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {tc.lastAutomationUpdateDate ? new Date(tc.lastAutomationUpdateDate).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {tc.archived ? (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">Yes</span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    {isLoading ? 'Loading automation details...' : 'No test cases match the active filter criteria.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredCases.length > 100 && (
          <div className="p-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-center text-xs text-gray-500">
            Showing top 100 test cases of {filteredCases.length}. Export CSV to view the entire set.
          </div>
        )}
      </div>
    </div>
  );
};

export default AutomationStatusPage;
