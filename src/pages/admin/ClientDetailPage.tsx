import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { getClientUsage, getClientUsers, createClientAdmin, resetClientAdminPassword, deactivateUser, restoreUser, updateClient, getClients, updateClientUser } from '../../services/clientApi';
import { useAuthStore } from '../../store/authStore';
import { connectJira, disconnectJira, getJiraConfig } from '../../services/jiraApi';
import { SeatUsage, ClientUser, Client } from '../../types/client';
import toast from 'react-hot-toast';

const ClientDetailPage: React.FC = () => {
  const { displayId } = useParams<{ displayId: string }>();
  const [usage, setUsage] = useState<SeatUsage | null>(null);
  const [users, setUsers] = useState<ClientUser[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [tab, setTab] = useState<'users'|'jira'|'settings'>('users');
  const [jira, setJira] = useState<any>(null);
  const [invite, setInvite] = useState({ email: '', firstName: '', lastName: '', mobile: '', whatsapp: '', whatsappSameAsMobile: false, tempPassword: '', role: 'client_admin' as 'client_admin'|'member'|'viewer' });
  const [jiraForm, setJiraForm] = useState({ domain: '', email: '', apiToken: '', projectKey: '' });
  const [editMax, setEditMax] = useState<number | ''>('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTarget, setResetTarget] = useState<ClientUser | null>(null);
  const [resetPwd, setResetPwd] = useState('');
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState<ClientUser | null>(null);
  const [editingClient, setEditingClient] = useState(false);
  const [editForm, setEditForm] = useState({ clientName: '', firstName: '', lastName: '', description: '', plan: 'starter', mobile: '', whatsapp: '', whatsappSameAsMobile: false, addressLine1: '', addressLine2: '', city: '', state: '', country: 'India', pinCode: '' });
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const { user } = useAuthStore();
  const isSuperAdmin = (user as any)?.role === 'super_admin';
  const isClientAdmin = (user as any)?.role === 'client_admin';
  const indianStates = ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Delhi","Jammu and Kashmir","Ladakh","Puducherry","Chandigarh","Andaman and Nicobar Islands","Dadra and Nagar Haveli and Daman and Diu","Lakshadweep"];
  const isValidEmail = (v: string) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v);
  const isValidPhone = (v: string) => {
    if (!v) return true;
    const d = v.replace(/[\s\-\(\)]/g, "");
    const norm = d.startsWith("+91") ? d.slice(3) : d.startsWith("91") && d.length === 12 ? d.slice(2) : d.startsWith("0") ? d.slice(1) : d;
    return /^[6-9]\d{9}$/.test(norm);
  };
  const isValidPin = (v: string) => /^[1-9][0-9]{5}$/.test(v.trim());
  const [editUserTarget, setEditUserTarget] = useState<ClientUser | null>(null);
  const [editUserForm, setEditUserForm] = useState({ firstName: '', lastName: '', mobile: '', whatsapp: '', whatsappSameAsMobile: false });
  const navigate = useNavigate();

  const load = async () => {
    if (!displayId) return;
    try { setUsage(await getClientUsage(displayId)); } catch {}
    try { setUsers(await getClientUsers(displayId, 'all')); } catch (e:any){ toast.error(e.message); }
    try { setJira(await getJiraConfig(displayId)); } catch {}
    try {
      const all = await getClients();
      const c = all.find(x=>x.displayId===displayId) || null;
      setClient(c);
      if (c) {
        setEditForm({
          clientName: c.name || '',
          firstName: c.contactFirstName || '',
          lastName: c.contactLastName || '',
          description: c.description || '',
          plan: c.plan,
          mobile: c.mobile || '',
          whatsapp: c.whatsapp || '',
          whatsappSameAsMobile: !!c.whatsappSameAsMobile,
          addressLine1: (c as any).address?.addressLine1 || '',
          addressLine2: (c as any).address?.addressLine2 || '',
          city: (c as any).address?.city || '',
          state: (c as any).address?.state || '',
          country: (c as any).address?.country || 'India',
          pinCode: (c as any).address?.pinCode || '',
        });
        setEditMax(c.maxUsers);
      }
    } catch {}
  };
  useEffect(() => { load(); }, [displayId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite.email.trim() || !isValidEmail(invite.email.trim())) { toast.error('Valid Email required'); return; }
    if (!invite.firstName.trim() || !invite.lastName.trim()) { toast.error('First Name & Last Name required'); return; }
    if (invite.firstName.trim().length < 2 || invite.lastName.trim().length < 2) { toast.error('First/Last Name min 2 chars'); return; }
    if (invite.mobile && !isValidPhone(invite.mobile)) { toast.error('Mobile must be 10 digits (India, 6-9 start)'); return; }
    const wp = invite.whatsappSameAsMobile ? invite.mobile : invite.whatsapp;
    if (wp && !isValidPhone(wp)) { toast.error('Whatsapp must be 10 digits (India)'); return; }
    try {
      const payload: any = {
        email: invite.email,
        firstName: invite.firstName.trim(),
        lastName: invite.lastName.trim(),
        name: `${invite.firstName} ${invite.lastName}`.trim(),
        mobile: invite.mobile || undefined,
        whatsapp: invite.whatsappSameAsMobile ? invite.mobile : (invite.whatsapp || undefined),
        whatsappSameAsMobile: invite.whatsappSameAsMobile,
        tempPassword: invite.tempPassword || undefined,
        role: invite.role,
      };
      await createClientAdmin(displayId!, payload);
      toast.success('User invited as ' + invite.role);
      setInvite({ email:'', firstName:'', lastName:'', mobile:'', whatsapp:'', whatsappSameAsMobile:false, tempPassword:'', role: 'client_admin' });
      setShowInviteModal(false);
      load();
    } catch(e:any){ toast.error(e.message); }
  };
  const handleDeactivate = async (uid: string) => {
    try { await deactivateUser(displayId!, uid); toast.success('Deactivated'); load(); } catch(e:any){ toast.error(e.message); }
  };
  const handleRestore = async (uid: string) => {
    try { await restoreUser(displayId!, uid); toast.success('Restored'); load(); } catch(e:any){ toast.error(e.message); }
  };
  const openResetModal = (u: ClientUser) => {
    setResetTarget(u);
    setResetPwd('');
    setShowResetModal(true);
  };
  const handleResetConfirm = async () => {
    if (!resetTarget || !resetPwd) { toast.error('Password required'); return; }
    try { await resetClientAdminPassword(displayId!, resetTarget._id, resetPwd); toast.success(`Password reset for ${resetTarget.email}`); setShowResetModal(false); setResetTarget(null); } catch(e:any){ toast.error(e.message); }
  };
  const handleSaveMax = async () => {
    if (editMax === '') return;
    try { await updateClient(displayId!, { maxUsers: Number(editMax) } as any); toast.success('Max users updated'); load(); } catch(e:any){ toast.error(e.message); }
  };
  const handleSaveClientEdit = async () => {
    if (!editForm.clientName.trim() || !editForm.firstName.trim() || !editForm.lastName.trim()) { toast.error('Client Name, First & Last required'); return; }
    if (editForm.firstName.trim().length < 2 || editForm.lastName.trim().length < 2) { toast.error('First/Last min 2 chars'); return; }
    if (editForm.mobile && !isValidPhone(editForm.mobile)) { toast.error('Mobile must be 10 digits (India, 6-9 start)'); return; }
    const ewp = editForm.whatsappSameAsMobile ? editForm.mobile : editForm.whatsapp;
    if (ewp && !isValidPhone(ewp)) { toast.error('Whatsapp must be 10 digits (India)'); return; }
    if (!editForm.addressLine1.trim() || !editForm.city.trim() || !editForm.state.trim() || !editForm.country.trim() || !editForm.pinCode.trim()) { toast.error('Address Line 1, City, State, Country, Pin required'); return; }
    if (!isValidPin(editForm.pinCode)) { toast.error('Pin Code must be 6 digits (India)'); return; }
    try {
      await updateClient(displayId!, {
        name: editForm.clientName.trim(),
        description: editForm.description,
        plan: editForm.plan as any,
        contactFirstName: editForm.firstName.trim(),
        contactLastName: editForm.lastName.trim(),
        mobile: editForm.mobile || undefined,
        whatsapp: editForm.whatsappSameAsMobile ? editForm.mobile : (editForm.whatsapp || undefined),
        whatsappSameAsMobile: editForm.whatsappSameAsMobile,
        address: {
          addressLine1: editForm.addressLine1.trim(),
          addressLine2: editForm.addressLine2?.trim(),
          city: editForm.city.trim(),
          state: editForm.state.trim(),
          country: editForm.country.trim() || 'India',
          pinCode: editForm.pinCode.trim(),
        },
      } as any);
      toast.success('Client updated');
      setEditingClient(false);
      load();
    } catch(e:any){ toast.error(e.message); }
  };
  const handleJiraConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await connectJira(displayId!, jiraForm); toast.success('JIRA connected'); load(); } catch(e:any){ toast.error(e.message); }
  };
  const openEditUser = (u: ClientUser) => {
    setEditUserTarget(u);
    setEditUserForm({
      firstName: u.firstName || u.name.split(' ')[0] || '',
      lastName: u.lastName || u.name.split(' ').slice(1).join(' ') || '',
      mobile: u.mobile || '',
      whatsapp: u.whatsapp || '',
      whatsappSameAsMobile: !!u.whatsappSameAsMobile,
    });
    setShowEditUserModal(true);
  };
  const handleEditUserSave = async () => {
    if (!editUserTarget) return;
    if (!editUserForm.firstName.trim() || !editUserForm.lastName.trim()) { toast.error('First & Last required'); return; }
    if (editUserForm.firstName.trim().length < 2 || editUserForm.lastName.trim().length < 2) { toast.error('First/Last min 2 chars'); return; }
    if (editUserForm.mobile && !isValidPhone(editUserForm.mobile)) { toast.error('Mobile must be 10 digits (India, 6-9 start)'); return; }
    const uw = editUserForm.whatsappSameAsMobile ? editUserForm.mobile : editUserForm.whatsapp;
    if (uw && !isValidPhone(uw)) { toast.error('Whatsapp must be 10 digits (India)'); return; }
    try {
      await updateClientUser(displayId!, editUserTarget._id, {
        firstName: editUserForm.firstName.trim(),
        lastName: editUserForm.lastName.trim(),
        mobile: editUserForm.mobile || undefined,
        whatsapp: editUserForm.whatsappSameAsMobile ? editUserForm.mobile : (editUserForm.whatsapp || undefined),
        whatsappSameAsMobile: editUserForm.whatsappSameAsMobile,
      });
      toast.success('User updated');
      setShowEditUserModal(false);
      setEditUserTarget(null);
      load();
    } catch(e:any){ toast.error(e.message); }
  };

  if (!displayId) return <div className="bg-white dark:bg-gray-900 min-h-full p-6">Missing client</div>;
  const active = users.filter(u=>u.status==='active').length;
  const full = usage ? (usage.max !== -1 && usage.active >= usage.max) : false;

  return (
    <div className="bg-white dark:bg-gray-900 min-h-full p-4 sm:p-6 space-y-6">
      {/* Header with full details */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-4 sm:p-6">
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-sm bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">{displayId}</span>
              <span className={`text-xs px-2 py-1 rounded-full ${client?.status==='active'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{client?.status || 'active'}</span>
              <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full capitalize">{client?.plan || '—'}</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight truncate" title={client?.name}>{client?.name || `Client ${displayId}`}</h1>
            {client && <p className="text-sm text-gray-600 dark:text-gray-400">Contact: {client.contactFirstName || '—'} {client.contactLastName || ''} {(client.mobile || client.whatsapp) ? `• ${client.mobile || client.whatsapp}` : ''}</p>}
            {client?.description && <p className="text-sm text-gray-500 dark:text-gray-400 italic">{client.description}</p>}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs pt-2">
              <div><div className="text-gray-400 uppercase tracking-wider">Client Name</div><div className="font-medium truncate">{client?.name || '—'}</div></div>
              <div><div className="text-gray-400 uppercase tracking-wider">Mobile</div><div className="font-medium">{client?.mobile || '—'}</div></div>
              <div><div className="text-gray-400 uppercase tracking-wider">Whatsapp</div><div className="font-medium">{client?.whatsapp || '—'} {client?.whatsappSameAsMobile && <span className="text-gray-400">(same)</span>}</div></div>
              <div><div className="text-gray-400 uppercase tracking-wider">Created</div><div className="font-medium">{client ? new Date(client.createdAt).toLocaleDateString() : '—'}</div></div>
              <div><div className="text-gray-400 uppercase tracking-wider">Seats</div><div className="font-medium">{usage ? `${usage.active}/${usage.max===-1?'∞':usage.max} (${usage.pct}%)` : '—'}</div></div>
            </div>
            {(client as any)?.address && (
              <div className="text-xs pt-2">
                <div className="text-gray-400 uppercase tracking-wider">Address</div>
                <div className="font-medium">{(client as any).address.addressLine1}{(client as any).address.addressLine2 ? `, ${(client as any).address.addressLine2}` : ''}, {(client as any).address.city}, {(client as any).address.state}, {(client as any).address.country} - {(client as any).address.pinCode}</div>
              </div>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={()=>setEditingClient(true)} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg">Edit Client</button>
            <button onClick={()=>navigate('/admin/clients')} className="text-sm border px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Back</button>
          </div>
        </div>
        {/* Edit Client Modal inline */}
        {editingClient && (
          <div className="mt-4 border-t pt-4 space-y-3">
            <input placeholder="Client Name *" value={editForm.clientName} onChange={e=>setEditForm({...editForm,clientName:e.target.value})} className="w-full border p-2 rounded" />
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact Person</div>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="First Name *" value={editForm.firstName} onChange={e=>setEditForm({...editForm,firstName:e.target.value})} className="border p-2 rounded" />
              <input placeholder="Last Name *" value={editForm.lastName} onChange={e=>setEditForm({...editForm,lastName:e.target.value})} className="border p-2 rounded" />
            </div>
            <input placeholder="Description" value={editForm.description} onChange={e=>setEditForm({...editForm,description:e.target.value})} className="w-full border p-2 rounded" />
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Mobile (optional)" value={editForm.mobile} onChange={e=>setEditForm({...editForm,mobile:e.target.value})} className="border p-2 rounded" />
              <input placeholder="Whatsapp (optional)" value={editForm.whatsappSameAsMobile ? editForm.mobile : editForm.whatsapp} onChange={e=>setEditForm({...editForm,whatsapp:e.target.value})} disabled={editForm.whatsappSameAsMobile} className="border p-2 rounded disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-400" />
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.whatsappSameAsMobile} onChange={e=>setEditForm({...editForm,whatsappSameAsMobile:e.target.checked})} /> Whatsapp same as Mobile</label>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Address *</div>
            <input placeholder="Address Line 1 *" value={editForm.addressLine1} onChange={e=>setEditForm({...editForm,addressLine1:e.target.value})} className="w-full border p-2 rounded" />
            <input placeholder="Address Line 2 (optional)" value={editForm.addressLine2} onChange={e=>setEditForm({...editForm,addressLine2:e.target.value})} className="w-full border p-2 rounded" />
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="City *" value={editForm.city} onChange={e=>setEditForm({...editForm,city:e.target.value})} className="border p-2 rounded" />
              <select value={editForm.state} onChange={e=>setEditForm({...editForm,state:e.target.value})} className="border p-2 rounded">
                <option value="">State *</option>{indianStates.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Country *" value={editForm.country} onChange={e=>setEditForm({...editForm,country:e.target.value})} className="border p-2 rounded" />
              <input placeholder="Pin Code * (6 digits)" value={editForm.pinCode} onChange={e=>setEditForm({...editForm,pinCode:e.target.value})} className="border p-2 rounded" maxLength={6} />
            </div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan Details *</div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-500">Plan</label>
                <select value={editForm.plan} onChange={e=>setEditForm({...editForm,plan:e.target.value})} className="w-full border p-2 rounded"><option value="free">Free [3 Users]</option><option value="starter">Starter [10 Users]</option><option value="pro">Pro [25 Users]</option><option value="enterprise">Enterprise [Unlimited]</option></select>
              </div>
              <div className="ml-auto flex gap-2">
                <button onClick={()=>setEditingClient(false)} className="border px-4 py-2 rounded">Cancel</button>
                <button onClick={handleSaveClientEdit} className="bg-blue-600 text-white px-4 py-2 rounded">Save</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-4 border-b border-gray-200 dark:border-gray-700">
        <button onClick={()=>setTab('users')} className={`pb-2 px-1 text-sm font-medium ${tab==='users'?'border-b-2 border-blue-600 text-blue-600': 'text-gray-500'}`}>Users ({active}/{usage?.max===-1?'∞':usage?.max})</button>
        {isClientAdmin && <button onClick={()=>setTab('jira')} className={`pb-2 px-1 text-sm font-medium ${tab==='jira'?'border-b-2 border-blue-600 text-blue-600': 'text-gray-500'}`}>JIRA</button>}
        <button onClick={()=>setTab('settings')} className={`pb-2 px-1 text-sm font-medium ${tab==='settings'?'border-b-2 border-blue-600 text-blue-600': 'text-gray-500'}`}>Settings</button>
      </div>

      {tab==='users' && (
        <>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-sm">Seats: {usage ? `${usage.active}/${usage.max===-1?'∞':usage.max} (${usage.pct}%) remaining ${usage.remaining===-1?'∞':usage.remaining}` : '—'}</h3>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded mt-2"><div className={`h-2 rounded ${full?'bg-red-500':'bg-green-500'}`} style={{width:`${Math.min(100, usage?.pct||0)}%`}} /></div>
            {full && <p className="text-sm text-red-600 mt-2">Seat limit reached. Deactivate a user to add new one.</p>}
          </div>

          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Client Admins</h3>
            <button onClick={()=>setShowInviteModal(true)} disabled={!!full} title={full?'Deactivate a user first':''} className={`px-4 py-2 rounded text-white text-sm ${full?'bg-gray-400':'bg-blue-600 hover:bg-blue-700'}`}>+ Invite Client Admin</button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr className="text-left">
                  <th className="p-3 font-semibold whitespace-nowrap">Email</th>
                  <th className="p-3 font-semibold whitespace-nowrap">First Name</th>
                  <th className="p-3 font-semibold whitespace-nowrap">Last Name</th>
                  <th className="p-3 font-semibold whitespace-nowrap">Mobile</th>
                  <th className="p-3 font-semibold whitespace-nowrap">Whatsapp</th>
                  <th className="p-3 font-semibold whitespace-nowrap">Role</th>
                  <th className="p-3 font-semibold whitespace-nowrap">Status</th>
                  <th className="p-3 font-semibold text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u=>(
                  <tr key={u._id} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="p-3 align-middle max-w-[200px] truncate" title={u.email}>{u.email}</td>
                    <td className="p-3 align-middle whitespace-nowrap">{u.firstName || u.name.split(' ')[0] || '—'}</td>
                    <td className="p-3 align-middle whitespace-nowrap">{u.lastName || u.name.split(' ').slice(1).join(' ') || '—'}</td>
                    <td className="p-3 align-middle whitespace-nowrap">{u.mobile || '—'}</td>
                    <td className="p-3 align-middle whitespace-nowrap">{u.whatsapp || '—'} {u.whatsappSameAsMobile && <span className="text-xs text-gray-400">(same)</span>}</td>
                    <td className="p-3 align-middle whitespace-nowrap"><span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">{u.role}</span></td>
                    <td className="p-3 align-middle whitespace-nowrap"><span className={`px-2 py-1 rounded-full text-xs font-medium ${u.status==='active'?'bg-green-100 text-green-700':'bg-gray-200 text-gray-600'}`}>{u.status}</span></td>
                    <td className="p-3 align-middle whitespace-nowrap">
                      <div className="flex gap-1 justify-end">
                        <button onClick={()=>openEditUser(u)} className="text-gray-700 text-xs border px-2 py-1 rounded hover:bg-gray-50 whitespace-nowrap">Edit</button>
                        {u.status==='active' ? <button onClick={()=>setShowDeactivateConfirm(u)} className="text-red-600 text-xs border px-2 py-1 rounded hover:bg-red-50 whitespace-nowrap">Deactivate</button> : <button onClick={()=>handleRestore(u._id)} className="text-green-600 text-xs border px-2 py-1 rounded hover:bg-green-50 whitespace-nowrap">Restore</button>}
                        <button onClick={()=>openResetModal(u)} className="text-blue-600 text-xs border px-2 py-1 rounded hover:bg-blue-50 whitespace-nowrap">Reset Pwd</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length===0 && <tr><td colSpan={8} className="p-6 text-center text-gray-400">No users yet</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab==='jira' && (
        isClientAdmin ? (
          <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-4">
            <h3 className="font-semibold">JIRA Integration (per-client)</h3>
            <div className="text-sm text-gray-500">Current: {jira?.enabled ? `${jira.domain} / ${jira.projectKey} connected` : 'Not connected'}</div>
            <form onSubmit={handleJiraConnect} className="space-y-2">
              <input placeholder="Domain (xxx.atlassian.net)" value={jiraForm.domain} onChange={e=>setJiraForm({...jiraForm,domain:e.target.value})} className="w-full border p-2 rounded" required />
              <input placeholder="Email" value={jiraForm.email} onChange={e=>setJiraForm({...jiraForm,email:e.target.value})} className="w-full border p-2 rounded" required />
              <input placeholder="API Token" value={jiraForm.apiToken} onChange={e=>setJiraForm({...jiraForm,apiToken:e.target.value})} className="w-full border p-2 rounded" required />
              <input placeholder="Project Key (e.g. TSM)" value={jiraForm.projectKey} onChange={e=>setJiraForm({...jiraForm,projectKey:e.target.value})} className="w-full border p-2 rounded" required />
              <button className="bg-blue-600 text-white px-4 py-2 rounded">Connect / Update</button>
              {jira?.enabled && <button type="button" onClick={async()=>{await disconnectJira(displayId!); toast.success('Disconnected'); load();}} className="ml-2 border px-4 py-2 rounded">Disconnect</button>}
            </form>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 text-sm text-gray-500">Only Client Admin can configure JIRA for this client.</div>
        )
      )}

      {tab==='settings' && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-3">
          <h3 className="font-semibold">Seat Limit</h3>
          {isSuperAdmin ? (
            <>
              <div className="flex gap-2">
                <input type="number" value={editMax} placeholder={String(usage?.max ?? '')} onChange={e=>setEditMax(e.target.value===''?'':parseInt(e.target.value))} className="border p-2 rounded" />
                <button onClick={handleSaveMax} className="bg-blue-600 text-white px-4 py-2 rounded">Save</button>
              </div>
              <p className="text-xs text-gray-500">-1 = unlimited. Reducing below active count requires deactivating users first.</p>
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2 items-center">
                <span className="border p-2 rounded bg-gray-100 dark:bg-gray-700">{usage?.max===-1?'Unlimited':usage?.max}</span>
                <span className="text-xs text-gray-500">Only Super Admin can change maxUsers. You can edit other client details in header.</span>
              </div>
              <p className="text-xs text-gray-500">Current usage: {usage ? `${usage.active}/${usage.max===-1?'∞':usage.max}` : '—'}</p>
            </div>
          )}
        </div>
      )}

      {showResetModal && resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setShowResetModal(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold">Reset Password</h3>
            <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 p-3 rounded space-y-1">
              <div><span className="font-medium">Client:</span> {displayId} — {client?.name}</div>
              <div><span className="font-medium">User:</span> {resetTarget.firstName||resetTarget.name.split(' ')[0]} {resetTarget.lastName||''} ({resetTarget.email})</div>
              <div><span className="font-medium">Mobile:</span> {resetTarget.mobile||'—'} • <span className="font-medium">Whatsapp:</span> {resetTarget.whatsapp||'—'}</div>
              <div><span className="font-medium">Role:</span> {resetTarget.role} • Status: {resetTarget.status}</div>
            </div>
            <input type="password" placeholder="New temp password (min 6 chars)" value={resetPwd} onChange={e=>setResetPwd(e.target.value)} className="w-full border p-2 rounded" autoFocus />
            <p className="text-xs text-gray-500">User will be forced to change password on next login (mustResetPassword).</p>
            <div className="flex justify-end gap-2">
              <button onClick={()=>setShowResetModal(false)} className="px-4 py-2 border rounded">Cancel</button>
              <button onClick={handleResetConfirm} className="bg-blue-600 text-white px-4 py-2 rounded">Reset Password</button>
            </div>
          </div>
        </div>
      )}

      {showDeactivateConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setShowDeactivateConfirm(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold">Deactivate User?</h3>
            <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 p-3 rounded space-y-1">
              <div><span className="font-medium">Client:</span> {displayId} — {usage ? `${usage.active}/${usage.max===-1?'∞':usage.max} active` : ''}</div>
              <div><span className="font-medium">User:</span> {showDeactivateConfirm.firstName||showDeactivateConfirm.name.split(' ')[0]} {showDeactivateConfirm.lastName||''} ({showDeactivateConfirm.email})</div>
              <div><span className="font-medium">Mobile:</span> {showDeactivateConfirm.mobile||'—'}</div>
              <div className="text-xs mt-1">This will soft-deactivate (status:inactive), free 1 seat, and keep history. You can restore later if seats available.</div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={()=>setShowDeactivateConfirm(null)} className="px-4 py-2 border rounded">Cancel</button>
              <button onClick={async()=>{ try{ await handleDeactivate(showDeactivateConfirm._id); setShowDeactivateConfirm(null);}catch{}}} className="bg-red-600 text-white px-4 py-2 rounded">Deactivate</button>
            </div>
          </div>
        </div>
      )}

      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setShowInviteModal(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold">Invite Client Admin — {displayId}</h3>
            <div className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-700/50 p-3 rounded">
              Client: <span className="font-medium">{client?.name}</span> ({displayId}) • Seats {usage ? `${usage.active}/${usage.max===-1?'∞':usage.max}` : ''} {full && <span className="text-red-600">— limit reached, deactivate first</span>}
            </div>
            <form onSubmit={handleInvite} className="space-y-3">
              <input placeholder="Email *" value={invite.email} onChange={e=>setInvite({...invite,email:e.target.value})} className="w-full border p-2 rounded" required />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="First Name *" value={invite.firstName} onChange={e=>setInvite({...invite,firstName:e.target.value})} className="border p-2 rounded" required />
                <input placeholder="Last Name *" value={invite.lastName} onChange={e=>setInvite({...invite,lastName:e.target.value})} className="border p-2 rounded" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Mobile (optional)" value={invite.mobile} onChange={e=>setInvite({...invite,mobile:e.target.value})} className="border p-2 rounded" />
                <input placeholder="Whatsapp (optional)" value={invite.whatsappSameAsMobile ? invite.mobile : invite.whatsapp} onChange={e=>setInvite({...invite,whatsapp:e.target.value})} disabled={invite.whatsappSameAsMobile} className="border p-2 rounded disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-400" />
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={invite.whatsappSameAsMobile} onChange={e=>setInvite({...invite,whatsappSameAsMobile:e.target.checked})} /> Whatsapp same as Mobile</label>
              <div>
                <label className="text-xs font-medium text-gray-600">Role *</label>
                <select value={invite.role} onChange={e=>setInvite({...invite, role: e.target.value as any})} className="w-full border p-2 rounded">
                  <option value="client_admin">Client Admin</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <input placeholder="Temp Password (optional, auto if blank)" value={invite.tempPassword} onChange={e=>setInvite({...invite,tempPassword:e.target.value})} className="w-full border p-2 rounded" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={()=>setShowInviteModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" disabled={!!full} className={`px-4 py-2 rounded text-white ${full?'bg-gray-400':'bg-blue-600'}`}>Invite</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditUserModal && editUserTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setShowEditUserModal(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <h3 className="text-lg font-semibold">Edit Client Admin</h3>
            <div className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-700/50 p-3 rounded space-y-1">
              <div><span className="font-medium">Client:</span> {displayId} — {client?.name}</div>
              <div><span className="font-medium">Email:</span> {editUserTarget.email} <span className="text-gray-400">(cannot be changed)</span></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="First Name *" value={editUserForm.firstName} onChange={e=>setEditUserForm({...editUserForm,firstName:e.target.value})} className="border p-2 rounded" />
              <input placeholder="Last Name *" value={editUserForm.lastName} onChange={e=>setEditUserForm({...editUserForm,lastName:e.target.value})} className="border p-2 rounded" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Mobile (optional)" value={editUserForm.mobile} onChange={e=>setEditUserForm({...editUserForm,mobile:e.target.value})} className="border p-2 rounded" />
              <input placeholder="Whatsapp (optional)" value={editUserForm.whatsappSameAsMobile ? editUserForm.mobile : editUserForm.whatsapp} onChange={e=>setEditUserForm({...editUserForm,whatsapp:e.target.value})} disabled={editUserForm.whatsappSameAsMobile} className="border p-2 rounded disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-400" />
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editUserForm.whatsappSameAsMobile} onChange={e=>setEditUserForm({...editUserForm,whatsappSameAsMobile:e.target.checked})} /> Whatsapp same as Mobile</label>
            <div className="flex justify-end gap-2">
              <button onClick={()=>setShowEditUserModal(false)} className="px-4 py-2 border rounded">Cancel</button>
              <button onClick={handleEditUserSave} className="bg-blue-600 text-white px-4 py-2 rounded">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ClientDetailPage;
