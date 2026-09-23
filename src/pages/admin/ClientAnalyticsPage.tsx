import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { getClients, getClientUsage } from "../../services/clientApi";
import type { Client, SeatUsage } from "../../types/client";
import { TrendingUp, Users, Building2, MapPin } from "lucide-react";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"];

const ClientAnalyticsPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [usageMap, setUsageMap] = useState<Record<string, SeatUsage>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const data = await getClients();
      setClients(data);
      const map: Record<string, SeatUsage> = {};
      for (const c of data) {
        try { map[c.displayId] = await getClientUsage(c.displayId); } catch {}
      }
      setUsageMap(map);
      setLoading(false);
    };
    load();
  }, []);

  const planData = useMemo(() => {
    const counts: Record<string, number> = {};
    clients.forEach(c => { counts[c.plan] = (counts[c.plan] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
  }, [clients]);

  const seatData = useMemo(() => {
    return clients.slice(0, 8).map(c => {
      const u = usageMap[c.displayId];
      return { name: c.displayId, used: u?.active || 0, total: u?.max === -1 ? 50 : (u?.max ?? c.maxUsers), plan: c.plan };
    });
  }, [clients, usageMap]);

  const cityData = useMemo(() => {
    const m: Record<string, number> = {};
    clients.forEach(c => {
      const city = (c as any).address?.city || "Unknown";
      m[city] = (m[city] || 0) + 1;
    });
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a,b)=>b.value-a.value).slice(0, 6);
  }, [clients]);

  const timeline = useMemo(() => {
    const byMonth: Record<string, number> = {};
    clients.forEach(c => {
      const d = new Date(c.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      byMonth[key] = (byMonth[key] || 0) + 1;
    });
    return Object.entries(byMonth).sort(([a],[b])=>a.localeCompare(b)).map(([name, value]) => ({ name, value }));
  }, [clients]);

  if (loading) return <div className="bg-white dark:bg-gray-900 min-h-full p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">{Array(4).fill(0).map((_,i)=><div key={i} className="h-64 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse"/> )}</div>;

  return (
    <div className="bg-white dark:bg-gray-900 min-h-full p-4 sm:p-6 space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><TrendingUp size={18}/> Client Analytics</h1>
          <p className="text-sm text-gray-500">Insights across {clients.length} clients — professional, Super Admin only</p>
        </div>
        <div className="hidden sm:flex gap-2 text-xs">
          <span className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 px-3 py-1 rounded-full flex items-center gap-1"><Building2 size={12}/> {clients.length} Clients</span>
          <span className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 px-3 py-1 rounded-full flex items-center gap-1"><Users size={12}/> {Object.values(usageMap).reduce((a,c)=>a+c.active,0)} Active Seats</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-gray-800 rounded-2xl border p-5">
          <h3 className="font-semibold mb-4">Plan Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={planData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name} ${value}`}>
                  {planData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-white dark:bg-gray-800 rounded-2xl border p-5">
          <h3 className="font-semibold mb-4">Seat Utilization by Client</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={seatData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="used" fill="#3b82f6" radius={[6,6,0,0]} name="Used" />
                <Bar dataKey="total" fill="#e5e7eb" radius={[6,6,0,0]} name="Capacity" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-gray-800 rounded-2xl border p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><MapPin size={14}/> Top Cities</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cityData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                <Tooltip />
                <Bar dataKey="value" fill="#10b981" radius={[0,6,6,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-white dark:bg-gray-800 rounded-2xl border p-5">
          <h3 className="font-semibold mb-4">Clients Created Over Time</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border p-5">
        <h3 className="font-semibold mb-3">Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-xl"><p className="text-gray-500 text-xs">Total Clients</p><p className="text-lg font-bold">{clients.length}</p></div>
          <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-xl"><p className="text-gray-500 text-xs">Avg Seats / Client</p><p className="text-lg font-bold">{clients.length ? (Object.values(usageMap).reduce((a,c)=>a+(c.max===-1?50:c.max),0)/clients.length).toFixed(1) : '—'}</p></div>
          <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-xl"><p className="text-gray-500 text-xs">Most Common Plan</p><p className="text-lg font-bold capitalize">{planData.sort((a,b)=>b.value-a.value)[0]?.name || '—'}</p></div>
          <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-xl"><p className="text-gray-500 text-xs">Top City</p><p className="text-lg font-bold">{cityData[0]?.name || '—'}</p></div>
        </div>
      </div>
    </div>
  );
};

export default ClientAnalyticsPage;
