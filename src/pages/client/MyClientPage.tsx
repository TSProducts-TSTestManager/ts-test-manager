import React, { useEffect, useState } from 'react';
import { getClients, getClientUsage, getClientUsers, createClientAdmin, resetClientAdminPassword, deactivateUser, restoreUser, updateClient, updateClientUser } from '../../services/clientApi';
import { connectJira, disconnectJira, getJiraConfig, connectMyJira, getMyJira, disconnectMyJira, connectProjectJira, getProjectJira, disconnectProjectJira } from '../../services/jiraApi';
import { getProjects } from '../../services/testManagerApi';
import { useAuthStore } from '../../store/authStore';
import type { Client, ClientUser, SeatUsage } from '../../types/client';
import { Eye, EyeOff, ShieldCheck, User as UserIcon, Eye as EyeIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

const MyClientPage: React.FC = () => {
  const { user } = useAuthStore();
  const [client, setClient] = useState<Client | null>(null);
  const [usage, setUsage] = useState<SeatUsage | null>(null);
  const [users, setUsers] = useState<ClientUser[]>([]);
  const [tab, setTab] = useState<'overview' | 'users' | 'jira' | 'myJira' | 'projectJira'>('overview');
  const [jira, setJira] = useState<any>(null);
  const [myJira, setMyJira] = useState<any>(null);
  const [myJiraForm, setMyJiraForm] = useState({ email: '', apiToken: '' });
  const [projects, setProjects] = useState<any[]>([]);
  const [projectJiras, setProjectJiras] = useState<Record<string, any>>({});
  const [projectJiraForms, setProjectJiraForms] = useState<Record<string, { domain: string; projectKey: string }>>({});
  const [invite, setInvite] = useState({ email: '', firstName: '', lastName: '', mobile: '', whatsapp: '', whatsappSameAsMobile: false, tempPassword: '', role: 'client_admin' as 'client_admin'|'member'|'viewer' });
  const [jiraForm, setJiraForm] = useState({ domain: '', email: '', apiToken: '', projectKey: '' });
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTarget, setResetTarget] = useState<ClientUser | null>(null);
  const [resetPwd, setResetPwd] = useState('');
  const [showResetEye, setShowResetEye] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState<ClientUser | null>(null);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editUserTarget, setEditUserTarget] = useState<ClientUser | null>(null);
  const [editUserForm, setEditUserForm] = useState({ firstName: '', lastName: '', mobile: '', whatsapp: '', whatsappSameAsMobile: false });
  const [userPage, setUserPage] = useState(1);
  const pageSize = 10;
  const paginatedUsers = users.slice((userPage - 1) * pageSize, userPage * pageSize);
  const totalPages = Math.ceil(users.length / pageSize) || 1;
  const getRoleBadge = (role: string) => {
    if (role === 'client_admin') return { label: 'Admin', cls: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800', Icon: ShieldCheck };
    if (role === 'member') return { label: 'Member', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800', Icon: UserIcon };
    return { label: 'Viewer', cls: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800', Icon: EyeIcon };
  };
  const [editingClient, setEditingClient] = useState(false);
  const [editForm, setEditForm] = useState({ clientName: '', firstName: '', lastName: '', description: '', mobile: '', whatsapp: '', whatsappSameAsMobile: false, addressLine1: '', addressLine2: '', city: '', state: '', country: 'India', pinCode: '' });

  const isClientAdmin = (user as any)?.role === 'client_admin';
  const indianStates = ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Delhi","Jammu and Kashmir","Ladakh","Puducherry","Chandigarh","Andaman and Nicobar Islands","Dadra and Nagar Haveli and Daman and Diu","Lakshadweep"];
  const isValidPhone = (v: string) => { if (!v) return true; const d = v.replace(/[\s\-\(\)]/g, ""); const norm = d.startsWith("+91") ? d.slice(3) : d.startsWith("91") && d.length === 12 ? d.slice(2) : d.startsWith("0") ? d.slice(1) : d; return /^[6-9]\d{9}$/.test(norm); };
  const isValidPin = (v: string) => /^[1-9][0-9]{5}$/.test(v.trim());
  const isValidEmail = (v: string) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v);

  const load = async () => {
    try {
      const all = await getClients();
      // client_admin has exactly one, find by user.clientId or first
      const userClientId = (user as any)?.clientId;
      let c: Client | null = null;
      if (userClientId) c = all.find(x => x._id === userClientId || x.displayId === userClientId) || all[0] || null;
      else c = all[0] || null;
      if (!c) return;
      setClient(c);
      setEditForm({
        clientName: c.name || '',
        firstName: c.contactFirstName || '',
        lastName: c.contactLastName || '',
        description: c.description || '',
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
      try { setUsage(await getClientUsage(c.displayId)); } catch {}
      try { setUsers(await getClientUsers(c.displayId, 'all')); } catch (e:any) { toast.error(e.message); }
      try { setJira(await getJiraConfig(c.displayId)); } catch {}
      try { setMyJira(await getMyJira()); } catch {}
      try {
        const projs = await getProjects();
        setProjects(projs as any);
        for (const p of (projs as any)) {
          try { const pj = await getProjectJira((p as any).id || (p as any)._id); setProjectJiras(m => ({ ...m, [(p as any).id || (p as any)._id]: pj })); } catch {}
        }
      } catch {}
    } catch (e:any) { toast.error(e.message); }
  };

  useEffect(() => { load(); }, [user]);
  useEffect(() => { setUserPage(1); }, [users.length]);

  const active = users.filter(u=>u.status==='active').length;
  const full = usage ? (usage.max !== -1 && usage.active >= usage.max) : false;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;
    if (!invite.email.trim() || !isValidEmail(invite.email.trim())) { toast.error('Valid Email required'); return; }
    if (!invite.firstName.trim() || !invite.lastName.trim()) { toast.error('First & Last required'); return; }
    if (invite.mobile && !isValidPhone(invite.mobile)) { toast.error('Mobile must be 10 digits (India)'); return; }
    const wp = invite.whatsappSameAsMobile ? invite.mobile : invite.whatsapp;
    if (wp && !isValidPhone(wp)) { toast.error('Whatsapp must be 10 digits'); return; }
    try {
      await createClientAdmin(client.displayId, {
        email: invite.email, firstName: invite.firstName.trim(), lastName: invite.lastName.trim(),
        name: `${invite.firstName} ${invite.lastName}`.trim(), mobile: invite.mobile || undefined,
        whatsapp: invite.whatsappSameAsMobile ? invite.mobile : (invite.whatsapp || undefined), whatsappSameAsMobile: invite.whatsappSameAsMobile,
        tempPassword: invite.tempPassword || undefined, role: invite.role
      } as any);
      toast.success('User invited');
      setInvite({ email:'', firstName:'', lastName:'', mobile:'', whatsapp:'', whatsappSameAsMobile:false, tempPassword:'', role:'client_admin' });
      setShowInviteModal(false);
      load();
    } catch(e:any){ toast.error(e.message); }
  };

  const handleSaveClient = async () => {
    if (!client) return;
    if (!editForm.clientName.trim() || !editForm.firstName.trim() || !editForm.lastName.trim()) { toast.error('Client Name, First & Last required'); return; }
    if (editForm.mobile && !isValidPhone(editForm.mobile)) { toast.error('Mobile must be 10 digits'); return; }
    const ewp = editForm.whatsappSameAsMobile ? editForm.mobile : editForm.whatsapp;
    if (ewp && !isValidPhone(ewp)) { toast.error('Whatsapp must be 10 digits'); return; }
    if (!editForm.addressLine1.trim() || !editForm.city.trim() || !editForm.state.trim() || !editForm.country.trim() || !editForm.pinCode.trim()) { toast.error('Address required'); return; }
    if (!isValidPin(editForm.pinCode)) { toast.error('Pin 6 digits'); return; }
    try {
      await updateClient(client.displayId, {
        name: editForm.clientName.trim(), description: editForm.description,
        contactFirstName: editForm.firstName.trim(), contactLastName: editForm.lastName.trim(),
        mobile: editForm.mobile || undefined, whatsapp: editForm.whatsappSameAsMobile ? editForm.mobile : (editForm.whatsapp || undefined), whatsappSameAsMobile: editForm.whatsappSameAsMobile,
        address: { addressLine1: editForm.addressLine1.trim(), addressLine2: editForm.addressLine2?.trim(), city: editForm.city.trim(), state: editForm.state.trim(), country: editForm.country.trim() || 'India', pinCode: editForm.pinCode.trim() }
      } as any);
      toast.success('Client updated');
      setEditingClient(false);
      load();
    } catch(e:any){ toast.error(e.message); }
  };

  const handleDeactivate = async (uid: string) => { if(!client) return; try { await deactivateUser(client.displayId, uid); toast.success('Deactivated'); load(); } catch(e:any){ toast.error(e.message);} };
  const handleRestore = async (uid: string) => { if(!client) return; try { await restoreUser(client.displayId, uid); toast.success('Restored'); load(); } catch(e:any){ toast.error(e.message);} };
  const openReset = (u: ClientUser) => { setResetTarget(u); setResetPwd(''); setShowResetEye(false); setShowResetModal(true); };
  const handleResetConfirm = async () => {
    if (!client || !resetTarget || !resetPwd) { toast.error('Password required'); return; }
    try { await resetClientAdminPassword(client.displayId, resetTarget._id, resetPwd); toast.success('Password reset'); setShowResetModal(false); } catch(e:any){ toast.error(e.message); }
  };
  const openEditUser = (u: ClientUser) => {
    setEditUserTarget(u);
    setEditUserForm({ firstName: u.firstName || u.name.split(' ')[0] || '', lastName: u.lastName || u.name.split(' ').slice(1).join(' ') || '', mobile: u.mobile || '', whatsapp: u.whatsapp || '', whatsappSameAsMobile: !!u.whatsappSameAsMobile });
    setShowEditUserModal(true);
  };
  const handleEditUserSave = async () => {
    if (!client || !editUserTarget) return;
    if (!editUserForm.firstName.trim() || !editUserForm.lastName.trim()) { toast.error('First & Last required'); return; }
    if (editUserForm.mobile && !isValidPhone(editUserForm.mobile)) { toast.error('Mobile 10 digits'); return; }
    const uw = editUserForm.whatsappSameAsMobile ? editUserForm.mobile : editUserForm.whatsapp;
    if (uw && !isValidPhone(uw)) { toast.error('Whatsapp 10 digits'); return; }
    try {
      await updateClientUser(client.displayId, editUserTarget._id, {
        firstName: editUserForm.firstName.trim(), lastName: editUserForm.lastName.trim(),
        mobile: editUserForm.mobile || undefined, whatsapp: editUserForm.whatsappSameAsMobile ? editUserForm.mobile : (editUserForm.whatsapp || undefined), whatsappSameAsMobile: editUserForm.whatsappSameAsMobile
      } as any);
      toast.success('User updated'); setShowEditUserModal(false); load();
    } catch(e:any){ toast.error(e.message); }
  };
  const handleJiraConnect = async (e: React.FormEvent) => {
    e.preventDefault(); if (!client) return;
    try { await connectJira(client.displayId, jiraForm); toast.success('JIRA connected (client fallback)'); load(); } catch(e:any){ toast.error(e.message); }
  };
  const handleMyJiraConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await connectMyJira({ email: (myJiraForm as any).email, apiToken: (myJiraForm as any).apiToken }); toast.success('My JIRA connected'); load(); } catch(e:any){ toast.error(e.message); }
  };
  const handleProjectJiraConnect = async (projectId: string) => {
    const f = projectJiraForms[projectId];
    if (!f?.domain?.trim() || !f?.projectKey?.trim()) { toast.error('Domain and Project Key required (every project)'); return; }
    try { await connectProjectJira(projectId, { domain: f.domain.trim(), projectKey: f.projectKey.trim() }); toast.success('Project JIRA mapped'); load(); } catch(e:any){ toast.error(e.message); }
  };

  if (!client) return <div className="bg-white dark:bg-gray-900 min-h-full p-6">Loading your client...</div>;

  return (
    <div className="bg-white dark:bg-gray-900 min-h-full p-4 sm:p-6 space-y-6">
      <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl p-5 text-white">
        <h1 className="text-xl font-bold">My Client — {client.displayId}</h1>
        <p className="text-blue-100 text-sm">{client.name} • Contact: {client.contactFirstName} {client.contactLastName} • {client.mobile || ''}</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex justify-between items-start">
          <div className="space-y-2 min-w-0">
            <div className="flex gap-2 flex-wrap">
              <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">{client.displayId}</span>
              <span className={`text-xs px-2 py-1 rounded-full ${client.status==='active'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{client.status}</span>
              <span className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 px-2 py-1 rounded-full capitalize">{client.plan} • {client.maxUsers === -1 ? 'Unlimited' : `${client.maxUsers} Users`}</span>
              <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">Seats {usage ? `${usage.active}/${usage.max===-1?'∞':usage.max}` : `${client.maxUsers}`}</span>
            </div>
            <h2 className="text-lg font-bold truncate">{client.name}</h2>
            {client.description && <p className="text-sm text-gray-500 italic">{client.description}</p>}
            <div className="text-xs text-gray-500 space-y-1">
              <div>Address: {(client as any).address ? `${(client as any).address.addressLine1}, ${(client as any).address.city}, ${(client as any).address.state} - ${(client as any).address.pinCode}` : '—'}</div>
              <div>Mobile: {client.mobile || '—'} • Whatsapp: {client.whatsapp || '—'} {client.whatsappSameAsMobile && '(same)'}</div>
            </div>
          </div>
          {isClientAdmin && <button onClick={()=>setEditingClient(true)} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg h-fit">Edit</button>}
        </div>
        {editingClient && isClientAdmin && (
          <div className="mt-4 border-t pt-4 space-y-3">
            <input placeholder="Client Name *" value={editForm.clientName} onChange={e=>setEditForm({...editForm,clientName:e.target.value})} className="w-full border p-2 rounded" />
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="First Name *" value={editForm.firstName} onChange={e=>setEditForm({...editForm,firstName:e.target.value})} className="border p-2 rounded" />
              <input placeholder="Last Name *" value={editForm.lastName} onChange={e=>setEditForm({...editForm,lastName:e.target.value})} className="border p-2 rounded" />
            </div>
            <input placeholder="Description" value={editForm.description} onChange={e=>setEditForm({...editForm,description:e.target.value})} className="w-full border p-2 rounded" />
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Mobile" value={editForm.mobile} onChange={e=>setEditForm({...editForm,mobile:e.target.value})} className="border p-2 rounded" />
              <input placeholder="Whatsapp" value={editForm.whatsappSameAsMobile ? editForm.mobile : editForm.whatsapp} onChange={e=>setEditForm({...editForm,whatsapp:e.target.value})} disabled={editForm.whatsappSameAsMobile} className="border p-2 rounded disabled:bg-gray-200 dark:disabled:bg-gray-700" />
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.whatsappSameAsMobile} onChange={e=>setEditForm({...editForm,whatsappSameAsMobile:e.target.checked})} /> Whatsapp same as Mobile</label>
            <input placeholder="Address Line 1 *" value={editForm.addressLine1} onChange={e=>setEditForm({...editForm,addressLine1:e.target.value})} className="w-full border p-2 rounded" />
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="City *" value={editForm.city} onChange={e=>setEditForm({...editForm,city:e.target.value})} className="border p-2 rounded" />
              <select value={editForm.state} onChange={e=>setEditForm({...editForm,state:e.target.value})} className="border p-2 rounded"><option value="">State *</option>{indianStates.map(s=><option key={s} value={s}>{s}</option>)}</select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Country *" value={editForm.country} onChange={e=>setEditForm({...editForm,country:e.target.value})} className="border p-2 rounded" />
              <input placeholder="Pin *" value={editForm.pinCode} onChange={e=>setEditForm({...editForm,pinCode:e.target.value})} className="border p-2 rounded" maxLength={6} />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={()=>setEditingClient(false)} className="border px-4 py-2 rounded">Cancel</button>
              <button onClick={handleSaveClient} className="bg-blue-600 text-white px-4 py-2 rounded">Save</button>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-4 border-b overflow-x-auto">
        <button onClick={()=>setTab('overview')} className={`pb-2 text-sm whitespace-nowrap ${tab==='overview'?'border-b-2 border-blue-600 text-blue-600':''}`}>Overview</button>
        <button onClick={()=>setTab('users')} className={`pb-2 text-sm whitespace-nowrap ${tab==='users'?'border-b-2 border-blue-600 text-blue-600':''}`}>Users ({active})</button>
        <button onClick={()=>setTab('myJira')} className={`pb-2 text-sm whitespace-nowrap ${tab==='myJira'?'border-b-2 border-blue-600 text-blue-600':''}`}>My JIRA</button>
        <button onClick={()=>setTab('projectJira')} className={`pb-2 text-sm whitespace-nowrap ${tab==='projectJira'?'border-b-2 border-blue-600 text-blue-600':''}`}>Project JIRA</button>
        <button onClick={()=>setTab('jira')} className={`pb-2 text-sm whitespace-nowrap ${tab==='jira'?'border-b-2 border-blue-600 text-blue-600':''}`}>Client Fallback</button>
      </div>

      {tab==='overview' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border p-5 space-y-3">
          <h3 className="font-semibold">Client Overview</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-xl"><div className="text-gray-400 uppercase">Seats</div><div className="font-bold text-lg">{usage ? `${usage.active}/${usage.max===-1?'∞':usage.max}` : '—'}</div></div>
            <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-xl"><div className="text-gray-400 uppercase">Plan</div><div className="font-bold capitalize">{client.plan}</div></div>
            <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-xl"><div className="text-gray-400 uppercase">City</div><div className="font-medium">{(client as any).address?.city || '—'}</div></div>
            <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-xl"><div className="text-gray-400 uppercase">Status</div><div className="font-medium capitalize">{client.status}</div></div>
          </div>
          <p className="text-xs text-gray-500">Max Users change requires Super Admin (current: {client.maxUsers}). You can edit other details above.</p>
        </div>
      )}

      {tab==='users' && (
        <>
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Users</h3>
            <button onClick={()=>setShowInviteModal(true)} disabled={!!full} className={`px-3 py-1.5 rounded-lg text-sm text-white ${full?'bg-gray-400':'bg-blue-600'}`}>+ Add User</button>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                  <tr className="text-left">
                    <th className="px-3 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500 whitespace-nowrap">S.No</th>
                    <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500 whitespace-nowrap">Email</th>
                    <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500 whitespace-nowrap">First Name</th>
                    <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500 whitespace-nowrap">Last Name</th>
                    <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500 whitespace-nowrap">Mobile</th>
                    <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500 whitespace-nowrap">Whatsapp</th>
                    <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500 whitespace-nowrap">Role</th>
                    <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500 whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500 whitespace-nowrap text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {paginatedUsers.map((u, idx) => {
                    const badge = getRoleBadge(u.role);
                    const serial = (userPage - 1) * pageSize + idx + 1;
                    const BadgeIcon = badge.Icon;
                    return (
                    <tr key={u._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-3 py-3 text-center text-xs font-medium text-gray-500">{serial}</td>
                      <td className="px-4 py-3 align-middle max-w-[200px] truncate font-medium" title={u.email}>{u.email}</td>
                      <td className="px-4 py-3 align-middle whitespace-nowrap">{u.firstName || u.name.split(' ')[0] || '—'}</td>
                      <td className="px-4 py-3 align-middle whitespace-nowrap">{u.lastName || u.name.split(' ').slice(1).join(' ') || '—'}</td>
                      <td className="px-4 py-3 align-middle whitespace-nowrap font-mono text-xs">{u.mobile || '—'}</td>
                      <td className="px-4 py-3 align-middle whitespace-nowrap font-mono text-xs">{u.whatsapp || '—'} {u.whatsappSameAsMobile && <span className="text-xs text-gray-400">(same)</span>}</td>
                      <td className="px-4 py-3 align-middle whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.cls}`}>
                          <BadgeIcon size={12} /> {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle whitespace-nowrap"><span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${u.status==='active' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800' : 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-300'}`}>{u.status === 'active' ? 'Active' : 'Inactive'}</span></td>
                      <td className="px-4 py-3 align-middle whitespace-nowrap">
                        <div className="flex gap-1 justify-end">
                          {isClientAdmin && <button onClick={()=>openEditUser(u)} className="text-gray-700 dark:text-gray-300 text-xs border border-gray-200 dark:border-gray-600 px-2.5 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 whitespace-nowrap">Edit</button>}
                          {u.status==='active' ? <button onClick={()=>setShowDeactivateConfirm(u)} className="text-red-600 text-xs border border-red-200 px-2.5 py-1 rounded-lg hover:bg-red-50 whitespace-nowrap">Deactivate</button> : <button onClick={()=>handleRestore(u._id)} className="text-green-600 text-xs border border-green-200 px-2.5 py-1 rounded-lg hover:bg-green-50 whitespace-nowrap">Restore</button>}
                          <button onClick={()=>openReset(u)} className="text-blue-600 text-xs border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-50 whitespace-nowrap">Reset Pwd</button>
                        </div>
                      </td>
                    </tr>
                  )})}
                  {paginatedUsers.length===0 && <tr><td colSpan={9} className="p-6 text-center text-gray-400">No users yet</td></tr>}
                </tbody>
              </table>
            </div>
            {users.length > pageSize && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <span className="text-xs text-gray-500">Showing {(userPage - 1) * pageSize + 1}-{Math.min(userPage * pageSize, users.length)} of {users.length} users</span>
                <div className="flex items-center gap-2">
                  <button onClick={()=>setUserPage(p=>Math.max(1,p-1))} disabled={userPage===1} className="p-1.5 rounded-lg border bg-white dark:bg-gray-800 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"><ChevronLeft size={16}/></button>
                  <span className="text-xs font-medium px-2">Page {userPage} of {totalPages}</span>
                  <button onClick={()=>setUserPage(p=>Math.min(totalPages,p+1))} disabled={userPage===totalPages} className="p-1.5 rounded-lg border bg-white dark:bg-gray-800 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"><ChevronRight size={16}/></button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {tab==='myJira' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border p-4 space-y-3">
          <h3 className="font-semibold">My JIRA — Per-User (own cred, every user, real-time)</h3>
          <p className="text-xs text-gray-500">Your personal Atlassian email + API token (same token can be reused with different email if needed). Used together with Project's domain/projectKey when you create/link bugs.</p>
          <div className="text-xs">Current: {myJira?.enabled ? `${myJira.email} • Connected` : 'Not connected'}</div>
          <form onSubmit={handleMyJiraConnect} className="space-y-2">
            <input placeholder="Atlassian Email (you@company.com)" value={myJiraForm.email} onChange={e=>setMyJiraForm({...myJiraForm, email:e.target.value})} className="w-full border p-2 rounded" required />
            <input placeholder="API Token (id.atlassian.com — same token can be used with different email)" value={myJiraForm.apiToken} onChange={e=>setMyJiraForm({...myJiraForm, apiToken:e.target.value})} className="w-full border p-2 rounded" required />
            <div className="flex gap-2">
              <button className="bg-blue-600 text-white px-3 py-1.5 rounded">Connect My JIRA</button>
              {myJira?.enabled && <button type="button" onClick={async()=>{await disconnectMyJira(); toast.success('My JIRA disconnected'); load();}} className="border px-3 py-1.5 rounded">Disconnect</button>}
            </div>
          </form>
        </div>
      )}

      {tab==='projectJira' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border p-4 space-y-3">
          <h3 className="font-semibold">Project JIRA — Every Project Level (domain + projectKey)</h3>
          <p className="text-xs text-gray-500">Each project maps to its own JIRA project. When you log a bug, your own email/token + this project's domain/projectKey is used (verified via /rest/api/3/myself in real time).</p>
          <div className="space-y-4">
            {projects.map(p=> {
              const pid = (p as any).id || (p as any)._id;
              const pj = projectJiras[pid];
              const form = projectJiraForms[pid] || { domain: '', projectKey: '' };
              return (
                <div key={pid} className="border rounded-xl p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm">{(p as any).name} <span className="font-mono text-xs text-gray-500">{(p as any).displayId || ''}</span></span>
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700">{pj?.enabled ? `${pj.domain} / ${pj.projectKey}` : 'Not mapped'}</span>
                  </div>
                  {isClientAdmin ? (
                    <div className="flex gap-2">
                      <input placeholder="Domain (xxx.atlassian.net)" value={form.domain} onChange={e=>setProjectJiraForms(m=>({...m, [pid]: {...(m[pid]||{domain:'',projectKey:''}), domain:e.target.value}}))} className="flex-1 border p-2 rounded text-sm" />
                      <input placeholder="Project Key (ACME)" value={form.projectKey} onChange={e=>setProjectJiraForms(m=>({...m, [pid]: {...(m[pid]||{domain:'',projectKey:''}), projectKey:e.target.value.toUpperCase()}}))} className="flex-1 border p-2 rounded text-sm font-mono uppercase" />
                      <button onClick={()=>handleProjectJiraConnect(pid)} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm whitespace-nowrap">Map</button>
                      {pj?.enabled && <button onClick={async()=>{await disconnectProjectJira(pid); toast.success('Project JIRA cleared'); load();}} className="border px-3 py-1.5 rounded text-sm">Clear</button>}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">Only Client Admin can map. Current: {pj?.enabled ? `${pj.domain} / ${pj.projectKey}` : '—'}</p>
                  )}
                </div>
              );
            })}
            {projects.length===0 && <p className="text-sm text-gray-400">No projects yet — create a project first</p>}
          </div>
        </div>
      )}

      {tab==='jira' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border p-4 space-y-3">
          <h3 className="font-semibold">Client JIRA — Fallback for Old Tickets (kept)</h3>
          <p className="text-xs text-gray-500">Kept for backward compat. New tickets use My JIRA + Project JIRA above. Old tickets linked via client fallback still sync.</p>
          <div className="text-xs text-gray-500">Current: {jira?.enabled ? `${jira.domain} / ${jira.projectKey}` : 'Not connected (fallback)'}</div>
          {isClientAdmin ? (
            <form onSubmit={handleJiraConnect} className="space-y-2">
              <input placeholder="Domain (xxx.atlassian.net)" value={jiraForm.domain} onChange={e=>setJiraForm({...jiraForm,domain:e.target.value})} className="w-full border p-2 rounded" required />
              <input placeholder="Email" value={jiraForm.email} onChange={e=>setJiraForm({...jiraForm,email:e.target.value})} className="w-full border p-2 rounded" required />
              <input placeholder="API Token" value={jiraForm.apiToken} onChange={e=>setJiraForm({...jiraForm,apiToken:e.target.value})} className="w-full border p-2 rounded" required />
              <input placeholder="Project Key" value={jiraForm.projectKey} onChange={e=>setJiraForm({...jiraForm,projectKey:e.target.value})} className="w-full border p-2 rounded" required />
              <button className="bg-blue-600 text-white px-3 py-1.5 rounded">Connect / Update (fallback)</button>
              {jira?.enabled && <button type="button" onClick={async()=>{await disconnectJira(client.displayId); toast.success('Client JIRA disconnected'); load();}} className="ml-2 border px-3 py-1.5 rounded">Disconnect</button>}
            </form>
          ) : <p className="text-xs text-gray-500">Only Client Admin can configure fallback.</p>}
        </div>
      )}

      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setShowInviteModal(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold">Add User — {client.displayId}</h3>
            <form onSubmit={handleInvite} className="space-y-3">
              <input placeholder="Email *" value={invite.email} onChange={e=>setInvite({...invite,email:e.target.value})} className="w-full border p-2 rounded" required />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="First Name *" value={invite.firstName} onChange={e=>setInvite({...invite,firstName:e.target.value})} className="border p-2 rounded" required />
                <input placeholder="Last Name *" value={invite.lastName} onChange={e=>setInvite({...invite,lastName:e.target.value})} className="border p-2 rounded" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Mobile" value={invite.mobile} onChange={e=>setInvite({...invite,mobile:e.target.value})} className="border p-2 rounded" />
                <input placeholder="Whatsapp" value={invite.whatsappSameAsMobile ? invite.mobile : invite.whatsapp} onChange={e=>setInvite({...invite,whatsapp:e.target.value})} disabled={invite.whatsappSameAsMobile} className="border p-2 rounded disabled:bg-gray-200" />
              </div>
              <label className="flex gap-2 text-sm"><input type="checkbox" checked={invite.whatsappSameAsMobile} onChange={e=>setInvite({...invite,whatsappSameAsMobile:e.target.checked})} /> Whatsapp same as Mobile</label>
              <select value={invite.role} onChange={e=>setInvite({...invite,role:e.target.value as any})} className="w-full border p-2 rounded">
                <option value="client_admin">Client Admin</option><option value="member">Member</option><option value="viewer">Viewer</option>
              </select>
              <input placeholder="Temp Password (auto if blank)" value={invite.tempPassword} onChange={e=>setInvite({...invite,tempPassword:e.target.value})} className="w-full border p-2 rounded" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={()=>setShowInviteModal(false)} className="border px-4 py-2 rounded">Cancel</button>
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Add</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showResetModal && resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setShowResetModal(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md space-y-3">
            <h3 className="font-semibold">Reset Password — {resetTarget.email}</h3>
            <div className="relative">
              <input type={showResetEye ? "text" : "password"} value={resetPwd} onChange={e=>setResetPwd(e.target.value)} placeholder="New temp password" className="w-full border p-2 rounded pr-10" />
              <button type="button" onClick={()=>setShowResetEye(!showResetEye)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">{showResetEye ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={()=>setShowResetModal(false)} className="border px-4 py-2 rounded">Cancel</button>
              <button onClick={handleResetConfirm} className="bg-blue-600 text-white px-4 py-2 rounded">Reset</button>
            </div>
          </div>
        </div>
      )}

      {showDeactivateConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setShowDeactivateConfirm(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md space-y-3">
            <h3 className="font-semibold">Deactivate {showDeactivateConfirm.email}?</h3>
            <p className="text-sm text-gray-500">This will free 1 seat. You can restore later.</p>
            <div className="flex justify-end gap-2">
              <button onClick={()=>setShowDeactivateConfirm(null)} className="border px-4 py-2 rounded">Cancel</button>
              <button onClick={async()=>{ await handleDeactivate(showDeactivateConfirm._id); setShowDeactivateConfirm(null); }} className="bg-red-600 text-white px-4 py-2 rounded">Deactivate</button>
            </div>
          </div>
        </div>
      )}

      {showEditUserModal && editUserTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setShowEditUserModal(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg space-y-3">
            <h3 className="font-semibold">Edit User — {editUserTarget.email}</h3>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="First Name *" value={editUserForm.firstName} onChange={e=>setEditUserForm({...editUserForm,firstName:e.target.value})} className="border p-2 rounded" />
              <input placeholder="Last Name *" value={editUserForm.lastName} onChange={e=>setEditUserForm({...editUserForm,lastName:e.target.value})} className="border p-2 rounded" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Mobile" value={editUserForm.mobile} onChange={e=>setEditUserForm({...editUserForm,mobile:e.target.value})} className="border p-2 rounded" />
              <input placeholder="Whatsapp" value={editUserForm.whatsappSameAsMobile ? editUserForm.mobile : editUserForm.whatsapp} onChange={e=>setEditUserForm({...editUserForm,whatsapp:e.target.value})} disabled={editUserForm.whatsappSameAsMobile} className="border p-2 rounded disabled:bg-gray-200" />
            </div>
            <label className="flex gap-2 text-sm"><input type="checkbox" checked={editUserForm.whatsappSameAsMobile} onChange={e=>setEditUserForm({...editUserForm,whatsappSameAsMobile:e.target.checked})} /> Whatsapp same as Mobile</label>
            <div className="flex justify-end gap-2">
              <button onClick={()=>setShowEditUserModal(false)} className="border px-4 py-2 rounded">Cancel</button>
              <button onClick={handleEditUserSave} className="bg-blue-600 text-white px-4 py-2 rounded">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyClientPage;
