import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { getClientUsage, getClientUsers, createClientAdmin, resetClientAdminPassword, deactivateUser, restoreUser, updateClient } from '../../services/clientApi';
import { connectJira, disconnectJira, getJiraConfig } from '../../services/jiraApi';
import { SeatUsage, ClientUser } from '../../types/client';
import toast from 'react-hot-toast';

const ClientDetailPage: React.FC = () => {
  const { displayId } = useParams<{ displayId: string }>();
  const [usage, setUsage] = useState<SeatUsage | null>(null);
  const [users, setUsers] = useState<ClientUser[]>([]);
  const [tab, setTab] = useState<'users'|'jira'|'settings'>('users');
  const [jira, setJira] = useState<any>(null);
  const [invite, setInvite] = useState({ email: '', name: '', tempPassword: '' });
  const [jiraForm, setJiraForm] = useState({ domain: '', email: '', apiToken: '', projectKey: '' });
  const [editMax, setEditMax] = useState<number | ''>('');

  const load = async () => {
    if (!displayId) return;
    try { setUsage(await getClientUsage(displayId)); } catch {}
    try { setUsers(await getClientUsers(displayId, 'all')); } catch (e:any){ toast.error(e.message); }
    try { setJira(await getJiraConfig(displayId)); } catch {}
  };
  useEffect(() => { load(); }, [displayId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await createClientAdmin(displayId!, invite); toast.success('Client admin created'); setInvite({ email:'', name:'', tempPassword:'' }); load(); } catch(e:any){ toast.error(e.message); }
  };
  const handleDeactivate = async (uid: string) => {
    try { await deactivateUser(displayId!, uid); toast.success('Deactivated'); load(); } catch(e:any){ toast.error(e.message); }
  };
  const handleRestore = async (uid: string) => {
    try { await restoreUser(displayId!, uid); toast.success('Restored'); load(); } catch(e:any){ toast.error(e.message); }
  };
  const handleReset = async (uid: string) => {
    const pwd = prompt('New temp password:');
    if (!pwd) return;
    try { await resetClientAdminPassword(displayId!, uid, pwd); toast.success('Password reset'); } catch(e:any){ toast.error(e.message); }
  };
  const handleSaveMax = async () => {
    if (editMax === '') return;
    try { await updateClient(displayId!, { maxUsers: Number(editMax) } as any); toast.success('Max users updated'); load(); } catch(e:any){ toast.error(e.message); }
  };
  const handleJiraConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await connectJira(displayId!, jiraForm); toast.success('JIRA connected'); load(); } catch(e:any){ toast.error(e.message); }
  };

  if (!displayId) return <div>Missing client</div>;
  const active = users.filter(u=>u.status==='active').length;
  const full = usage ? (usage.max !== -1 && usage.active >= usage.max) : false;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Client {displayId} — Detail</h1>
      <div className="flex gap-4 border-b">
        <button onClick={()=>setTab('users')} className={`pb-2 ${tab==='users'?'border-b-2 border-blue-600':''}`}>Users ({active}/{usage?.max===-1?'∞':usage?.max})</button>
        <button onClick={()=>setTab('jira')} className={`pb-2 ${tab==='jira'?'border-b-2 border-blue-600':''}`}>JIRA</button>
        <button onClick={()=>setTab('settings')} className={`pb-2 ${tab==='settings'?'border-b-2 border-blue-600':''}`}>Settings</button>
      </div>

      {tab==='users' && (
        <>
          <div className="bg-white dark:bg-gray-800 p-4 rounded border">
            <h3 className="font-semibold">Seats: {usage ? `${usage.active}/${usage.max===-1?'∞':usage.max} (${usage.pct}%) remaining ${usage.remaining===-1?'∞':usage.remaining}` : '—'}</h3>
            <div className="w-full h-3 bg-gray-200 rounded mt-2"><div className={`h-3 rounded ${full?'bg-red-500':'bg-green-500'}`} style={{width:`${Math.min(100, usage?.pct||0)}%`}} /></div>
            {full && <p className="text-sm text-red-600 mt-2">Seat limit reached. Deactivate a user to add new one.</p>}
          </div>

          <form onSubmit={handleInvite} className="bg-white dark:bg-gray-800 p-4 rounded border space-y-2">
            <h3 className="font-semibold">Invite Client Admin</h3>
            <div className="flex gap-2 flex-wrap">
              <input placeholder="Email" value={invite.email} onChange={e=>setInvite({...invite,email:e.target.value})} className="border p-2 rounded flex-1" required />
              <input placeholder="Name" value={invite.name} onChange={e=>setInvite({...invite,name:e.target.value})} className="border p-2 rounded flex-1" required />
              <input placeholder="Temp Password (optional)" value={invite.tempPassword} onChange={e=>setInvite({...invite,tempPassword:e.target.value})} className="border p-2 rounded flex-1" />
              <button disabled={!!full} title={full?'Deactivate a user first':''} className={`px-4 py-2 rounded text-white ${full?'bg-gray-400':'bg-blue-600'}`}>Invite</button>
            </div>
          </form>

          <div className="bg-white dark:bg-gray-800 rounded border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="p-2 text-left">Email</th><th>Name</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {users.map(u=>(
                  <tr key={u._id} className="border-t">
                    <td className="p-2">{u.email}</td><td>{u.name}</td><td>{u.role}</td>
                    <td><span className={`px-2 py-1 rounded text-xs ${u.status==='active'?'bg-green-100 text-green-800':'bg-gray-200 text-gray-600'}`}>{u.status}</span></td>
                    <td className="p-2 flex gap-2">
                      {u.status==='active' ? <button onClick={()=>handleDeactivate(u._id)} className="text-red-600 text-xs border px-2 py-1 rounded">Deactivate</button> : <button onClick={()=>handleRestore(u._id)} className="text-green-600 text-xs border px-2 py-1 rounded">Restore</button>}
                      <button onClick={()=>handleReset(u._id)} className="text-blue-600 text-xs border px-2 py-1 rounded">Reset Pwd</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab==='jira' && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded border space-y-4">
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
        <div className="bg-white dark:bg-gray-800 p-4 rounded border space-y-3">
          <h3 className="font-semibold">Seat Limit</h3>
          <div className="flex gap-2">
            <input type="number" value={editMax} placeholder={String(usage?.max ?? '')} onChange={e=>setEditMax(e.target.value===''?'':parseInt(e.target.value))} className="border p-2 rounded" />
            <button onClick={handleSaveMax} className="bg-blue-600 text-white px-4 py-2 rounded">Save</button>
          </div>
          <p className="text-xs text-gray-500">-1 = unlimited. Reducing below active count requires deactivating users first.</p>
        </div>
      )}
    </div>
  );
};
export default ClientDetailPage;
