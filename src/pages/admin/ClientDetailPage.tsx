import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { getClientUsage, getClientUsers, createClientAdmin, resetClientAdminPassword, deactivateUser, restoreUser, updateClient, getClients } from '../../services/clientApi';
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
  const [invite, setInvite] = useState({ email: '', firstName: '', lastName: '', mobile: '', whatsapp: '', whatsappSameAsMobile: false, tempPassword: '' });
  const [jiraForm, setJiraForm] = useState({ domain: '', email: '', apiToken: '', projectKey: '' });
  const [editMax, setEditMax] = useState<number | ''>('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTarget, setResetTarget] = useState<ClientUser | null>(null);
  const [resetPwd, setResetPwd] = useState('');
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState<ClientUser | null>(null);
  const [editingClient, setEditingClient] = useState(false);
  const [editForm, setEditForm] = useState({ clientName: '', firstName: '', lastName: '', description: '', plan: 'starter', mobile: '', whatsapp: '', whatsappSameAsMobile: false });
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
        });
        setEditMax(c.maxUsers);
      }
    } catch {}
  };
  useEffect(() => { load(); }, [displayId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite.firstName || !invite.lastName) { toast.error('First Name & Last Name required'); return; }
    try {
      const payload: any = {
        email: invite.email,
        firstName: invite.firstName,
        lastName: invite.lastName,
        name: `${invite.firstName} ${invite.lastName}`.trim(),
        mobile: invite.mobile || undefined,
        whatsapp: invite.whatsappSameAsMobile ? invite.mobile : (invite.whatsapp || undefined),
        whatsappSameAsMobile: invite.whatsappSameAsMobile,
        tempPassword: invite.tempPassword || undefined,
      };
      await createClientAdmin(displayId!, payload);
      toast.success('Client admin created');
      setInvite({ email:'', firstName:'', lastName:'', mobile:'', whatsapp:'', whatsappSameAsMobile:false, tempPassword:'' });
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
              <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">{client?.plan || '—'}</span>
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
              <input placeholder="Whatsapp (optional)" value={editForm.whatsappSameAsMobile ? editForm.mobile : editForm.whatsapp} onChange={e=>setEditForm({...editForm,whatsapp:e.target.value})} disabled={editForm.whatsappSameAsMobile} className="border p-2 rounded disabled:bg-gray-100" />
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.whatsappSameAsMobile} onChange={e=>setEditForm({...editForm,whatsappSameAsMobile:e.target.checked})} /> Whatsapp same as Mobile</label>
            <div className="flex gap-2">
              <select value={editForm.plan} onChange={e=>setEditForm({...editForm,plan:e.target.value})} className="border p-2 rounded"><option value="free">free</option><option value="starter">starter</option><option value="pro">pro</option><option value="enterprise">enterprise</option></select>
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
        <button onClick={()=>setTab('jira')} className={`pb-2 px-1 text-sm font-medium ${tab==='jira'?'border-b-2 border-blue-600 text-blue-600': 'text-gray-500'}`}>JIRA</button>
        <button onClick={()=>setTab('settings')} className={`pb-2 px-1 text-sm font-medium ${tab==='settings'?'border-b-2 border-blue-600 text-blue-600': 'text-gray-500'}`}>Settings</button>
      </div>

      {tab==='users' && (
        <>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-sm">Seats: {usage ? `${usage.active}/${usage.max===-1?'∞':usage.max} (${usage.pct}%) remaining ${usage.remaining===-1?'∞':usage.remaining}` : '—'}</h3>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded mt-2"><div className={`h-2 rounded ${full?'bg-red-500':'bg-green-500'}`} style={{width:`${Math.min(100, usage?.pct||0)}%`}} /></div>
            {full && <p className="text-sm text-red-600 mt-2">Seat limit reached. Deactivate a user to add new one.</p>}
          </div>

          <form onSubmit={handleInvite} className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-3">
            <h3 className="font-semibold">Invite Client Admin</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input placeholder="Email *" value={invite.email} onChange={e=>setInvite({...invite,email:e.target.value})} className="border p-2 rounded" required />
              <input placeholder="First Name *" value={invite.firstName} onChange={e=>setInvite({...invite,firstName:e.target.value})} className="border p-2 rounded" required />
              <input placeholder="Last Name *" value={invite.lastName} onChange={e=>setInvite({...invite,lastName:e.target.value})} className="border p-2 rounded" required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input placeholder="Mobile (optional)" value={invite.mobile} onChange={e=>setInvite({...invite,mobile:e.target.value})} className="border p-2 rounded" />
              <input placeholder="Whatsapp (optional)" value={invite.whatsappSameAsMobile ? invite.mobile : invite.whatsapp} onChange={e=>setInvite({...invite,whatsapp:e.target.value})} disabled={invite.whatsappSameAsMobile} className="border p-2 rounded disabled:bg-gray-100" />
              <input placeholder="Temp Password (optional)" value={invite.tempPassword} onChange={e=>setInvite({...invite,tempPassword:e.target.value})} className="border p-2 rounded" />
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={invite.whatsappSameAsMobile} onChange={e=>setInvite({...invite,whatsappSameAsMobile:e.target.checked})} /> Whatsapp same as Mobile</label>
            <div className="flex justify-end">
              <button disabled={!!full} title={full?'Deactivate a user first':''} className={`px-4 py-2 rounded text-white ${full?'bg-gray-400':'bg-blue-600'}`}>Invite</button>
            </div>
          </form>

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
      )}

      {tab==='settings' && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-3">
          <h3 className="font-semibold">Seat Limit</h3>
          <div className="flex gap-2">
            <input type="number" value={editMax} placeholder={String(usage?.max ?? '')} onChange={e=>setEditMax(e.target.value===''?'':parseInt(e.target.value))} className="border p-2 rounded" />
            <button onClick={handleSaveMax} className="bg-blue-600 text-white px-4 py-2 rounded">Save</button>
          </div>
          <p className="text-xs text-gray-500">-1 = unlimited. Reducing below active count requires deactivating users first.</p>
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
    </div>
  );
};
export default ClientDetailPage;
