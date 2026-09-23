import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import { useAuthStore } from "../store/authStore";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Clock,
  ArrowUp,
  ArrowDown,
  LucideIcon,
  Folder,
  Layers,
  CheckSquare,
  Bug,
  PlayCircle,
  Activity,
  LayoutGrid,
  FolderOpen,
} from "lucide-react";
import { getDashboardStats, DashboardStats } from "../services/statisticsApi";
import ProjectOverviewSection from "../components/dashboard/ProjectOverviewSection";

type TabId = "overview" | "project";

interface Stat {
  name: string;
  value: string | number;
  change: string;
  changeType: "increase" | "decrease" | "neutral";
  icon: LucideIcon;
  accent: string;
}

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "project", label: "Project", icon: FolderOpen },
];

const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [statsData, setStatsData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dashboardTab");
      return saved === "project" ? "project" : "overview";
    }
    return "overview";
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getDashboardStats();
        setStatsData(data);
      } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const handleTabChange = (id: TabId) => {
    setActiveTab(id);
    localStorage.setItem("dashboardTab", id);
  };

  const stats: Stat[] = useMemo(() => {
    if (!statsData) return [];
    return [
      {
        name: "Projects",
        value: statsData.projectCount,
        change: "Accessible",
        changeType: "neutral",
        icon: Folder,
        accent: "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
      },
      {
        name: "Test Suites",
        value: statsData.totalSuites,
        change: `+${statsData.suitesAddedToday} today`,
        changeType: statsData.suitesAddedToday > 0 ? "increase" : "neutral",
        icon: Layers,
        accent: "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400",
      },
      {
        name: "Test Cases",
        value: statsData.totalTestCases,
        change: `+${statsData.testCasesModifiedToday} today`,
        changeType: statsData.testCasesModifiedToday > 0 ? "increase" : "neutral",
        icon: CheckSquare,
        accent: "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
      },
      {
        name: "Tickets",
        value: statsData.totalTickets ?? 0,
        change:
          (statsData.openTickets ?? 0) > 0
            ? `${statsData.openTickets} open`
            : "All clear",
        changeType:
          (statsData.openTickets ?? 0) > 0 ? "increase" : "neutral",
        icon: Bug,
        accent:
          (statsData.openTickets ?? 0) > 0
            ? "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"
            : "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
      },
      {
        name: "Test Runs",
        value: statsData.totalRuns ?? 0,
        change:
          (statsData.activeRuns ?? 0) > 0
            ? `${statsData.activeRuns} active`
            : "None active",
        changeType:
          (statsData.activeRuns ?? 0) > 0 ? "increase" : "neutral",
        icon: PlayCircle,
        accent: "bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400",
      },
    ];
  }, [statsData]);

  return (
    <div className="bg-white dark:bg-gray-900 min-h-full flex flex-col">
      {/* Compact header + tabs */}
      <div className="sticky top-0 z-20 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-100 dark:border-gray-800 px-4 sm:px-6 pt-4 pb-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight dark:text-gray-100">
              Welcome back, {user?.name || "User"}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Testing workspace overview at a glance
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 shrink-0">
            <Activity className="h-3.5 w-3.5 text-emerald-500" />
            <span>
              {new Date().toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                  isActive
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "overview" ? (
        <div className="p-4 sm:p-6 space-y-5 flex-1">
          {/* KPI row — 5 compact cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {loading
              ? Array(5)
                  .fill(0)
                  .map((_, i) => (
                    <div
                      key={i}
                      className="bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 h-28 animate-pulse"
                    />
                  ))
              : stats.map((stat, index) => (
                  <motion.div
                    key={stat.name}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-[0_1px_4px_rgba(0,0,0,0.04)] dark:shadow-none p-4 hover:shadow-[0_6px_16px_rgba(0,0,0,0.06)] transition-all duration-200"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">
                          {stat.name}
                        </p>
                        <p className="text-2xl font-bold text-gray-900 mt-1 tracking-tight dark:text-gray-100 tabular-nums">
                          {stat.value}
                        </p>
                      </div>
                      <div
                        className={`p-2.5 rounded-lg flex-shrink-0 ${stat.accent}`}
                      >
                        <stat.icon className="w-5 h-5" />
                      </div>
                    </div>
                    <div
                      className={`flex items-center mt-2 text-xs font-medium ${
                        stat.changeType === "increase"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : stat.changeType === "decrease"
                            ? "text-red-600 dark:text-red-400"
                            : "text-gray-400 dark:text-gray-500"
                      }`}
                    >
                      {stat.changeType === "increase" ? (
                        <ArrowUp className="w-3 h-3 mr-0.5" />
                      ) : stat.changeType === "decrease" ? (
                        <ArrowDown className="w-3 h-3 mr-0.5" />
                      ) : (
                        <Clock className="w-3 h-3 mr-0.5" />
                      )}
                      <span className="truncate">{stat.change}</span>
                    </div>
                  </motion.div>
                ))}
          </div>

          {/* Chart + Recent Activity — side by side, constrained height */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-[0_1px_4px_rgba(0,0,0,0.04)] dark:shadow-none p-4 sm:p-5 flex flex-col"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm sm:text-base font-semibold text-gray-900 tracking-tight dark:text-gray-100">
                    Activity Overview
                  </h2>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    Test cases modified · last 14 days
                  </p>
                </div>
              </div>
              <div className="h-52 sm:h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={statsData?.chartData || []}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke={
                        document.documentElement.classList.contains("dark")
                          ? "#404040"
                          : "#E5E7EB"
                      }
                    />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fill: document.documentElement.classList.contains("dark")
                          ? "#9ca3af"
                          : "#6B7280",
                        fontSize: 11,
                      }}
                      dy={4}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fill: document.documentElement.classList.contains("dark")
                          ? "#9ca3af"
                          : "#6B7280",
                        fontSize: 11,
                      }}
                      width={32}
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={{
                        stroke: document.documentElement.classList.contains("dark")
                          ? "#404040"
                          : "#E5E7EB",
                        strokeWidth: 2,
                      }}
                      contentStyle={{
                        borderRadius: "10px",
                        border: "none",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                        fontFamily: "inherit",
                        backgroundColor:
                          document.documentElement.classList.contains("dark")
                            ? "#242424"
                            : "#ffffff",
                        color:
                          document.documentElement.classList.contains("dark")
                            ? "#f5f5f5"
                            : "#1f2937",
                        fontSize: 12,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#007AFF"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#007AFF", strokeWidth: 2, stroke: "#fff" }}
                      activeDot={{
                        r: 5,
                        fill: "#007AFF",
                        strokeWidth: 2,
                        stroke: "#fff",
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-[0_1px_4px_rgba(0,0,0,0.04)] dark:shadow-none overflow-hidden flex flex-col"
            >
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-sm sm:text-base font-semibold text-gray-900 tracking-tight dark:text-gray-100">
                  Recent Activity
                </h2>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {statsData?.recentActivity?.length ?? 0}
                </span>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-gray-700/60 overflow-y-auto flex-1 max-h-64 sm:max-h-80">
                {statsData?.recentActivity?.map((activity) => (
                  <div
                    key={activity.id}
                    onClick={() =>
                      navigate(
                        `/test-manager/cases?testCaseId=${activity.testCaseId}`
                      )
                    }
                    className="px-4 py-2.5 hover:bg-gray-50/80 transition-colors dark:hover:bg-gray-700/40 cursor-pointer"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="flex-shrink-0 h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-medium text-[10px] shadow-sm overflow-hidden">
                        {activity.avatar.startsWith("http") ? (
                          <img
                            src={activity.avatar}
                            alt={activity.user}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          activity.avatar
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate dark:text-gray-100">
                          {activity.user}{" "}
                          <span className="text-gray-500 font-normal dark:text-gray-400">
                            {activity.action.replace(activity.user, "")}
                          </span>
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5 dark:text-gray-500">
                          {new Date(activity.time).toLocaleDateString()}{" "}
                          {new Date(activity.time).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                )) || (
                  <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    No recent activity
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      ) : (
        <div className="p-4 sm:p-6 flex-1">
          <ProjectOverviewSection alwaysShow />
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
