import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import { useAuthStore } from "../../store/authStore";
import { Building2, Users, TrendingUp, ShieldCheck, PieChart, Activity } from "lucide-react";
import { getClients } from "../../services/clientApi";
import { getClientUsage } from "../../services/clientApi";
import type { Client, SeatUsage } from "../../types/client";

const ClientDashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [usageMap, setUsageMap] = useState<Record<string, SeatUsage>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getClients();
        setClients(data);
        const map: Record<string, SeatUsage> = {};
        for (const c of data) {
          try { const u = await getClientUsage(c.displayId); map[c.displayId] = u; } catch { /* seat usage is supplementary; leave it blank */ }
        }
        setUsageMap(map);
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const totalClients = clients.length;
  const activeClients = clients.filter(c => c.status === 'active').length;
  const suspended = totalClients - activeClients;
  const totalSeats = Object.values(usageMap).reduce((acc, u) => acc + (u.max === -1 ? 0 : u.max), 0);
  const totalActiveUsers = Object.values(usageMap).reduce((acc, u) => acc + u.active, 0);
  const totalCapacity = clients.reduce((acc, c) => acc + (c.maxUsers === -1 ? 50 : c.maxUsers), 0);
  const utilization = totalActiveUsers && totalSeats ? Math.round((totalActiveUsers / (totalSeats || 1)) * 100) : 0;

  const planCounts = clients.reduce((acc: Record<string, number>, c) => {
    acc[c.plan] = (acc[c.plan] || 0) + 1;
    return acc;
  }, {});

  const stats = [
    { name: 'Total Clients', value: totalClients, sub: `${activeClients} Active • ${suspended} Suspended`, icon: Building2, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300' },
    { name: 'Active Seats', value: `${totalActiveUsers} / ${totalSeats || totalCapacity}`, sub: `${utilization}% Utilized`, icon: Users, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300' },
    { name: 'Total Capacity', value: totalCapacity === 0 ? '—' : `${totalCapacity} Users`, sub: 'Enterprise unlimited counted as 50', icon: TrendingUp, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-300' },
    { name: 'Health', value: suspended === 0 ? 'All Healthy' : `${suspended} Attention`, sub: activeClients ? 'Operational' : 'No active clients', icon: ShieldCheck, color: 'text-violet-600 bg-violet-50 dark:bg-violet-900/30 dark:text-violet-300' },
  ];

  if (loading) {
    return <div className="bg-white dark:bg-gray-900 min-h-full p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">{Array(4).fill(0).map((_, i) => <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />)}</div>;
  }

  return (
    <div className="bg-white dark:bg-gray-900 min-h-full p-4 sm:p-6 space-y-6">
      <div className="p-4 sm:p-6 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl text-white shadow-lg">
        <h1 className="text-2xl font-bold tracking-tight">Client Management Dashboard</h1>
        <p className="text-blue-100 mt-1">Welcome back, {user?.name || 'Super Admin'} — overseeing {totalClients} clients across India.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((s, i) => (
          <motion.div key={s.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{s.name}</p>
                <p className="text-2xl font-semibold mt-1 text-gray-900 dark:text-gray-100">{s.value}</p>
                <p className="text-xs text-gray-400 mt-1">{s.sub}</p>
              </div>
              <div className={`p-3 rounded-xl ${s.color}`}><s.icon size={18} /></div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Activity size={16} /> Plan Distribution</h3>
            <span className="text-xs text-gray-400">{totalClients} clients</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {['free','starter','pro','enterprise'].map(plan => {
              const count = planCounts[plan] || 0;
              const pct = totalClients ? Math.round((count / totalClients) * 100) : 0;
              return (
                <div key={plan} className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 text-center">
                  <p className="text-xs uppercase tracking-wider text-gray-500 capitalize">{plan}</p>
                  <p className="text-xl font-bold mt-1">{count}</p>
                  <p className="text-xs text-gray-400">{pct}%</p>
                  <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-2"><div className="h-1.5 bg-blue-600 rounded-full" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
          <h3 className="font-semibold flex items-center gap-2"><PieChart size={16} /> Recent Clients</h3>
          <div className="divide-y divide-gray-100 dark:divide-gray-700 mt-3">
            {clients.slice(0, 5).map(c => (
              <div key={c._id} onClick={() => navigate(`/admin/clients/${c.displayId}`)} className="py-3 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700/30 px-2 rounded-lg cursor-pointer">
                <div>
                  <p className="text-sm font-medium">{c.displayId} • {c.name}</p>
                  <p className="text-xs text-gray-400">{c.address?.city || ''} {c.address?.state ? `• ${c.address.state}` : ''}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{c.status}</span>
              </div>
            ))}
            {clients.length === 0 && <p className="text-sm text-gray-400 py-6 text-center">No clients yet</p>}
          </div>
          <button onClick={() => navigate('/admin/clients')} className="mt-4 w-full text-sm border rounded-lg py-2 hover:bg-gray-900 hover:text-white dark:hover:bg-white dark:hover:text-gray-900 transition">View All Clients</button>
        </div>
      </div>
    </div>
  );
};

export default ClientDashboardPage;
