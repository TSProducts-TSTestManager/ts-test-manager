import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Eye, EyeOff, FolderGit2, KeyRound, Loader2, RefreshCw, Search, Unplug } from 'lucide-react';
import {
  connectJira,
  disconnectJira,
  getJiraConfig,
  getJiraProjects,
} from '../../../services/jiraApi';
import type { JiraProjectItem } from '../../../services/jiraApi';
import type { JiraIntegration } from '../../../types/client';

interface ClientJiraSettingsProps {
  displayId: string;
  /** client_admin / super_admin may change anything; members get read-only. */
  canEdit?: boolean;
  onChanged?: () => void;
  /** Hide the built-in project browser when the caller renders its own (e.g. "My JIRA Projects" sub-tab). */
  showProjects?: boolean;
}

const errMessage = (e: unknown): string => {
  const err = e as { response?: { data?: { message?: string } }; message?: string };
  return err?.response?.data?.message || err?.message || 'Something went wrong';
};

/**
 * Client-level JIRA settings — one credential for the whole client.
 *
 * The Client Admin stores the JIRA URL (site), Atlassian email and API token
 * here. On connect the backend verifies the credential and this panel lists
 * every JIRA project that credential can see (browse only — which JIRA project
 * a TSM project uses is chosen in the Project JIRA tab, there is no client-wide
 * default). Every member can read it (token stays masked) so they can link /
 * create JIRA issues on tickets; only admins can edit it.
 */
