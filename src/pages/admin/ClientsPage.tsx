import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { getClients, createClient, getClientUsage } from '../../services/clientApi';
import { Client, SeatUsage } from '../../types/client';
import { Search, LayoutGrid, Table2, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { isValidPhone, normalizePhone } from '../../utils/phone';

const ClientsPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'card' | 'table'>('card');
  const [form, setForm] = useState({ firstName: '', lastName: '', name: '', description: '', plan: 'starter', maxUsers: 10, mobile: '', whatsapp: '', whatsappSameAsMobile: false, addressLine1: '', addressLine2: '', city: '', state: '', country: 'India', pinCode: '' });
  const [usageMap, setUsageMap] = useState<Record<string, SeatUsage>>({});
  const navigate = useNavigate();
  const indianStates = ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Delhi","Jammu and Kashmir","Ladakh","Puducherry","Chandigarh","Andaman and Nicobar Islands","Dadra and Nagar Haveli and Daman and Diu","Lakshadweep"];
  const isValidPin = (v: string) => /^[1-9][0-9]{5}$/.test(v.trim());
  const planLimits: Record<string, number> = { free: 3, starter: 10, pro: 25, enterprise: Infinity };
  const getAllowedMax = (plan: string) => {
    const lim = planLimits[plan] ?? 10;
    return lim === Infinity ? Infinity : Math.ceil(lim * 1.5);
  };

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(c => {
      const addr = (c as any).address || {};
      return (
        c.displayId.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q) ||
        ((c as any).contactFirstName || '').toLowerCase().includes(q) ||
        ((c as any).contactLastName || '').toLowerCase().includes(q) ||
        (`${(c as any).contactFirstName || ''} ${(c as any).contactLastName || ''}`.toLowerCase().includes(q)) ||
        (c.mobile || '').includes(q) ||
        (c.whatsapp || '').includes(q) ||
        (addr.city || '').toLowerCase().includes(q) ||
        (addr.state || '').toLowerCase().includes(q) ||
        (addr.pinCode || '').includes(q) ||
        c.plan.toLowerCase().includes(q)
      );
    });
  }, [clients, search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.firstName.trim() || !form.lastName.trim()) { toast.error('Client Name, First Name & Last Name required'); return; }
    if (form.mobile && !isValidPhone(form.mobile)) { toast.error('Mobile must be 10 digits (India, 6-9 start)'); return; }
    if (!isValidPhone(form.whatsappSameAsMobile ? form.mobile : form.whatsapp)) { toast.error('Whatsapp must be 10 digits (India)'); return; }
    if (!form.addressLine1.trim() || !form.city.trim() || !form.state.trim() || !form.country.trim() || !form.pinCode.trim()) { toast.error('Address Line 1, City, State, Country, Pin Code required'); return; }
    if (!isValidPin(form.pinCode)) { toast.error('Pin Code must be 6 digits (India, e.g. 110001)'); return; }
    const allowedMax = getAllowedMax(form.plan);
    if (form.maxUsers !== -1 && form.maxUsers > allowedMax) { toast.error(`Max Users ${form.maxUsers} exceeds ${form.plan} plan limit (${planLimits[form.plan]}) +50% (max ${allowedMax}). Upgrade plan.`); return; }
    if (form.maxUsers === -1 && form.plan !== 'enterprise') { toast.error('Unlimited (-1) allowed only for Enterprise plan'); return; }
    try {
      const payload: any = {
        name: form.name.trim(),
        description: form.description,
        plan: form.plan,
        maxUsers: form.maxUsers,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        mobile: normalizePhone(form.mobile) || undefined,
        whatsapp: form.whatsappSameAsMobile ? normalizePhone(form.mobile) || undefined : (normalizePhone(form.whatsapp) || undefined),
        whatsappSameAsMobile: form.whatsappSameAsMobile,
        address: {
          addressLine1: form.addressLine1.trim(),
          addressLine2: form.addressLine2.trim() || undefined,
          city: form.city.trim(),
          state: form.state.trim(),
          country: form.country.trim() || 'India',
          pinCode: form.pinCode.trim(),
        }
      };
      await createClient(payload);
      toast.success('Client created: ' + payload.name);
      setShowCreate(false);
      setForm({ firstName: '', lastName: '', name: '', description: '', plan: 'starter', maxUsers: 10, mobile: '', whatsapp: '', whatsappSameAsMobile: false, addressLine1: '', addressLine2: '', city: '', state: '', country: 'India', pinCode: '' });
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <div className="bg-white dark:bg-gray-900 min-h-full p-6">Loading clients...</div>;
  return (
    <div className="bg-white dark:bg-gray-900 min-h-full p-4 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Clients</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage Client details</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="bg-system-blue dark:bg-system-darkBlue text-white px-4 py-2 rounded-lg shadow-sm font-medium hover:opacity-90 shrink-0">Create Client</button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            placeholder="Search by Code, Name, Mobile, Contact, City, State, Plan..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30"
          />
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-xs text-gray-500 hidden sm:inline">{filtered.length} of {clients.length}</span>
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button onClick={() => setView('card')} className={`px-3 py-2 text-sm flex items-center gap-1.5 ${view==='card' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}><LayoutGrid size={16}/> Card</button>
            <button onClick={() => setView('table')} className={`px-3 py-2 text-sm flex items-center gap-1.5 ${view==='table' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}><Table2 size={16}/> Table</button>
          </div>
        </div>
      </div>

      {view === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => {
            const u = usageMap[c.displayId];
            const pct = u ? u.pct : 0;
            const barColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-green-500';
            const addr = (c as any).address;
            return (
              <div key={c._id} onClick={() => navigate(`/admin/clients/${c.displayId}`)} className="border border-gray-100 dark:border-gray-700 rounded-2xl p-5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all cursor-pointer bg-white dark:bg-gray-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col">
                <div className="flex justify-between items-start">
                  <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-full font-medium">{c.displayId}</span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${c.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800'}`}>{c.status}</span>
                </div>
                <h3 className="font-semibold mt-3 truncate text-gray-900 dark:text-gray-100" title={c.name}>{c.name}</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate mt-1">Contact: {(c as any).contactFirstName || '—'} {(c as any).contactLastName || ''} {(c as any).mobile ? `• ${ normalizePhone((c as any).mobile)}` : ''}</p>
                {addr && <p className="text-xs text-gray-500 truncate">{addr.city}, {addr.state} - {addr.pinCode}</p>}
                <p className="text-xs text-gray-400 truncate mt-1">{c.description || '—'}</p>
                <div className="mt-4 space-y-2">
                  <div className="text-xs flex justify-between text-gray-600 dark:text-gray-400"><span>Seats</span><span className="font-medium">{u ? `${u.active}/${u.max === -1 ? '∞' : u.max}` : `${c.maxUsers}`}</span></div>
                  <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden"><div className={`h-2 rounded-full ${barColor}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 capitalize bg-gray-50 dark:bg-gray-700/50 px-2 py-1 rounded-full">{c.plan} • {c.maxUsers === -1 ? 'Unlimited' : `${c.maxUsers} Users`}</span>
                    <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">View <Eye size={12}/></span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-gray-50 dark:bg-gray-700/30 border-b border-gray-100 dark:border-gray-700">
                <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3 font-semibold">Code</th>
                  <th className="px-4 py-3 font-semibold">Client Name</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Mobile</th>
                  <th className="px-4 py-3 font-semibold">Location</th>
                  <th className="px-4 py-3 font-semibold">Plan</th>
                  <th className="px-4 py-3 font-semibold">Seats</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map(c => {
                  const u = usageMap[c.displayId];
                  const addr = (c as any).address;
                  return (
                    <tr key={c._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs bg-gray-100 dark:bg-gray-700 inline-block mt-2 ml-4 rounded-full">{c.displayId}</td>
                      <td className="px-4 py-3"><div className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[180px]" title={c.name}>{c.name}</div><div className="text-xs text-gray-400 truncate max-w-[180px]">{c.description || '—'}</div></td>
                      <td className="px-4 py-3"><div className="text-gray-900 dark:text-gray-100 whitespace-nowrap">{(c as any).contactFirstName || '—'} {(c as any).contactLastName || ''}</div></td>
                      <td className="px-4 py-3 whitespace-nowrap">{(c as any).mobile || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs">{addr ? `${addr.city}, ${addr.state}` : '—'}<div className="text-gray-400">{addr?.pinCode || ''}</div></td>
                      <td className="px-4 py-3"><span className="text-xs capitalize bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">{c.plan}</span></td>
                      <td className="px-4 py-3 whitespace-nowrap">{u ? `${u.active}/${u.max === -1 ? '∞' : u.max}` : c.maxUsers}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full ${c.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30' : 'bg-red-100 text-red-700'}`}>{c.status}</span></td>
                      <td className="px-4 py-3 text-right"><button onClick={() => navigate(`/admin/clients/${c.displayId}`)} className="text-xs border px-3 py-1.5 rounded-lg hover:bg-gray-900 hover:text-white dark:hover:bg-white dark:hover:text-gray-900 transition-colors">View</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filtered.length === 0 && <div className="text-center text-gray-500 py-10 bg-white dark:bg-gray-800 rounded-2xl border border-dashed">{search ? `No clients found for "${search}"` : 'No clients yet. Create CLT-0001.'}</div>}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleCreate} className="bg-white dark:bg-gray-800 p-6 rounded-2xl w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold">Create Client</h2>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Client Name *</label>
              <input placeholder="e.g. TSInternal" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border p-2 rounded" required />
            </div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact Person</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Contact First Name *</label>
                <input placeholder="e.g. Pankaj" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} className="border p-2 rounded w-full" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Contact Last Name *</label>
                <input placeholder="e.g. Kumar" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} className="border p-2 rounded w-full" required />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Description <span className="font-normal text-gray-400">(optional)</span></label>
              <input placeholder="Short note about this client" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full border p-2 rounded" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Mobile Number <span className="font-normal text-gray-400">(10-digit India, optional)</span></label>
                <input placeholder="9876543210" value={form.mobile} onChange={e => setForm({ ...form, mobile: normalizePhone(e.target.value) })} className="border p-2 rounded w-full" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Whatsapp Number <span className="font-normal text-gray-400">(optional)</span></label>
                <input placeholder="9876543210" value={form.whatsappSameAsMobile ? form.mobile : form.whatsapp} onChange={e => setForm({ ...form, whatsapp: normalizePhone(e.target.value) })} disabled={form.whatsappSameAsMobile} className="border p-2 rounded w-full disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-600 dark:disabled:text-gray-300" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.whatsappSameAsMobile} onChange={e => setForm({ ...form, whatsappSameAsMobile: e.target.checked })} /> Whatsapp same as Mobile</label>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Address *</div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Address Line 1 *</label>
              <input placeholder="Flat / House no., Building, Street" value={form.addressLine1} onChange={e => setForm({ ...form, addressLine1: e.target.value })} className="w-full border p-2 rounded" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Address Line 2 <span className="font-normal text-gray-400">(optional)</span></label>
              <input placeholder="Area, Landmark" value={form.addressLine2} onChange={e => setForm({ ...form, addressLine2: e.target.value })} className="w-full border p-2 rounded" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">City *</label>
                <input placeholder="e.g. Mumbai" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="border p-2 rounded w-full" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">State *</label>
                <select value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} className="border p-2 rounded w-full" required>
                  <option value="">Select State</option>{indianStates.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Country *</label>
                <input placeholder="India" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} className="border p-2 rounded w-full" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">PIN Code * <span className="font-normal text-gray-400">(6-digit)</span></label>
                <input placeholder="400001" value={form.pinCode} onChange={e => setForm({ ...form, pinCode: e.target.value })} className="border p-2 rounded w-full" required maxLength={6} />
              </div>
            </div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan Details *</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Plan *</label>
                <select value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })} className="w-full border p-2 rounded">
                  <option value="free">Free [3 Users]</option><option value="starter">Starter [10 Users]</option><option value="pro">Pro [25 Users]</option><option value="enterprise">Enterprise [Unlimited]</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Max Users *</label>
                <input type="number" placeholder="e.g. 5" value={form.maxUsers} onChange={e => setForm({ ...form, maxUsers: parseInt(e.target.value) || 0 })} className="w-full border p-2 rounded" required />
              </div>
            </div>
            <p className="text-xs text-gray-500">Limit: {planLimits[form.plan] === Infinity ? 'Unlimited' : `${planLimits[form.plan]} Users`} → max {getAllowedMax(form.plan) === Infinity ? 'Unlimited' : `${getAllowedMax(form.plan)} Users`} (+50%). Exceed requires plan upgrade.</p>
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
