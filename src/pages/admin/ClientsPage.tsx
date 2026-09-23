import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { getClients, createClient, getClientUsage } from '../../services/clientApi';
import { Client, SeatUsage } from '../../types/client';
import toast from 'react-hot-toast';

const ClientsPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', name: '', description: '', plan: 'starter', maxUsers: 10, mobile: '', whatsapp: '', whatsappSameAsMobile: false, addressLine1: '', addressLine2: '', city: '', state: '', country: 'India', pinCode: '' });
  const [usageMap, setUsageMap] = useState<Record<string, SeatUsage>>({});
  const navigate = useNavigate();
  const indianStates = ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Delhi","Jammu and Kashmir","Ladakh","Puducherry","Chandigarh","Andaman and Nicobar Islands","Dadra and Nagar Haveli and Daman and Diu","Lakshadweep"];
  const isValidPhone = (v: string) => {
    if (!v) return true; // optional
    const d = v.replace(/[\s\-\(\)]/g, "");
    const norm = d.startsWith("+91") ? d.slice(3) : d.startsWith("91") && d.length === 12 ? d.slice(2) : d.startsWith("0") ? d.slice(1) : d;
    return /^[6-9]\d{9}$/.test(norm);
  };
  const isValidPin = (v: string) => /^[1-9][0-9]{5}$/.test(v.trim());

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
    if (!form.name.trim() || !form.firstName.trim() || !form.lastName.trim()) { toast.error('Client Name, First Name & Last Name required'); return; }
    if (form.mobile && !isValidPhone(form.mobile)) { toast.error('Mobile must be 10 digits (India, 6-9 start)'); return; }
    if (!isValidPhone(form.whatsappSameAsMobile ? form.mobile : form.whatsapp)) { toast.error('Whatsapp must be 10 digits (India)'); return; }
    if (!form.addressLine1.trim() || !form.city.trim() || !form.state.trim() || !form.country.trim() || !form.pinCode.trim()) { toast.error('Address Line 1, City, State, Country, Pin Code required'); return; }
    if (!isValidPin(form.pinCode)) { toast.error('Pin Code must be 6 digits (India, e.g. 110001)'); return; }
    try {
      const payload: any = {
        name: form.name.trim(),
        description: form.description,
        plan: form.plan,
        maxUsers: form.maxUsers,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        mobile: form.mobile || undefined,
        whatsapp: form.whatsappSameAsMobile ? form.mobile : (form.whatsapp || undefined),
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
    <div className="bg-white dark:bg-gray-900 min-h-full p-4 sm:p-6 space-y-6">
      <div className="flex justify-between items-center bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Clients</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage Client details</p>
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
              <h3 className="font-semibold mt-2 truncate" title={c.name}>{c.name}</h3>
              {(c as any).contactFirstName && <p className="text-xs text-gray-600 dark:text-gray-400 truncate">Contact: {(c as any).contactFirstName} {(c as any).contactLastName || ''} {(c as any).mobile ? `• ${ (c as any).mobile}` : ''}</p>}
              <p className="text-sm text-gray-500 truncate">{c.description || '—'}</p>
              <div className="mt-3">
                <div className="text-xs flex justify-between"><span>Seats</span><span>{u ? `${u.active}/${u.max === -1 ? '∞' : u.max}` : `${c.maxUsers}`}</span></div>
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded mt-1"><div className={`h-2 rounded ${barColor}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
                <div className="text-xs text-gray-400 capitalize">{c.plan} • max {c.maxUsers === -1 ? 'Unlimited' : `${c.maxUsers} Users`}</div>
              </div>
            </div>
          );
        })}
      </div>
      {clients.length === 0 && <div className="text-center text-gray-500 py-10">No clients yet. Create CLT-0001.</div>}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleCreate} className="bg-white dark:bg-gray-800 p-6 rounded-2xl w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold">Create Client</h2>
            <input placeholder="Client Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border p-2 rounded" required />
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact Person</div>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="First Name *" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} className="border p-2 rounded" required />
              <input placeholder="Last Name *" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} className="border p-2 rounded" required />
            </div>
            <input placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full border p-2 rounded" />
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Mobile (optional)" value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} className="border p-2 rounded" />
              <input placeholder="Whatsapp (optional)" value={form.whatsappSameAsMobile ? form.mobile : form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} disabled={form.whatsappSameAsMobile} className="border p-2 rounded disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-400" />
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.whatsappSameAsMobile} onChange={e => setForm({ ...form, whatsappSameAsMobile: e.target.checked })} /> Whatsapp same as Mobile</label>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Address *</div>
            <input placeholder="Address Line 1 *" value={form.addressLine1} onChange={e => setForm({ ...form, addressLine1: e.target.value })} className="w-full border p-2 rounded" required />
            <input placeholder="Address Line 2 (optional)" value={form.addressLine2} onChange={e => setForm({ ...form, addressLine2: e.target.value })} className="w-full border p-2 rounded" />
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="City *" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="border p-2 rounded" required />
              <select value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} className="border p-2 rounded" required>
                <option value="">State *</option>{indianStates.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Country *" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} className="border p-2 rounded" required />
              <input placeholder="Pin Code * (6 digits)" value={form.pinCode} onChange={e => setForm({ ...form, pinCode: e.target.value })} className="border p-2 rounded" required maxLength={6} />
            </div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan Details *</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">Plan</label>
                <select value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })} className="w-full border p-2 rounded">
                  <option value="free">Free [3 Users]</option><option value="starter">Starter [10 Users]</option><option value="pro">Pro [25 Users]</option><option value="enterprise">Enterprise [Unlimited]</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Max Users</label>
                <input type="number" placeholder="Max Users" value={form.maxUsers} onChange={e => setForm({ ...form, maxUsers: parseInt(e.target.value) || 0 })} className="w-full border p-2 rounded" required />
              </div>
            </div>
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
