import React, { useState, useEffect, useMemo } from 'react';
import { useTestManagerStore } from '../../store/testManagerStore';
import { getTestCasesByProject } from '../../services/testManagerApi';
import { getClients } from '../../services/clientApi';
import type { TestCaseResponse } from '../../types/api/testManager.api';
import { AutomationStatus, AutomationFixStatus } from '../../types/api/testManager.api';
import EmptyProjectState from '../../components/testManager/EmptyProjectState';
import ContextBreadcrumb from '../../components/testManager/ContextBreadcrumb';
import toast from 'react-hot-toast';
import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { exportAutomationStatusToPDF, exportAutomationStatusToExcel } from '../../utils/exportAutomationStatus';
import { useAuthStore } from '../../store/authStore';
import {
  Bot,
  CheckCircle2,
  PlayCircle,
  Download,
  RefreshCw,
  Layers,
  Search,
  FilePlus,
  Clock,
  AlertCircle
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
  const user = useAuthStore((state) => state.user);

  const [testCases, setTestCases] = useState<TestCaseResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [excludeArchived, setExcludeArchived] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedSuiteFilter, setSelectedSuiteFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [fixStatusFilter, setFixStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'details'>('overview');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  const [clientInfo, setClientInfo] = useState<{ displayId?: string; name?: string } | null>(null);

  useEffect(() => {
    let isMounted = true;
    getClients().then((clients) => {
      if (!isMounted) return;
      const targetClientId = currentProject?.clientId || user?.clientId;
      const found = clients.find(c => c._id === targetClientId || c.displayId === targetClientId) || clients[0];
      if (found) {
        setClientInfo({ displayId: found.displayId, name: found.name });
      }
    }).catch(() => {
      // Fallback if client call unpermitted
    });
    return () => { isMounted = false; };
  }, [currentProject?.clientId, user?.clientId]);

  const fetchCases = React.useCallback(async () => {
    if (!activeProject) return;
    setIsLoading(true);
    try {
      // Fetch all project cases respecting archive filter
      const cases = await getTestCasesByProject(activeProject, { archived: excludeArchived ? 'active' : 'archived' });
      setTestCases(cases);
    } catch (err: unknown) {
      toast.error('Failed to load automation status data: ' + ((err as Error).message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [activeProject, excludeArchived]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  // Active vs Filtered cases computation
  const filteredCases = useMemo(() => {
    return testCases.filter((tc) => {
      if (excludeArchived && tc.archived) return false;
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
  }, [testCases, excludeArchived, selectedSuiteFilter, statusFilter, fixStatusFilter, searchTerm]);

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

    const automatableBase = automated + automatable;
    const automationCoverage = automatableBase > 0 ? ((automated / automatableBase) * 100).toFixed(1) : '0';

    return {
      total,
      automated,
      automatable,
      automatableBase,
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

  const pieCharts = useMemo(() => {
    return [
      {
        title: 'Total vs Automatable',
        data: [
          { name: 'Automatable', value: metrics.automatableBase, color: STATUS_COLORS.Automatable },
          { name: 'Not Automatable', value: metrics.notAutomatable, color: STATUS_COLORS.NotAutomatable },
        ].filter((d) => d.value > 0),
      },
      {
        title: 'Automatable vs Created',
        data: [
          { name: 'Created', value: metrics.created, color: STATUS_COLORS.Created },
          { name: 'Not Created', value: Math.max(0, metrics.automatableBase - metrics.created), color: '#9CA3AF' },
        ].filter((d) => d.value > 0),
      },
      {
        title: 'Created vs Fixed',
        data: [
          { name: 'Fixed', value: metrics.fixed, color: STATUS_COLORS.Fixed },
          { name: 'Not Fixed', value: Math.max(0, metrics.created - metrics.fixed), color: '#9CA3AF' },
        ].filter((d) => d.value > 0),
      },
      {
        title: 'Created vs In Progress',
        data: [
          { name: 'In Progress', value: metrics.inProgress, color: STATUS_COLORS.InProgress },
          { name: 'Not In Progress', value: Math.max(0, metrics.created - metrics.inProgress), color: '#9CA3AF' },
        ].filter((d) => d.value > 0),
      },
      {
        title: 'Created vs Ready',
        data: [
          { name: 'Ready for Execute', value: metrics.readyForExecute, color: STATUS_COLORS.ReadyForExecute },
          { name: 'Not Ready', value: Math.max(0, metrics.created - metrics.readyForExecute), color: '#9CA3AF' },
        ].filter((d) => d.value > 0),
      },
      {
        title: 'Created vs Fail',
        data: [
          { name: 'Fail', value: metrics.fail, color: STATUS_COLORS.Fail },
          { name: 'Not Fail', value: Math.max(0, metrics.created - metrics.fail), color: '#9CA3AF' },
        ].filter((d) => d.value > 0),
      },
    ];
  }, [metrics]);

  const paginatedCases = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCases.slice(start, start + itemsPerPage);
  }, [filteredCases, currentPage]);

  const totalPages = Math.ceil(filteredCases.length / itemsPerPage);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedSuiteFilter, statusFilter, fixStatusFilter, excludeArchived]);

  // Dynamic reportMeta object helper
  const getDynamicReportMeta = () => {
    const rawClientId = currentProject?.clientId || user?.clientId || undefined;
    const isMongoId = (id?: string | null) => !!(id && /^[0-9a-fA-F]{24}$/.test(id));
    
    // Resolve clean display IDs (e.g. CLT-0001 instead of MongoDB ObjectId 6ab3dc547b4e841c53dac2e3)
    const resolvedClientId = clientInfo?.displayId || (isMongoId(rawClientId) ? 'CLT-0001' : rawClientId) || 'CLT-0001';
    const resolvedClientName = clientInfo?.name || (resolvedClientId === 'CLT-0001' ? 'TSInternal' : 'TSConnect');
    
    const resolvedProjectId = currentProject?.displayId || (isMongoId(currentProject?.id) ? 'PRJ-0001' : currentProject?.id) || 'PRJ-0001';
    const resolvedProjectName = currentProject?.name || 'TSConnect';

    return {
      clientName: resolvedClientName,
      clientId: resolvedClientId,
      projectName: resolvedProjectName,
      projectId: resolvedProjectId,
      author: {
        name: user ? user.name : 'System Admin',
        email: user ? user.email : ''
      },
      generatedAt: new Date().toLocaleString()
    };
  };

  // Export PDF handler
  const exportPDF = async () => {
    if (!currentProject) return;
    const toastId = toast.loading('Generating PDF report...');
    try {
      await exportAutomationStatusToPDF(currentProject, metrics, getDynamicReportMeta(), pieCharts);
      toast.success('PDF report generated successfully', { id: toastId });
    } catch (err: any) {
      toast.error('Failed to generate PDF: ' + (err.message || 'Unknown error'), { id: toastId });
    }
  };

  // Export Excel handler
  const handleExportExcel = async () => {
    if (!currentProject) return;
    if (!filteredCases.length) {
      toast.error('No test cases available to export');
      return;
    }
    const toastId = toast.loading('Generating Excel report with embedded charts...');
    try {
      await exportAutomationStatusToExcel(currentProject, metrics, filteredCases, getDynamicReportMeta());
      toast.success(`Exported ${filteredCases.length} test cases to Excel successfully`, { id: toastId });
    } catch (err: any) {
      toast.error('Failed to generate Excel report: ' + (err.message || 'Unknown error'), { id: toastId });
    }
  };

  if (!activeProject) {
    return <EmptyProjectState title="No Project Selected" description="Please select a project to view automation status and analytics." />;
  }

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900 overflow-auto p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
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

            <button
              onClick={fetchCases}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 shadow-sm transition-colors text-sm font-medium"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>

            <button
              onClick={exportPDF}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-sm font-medium text-sm transition-colors"
            >
              <Download size={16} />
              <span>PDF Report</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm font-medium text-sm transition-colors"
            >
              <FilePlus size={16} />
              <span>Excel Report</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
              activeTab === 'details'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Detailed Data
          </button>
        </div>

        {activeTab === 'overview' && (
          <div id="overview-content" className="space-y-6">

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {/* Card 1: Total Test Cases */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Test Cases In {currentProject?.name || 'Project'}</span>
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <Layers size={20} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-gray-900 dark:text-white">{metrics.total}</span>
            <span className="text-xs text-gray-500">{excludeArchived ? 'Active cases' : 'All cases'}</span>
          </div>
          <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 flex justify-between">
            <span>Automatable: <b className="text-blue-600 dark:text-blue-400">{metrics.automatableBase} ({((metrics.automatableBase / (metrics.total || 1)) * 100).toFixed(1)}%)</b></span>
            <span>Not Automatable: <b className="text-amber-600 dark:text-amber-400">{metrics.notAutomatable} ({((metrics.notAutomatable / (metrics.total || 1)) * 100).toFixed(1)}%)</b></span>
          </div>
        </div>

        {/* Card 2: Automatable Test Cases */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Automatable Test Cases</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">{metrics.automatableBase}</span>
            <span className="text-xs text-emerald-600 font-semibold">Cases to automate</span>
          </div>
          <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 flex justify-between">
            <span>Automated: <b className="text-emerald-600 dark:text-emerald-400">{metrics.automated}</b></span>
            <span>Coverage: <b className="text-emerald-600 dark:text-emerald-400">{metrics.automationCoverage}%</b></span>
          </div>
        </div>
      </div>

      {/* Fix Status Breakdown Details */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Created', value: metrics.created, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/30', icon: FilePlus },
          { label: 'In Progress', value: metrics.inProgress, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30', icon: Clock },
          { label: 'Fixed', value: metrics.fixed, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30', icon: CheckCircle2 },
          { label: 'Ready for Execute', value: metrics.readyForExecute, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-900/30', icon: PlayCircle },
          { label: 'Fail', value: metrics.fail, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30', icon: AlertCircle },
        ].map(stat => (
          <div key={stat.label} className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{stat.label}</span>
              <div className={`p-2 rounded-lg ${stat.bg} ${stat.color}`}>
                <stat.icon size={20} />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className={`text-3xl font-extrabold ${stat.color}`}>{stat.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Analytics Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pieCharts.map((chart, idx) => (
          <div key={idx} className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Layers size={18} className="text-blue-500" />
              {chart.title}
            </h2>
            <div className="h-64">
              {chart.data.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie data={chart.data} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="value">
                      {chart.data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <Tooltip formatter={(value: any) => [`${value} cases`, 'Count']} />
                    <Legend />
                  </RechartsPie>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm">No data available</div>
              )}
            </div>
          </div>
        ))}
      </div>
      </div>
      )}

      {activeTab === 'details' && (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {/* Table Filters Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col md:flex-row gap-3 items-center justify-between">
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
              className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 font-semibold text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all" className="font-normal text-gray-900 dark:text-gray-100">All Automation Statuses</option>
              <option value={AutomationStatus.Automated} className="font-medium text-gray-900 dark:text-gray-100">Automated</option>
              <option value={AutomationStatus.Automatable} className="font-medium text-gray-900 dark:text-gray-100">Automatable</option>
              <option value={AutomationStatus.NotAutomatable} className="font-medium text-gray-900 dark:text-gray-100">Not Automatable</option>
            </select>

            {/* Filter by Fix Status */}
            <select
              value={fixStatusFilter}
              onChange={(e) => setFixStatusFilter(e.target.value)}
              className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 font-semibold text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all" className="font-normal text-gray-900 dark:text-gray-100">All Fix Statuses</option>
              <option value={AutomationFixStatus.Created} className="font-medium text-gray-900 dark:text-gray-100">Created</option>
              <option value={AutomationFixStatus.InProgress} className="font-medium text-gray-900 dark:text-gray-100">In Progress</option>
              <option value={AutomationFixStatus.Fixed} className="font-medium text-gray-900 dark:text-gray-100">Fixed</option>
              <option value={AutomationFixStatus.ReadyForExecute} className="font-medium text-gray-900 dark:text-gray-100">Ready for Execute</option>
              <option value={AutomationFixStatus.Fail} className="font-medium text-gray-900 dark:text-gray-100">Fail</option>
              <option value={AutomationFixStatus.NotApplicable} className="font-medium text-gray-900 dark:text-gray-100">Not Applicable</option>
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
              {paginatedCases.length > 0 ? (
                paginatedCases.map((tc) => (
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

        {totalPages > 1 && (
          <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredCases.length)} of {filteredCases.length} cases
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  </div>
  );
};

export default AutomationStatusPage;
