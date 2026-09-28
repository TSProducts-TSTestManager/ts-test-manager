import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2, RefreshCw, Search } from 'lucide-react';
import { getJiraProjects } from '../../../services/jiraApi';
import type { JiraProjectItem } from '../../../services/jiraApi';

interface JiraProjectsTableProps {
  displayId: string;
}

const errMessage = (e: unknown): string => {
  const err = e as { response?: { data?: { message?: string } }; message?: string };
  return err?.response?.data?.message || err?.message || 'Something went wrong';
};

/**
 * "My JIRA Projects" — every JIRA project the client's stored credential can
 * see, in a searchable table. Read-only: assigning a JIRA project to a TSM
 * project happens in the Project Configuration tab.
 */
const JiraProjectsTable: React.FC<JiraProjectsTableProps> = ({ displayId }) => {
  const [projects, setProjects] = useState<JiraProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProjects(await getJiraProjects(displayId));
    } catch (e: unknown) {
      setProjects([]);
      setError(errMessage(e));
    } finally {
      setLoading(false);
    }
  }, [displayId]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(p => p.key.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
  }, [projects, search]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Search by name or key"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-gray-200 dark:border-gray-600 rounded-lg pl-8 pr-3 py-1.5 text-sm w-56"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{filtered.length} of {projects.length} project{projects.length === 1 ? '' : 's'}</span>
          <button type="button" onClick={load} disabled={loading} className="text-xs border border-gray-200 dark:border-gray-600 px-2.5 py-1.5 rounded-lg flex items-center gap-1 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-6"><Loader2 size={16} className="animate-spin" /> Fetching projects from JIRA…</div>
      )}

      {!loading && error && (
        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900 rounded-lg p-3 flex items-center justify-between gap-3">
          <span className="break-all">{error}</span>
          <button type="button" onClick={load} className="text-xs border border-red-200 px-2 py-1 rounded whitespace-nowrap">Retry</button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <p className="text-sm text-gray-400 py-4">
          {projects.length === 0 ? 'No JIRA projects found for this credential.' : 'No project matches your search.'}
        </p>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500 w-14">S.No</th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500 whitespace-nowrap">Project Key</th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500 whitespace-nowrap">Project Name</th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500 whitespace-nowrap">Type</th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500 whitespace-nowrap text-right">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map((p, idx) => (
                  <tr key={p.id || p.key} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-2.5 text-center text-xs text-gray-500">{idx + 1}</td>
                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-blue-700 dark:text-blue-400 whitespace-nowrap">{p.key}</td>
                    <td className="px-4 py-2.5 font-medium min-w-[180px]">{p.name}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{p.projectType || '—'}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {p.url ? (
                        <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                          Open <ExternalLink size={12} />
                        </a>
                      ) : <span className="text-xs text-gray-400">—</span>}
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

export default JiraProjectsTable;