const ClientJiraSettings: React.FC<ClientJiraSettingsProps> = ({ displayId, canEdit = false, onChanged, showProjects = true }) => {
  const [config, setConfig] = useState<JiraIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [projectsBusy, setProjectsBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [form, setForm] = useState({ domain: '', email: '', apiToken: '' });
  const [projects, setProjects] = useState<JiraProjectItem[]>([]);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const isConnected = !!config?.enabled;

  const loadProjects = useCallback(async () => {
    setProjectsBusy(true);
    setProjectsError(null);
    try {
      setProjects(await getJiraProjects(displayId));
    } catch (e: unknown) {
      setProjects([]);
      setProjectsError(errMessage(e));
    } finally {
      setProjectsBusy(false);
    }
  }, [displayId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = await getJiraConfig(displayId);
      setConfig(cfg);
      setForm({ domain: cfg.domain || '', email: cfg.email || '', apiToken: '' });
      if (showProjects && cfg.enabled && cfg.domain && cfg.email) await loadProjects();
      else setProjects([]);
    } catch {
      // JIRA simply is not configured for this client yet.
      setConfig(null);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [displayId, loadProjects, showProjects]);

  useEffect(() => { void load(); }, [load]);

  const visibleProjects = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(p => p.key.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
  }, [projects, filter]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) { toast.error('Only Client Admin can change JIRA settings'); return; }
    const domain = form.domain.trim();
    const email = form.email.trim();
    if (!domain || !email) { toast.error('JIRA URL and Email are required'); return; }
    if (!form.apiToken.trim() && !config?.enabled) { toast.error('API Token is required'); return; }
    setBusy(true);
    try {
      await connectJira(displayId, {
        domain,
        email,
        apiToken: form.apiToken.trim() || undefined,
      });
      toast.success('JIRA connected');
      setEditing(false);
      setForm(f => ({ ...f, apiToken: '' }));
      await load();
      onChanged?.();
    } catch (err: unknown) {
      toast.error(errMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (!canEdit) return;
    setBusy(true);
    try {
      await disconnectJira(displayId);
      toast.success('JIRA disconnected');
      setConfig(null);
      setProjects([]);
      setEditing(false);
      setForm({ domain: '', email: '', apiToken: '' });
      onChanged?.();
    } catch (err: unknown) {
      toast.error(errMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-6">
        <Loader2 size={16} className="animate-spin" /> Loading JIRA configuration…
      </div>
    );
  }

  const showForm = !isConnected || editing;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><KeyRound size={16} className="text-blue-600" /> JIRA — Client Level</h3>
          <p className="text-xs text-gray-500">
            One JIRA connection for this whole client: JIRA URL + Atlassian email + API token, stored per client and editable anytime by the Client Admin.
            Members can link &amp; create JIRA issues on tickets using it.
          </p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full border ${isConnected ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800' : 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-300'}`}>
          {isConnected ? 'Connected' : 'Not connected'}
        </span>
      </div>

      {isConnected && !showForm && (
        <div className="border rounded-xl p-4 bg-gray-50 dark:bg-gray-700/30 space-y-2 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
            <div><span className="text-gray-400 text-xs uppercase">JIRA URL</span><div className="font-medium break-all">{config?.domain ? `https://${config.domain}` : '—'}</div></div>
            <div><span className="text-gray-400 text-xs uppercase">Email</span><div className="font-medium break-all">{config?.email || '—'}</div></div>
            <div><span className="text-gray-400 text-xs uppercase">API Token</span><div className="font-medium font-mono">{config?.apiToken ? '••••••••••••' : '—'}</div></div>
            <div><span className="text-gray-400 text-xs uppercase">Connected</span><div className="font-medium">{config?.connectedAt ? new Date(config.connectedAt).toLocaleString() : '—'}</div></div>
          </div>
          {canEdit && (
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => { setForm({ domain: config?.domain || '', email: config?.email || '', apiToken: '' }); setEditing(true); }} className="text-xs border px-3 py-1.5 rounded-lg hover:bg-white dark:hover:bg-gray-600">Change credentials</button>
              <button type="button" onClick={handleDisconnect} disabled={busy} className="text-xs border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50 flex items-center gap-1"><Unplug size={13} /> Disconnect</button>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleConnect} className="border rounded-xl p-4 space-y-3 bg-white dark:bg-gray-800">
          <div className="text-xs font-semibold text-gray-600 dark:text-gray-400">
            {isConnected ? 'Update JIRA credentials' : 'Connect JIRA'}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">JIRA URL / Site *</label>
            <input placeholder="yourcompany.atlassian.net" value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })} className="w-full border p-2 rounded" required disabled={!canEdit} />
            <p className="text-[11px] text-gray-400 mt-1">Only the site host — https:// is added automatically.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Atlassian Email *</label>
            <input type="email" placeholder="you@company.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full border p-2 rounded" required disabled={!canEdit} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">API Token * <span className="font-normal text-gray-400">(id.atlassian.com → Create API token)</span></label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                placeholder={isConnected ? 'Leave blank to keep the current token' : 'Paste your Atlassian API token'}
                value={form.apiToken}
                onChange={e => setForm({ ...form, apiToken: e.target.value })}
                className="w-full border p-2 rounded pr-10 font-mono"
                required={!isConnected}
                disabled={!canEdit}
                autoComplete="off"
              />
              <button type="button" onClick={() => setShowToken(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" aria-label="Show token">
                {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !canEdit} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm disabled:opacity-50 flex items-center gap-1.5">
              {busy && <Loader2 size={14} className="animate-spin" />} {isConnected ? 'Save' : 'Connect JIRA'}
            </button>
            {isConnected && <button type="button" onClick={() => setEditing(false)} className="border px-4 py-1.5 rounded text-sm">Cancel</button>}
          </div>
          {!canEdit && <p className="text-xs text-amber-600">Only the Client Admin can change these credentials.</p>}
        </form>
      )}

      {isConnected && showProjects && (
        <div className="border rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold flex items-center gap-2"><FolderGit2 size={15} className="text-blue-600" /> JIRA Projects <span className="text-gray-400 font-normal">({projects.length})</span></h4>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                <input placeholder="Search project" value={filter} onChange={e => setFilter(e.target.value)} className="border rounded-lg pl-7 pr-2 py-1 text-xs w-40" />
              </div>
              <button type="button" onClick={loadProjects} disabled={projectsBusy} className="text-xs border px-2 py-1 rounded-lg flex items-center gap-1 hover:bg-gray-50 disabled:opacity-50">
                <RefreshCw size={12} className={projectsBusy ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-500">All JIRA projects this credential can access. Assign a JIRA project to each TSM project in the <span className="font-semibold">Project Configuration</span> tab.</p>

          {projectsBusy && <div className="flex items-center gap-2 text-sm text-gray-500 py-4"><Loader2 size={16} className="animate-spin" /> Fetching projects from JIRA…</div>}
          {!projectsBusy && projectsError && (
            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900 rounded-lg p-3 flex items-center justify-between gap-3">
              <span className="break-all">{projectsError}</span>
              <button type="button" onClick={loadProjects} className="text-xs border border-red-200 px-2 py-1 rounded whitespace-nowrap">Retry</button>
            </div>
          )}
          {!projectsBusy && !projectsError && visibleProjects.length === 0 && (
            <p className="text-sm text-gray-400 py-2">{projects.length === 0 ? 'No JIRA projects found for this credential.' : 'No project matches your search.'}</p>
          )}

          {!projectsBusy && !projectsError && visibleProjects.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {visibleProjects.map(p => (
                <div key={p.id || p.key} className="border rounded-lg p-2.5 bg-white dark:bg-gray-800">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-400">{p.key}</span>
                    {p.isPrivate && <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 px-1 py-0.5 rounded-full">Private</span>}
                  </div>
                  <div className="text-sm truncate">{p.name}</div>
                  {p.projectType && <div className="text-[11px] text-gray-400 truncate">{p.projectType}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ClientJiraSettings;
