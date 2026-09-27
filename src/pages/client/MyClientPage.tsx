import React, { useCallback, useEffect, useState } from 'react';
import { getClients, getClientUsage, getClientUsers, createClientAdmin, resetClientAdminPassword, deactivateUser, restoreUser, updateClient, updateClientUser, getClientsError } from '../../services/clientApi';
import { connectMyJira, getMyJira, disconnectMyJira, connectProjectJira, getProjectJira, disconnectProjectJira } from '../../services/jiraApi';
import { getProjects } from '../../services/testManagerApi';
import { useAuthStore } from '../../store/authStore';
import type { Client, ClientUser, SeatUsage, ClientMemberRole, JiraIntegration } from '../../types/client';
import type { ProjectResponse } from '../../types/api/testManager.api';
import { Eye, EyeOff, ShieldCheck, User as UserIcon, Eye as EyeIcon, ChevronLeft, ChevronRight, LayoutDashboard, Users, Layers, UserCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { isValidPhone, normalizePhone } from '../../utils/phone';

const MyClientPage: React.FC = () => {
  const { user } = useAuthStore();
  const [client, setClient] = useState<Client | null>(null);
  const [usage, setUsage] = useState<SeatUsage | null>(null);
  const [users, setUsers] = useState<ClientUser[]>([]);
  const [tab, setTab] = useState<'overview' | 'users' | 'myJira' | 'projectJira'>('overview');
  const [myJira, setMyJira] = useState<JiraIntegration | null>(null);
  const [myJiraForm, setMyJiraForm] = useState({ email: '', apiToken: '' });
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [projectJiras, setProjectJiras] = useState<Record<string, JiraIntegration | null>>({});
  const [projectJiraForms, setProjectJiraForms] = useState<Record<string, { domain: string; projectKey: string }>>({});
  const [invite, setInvite] = useState({ email: '', firstName: '', lastName: '', mobile: '', whatsapp: '', whatsappSameAsMobile: false, tempPassword: '', role: 'client_admin' as ClientMemberRole });
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

  // Client record + seat + user management is restricted to admins:
  // members / viewers get a read-only user directory (backend enforces too).
  const canManage = ['super_admin', 'client_admin'].includes(user?.role ?? '');
  const indianStates = ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Delhi","Jammu and Kashmir","Ladakh","Puducherry","Chandigarh","Andaman and Nicobar Islands","Dadra and Nagar Haveli and Daman and Diu","Lakshadweep"];
  const isValidPin = (v: string) => /^[1-9][0-9]{5}$/.test(v.trim());
  const isValidEmail = (v: string) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v);

  const load = useCallback(async () => {
    try {
      const all = await getClients();
      // client_admin has exactly one, find by user.clientId or first
      const userClientId = user?.clientId;
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
        mobile: normalizePhone(c.mobile || ''),
        whatsapp: normalizePhone(c.whatsapp || ''),
        whatsappSameAsMobile: !!c.whatsappSameAsMobile,
        addressLine1: c.address?.addressLine1 || '',
        addressLine2: c.address?.addressLine2 || '',
        city: c.address?.city || '',
        state: c.address?.state || '',
        country: c.address?.country || 'India',
        pinCode: c.address?.pinCode || '',
      });
      try { setUsage(await getClientUsage(c.displayId)); } catch (e: unknown) { console.warn('Seat usage unavailable:', (e as Error)?.message); }
      try { setUsers(await getClientUsers(c.displayId, 'all')); } catch (e: unknown) { toast.error(getClientsError(e)); }
      try { setMyJira(await getMyJira()); } catch { /* personal JIRA is optional; leave it unconfigured */ }
      try {
        const projs = await getProjects();
        setProjects(projs);
        for (const p of projs) {
          try { const pj = await getProjectJira(p.id); setProjectJiras(m => ({ ...m, [p.id]: pj })); } catch { /* this project simply has no JIRA mapping */ }
        }
      } catch { /* the project list is supplementary; the rest of the page still loads */ }
    } catch (e: unknown) { toast.error(getClientsError(e)); }
  }, [user, setEditForm]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setUserPage(1); }, [users.length]);

  const active = users.filter(u=>u.status==='active').length;
  const full = usage ? (usage.max !== -1 && usage.active >= usage.max) : false;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;
    if (!canManage) { toast.error('Only client admins can add users'); return; }
    if (!invite.email.trim() || !isValidEmail(invite.email.trim())) { toast.error('Valid Email required'); return; }
    if (!invite.firstName.trim() || !invite.lastName.trim()) { toast.error('First & Last required'); return; }
    if (invite.mobile && !isValidPhone(invite.mobile)) { toast.error('Mobile must be 10 digits (India)'); return; }
    const wp = invite.whatsappSameAsMobile ? invite.mobile : invite.whatsapp;
    if (wp && !isValidPhone(wp)) { toast.error('Whatsapp must be 10 digits'); return; }
    try {
      await createClientAdmin(client.displayId, {
        email: invite.email, firstName: invite.firstName.trim(), lastName: invite.lastName.trim(),
        name: `${invite.firstName} ${invite.lastName}`.trim(), mobile: normalizePhone(invite.mobile) || undefined,
        whatsapp: invite.whatsappSameAsMobile ? normalizePhone(invite.mobile) || undefined : (normalizePhone(invite.whatsapp) || undefined), whatsappSameAsMobile: invite.whatsappSameAsMobile,
        tempPassword: invite.tempPassword || undefined, role: invite.role
      });
      toast.success('User invited');
      setInvite({ email:'', firstName:'', lastName:'', mobile:'', whatsapp:'', whatsappSameAsMobile:false, tempPassword:'', role:'client_admin' });
      setShowInviteModal(false);
      load();
    } catch(e: unknown){ toast.error(getClientsError(e)); }
  };

  const handleSaveClient = async () => {
    if (!client) return;
    if (!canManage) { toast.error('Only client admins can edit the client'); return; }
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
        mobile: normalizePhone(editForm.mobile) || undefined, whatsapp: editForm.whatsappSameAsMobile ? normalizePhone(editForm.mobile) || undefined : (normalizePhone(editForm.whatsapp) || undefined), whatsappSameAsMobile: editForm.whatsappSameAsMobile,
        address: { addressLine1: editForm.addressLine1.trim(), addressLine2: editForm.addressLine2?.trim(), city: editForm.city.trim(), state: editForm.state.trim(), country: editForm.country.trim() || 'India', pinCode: editForm.pinCode.trim() }
      });
      toast.success('Client updated');
      setEditingClient(false);
      load();
    } catch(e: unknown){ toast.error(getClientsError(e)); }
  };

  const handleDeactivate = async (uid: string) => { if(!client) return; if(!canManage){ toast.error('Only client admins can manage users'); return; } try { await deactivateUser(client.displayId, uid); toast.success('Deactivated'); load(); } catch(e: unknown){ toast.error(getClientsError(e));} };
  const handleRestore = async (uid: string) => { if(!client) return; if(!canManage){ toast.error('Only client admins can manage users'); return; } try { await restoreUser(client.displayId, uid); toast.success('Restored'); load(); } catch(e: unknown){ toast.error(getClientsError(e));} };
  const openReset = (u: ClientUser) => {
    if(!canManage){ toast.error('Only client admins can manage users'); return; }
    setResetTarget(u); setResetPwd(''); setShowResetEye(false); setShowResetModal(true);
  };
  const handleResetConfirm = async () => {
    if (!client || !resetTarget || !resetPwd) { toast.error('Password required'); return; }
    if(!canManage){ toast.error('Only client admins can manage users'); return; }
    try { await resetClientAdminPassword(client.displayId, resetTarget._id, resetPwd); toast.success('Password reset'); setShowResetModal(false); } catch(e: unknown){ toast.error(getClientsError(e)); }
  };
  const openEditUser = (u: ClientUser) => {
    if(!canManage){ toast.error('Only client admins can manage users'); return; }
    setEditUserTarget(u);
    setEditUserForm({ firstName: u.firstName || u.name.split(' ')[0] || '', lastName: u.lastName || u.name.split(' ').slice(1).join(' ') || '', mobile: normalizePhone(u.mobile || ''), whatsapp: normalizePhone(u.whatsapp || ''), whatsappSameAsMobile: !!u.whatsappSameAsMobile });
    setShowEditUserModal(true);
  };
  const handleEditUserSave = async () => {
    if (!client || !editUserTarget) return;
    if (!canManage) { toast.error('Only client admins can manage users'); return; }
    if (!editUserForm.firstName.trim() || !editUserForm.lastName.trim()) { toast.error('First & Last required'); return; }
    if (editUserForm.mobile && !isValidPhone(editUserForm.mobile)) { toast.error('Mobile 10 digits'); return; }
    const uw = editUserForm.whatsappSameAsMobile ? editUserForm.mobile : editUserForm.whatsapp;
    if (uw && !isValidPhone(uw)) { toast.error('Whatsapp 10 digits'); return; }
    try {
      await updateClientUser(client.displayId, editUserTarget._id, {
        firstName: editUserForm.firstName.trim(), lastName: editUserForm.lastName.trim(),
        mobile: normalizePhone(editUserForm.mobile) || undefined, whatsapp: editUserForm.whatsappSameAsMobile ? normalizePhone(editUserForm.mobile) || undefined : (normalizePhone(editUserForm.whatsapp) || undefined), whatsappSameAsMobile: editUserForm.whatsappSameAsMobile
      });
      toast.success('User updated'); setShowEditUserModal(false); load();
    } catch(e: unknown){ toast.error(getClientsError(e)); }
  };
  const handleMyJiraConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await connectMyJira({ email: myJiraForm.email, apiToken: myJiraForm.apiToken }); toast.success('My JIRA connected'); load(); } catch(e: unknown){ toast.error(getClientsError(e)); }
  };
  const handleProjectJiraConnect = async (projectId: string) => {
    const f = projectJiraForms[projectId];
    if (!f?.domain?.trim() || !f?.projectKey?.trim()) { toast.error('Domain and Project Key required (every project)'); return; }
    try { await connectProjectJira(projectId, { domain: f.domain.trim(), projectKey: f.projectKey.trim() }); toast.success('Project JIRA mapped'); load(); } catch(e: unknown){ toast.error(getClientsError(e)); }
  };

  if (!client) return <div className="bg-white dark:bg-gray-900 min-h-full p-6">Loading your client...</div>;

  const tabItems: { id: typeof tab; label: string; icon: LucideIcon; count: number | null }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, count: null },
    { id: 'users', label: 'Users', icon: Users, count: active },
    { id: 'myJira', label: 'My JIRA', icon: UserCircle, count: myJira?.enabled ? 1 : 0 },
    { id: 'projectJira', label: 'Project JIRA', icon: Layers, count: projects.length },
  ];

  return (
    <div className="bg-white dark:bg-gray-900 min-h-full p-4 sm:p-6 space-y-6">
      <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl p-5 text-white">
        <h1 className="text-xl font-bold">My Client — {client.displayId}</h1>
        <p className="text-blue-100 text-sm">{client.name} • Contact: {client.contactFirstName} {client.contactLastName} • {normalizePhone(client.mobile) || ''}</p>
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
              <div>Address: {client.address ? `${client.address.addressLine1}, ${client.address.city}, ${client.address.state} - ${client.address.pinCode}` : '—'}</div>
              <div>Mobile: {client.mobile || '—'} • Whatsapp: {client.whatsapp || '—'} {client.whatsappSameAsMobile && '(same)'}</div>
            </div>
          </div>
          {canManage && <button onClick={()=>setEditingClient(true)} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg h-fit">Edit</button>}
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800/30 rounded-xl p-1.5 flex gap-1.5 overflow-x-auto">
        {tabItems.map(t => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={()=>setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700 hover:text-gray-900'}`}
            >
              <Icon size={14} />
              {t.label}
              {t.count !== null && <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${isActive ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>{t.count}</span>}
            </button>
          );
        })}
      </div>

      {tab==='overview' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border p-5 space-y-3">
          <h3 className="font-semibold flex items-center gap-2"><LayoutDashboard size={16} className="text-blue-600" /> Client Overview <span className="text-xs font-normal text-gray-400">— Professional summary for easy management</span></h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-xl"><div className="text-gray-400 uppercase">Seats</div><div className="font-bold text-lg">{usage ? `${usage.active}/${usage.max===-1?'∞':usage.max}` : '—'}</div></div>
            <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-xl"><div className="text-gray-400 uppercase">Plan</div><div className="font-bold capitalize">{client.plan}</div></div>
            <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-xl"><div className="text-gray-400 uppercase">City</div><div className="font-medium">{client.address?.city || '—'}</div></div>
            <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-xl"><div className="text-gray-400 uppercase">Status</div><div className="font-medium capitalize">{client.status}</div></div>
          </div>
          <p className="text-xs text-gray-500">Max Users change requires Super Admin (current: {client.maxUsers}). You can edit other details above.</p>
        </div>
      )}

      {tab==='users' && (
        <>
          <div className="flex justify-between items-center">
            <h3 className="font-semibold flex items-center gap-2"><Users size={16} className="text-blue-600" /> Users <span className="text-xs font-normal text-gray-400">{canManage ? '— Manage team, roles & seats' : '— View team (read-only)'}</span></h3>
            {canManage
              ? <button onClick={()=>setShowInviteModal(true)} disabled={!!full} className={`px-3 py-1.5 rounded-lg text-sm text-white ${full?'bg-gray-400':'bg-blue-600'}`}>+ Add User</button>
              : <span className="text-xs px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/60">Read-only — only client admins can add or manage users</span>}
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
                    {canManage && <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-gray-500 whitespace-nowrap text-right">Actions</th>}
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
                      {canManage && (
                      <td className="px-4 py-3 align-middle whitespace-nowrap">
                        <div className="flex gap-1 justify-end">
                          <button onClick={()=>openEditUser(u)} className="text-gray-700 dark:text-gray-300 text-xs border border-gray-200 dark:border-gray-600 px-2.5 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 whitespace-nowrap">Edit</button>
                          {u.status==='active' ? <button onClick={()=>setShowDeactivateConfirm(u)} className="text-red-600 text-xs border border-red-200 px-2.5 py-1 rounded-lg hover:bg-red-50 whitespace-nowrap">Deactivate</button> : <button onClick={()=>handleRestore(u._id)} className="text-green-600 text-xs border border-green-200 px-2.5 py-1 rounded-lg hover:bg-green-50 whitespace-nowrap">Restore</button>}
                          <button onClick={()=>openReset(u)} className="text-blue-600 text-xs border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-50 whitespace-nowrap">Reset Pwd</button>
                        </div>
                      </td>
                      )}
                    </tr>
                  )})}
                  {paginatedUsers.length===0 && <tr><td colSpan={canManage ? 9 : 8} className="p-6 text-center text-gray-400">No users yet</td></tr>}
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
          <h3 className="font-semibold flex items-center gap-2"><UserCircle size={16} className="text-blue-600" /> My JIRA — Per-User</h3>
          <p className="text-xs text-gray-500">Your personal Atlassian <span className="font-medium">email + API token</span> (own cred, real-time verify). Same token can be reused with different email. Paired with Project's domain/projectKey on bug create/link.</p>
          <div className="text-xs">Current: {myJira?.enabled ? `${myJira.email} • Connected` : 'Not connected'}</div>
          <form onSubmit={handleMyJiraConnect} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Atlassian Email</label>
              <input placeholder="you@company.com" value={myJiraForm.email} onChange={e=>setMyJiraForm({...myJiraForm, email:e.target.value})} className="w-full border p-2 rounded" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">API Token <span className="font-normal text-gray-400">(id.atlassian.com — same token can be used with different email)</span></label>
              <input placeholder="Paste your Atlassian API token" value={myJiraForm.apiToken} onChange={e=>setMyJiraForm({...myJiraForm, apiToken:e.target.value})} className="w-full border p-2 rounded" required />
            </div>
            <div className="flex gap-2">
              <button className="bg-blue-600 text-white px-3 py-1.5 rounded">Connect My JIRA</button>
              {myJira?.enabled && <button type="button" onClick={async()=>{await disconnectMyJira(); toast.success('My JIRA disconnected'); load();}} className="border px-3 py-1.5 rounded">Disconnect</button>}
            </div>
          </form>
        </div>
      )}

      {tab==='projectJira' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border p-4 space-y-3">
          <h3 className="font-semibold flex items-center gap-2"><Layers size={16} className="text-blue-600" /> Project JIRA — Per-Project</h3>
          <p className="text-xs text-gray-500">Every project has its own <span className="font-medium">domain + projectKey</span>. Bug creation uses <span className="font-medium">your email/token + this project's mapping</span> (verified real-time via <span className="font-mono">/rest/api/3/myself</span>).</p>
          <div className="space-y-4">
            {projects.map(p=> {
              const pid = p.id;
              const pj = projectJiras[pid];
              const form = projectJiraForms[pid] || { domain: '', projectKey: '' };
              return (
                <div key={pid} className="border rounded-xl p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm">{p.name} <span className="font-mono text-xs text-gray-500">{p.displayId || ''}</span></span>
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700">{pj?.enabled ? `${pj.domain} / ${pj.projectKey}` : 'Not mapped'}</span>
                  </div>
                  {canManage ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">JIRA Domain</label>
                        <input placeholder="xxx.atlassian.net" value={form.domain} onChange={e=>setProjectJiraForms(m=>({...m, [pid]: {...(m[pid]||{domain:'',projectKey:''}), domain:e.target.value}}))} className="border p-2 rounded text-sm w-full" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Project Key</label>
                        <input placeholder="ACME" value={form.projectKey} onChange={e=>setProjectJiraForms(m=>({...m, [pid]: {...(m[pid]||{domain:'',projectKey:''}), projectKey:e.target.value.toUpperCase()}}))} className="border p-2 rounded text-sm font-mono uppercase w-full" />
                      </div>
                      <div className="col-span-2 flex gap-2">
                        <button onClick={()=>handleProjectJiraConnect(pid)} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm whitespace-nowrap">Map</button>
                        {pj?.enabled && <button onClick={async()=>{await disconnectProjectJira(pid); toast.success('Project JIRA cleared'); load();}} className="border px-3 py-1.5 rounded text-sm">Clear</button>}
                      </div>
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

      {editingClient && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setEditingClient(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit Client — {client.displayId}</h3>
              <button onClick={()=>setEditingClient(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">&times;</button>
            </div>
            <div className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-700/50 p-3 rounded">
              Client: <span className="font-medium">{client.name}</span> ({client.displayId}) • Plan {client.plan} • Seats {usage ? `${usage.active}/${usage.max===-1?'∞':usage.max}` : ''}
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Client Name *</label>
                <input placeholder="e.g. TSInternal" value={editForm.clientName} onChange={e=>setEditForm({...editForm,clientName:e.target.value})} className="w-full border p-2 rounded" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Contact First Name *</label>
                  <input placeholder="e.g. Pankaj" value={editForm.firstName} onChange={e=>setEditForm({...editForm,firstName:e.target.value})} className="border p-2 rounded w-full" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Contact Last Name *</label>
                  <input placeholder="e.g. Kumar" value={editForm.lastName} onChange={e=>setEditForm({...editForm,lastName:e.target.value})} className="border p-2 rounded w-full" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Description <span className="font-normal text-gray-400">(optional)</span></label>
                <input placeholder="Short note about this client" value={editForm.description} onChange={e=>setEditForm({...editForm,description:e.target.value})} className="w-full border p-2 rounded" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Mobile Number <span className="font-normal text-gray-400">(10-digit India)</span></label>
                  <input placeholder="9876543210" value={editForm.mobile} onChange={e=>setEditForm({...editForm,mobile:normalizePhone(e.target.value)})} className="border p-2 rounded w-full" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Whatsapp Number</label>
                  <input placeholder="9876543210" value={editForm.whatsappSameAsMobile ? editForm.mobile : editForm.whatsapp} onChange={e=>setEditForm({...editForm,whatsapp:normalizePhone(e.target.value)})} disabled={editForm.whatsappSameAsMobile} className="border p-2 rounded w-full disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-600 dark:disabled:text-gray-300" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.whatsappSameAsMobile} onChange={e=>setEditForm({...editForm,whatsappSameAsMobile:e.target.checked})} /> Whatsapp same as Mobile</label>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Address Line 1 *</label>
                <input placeholder="Flat / House no., Building, Street" value={editForm.addressLine1} onChange={e=>setEditForm({...editForm,addressLine1:e.target.value})} className="w-full border p-2 rounded" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Address Line 2 <span className="font-normal text-gray-400">(optional)</span></label>
                <input placeholder="Area, Landmark" value={editForm.addressLine2} onChange={e=>setEditForm({...editForm,addressLine2:e.target.value})} className="w-full border p-2 rounded" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">City *</label>
                  <input placeholder="e.g. Mumbai" value={editForm.city} onChange={e=>setEditForm({...editForm,city:e.target.value})} className="border p-2 rounded w-full" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">State *</label>
                  <select value={editForm.state} onChange={e=>setEditForm({...editForm,state:e.target.value})} className="border p-2 rounded w-full"><option value="">Select State</option>{indianStates.map(s=><option key={s} value={s}>{s}</option>)}</select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Country *</label>
                  <input placeholder="India" value={editForm.country} onChange={e=>setEditForm({...editForm,country:e.target.value})} className="border p-2 rounded w-full" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">PIN Code * <span className="font-normal text-gray-400">(6-digit)</span></label>
                  <input placeholder="400001" value={editForm.pinCode} onChange={e=>setEditForm({...editForm,pinCode:e.target.value})} className="border p-2 rounded w-full" maxLength={6} />
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t border-gray-100 dark:border-gray-700">
              <button onClick={()=>setEditingClient(false)} className="border px-4 py-2 rounded">Cancel</button>
              <button onClick={handleSaveClient} className="bg-blue-600 text-white px-4 py-2 rounded">Save</button>
            </div>
          </div>
        </div>
      )}

      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setShowInviteModal(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold">Add User — {client.displayId}</h3>
            <form onSubmit={handleInvite} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Email *</label>
                <input placeholder="user@company.com" value={invite.email} onChange={e=>setInvite({...invite,email:e.target.value})} className="w-full border p-2 rounded" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">First Name *</label>
                  <input placeholder="e.g. Pankaj" value={invite.firstName} onChange={e=>setInvite({...invite,firstName:e.target.value})} className="border p-2 rounded w-full" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Last Name *</label>
                  <input placeholder="e.g. Kumar" value={invite.lastName} onChange={e=>setInvite({...invite,lastName:e.target.value})} className="border p-2 rounded w-full" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Mobile Number <span className="font-normal text-gray-400">(10-digit India)</span></label>
                  <input placeholder="9876543210" value={invite.mobile} onChange={e=>setInvite({...invite,mobile:normalizePhone(e.target.value)})} className="border p-2 rounded w-full" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Whatsapp Number</label>
                  <input placeholder="9876543210" value={invite.whatsappSameAsMobile ? invite.mobile : invite.whatsapp} onChange={e=>setInvite({...invite,whatsapp:normalizePhone(e.target.value)})} disabled={invite.whatsappSameAsMobile} className="border p-2 rounded w-full disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-600 dark:disabled:text-gray-300" />
                </div>
              </div>
              <label className="flex gap-2 text-sm"><input type="checkbox" checked={invite.whatsappSameAsMobile} onChange={e=>setInvite({...invite,whatsappSameAsMobile:e.target.checked})} /> Whatsapp same as Mobile</label>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Role *</label>
                <select value={invite.role} onChange={e=>setInvite({...invite,role:e.target.value as ClientMemberRole})} className="w-full border p-2 rounded">
                  <option value="client_admin">Client Admin</option><option value="member">Member</option><option value="viewer">Viewer</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Temp Password <span className="font-normal text-gray-400">(auto-generated if blank)</span></label>
                <input placeholder="Leave blank to auto-generate" value={invite.tempPassword} onChange={e=>setInvite({...invite,tempPassword:e.target.value})} className="w-full border p-2 rounded" />
              </div>
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
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">New Temp Password</label>
              <div className="relative">
                <input type={showResetEye ? "text" : "password"} value={resetPwd} onChange={e=>setResetPwd(e.target.value)} placeholder="Enter new temporary password" className="w-full border p-2 rounded pr-10" />
                <button type="button" onClick={()=>setShowResetEye(!showResetEye)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">{showResetEye ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
              </div>
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
            <p className="text-sm text-gray-500">This frees 1 seat. The account is only deactivated — their tickets, test cases and project assignments are kept, and they will show as &quot;inactive&quot; in project member pickers. You can restore them anytime.</p>
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
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">First Name *</label>
                <input placeholder="e.g. Pankaj" value={editUserForm.firstName} onChange={e=>setEditUserForm({...editUserForm,firstName:e.target.value})} className="border p-2 rounded w-full" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Last Name *</label>
                <input placeholder="e.g. Kumar" value={editUserForm.lastName} onChange={e=>setEditUserForm({...editUserForm,lastName:e.target.value})} className="border p-2 rounded w-full" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Mobile Number <span className="font-normal text-gray-400">(10-digit India)</span></label>
                <input placeholder="9876543210" value={editUserForm.mobile} onChange={e=>setEditUserForm({...editUserForm,mobile:normalizePhone(e.target.value)})} className="border p-2 rounded w-full" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Whatsapp Number</label>
                <input placeholder="9876543210" value={editUserForm.whatsappSameAsMobile ? editUserForm.mobile : editUserForm.whatsapp} onChange={e=>setEditUserForm({...editUserForm,whatsapp:normalizePhone(e.target.value)})} disabled={editUserForm.whatsappSameAsMobile} className="border p-2 rounded w-full disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-600 dark:disabled:text-gray-300" />
              </div>
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
