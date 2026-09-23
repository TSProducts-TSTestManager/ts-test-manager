import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { getClients, createClient, getClientUsage } from '../../services/clientApi';
import { Client, SeatUsage } from '../../types/client';
import toast from 'react-hot-toast';

const ClientsPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', plan: 'starter', maxUsers: 10 });
  const [usageMap, setUsageMap] = useState<Record<string, SeatUsage>>({});
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const data = await getClients();
      setClients(data);
      for (const c of data) {
        try { const u = await getClientUsage(c.displayId); setUsageMap(m => ({ ...m, [c.displayId]: u })); } catch {}
      }
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createClient(form);
      toast.success('Client created: ' + form.name);
      setShowCreate(false);
      setForm({ name: '', description: '', plan: 'starter', maxUsers: 10 });
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <div className="bg-white dark:bg-gray-900 min-h-full p-6">Loading clients...</div>;
  return (
    <div className="bg-white dark:bg-gray-900 min-h-full p-4 sm:p-6 space-y-6">
      <div className="flex justify-between items-center bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Clients</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage CLT-0001, seat limits, and global clients</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="bg-system-blue dark:bg-system-darkBlue text-white px-4 py-2 rounded-lg shadow-sm font-medium hover:opacity-90">Create Client</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients.map(c => {
          const u = usageMap[c.displayId];
          const pct = u ? u.pct : 0;
          const barColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-green-500';
          return (
            <div key={c._id} onClick={() => navigate(`/admin/clients/${c.displayId}`)} className="border border-gray-100 dark:border-gray-700 rounded-2xl p-4 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all cursor-pointer bg-white dark:bg-gray-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="flex justify-between">
                <span className="font-mono text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{c.displayId}</span>
                <span className={`text-xs px-2 py-1 rounded ${c.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{c.status}</span>
              </div>
              <h3 className="font-semibold mt-2">{c.name}</h3>
              <p className="text-sm text-gray-500">{c.description || '—'}</p>
              <div className="mt-3">
                <div className="text-xs flex justify-between"><span>Seats</span><span>{u ? `${u.active}/${u.max === -1 ? '∞' : u.max}` : `${c.maxUsers}`}</span></div>
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded mt-1"><div className={`h-2 rounded ${barColor}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
                <div className="text-xs text-gray-400">{c.plan} • max {c.maxUsers === -1 ? 'unlimited' : c.maxUsers}</div>
              </div>
            </div>
          );
        })}
      </div>
      {clients.length === 0 && <div className="text-center text-gray-500 py-10">No clients yet. Create CLT-0001.</div>}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <form onSubmit={handleCreate} className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold">Create Client</h2>
            <input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border p-2 rounded" required />
            <input placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full border p-2 rounded" />
            <select value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })} className="w-full border p-2 rounded">
              <option value="free">free (3)</option><option value="starter">starter (10)</option><option value="pro">pro (25)</option><option value="enterprise">enterprise (∞)</option>
            </select>
            <input type="number" placeholder="Max Users" value={form.maxUsers} onChange={e => setForm({ ...form, maxUsers: parseInt(e.target.value) || 0 })} className="w-full border p-2 rounded" required />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border rounded">Cancel</button>
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Create</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
export default ClientsPage;
