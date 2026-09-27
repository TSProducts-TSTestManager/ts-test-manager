import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { getClientUsage, getClientUsers, createClientAdmin, resetClientAdminPassword, deactivateUser, restoreUser, updateClient, getClients, updateClientUser, getClientsError } from '../../services/clientApi';
import { useAuthStore } from '../../store/authStore';
import { SeatUsage, ClientUser, Client, ClientMemberRole, CreateClientAdminInput } from '../../types/client';
import { Eye, EyeOff, ShieldCheck, User as UserIcon, Eye as EyeIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { isValidPhone, normalizePhone } from '../../utils/phone';
import ClientJiraSettings from '../../components/testManager/jira/ClientJiraSettings';

const ClientDetailPage: React.FC = () => {
  const { displayId } = useParams<{ displayId: string }>();
  const [usage, setUsage] = useState<SeatUsage | null>(null);
  const [users, setUsers] = useState<ClientUser[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [tab, setTab] = useState<'users'|'jira'|'settings'>('users');
  const [invite, setInvite] = useState({ email: '', firstName: '', lastName: '', mobile: '', whatsapp: '', whatsappSameAsMobile: false, tempPassword: '', role: 'client_admin' as ClientMemberRole });
  const [editMax, setEditMax] = useState<number | ''>('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTarget, setResetTarget] = useState<ClientUser | null>(null);
  const [resetPwd, setResetPwd] = useState('');
  const [showResetPwdEye, setShowResetPwdEye] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState<ClientUser | null>(null);
  const [editingClient, setEditingClient] = useState(false);
  const [editForm, setEditForm] = useState({ clientName: '', firstName: '', lastName: '', description: '', plan: 'starter' as Client['plan'], mobile: '', whatsapp: '', whatsappSameAsMobile: false, addressLine1: '', addressLine2: '', city: '', state: '', country: 'India', pinCode: '' });
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [userPage, setUserPage] = useState(1);
  const pageSize = 10;
  const paginatedUsers = users.slice((userPage - 1) * pageSize, userPage * pageSize);
  const totalPages = Math.ceil(users.length / pageSize) || 1;
  const getRoleBadge = (role: string) => {
    if (role === 'client_admin') return { label: 'Admin', cls: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800', Icon: ShieldCheck };
    if (role === 'member') return { label: 'Member', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800', Icon: UserIcon };
    return { label: 'Viewer', cls: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800', Icon: EyeIcon };
  };
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';
  const isClientAdmin = user?.role === 'client_admin';
  const indianStates = ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Delhi","Jammu and Kashmir","Ladakh","Puducherry","Chandigarh","Andaman and Nicobar Islands","Dadra and Nagar Haveli and Daman and Diu","Lakshadweep"];
  const isValidEmail = (v: string) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v);
  const isValidPin = (v: string) => /^[1-9][0-9]{5}$/.test(v.trim());
  const planLimits: Record<string, number> = { free: 3, starter: 10, pro: 25, enterprise: Infinity };
  const getAllowedMax = (plan: string) => {
    const lim = planLimits[plan] ?? 10;
    return lim === Infinity ? Infinity : Math.ceil(lim * 1.5);
  };
  const [editUserTarget, setEditUserTarget] = useState<ClientUser | null>(null);
  const [editUserForm, setEditUserForm] = useState({ firstName: '', lastName: '', mobile: '', whatsapp: '', whatsappSameAsMobile: false });
  const navigate = useNavigate();

  const load = useCallback(async () => {
    if (!displayId) return;
    try { setUsage(await getClientUsage(displayId)); } catch { /* seat usage is supplementary; leave it blank */ }
    try { setUsers(await getClientUsers(displayId, 'all')); } catch (e: unknown){ toast.error(getClientsError(e)); }
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
        setEditMax(c.maxUsers);
      }
    } catch { /* keep whatever was already loaded rather than blanking the form */ }
  }, [displayId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setUserPage(1); }, [users.length]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite.email.trim() || !isValidEmail(invite.email.trim())) { toast.error('Valid Email required'); return; }
    if (!invite.firstName.trim() || !invite.lastName.trim()) { toast.error('First Name & Last Name required'); return; }
    if (invite.firstName.trim().length < 2 || invite.lastName.trim().length < 2) { toast.error('First/Last Name min 2 chars'); return; }
    if (invite.mobile && !isValidPhone(invite.mobile)) { toast.error('Mobile must be 10 digits (India, 6-9 start)'); return; }
    const wp = invite.whatsappSameAsMobile ? invite.mobile : invite.whatsapp;
    if (wp && !isValidPhone(wp)) { toast.error('Whatsapp must be 10 digits (India)'); return; }
    try {
      const payload: CreateClientAdminInput = {
        email: invite.email,
        firstName: invite.firstName.trim(),
        lastName: invite.lastName.trim(),
        name: `${invite.firstName} ${invite.lastName}`.trim(),
        mobile: normalizePhone(invite.mobile) || undefined,
        whatsapp: invite.whatsappSameAsMobile ? normalizePhone(invite.mobile) || undefined : (normalizePhone(invite.whatsapp) || undefined),
        whatsappSameAsMobile: invite.whatsappSameAsMobile,
        tempPassword: invite.tempPassword || undefined,
        role: invite.role,
      };
      await createClientAdmin(displayId!, payload);
      toast.success('User invited as ' + invite.role);
      setInvite({ email:'', firstName:'', lastName:'', mobile:'', whatsapp:'', whatsappSameAsMobile:false, tempPassword:'', role: 'client_admin' });
      setShowInviteModal(false);
      load();
    } catch(e: unknown){ toast.error(getClientsError(e)); }
  };
  const handleDeactivate = async (uid: string) => {
    try { await deactivateUser(displayId!, uid); toast.success('Deactivated'); load(); } catch(e: unknown){ toast.error(getClientsError(e)); }
  };
  const handleRestore = async (uid: string) => {
    try { await restoreUser(displayId!, uid); toast.success('Restored'); load(); } catch(e: unknown){ toast.error(getClientsError(e)); }
  };
  const openResetModal = (u: ClientUser) => {
    setResetTarget(u);
    setResetPwd('');
    setShowResetPwdEye(false);
    setShowResetModal(true);
  };
  const handleResetConfirm = async () => {
    if (!resetTarget || !resetPwd) { toast.error('Password required'); return; }
    try { await resetClientAdminPassword(displayId!, resetTarget._id, resetPwd); toast.success(`Password reset for ${resetTarget.email}`); setShowResetModal(false); setResetTarget(null); } catch(e: unknown){ toast.error(getClientsError(e)); }
  };
  const handleSaveMax = async () => {
    if (editMax === '') return;
    const num = Number(editMax);
    if (num === -1 && client?.plan !== 'enterprise') { toast.error('Unlimited (-1) allowed only for Enterprise plan'); return; }
    const allowed = getAllowedMax(client?.plan || 'starter');
    if (num !== -1 && allowed !== Infinity && num > allowed) { toast.error(`Max Users ${num} exceeds ${client?.plan} limit (${planLimits[client?.plan || 'starter']}) +50% (max ${allowed}). Upgrade plan.`); return; }
    try { await updateClient(displayId!, { maxUsers: num }); toast.success('Max users updated'); load(); } catch(e: unknown){ toast.error(getClientsError(e)); }
  };
  const handleSaveClientEdit = async () => {
    if (!editForm.clientName.trim() || !editForm.firstName.trim() || !editForm.lastName.trim()) { toast.error('Client Name, First & Last required'); return; }
    if (editForm.firstName.trim().length < 2 || editForm.lastName.trim().length < 2) { toast.error('First/Last min 2 chars'); return; }
    if (editForm.mobile && !isValidPhone(editForm.mobile)) { toast.error('Mobile must be 10 digits (India, 6-9 start)'); return; }
    const ewp = editForm.whatsappSameAsMobile ? editForm.mobile : editForm.whatsapp;
    if (ewp && !isValidPhone(ewp)) { toast.error('Whatsapp must be 10 digits (India)'); return; }
    if (!editForm.addressLine1.trim() || !editForm.city.trim() || !editForm.state.trim() || !editForm.country.trim() || !editForm.pinCode.trim()) { toast.error('Address Line 1, City, State, Country, Pin required'); return; }
    if (!isValidPin(editForm.pinCode)) { toast.error('Pin Code must be 6 digits (India)'); return; }
    // plan + 50% guard for edit inline — if plan changed, maxUsers stays same but must still fit new plan's allowed max
    const allowedForEdit = getAllowedMax(editForm.plan);
    const currentMax = client?.maxUsers ?? 10;
    // if editing client and current maxUsers would exceed new plan's allowed max, block
    if (currentMax !== -1 && allowedForEdit !== Infinity && currentMax > allowedForEdit) {
      toast.error(`Current Max Users ${currentMax} exceeds ${editForm.plan} limit +50% (max ${allowedForEdit}). Upgrade plan or reduce seats.`);
      return;
    }
    try {
      await updateClient(displayId!, {
        name: editForm.clientName.trim(),
        description: editForm.description,
        plan: editForm.plan,
        contactFirstName: editForm.firstName.trim(),
        contactLastName: editForm.lastName.trim(),
        mobile: normalizePhone(editForm.mobile) || undefined,
        whatsapp: editForm.whatsappSameAsMobile ? normalizePhone(editForm.mobile) || undefined : (normalizePhone(editForm.whatsapp) || undefined),
        whatsappSameAsMobile: editForm.whatsappSameAsMobile,
        address: {
          addressLine1: editForm.addressLine1.trim(),
          addressLine2: editForm.addressLine2?.trim(),
          city: editForm.city.trim(),
          state: editForm.state.trim(),
          country: editForm.country.trim() || 'India',
          pinCode: editForm.pinCode.trim(),
        },
      });
      toast.success('Client updated');
      setEditingClient(false);
      load();
    } catch(e: unknown){ toast.error(getClientsError(e)); }
  };
  const openEditUser = (u: ClientUser) => {
    setEditUserTarget(u);
    setEditUserForm({
      firstName: u.firstName || u.name.split(' ')[0] || '',
      lastName: u.lastName || u.name.split(' ').slice(1).join(' ') || '',
      mobile: normalizePhone(u.mobile || ''),
      whatsapp: normalizePhone(u.whatsapp || ''),
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
        mobile: normalizePhone(editUserForm.mobile) || undefined,
        whatsapp: editUserForm.whatsappSameAsMobile ? normalizePhone(editUserForm.mobile) || undefined : (normalizePhone(editUserForm.whatsapp) || undefined),
        whatsappSameAsMobile: editUserForm.whatsappSameAsMobile,
      });
      toast.success('User updated');
      setShowEditUserModal(false);
      setEditUserTarget(null);
      load();
    } catch(e: unknown){ toast.error(getClientsError(e)); }
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
            {client?.address && (
              <div className="text-xs pt-2">
                <div className="text-gray-400 uppercase tracking-wider">Address</div>
                <div className="font-medium">{client.address.addressLine1}{client.address.addressLine2 ? `, ${client.address.addressLine2}` : ''}, {client.address.city}, {client.address.state}, {client.address.country} - {client.address.pinCode}</div>
              </div>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={()=>setEditingClient(true)} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg">Edit Client</button>
            <button onClick={()=>navigate('/admin/clients')} className="text-sm border px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Back</button>
          </div>
        </div>
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
                            <button onClick={()=>openEditUser(u)} className="text-gray-700 dark:text-gray-300 text-xs border border-gray-200 dark:border-gray-600 px-2.5 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 whitespace-nowrap">Edit</button>
                            {u.status==='active' ? <button onClick={()=>setShowDeactivateConfirm(u)} className="text-red-600 text-xs border border-red-200 px-2.5 py-1 rounded-lg hover:bg-red-50 whitespace-nowrap">Deactivate</button> : <button onClick={()=>handleRestore(u._id)} className="text-green-600 text-xs border border-green-200 px-2.5 py-1 rounded-lg hover:bg-green-50 whitespace-nowrap">Restore</button>}
                            <button onClick={()=>openResetModal(u)} className="text-blue-600 text-xs border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-50 whitespace-nowrap">Reset Pwd</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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

      {tab==='jira' && (
        isClientAdmin ? (
          <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
            <ClientJiraSettings displayId={displayId} canEdit onChanged={load} />
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
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Max Users (seats) <span className="font-normal text-gray-400">(-1 = unlimited)</span></label>
                <div className="flex gap-2">
                  <input type="number" value={editMax} placeholder={String(usage?.max ?? '')} onChange={e=>setEditMax(e.target.value===''?'':parseInt(e.target.value))} className="border p-2 rounded" />
                  <button onClick={handleSaveMax} className="bg-blue-600 text-white px-4 py-2 rounded">Save</button>
                </div>
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

      {editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setEditingClient(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit Client — {displayId}</h3>
              <button onClick={()=>setEditingClient(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">&times;</button>
            </div>
            <div className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-700/50 p-3 rounded">
              Client: <span className="font-medium">{client?.name}</span> ({displayId}) • Plan {client?.plan} • Seats {usage ? `${usage.active}/${usage.max===-1?'∞':usage.max}` : ''}
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Client Name *</label>
                <input placeholder="e.g. TSInternal" value={editForm.clientName} onChange={e=>setEditForm({...editForm,clientName:e.target.value})} className="w-full border p-2 rounded" />
              </div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact Person</div>
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
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Mobile Number <span className="font-normal text-gray-400">(10-digit India, optional)</span></label>
                  <input placeholder="9876543210" value={editForm.mobile} onChange={e=>setEditForm({...editForm,mobile:normalizePhone(e.target.value)})} className="border p-2 rounded w-full" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Whatsapp Number <span className="font-normal text-gray-400">(optional)</span></label>
                  <input placeholder="9876543210" value={editForm.whatsappSameAsMobile ? editForm.mobile : editForm.whatsapp} onChange={e=>setEditForm({...editForm,whatsapp:normalizePhone(e.target.value)})} disabled={editForm.whatsappSameAsMobile} className="border p-2 rounded w-full disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-600 dark:disabled:text-gray-300" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.whatsappSameAsMobile} onChange={e=>setEditForm({...editForm,whatsappSameAsMobile:e.target.checked})} /> Whatsapp same as Mobile</label>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Address *</div>
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
                  <select value={editForm.state} onChange={e=>setEditForm({...editForm,state:e.target.value})} className="border p-2 rounded w-full">
                    <option value="">Select State</option>{indianStates.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
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
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan Details *</div>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Plan</label>
                  <select value={editForm.plan} onChange={e=>setEditForm({...editForm,plan:e.target.value as Client['plan']})} className="w-full border p-2 rounded"><option value="free">Free [3 Users]</option><option value="starter">Starter [10 Users]</option><option value="pro">Pro [25 Users]</option><option value="enterprise">Enterprise [Unlimited]</option></select>
                </div>
              </div>
              <p className="text-xs text-gray-500">Plan {editForm.plan} limit {planLimits[editForm.plan] === Infinity ? 'Unlimited' : `${planLimits[editForm.plan]} Users`} → max {getAllowedMax(editForm.plan) === Infinity ? 'Unlimited' : `${getAllowedMax(editForm.plan)} Users`} (+50%). Exceed requires plan upgrade.</p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <button onClick={()=>setEditingClient(false)} className="border px-4 py-2 rounded">Cancel</button>
              <button onClick={handleSaveClientEdit} className="bg-blue-600 text-white px-4 py-2 rounded">Save</button>
            </div>
          </div>
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
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">New Temp Password <span className="font-normal text-gray-400">(min 6 chars)</span></label>
              <div className="relative">
                <input type={showResetPwdEye ? "text" : "password"} placeholder="Enter new temporary password" value={resetPwd} onChange={e=>setResetPwd(e.target.value)} className="w-full border p-2 rounded pr-10" autoFocus />
                <button type="button" onClick={() => setShowResetPwdEye(!showResetPwdEye)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
                  {showResetPwdEye ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
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
              <button onClick={async()=>{ try{ await handleDeactivate(showDeactivateConfirm._id); setShowDeactivateConfirm(null);}catch{ /* handleDeactivate reports the error; keep the dialog open */ }}} className="bg-red-600 text-white px-4 py-2 rounded">Deactivate</button>
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
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Mobile Number <span className="font-normal text-gray-400">(10-digit India, optional)</span></label>
                  <input placeholder="9876543210" value={invite.mobile} onChange={e=>setInvite({...invite,mobile:normalizePhone(e.target.value)})} className="border p-2 rounded w-full" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Whatsapp Number <span className="font-normal text-gray-400">(optional)</span></label>
                  <input placeholder="9876543210" value={invite.whatsappSameAsMobile ? invite.mobile : invite.whatsapp} onChange={e=>setInvite({...invite,whatsapp:normalizePhone(e.target.value)})} disabled={invite.whatsappSameAsMobile} className="border p-2 rounded w-full disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-600 dark:disabled:text-gray-300" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={invite.whatsappSameAsMobile} onChange={e=>setInvite({...invite,whatsappSameAsMobile:e.target.checked})} /> Whatsapp same as Mobile</label>
              <div>
                <label className="text-xs font-medium text-gray-600">Role *</label>
                <select value={invite.role} onChange={e=>setInvite({...invite, role: e.target.value as ClientMemberRole})} className="w-full border p-2 rounded">
                  <option value="client_admin">Client Admin</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Temp Password <span className="font-normal text-gray-400">(auto-generated if blank)</span></label>
                <input placeholder="Leave blank to auto-generate" value={invite.tempPassword} onChange={e=>setInvite({...invite,tempPassword:e.target.value})} className="w-full border p-2 rounded" />
              </div>
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
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Mobile Number <span className="font-normal text-gray-400">(10-digit India, optional)</span></label>
                <input placeholder="9876543210" value={editUserForm.mobile} onChange={e=>setEditUserForm({...editUserForm,mobile:normalizePhone(e.target.value)})} className="border p-2 rounded w-full" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Whatsapp Number <span className="font-normal text-gray-400">(optional)</span></label>
                <input placeholder="9876543210" value={editUserForm.whatsappSameAsMobile ? editUserForm.mobile : editUserForm.whatsapp} onChange={e=>setEditUserForm({...editUserForm,whatsapp:normalizePhone(e.target.value)})} disabled={editUserForm.whatsappSameAsMobile} className="border p-2 rounded w-full disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-600 dark:disabled:text-gray-300" />
              </div>
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
